"""add installation assessment tables

Revision ID: 20260330_000013
Revises: 20260326_000012
Create Date: 2026-03-30 00:00:13
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260330_000013"
down_revision = "20260326_000012"
branch_labels = None
depends_on = None


def _uuid_column(name: str, primary_key: bool = False, default: bool = False, nullable: bool = True):
    bind = op.get_bind()
    is_postgres = bind.dialect.name == "postgresql"
    if is_postgres:
        column_type = postgresql.UUID(as_uuid=True)
        server_default = sa.text("gen_random_uuid()") if default else None
    else:
        column_type = sa.String(length=36)
        server_default = None
    return sa.Column(name, column_type, primary_key=primary_key, nullable=nullable, server_default=server_default)


def upgrade() -> None:
    op.create_table(
        "installation_assessments",
        _uuid_column("id", primary_key=True, default=True, nullable=False),
        _uuid_column("visit_id", primary_key=False, default=False, nullable=True),
        sa.Column("inspector_name", sa.String(length=255), nullable=False),
        sa.Column("customer_name", sa.String(length=255), nullable=False),
        sa.Column("customer_type", sa.String(length=20), nullable=False),
        sa.Column("location", sa.String(length=255), nullable=False),
        sa.Column("work_date", sa.Date(), nullable=False),
        sa.Column("execution_party", sa.String(length=50), nullable=False),
        sa.Column("team_name", sa.String(length=255), nullable=True),
        sa.Column("contractor_name", sa.String(length=255), nullable=True),
        sa.Column("overall_score", sa.Numeric(precision=5, scale=2), nullable=False),
        sa.Column("threshold_band", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["visit_id"], ["visits.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("visit_id", name="uq_installation_assessments_visit_id"),
    )
    op.create_index(
        "ix_installation_assessments_work_date",
        "installation_assessments",
        ["work_date"],
    )
    op.create_index(
        "ix_installation_assessments_customer_type",
        "installation_assessments",
        ["customer_type"],
    )
    op.create_index(
        "ix_installation_assessments_execution_party",
        "installation_assessments",
        ["execution_party"],
    )

    op.create_table(
        "installation_assessment_responses",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        _uuid_column("assessment_id", nullable=False),
        sa.Column("question_number", sa.Integer(), nullable=False),
        sa.Column("question_key", sa.String(length=64), nullable=False),
        sa.Column("question_text", sa.String(length=2000), nullable=False),
        sa.Column("category", sa.String(length=255), nullable=False),
        sa.Column("score", sa.Integer(), nullable=False),
        sa.Column("notes", sa.String(length=2000), nullable=True),
        sa.ForeignKeyConstraint(["assessment_id"], ["installation_assessments.id"], ondelete="CASCADE"),
    )
    op.create_index(
        "ix_installation_assessment_responses_assessment_id",
        "installation_assessment_responses",
        ["assessment_id"],
    )
    op.create_index(
        "ix_installation_assessment_responses_question_number",
        "installation_assessment_responses",
        ["question_number"],
    )


def downgrade() -> None:
    op.drop_index("ix_installation_assessment_responses_question_number", table_name="installation_assessment_responses")
    op.drop_index("ix_installation_assessment_responses_assessment_id", table_name="installation_assessment_responses")
    op.drop_table("installation_assessment_responses")
    op.drop_index("ix_installation_assessments_execution_party", table_name="installation_assessments")
    op.drop_index("ix_installation_assessments_customer_type", table_name="installation_assessments")
    op.drop_index("ix_installation_assessments_work_date", table_name="installation_assessments")
    op.drop_table("installation_assessments")
