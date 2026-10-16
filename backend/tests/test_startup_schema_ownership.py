"""Regression tests for migration-owned application startup."""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path
from unittest.mock import Mock

import pytest

from app import main


def _configure(monkeypatch: pytest.MonkeyPatch, *, environment: str, auth_mode: str, opt_in: str | None) -> None:
    monkeypatch.setenv("TESTING", "true")
    monkeypatch.setenv("ENVIRONMENT", environment)
    monkeypatch.setenv("AUTH_MODE", auth_mode)
    if opt_in is None:
        monkeypatch.delenv("LOCAL_DEVELOPMENT_AUTO_DDL", raising=False)
    else:
        monkeypatch.setenv("LOCAL_DEVELOPMENT_AUTO_DDL", opt_in)


@pytest.mark.parametrize("auth_mode", ["entra", "mystery_public"])
def test_production_create_app_never_initializes_schema(monkeypatch: pytest.MonkeyPatch, auth_mode: str) -> None:
    _configure(monkeypatch, environment="production", auth_mode=auth_mode, opt_in=None)
    init_db = Mock()
    monkeypatch.setattr(main, "init_db", init_db)

    main.create_app()

    init_db.assert_not_called()


def test_production_import_never_initializes_schema() -> None:
    backend = Path(__file__).resolve().parents[1]
    script = """
import sys
sys.path.insert(0, sys.argv[1])
from unittest.mock import Mock
import app.core.database
probe = Mock()
app.core.database.init_db = probe
import app.main
if probe.call_count:
    raise SystemExit("production import called init_db")
"""
    env = os.environ.copy()
    env.update({
        "PYTHONPATH": str(backend),
        "TESTING": "true",
        "ENVIRONMENT": "production",
        "AUTH_MODE": "mystery_public",
        "LOCAL_DEVELOPMENT_AUTO_DDL": "false",
    })
    result = subprocess.run(
        [sys.executable, "-I", "-c", script, str(backend)],
        cwd=backend,
        env=env,
        text=True,
        capture_output=True,
        check=False,
    )
    assert result.returncode == 0, result.stdout + result.stderr


def test_local_development_opt_in_initializes_schema(monkeypatch: pytest.MonkeyPatch) -> None:
    _configure(monkeypatch, environment="development", auth_mode="entra", opt_in="true")
    init_db = Mock()
    monkeypatch.setattr(main, "init_db", init_db)

    main.create_app()

    init_db.assert_called_once_with()


@pytest.mark.parametrize(
    ("environment", "auth_mode"),
    [("production", "entra"), ("production", "mystery_public"), ("development", "mystery_public")],
)
def test_auto_ddl_opt_in_is_rejected_outside_private_local_development(
    monkeypatch: pytest.MonkeyPatch, environment: str, auth_mode: str
) -> None:
    _configure(monkeypatch, environment=environment, auth_mode=auth_mode, opt_in="true")
    init_db = Mock()
    monkeypatch.setattr(main, "init_db", init_db)

    with pytest.raises(RuntimeError, match="permitted only"):
        main.create_app()

    init_db.assert_not_called()