"""add multi platform question support

Revision ID: 20260326_000014
Revises: 20260326_000013
Create Date: 2026-03-26 00:00:14
"""

from alembic import op
from sqlalchemy import text


revision = "20260326_000014"
down_revision = "20260326_000013"
branch_labels = None
depends_on = None


def _has_column(conn, table_name: str, column_name: str) -> bool:
    return bool(conn.execute(text(
        """
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = :table_name AND column_name = :column_name
        LIMIT 1
        """
    ), {"table_name": table_name, "column_name": column_name}).scalar())


def upgrade() -> None:
    conn = op.get_bind()

    conn.execute(text(
        """
        CREATE TABLE IF NOT EXISTS survey_types (
            id SERIAL PRIMARY KEY,
            code VARCHAR(64) UNIQUE,
            name VARCHAR(128) UNIQUE NOT NULL,
            description TEXT
        )
        """
    ))

    conn.execute(text("ALTER TABLE survey_types ADD COLUMN IF NOT EXISTS code VARCHAR(64)"))
    conn.execute(text("ALTER TABLE survey_types ADD COLUMN IF NOT EXISTS description TEXT"))

    conn.execute(text(
        """
        INSERT INTO survey_types (code, name, description)
        VALUES
          ('B2B', 'B2B', 'Business-to-Business survey'),
          ('INSTALLATION', 'Installation Assessment', 'Installation assessment survey'),
          ('MYSTERY_SHOPPER', 'Mystery Shopper', 'Mystery shopper survey')
        ON CONFLICT (name) DO UPDATE SET
          code = EXCLUDED.code,
          description = EXCLUDED.description
        """
    ))

    conn.execute(text("ALTER TABLE questions ADD COLUMN IF NOT EXISTS survey_type_id INTEGER"))
    conn.execute(text("ALTER TABLE questions ADD COLUMN IF NOT EXISTS question_number INTEGER"))
    conn.execute(text("ALTER TABLE questions ADD COLUMN IF NOT EXISTS choices JSONB"))
    conn.execute(text("ALTER TABLE visits ADD COLUMN IF NOT EXISTS survey_type_id INTEGER"))

    has_order_index = _has_column(conn, "questions", "order_index")
    if has_order_index:
        conn.execute(text(
            """
            UPDATE questions
            SET question_number = COALESCE(question_number, order_index, id)
            WHERE question_number IS NULL
            """
        ))
    else:
        conn.execute(text(
            """
            UPDATE questions
            SET question_number = COALESCE(question_number, id)
            WHERE question_number IS NULL
            """
        ))

    b2b_id = conn.execute(text("SELECT id FROM survey_types WHERE code = 'B2B' LIMIT 1")).scalar()
    if b2b_id is not None:
        conn.execute(text(
            """
            UPDATE questions
            SET survey_type_id = :b2b_id
            WHERE survey_type_id IS NULL
            """
        ), {"b2b_id": b2b_id})

        conn.execute(text(
            """
            UPDATE visits
            SET survey_type_id = :b2b_id
            WHERE survey_type_id IS NULL
            """
        ), {"b2b_id": b2b_id})


def downgrade() -> None:
    pass
