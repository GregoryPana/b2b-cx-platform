"""dedup b2b_visit_responses and add unique (visit_id, question_id)

Revision ID: 20260710_000029
Revises: 20260616_000028
Create Date: 2026-07-10 09:00:00

Fixes duplicated/repeated questions in the B2B survey review.

The B2B response table was created without a UNIQUE (visit_id, question_id)
constraint (unlike its sibling mystery_shopper_answers), and the write path
was a plain INSERT rather than an upsert. Every re-save inserted a fresh row
per answered question, so a single visit could accumulate 2-3 physical rows
per question, which the review UI faithfully rendered as duplicates.

This migration:
  1. Collapses existing duplicates, keeping the most recently updated row per
     (visit_id, question_id) and deleting the rest.
  2. Adds the UNIQUE constraint so duplicates are structurally impossible.

The matching write-path fix (INSERT ... ON CONFLICT DO UPDATE) ships alongside.
"""

from alembic import op
from sqlalchemy import inspect


revision = "20260710_000029"
down_revision = "20260616_000028"
branch_labels = None
depends_on = None

TABLE = "b2b_visit_responses"
CONSTRAINT = "uq_b2b_visit_responses_visit_question"


def _table_exists(bind) -> bool:
    return TABLE in inspect(bind).get_table_names()


def _constraint_exists(bind) -> bool:
    insp = inspect(bind)
    uniques = insp.get_unique_constraints(TABLE)
    if any(uc.get("name") == CONSTRAINT for uc in uniques):
        return True
    # A unique index (not a named constraint) counts too.
    return any(
        ix.get("unique") and set(ix.get("column_names") or []) == {"visit_id", "question_id"}
        for ix in insp.get_indexes(TABLE)
    )


def upgrade() -> None:
    bind = op.get_bind()
    if not _table_exists(bind):
        # Deployment uses the legacy `responses` table only; nothing to do.
        return

    # 1) Collapse duplicates: keep the freshest row per (visit_id, question_id).
    #    Ordering: newest updated_at, then newest created_at, then largest id as
    #    a final deterministic tiebreaker.
    op.execute(
        f"""
        DELETE FROM {TABLE} r
        USING (
            SELECT id,
                   ROW_NUMBER() OVER (
                       PARTITION BY visit_id, question_id
                       ORDER BY updated_at DESC NULLS LAST,
                                created_at DESC NULLS LAST,
                                id DESC
                   ) AS rn
            FROM {TABLE}
        ) ranked
        WHERE r.id = ranked.id
          AND ranked.rn > 1
        """
    )

    # 2) Add the guard (idempotent).
    if not _constraint_exists(bind):
        op.execute(
            f"""
            ALTER TABLE {TABLE}
            ADD CONSTRAINT {CONSTRAINT} UNIQUE (visit_id, question_id)
            """
        )


def downgrade() -> None:
    bind = op.get_bind()
    if not _table_exists(bind):
        return
    op.execute(f"ALTER TABLE {TABLE} DROP CONSTRAINT IF EXISTS {CONSTRAINT}")
