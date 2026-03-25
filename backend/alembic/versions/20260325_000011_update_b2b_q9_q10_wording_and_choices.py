"""update b2b q9 q10 wording and choices

Revision ID: 20260325_000011
Revises: 20260325_000010
Create Date: 2026-03-25 00:00:11
"""

from alembic import op
from sqlalchemy import text


revision = "20260325_000011"
down_revision = "20260325_000010"
branch_labels = None
depends_on = None


def _choices_literal_expr(data_type: str | None, value: str) -> str:
    if data_type in {"json", "jsonb"}:
        return f"CAST('{value}' AS {data_type})"
    return f"'{value}'"


def upgrade() -> None:
    conn = op.get_bind()
    choices_data_type = conn.execute(text(
        """
        SELECT data_type
        FROM information_schema.columns
        WHERE table_name = 'questions' AND column_name = 'choices'
        LIMIT 1
        """
    )).scalar()

    q9_choices_expr = _choices_literal_expr(choices_data_type, '["Y","N"]')
    q10_choices_expr = _choices_literal_expr(choices_data_type, '["3 months","6 months","9 months","Rarely"]')

    conn.execute(text(f"""
        UPDATE questions
        SET
            input_type = 'yes_no',
            helper_text = 'Select Y or N',
            choices = {q9_choices_expr}
        WHERE question_key = 'q09_issues_resolved_on_time'
    """))

    conn.execute(text(f"""
        UPDATE questions
        SET
            question_text = 'How often do you call CWS to fix issues?',
            input_type = 'text',
            helper_text = 'Select one option',
            choices = {q10_choices_expr}
        WHERE question_key = 'q10_call_frequency'
    """))


def downgrade() -> None:
    conn = op.get_bind()
    choices_data_type = conn.execute(text(
        """
        SELECT data_type
        FROM information_schema.columns
        WHERE table_name = 'questions' AND column_name = 'choices'
        LIMIT 1
        """
    )).scalar()

    q9_choices_expr = _choices_literal_expr(choices_data_type, '["Always","Sometimes","Never"]')
    q10_choices_expr = _choices_literal_expr(choices_data_type, '["Always","Sometimes","Never"]')

    conn.execute(text(f"""
        UPDATE questions
        SET
            input_type = 'always_sometimes_never',
            helper_text = 'Choose: Always, Sometimes, or Never',
            choices = {q9_choices_expr}
        WHERE question_key = 'q09_issues_resolved_on_time'
    """))

    conn.execute(text(f"""
        UPDATE questions
        SET
            question_text = 'How often do you need to call C&W to install new products or resolve issues?',
            input_type = 'always_sometimes_never',
            helper_text = 'Choose: Always, Sometimes, or Never',
            choices = {q10_choices_expr}
        WHERE question_key = 'q10_call_frequency'
    """))
