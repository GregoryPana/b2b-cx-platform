"""
Dashboard compatibility endpoints for B2B data
Provides /dashboard/* endpoints that the frontend expects
"""

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from ..core.database import get_db

router = APIRouter(prefix="/dashboard", tags=["dashboard-compat"])


def has_table(db: Session, table_name: str) -> bool:
    return bool(db.execute(text(
        """
        SELECT 1
        FROM information_schema.tables
        WHERE table_name = :table_name
        LIMIT 1
        """
    ), {"table_name": table_name}).scalar())


def has_column(db: Session, table_name: str, column_name: str) -> bool:
    return bool(db.execute(text(
        """
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = :table_name AND column_name = :column_name
        LIMIT 1
        """
    ), {"table_name": table_name, "column_name": column_name}).scalar())


def response_table(db: Session) -> str | None:
    if has_table(db, "b2b_visit_responses"):
        return "b2b_visit_responses"
    if has_table(db, "responses"):
        return "responses"
    return None


def resolve_survey_type_id(db: Session, survey_type: str | None) -> int | None:
    if not survey_type or survey_type.lower() == "all":
        return None

    if not has_table(db, "survey_types"):
        return None

    has_code = has_column(db, "survey_types", "code")
    if has_code:
        return db.execute(
            text(
                """
                SELECT id
                FROM survey_types
                WHERE
                    lower(name) = lower(:survey_type)
                    OR lower(code) = lower(:survey_type)
                    OR replace(lower(name), ' ', '') = replace(lower(:survey_type), ' ', '')
                LIMIT 1
                """
            ),
            {"survey_type": survey_type},
        ).scalar()

    return db.execute(
        text("SELECT id FROM survey_types WHERE lower(name) = lower(:survey_type) LIMIT 1"),
        {"survey_type": survey_type},
    ).scalar()


@router.get("/nps")
def get_nps(
    survey_type: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    db: Session = Depends(get_db),
):
    """Get NPS summary from B2B data."""
    try:
        rtable = response_table(db)
        if not rtable:
            return {"nps": None, "promoters": 0, "detractors": 0, "passives": 0, "total_responses": 0}
        survey_type_id = resolve_survey_type_id(db, survey_type)
        has_visit_survey_type = has_column(db, "visits", "survey_type_id")
        # Calculate NPS from b2b_visit_responses where question is NPS
        where_extra = ""
        params: Dict[str, Any] = {}
        if survey_type_id is not None and has_visit_survey_type:
            where_extra = " AND v.survey_type_id = :survey_type_id"
            params["survey_type_id"] = survey_type_id
        if date_from:
            where_extra += " AND v.visit_date >= :date_from"
            params["date_from"] = date_from
        if date_to:
            where_extra += " AND v.visit_date <= :date_to"
            params["date_to"] = date_to

        query = f"""
                SELECT
                    COUNT(CASE WHEN r.score >= 9 THEN 1 END) as promoters,
                    COUNT(CASE WHEN r.score <= 6 THEN 1 END) as detractors,
                    COUNT(CASE WHEN r.score IN (7, 8) THEN 1 END) as passives,
                    COUNT(r.score) as total_responses
                FROM {rtable} r
                JOIN visits v ON r.visit_id = v.id
                JOIN businesses b ON v.business_id = b.id
                JOIN questions q ON r.question_id = q.id
                WHERE v.status = 'Approved'
                  AND b.active = true
                  AND q.is_nps = true
                  AND r.score IS NOT NULL
                  {where_extra}
        """
        rows = db.execute(text(query), params).all()
        
        if rows and rows[0][3] > 0:  # total_responses > 0
            promoters, detractors, passives, total = rows[0]
            nps = round(((promoters / total) * 100) - ((detractors / total) * 100), 2)
        else:
            nps = None
            promoters = detractors = passives = total = 0
            
        return {
            "nps": nps,
            "promoters": int(promoters),
            "detractors": int(detractors), 
            "passives": int(passives),
            "total_responses": int(total)
        }
    except Exception as e:
        print(f"Error calculating NPS: {e}")
        return {"nps": None, "promoters": 0, "detractors": 0, "passives": 0, "total_responses": 0}


