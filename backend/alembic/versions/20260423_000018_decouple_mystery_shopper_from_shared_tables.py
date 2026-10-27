"""decouple mystery shopper from shared business visit links

Revision ID: 20260423_000018
Revises: 20260421_000017
Create Date: 2026-04-23 11:30:00
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "20260423_000018"
down_revision = "20260421_000017"
branch_labels = None
depends_on = None


def _require_columns(bind, table_name: str, required: set[str]) -> None:
    inspector = inspect(bind)
    if table_name not in inspector.get_table_names():
        raise RuntimeError(f"Required table {table_name} was not created")
    actual = {column["name"] for column in inspector.get_columns(table_name)}
    missing = required - actual
    if missing:
        raise RuntimeError(
            f"Existing {table_name} is incomplete or incompatible; missing columns: "
            + ", ".join(sorted(missing))
        )


def _require_constraint_contract(bind) -> None:
    inspector = inspect(bind)
    locations_pk = set(inspector.get_pk_constraint("mystery_shopper_locations").get("constrained_columns") or [])
    assessments_pk = set(inspector.get_pk_constraint("mystery_shopper_assessments").get("constrained_columns") or [])
    purposes_pk = set(inspector.get_pk_constraint("mystery_shopper_purpose_options").get("constrained_columns") or [])
    location_uniques = {
        tuple(item.get("column_names") or [])
        for item in inspector.get_unique_constraints("mystery_shopper_locations")
    }
    purpose_uniques = {
        tuple(item.get("column_names") or [])
        for item in inspector.get_unique_constraints("mystery_shopper_purpose_options")
    }
    assessment_uniques = {
        tuple(item.get("column_names") or [])
        for item in inspector.get_unique_constraints("mystery_shopper_assessments")
    }
    assessment_fks = {
        (tuple(item.get("constrained_columns") or []), item.get("referred_table"), tuple(item.get("referred_columns") or []))
        for item in inspector.get_foreign_keys("mystery_shopper_assessments")
    }
    valid = (
        locations_pk == {"id"}
        and assessments_pk == {"id"}
        and purposes_pk == {"id"}
        and ("name",) in location_uniques
        and ("name",) in purpose_uniques
        and ("visit_id",) in assessment_uniques
        and (("location_id",), "mystery_shopper_locations", ("id",)) in assessment_fks
    )
    if not valid:
        raise RuntimeError(
            "Existing Mystery Shopper tables are incomplete or incompatible with required primary-key, unique, or foreign-key constraints"
        )


def upgrade() -> None:
    # These tables were historically created by runtime bootstrap code. Move the
    # contract into Alembic so fresh databases and restores are deterministic.
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS mystery_shopper_locations (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL UNIQUE,
            business_id INTEGER,
            active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS mystery_shopper_assessments (
            id SERIAL PRIMARY KEY,
            visit_id UUID NOT NULL UNIQUE,
            location_id INTEGER NOT NULL REFERENCES mystery_shopper_locations(id),
            visit_time VARCHAR(20) NOT NULL,
            purpose_of_visit VARCHAR(120) NOT NULL,
            staff_on_duty VARCHAR(255) NOT NULL,
            shopper_name VARCHAR(255) NOT NULL,
            report_completed_date DATE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS mystery_shopper_purpose_options (
            id SERIAL PRIMARY KEY,
            name VARCHAR(120) NOT NULL UNIQUE,
            active BOOLEAN NOT NULL DEFAULT TRUE,
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )

    bind = op.get_bind()
    _require_columns(bind, "mystery_shopper_locations", {"id", "name", "business_id", "active", "created_at", "updated_at"})
    _require_columns(bind, "mystery_shopper_assessments", {"id", "visit_id", "location_id", "visit_time", "purpose_of_visit", "staff_on_duty", "shopper_name", "report_completed_date", "created_at", "updated_at"})
    _require_columns(bind, "mystery_shopper_purpose_options", {"id", "name", "active", "sort_order", "created_at", "updated_at"})
    _require_constraint_contract(bind)

    # Compatibility columns used by later data migrations and the runtime.
    op.execute("ALTER TABLE questions ADD COLUMN IF NOT EXISTS survey_type_id INTEGER")
    op.execute("ALTER TABLE questions ADD COLUMN IF NOT EXISTS question_number INTEGER")
    op.execute("ALTER TABLE questions ADD COLUMN IF NOT EXISTS input_type VARCHAR(80)")
    op.execute("ALTER TABLE questions ADD COLUMN IF NOT EXISTS score_min INTEGER")
    op.execute("ALTER TABLE questions ADD COLUMN IF NOT EXISTS score_max INTEGER")
    op.execute("ALTER TABLE questions ADD COLUMN IF NOT EXISTS choices TEXT")
    op.execute("ALTER TABLE questions ADD COLUMN IF NOT EXISTS question_key VARCHAR(128)")
    op.execute("ALTER TABLE questions ADD COLUMN IF NOT EXISTS helper_text TEXT")
    op.execute("ALTER TABLE questions ADD COLUMN IF NOT EXISTS requires_issue BOOLEAN NOT NULL DEFAULT FALSE")
    op.execute("ALTER TABLE questions ADD COLUMN IF NOT EXISTS requires_escalation BOOLEAN NOT NULL DEFAULT FALSE")

    op.execute("ALTER TABLE visits ALTER COLUMN business_id DROP NOT NULL")
    op.execute("ALTER TABLE mystery_shopper_locations ALTER COLUMN business_id DROP NOT NULL")
    op.execute("ALTER TABLE mystery_shopper_locations DROP CONSTRAINT IF EXISTS mystery_shopper_locations_business_id_fkey")
    op.execute("ALTER TABLE mystery_shopper_assessments DROP CONSTRAINT IF EXISTS mystery_shopper_assessments_visit_id_fkey")

    # Only run the historical data correction when the source tables and columns exist.
    table_names = set(inspect(bind).get_table_names())
    visit_columns = {column["name"] for column in inspect(bind).get_columns("visits")}
    survey_type_columns = (
        {column["name"] for column in inspect(bind).get_columns("survey_types")}
        if "survey_types" in table_names
        else set()
    )
    if {"id", "business_id", "survey_type_id"}.issubset(visit_columns) and {"id", "name"}.issubset(survey_type_columns):
        op.execute(
            """
            UPDATE visits v
            SET business_id = NULL
            WHERE EXISTS (
                SELECT 1 FROM survey_types st
                WHERE st.id = v.survey_type_id
                  AND lower(st.name) = lower('Mystery Shopper')
            )
              AND v.business_id IS NOT NULL
              AND EXISTS (
                SELECT 1 FROM mystery_shopper_assessments msa
                WHERE msa.visit_id = v.id
            )
            """
        )


def downgrade() -> None:
    # Forward-only and non-destructive once Mystery visits are detached.
    pass
