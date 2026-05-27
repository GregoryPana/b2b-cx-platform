"""add question_key to installation_questions and installation_survey_responses

Revision ID: 20260527_000022
Revises: 20260527_000021
Create Date: 2026-05-27 10:45:00

Adds stable ``question_key`` columns to the installation tables so future
reorders of installation questions don't silently re-map historical
responses. ``question_key`` is back-filled from ``question_number`` using
the pattern ``inst_q{n}`` for existing rows; new rows should set the key
on insert.
"""

from alembic import op
import sqlalchemy as sa


revision = "20260527_000022"
down_revision = "20260527_000021"
branch_labels = None
depends_on = None


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


def upgrade() -> None:
    bind = op.get_bind()
    if not _has_table(bind, "installation_questions"):
        return

    if not _has_column(bind, "installation_questions", "question_key"):
        op.execute("ALTER TABLE installation_questions ADD COLUMN question_key VARCHAR(64)")
        op.execute(
            "UPDATE installation_questions SET question_key = 'inst_q' || question_number "
            "WHERE question_key IS NULL"
        )
        op.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_installation_questions_question_key "
            "ON installation_questions (question_key)"
        )

    if _has_table(bind, "installation_survey_responses") and not _has_column(
        bind, "installation_survey_responses", "question_key"
    ):
        op.execute("ALTER TABLE installation_survey_responses ADD COLUMN question_key VARCHAR(64)")
        op.execute(
            "UPDATE installation_survey_responses SET question_key = 'inst_q' || question_number "
            "WHERE question_key IS NULL"
        )
        op.execute(
            "CREATE INDEX IF NOT EXISTS ix_installation_survey_responses_question_key "
            "ON installation_survey_responses (question_key)"
        )


def downgrade() -> None:
    bind = op.get_bind()
    if _has_table(bind, "installation_survey_responses") and _has_column(
        bind, "installation_survey_responses", "question_key"
    ):
        op.execute("DROP INDEX IF EXISTS ix_installation_survey_responses_question_key")
        op.execute("ALTER TABLE installation_survey_responses DROP COLUMN question_key")

    if _has_table(bind, "installation_questions") and _has_column(
        bind, "installation_questions", "question_key"
    ):
        op.execute("DROP INDEX IF EXISTS uq_installation_questions_question_key")
        op.execute("ALTER TABLE installation_questions DROP COLUMN question_key")
