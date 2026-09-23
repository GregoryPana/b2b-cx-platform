"""add field_team_members master table and unique work_order guard

Revision ID: 20260713_000031
Revises: 20260712_000030
Create Date: 2026-07-13 09:30:00

Two independent fixes for the installation assessment survey:

  1. `installation_surveys.work_order` had no uniqueness guard and the
     create endpoint always INSERTs a fresh row, so a double-submit or an
     accidental resubmission of the same work order silently created a
     duplicate survey. This adds a case-insensitive unique index, mirroring
     `ux_installation_contractors_name_ci`. If duplicate work orders already
     exist, the migration fails before Alembic marks the revision applied.
     Operators must resolve the duplicates and rerun the migration so the
     uniqueness invariant cannot be silently omitted.

  2. `field_team_members` was stored as free-text JSONB per survey row with
     no master list (unlike `installation_contractors`, which already has
     one). This adds a `field_team_members` table with the same
     case-insensitive-unique shape, backfilled from every distinct name
     already saved on existing surveys, so future submissions can be
     validated/normalized against it and analytics can group by person
     instead of by raw string.
"""

from alembic import op
from sqlalchemy import inspect
from sqlalchemy import text as sa_text


revision = "20260713_000031"
down_revision = "20260712_000030"
branch_labels = None
depends_on = None

SURVEYS_TABLE = "installation_surveys"
WORK_ORDER_INDEX = "ux_installation_surveys_work_order_ci"
TEAM_MEMBERS_TABLE = "field_team_members"
TEAM_MEMBERS_INDEX = "ux_field_team_members_name_ci"


def _table_exists(bind, table_name: str) -> bool:
    return table_name in inspect(bind).get_table_names()


def _validate_work_order_index(bind) -> bool:
    """Return False when absent; fail closed when a same-name relation is incompatible."""
    row = bind.execute(
        sa_text(
            """
            WITH target AS (
                SELECT relation.oid AS table_oid, relation.relnamespace AS namespace_oid
                FROM pg_class relation
                WHERE relation.oid = to_regclass(:table_name)
            )
            SELECT
                indexed_relation.oid = target.table_oid AS targets_expected_table,
                index_metadata.indisunique AS is_unique,
                index_metadata.indisvalid AS is_valid,
                index_metadata.indisready AS is_ready,
                index_metadata.indnkeyatts AS key_count,
                index_metadata.indnatts AS attribute_count,
                access_method.amname AS access_method,
                pg_get_indexdef(index_relation.oid, 1, true) AS key_expression,
                pg_get_expr(
                    index_metadata.indpred,
                    index_metadata.indrelid,
                    true
                ) AS predicate
            FROM target
            JOIN pg_class index_relation
              ON index_relation.relnamespace = target.namespace_oid
             AND index_relation.relname = :index_name
            LEFT JOIN pg_index index_metadata
              ON index_metadata.indexrelid = index_relation.oid
            LEFT JOIN pg_class indexed_relation
              ON indexed_relation.oid = index_metadata.indrelid
            LEFT JOIN pg_am access_method
              ON access_method.oid = index_relation.relam
            """
        ),
        {"table_name": SURVEYS_TABLE, "index_name": WORK_ORDER_INDEX},
    ).mappings().one_or_none()

    if row is None:
        return False

    expected = {
        "targets_expected_table": True,
        "is_unique": True,
        "is_valid": True,
        "is_ready": True,
        "key_count": 1,
        "attribute_count": 1,
        "access_method": "btree",
        "key_expression": "lower(work_order::text)",
        "predicate": "work_order IS NOT NULL AND work_order::text <> ''::text",
    }
    mismatches = [
        f"{field}={row[field]!r} (expected {value!r})"
        for field, value in expected.items()
        if row[field] != value
    ]
    if mismatches:
        raise RuntimeError(
            f"Existing {WORK_ORDER_INDEX} is incompatible with the required unique "
            "lower(work_order) partial-index contract: " + "; ".join(mismatches)
        )
    return True


def upgrade() -> None:
    bind = op.get_bind()

    work_order_index_exists = False
    if _table_exists(bind, SURVEYS_TABLE):
        work_order_index_exists = _validate_work_order_index(bind)

    # 1) Master field_team_members table, mirroring installation_contractors.
    op.execute(
        f"""
        CREATE TABLE IF NOT EXISTS {TEAM_MEMBERS_TABLE} (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )
    op.execute(
        f"""
        CREATE UNIQUE INDEX IF NOT EXISTS {TEAM_MEMBERS_INDEX}
        ON {TEAM_MEMBERS_TABLE} (lower(name))
        """
    )

    # Backfill from every distinct name already recorded on surveys.
    if _table_exists(bind, SURVEYS_TABLE):
        op.execute(
            f"""
            INSERT INTO {TEAM_MEMBERS_TABLE} (name)
            SELECT DISTINCT ON (lower(member))
                member
            FROM (
                SELECT trim(jsonb_array_elements_text(
                    CASE
                        WHEN jsonb_typeof(field_team_members) = 'array'
                            THEN field_team_members
                        ELSE '[]'::jsonb
                    END
                )) AS member
                FROM {SURVEYS_TABLE}
                WHERE field_team_members IS NOT NULL
            ) names
            WHERE member <> ''
            ON CONFLICT DO NOTHING
            """
        )

    # 2) Case-insensitive uniqueness guard on work_order, if data allows it.
    if _table_exists(bind, SURVEYS_TABLE) and not work_order_index_exists:
        duplicate_count = bind.execute(
            sa_text(
                f"""
                SELECT COUNT(*) FROM (
                    SELECT lower(work_order)
                    FROM {SURVEYS_TABLE}
                    WHERE work_order IS NOT NULL AND work_order <> ''
                    GROUP BY lower(work_order)
                    HAVING COUNT(*) > 1
                ) dupes
                """
            )
        ).scalar()

        if duplicate_count:
            raise RuntimeError(
                f"Cannot create {WORK_ORDER_INDEX}: found {duplicate_count} duplicate "
                "case-insensitive work_order value(s). Resolve the duplicates and rerun "
                "the migration; the revision has not been applied."
            )

        op.execute(
            f"""
            CREATE UNIQUE INDEX {WORK_ORDER_INDEX}
            ON {SURVEYS_TABLE} (lower(work_order))
            WHERE work_order IS NOT NULL AND work_order <> ''
            """
        )
        if not _validate_work_order_index(bind):
            raise RuntimeError(f"Failed to create required index {WORK_ORDER_INDEX}")


def downgrade() -> None:
    bind = op.get_bind()
    if _table_exists(bind, SURVEYS_TABLE):
        op.execute(f"DROP INDEX IF EXISTS {WORK_ORDER_INDEX}")
    op.execute(f"DROP INDEX IF EXISTS {TEAM_MEMBERS_INDEX}")
    op.execute(f"DROP TABLE IF EXISTS {TEAM_MEMBERS_TABLE}")
