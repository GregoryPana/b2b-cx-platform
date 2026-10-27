"""Regressions for the isolated analytics/full-suite verification runner."""

from __future__ import annotations

import importlib.util
from pathlib import Path

import pytest
import sqlalchemy


RUNNER_PATH = Path(__file__).resolve().parents[2] / "scripts" / "dev" / "verify_analytics_calculations.py"
SPEC = importlib.util.spec_from_file_location("verify_analytics_calculations", RUNNER_PATH)
assert SPEC is not None and SPEC.loader is not None
runner = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(runner)


def test_backend_env_removes_unsafe_inherited_startup_url(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("STARTUP_NO_DDL_POSTGRES_URL", "postgresql://shared.invalid/production")
    env = runner.backend_env("postgresql://fixture/app", "/fixture/data", "nonce")
    assert "STARTUP_NO_DDL_POSTGRES_URL" not in env


def test_full_fixture_databases_are_distinct_and_startup_uri_is_plain_psycopg(monkeypatch) -> None:
    statements: list[str] = []
    monkeypatch.setattr(runner, "_database_ddl", lambda _sa, _url, _data, _nonce, sql: statements.append(sql))
    tokens = iter(("migration-token", "startup-token"))
    monkeypatch.setattr(runner.secrets, "token_hex", lambda _size: next(tokens))

    migration_url, startup_url, created = runner._provision_full_suite_databases(
        sqlalchemy, "postgresql+psycopg2://fixture:synthetic-secret@/postgres?host=/socket", "/data", "nonce"
    )

    assert created == ["migration_fixture_migration-token", "startup_noddl_fixture_startup-token"]
    assert len(set(created)) == 2
    assert sqlalchemy.engine.make_url(migration_url).database == created[0]
    assert sqlalchemy.engine.make_url(startup_url).database == created[1]
    assert sqlalchemy.engine.make_url(startup_url).drivername == "postgresql"
    assert statements == [f'CREATE DATABASE "{name}"' for name in created]


def test_partial_provisioning_failure_cleans_database_already_created(monkeypatch) -> None:
    calls: list[str] = []

    def ddl(_sa, _url, _data, _nonce, statement):
        calls.append(statement)
        if statement.startswith('CREATE DATABASE "startup_noddl_fixture_'):
            raise RuntimeError("synthetic create failure")

    monkeypatch.setattr(runner, "_database_ddl", ddl)
    monkeypatch.setattr(runner.secrets, "token_hex", lambda _size: "fixed")

    with pytest.raises(RuntimeError, match="synthetic create failure"):
        runner._provision_full_suite_databases(sqlalchemy, "postgresql:///postgres", "/data", "nonce")

    assert calls[-1] == 'DROP DATABASE IF EXISTS "migration_fixture_fixed" WITH (FORCE)'


def test_database_ddl_reattests_before_connecting_or_executing(monkeypatch) -> None:
    import fixture_guard

    events: list[object] = []
    monkeypatch.setattr(
        fixture_guard,
        "attest_disposable_cluster",
        lambda url, data, nonce: events.append(("attest", url, data, nonce)),
    )

    class Connection:
        def __enter__(self):
            events.append("connect")
            return self

        def __exit__(self, *_args):
            return None

        def execute(self, statement):
            events.append(("execute", str(statement)))

    class Engine:
        def connect(self):
            return Connection()

        def dispose(self):
            events.append("dispose")

    monkeypatch.setattr(
        sqlalchemy,
        "create_engine",
        lambda url, isolation_level: events.append(("engine", url, isolation_level)) or Engine(),
    )

    runner._database_ddl(sqlalchemy, "postgresql:///postgres", "/data", "nonce", 'CREATE DATABASE "fixture"')

    assert events == [
        ("attest", "postgresql:///postgres", "/data", "nonce"),
        ("engine", "postgresql:///postgres", "AUTOCOMMIT"),
        "connect",
        ("execute", 'CREATE DATABASE "fixture"'),
        "dispose",
    ]


def test_cleanup_attempts_every_database_after_one_drop_fails(monkeypatch) -> None:
    calls: list[str] = []

    def ddl(_sa, _url, _data, _nonce, statement):
        calls.append(statement)
        if "startup_noddl_fixture" in statement:
            raise RuntimeError("synthetic drop failure")

    monkeypatch.setattr(runner, "_database_ddl", ddl)
    with pytest.raises(RuntimeError, match="synthetic drop failure"):
        runner._drop_fixture_databases(
            sqlalchemy,
            "postgresql:///postgres",
            "/data",
            "nonce",
            ["migration_fixture_one", "startup_noddl_fixture_two"],
        )

    assert calls == [
        'DROP DATABASE IF EXISTS "startup_noddl_fixture_two" WITH (FORCE)',
        'DROP DATABASE IF EXISTS "migration_fixture_one" WITH (FORCE)',
    ]


def test_fixture_provisioning_does_not_print_uri_or_secret(monkeypatch, capsys) -> None:
    monkeypatch.setattr(runner, "_database_ddl", lambda *_args: None)
    monkeypatch.setattr(runner.secrets, "token_hex", lambda _size: "fixed")
    secret = "synthetic-secret-must-not-be-logged"

    runner._provision_full_suite_databases(
        sqlalchemy, f"postgresql://fixture:{secret}@/postgres?host=/socket", "/data", "nonce"
    )

    captured = capsys.readouterr()
    assert secret not in captured.out + captured.err
    assert "postgresql://" not in captured.out + captured.err