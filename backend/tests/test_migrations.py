"""Alembic graph and disposable-PostgreSQL migration coverage."""

import importlib.util
import os
from pathlib import Path
import subprocess
import sys
import re

from alembic.config import Config
from alembic.script import ScriptDirectory
import pytest
from sqlalchemy import create_engine, inspect, text


BACKEND_DIR = Path(__file__).resolve().parents[1]
ALEMBIC_INI = BACKEND_DIR / "alembic.ini"
TARGET_REVISION = "20260714_000032"
DEPLOY_BACKEND = BACKEND_DIR.parent / "scripts" / "linux" / "deploy_backend.sh"


def _script_directory() -> ScriptDirectory:
    config = Config(str(ALEMBIC_INI))
    config.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    return ScriptDirectory.from_config(config)


def _migration_database_url() -> str:
    database_url = os.getenv("MIGRATION_TEST_DATABASE_URL")
    if not database_url:
        pytest.skip("MIGRATION_TEST_DATABASE_URL is required for PostgreSQL migration coverage")
    return database_url


def _run_alembic(database_url: str, *arguments: str, check: bool = True):
    env = os.environ.copy()
    env["DATABASE_URL"] = database_url
    return subprocess.run(
        [sys.executable, "-m", "alembic", "-c", str(ALEMBIC_INI), *arguments],
        cwd=BACKEND_DIR,
        env=env,
        check=check,
        text=True,
        capture_output=True,
    )


def _reset_public_schema(engine) -> None:
    with engine.begin() as connection:
        connection.execute(text("DROP SCHEMA public CASCADE"))
        connection.execute(text("CREATE SCHEMA public"))


def _current_revisions(engine) -> set[str]:
    with engine.connect() as connection:
        return set(connection.execute(text("SELECT version_num FROM alembic_version")).scalars())


def test_migration_graph_has_one_release_head() -> None:
    script = _script_directory()

    assert script.get_heads() == [TARGET_REVISION]
    merge_revision = script.get_revision(TARGET_REVISION)
    assert merge_revision is not None
    assert merge_revision.down_revision is not None
    assert set(merge_revision.down_revision) == {
        "20260609_000024",
        "20260713_000031",
        "7d8b6a1b3c45",
    }


def test_duplicate_work_orders_block_revision_instead_of_skipping_guard(monkeypatch) -> None:
    migration_path = (
        BACKEND_DIR
        / "alembic"
        / "versions"
        / "20260713_000031_add_field_team_members_and_work_order_unique.py"
    )
    spec = importlib.util.spec_from_file_location("migration_000031", migration_path)
    assert spec is not None and spec.loader is not None
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)

    class DuplicateResult:
        @staticmethod
        def scalar() -> int:
            return 1

    class DuplicateBind:
        @staticmethod
        def execute(_statement):
            return DuplicateResult()

    executed_sql: list[str] = []
    monkeypatch.setattr(migration, "_table_exists", lambda _bind, _table: True)
    monkeypatch.setattr(migration, "_validate_work_order_index", lambda _bind: False)
    monkeypatch.setattr(migration.op, "get_bind", lambda: DuplicateBind())
    monkeypatch.setattr(migration.op, "execute", lambda statement: executed_sql.append(str(statement)))

    with pytest.raises(RuntimeError, match="revision has not been applied"):
        migration.upgrade()

    assert not any(migration.WORK_ORDER_INDEX in statement for statement in executed_sql)


def test_deploy_backend_never_blindly_stamps_migration_lineage() -> None:
    script = DEPLOY_BACKEND.read_text(encoding="utf-8")

    assert not re.search(r'\balembic\s+stamp\b', script, re.IGNORECASE)
    assert "DuplicateTable" not in script
    assert "already exists" not in script
    assert "Refusing to infer or stamp database lineage." in script


def test_000031_rejects_wrong_same_name_index_without_stamping_revision() -> None:
    database_url = _migration_database_url()
    engine = create_engine(database_url)
    try:
        assert inspect(engine).get_table_names() == []
        _run_alembic(database_url, "upgrade", "20260712_000030")
        with engine.begin() as connection:
            connection.execute(
                text(
                    "CREATE INDEX ux_installation_surveys_work_order_ci "
                    "ON installation_surveys (work_order)"
                )
            )

        result = _run_alembic(database_url, "upgrade", "20260713_000031", check=False)

        assert result.returncode != 0
        assert "incompatible with the required unique" in result.stderr
        assert _current_revisions(engine) == {"20260712_000030"}
        index = next(
            item
            for item in inspect(engine).get_indexes("installation_surveys")
            if item["name"] == "ux_installation_surveys_work_order_ci"
        )
        assert index["unique"] is False
        assert index["column_names"] == ["work_order"]
        assert "field_team_members" not in inspect(engine).get_table_names()
    finally:
        _reset_public_schema(engine)
        engine.dispose()


