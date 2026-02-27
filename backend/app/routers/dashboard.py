from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import and_, case, distinct, func, select
from sqlalchemy.orm import Session

from app.core.auth import CurrentUser, require_roles
from app.core.db import get_db
from app.core.roles import ROLE_ADMIN, ROLE_MANAGER
from app.models import Business, Question, Response, Visit, VisitStatus
from app.schemas.dashboard import CategoryBreakdownItem, CoverageSummary, NpsSummary

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/nps", response_model=NpsSummary)
def get_nps(
    db: Session = Depends(get_db),
    _user: CurrentUser = Depends(require_roles([ROLE_MANAGER, ROLE_ADMIN])),
):
    promoter_case = case((Response.score >= 9, 1), else_=0)
    detractor_case = case((Response.score <= 6, 1), else_=0)
    passive_case = case((Response.score.in_([7, 8]), 1), else_=0)

    stmt = (
        select(
            func.coalesce(func.sum(promoter_case), 0),
            func.coalesce(func.sum(detractor_case), 0),
            func.coalesce(func.sum(passive_case), 0),
            func.coalesce(func.count(Response.score), 0),
        )
        .select_from(Response)
        .join(Visit, Response.visit_id == Visit.id)
        .join(Question, Response.question_id == Question.id)
        .where(
            and_(
                Visit.status == VisitStatus.APPROVED,
                Question.is_nps.is_(True),
                Response.score.is_not(None),
            )
        )
    )

    promoters, detractors, passives, total = db.execute(stmt).one()

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
