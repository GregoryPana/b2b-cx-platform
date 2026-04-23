"""decouple mystery shopper from shared business visit links

Revision ID: 20260423_000018
Revises: 20260421_000017
Create Date: 2026-04-23 11:30:00
"""

from alembic import op


revision = "20260423_000018"
down_revision = "20260421_000017"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE visits
        ALTER COLUMN business_id DROP NOT NULL
        """
    )

    op.execute(
        """
        ALTER TABLE mystery_shopper_locations
        ADD COLUMN IF NOT EXISTS business_id INTEGER
        """
    )

    op.execute(
        """
        ALTER TABLE mystery_shopper_locations
        ALTER COLUMN business_id DROP NOT NULL
        """
    )

    op.execute(
        """
        ALTER TABLE mystery_shopper_locations
        DROP CONSTRAINT IF EXISTS mystery_shopper_locations_business_id_fkey
        """
    )

    op.execute(
        """
        ALTER TABLE mystery_shopper_assessments
        DROP CONSTRAINT IF EXISTS mystery_shopper_assessments_visit_id_fkey
        """
    )

    op.execute(
        """
        UPDATE visits v
        SET business_id = NULL
        WHERE EXISTS (
            SELECT 1
            FROM survey_types st
            WHERE st.id = v.survey_type_id
              AND lower(st.name) = lower('Mystery Shopper')
        )
          AND v.business_id IS NOT NULL
          AND EXISTS (
              SELECT 1
              FROM mystery_shopper_assessments msa
              WHERE msa.visit_id = v.id
          )
        """
    )


def downgrade() -> None:
    # Irreversible in practice once mystery visits are detached from businesses.
    # Keep downgrade non-destructive.
    pass
