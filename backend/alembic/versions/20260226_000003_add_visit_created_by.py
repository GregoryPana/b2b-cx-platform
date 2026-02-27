"""add visit created_by

Revision ID: 20260226_000003
Revises: 20260225_000002
Create Date: 2026-02-26 00:00:03
"""

from alembic import op
import sqlalchemy as sa


revision = "20260226_000003"
down_revision = "20260225_000002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("visits", sa.Column("created_by", sa.Integer(), nullable=True))
    op.execute("UPDATE visits SET created_by = representative_id")
    op.alter_column("visits", "created_by", nullable=False)
    op.create_foreign_key(
        "visits_created_by_fkey", "visits", "users", ["created_by"], ["id"]
    )


def downgrade() -> None:
    op.drop_constraint("visits_created_by_fkey", "visits", type_="foreignkey")
    op.drop_column("visits", "created_by")
