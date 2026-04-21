"""add installation worker details and contractors

Revision ID: 20260421_000017
Revises: 20260415_000016
Create Date: 2026-04-21 18:40:00
"""

from alembic import op


revision = "20260421_000017"
down_revision = "20260415_000016"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS installation_contractors (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )

    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS ux_installation_contractors_name_ci
        ON installation_contractors (lower(name))
        """
    )

    op.execute(
        """
        ALTER TABLE installation_surveys
        ADD COLUMN IF NOT EXISTS contractor_name VARCHAR(255)
        """
    )

    op.execute(
        """
        ALTER TABLE installation_surveys
        ADD COLUMN IF NOT EXISTS field_team_members JSONB NOT NULL DEFAULT '[]'::jsonb
        """
    )

    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_installation_surveys_contractor_name
        ON installation_surveys (contractor_name)
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_installation_surveys_contractor_name")
    op.execute("ALTER TABLE installation_surveys DROP COLUMN IF EXISTS field_team_members")
    op.execute("ALTER TABLE installation_surveys DROP COLUMN IF EXISTS contractor_name")
    op.execute("DROP INDEX IF EXISTS ux_installation_contractors_name_ci")
    op.execute("DROP TABLE IF EXISTS installation_contractors")
