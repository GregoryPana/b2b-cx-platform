"""add mystery shopper answers table

Revision ID: 20260424_000019
Revises: 20260423_000018
Create Date: 2026-04-24 10:50:00
"""

from alembic import op


revision = "20260424_000019"
down_revision = "20260423_000018"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS mystery_shopper_answers (
            id BIGSERIAL PRIMARY KEY,
            visit_id UUID NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
            question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
            score INTEGER,
            answer_text TEXT,
            verbatim TEXT,
            actions JSONB NOT NULL DEFAULT '[]'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT uq_mystery_shopper_answers_visit_question UNIQUE (visit_id, question_id)
        )
        """
    )

    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_mystery_shopper_answers_visit_id
        ON mystery_shopper_answers (visit_id)
        """
    )

    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_mystery_shopper_answers_question_id
        ON mystery_shopper_answers (question_id)
        """
    )

    # Do not backfill here.
    # Historical Mystery Shopper rows remain readable from legacy shared response tables.
    # New and updated Mystery answers are dual-written at runtime into this table.
    # A dedicated offline backfill can be run later without holding Alembic open.


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_mystery_shopper_answers_question_id")
    op.execute("DROP INDEX IF EXISTS ix_mystery_shopper_answers_visit_id")
    op.execute("DROP TABLE IF EXISTS mystery_shopper_answers")
