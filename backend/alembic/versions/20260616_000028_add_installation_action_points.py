"""add action_points to installation_surveys

Revision ID: 20260616_000028
Revises: 20260615_000027
Create Date: 2026-06-16 09:00:00

Lets inspectors capture up to 5 action points/recommendations alongside
the 7 scored questions, surfaced in the dashboard review and reports.
"""

from alembic import op


revision = "20260616_000028"
down_revision = "20260615_000027"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE installation_surveys
        ADD COLUMN IF NOT EXISTS action_points JSONB NOT NULL DEFAULT '[]'::jsonb
        """
    )


def downgrade() -> None:
    op.execute("ALTER TABLE installation_surveys DROP COLUMN IF EXISTS action_points")
