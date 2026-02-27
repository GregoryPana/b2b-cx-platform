"""add action tracking fields

Revision ID: 20260227_000005
Revises: 20260227_000004
Create Date: 2026-02-27 00:00:05
"""

from alembic import op
import sqlalchemy as sa


revision = "20260227_000005"
down_revision = "20260227_000004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("responses", sa.Column("action_owner", sa.String(length=255), nullable=True))
    op.add_column("responses", sa.Column("action_timeframe", sa.String(length=20), nullable=True))
    op.add_column("responses", sa.Column("action_support_needed", sa.String(length=2000), nullable=True))


def downgrade() -> None:
    op.drop_column("responses", "action_support_needed")
    op.drop_column("responses", "action_timeframe")
    op.drop_column("responses", "action_owner")
