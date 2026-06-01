"""add Monthly to b2b call frequency question choices

Revision ID: 20260528_000021
Revises: 20260527_000020
Create Date: 2026-05-28 00:00:21
"""

from alembic import op


revision = "20260528_000021"
down_revision = "20260527_000020"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE questions
        SET choices = '["Always","Sometimes","Monthly","Never"]',
            helper_text = 'Choose: Always, Sometimes, Monthly, or Never'
        WHERE question_key = 'q10_call_frequency'
        """
    )


def downgrade() -> None:
    op.execute(
        """
        UPDATE questions
        SET choices = '["Always","Sometimes","Never"]',
            helper_text = 'Choose: Always, Sometimes, or Never'
        WHERE question_key = 'q10_call_frequency'
        """
    )
