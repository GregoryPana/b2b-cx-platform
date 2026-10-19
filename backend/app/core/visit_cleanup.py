"""Scoped cleanup for the pre-shared-store response tables.

Their foreign keys do not consistently cascade. Every child delete must be
bound back to the caller's visit predicate, including its module constraint.
"""
from sqlalchemy import text

from .db_inspect import has_table


def delete_legacy_visit_responses(db, visit_predicate: str, params: dict) -> int:
    if not has_table(db, "responses"):
        return 0
    selected = f"SELECT v.id FROM visits v WHERE {visit_predicate}"
    if has_table(db, "response_actions"):
        db.execute(text(f"""DELETE FROM response_actions WHERE response_id IN (
            SELECT r.id FROM responses r WHERE r.visit_id IN ({selected})
        )"""), params)
    result = db.execute(text(f"DELETE FROM responses WHERE visit_id IN ({selected})"), params)
    return int(result.rowcount or 0)
