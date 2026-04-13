"""add installation work order

Revision ID: 20260410_000015
Revises: 20260408_000014
Create Date: 2026-04-10 11:20:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260410_000015"
down_revision = "20260408_000014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("installation_surveys", sa.Column("work_order", sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column("installation_surveys", "work_order")
