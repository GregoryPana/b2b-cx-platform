"""merge release migration heads

Revision ID: 20260714_000032
Revises: 20260609_000024, 20260713_000031, 7d8b6a1b3c45
Create Date: 2026-07-14 00:00:32
"""

revision = "20260714_000032"
down_revision = ("20260609_000024", "20260713_000031", "7d8b6a1b3c45")
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
