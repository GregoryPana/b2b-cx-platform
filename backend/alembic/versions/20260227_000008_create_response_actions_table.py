"""create response actions table

Revision ID: 20260227_000008
Revises: 20260227_000007
Create Date: 2026-02-27 00:00:08
"""

from alembic import op
import sqlalchemy as sa


revision = "20260227_000008"
down_revision = "20260227_000007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "response_actions",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("response_id", sa.Integer(), nullable=False),
        sa.Column("action_required", sa.String(length=2000), nullable=False),
        sa.Column("action_owner", sa.String(length=255), nullable=False),
        sa.Column("action_timeframe", sa.String(length=20), nullable=False),
        sa.Column("action_support_needed", sa.String(length=2000), nullable=True),
        sa.ForeignKeyConstraint(["response_id"], ["responses.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_response_actions_response_id",
        "response_actions",
        ["response_id"],
    )

    op.execute(
        """
        INSERT INTO response_actions (response_id, action_required, action_owner, action_timeframe, action_support_needed)
        SELECT
          id,
          action_required,
          COALESCE(action_owner, ''),
          COALESCE(action_timeframe, ''),
          action_support_needed
        FROM responses
        WHERE action_required IS NOT NULL
          AND action_required <> ''
        """
    )


def downgrade() -> None:
    op.drop_index("ix_response_actions_response_id", table_name="response_actions")
    op.drop_table("response_actions")
