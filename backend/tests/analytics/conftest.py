"""Fixtures for the analytics calculation-assurance suite.

These tests execute the real analytics SQL against a disposable PostgreSQL server. They are opt-in:
nothing here connects to a database unless the runner (`scripts/dev/verify_analytics_calculations.py`)
exports `CWSCX_ANALYTICS_PG_URL` together with the data-directory path and nonce of the cluster it
created. `fixture_guard.attest_disposable_cluster` verifies that attestation before any DDL, and the
fixtures then create (and finally drop) their own uniquely named database inside that cluster.

Each test runs inside an outer transaction that is rolled back, so tests are independent and leave no
rows behind. Application routers never commit.
"""

from __future__ import annotations

import os
import sys
import uuid
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))

from sqlalchemy import create_engine, text  # noqa: E402
from sqlalchemy.engine import make_url  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from fixture_guard import (  # noqa: E402
    PG_DATA_ENV,
    PG_NONCE_ENV,
    PG_URL_ENV,
    attest_disposable_cluster,
)

@pytest.fixture(scope="session")
def pg_engine():
    url = os.environ.get(PG_URL_ENV)
    if not url:
        pytest.skip(
            f"{PG_URL_ENV} not set - run scripts/dev/verify_analytics_calculations.py "
            "to provision a disposable PostgreSQL fixture"
        )
    # Attest BEFORE any DDL: runner-exported data directory + nonce marker + SHOW data_directory + no TCP listener.
    attest_disposable_cluster(url, os.environ.get(PG_DATA_ENV), os.environ.get(PG_NONCE_ENV))

    # Fresh uniquely named database inside the attested cluster; only that database is ever dropped.
    db_name = f"analytics_fixture_{uuid.uuid4().hex[:16]}"
    admin = create_engine(url, future=True, isolation_level="AUTOCOMMIT")
    with admin.connect() as conn:
        conn.execute(text(f'CREATE DATABASE "{db_name}"'))
    engine = create_engine(make_url(url).set(database=db_name), future=True)
    try:
        from pg_schema import create_schema

        with Session(engine) as session:
            create_schema(session)
            session.commit()
        yield engine
    finally:
        engine.dispose()
        with admin.connect() as conn:
            conn.execute(text(f'DROP DATABASE IF EXISTS "{db_name}" WITH (FORCE)'))
        admin.dispose()


@pytest.fixture()
def db(pg_engine):
    """Session bound to a rolled-back outer transaction."""
    from app.core.db_inspect import reset_cache

    reset_cache()
    connection = pg_engine.connect()
    outer = connection.begin()
    session = Session(bind=connection)
    try:
        yield session
    finally:
        session.close()
        outer.rollback()
        connection.close()
        reset_cache()


@pytest.fixture()
def fx(db):
    from pg_schema import Fx

    return Fx(db)


@pytest.fixture()
def api_client(db):
    """TestClient over the real routers with get_db bound to the test session."""
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    from app.api.admin_dashboard import router as admin_router
    from app.api.dashboard_compat import router as compat_router
    from app.core.database import get_db
    from app.routers.analytics import router as analytics_router

    app = FastAPI()
    for router in (analytics_router, compat_router, admin_router):
        app.include_router(router)
    app.dependency_overrides[get_db] = lambda: db
    from app.core.auth.dependencies import get_current_user
    from app.core.auth.entra import AuthUser
    app.dependency_overrides[get_current_user] = lambda: AuthUser(
        sub="analytics-admin", name="Fixture Admin", preferred_username="fixture@example.invalid",
        roles=("CX_SUPER_ADMIN",), claims={"auth_mode": "entra"},
    )
    return TestClient(app, raise_server_exceptions=False)
