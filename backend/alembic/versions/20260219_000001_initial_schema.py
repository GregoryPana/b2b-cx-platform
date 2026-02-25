"""initial schema

Revision ID: 20260219_000001
Revises: 
Create Date: 2026-02-19 00:00:01
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260219_000001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "account_executives",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
    )

    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False, unique=True),
        sa.Column("role", sa.String(length=50), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "businesses",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("location", sa.String(length=255), nullable=True),
        sa.Column("account_executive_id", sa.Integer(), sa.ForeignKey("account_executives.id")),
        sa.Column("priority_flag", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    visit_status = sa.Enum(
        "Draft",
        "Pending",
        "Needs Changes",
        "Approved",
        "Rejected",
        name="visit_status",
    )

    op.create_table(
        "visits",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("business_id", sa.Integer(), sa.ForeignKey("businesses.id"), nullable=False),
        sa.Column("representative_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("visit_date", sa.Date(), nullable=False),
        sa.Column("visit_type", sa.String(length=50), nullable=False),
        sa.Column("status", visit_status, nullable=False),
        sa.Column("reviewer_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("review_timestamp", sa.DateTime(timezone=True), nullable=True),
        sa.Column("change_notes", sa.String(length=2000), nullable=True),
        sa.Column("approval_timestamp", sa.DateTime(timezone=True), nullable=True),
        sa.Column("approval_notes", sa.String(length=2000), nullable=True),
        sa.Column("rejection_notes", sa.String(length=2000), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "meeting_attendees",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("visit_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("visits.id"), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("role", sa.String(length=200), nullable=False),
    )

    op.create_table(
        "questions",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("category", sa.String(length=200), nullable=False),
        sa.Column("question_text", sa.String(length=2000), nullable=False),
        sa.Column("is_nps", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("is_mandatory", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("order_index", sa.Integer(), nullable=False, server_default="0"),
    )

    op.create_table(
        "responses",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("visit_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("visits.id"), nullable=False),
        sa.Column("question_id", sa.Integer(), sa.ForeignKey("questions.id"), nullable=False),
        sa.Column("score", sa.Integer(), nullable=False),
        sa.Column("verbatim", sa.String(length=4000), nullable=False),
        sa.Column("action_required", sa.String(length=2000), nullable=True),
        sa.Column("action_target", sa.String(length=2000), nullable=True),
        sa.Column("priority_level", sa.String(length=100), nullable=True),
        sa.Column("due_date", sa.Date(), nullable=True),
    )

    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("entity_type", sa.String(length=200), nullable=False),
        sa.Column("entity_id", sa.String(length=200), nullable=False),
        sa.Column("action", sa.String(length=200), nullable=False),
        sa.Column("modified_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("timestamp", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("audit_logs")
    op.drop_table("responses")
    op.drop_table("questions")
    op.drop_table("meeting_attendees")
    op.drop_table("visits")
    op.drop_table("businesses")
    op.drop_table("users")
    op.drop_table("account_executives")
    op.execute("DROP TYPE IF EXISTS visit_status")
