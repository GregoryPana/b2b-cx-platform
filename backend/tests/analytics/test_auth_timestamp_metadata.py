"""Native catalog gate proof on a runner-attested, owned disposable database only."""
from __future__ import annotations

import ast
import importlib.util
import json
import os
from pathlib import Path
import uuid

import pytest
from sqlalchemy import create_engine, event, text
from sqlalchemy.engine import make_url

from fixture_guard import PG_URL_ENV, PG_DATA_ENV, PG_NONCE_ENV, attest_disposable_cluster

ROOT = Path(__file__).resolve().parents[3]


def load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


helper = load_module("auth_timestamp_metadata", ROOT / "scripts/linux/inspect_auth_timestamp_metadata.py")
MIGRATION = ROOT / "backend/alembic/versions/20260609_000024_add_mystery_public_auth_core.py"


@pytest.fixture
def catalog_engine():
    url = os.environ.get(PG_URL_ENV)
    if not url:
        pytest.skip("run the guarded verify_analytics_calculations.py runner")
    attest_disposable_cluster(url, os.environ.get(PG_DATA_ENV), os.environ.get(PG_NONCE_ENV))
    name = "auth_catalog_fixture_" + uuid.uuid4().hex
    admin = create_engine(url, isolation_level="AUTOCOMMIT")
    engine = None
    with admin.connect() as conn:
        conn.execute(text(f'CREATE DATABASE "{name}"'))
    try:
        from alembic.migration import MigrationContext
        from alembic.operations import Operations

        engine = create_engine(make_url(url).set(database=name))
        with engine.begin() as conn:
            migration = load_module("auth_core_catalog_fixture", MIGRATION)
            migration.op = Operations(MigrationContext.configure(conn))
            migration.upgrade()
            conn.execute(text("CREATE TABLE public.alembic_version (version_num varchar(32) NOT NULL)"))
            conn.execute(text("INSERT INTO public.alembic_version VALUES ('20260714_000032')"))
        yield engine
    finally:
        if engine is not None:
            engine.dispose()
        attest_disposable_cluster(url, os.environ.get(PG_DATA_ENV), os.environ.get(PG_NONCE_ENV))
        with admin.connect() as conn:
            conn.execute(text(f'DROP DATABASE "{name}" WITH (FORCE)'))
        admin.dispose()


def inspect(engine, zone):
    readonly = create_engine(engine.url, connect_args={"connect_timeout": 5, "options": f"-c default_transaction_read_only=on -c statement_timeout=5000 -c timezone={zone}"})
    seen = []

    @event.listens_for(readonly, "before_cursor_execute")
    def only_metadata(conn, cursor, statement, parameters, context, executemany):
        # SQLAlchemy dialect initialization also issues SELECT/SHOW. No DDL/DML
        # may be hidden inside the inspector, even if it catches the exception.
        seen.append(statement)
        assert statement.lstrip().split()[0].upper() in {"SELECT", "SHOW"}

    try:
        with readonly.connect() as conn:
            report = helper.inspect_on_connection(conn)
            assert conn.execute(text("SHOW transaction_read_only")).scalar_one() == "on"
            assert conn.execute(text("SHOW statement_timeout")).scalar_one() == "5s"
        assert seen
        # Separately prove PostgreSQL enforces the read-only connection itself.
        event.remove(readonly, "before_cursor_execute", only_metadata)
        with readonly.connect() as conn:
            with pytest.raises(Exception) as error:
                conn.execute(text("INSERT INTO public.alembic_version VALUES ('forbidden')"))
            assert getattr(error.value.orig, "sqlstate", getattr(error.value.orig, "pgcode", None)) == "25006"
        return report
    finally:
        readonly.dispose()


@pytest.mark.parametrize("zone", ["UTC", "Indian/Mauritius"])
def test_auth_timestamp_metadata_positive(catalog_engine, zone):
    report = inspect(catalog_engine, zone)
    assert report["compatible"] is True
    assert report["heads"] == ["20260714_000032"]
    assert report["session_timezone"] == zone
    assert len(report["auth_timestamp_column_types"]) == sum(map(len, helper.EXPECTED_COLUMNS.values()))
    assert all(r["actual_type"] == "timestamp with time zone" for r in report["auth_timestamp_column_types"])


