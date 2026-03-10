"""
Updated normalize_draft_visit_types.py - Works with new CX Platform structure
Normalizes draft visit types to 'Planned' for B2B visits.
"""

import sys
from sqlalchemy import update

from app.core.database import get_db
from app.programs.b2b.models import B2BVisit


def normalize_draft_visit_types() -> None:
    """Update all draft B2B visits to have visit_type='Planned'."""
    db = next(get_db())
    
    try:
        stmt = (
            update(B2BVisit)
            .where(B2BVisit.status == "draft")
            .values(visit_type="Planned")
        )
        result = db.execute(stmt)
        db.commit()
        print(f"✅ Updated {result.rowcount} draft B2B visits to visit_type='Planned'")
        
        # Show current visit status
        total_visits = db.query(B2BVisit).count()
        draft_visits = db.query(B2BVisit).filter(B2BVisit.status == "draft").count()
        planned_visits = db.query(B2BVisit).filter(B2BVisit.visit_type == "Planned").count()
        
        print(f"📊 Visit Summary:")
        print(f"   Total visits: {total_visits}")
        print(f"   Draft visits: {draft_visits}")
        print(f"   Planned visits: {planned_visits}")
        
    except Exception as e:
        db.rollback()
        print(f"❌ Error normalizing visit types: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    print("🔧 Normalizing B2B draft visit types...")
    normalize_draft_visit_types()
