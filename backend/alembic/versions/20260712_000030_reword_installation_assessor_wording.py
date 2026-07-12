"""reword installation assessment questions from "Audit"/"Auditor" to "Assessor"

Revision ID: 20260712_000030
Revises: 20260710_000029
Create Date: 2026-07-12 12:00:00

The organisation has an internal Audit department, so the person performing the
Installation Assessment is referred to as the "Assessor". Two seeded question
texts still opened with "Audit"/"Auditor", which read as the department. They
are reworded to "Assessor ..." for consistency and to avoid confusion:

  Q4  "Auditor verifies optimal signal ..."  -> "Assessor verifies ..."
  Q7  "Audit confirms no leftover dust ..."   -> "Assessor confirms ..."
"""

from alembic import op
from sqlalchemy import text

revision = "20260712_000030"
down_revision = "20260710_000029"
branch_labels = None
depends_on = None

# (question_number, original seeded text, new text)
_CHANGES = [
    (
        4,
        "Auditor verifies optimal signal (e.g., tests optical power, sound, or "
        "runs a speed test). TV displays clear picture/audio on all provisioned "
        "channels. Hardware is provisioned correctly on the network.",
        "Assessor verifies optimal signal (e.g., tests optical power, sound, or "
        "runs a speed test). TV displays clear picture/audio on all provisioned "
        "channels. Hardware is provisioned correctly on the network.",
    ),
    (
        7,
        "Audit confirms no leftover dust, drywall debris, wire clippings, or "
        "packaging left on the premises. No unauthorized modifications or damage "
        "to the customer's walls, skirting boards, or landscaping.",
        "Assessor confirms no leftover dust, drywall debris, wire clippings, or "
        "packaging left on the premises. No unauthorized modifications or damage "
        "to the customer's walls, skirting boards, or landscaping.",
    ),
]


def _swap(reverse: bool = False) -> None:
    conn = op.get_bind()
    for question_number, old_text, new_text in _CHANGES:
        source, target = (new_text, old_text) if reverse else (old_text, new_text)
        conn.execute(
            text(
                """
                UPDATE installation_questions
                SET question_text = :target
                WHERE question_number = :qn AND question_text = :source
                """
            ),
            {"target": target, "source": source, "qn": question_number},
        )


def upgrade() -> None:
    _swap(reverse=False)


def downgrade() -> None:
    _swap(reverse=True)
