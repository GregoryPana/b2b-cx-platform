"""reorder mystery shopper question groups: Store Environment before Staff Appearance before Customer Service

Revision ID: 20260612_000025
Revises: 20260610_000024
Create Date: 2026-06-12 00:00:00

New group order (by first question_number in each group):
  1. External Environment & First Impression  — 2001-2005 (unchanged)
  2. Store Environment & Comfort              — 2006-2010 (was 2017-2021)
  3. Staff Appearance & Professionalism       — 2011-2014 (was 2006-2009)
  4. Customer Service Interaction             — 2015-2021 (was 2010-2016)
  5. Time & Efficiency                        — 2022-2023 (unchanged)
  6. Overall Experience (CSAT & NPS)          — 2024-2027 (unchanged)
"""

from alembic import op
from sqlalchemy import text

revision = "20260612_000025"
down_revision = "20260610_000024"
branch_labels = None
depends_on = None

# Maps question_key -> (new_question_number, new_order_index)
_NEW_NUMBERS: dict[str, tuple[int, int]] = {
    # Store Environment & Comfort  (was 17-21 → 6-10)
    "ms_store_cleanliness":           (2006,  6),
    "ms_queue_management":            (2007,  7),
    "ms_display_organization_posters":(2008,  8),
    "ms_aircon_ventilation":          (2009,  9),
    "ms_space_comfort":               (2010, 10),
    # Staff Appearance & Professionalism  (was 6-9 → 11-14)
    "ms_uniform_neat_complete":       (2011, 11),
    "ms_personal_grooming":           (2012, 12),
    "ms_name_badge_visibility":       (2013, 13),
    "ms_professional_behaviour":      (2014, 14),
    # Customer Service Interaction  (was 10-16 → 15-21)
    "ms_listened_actively":           (2015, 15),
    "ms_asked_relevant_questions":    (2016, 16),
    "ms_product_service_knowledge":   (2017, 17),
    "ms_information_accuracy":        (2018, 18),
    "ms_handled_clarifying_questions":(2019, 19),
    "ms_solution_provided":           (2020, 20),
    "ms_solution_helpful":            (2021, 21),
}

# Reverse map for downgrade: question_key -> (old_question_number, old_order_index)
_OLD_NUMBERS: dict[str, tuple[int, int]] = {
    "ms_store_cleanliness":           (2017, 17),
    "ms_queue_management":            (2018, 18),
    "ms_display_organization_posters":(2019, 19),
    "ms_aircon_ventilation":          (2020, 20),
    "ms_space_comfort":               (2021, 21),
    "ms_uniform_neat_complete":       (2006,  6),
    "ms_personal_grooming":           (2007,  7),
    "ms_name_badge_visibility":       (2008,  8),
    "ms_professional_behaviour":      (2009,  9),
    "ms_listened_actively":           (2010, 10),
    "ms_asked_relevant_questions":    (2011, 11),
    "ms_product_service_knowledge":   (2012, 12),
    "ms_information_accuracy":        (2013, 13),
    "ms_handled_clarifying_questions":(2014, 14),
    "ms_solution_provided":           (2015, 15),
    "ms_solution_helpful":            (2016, 16),
}


def _apply(mapping: dict[str, tuple[int, int]]) -> None:
    conn = op.get_bind()

    has_oi = conn.execute(
        text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_name='questions' AND column_name='order_index' LIMIT 1"
        )
    ).scalar() is not None

    keys = list(mapping.keys())
    keys_sql = ", ".join(f"'{k}'" for k in keys)

    # Pass 1: move all affected rows to a safe temporary range (question_number + 9000)
    # to avoid any uniqueness conflicts during the transition.
    oi_shift = ", order_index = order_index + 9000" if has_oi else ""
    conn.execute(
        text(
            f"""
            UPDATE questions
            SET question_number = question_number + 9000
                {oi_shift}
            WHERE question_key IN ({keys_sql})
              AND question_number IS NOT NULL
            """
        )
    )

    # Pass 2: set each row to its target value, keyed by question_key (stable identifier).
    for key, (qnum, oidx) in mapping.items():
        oi_set = f", order_index = {oidx}" if has_oi else ""
        conn.execute(
            text(
                f"""
                UPDATE questions
                SET question_number = {qnum}
                    {oi_set}
                WHERE question_key = '{key}'
                """
            )
        )


def upgrade() -> None:
    _apply(_NEW_NUMBERS)


def downgrade() -> None:
    _apply(_OLD_NUMBERS)
