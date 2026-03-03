"""expand question input_type length

Revision ID: 20260227_000009
Revises: 20260227_000008
Create Date: 2026-02-27 00:00:09
"""

from alembic import op
import sqlalchemy as sa


revision = "20260227_000009"
down_revision = "20260227_000008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "questions",
        "input_type",
        existing_type=sa.String(length=20),
        type_=sa.String(length=40),
        existing_nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        "questions",
        "input_type",
        existing_type=sa.String(length=40),
        type_=sa.String(length=20),
        existing_nullable=False,
    )
