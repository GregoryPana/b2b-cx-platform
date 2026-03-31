"""add survey type codes and installation questions

Revision ID: 20260331_000015
Revises: 20260330_000013
Create Date: 2026-03-30 12:00:00
"""

from datetime import datetime

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


revision = "20260331_000015"
down_revision = "20260330_000013"
branch_labels = None
depends_on = None


INSTALLATION_SURVEY_NAME = "Installation Assessment"
INSTALLATION_SURVEY_DESCRIPTION = "Installation Assessment Survey"
INSTALLATION_SURVEY_CODE = "INSTALLATION_ASSESSMENT"

INSTALLATION_QUESTIONS: list[dict[str, str]] = [
    {
        "question_number": 1,
        "question_key": "install_drop_length",
        "category": "Technical Performance & Network Standards",
        "question_text": "Is the drop cable within installation length standard (max 3 poles / 180 m)?",
    },
    {
        "question_number": 2,
        "question_key": "install_fdp_slack",
        "category": "Technical Performance & Network Standards",
        "question_text": "Is there enough cable slack at the FDP using the right port for the drop cable?",
    },
    {
        "question_number": 3,
        "question_key": "install_trunking_standard",
        "category": "Technical Performance & Network Standards",
        "question_text": "Is the trunking/internal cable installed to spec using approved clips or screws?",
    },
    {
        "question_number": 4,
        "question_key": "install_signal_validation",
        "category": "Technical Performance & Network Standards",
        "question_text": "Does the auditor confirm optimal signal (power test / speed test / correct provisioning)?",
    },
    {
        "question_number": 5,
        "question_key": "install_routing_aesthetic",
        "category": "Physical Routing & Aesthetic Quality",
        "question_text": "Are cables neatly routed and devices installed level, neat, and unobstructed?",
    },
    {
        "question_number": 6,
        "question_key": "install_safety_integrity",
        "category": "Safety & Infrastructure Integrity",
        "question_text": "Are exterior penetrations sealed, grounded, and using outdoor-rated cabling?",
    },
    {
        "question_number": 7,
        "question_key": "install_cleanliness_damage",
        "category": "Site Cleanliness & Property Damage",
        "question_text": "Is the site free of debris or damage caused by the installation team?",
    },
]


def _ensure_installation_survey_type(connection) -> int:
    now = datetime.utcnow()
    row = connection.execute(
        text(
            """
            SELECT id
            FROM survey_types
            WHERE lower(name) = :name
            ORDER BY id
            LIMIT 1
            """
        ),
        {"name": INSTALLATION_SURVEY_NAME.lower()},
    ).scalar()

    if row is None:
        row = connection.execute(
            text(
                """
                INSERT INTO survey_types (name, description, created_at, updated_at, code)
                VALUES (:name, :description, :created_at, :updated_at, :code)
                RETURNING id
                """
            ),
            {
                "name": INSTALLATION_SURVEY_NAME,
                "description": INSTALLATION_SURVEY_DESCRIPTION,
                "created_at": now,
                "updated_at": now,
                "code": INSTALLATION_SURVEY_CODE,
            },
        ).scalar()
    else:
        connection.execute(
            text("UPDATE survey_types SET code = :code WHERE id = :id"),
            {"code": INSTALLATION_SURVEY_CODE, "id": row},
        )

    return int(row)


def _seed_installation_questions(connection, survey_type_id: int) -> None:
    now = datetime.utcnow()
    insert_sql = text(
        """
        INSERT INTO questions (
            survey_type_id,
            question_number,
            question_text,
            category,
            is_mandatory,
            is_nps,
            input_type,
            score_min,
            score_max,
            choices,
            helper_text,
            requires_issue,
            requires_escalation,
            question_key,
            created_at,
            updated_at
        ) VALUES (
            :survey_type_id,
            :question_number,
            :question_text,
            :category,
            TRUE,
            FALSE,
            'score',
            1,
            5,
            NULL,
            NULL,
            FALSE,
            FALSE,
            :question_key,
            :created_at,
            :updated_at
        )
        ON CONFLICT (question_key) DO NOTHING
        """
    )

    for question in INSTALLATION_QUESTIONS:
        payload = {
            "survey_type_id": survey_type_id,
            "question_number": question["question_number"],
            "question_text": question["question_text"],
            "category": question["category"],
            "question_key": question["question_key"],
            "created_at": now,
            "updated_at": now,
        }
        connection.execute(insert_sql, payload)


def upgrade() -> None:
    connection = op.get_bind()
    if not _has_column(connection, "survey_types", "code"):
        op.add_column("survey_types", sa.Column("code", sa.String(length=64), nullable=True))
        op.create_unique_constraint("uq_survey_types_code", "survey_types", ["code"])
    now = datetime.utcnow()
    existing_codes = {
        "B2B": "B2B",
        "Mystery Shopper": "MYSTERY_SHOPPER",
        INSTALLATION_SURVEY_NAME: INSTALLATION_SURVEY_CODE,
    }
    for name, code in existing_codes.items():
        connection.execute(
            text(
                """
                UPDATE survey_types
                SET code = :code,
                    updated_at = :updated_at
                WHERE lower(name) = :name
                """
            ),
            {"code": code, "updated_at": now, "name": name.lower()},
        )

    survey_type_id = _ensure_installation_survey_type(connection)
    _seed_installation_questions(connection, survey_type_id)


def downgrade() -> None:
    connection = op.get_bind()
    question_keys = [question["question_key"] for question in INSTALLATION_QUESTIONS]
    connection.execute(
        sa.text(
            "DELETE FROM questions WHERE question_key = ANY(:keys)"
        ).bindparams(sa.bindparam("keys", question_keys, expanding=True))
    )

    op.drop_constraint("uq_survey_types_code", "survey_types", type_="unique")
    op.drop_column("survey_types", "code")
def _has_column(connection, table_name: str, column_name: str) -> bool:
    result = connection.execute(
        text(
            """
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = :table
              AND column_name = :column
            LIMIT 1
            """
        ),
        {"table": table_name, "column": column_name},
    ).scalar()
    return bool(result)
