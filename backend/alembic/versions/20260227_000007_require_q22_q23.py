"""require q22 and q23

Revision ID: 20260227_000007
Revises: 20260227_000006
Create Date: 2026-02-27 00:00:07
"""

from alembic import op


revision = "20260227_000007"
down_revision = "20260227_000006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE questions
        SET is_mandatory = true
        WHERE question_key IN ('q22_value_for_money', 'q23_competitiveness')
        """
    )


def downgrade() -> None:
    op.execute(
        """
        UPDATE questions
        SET is_mandatory = false
        WHERE question_key IN ('q22_value_for_money', 'q23_competitiveness')
        """
    )
