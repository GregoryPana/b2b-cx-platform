"""ensure meeting_attendees table exists

Revision ID: 20260528_000023
Revises: 20260527_000022, 20260528_000021
Create Date: 2026-05-28 00:00:23
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260528_000023"
down_revision = ("20260527_000022", "20260528_000021")
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


def upgrade() -> None:
    bind = op.get_bind()
    if _has_table(bind, "meeting_attendees"):
        return

    op.create_table(
        "meeting_attendees",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("visit_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("visits.id"), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("role", sa.String(length=200), nullable=False),
    )


def downgrade() -> None:
    bind = op.get_bind()
    if _has_table(bind, "meeting_attendees"):
        op.drop_table("meeting_attendees")
