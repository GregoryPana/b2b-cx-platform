"""add visit account executive name

Revision ID: 20260408_000014
Revises: 20260407_000013
Create Date: 2026-04-08 12:30:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260408_000014"
down_revision = "20260407_000013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("visits", sa.Column("account_executive_name", sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column("visits", "account_executive_name")
