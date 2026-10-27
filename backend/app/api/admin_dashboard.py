"""Global administrator operations, with explicit optional module filters.

Unfiltered reads retain existing DASHBOARD_ROLES global visibility; they are
operational tools, never module KPIs. Unfiltered destructive operations require
CX_SUPER_ADMIN. Scoped operations require the selected module's administrator.
The module filter cannot be widened by program_code or a foreign selected ID.
"""
from datetime import date
import csv
import json
from io import StringIO
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..core.auth.dependencies import get_current_user, require_roles, DASHBOARD_ROLES
from ..core.analytics_scope import resolve_module_scope, AnalyticsScopeError
from ..core.visit_cleanup import delete_legacy_visit_responses

router = APIRouter(prefix="/admin-dashboard", tags=["admin-dashboard"])


def _scope(db, user, survey_type, *, write=False):
    if survey_type is None:
        roles = ("CX_SUPER_ADMIN",) if write else DASHBOARD_ROLES
        scope = None
    else:
        if not survey_type.strip():
            raise HTTPException(400, "survey_type must identify a module; omit it for global operations")
        try:
            scope = resolve_module_scope(db, survey_type)
        except AnalyticsScopeError as exc:
            raise HTTPException(400, str(exc))
        roles = ("CX_SUPER_ADMIN", "MYSTERY_ADMIN" if scope.is_mystery else "B2B_ADMIN")
    if not user.has_any_role(roles):
        raise HTTPException(403, "Insufficient administrator permissions for requested scope")
    return scope


def _label(scope):
    return {"module": scope.module if scope else "all", "global": scope is None}


def _id(value):
    try:
        return str(UUID(value))
    except ValueError:
        raise HTTPException(404, "Record not found")


def _where(scope, conditions=(), params=None, *, questions=False):
    clause = " AND ".join(["true", *conditions])
    if scope:
        clause += scope.visit_filter
        if questions:
            clause += scope.question_filter
    elif questions:
        # Global shared-store reads may include all modules, but never an answer
        # whose question belongs to another module than its visit.
        clause += " AND (q.survey_type_id = v.survey_type_id OR (q.survey_type_id IS NULL AND v.survey_type_id IN (SELECT id FROM survey_types WHERE lower(name)='b2b')))"
    return clause, {**(scope.params if scope else {}), **(params or {})}


@router.get("/")
async def get_admin_overview(_access: bool = Depends(require_roles(*DASHBOARD_ROLES))):
    return {"title": "Admin Dashboard", "scope": _label(None),
            "description": "Global operational management; not module-specific KPIs"}


_VISITS = """FROM visits v LEFT JOIN businesses b ON b.id=v.business_id
             LEFT JOIN users u ON u.id=v.representative_id"""


@router.get("/visits")
async def get_all_visits(page: int = Query(1, ge=1), limit: int = Query(50, ge=1, le=1000),
                         business_id: int | None = None, business_name: str | None = None,
                         representative_id: int | None = None, status: str | None = None,
                         search: str | None = None,
                         date_from: date | None = None, date_to: date | None = None,
                         survey_type: str | None = None, db: Session = Depends(get_db),
                         current_user=Depends(get_current_user)):
    scope = _scope(db, current_user, survey_type)
    conditions, params = [], {}
    for key, value, expr in (("business_id", business_id, "v.business_id = :business_id"),
                             ("representative_id", representative_id, "v.representative_id = :representative_id"),
                             ("status", status, "v.status::text = :status"),
                             ("date_from", date_from, "v.visit_date >= :date_from"),
                             ("date_to", date_to, "v.visit_date <= :date_to")):
        if value is not None:
            conditions.append(expr)
            params[key] = value
    if business_name is not None:
        conditions.append("b.name ILIKE :business_name")
        params["business_name"] = f"%{business_name}%"
    if search is not None:
        conditions.append("(b.name ILIKE :search OR u.name ILIKE :search)")
        params["search"] = f"%{search}%"
    where, params = _where(scope, conditions, params)
    total = db.execute(text(f"SELECT COUNT(*) {_VISITS} WHERE {where}"), params).scalar_one()
    rows = db.execute(text(f"""SELECT v.id, v.business_id, b.name AS business_name,
        v.representative_id, u.name AS representative_name, v.visit_date, v.visit_type,
        v.status, b.priority_level AS business_priority, v.survey_type_id
        {_VISITS} WHERE {where} ORDER BY v.visit_date DESC, v.id
        LIMIT :limit OFFSET :offset"""), {**params, "limit": limit, "offset": (page-1)*limit}).mappings().all()
    return {"scope": _label(scope), "visits": [dict(row) for row in rows],
            "pagination": {"page": page, "limit": limit, "total": total, "has_more": page*limit < total}}


