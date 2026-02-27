import sys

from sqlalchemy import update

from app.core.db import get_session_local
from app.models import Visit, VisitStatus


def normalize_draft_visit_types() -> None:
    session = get_session_local()()
    try:
        stmt = (
            update(Visit)
            .where(Visit.status == VisitStatus.DRAFT)
            .values(visit_type="Planned")
        )
        result = session.execute(stmt)
        session.commit()
        print(f"Updated {result.rowcount} draft visits to visit_type=Planned")
    finally:
        session.close()


if __name__ == "__main__":
    try:
        normalize_draft_visit_types()
    except Exception as exc:
        print(f"Normalize failed: {exc}")
        sys.exit(1)
