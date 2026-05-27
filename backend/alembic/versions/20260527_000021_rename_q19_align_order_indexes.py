"""rename q18_product_review_needed -> q19_product_review_needed and align q20/q21 order_indexes

Revision ID: 20260527_000021
Revises: 20260527_000020
Create Date: 2026-05-27 10:30:00

* Renames question_key ``q18_product_review_needed`` to
  ``q19_product_review_needed`` so the leading number agrees with the
  question's display position (it has been at slot 19 since migration
  20260415_000016).
* Makes ``q20_expansion_services_required`` sit at order_index/question_number
  21 and ``q21_expansion_types`` sit at 22 so the integer matches the key
  prefix.
"""

from alembic import op
import sqlalchemy as sa


revision = "20260527_000021"
down_revision = "20260527_000020"
branch_labels = None
depends_on = None


OLD_KEY = "q18_product_review_needed"
NEW_KEY = "q19_product_review_needed"


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


def _rename_key(bind, src, dst):
    existing_dst = bind.execute(
        sa.text("SELECT id FROM questions WHERE question_key = :key LIMIT 1"),
        {"key": dst},
    ).scalar()
    if existing_dst:
        # Target key already present; drop the old row if it still exists.
        bind.execute(
            sa.text("DELETE FROM questions WHERE question_key = :key"),
            {"key": src},
        )
        return
    bind.execute(
        sa.text("UPDATE questions SET question_key = :dst WHERE question_key = :src"),
        {"src": src, "dst": dst},
    )


def upgrade() -> None:
    bind = op.get_bind()
    if not _has_table(bind, "questions"):
        return

    _rename_key(bind, OLD_KEY, NEW_KEY)

    has_order_index = _has_column(bind, "questions", "order_index")
    has_question_number = _has_column(bind, "questions", "question_number")
    if not (has_order_index or has_question_number):
        return

    swap_keys = ["q20_expansion_services_required", "q21_expansion_types"]
    _park_high(bind, swap_keys, has_order_index, has_question_number)
    _set_position(bind, "q20_expansion_services_required", 21, has_order_index, has_question_number)
    _set_position(bind, "q21_expansion_types", 22, has_order_index, has_question_number)


def downgrade() -> None:
    bind = op.get_bind()
    if not _has_table(bind, "questions"):
        return

    has_order_index = _has_column(bind, "questions", "order_index")
    has_question_number = _has_column(bind, "questions", "question_number")
    if has_order_index or has_question_number:
        swap_keys = ["q20_expansion_services_required", "q21_expansion_types"]
        _park_high(bind, swap_keys, has_order_index, has_question_number)
        _set_position(bind, "q20_expansion_services_required", 22, has_order_index, has_question_number)
        _set_position(bind, "q21_expansion_types", 21, has_order_index, has_question_number)

    _rename_key(bind, NEW_KEY, OLD_KEY)