@router.get("/search/visits")
async def search_visits(query: str = Query(...), page: int = Query(1, ge=1),
                        limit: int = Query(20, ge=1, le=1000), survey_type: str | None = None,
                        db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    # Search and pagination share the same filtered population.
    return await get_all_visits(page=page, limit=limit, search=query.strip(), db=db,
                               current_user=current_user, survey_type=survey_type)


def _responses(db, scope, conditions=(), params=None):
    # Mystery scoped views use authoritative answers, never their shared mirror.
    table = scope.response_table if scope else "b2b_visit_responses"
    if table is None:
        return []
    where, params = _where(scope, conditions, params, questions=True)
    rows = db.execute(text(f"""SELECT CAST(r.id AS text) AS response_id, r.visit_id, r.question_id,
        r.score, r.answer_text, r.verbatim, r.actions, r.created_at, r.updated_at,
        q.question_text, q.category, v.visit_date, b.name AS business_name,
        u.name AS representative_name
        FROM {table} r JOIN visits v ON v.id=r.visit_id
        JOIN questions q ON q.id=r.question_id
        LEFT JOIN businesses b ON b.id=v.business_id LEFT JOIN users u ON u.id=v.representative_id
        WHERE {where} ORDER BY v.visit_date DESC, r.id"""), params).mappings().all()
    return [dict(row) for row in rows]


@router.get("/visits/{visit_id}")
async def get_visit_with_responses(visit_id: str, survey_type: str | None = None,
                                   db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    scope = _scope(db, current_user, survey_type)
    where, params = _where(scope, ["v.id=:visit_id"], {"visit_id": _id(visit_id)})
    row = db.execute(text(f"SELECT v.* {_VISITS} WHERE {where}"), params).mappings().first()
    if row is None:
        raise HTTPException(404, "Visit not found")
    return {**dict(row), "scope": _label(scope),
            "responses": _responses(db, scope, ["v.id=:visit_id"], {"visit_id": _id(visit_id)})}


@router.get("/responses")
async def get_all_responses(page: int = Query(1, ge=1), limit: int = Query(100, ge=1, le=1000),
                            question_id: int | None = None, category: str | None = None,
                            score_min: int | None = None, score_max: int | None = None,
                            answer_text: str | None = None, survey_type: str | None = None,
                            db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    scope = _scope(db, current_user, survey_type)
    conditions, params = [], {}
    for key, value, expr in (("question_id", question_id, "r.question_id=:question_id"),
                             ("category", category, "q.category=:category"),
                             ("score_min", score_min, "r.score>=:score_min"),
                             ("score_max", score_max, "r.score<=:score_max"),
                             ("answer_text", answer_text, "r.answer_text ILIKE :answer_text")):
        if value is not None:
            conditions.append(expr)
            params[key] = f"%{value}%" if key == "answer_text" else value
    rows = _responses(db, scope, conditions, params)
    return {"scope": _label(scope), "responses": rows[(page-1)*limit:page*limit],
            "pagination": {"page": page, "limit": limit, "total": len(rows), "has_more": page*limit < len(rows)}}


@router.get("/export/responses")
async def export_responses(format: str = "json", business_id: int | None = None,
                           date_from: date | None = None, date_to: date | None = None,
                           survey_type: str | None = None, db: Session = Depends(get_db),
                           current_user=Depends(get_current_user)):
    scope = _scope(db, current_user, survey_type)
    if format.lower() not in {"json", "csv"}:
        raise HTTPException(400, "format must be json or csv")
    conditions, params = [], {}
    for key, value, expr in (("business_id", business_id, "v.business_id=:business_id"),
                             ("date_from", date_from, "v.visit_date>=:date_from"),
                             ("date_to", date_to, "v.visit_date<=:date_to")):
        if value is not None:
            conditions.append(expr)
            params[key] = value
    rows = _responses(db, scope, conditions, params)
    result = {"scope": _label(scope), "format": format.lower(), "total_count": len(rows)}
    if format.lower() == "json":
        return {**result, "responses": rows}
    output = StringIO()
    fields = ["visit_id", "visit_date", "business_name", "representative_name", "response_id",
              "question_id", "score", "answer_text", "verbatim", "actions", "category", "created_at", "updated_at"]
    writer = csv.DictWriter(output, fieldnames=fields, extrasaction="ignore")
    writer.writeheader()
    for row in rows:
        writer.writerow({**row, "actions": json.dumps(row["actions"])})
    return {**result, "data": output.getvalue()}


@router.delete("/visits/purge")
async def purge_visits_before_date(before_date: str = Query(...), dry_run: bool = True,
                                   survey_type: str | None = None, db: Session = Depends(get_db),
                                   current_user=Depends(get_current_user)):
    scope = _scope(db, current_user, survey_type, write=True)
    try:
        cutoff = date.fromisoformat(before_date)
    except ValueError:
        raise HTTPException(400, "before_date must be in YYYY-MM-DD format")
    where, params = _where(scope, ["v.visit_date < :cutoff"], {"cutoff": cutoff})
    ids = db.execute(text(f"SELECT v.id FROM visits v WHERE {where} FOR UPDATE"), params).scalars().all()
    count = db.execute(text(f"SELECT COUNT(*) FROM b2b_visit_responses r JOIN visits v ON v.id=r.visit_id WHERE {where}"), params).scalar_one()
    if not dry_run:
        try:
            for visit_id in ids:
                _delete_visit(db, str(visit_id), scope)
            db.commit()
        except Exception:
            db.rollback()
            raise
    return {"scope": _label(scope), "dry_run": dry_run, "before_date": before_date,
            "survey_type": survey_type, "visits_to_delete" if dry_run else "visits_deleted": len(ids),
            "responses_to_delete" if dry_run else "responses_deleted": count}


def _delete_visit(db, visit_id, scope):
    where, params = _where(scope, ["v.id=:visit_id"], {"visit_id": _id(visit_id)})
    row = db.execute(text(f"SELECT v.id, v.visit_date, v.status FROM visits v WHERE {where} FOR UPDATE"), params).mappings().first()
    if row is None:
        raise HTTPException(404, "Visit not found")
    delete_legacy_visit_responses(db, where, params)
    # Assessment metadata deliberately has no visit FK in the legacy schema.
    # Bind cleanup to the already locked/scoped target, never a global child DELETE.
    db.execute(text("DELETE FROM mystery_shopper_assessments WHERE visit_id=:visit_id"),
               {"visit_id": row["id"]})
    db.execute(text(f"DELETE FROM visits v WHERE {where}"), params)
    return dict(row)


@router.delete("/visits/{visit_id}")
async def admin_delete_visit(visit_id: str, survey_type: str | None = None,
                             db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    scope = _scope(db, current_user, survey_type, write=True)
    try:
        row = _delete_visit(db, visit_id, scope)
        db.commit()
    except Exception:
        db.rollback()
        raise
    return {"scope": _label(scope), "visit_id": str(row["id"]), "previous_status": row["status"],
            "visit_date": row["visit_date"], "deleted": {"visits": 1}}


@router.delete("/responses/{response_id}")
async def delete_response(response_id: str, survey_type: str | None = None,
                           db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    scope = _scope(db, current_user, survey_type, write=True)
    table = scope.response_table if scope else "b2b_visit_responses"
    if table is None:
        raise HTTPException(404, "Response not found")
    where, params = _where(scope, ["CAST(r.id AS text)=:response_id"], {"response_id": response_id}, questions=True)
    row = db.execute(text(f"DELETE FROM {table} r USING visits v, questions q WHERE v.id=r.visit_id AND q.id=r.question_id AND {where} RETURNING r.visit_id, r.question_id"), params).first()
    if row is None:
        raise HTTPException(404, "Response not found")
    if scope and scope.is_mystery:
        db.execute(text("DELETE FROM b2b_visit_responses WHERE visit_id=:visit_id AND question_id=:question_id"),
                   {"visit_id": row[0], "question_id": row[1]})
    if scope is None:
        db.execute(text("""DELETE FROM mystery_shopper_answers r USING visits v, survey_types st
            WHERE r.visit_id=:visit_id AND r.question_id=:question_id AND v.id=r.visit_id
            AND st.id=v.survey_type_id AND lower(st.name)='mystery shopper'"""),
                   {"visit_id": row[0], "question_id": row[1]})
    db.commit()
    return {"scope": _label(scope), "message": f"Response {response_id} deleted successfully"}


@router.get("/analytics")
async def get_analytics(db: Session = Depends(get_db),
                        _access: bool = Depends(require_roles(*DASHBOARD_ROLES))):
    """Get comprehensive analytics for admin dashboard."""
    try:
        # Get visit statistics
        visit_stats = db.execute(text("""
            SELECT
                COUNT(*) as total_visits,
                COUNT(CASE WHEN status::text = 'Draft' THEN 1 END) as draft_visits,
                COUNT(CASE WHEN status::text = 'Pending' THEN 1 END) as pending_visits,
                COUNT(CASE WHEN status::text = 'Needs Changes' THEN 1 END) as needs_changes_visits,
                COUNT(CASE WHEN status::text = 'Approved' THEN 1 END) as approved_visits,
                COUNT(CASE WHEN status::text = 'Rejected' THEN 1 END) as rejected_visits,
                COUNT(CASE WHEN status::text = 'Completed' THEN 1 END) as completed_visits,
                COUNT(CASE WHEN status::text = 'Submitted' THEN 1 END) as submitted_visits
            FROM visits
        """)).fetchone()

        # Get response statistics
        response_stats = db.execute(text("""
            SELECT
                COUNT(*) as total_responses,
                COUNT(score) as scored_responses,
                AVG(score) as avg_score,
                COUNT(CASE WHEN answer_text IS NOT NULL AND answer_text != '' THEN 1 END) as text_responses
            FROM b2b_visit_responses
        """)).fetchone()

        # Get business statistics
        business_stats = db.execute(text("""
            SELECT
                COUNT(*) as total_businesses,
                COUNT(CASE WHEN active = true THEN 1 END) as active_businesses
            FROM businesses
        """)).fetchone()

        # Get user statistics
        user_stats = db.execute(text("""
            SELECT
                COUNT(*) as total_users,
                COUNT(CASE WHEN role = 'Representative' THEN 1 END) as representatives,
                COUNT(CASE WHEN role = 'Manager' THEN 1 END) as managers,
                COUNT(CASE WHEN role = 'Admin' THEN 1 END) as admins
            FROM b2b_users
        """)).fetchone()

        return {
            # Intentionally GLOBAL: every module's visits and the mirrored Mystery rows in
            # b2b_visit_responses are counted. These are operational counters, not module KPIs;
            # use /analytics?survey_type=... for module-scoped metrics.
            "scope": {"module": "all", "global": True, "population": "all_rows_all_statuses"},
            "visits": {
                "total": visit_stats.total_visits,
                "draft": visit_stats.draft_visits,
                "pending": visit_stats.pending_visits,
                "needs_changes": visit_stats.needs_changes_visits,
                "approved": visit_stats.approved_visits,
                "rejected": visit_stats.rejected_visits,
                "completed": visit_stats.completed_visits,
                "submitted": visit_stats.submitted_visits
            },
            "responses": {
                "total": response_stats.total_responses,
                "scored": response_stats.scored_responses,
                "avg_score": float(response_stats.avg_score) if response_stats.avg_score is not None else None,
                "text_responses": response_stats.text_responses
            },
            "businesses": {
                "total": business_stats.total_businesses,
                "active": business_stats.active_businesses
            },
            "users": {
                "total": user_stats.total_users,
                "representatives": user_stats.representatives,
                "managers": user_stats.managers,
                "admins": user_stats.admins
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to load analytics")
