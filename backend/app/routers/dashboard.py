from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import and_, case, distinct, func, select, text
from sqlalchemy.orm import Session

from app.core.auth import CurrentUser, require_roles
from app.core.db import get_db
from app.core.roles import ROLE_ADMIN, ROLE_MANAGER
from app.models import Business, Question, Response, Visit, VisitStatus
from app.schemas.dashboard import CategoryBreakdownItem, CoverageSummary, NpsSummary

# NOTE: this legacy router is intentionally NOT mounted (it also no longer imports cleanly: the
# `app.core.auth.CurrentUser` / `app.schemas.dashboard` names it uses do not exist). The active
# endpoints are `app/api/dashboard_compat.py`. `backend/tests/analytics/test_unmounted_dashboard_router.py`
# enforces that it stays unmounted and uses NULL-safe conditional counters.
router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/nps", response_model=NpsSummary)
def get_nps(
    db: Session = Depends(get_db),
    _user: CurrentUser = Depends(require_roles([ROLE_MANAGER, ROLE_ADMIN])),
):
    # Use raw SQL for more reliable NPS calculation
    result = db.execute(text("""
        SELECT 
            COUNT(CASE WHEN r.score BETWEEN 9 AND 10 THEN 1 END) as promoters,
            COUNT(CASE WHEN r.score BETWEEN 0 AND 6 THEN 1 END) as detractors,
            COUNT(CASE WHEN r.score BETWEEN 7 AND 8 THEN 1 END) as passives,
            COUNT(r.score) as total
        FROM b2b_visit_responses r
        JOIN questions q ON r.question_id = q.id
        JOIN visits v ON r.visit_id = v.id
        WHERE q.is_nps = true
        AND v.status = 'Approved'
        AND r.score BETWEEN 0 AND 10
        AND v.survey_type_id = (SELECT id FROM survey_types WHERE lower(name) = 'b2b' LIMIT 1)
    """)).fetchone()
    
    promoters, detractors, passives, total = result
    
    print(f"DEBUG NPS: promoters={promoters}, detractors={detractors}, passives={passives}, total={total}")
    
    nps = None
    if total:
        nps = round(((promoters / total) * 100) - ((detractors / total) * 100), 2)
    
    return NpsSummary(
        nps=nps,
        promoters=int(promoters),
        detractors=int(detractors),
        passives=int(passives),
        total_responses=int(total),
    )


@router.get("/coverage", response_model=CoverageSummary)
def get_coverage(
    db: Session = Depends(get_db),
    _user: CurrentUser = Depends(require_roles([ROLE_MANAGER, ROLE_ADMIN])),
):
    year_start = date(date.today().year, 1, 1)

    total_active = db.scalar(select(func.count(Business.id)).where(Business.active.is_(True))) or 0

    visited_ytd_stmt = (
        select(func.count(distinct(Visit.business_id)))
        .where(and_(Visit.status == VisitStatus.APPROVED, Visit.visit_date >= year_start))
    )
    visited_ytd = db.scalar(visited_ytd_stmt) or 0

    repeat_stmt = (
        select(func.count())
        .select_from(
            select(Visit.business_id)
            .where(and_(Visit.status == VisitStatus.APPROVED, Visit.visit_date >= year_start))
            .group_by(Visit.business_id)
            .having(func.count(Visit.id) > 1)
            .subquery()
        )
    )
    repeat_visits = db.scalar(repeat_stmt) or 0

    coverage_percent = 0.0
    if total_active:
        coverage_percent = round((visited_ytd / total_active) * 100, 2)

    return CoverageSummary(
        total_active_businesses=int(total_active),
        businesses_visited_ytd=int(visited_ytd),
        coverage_percent=coverage_percent,
        businesses_not_visited=int(total_active - visited_ytd),
        repeat_visits=int(repeat_visits),
    )


@router.get("/category-breakdown", response_model=list[CategoryBreakdownItem])
def get_category_breakdown(
    db: Session = Depends(get_db),
    _user: CurrentUser = Depends(require_roles([ROLE_MANAGER, ROLE_ADMIN])),
):
    stmt = (
        select(
            Question.category,
            func.avg(Response.score),
            func.count(Response.score),
        )
        .select_from(Response)
        .join(Visit, Response.visit_id == Visit.id)
        .join(Question, Response.question_id == Question.id)
        .where(
            and_(
                Visit.status == VisitStatus.APPROVED,
                Question.is_nps.is_(False),
                Question.input_type == "score",
                Response.score.is_not(None),
            )
        )
        .group_by(Question.category)
        .order_by(Question.category)
    )

    results = db.execute(stmt).all()
    return [
        CategoryBreakdownItem(
            category=row[0],
            average_score=round(float(row[1]), 2),
            response_count=int(row[2]),
        )
        for row in results
    ]
