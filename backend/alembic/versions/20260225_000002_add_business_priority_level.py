"""add business priority level

Revision ID: 20260225_000002
Revises: 20260219_000001
Create Date: 2026-02-25 00:00:02
"""

from alembic import op
import sqlalchemy as sa


revision = "20260225_000002"
down_revision = "20260219_000001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "businesses",
        sa.Column("priority_level", sa.String(length=20), nullable=False, server_default="medium"),
    )
    op.execute(
        "UPDATE businesses SET priority_level = CASE WHEN priority_flag THEN 'high' ELSE 'low' END"
    )


def downgrade() -> None:
    op.drop_column("businesses", "priority_level")