def test_000031_accepts_valid_existing_exact_index() -> None:
    database_url = _migration_database_url()
    engine = create_engine(database_url)
    try:
        assert inspect(engine).get_table_names() == []
        _run_alembic(database_url, "upgrade", "20260712_000030")
        with engine.begin() as connection:
            connection.execute(
                text(
                    """
                    CREATE UNIQUE INDEX ux_installation_surveys_work_order_ci
                    ON installation_surveys (lower(work_order))
                    WHERE work_order IS NOT NULL AND work_order <> ''
                    """
                )
            )

        _run_alembic(database_url, "upgrade", "20260713_000031")

        assert _current_revisions(engine) == {"20260713_000031"}
        assert "field_team_members" in inspect(engine).get_table_names()
        with engine.connect() as connection:
            contract = connection.execute(
                text(
                    """
                    SELECT
                        index_metadata.indisunique,
                        pg_get_indexdef(index_metadata.indexrelid, 1, true),
                        pg_get_expr(index_metadata.indpred, index_metadata.indrelid, true)
                    FROM pg_index index_metadata
                    JOIN pg_class index_relation
                      ON index_relation.oid = index_metadata.indexrelid
                    WHERE index_relation.relname = 'ux_installation_surveys_work_order_ci'
                    """
                )
            ).one()
        assert contract == (
            True,
            "lower(work_order::text)",
            "work_order IS NOT NULL AND work_order::text <> ''::text",
        )
    finally:
        _reset_public_schema(engine)
        engine.dispose()


def test_d01_is_a_non_destructive_retired_branch_marker() -> None:
    database_url = _migration_database_url()
    engine = create_engine(database_url)
    try:
        assert inspect(engine).get_table_names() == []
        _run_alembic(database_url, "upgrade", "20260227_000009")
        with engine.begin() as connection:
            connection.execute(text("INSERT INTO businesses (name) VALUES ('preserve-me')"))

        _run_alembic(database_url, "upgrade", "d01c3a366199")

        assert _current_revisions(engine) == {"d01c3a366199"}
        assert "programs" not in inspect(engine).get_table_names()
        with engine.connect() as connection:
            assert connection.execute(text("SELECT name FROM businesses")).scalar_one() == "preserve-me"
    finally:
        _reset_public_schema(engine)
        engine.dispose()


def test_d01_downgrade_is_non_destructive() -> None:
    database_url = _migration_database_url()
    engine = create_engine(database_url)
    try:
        assert inspect(engine).get_table_names() == []
        _run_alembic(database_url, "upgrade", "d01c3a366199")
        with engine.begin() as connection:
            connection.execute(text("INSERT INTO businesses (name) VALUES ('Keep me')"))

        _run_alembic(database_url, "downgrade", "20260227_000009")

        assert _current_revisions(engine) == {"20260227_000009"}
        with engine.connect() as connection:
            assert connection.execute(text("SELECT name FROM businesses")).scalar_one() == "Keep me"
    finally:
        _reset_public_schema(engine)
        engine.dispose()


def test_000018_rejects_incomplete_mystery_constraints_without_side_effects() -> None:
    database_url = _migration_database_url()
    engine = create_engine(database_url)
    try:
        assert inspect(engine).get_table_names() == []
        _run_alembic(database_url, "upgrade", "20260421_000017")
        with engine.begin() as connection:
            connection.execute(
                text(
                    """
                    CREATE TABLE mystery_shopper_locations (
                        id SERIAL PRIMARY KEY,
                        name VARCHAR(255) NOT NULL,
                        business_id INTEGER,
                        active BOOLEAN NOT NULL DEFAULT TRUE,
                        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    )
                    """
                )
            )
            connection.execute(
                text("INSERT INTO mystery_shopper_locations (name) VALUES ('preserve-me')")
            )

        result = _run_alembic(database_url, "upgrade", "20260423_000018", check=False)

        assert result.returncode != 0
        assert "incomplete or incompatible" in result.stderr
        assert _current_revisions(engine) == {"20260421_000017"}
        assert "mystery_shopper_assessments" not in inspect(engine).get_table_names()
        with engine.connect() as connection:
            assert connection.execute(
                text("SELECT name FROM mystery_shopper_locations")
            ).scalar_one() == "preserve-me"
    finally:
        _reset_public_schema(engine)
        engine.dispose()


def test_000024_downgrade_tolerates_questions_without_updated_at() -> None:
    database_url = _migration_database_url()
    engine = create_engine(database_url)
    try:
        assert inspect(engine).get_table_names() == []
        _run_alembic(database_url, "upgrade", "20260610_000024")
        assert "updated_at" not in {
            column["name"] for column in inspect(engine).get_columns("questions")
        }

        _run_alembic(database_url, "downgrade", "20260528_000023")

        assert _current_revisions(engine) == {"20260528_000023"}
    finally:
        _reset_public_schema(engine)
        engine.dispose()


def test_blank_postgresql_database_upgrades_to_release_head() -> None:
    database_url = _migration_database_url()

    engine = create_engine(database_url)
    try:
        assert inspect(engine).get_table_names() == [], "migration test database must start blank"
    finally:
        engine.dispose()

    _run_alembic(database_url, "upgrade", TARGET_REVISION)

    engine = create_engine(database_url)
    try:
        inspector = inspect(engine)
        tables = set(inspector.get_table_names())
        assert {
            "mystery_shopper_locations",
            "mystery_shopper_assessments",
            "mystery_shopper_purpose_options",
            "field_team_members",
        }.issubset(tables)
        assert "ux_installation_surveys_work_order_ci" in {
            index["name"] for index in inspector.get_indexes("installation_surveys")
        }
        with engine.connect() as connection:
            revisions = set(connection.execute(text("SELECT version_num FROM alembic_version")).scalars())
        assert revisions == {TARGET_REVISION}
    finally:
        _reset_public_schema(engine)
        engine.dispose()
