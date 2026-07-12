"""Update B2B Q18 competitor-switch wording.

Revision ID: 20260610_000024
Revises: 20260528_000023
Create Date: 2026-06-10
"""

from alembic import op
import sqlalchemy as sa


revision = "20260610_000024"
down_revision = "20260528_000023"
branch_labels = None
depends_on = None


NEW_TEXT = "Would you consider taking the same  competition services that you have now but with cws?"
OLD_TEXT = "Would you consider taking this service with CWS?"
QUESTION_KEY = "q18_competitor_service_with_cws"


def _has_question_column(bind, column: str) -> bool:
    return bind.execute(
        sa.text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_name = 'questions' AND column_name = :c LIMIT 1"
        ),
        {"c": column},
    ).scalar() is not None


def upgrade() -> None:
    bind = op.get_bind()
    # Some deployments' `questions` table was built from the "unified structure"
    # lineage and has no order_index (they key on question_number instead), and
    # older tables may lack updated_at. Only set columns that actually exist so
    # this data migration is portable across those schema variants.
    set_parts = ["question_text = :new_text", "question_number = 18"]
    if _has_question_column(bind, "order_index"):
        set_parts.append("order_index = 18")
    if _has_question_column(bind, "updated_at"):
        set_parts.append("updated_at = CURRENT_TIMESTAMP")
    bind.execute(
        sa.text(
            f"""
            UPDATE questions
            SET {', '.join(set_parts)}
            WHERE question_key = :question_key
               OR (question_number = 18 AND question_text = :old_text)
            """
        ),
        {"new_text": NEW_TEXT, "question_key": QUESTION_KEY, "old_text": OLD_TEXT},
    )


def downgrade() -> None:
    bind = op.get_bind()
    bind.execute(
        sa.text(
            """
            UPDATE questions
            SET question_text = :old_text,
                updated_at = CURRENT_TIMESTAMP
            WHERE question_key = :question_key
              AND question_text = :new_text
            """
        ),
        {"old_text": OLD_TEXT, "new_text": NEW_TEXT, "question_key": QUESTION_KEY},
    )
