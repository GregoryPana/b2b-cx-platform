"""enforce b2b question input types

Revision ID: 20260326_000013
Revises: 20260326_000012
Create Date: 2026-03-26 00:00:13
"""

from alembic import op
from sqlalchemy import text


revision = "20260326_000013"
down_revision = "20260326_000012"
branch_labels = None
depends_on = None


def _choices_literal_expr(data_type: str | None, value: str) -> str:
    if data_type in {"json", "jsonb"}:
        return f"CAST('{value}' AS {data_type})"
    return f"'{value}'"


def _ensure_choices_column(conn) -> str:
    choices_data_type = conn.execute(text(
        """
        SELECT data_type
        FROM information_schema.columns
        WHERE table_name = 'questions' AND column_name = 'choices'
        LIMIT 1
        """
    )).scalar()

    if not choices_data_type:
        conn.execute(text("ALTER TABLE questions ADD COLUMN IF NOT EXISTS choices JSONB"))
        return "jsonb"

    return choices_data_type


def upgrade() -> None:
    conn = op.get_bind()
    choices_data_type = _ensure_choices_column(conn)
    has_survey_type_id = bool(conn.execute(text(
        """
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'questions' AND column_name = 'survey_type_id'
        LIMIT 1
        """
    )).scalar())

    yes_no_choices_expr = _choices_literal_expr(choices_data_type, '["Y","N"]')
    q10_choices_expr = _choices_literal_expr(choices_data_type, '["3 months","6 months","9 months","Rarely"]')

    question_scope_filter = ""
    if has_survey_type_id:
        question_scope_filter = "AND survey_type_id = (SELECT id FROM survey_types WHERE name = 'B2B' LIMIT 1)"

    conn.execute(text(f"""
        UPDATE questions
        SET
            input_type = 'yes_no',
            helper_text = 'Select Y or N',
            choices = {yes_no_choices_expr}
        WHERE question_key IN (
            'q04_ae_business_understanding',
            'q06_regular_updates',
            'q09_issues_resolved_on_time',
            'q16_other_provider_products'
        )
        {question_scope_filter}
    """))

    conn.execute(text(f"""
        UPDATE questions
        SET
            question_text = 'How often do you call CWS to fix issues?',
            input_type = 'text',
            helper_text = 'Select one option',
            choices = {q10_choices_expr}
        WHERE question_key = 'q10_call_frequency'
        {question_scope_filter}
    """))


def downgrade() -> None:
    pass
