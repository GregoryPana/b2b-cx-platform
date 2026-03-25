"""add visit submission signature

Revision ID: 20260325_000010
Revises: 20260227_000009
Create Date: 2026-03-25 00:00:10
"""

from alembic import op


revision = "20260325_000010"
down_revision = "20260227_000009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE visits ADD COLUMN IF NOT EXISTS submitted_by_name VARCHAR(255)")
    op.execute("ALTER TABLE visits ADD COLUMN IF NOT EXISTS submitted_by_email VARCHAR(255)")
    op.execute("ALTER TABLE visits ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ")


def downgrade() -> None:
    op.execute("ALTER TABLE visits DROP COLUMN IF EXISTS submitted_at")
    op.execute("ALTER TABLE visits DROP COLUMN IF EXISTS submitted_by_email")
    op.execute("ALTER TABLE visits DROP COLUMN IF EXISTS submitted_by_name")
