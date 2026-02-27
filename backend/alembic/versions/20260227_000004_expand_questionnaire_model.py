"""expand questionnaire model

Revision ID: 20260227_000004
Revises: 20260226_000003
Create Date: 2026-02-27 00:00:04
"""

from alembic import op
import sqlalchemy as sa


revision = "20260227_000004"
down_revision = "20260226_000003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "visits",
        sa.Column("escalation_occurred", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.add_column(
        "visits",
        sa.Column("issue_experienced", sa.Boolean(), nullable=False, server_default="false"),
    )

    op.add_column("questions", sa.Column("question_key", sa.String(length=64), nullable=True))
    op.add_column(
        "questions",
        sa.Column("input_type", sa.String(length=20), nullable=False, server_default="score"),
    )
    op.add_column("questions", sa.Column("score_min", sa.Integer(), nullable=True))
    op.add_column("questions", sa.Column("score_max", sa.Integer(), nullable=True))
    op.add_column(
        "questions",
        sa.Column("requires_issue", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.add_column(
        "questions",
        sa.Column("requires_escalation", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.add_column("questions", sa.Column("helper_text", sa.Text(), nullable=True))

    op.execute(
        """
        UPDATE questions q
        SET
          question_key = CONCAT('q_legacy_', q.id),
          score_min = CASE WHEN q.is_nps THEN 0 ELSE 1 END,
          score_max = CASE WHEN q.is_nps THEN 10 ELSE 5 END
        WHERE question_key IS NULL
        """
    )

    op.alter_column("questions", "question_key", nullable=False)
    op.create_unique_constraint("uq_questions_question_key", "questions", ["question_key"])

    op.add_column("responses", sa.Column("answer_text", sa.String(length=4000), nullable=True))
    op.alter_column("responses", "score", existing_type=sa.Integer(), nullable=True)
    op.alter_column("responses", "verbatim", existing_type=sa.String(length=4000), nullable=True)


def downgrade() -> None:
    op.alter_column("responses", "verbatim", existing_type=sa.String(length=4000), nullable=False)
    op.alter_column("responses", "score", existing_type=sa.Integer(), nullable=False)
    op.drop_column("responses", "answer_text")

    op.drop_constraint("uq_questions_question_key", "questions", type_="unique")
    op.drop_column("questions", "helper_text")
    op.drop_column("questions", "requires_escalation")
    op.drop_column("questions", "requires_issue")
    op.drop_column("questions", "score_max")
    op.drop_column("questions", "score_min")
    op.drop_column("questions", "input_type")
    op.drop_column("questions", "question_key")

    op.drop_column("visits", "issue_experienced")
    op.drop_column("visits", "escalation_occurred")
