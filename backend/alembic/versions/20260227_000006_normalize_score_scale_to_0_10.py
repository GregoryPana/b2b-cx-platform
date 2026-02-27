"""normalize score scale to 0-10

Revision ID: 20260227_000006
Revises: 20260227_000005
Create Date: 2026-02-27 00:00:06
"""

from alembic import op


revision = "20260227_000006"
down_revision = "20260227_000005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE questions
        SET score_min = 0, score_max = 10
        WHERE input_type = 'score'
        """
    )


def downgrade() -> None:
    op.execute(
        """
        UPDATE questions
        SET
          score_min = CASE WHEN is_nps THEN 0 ELSE 1 END,
          score_max = CASE WHEN is_nps THEN 10 ELSE 5 END
        WHERE input_type = 'score'
        """
    )
