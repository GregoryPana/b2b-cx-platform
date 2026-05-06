"""merge alembic heads

Revision ID: 20260326_000012
Revises: 20260325_000011, 7d8b6a1b3c45
Create Date: 2026-03-26 00:00:12
"""


revision = "20260326_000012"
# The legacy d01/7d8 branch was an abandoned schema experiment that conflicts
# with the active initial-schema lineage on fresh databases. Keep the merge
# revision ID for environments that already progressed past it, but only depend
# on the active branch for new installs.
down_revision = "20260325_000011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