@router.get("/coverage")
def get_coverage(
    survey_type: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    db: Session = Depends(get_db),
):
    """Get coverage summary from B2B data."""
    try:
        survey_type_id = resolve_survey_type_id(db, survey_type)
        has_visit_survey_type = has_column(db, "visits", "survey_type_id")
        join_extra = ""
        params: Dict[str, Any] = {}
        if survey_type_id is not None and has_visit_survey_type:
            join_extra = " AND v.survey_type_id = :survey_type_id"
            params["survey_type_id"] = survey_type_id
        if date_from:
            join_extra += " AND v.visit_date >= :date_from"
            params["date_from"] = date_from
        if date_to:
            join_extra += " AND v.visit_date <= :date_to"
            params["date_to"] = date_to

        # Get total active businesses and visited businesses
        query = f"""
                SELECT
                    COUNT(CASE WHEN b.active = true THEN 1 END) as total_active,
                    COUNT(DISTINCT CASE WHEN b.active = true THEN v.business_id END) as businesses_visited
                FROM businesses b
                LEFT JOIN visits v ON b.id = v.business_id AND v.status = 'Approved' {join_extra}
        """
        rows = db.execute(text(query), params).all()
        
        if rows:
            total_active, businesses_visited = rows[0]
            coverage_percent = round((businesses_visited / total_active * 100), 2) if total_active > 0 else 0
        else:
            total_active = businesses_visited = coverage_percent = 0
            
        return {
            "total_active_businesses": int(total_active),
            "businesses_visited_ytd": int(businesses_visited),
            "coverage_percent": coverage_percent,
            "businesses_not_visited": int(total_active - businesses_visited),
            "repeat_visits": 0  # TODO: calculate repeat visits
        }
    except Exception as e:
        print(f"Error calculating coverage: {e}")
        return {
            "total_active_businesses": 0,
            "businesses_visited_ytd": 0, 
            "coverage_percent": 0,
            "businesses_not_visited": 0,
            "repeat_visits": 0
        }


@router.get("/category-breakdown")
def get_category_breakdown(
    survey_type: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    db: Session = Depends(get_db),
):
    """Get category breakdown from B2B data."""
    try:
        rtable = response_table(db)
        if not rtable:
            return []
        survey_type_id = resolve_survey_type_id(db, survey_type)
        has_visit_survey_type = has_column(db, "visits", "survey_type_id")
        where_extra = ""
        params: Dict[str, Any] = {}
        if survey_type_id is not None and has_visit_survey_type:
            where_extra = " AND v.survey_type_id = :survey_type_id"
            params["survey_type_id"] = survey_type_id
        if date_from:
            where_extra += " AND v.visit_date >= :date_from"
            params["date_from"] = date_from
        if date_to:
            where_extra += " AND v.visit_date <= :date_to"
            params["date_to"] = date_to

        # Get average scores by category
        query = f"""
                SELECT
                    q.category,
                    AVG(r.score) as average_score,
                    COUNT(r.score) as response_count
                FROM {rtable} r
                JOIN visits v ON r.visit_id = v.id
                JOIN businesses b ON v.business_id = b.id
                JOIN questions q ON r.question_id = q.id
                WHERE v.status = 'Approved'
                  AND b.active = true
                  AND q.input_type = 'score'
                  AND r.score IS NOT NULL
                  {where_extra}
                GROUP BY q.category
                ORDER BY q.category
        """
        rows = db.execute(text(query), params).all()
        
        return [
            {
                "category": row[0],
                "average_score": round(float(row[1]), 2),
                "response_count": int(row[2])
            }
            for row in rows
        ]
    except Exception as e:
        print(f"Error getting category breakdown: {e}")
        return []
