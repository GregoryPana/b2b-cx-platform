"""Optional disposable-PostgreSQL proof that production startup performs no DDL."""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

import psycopg
import pytest


DATABASE_URL = os.getenv("STARTUP_NO_DDL_POSTGRES_URL")
pytestmark = pytest.mark.skipif(not DATABASE_URL, reason="STARTUP_NO_DDL_POSTGRES_URL not provided")


def _relations() -> list[tuple[str, str]]:
    assert DATABASE_URL is not None
    with psycopg.connect(DATABASE_URL) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT table_schema, table_name
                FROM information_schema.tables
                WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
                ORDER BY table_schema, table_name
                """
            )
            return list(cursor.fetchall())


@pytest.mark.parametrize("auth_mode", ["entra", "mystery_public"])
def test_production_import_and_create_app_leave_postgresql_schema_unchanged(auth_mode: str) -> None:
    assert DATABASE_URL is not None
    backend = Path(__file__).resolve().parents[1]
    script = """
import sys
sys.path.insert(0, sys.argv[1])
import app.main
app.main.create_app()
"""
    before = _relations()
    env = os.environ.copy()
    env.update(
        {
            "DATABASE_URL": DATABASE_URL,
            "TESTING": "true",
            "ENVIRONMENT": "production",
            "AUTH_MODE": auth_mode,
            "LOCAL_DEVELOPMENT_AUTO_DDL": "false",
        }
    )
    result = subprocess.run(
        [sys.executable, "-I", "-c", script, str(backend)],
        cwd=backend,
        env=env,
        text=True,
        capture_output=True,
        check=False,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    assert _relations() == before
