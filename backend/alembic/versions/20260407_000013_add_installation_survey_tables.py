"""add installation survey tables

Revision ID: 20260407_000013
Revises: 20260326_000012
Create Date: 2026-04-07 00:00:13
"""

from alembic import op


revision = "20260407_000013"
down_revision = "20260326_000012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS installation_questions (
            id SERIAL PRIMARY KEY,
            question_number INTEGER NOT NULL UNIQUE,
            category VARCHAR(255) NOT NULL,
            question_text TEXT NOT NULL,
            score_min INTEGER NOT NULL DEFAULT 1,
            score_max INTEGER NOT NULL DEFAULT 5,
            active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS installation_surveys (
            id UUID PRIMARY KEY,
            inspector_name VARCHAR(255) NOT NULL,
            customer_name VARCHAR(255) NOT NULL,
            customer_type VARCHAR(10) NOT NULL,
            location VARCHAR(255) NOT NULL,
            date_work_done DATE NOT NULL,
            job_done_by VARCHAR(30) NOT NULL,
            overall_score NUMERIC(10,2) NOT NULL,
            created_by_name VARCHAR(255),
            created_by_email VARCHAR(255),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS installation_survey_responses (
            id SERIAL PRIMARY KEY,
            survey_id UUID NOT NULL REFERENCES installation_surveys(id) ON DELETE CASCADE,
            question_number INTEGER NOT NULL,
            question_text TEXT NOT NULL,
            score INTEGER NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE (survey_id, question_number)
        )
        """
    )

    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_installation_surveys_date_work_done
        ON installation_surveys (date_work_done)
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_installation_surveys_customer_type
        ON installation_surveys (customer_type)
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_installation_surveys_job_done_by
        ON installation_surveys (job_done_by)
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_installation_surveys_customer_name
        ON installation_surveys (customer_name)
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_installation_surveys_inspector_name
        ON installation_surveys (inspector_name)
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_installation_survey_responses_survey_id
        ON installation_survey_responses (survey_id)
        """
    )

    op.execute(
        """
        INSERT INTO installation_questions (question_number, category, question_text, score_min, score_max, active)
        VALUES
            (1, 'Technical Performance & Network Standards', 'Is the drop cable within installation length standard 3 pole max from FDP to house 180meters.', 1, 5, TRUE),
            (2, 'Technical Performance & Network Standards', 'Is there enough cable slack at FDP using the right FDP hole for running of drop cable.', 1, 5, TRUE),
            (3, 'Technical Performance & Network Standards', 'Is the trunking and internal cable as per standard, using the right clips or secure trunking with screw.', 1, 5, TRUE),
            (4, 'Technical Performance & Network Standards', 'Auditor verifies optimal signal (e.g., tests optical power, sound, or runs a speed test). TV displays clear picture/audio on all provisioned channels. Hardware is provisioned correctly on the network.', 1, 5, TRUE),
            (5, 'Physical Routing & Aesthetic Quality', 'Visual inspection confirms cables are neatly routed, clipped evenly, and concealed where possible. CPE (routers/set-top boxes) are placed in stable, unobstructed locations for optimal coverage. Is the device and socket properly install, level, neat and tidy.', 1, 5, TRUE),
            (6, 'Safety & Infrastructure Integrity', 'Visual inspection confirms exterior equipment is properly grounded. Correct outdoor-rated cabling was used for exterior drops. Exterior wall penetrations are properly sealed and weatherproofed.', 1, 5, TRUE),
            (7, 'Site Cleanliness & Property Damage', 'Audit confirms no leftover dust, drywall debris, wire clippings, or packaging left on the premises. No unauthorized modifications or damage to the customer''s walls, skirting boards, or landscaping.', 1, 5, TRUE)
        ON CONFLICT (question_number)
        DO UPDATE SET
            category = EXCLUDED.category,
            question_text = EXCLUDED.question_text,
            score_min = EXCLUDED.score_min,
            score_max = EXCLUDED.score_max,
            active = EXCLUDED.active
        """
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS installation_survey_responses")
    op.execute("DROP TABLE IF EXISTS installation_surveys")
    op.execute("DROP TABLE IF EXISTS installation_questions")
