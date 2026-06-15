"""add approval_timestamp and approval_notes to visits

Revision ID: 20260615_000027
Revises: 20260612_000026
Create Date: 2026-06-15 08:00:00

These columns were defined in the initial schema but missing from the
incrementally-built dev database.  The approve endpoint writes to them
so they are required for the mystery shopper review workflow.
"""

from alembic import op
import sqlalchemy as sa


revision = "20260615_000027"
down_revision = "20260612_000026"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE visits
        ADD COLUMN IF NOT EXISTS approval_timestamp TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS approval_notes VARCHAR(2000)
        """
    )


def downgrade() -> None:
    op.execute("ALTER TABLE visits DROP COLUMN IF EXISTS approval_timestamp")
    op.execute("ALTER TABLE visits DROP COLUMN IF EXISTS approval_notes")
