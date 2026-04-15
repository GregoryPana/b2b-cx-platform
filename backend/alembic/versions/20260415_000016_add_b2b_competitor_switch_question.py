"""add b2b competitor switch question

Revision ID: 20260415_000016
Revises: 20260410_000015
Create Date: 2026-04-15 16:40:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260415_000016"
down_revision = "20260410_000015"
branch_labels = None
depends_on = None


NEW_KEY = "q18_competitor_service_with_cws"
SHIFTED_KEYS = [
    "q18_product_review_needed",
    "q19_new_requirements",
    "q20_expansion_services_required",
    "q21_expansion_types",
    "q22_more_from_us",
    "q23_nps",
    "q24_comments",
]


def _has_table(bind, table_name: str) -> bool:
    inspector = sa.inspect(bind)
    return table_name in inspector.get_table_names()


def _has_column(bind, table_name: str, column_name: str) -> bool:
    inspector = sa.inspect(bind)
    return any(column["name"] == column_name for column in inspector.get_columns(table_name))


def _set_question_position(bind, question_key: str, position: int, has_question_number: bool, has_order_index: bool) -> None:
    if has_question_number and has_order_index:
        bind.execute(
            sa.text(
                """
                UPDATE questions
                SET order_index = :position,
                    question_number = :position
                WHERE question_key = :question_key
                """
            ),
            {"position": position, "question_key": question_key},
        )
        return

    if has_question_number:
        bind.execute(
            sa.text(
                """
                UPDATE questions
                SET question_number = :position
                WHERE question_key = :question_key
                """
            ),
            {"position": position, "question_key": question_key},
        )
        return

    if has_order_index:
        bind.execute(
            sa.text(
                """
                UPDATE questions
                SET order_index = :position
                WHERE question_key = :question_key
                """
            ),
            {"position": position, "question_key": question_key},
        )
        return


def upgrade() -> None:
    bind = op.get_bind()
    if not _has_table(bind, "questions"):
        return

    has_question_number = _has_column(bind, "questions", "question_number")
    has_order_index = _has_column(bind, "questions", "order_index")

    for offset, question_key in enumerate(SHIFTED_KEYS, start=19):
        _set_question_position(bind, question_key, offset, has_question_number, has_order_index)

    existing = bind.execute(
        sa.text("SELECT id FROM questions WHERE question_key = :question_key LIMIT 1"),
        {"question_key": NEW_KEY},
    ).scalar()

    if existing:
        update_fields = [
            "category = :category",
            "question_text = :question_text",
            "input_type = :input_type",
            "choices = CAST(:choices AS json)",
            "helper_text = :helper_text",
            "is_mandatory = true",
        ]
        if has_order_index:
            update_fields.append("order_index = 18")
        if has_question_number:
            update_fields.append("question_number = 18")
        update_sql = f"""
            UPDATE questions
            SET {', '.join(update_fields)}
        """
        update_sql += " WHERE question_key = :question_key"
        bind.execute(
            sa.text(update_sql),
            {
                "question_key": NEW_KEY,
                "category": "Category 4: Competitive & Portfolio Intelligence",
                "question_text": "Would you consider taking this service with CWS?",
                "input_type": "yes_no",
                "choices": '["Y", "N"]',
                "helper_text": "Select Y or N",
            },
        )
        return

    survey_type_id = bind.execute(
        sa.text("SELECT survey_type_id FROM questions WHERE question_key = 'q16_other_provider_products' LIMIT 1")
    ).scalar()

    insert_columns = [
        "survey_type_id",
        "category",
        "question_key",
        "question_text",
        "input_type",
        "choices",
        "helper_text",
        "is_mandatory",
    ]
    insert_values = [
        ":survey_type_id",
        ":category",
        ":question_key",
        ":question_text",
        ":input_type",
        "CAST(:choices AS json)",
        ":helper_text",
        "true",
    ]
    params = {
        "survey_type_id": survey_type_id,
        "category": "Category 4: Competitive & Portfolio Intelligence",
        "question_key": NEW_KEY,
        "question_text": "Would you consider taking this service with CWS?",
        "input_type": "yes_no",
        "choices": '["Y", "N"]',
        "helper_text": "Select Y or N",
    }
    if has_question_number:
        insert_columns.insert(1, "question_number")
        insert_values.insert(1, ":question_number")
        params["question_number"] = 18
    if has_order_index:
        insert_columns.append("order_index")
        insert_values.append(":order_index")
        params["order_index"] = 18

    bind.execute(
        sa.text(
            f"""
            INSERT INTO questions ({', '.join(insert_columns)})
            VALUES ({', '.join(insert_values)})
            """
        ),
        params,
    )


def downgrade() -> None:
    bind = op.get_bind()
    if not _has_table(bind, "questions"):
        return

    has_question_number = _has_column(bind, "questions", "question_number")
    has_order_index = _has_column(bind, "questions", "order_index")

    bind.execute(sa.text("DELETE FROM questions WHERE question_key = :question_key"), {"question_key": NEW_KEY})

    for offset, question_key in enumerate(SHIFTED_KEYS, start=18):
        _set_question_position(bind, question_key, offset, has_question_number, has_order_index)
