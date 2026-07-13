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
     exist in the data, this step is skipped with a NOTICE rather than
     failing the whole migration — remove the duplicates first, then re-run
     `alembic upgrade head` to pick up the guard.

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


def _index_exists(bind, table_name: str, index_name: str) -> bool:
    return any(ix.get("name") == index_name for ix in inspect(bind).get_indexes(table_name))


def upgrade() -> None:
    bind = op.get_bind()

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
    if _table_exists(bind, SURVEYS_TABLE) and not _index_exists(bind, SURVEYS_TABLE, WORK_ORDER_INDEX):
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
            op.execute(
                f"""
                DO $$
                BEGIN
                    RAISE NOTICE 'Skipping unique index {WORK_ORDER_INDEX}: % duplicate work_order value(s) found. Resolve duplicates and re-run this migration.', {duplicate_count};
                END $$;
                """
            )
        else:
            op.execute(
                f"""
                CREATE UNIQUE INDEX IF NOT EXISTS {WORK_ORDER_INDEX}
                ON {SURVEYS_TABLE} (lower(work_order))
                WHERE work_order IS NOT NULL AND work_order <> ''
                """
            )


def downgrade() -> None:
    bind = op.get_bind()
    if _table_exists(bind, SURVEYS_TABLE):
        op.execute(f"DROP INDEX IF EXISTS {WORK_ORDER_INDEX}")
    op.execute(f"DROP INDEX IF EXISTS {TEAM_MEMBERS_INDEX}")
    op.execute(f"DROP TABLE IF EXISTS {TEAM_MEMBERS_TABLE}")
