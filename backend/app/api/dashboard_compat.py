import logging

logger = logging.getLogger(__name__)
"""
Dashboard compatibility endpoints for B2B data
Provides /dashboard/* endpoints that the frontend expects
"""

from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from ..core.analytics_scope import AnalyticsSchemaError, AnalyticsScopeError, resolve_module_scope
from ..core.database import get_db

router = APIRouter(prefix="/dashboard", tags=["dashboard-compat"])


def _today() -> date:
    """Clock seam so year-to-date behaviour can be tested without hardcoding the current year."""
    return date.today()


from ..core.db_inspect import has_column, has_table  # noqa: E402  (replaces local helpers)


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
    """Get NPS summary for one module.

    Missing survey_type keeps the legacy B2B behaviour; Mystery Shopper reads the authoritative
    Mystery answers (Mystery visits have no business). Unknown/unsupported survey types return
    an empty summary instead of widening the dataset.
    """
    empty = {"nps": None, "promoters": 0, "detractors": 0, "passives": 0, "total_responses": 0}
    try:
        try:
            scope = resolve_module_scope(db, survey_type)
        except (AnalyticsScopeError, AnalyticsSchemaError):
            return empty
        rtable = scope.response_table
        if not rtable:
            return empty
        where_extra = scope.visit_filter + scope.question_filter
        params: Dict[str, Any] = dict(scope.params)
        if date_from:
            where_extra += " AND v.visit_date >= :date_from"
            params["date_from"] = date_from
        if date_to:
            where_extra += " AND v.visit_date <= :date_to"
            params["date_to"] = date_to
        # B2B keeps its existing active-business rule; Mystery visits carry no business_id.
        business_join = "" if scope.is_mystery else "JOIN businesses b ON v.business_id = b.id"
        business_filter = "" if scope.is_mystery else "AND b.active = true"

        query = f"""
                SELECT
                    COUNT(CASE WHEN r.score >= 9 THEN 1 END) as promoters,
                    COUNT(CASE WHEN r.score <= 6 THEN 1 END) as detractors,
                    COUNT(CASE WHEN r.score IN (7, 8) THEN 1 END) as passives,
                    COUNT(r.score) as total_responses
                FROM {rtable} r
                JOIN visits v ON r.visit_id = v.id
                {business_join}
                JOIN questions q ON r.question_id = q.id
                WHERE v.status = 'Approved'
                  {business_filter}
                  AND q.is_nps = true
                  AND r.score BETWEEN 0 AND 10
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
        logger.exception("Error calculating NPS: %s", e)
        return empty


@router.get("/coverage")
def get_coverage(
    survey_type: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    db: Session = Depends(get_db),
):
    """Get coverage summary from B2B data."""
    try:
        try:
            scope = resolve_module_scope(db, survey_type)
        except (AnalyticsScopeError, AnalyticsSchemaError):
            scope = None
        if scope is None or scope.is_mystery:
            # Coverage is a B2B business metric; unknown/Mystery scopes never widen to all businesses.
            return {
                "total_active_businesses": 0,
                "businesses_visited_ytd": 0,
                "coverage_percent": 0,
                "businesses_not_visited": 0,
                "repeat_visits": 0
            }
        join_extra = scope.visit_filter
        params: Dict[str, Any] = dict(scope.params)
        if not date_from and not date_to:
            # docs/architecture/coverage-engine-rules.md: "in current year" (YTD). Explicit ranges are kept as given.
            today = _today()
            date_from = date(today.year, 1, 1).isoformat()
            date_to = date(today.year, 12, 31).isoformat()
        if date_from:
            join_extra += " AND v.visit_date >= :date_from"
            params["date_from"] = date_from
        if date_to:
            join_extra += " AND v.visit_date <= :date_to"
            params["date_to"] = date_to

        # Get total active businesses and visited businesses
        query = f"""
                SELECT
                    COUNT(DISTINCT CASE WHEN b.active = true THEN b.id END) as total_active,
                    COUNT(DISTINCT CASE WHEN b.active = true THEN v.business_id END) as businesses_visited
                FROM businesses b
                LEFT JOIN visits v ON b.id = v.business_id AND v.status = 'Approved' {join_extra}
        """
        rows = db.execute(text(query), params).all()
        repeat_businesses = int(
            db.execute(
                text(
                    f"""
                    SELECT COUNT(*) FROM (
                        SELECT v.business_id
                        FROM visits v
                        JOIN businesses b ON b.id = v.business_id
                        WHERE v.status = 'Approved' AND b.active = true {join_extra}
                        GROUP BY v.business_id
                        HAVING COUNT(*) > 1
                    ) repeat_businesses
                    """
                ),
                params,
            ).scalar()
            or 0
        )

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
            # Rule: businesses (not extra visits) with more than one Approved visit in the period.
            "repeat_visits": repeat_businesses,
            "period": {"date_from": date_from, "date_to": date_to},
        }
    except Exception as e:
        logger.exception("Error calculating coverage: %s", e)
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
        try:
            scope = resolve_module_scope(db, survey_type)
        except (AnalyticsScopeError, AnalyticsSchemaError):
            return []
        rtable = scope.response_table
        if not rtable:
            return []
        where_extra = scope.visit_filter + scope.question_filter
        params: Dict[str, Any] = dict(scope.params)
        if date_from:
            where_extra += " AND v.visit_date >= :date_from"
            params["date_from"] = date_from
        if date_to:
            where_extra += " AND v.visit_date <= :date_to"
            params["date_to"] = date_to

        # B2B keeps its active-business rule; Mystery visits carry no business_id.
        business_join = "" if scope.is_mystery else "JOIN businesses b ON v.business_id = b.id"
        business_filter = "" if scope.is_mystery else "AND b.active = true"

        # Get average scores by category
        query = f"""
                SELECT
                    q.category,
                    AVG(r.score) as average_score,
                    COUNT(r.score) as response_count
                FROM {rtable} r
                JOIN visits v ON r.visit_id = v.id
                {business_join}
                JOIN questions q ON r.question_id = q.id
                WHERE v.status = 'Approved'
                  {business_filter}
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
        logger.exception("Error getting category breakdown: %s", e)
        return []