@pytest.mark.parametrize("zone", ["UTC", "Indian/Mauritius"])
def test_auth_timestamp_metadata_naive_fails(catalog_engine, zone):
    with catalog_engine.begin() as conn:
        conn.execute(text("ALTER TABLE public.mystery_mfa_challenges ALTER COLUMN expires_at TYPE timestamp without time zone"))
    report = inspect(catalog_engine, zone)
    assert report["compatible"] is False
    bad = [r for r in report["auth_timestamp_column_types"] if r["status"] != "compatible"]
    assert [(r["table"], r["column"], r["actual_type"]) for r in bad] == [("mystery_mfa_challenges", "expires_at", "timestamp without time zone")]


def test_auth_timestamp_metadata_missing_fails(catalog_engine):
    with catalog_engine.begin() as conn:
        conn.execute(text("ALTER TABLE public.mystery_users DROP COLUMN locked_until"))
    report = inspect(catalog_engine, "UTC")
    assert report["compatible"] is False
    assert [(r["column"], r["status"]) for r in report["auth_timestamp_column_types"] if r["status"] != "compatible"] == [("locked_until", "missing")]
    # Empty catalog results are not evidence of compatibility.
    with catalog_engine.begin() as conn:
        for table in helper.EXPECTED_COLUMNS:
            conn.execute(text(f'DROP TABLE public."{table}" CASCADE'))
    report = inspect(catalog_engine, "UTC")
    assert report["compatible"] is False
    assert len(report["auth_timestamp_column_types"]) == sum(map(len, helper.EXPECTED_COLUMNS.values()))
    assert all(r["status"] == "missing" for r in report["auth_timestamp_column_types"])


def test_auth_timestamp_metadata_unknown_and_head_fail(catalog_engine):
    with catalog_engine.begin() as conn:
        conn.execute(text("ALTER TABLE public.mystery_users ALTER COLUMN locked_until TYPE text"))
        conn.execute(text("UPDATE public.alembic_version SET version_num = 'private-unreviewed-revision'"))
    report = inspect(catalog_engine, "UTC")
    assert report["compatible"] is False
    assert report["heads"] == [] and report["head_status"] == "incompatible"
    assert "private-unreviewed-revision" not in json.dumps(report)
    assert [(r["column"], r["actual_type"]) for r in report["auth_timestamp_column_types"] if r["status"] != "compatible"] == [("locked_until", "unknown")]
    # A correct catalog must not mask an unknown or empty migration-head result.
    with catalog_engine.begin() as conn:
        conn.execute(text("ALTER TABLE public.mystery_users ALTER COLUMN locked_until TYPE timestamp with time zone USING NULL::timestamptz"))
    report = inspect(catalog_engine, "UTC")
    assert all(r["status"] == "compatible" for r in report["auth_timestamp_column_types"])
    assert report["compatible"] is False
    with catalog_engine.begin() as conn:
        conn.execute(text("DELETE FROM public.alembic_version"))
    assert inspect(catalog_engine, "UTC")["compatible"] is False


def test_auth_timestamp_metadata_exact_migration_contract():
    expected = {}
    for node in ast.walk(ast.parse(MIGRATION.read_text())):
        if not isinstance(node, ast.Call) or not isinstance(node.func, ast.Attribute) or node.func.attr != "create_table":
            continue
        columns = []
        for col in node.args[1:]:
            if isinstance(col, ast.Call) and len(col.args) >= 2:
                typ = col.args[1]
                if isinstance(typ, ast.Call) and isinstance(typ.func, ast.Attribute) and typ.func.attr == "DateTime":
                    assert any(k.arg == "timezone" and isinstance(k.value, ast.Constant) and k.value.value is True for k in typ.keywords)
                    columns.append(col.args[0].value)
        expected[node.args[0].value] = tuple(columns)
    assert expected == helper.EXPECTED_COLUMNS


def test_auth_timestamp_metadata_error_redacted(monkeypatch, capsys):
    import dotenv

    monkeypatch.setattr(dotenv, "load_dotenv", lambda *a, **k: None)
    monkeypatch.setenv("DATABASE_URL", "fixture-unused")
    def fail(*args, **kwargs):
        assert kwargs["connect_args"] == {"connect_timeout": 5, "options": "-c default_transaction_read_only=on -c statement_timeout=5000"}
        raise RuntimeError("postgresql://secret-user:secret-token@private-host/private-db SELECT personal")
    monkeypatch.setattr(helper, "create_engine", fail)
    assert helper.main() == 1
    assert json.loads(capsys.readouterr().out) == {"compatible": False, "error_class": "MetadataInspectionError"}
