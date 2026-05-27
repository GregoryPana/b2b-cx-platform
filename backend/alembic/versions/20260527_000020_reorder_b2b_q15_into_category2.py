"""reorder b2b q15 (current products & services) into category 2 as new q7

Revision ID: 20260527_000020
Revises: 20260424_000019
Create Date: 2026-05-27 10:00:00

Moves ``q15_current_products_services`` from Category 4 into Category 2 so
that it sits as the new question 7 (right before what used to be q7). All
B2B questions in slots 7-14 shift up by one to slots 8-15. Questions 16+
keep their existing slots.
"""

from alembic import op
import sqlalchemy as sa


revision = "20260527_000020"
down_revision = "20260424_000019"
branch_labels = None
depends_on = None


CATEGORY_2 = "Category 2: Service & Operational Performance"
CATEGORY_4 = "Category 4: Competitive & Portfolio Intelligence"
MOVED_KEY = "q15_current_products_services"

# question_key -> new order_index / question_number
NEW_ORDER = [
    ("q01_relationship_strength", 1),
    ("q02_ae_information_updates", 2),
    ("q03_ae_professionalism", 3),
    ("q04_ae_business_understanding", 4),
    ("q05_contacts_visit_satisfaction", 5),
    ("q06_regular_updates", 6),
    ("q15_current_products_services", 7),
    ("q07_top_3_satisfied_services", 8),
    ("q08_top_3_unsatisfied_instances", 9),
    ("q09_issues_resolved_on_time", 10),
    ("q10_call_frequency", 11),
    ("q11_recent_unresolved_issue", 12),
    ("q12_overall_satisfaction", 13),
    ("q13_top_3_important_factors", 14),
    ("q14_statement_accuracy", 15),
]

PREVIOUS_ORDER = [
    ("q01_relationship_strength", 1),
    ("q02_ae_information_updates", 2),
    ("q03_ae_professionalism", 3),
    ("q04_ae_business_understanding", 4),
    ("q05_contacts_visit_satisfaction", 5),
    ("q06_regular_updates", 6),
    ("q07_top_3_satisfied_services", 7),
    ("q08_top_3_unsatisfied_instances", 8),
    ("q09_issues_resolved_on_time", 9),
    ("q10_call_frequency", 10),
    ("q11_recent_unresolved_issue", 11),
    ("q12_overall_satisfaction", 12),
    ("q13_top_3_important_factors", 13),
    ("q14_statement_accuracy", 14),
    ("q15_current_products_services", 15),
]


def _has_table(bind, name: str) -> bool:
    return bool(
        bind.execute(
            sa.text(
                "SELECT 1 FROM information_schema.tables WHERE table_name = :name LIMIT 1"
            ),
            {"name": name},
        ).scalar()
    )


def _has_column(bind, table: str, column: str) -> bool:
    return bool(
        bind.execute(
            sa.text(
                """
                SELECT 1
                FROM information_schema.columns
                WHERE table_name = :table AND column_name = :column
                LIMIT 1
                """
            ),
            {"table": table, "column": column},
        ).scalar()
    )


def _set_position(bind, question_key, new_index, has_order_index, has_question_number):
    assignments = []
    if has_order_index:
        assignments.append("order_index = :value")
    if has_question_number:
        assignments.append("question_number = :value")
    if not assignments:
        return
    bind.execute(
        sa.text(
            "UPDATE questions SET " + ", ".join(assignments)
            + " WHERE question_key = :question_key"
        ),
        {"question_key": question_key, "value": new_index},
    )


def _park_high(bind, keys, has_order_index, has_question_number):
    # Move affected rows to a temporary high range so unique-index swaps don't collide.
    assignments = []
    if has_order_index:
        assignments.append("order_index = order_index + 1000")
    if has_question_number:
        assignments.append("question_number = question_number + 1000")
    if not assignments:
        return
    stmt = sa.text(
        "UPDATE questions SET " + ", ".join(assignments)
        + " WHERE question_key IN :keys"
    ).bindparams(sa.bindparam("keys", expanding=True))
    bind.execute(stmt, {"keys": list(keys)})


def _apply_order(bind, order_pairs, category_for_moved):
    has_order_index = _has_column(bind, "questions", "order_index")
    has_question_number = _has_column(bind, "questions", "question_number")
    if not (has_order_index or has_question_number):
        return

    keys = [key for key, _ in order_pairs]
    _park_high(bind, keys, has_order_index, has_question_number)
    for question_key, new_index in order_pairs:
        _set_position(bind, question_key, new_index, has_order_index, has_question_number)

    bind.execute(
        sa.text(
            "UPDATE questions SET category = :category WHERE question_key = :question_key"
        ),
        {"category": category_for_moved, "question_key": MOVED_KEY},
    )


def upgrade() -> None:
    bind = op.get_bind()
    if not _has_table(bind, "questions"):
        return
    _apply_order(bind, NEW_ORDER, CATEGORY_2)


def downgrade() -> None:
    bind = op.get_bind()
    if not _has_table(bind, "questions"):
        return
    _apply_order(bind, PREVIOUS_ORDER, CATEGORY_4)
