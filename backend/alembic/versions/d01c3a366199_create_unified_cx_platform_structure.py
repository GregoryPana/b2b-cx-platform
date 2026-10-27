"""Retire the abandoned unified CX schema branch safely.

Revision ID: d01c3a366199
Revises: 20260227_000009
Create Date: 2026-03-02 15:48:56.048519

This branch attempted to create a second, incompatible set of ``questions`` and
``responses`` tables. The active migration lineage already owns those names.
Keeping this historical revision as a forward-only no-op lets Alembic merge the
old head without recreating or dropping production data.
"""

revision = "d01c3a366199"
down_revision = "20260227_000009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Intentionally no-op: the active lineage is authoritative."""


def downgrade() -> None:
    """Intentionally non-destructive: this revision owns no schema objects."""
