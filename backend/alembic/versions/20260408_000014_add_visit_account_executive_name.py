"""add visit account executive name

Revision ID: 20260408_000014
Revises: 20260407_000013
Create Date: 2026-04-08 12:30:00
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


revision = "20260408_000014"
down_revision = "20260407_000013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    exists = bind.execute(
        text(
            """
            SELECT 1
            FROM information_schema.columns
            WHERE table_name = 'visits' AND column_name = 'account_executive_name'
            LIMIT 1
            """
        )
    ).scalar()
    if exists:
        return

    bind.execute(text("SET lock_timeout = '5s'"))
    op.execute("ALTER TABLE visits ADD COLUMN IF NOT EXISTS account_executive_name VARCHAR(255)")


def downgrade() -> None:
    bind = op.get_bind()
    exists = bind.execute(
        text(
            """
            SELECT 1
            FROM information_schema.columns
            WHERE table_name = 'visits' AND column_name = 'account_executive_name'
            LIMIT 1
            """
        )
    ).scalar()
    if exists:
        op.drop_column("visits", "account_executive_name")
