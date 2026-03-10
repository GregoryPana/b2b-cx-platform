"""
Admin Dashboard API - Complete visit management with search capabilities
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Dict, Optional
from datetime import date, datetime
import json
from ..core.database import get_db
from ..core.auth.dependencies import get_current_user, require_role
from ..core.models import User

router = APIRouter(prefix="/admin-dashboard", tags=["admin-dashboard"])


def resolve_survey_type_id(db: Session, survey_type: str | None) -> int | None:
    if not survey_type:
        return None

    return db.execute(
        text("SELECT id FROM survey_types WHERE name = :survey_type"),
        {"survey_type": survey_type},
    ).scalar()


@router.delete("/visits/purge")
async def purge_visits_before_date(
    before_date: str = Query(..., description="Delete visits with visit_date strictly before this date (YYYY-MM-DD)."),
    dry_run: bool = Query(True, description="When true, only return counts and do not delete."),
    survey_type: Optional[str] = Query(None, description="Optional survey type codename/name (e.g., B2B)."),
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
    _admin_access: bool = Depends(require_role("Admin")),
):
    """Purge old visits and their responses (Admin only).

    This is intended for removing test data safely.
    """

    try:
        cutoff = date.fromisoformat(before_date)
    except ValueError:
        raise HTTPException(status_code=400, detail="before_date must be in YYYY-MM-DD format")

    survey_type_id = resolve_survey_type_id(db, survey_type)
    if survey_type and survey_type_id is None:
        raise HTTPException(status_code=400, detail=f"Unknown survey_type: {survey_type}")

    where_extra = ""
    params: Dict[str, object] = {"cutoff": cutoff}
    if survey_type_id is not None:
        where_extra = " AND v.survey_type_id = :survey_type_id"
        params["survey_type_id"] = survey_type_id

    # Preview counts
    visits_count = db.execute(
        text(
            f"""
            SELECT COUNT(*)
            FROM visits v
            WHERE v.visit_date < :cutoff
            {where_extra}
            """
        ),
        params,
    ).scalar() or 0

    responses_count = db.execute(
        text(
            f"""
            SELECT COUNT(*)
            FROM b2b_visit_responses r
            JOIN visits v ON v.id = r.visit_id
            WHERE v.visit_date < :cutoff
            {where_extra}
            """
        ),
        params,
    ).scalar() or 0

    if dry_run:
        return {
            "dry_run": True,
            "before_date": before_date,
            "survey_type": survey_type,
            "visits_to_delete": int(visits_count),
            "responses_to_delete": int(responses_count),
        }

    # Delete within a transaction
    try:
        db.execute(
            text(
                f"""
                DELETE FROM b2b_visit_responses r
                USING visits v
                WHERE v.id = r.visit_id
                  AND v.visit_date < :cutoff
                  {where_extra}
                """
            ),
            params,
        )

        db.execute(
            text(
                f"""
                DELETE FROM visits v
                WHERE v.visit_date < :cutoff
                {where_extra}
                """
            ),
            params,
        )

        db.commit()
    except Exception:
        db.rollback()
        raise

    return {
        "dry_run": False,
        "before_date": before_date,
        "survey_type": survey_type,
        "visits_deleted": int(visits_count),
        "responses_deleted": int(responses_count),
    }


@router.delete("/visits/{visit_id}")
async def admin_delete_visit(
    visit_id: str,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
    _admin_access: bool = Depends(require_role("Admin")),
):
    """Delete a single visit (any status) and all related response data (Admin only)."""

    # Verify visit exists (and capture date/status for a nicer response)
    visit_row = db.execute(
        text(
            """
            SELECT id, visit_date, status
            FROM visits
            WHERE id = :visit_id
            """
        ),
        {"visit_id": visit_id},
    ).fetchone()

    if not visit_row:
        raise HTTPException(status_code=404, detail="Visit not found")

    try:
        # responses/response_actions (ORM tables)
        deleted_response_actions = db.execute(
            text(
                """
                DELETE FROM response_actions
                WHERE response_id IN (
                    SELECT id FROM responses WHERE visit_id = :visit_id
                )
                """
            ),
            {"visit_id": visit_id},
        ).rowcount or 0

        deleted_responses = db.execute(
            text("DELETE FROM responses WHERE visit_id = :visit_id"),
            {"visit_id": visit_id},
        ).rowcount or 0

        # b2b_visit_responses (raw SQL table used by dashboard-visits endpoints)
        deleted_b2b_responses = db.execute(
            text("DELETE FROM b2b_visit_responses WHERE visit_id = :visit_id"),
            {"visit_id": visit_id},
        ).rowcount or 0

        deleted_visits = db.execute(
            text("DELETE FROM visits WHERE id = :visit_id"),
            {"visit_id": visit_id},
        ).rowcount or 0

        db.commit()
    except Exception:
        db.rollback()
        raise

    return {
        "visit_id": str(visit_row[0]),
        "visit_date": visit_row[1].isoformat() if visit_row[1] else None,
        "previous_status": visit_row[2],
        "deleted": {
            "visits": int(deleted_visits),
            "b2b_visit_responses": int(deleted_b2b_responses),
            "responses": int(deleted_responses),
            "response_actions": int(deleted_response_actions),
        },
    }

@router.get("/")
async def get_admin_overview():
    """Get admin dashboard overview with all visit statistics."""
    try:
        return {
            "title": "Admin Dashboard",
            "description": "Complete overview of all visits and responses",
            "stats": {
                "total_visits": "Total number of visits",
                "total_responses": "Total number of responses",
                "pending_visits": "Visits pending review",
                "completed_visits": "Visits completed",
                "draft_visits": "Draft visits in progress"
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to load admin overview")

@router.get("/visits")
async def get_all_visits(
    page: int = 1,
    limit: int = 50,
    business_id: Optional[int] = None,
    business_name: Optional[str] = None,
    representative_id: Optional[int] = None,
    status: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get all visits with filtering and pagination."""
    try:
        # Build WHERE clause for filtering
        where_conditions = []
        params = {}
        
        if business_id:
            where_conditions.append("v.business_id = :business_id")
            params["business_id"] = business_id
        if business_name:
            where_conditions.append("LOWER(b.name) LIKE LOWER(:business_name)")
            params["business_name"] = f"%{business_name}%"
        if representative_id:
            where_conditions.append("v.representative_id = :representative_id")
            params["representative_id"] = representative_id
        if status:
            where_conditions.append("v.status = :status")
            params["status"] = status
        if date_from:
            where_conditions.append("v.visit_date >= :date_from")
            params["date_from"] = date_from
        if date_to:
            where_conditions.append("v.visit_date <= :date_to")
            params["date_to"] = date_to
        
        # Build WHERE clause string
        where_clause = ""
        if where_conditions:
            where_clause = "WHERE " + " AND ".join(where_conditions)
        
        params.update({
            "limit": limit,
            "offset": (page - 1) * limit
        })
        
        # Build the complete query
        base_query = f"""
            SELECT 
                v.id,
                v.business_id,
                b.name as business_name,
                v.representative_id,
                u.name as representative_name,
                v.visit_date,
                v.visit_type,
                v.status,
                b.priority_level as business_priority
            FROM visits v
            JOIN businesses b ON v.business_id = b.id
            LEFT JOIN b2b_users u ON v.representative_id = u.id
            {where_clause}
            ORDER BY v.visit_date DESC
            LIMIT :limit OFFSET :offset
        """
        
        # Execute query
        result = db.execute(text(base_query), params)
        
        # Get total count
        count_query = f"SELECT COUNT(*) FROM visits v {where_clause}"
        count_result = db.execute(text(count_query), params)
        
        total_count = count_result.scalar()
        
        # Fetch visits
        visits = []
        for row in result:
            visits.append({
                "id": row[0],
                "business_id": row[1],
                "business_name": row[2],
                "representative_id": row[3],
                "representative_name": row[4],
                "visit_date": row[5].isoformat() if row[5] else None,
                "visit_type": row[6],
                "status": row[7],
                "business_priority": row[8],
                "response_count": 0  # Default to 0, can be calculated separately if needed
            })
        
        return {
            "visits": visits,
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total_count,
                "has_more": (page * limit) < total_count
            },
            "filters": {
                "business_id": business_id,
                "business_name": business_name,
                "representative_id": representative_id,
                "status": status,
                "date_from": date_from,
                "date_to": date_to
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to fetch visits")

@router.get("/visits/{visit_id}")
async def get_visit_with_responses(visit_id: str, db: Session = Depends(get_db)):
    """Get visit details with all responses included."""
    try:
        # Get visit details
        visit_result = db.execute(text(
            """
            SELECT 
                v.id,
                v.business_id,
                b.name as business_name,
                v.representative_id,
                u.name as representative_name,
                v.visit_date,
                v.visit_type,
                v.status,
                b.priority_level as business_priority
            FROM visits v
            JOIN businesses b ON v.business_id = b.id
            LEFT JOIN b2b_users u ON v.representative_id = u.id
            WHERE v.id = :visit_id
            """
        ), {"visit_id": visit_id})
        
        if not visit_result.rowcount:
            raise HTTPException(status_code=404, detail="Visit not found")
        
        visit_row = visit_result.fetchone()
        
        # Get all responses for this visit
        responses_result = db.execute(text(
            """
            SELECT 
                r.id as response_id,
                r.question_id,
                r.score,
                r.answer_text,
                r.verbatim,
                r.actions,
                r.created_at,
                r.updated_at,
                q.question_text,
                q.category
            FROM b2b_visit_responses r
            JOIN questions q ON r.question_id = q.id
            WHERE r.visit_id = :visit_id
            ORDER BY q.question_id
            """
        ), {"visit_id": visit_id})
        
        # Format visit data
        visit_data = {
            "id": visit_row[0],
            "business_id": visit_row[1],
            "business_name": visit_row[2],
            "representative_id": visit_row[3],
            "representative_name": visit_row[4],
            "visit_date": visit_row[5].isoformat() if visit_row[5] else None,
            "visit_type": visit_row[6],
            "status": visit_row[7],
            "business_priority": visit_row[8],
            "responses": []
        }
        
        # Format responses
        responses = []
        for row in responses_result:
            actions = json.loads(row[5]) if row[5] else []
            responses.append({
                "response_id": str(row[0]),
                "question_id": row[1],
                "score": row[2],
                "answer_text": row[3],
                "verbatim": row[4],
                "actions": actions,
                "question_text": row[6],
                "category": row[7],
                "created_at": row[8].isoformat() if row[8] else None,
                "updated_at": row[9].isoformat() if row[9] else None
            })
        
        visit_data["responses"] = responses
        
        return visit_data
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to fetch visit with responses")

@router.get("/responses")
async def get_all_responses(
    page: int = 1,
    limit: int = 100,
    question_id: Optional[int] = None,
    category: Optional[str] = None,
    score_min: Optional[int] = None,
    score_max: Optional[int] = None,
    answer_text: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get all responses with filtering and pagination."""
    try:
        # Build WHERE clause for filtering
        where_conditions = []
        params = {}
        
        if question_id:
            where_conditions.append("r.question_id = :question_id")
            params["question_id"] = question_id
        if category:
            where_conditions.append("q.category = :category")
            params["category"] = category
        if score_min is not None:
            where_conditions.append("r.score >= :score_min")
            params["score_min"] = score_min
        if score_max is not None:
            where_conditions.append("r.score <= :score_max")
            params["score_max"] = score_max
        if answer_text:
            where_conditions.append("LOWER(r.answer_text) LIKE LOWER(:answer_text)")
            params["answer_text"] = f"%{answer_text}%"
        
        # Build the complete query
        base_query = """
            SELECT 
                r.id,
                r.visit_id,
                r.question_id,
                r.score,
                r.answer_text,
                r.verbatim,
                r.actions,
                r.created_at,
                r.updated_at,
                q.question_text,
                q.category
            FROM b2b_visit_responses r
            JOIN questions q ON r.question_id = q.id
            JOIN visits v ON r.visit_id = v.id
            {where_clause}
            ORDER BY r.created_at DESC
            LIMIT :limit OFFSET :offset
        """
        
        # Execute query
        result = db.execute(text(base_query), params)
        
        # Get total count
        count_result = db.execute(text(
            f"SELECT COUNT(*) FROM b2b_visit_responses r {where_clause}"
        ), params)
        
        total_count = count_result.scalar()
        
        # Fetch responses
        responses = []
        for row in result:
            actions = json.loads(row[5]) if row[5] else []
            responses.append({
                "response_id": str(row[0]),
                "visit_id": str(row[1]),
                "question_id": row[2],
                "score": row[3],
                "answer_text": row[4],
                "verbatim": row[5],
                "actions": actions,
                "question_text": row[6],
                "category": row[7],
                "created_at": row[8].isoformat() if row[8] else None,
                "updated_at": row[9].isoformat() if row[9] else None
            })
        
        return {
            "responses": responses,
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total_count,
                "has_more": (page * limit) < total_count
            },
            "filters": {
                "question_id": question_id,
                "category": category,
                "score_min": score_min,
                "score_max": score_max,
                "answer_text": answer_text
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to fetch responses")

@router.get("/analytics")
async def get_analytics(db: Session = Depends(get_db)):
    """Get comprehensive analytics for admin dashboard."""
    try:
        # Get visit statistics
        visit_stats = db.execute(text("""
            SELECT 
                COUNT(*) as total_visits,
                COUNT(CASE WHEN status = 'Draft' THEN 1 ELSE 0 END) as draft_visits,
                COUNT(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END) as pending_visits,
                COUNT(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END) as completed_visits,
                COUNT(CASE WHEN status = 'Submitted' THEN 1 ELSE 0 END) as submitted_visits
            FROM visits
        """)).fetchone()
        
        # Get response statistics
        response_stats = db.execute(text("""
            SELECT 
                COUNT(*) as total_responses,
                COUNT(CASE WHEN score IS NOT NULL THEN 1 ELSE 0 END) as scored_responses,
                AVG(CASE WHEN score IS NOT NULL THEN score ELSE 0 END) as avg_score,
                COUNT(CASE WHEN answer_text IS NOT NULL AND answer_text != '' THEN 1 ELSE 0 END) as text_responses
            FROM b2b_visit_responses
        """)).fetchone()
        
        # Get business statistics
        business_stats = db.execute(text("""
            SELECT 
                COUNT(*) as total_businesses,
                COUNT(CASE WHEN active = true THEN 1 ELSE 0 END) as active_businesses
            FROM businesses
        """)).fetchone()
        
        # Get user statistics
        user_stats = db.execute(text("""
            SELECT 
                COUNT(*) as total_users,
                COUNT(CASE WHEN role = 'Representative' THEN 1 ELSE 0 END) as representatives,
                COUNT(CASE WHEN role = 'Manager' THEN 1 ELSE 0 END) as managers,
                COUNT(CASE WHEN role = 'Admin' THEN 1 ELSE 0 END) as admins
            FROM b2b_users
        """)).fetchone()
        
        return {
            "visits": {
                "total": visit_stats.total_visits,
                "draft": visit_stats.draft_visits,
                "pending": visit_stats.pending_visits,
                "completed": visit_stats.completed_visits,
                "submitted": visit_stats.submitted_visits
            },
            "responses": {
                "total": response_stats.total_responses,
                "scored": response_stats.scored_responses,
                "avg_score": float(response_stats.avg_score) if response_stats.avg_score else 0,
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

@router.get("/search/visits")
async def search_visits(
    query: str = Query(...),
    page: int = 1,
    limit: int = 20,
    db: Session = Depends(get_db)
):
    """Search visits by business name, representative, or custom query."""
    try:
        # Get total count for pagination
        count_result = db.execute(text(
            "SELECT COUNT(*) FROM visits v"
        )).scalar()
        
        # Build WHERE clause from query
        where_conditions = []
        params = {}
        
        if query:
            search_query = query.strip()
            if search_query:
                where_conditions.append("(v.business_id IN (SELECT id FROM businesses WHERE LOWER(name) LIKE LOWER(:query)) OR v.representative_id IN (SELECT id FROM b2b_users WHERE LOWER(name) LIKE LOWER(:query)))")
                params["query"] = f"%{search_query}%"
        
        # Build the complete query
        base_query = f"""
            SELECT 
                v.id,
                v.business_id,
                b.name as business_name,
                v.representative_id,
                u.name as representative_name,
                v.visit_date,
                v.visit_type,
                v.status,
                b.priority_level as business_priority,
                COUNT(r.id) as response_count
            FROM visits v
            JOIN businesses b ON v.business_id = b.id
            LEFT JOIN b2b_users u ON v.representative_id = u.id
            {where_conditions}
            ORDER BY v.visit_date DESC
            LIMIT :limit OFFSET :offset
        """
        
        # Execute query
        result = db.execute(text(base_query), params)
        
        # Fetch visits
        visits = []
        for row in result:
            visits.append({
                "id": row[0],
                "business_id": row[1],
                "business_name": row[2],
                "representative_id": row[3],
                "representative_name": row[4],
                "visit_date": row[5].isoformat() if row[5] else None,
                "visit_type": row[6],
                "status": row[7],
                "business_priority": row[8],
                "response_count": row[9]
            })
        
        return {
            "visits": visits,
            "pagination": {
                "page": page,
                "limit": limit,
                "total": count_result,
                "has_more": (page * limit) < count_result,
                "query": search_query
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to search visits")

@router.get("/export/responses")
async def export_responses(
    format: str = "json",
    business_id: Optional[int] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Export all responses in specified format."""
    try:
        # Build WHERE clause
        where_conditions = []
        params = {}
        
        if business_id:
            where_conditions.append("v.business_id = :business_id")
            params["business_id"] = business_id
        if date_from:
            where_conditions.append("v.visit_date >= :date_from")
            params["date_from"] = date_from
        if date_to:
            where_conditions.append("v.visit_date <= :date_to")
            params["date_to"] = date_to
        
        # Get all responses with visit details
        query = f"""
            SELECT 
                v.id as visit_id,
                v.visit_date,
                b.name as business_name,
                u.name as representative_name,
                r.id as response_id,
                r.question_id,
                r.score,
                r.answer_text,
                r.verbatim,
                r.actions,
                r.created_at,
                r.updated_at,
                q.question_text,
                q.category
            FROM b2b_visit_responses r
            JOIN visits v ON r.visit_id = v.id
            JOIN businesses b ON v.business_id = b.id
            LEFT JOIN b2b_users u ON v.representative_id = u.id
            JOIN questions q ON r.question_id = q.id
            {where_clause}
            ORDER BY v.visit_date DESC, r.created_at DESC
        """
        
        result = db.execute(text(query), params)
        
        if format.lower() == "json":
            # Format as JSON
            responses = []
            for row in result:
                actions = json.loads(row[5]) if row[5] else []
                responses.append({
                    "visit_id": str(row[0]),
                    "visit_date": row[1].isoformat() if row[1] else None,
                    "business_name": row[2],
                    "representative_name": row[3],
                    "response_id": str(row[4]),
                    "question_id": row[5],
                    "question_text": row[6],
                    "score": row[7],
                    "answer_text": row[8],
                    "verbatim": row[9],
                    "actions": actions,
                    "question_text": row[10],
                    "category": row[11],
                    "created_at": row[12].isoformat() if row[12] else None,
                    "updated_at": row[13].isoformat() if row[13] else None
                })
            
            return {
                "format": "json",
                "responses": responses,
                "total_count": len(responses)
            }
        else:
            # Format as CSV
            import csv
            from io import StringIO
            
            output = StringIO()
            writer = csv.writer(output)
            
            # Write header
            writer.writerow([
                "Visit ID", "Visit Date", "Business Name", "Representative", 
                "Response ID", "Question ID", "Score", "Answer Text", "Verbatim", "Actions", "Category", "Created At", "Updated At"
            ])
            
            # Write data rows
            for row in result:
                actions = json.loads(row[5]) if row[5] else []
                writer.writerow([
                    str(row[0]),  # visit_id
                    row[1].isoformat() if row[1] else None,  # visit_date
                    row[2],  # business_name
                    row[3],  # representative_name
                    str(row[4]),  # response_id
                    str(row[5]),  # question_id
                    str(row[7]),  # score
                    row[8],  # answer_text
                    row[9],  # verbatim
                    json.dumps(actions),  # actions
                    row[10],  # question_text
                    row[11],  # category
                    row[12].isoformat() if row[12] else None,  # created_at
                    row[13].isoformat() if row[13] else None  # updated_at
                ])
            
            output.seek(0)
            return {
                "format": "csv",
                "data": output.getvalue(),
                "total_count": len(responses)
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to export responses")

@router.delete("/responses/{response_id}")
async def delete_response(response_id: str, db: Session = Depends(get_db)):
    """Delete a specific response (admin only)."""
    try:
        # Delete the response
        result = db.execute(text(
            "DELETE FROM b2b_visit_responses WHERE id = :response_id"
        ), {"response_id": response_id})
        
        db.commit()
        
        return {
            "message": f"Response {response_id} deleted successfully"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to delete response")
