"""
Dashboard visits compatibility endpoint - DIFFERENT PREFIX
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Dict, Optional
import json
from ..core.database import get_db
from ..core.auth.dependencies import get_current_user, require_role
from ..core.models import User

router = APIRouter(prefix="/dashboard-visits", tags=["dashboard-visits"])


def resolve_survey_type_id(
    db: Session,
    survey_type: str | None,
    survey_type_id: int | None,
) -> int | None:
    """Resolve survey type codename/name to ID.

    The API prefers passing `survey_type` as a codename (string). We map it to
    `survey_types.id` for storage/filtering.
    """

    if survey_type_id is not None:
        return survey_type_id

    if survey_type is None:
        return None

    return db.execute(
        text("SELECT id FROM survey_types WHERE name = :survey_type"),
        {"survey_type": survey_type},
    ).scalar()


def check_duplicate_visit(
    business_id: int,
    visit_date: str,
    db: Session,
    exclude_visit_id: str = None,
    survey_type_id: int | None = None,
):
    """Check if a visit already exists for the same business on the same date."""
    try:
        # Build query to check for existing visits
        query = """
            SELECT COUNT(*) as count 
            FROM visits 
            WHERE business_id = :business_id 
            AND DATE(visit_date) = DATE(:visit_date)
        """
        params = {
            "business_id": business_id,
            "visit_date": visit_date
        }

        if survey_type_id is not None:
            query += " AND survey_type_id = :survey_type_id"
            params["survey_type_id"] = survey_type_id
        
        # If updating, exclude the current visit from the check
        if exclude_visit_id:
            query += " AND id != :exclude_visit_id"
            params["exclude_visit_id"] = exclude_visit_id
        
        result = db.execute(text(query), params)
        count = result.scalar()
        
        return count > 0
    except Exception as e:
        print(f"Error checking duplicate visit: {e}")
        return False


@router.post("")
async def create_visit(visit_data: dict, db: Session = Depends(get_db)):
    """Create a new visit."""
    try:
        # Validate required fields
        business_id = visit_data.get("business_id")
        visit_date = visit_data.get("visit_date")
        survey_type_id = visit_data.get("survey_type_id")
        survey_type = visit_data.get("survey_type")
        
        if not business_id or not visit_date:
            raise HTTPException(status_code=400, detail="business_id and visit_date are required")

        survey_type_id = resolve_survey_type_id(db, survey_type, survey_type_id)

        if survey_type_id is None:
            survey_type_id = db.execute(text(
                "SELECT id FROM survey_types WHERE name = 'B2B'"
            )).scalar()
        
        # Check for duplicate visit
        if check_duplicate_visit(business_id, visit_date, db, survey_type_id=survey_type_id):
            raise HTTPException(
                status_code=400, 
                detail=f"A visit for this business already exists on {visit_date}. Only one visit per business per day is allowed."
            )
        
        # Insert new visit
        db.execute(text(
            """
            INSERT INTO visits 
            (id, business_id, representative_id, created_by, visit_date, visit_type, status, survey_type_id)
            VALUES (gen_random_uuid(), :business_id, :rep_id, :created_by, :visit_date, :visit_type, 'Draft', :survey_type_id)
            """
        ), {
            "business_id": business_id,
            "rep_id": visit_data.get("representative_id"),
            "created_by": visit_data.get("created_by", visit_data.get("representative_id")),
            "visit_date": visit_date,
            "visit_type": visit_data.get("visit_type"),
            "survey_type_id": survey_type_id,
        })
        
        # Commit the transaction
        db.commit()
        
        return {
            "visit_id": "new-visit-created",
            "status": "Draft",
            "message": "Visit created successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating visit: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to create visit")


@router.get("/all")
async def get_all_visits(
    status: Optional[str] = None,
    business_name: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    survey_type_id: Optional[int] = None,
    survey_type: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get all visits with filtering support."""
    try:
        # Build WHERE clause for filtering
        where_conditions = []
        params = {}

        resolved_survey_type_id = resolve_survey_type_id(db, survey_type, survey_type_id)
        
        if status:
            where_conditions.append("v.status = :status")
            params["status"] = status
        if business_name:
            where_conditions.append("LOWER(b.name) LIKE LOWER(:business_name)")
            params["business_name"] = f"%{business_name}%"
        if date_from:
            where_conditions.append("v.visit_date >= :date_from")
            params["date_from"] = date_from
        if date_to:
            where_conditions.append("v.visit_date <= :date_to")
            params["date_to"] = date_to
        if resolved_survey_type_id:
            where_conditions.append("v.survey_type_id = :survey_type_id")
            params["survey_type_id"] = resolved_survey_type_id
        
        # Build WHERE clause string
        where_clause = ""
        if where_conditions:
            where_clause = "WHERE " + " AND ".join(where_conditions)
        
        # Build the complete query
        query = f"""
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
                COUNT(r.id) as response_count,
                COUNT(CASE WHEN q.is_mandatory = true AND r.id IS NOT NULL THEN 1 END) as mandatory_answered_count,
                (SELECT COUNT(*) FROM questions q2 WHERE q2.is_mandatory = true AND q2.survey_type_id = v.survey_type_id) as mandatory_total_count,
                false as is_started,
                false as is_completed
            FROM visits v
            JOIN businesses b ON v.business_id = b.id
            LEFT JOIN users u ON v.representative_id = u.id
            LEFT JOIN b2b_visit_responses r ON v.id = r.visit_id
            LEFT JOIN questions q ON r.question_id = q.id
            {where_clause}
            GROUP BY v.id, v.business_id, b.name, v.representative_id, u.name, v.visit_date, v.visit_type, v.status, b.priority_level
            ORDER BY v.visit_date DESC
        """
        
        # Execute query
        result = db.execute(text(query), params)
        
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
                "response_count": row[9],
                "mandatory_answered_count": row[10] if len(row) > 10 else 0,
                "mandatory_total_count": row[11] if len(row) > 11 else 24,
                "is_started": row[9] > 0,  # True if any response exists
                "is_completed": row[13] if len(row) > 13 else False
            })
        
        return visits
        
    except Exception as e:
        print(f"Error getting all visits: {e}")
        raise HTTPException(status_code=500, detail="Failed to get visits")


@router.get("/drafts")
async def get_draft_visits(db: Session = Depends(get_db)):
    """Get draft visits for dashboard."""
    try:
        rows = db.execute(text(
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
                b.priority_level as business_priority,
                COUNT(r.id) as response_count,
                COUNT(CASE WHEN q.is_mandatory = true AND r.id IS NOT NULL THEN 1 END) as mandatory_answered_count,
                (SELECT COUNT(*) FROM questions q2 WHERE q2.is_mandatory = true AND q2.survey_type_id = v.survey_type_id) as mandatory_total_count
            FROM visits v
            JOIN businesses b ON v.business_id = b.id
            LEFT JOIN users u ON v.representative_id = u.id
            LEFT JOIN b2b_visit_responses r ON v.id = r.visit_id
            LEFT JOIN questions q ON r.question_id = q.id
            WHERE v.status = 'Draft'
            GROUP BY v.id, v.business_id, b.name, v.representative_id, u.name, v.visit_date, v.visit_type, v.status, b.priority_level
            ORDER BY v.visit_date DESC
            """
        )).all()

        return [
            {
                "id": row[0],
                "visit_id": row[0],
                "business_id": row[1],
                "business_name": row[2],
                "representative_id": row[3],
                "representative_name": row[4],
                "visit_date": row[5].isoformat() if row[5] else None,
                "visit_type": row[6],
                "status": row[7],
                "business_priority": row[8],
                "response_count": row[9],
                "mandatory_answered_count": row[10],
                "mandatory_total_count": row[11],
                "is_started": row[9] > 0,
                "is_completed": False
            }
            for row in rows
        ]
        
    except Exception as e:
        print(f"Error fetching draft visits: {e}")
        return []


@router.get("/pending")
async def get_pending_visits(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _manager_access: bool = Depends(require_role("Manager"))
):
    """Get pending visits for dashboard - requires Manager role."""
    try:
        rows = db.execute(text(
            """
            SELECT 
                v.id,
                v.business_id,
                b.name as business_name,
                v.representative_id,
                v.visit_date,
                v.visit_type,
                v.status,
                b.priority_level as business_priority
            FROM visits v
            JOIN businesses b ON v.business_id = b.id
            WHERE v.status = 'Pending'
            ORDER BY v.visit_date DESC
            """
        )).all()
        
        return [
            {
                "visit_id": row[0],
                "business_id": row[1],
                "business_name": row[2],
                "representative_id": row[3],
                "visit_date": row[4],
                "visit_type": row[5],
                "status": row[6],
                "business_priority": row[7],
                "reviewer_id": None,
                "review_timestamp": None,
                "change_notes": None,
                "approval_timestamp": None,
                "approval_notes": None,
                "rejection_notes": None
            }
            for row in rows
        ]
    except Exception as e:
        print(f"Error fetching pending visits: {e}")
        return []


@router.put("/{visit_id}/draft")
async def update_visit_draft(visit_id: str, visit_data: dict, db: Session = Depends(get_db)):
    """Update a draft visit."""
    try:
        # Get current visit details to check business_id
        current_visit = db.execute(text(
            "SELECT business_id FROM visits WHERE id = :visit_id"
        ), {"visit_id": visit_id}).fetchone()
        
        if not current_visit:
            raise HTTPException(status_code=404, detail="Visit not found")
        
        business_id = current_visit[0]
        new_visit_date = visit_data.get("visit_date")
        
        # Check for duplicate visit if date is being changed
        if new_visit_date and check_duplicate_visit(business_id, new_visit_date, db, exclude_visit_id=visit_id):
            raise HTTPException(
                status_code=400, 
                detail=f"A visit for this business already exists on {new_visit_date}. Only one visit per business per day is allowed."
            )
        
        # Update the visit with new data
        update_fields = []
        params = {"visit_id": visit_id}
        
        if visit_data.get("representative_id") is not None:
            update_fields.append("representative_id = :rep_id")
            params["rep_id"] = visit_data.get("representative_id")
        
        if new_visit_date:
            update_fields.append("visit_date = :visit_date")
            params["visit_date"] = new_visit_date
        
        if visit_data.get("visit_type") is not None:
            update_fields.append("visit_type = :visit_type")
            params["visit_type"] = visit_data.get("visit_type")
        
        if not update_fields:
            raise HTTPException(status_code=400, detail="No valid fields to update")
        
        # Build dynamic UPDATE query
        query = f"UPDATE visits SET {', '.join(update_fields)} WHERE id = :visit_id"
        db.execute(text(query), params)
        
        # Commit the transaction to ensure changes persist
        db.commit()
        
        # Get updated visit details
        rows = db.execute(text(
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
            LEFT JOIN users u ON v.representative_id = u.id
            WHERE v.id = :visit_id
            """
        ), {"visit_id": visit_id}).all()
        
        if not rows:
            raise HTTPException(status_code=404, detail="Visit not found after update")
            
        row = rows[0]
        return {
            "visit_id": row[0],
            "business_id": row[1],
            "business_name": row[2],
            "representative_id": row[3],
            "representative_name": row[4],
            "visit_date": row[5],
            "visit_type": row[6],
            "status": row[7],
            "business_priority": row[8]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating visit: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to update visit")


@router.delete("/{visit_id}")
async def delete_draft_visit(visit_id: str, db: Session = Depends(get_db)):
    """Delete a draft (planned) visit and its responses."""
    try:
        visit_row = db.execute(text(
            "SELECT status FROM visits WHERE id = :visit_id"
        ), {"visit_id": visit_id}).fetchone()

        if not visit_row:
            raise HTTPException(status_code=404, detail="Visit not found")

        status_value = visit_row[0]
        if status_value != "Draft":
            raise HTTPException(status_code=400, detail="Only Draft visits can be deleted")

        db.execute(text(
            "DELETE FROM b2b_visit_responses WHERE visit_id = :visit_id"
        ), {"visit_id": visit_id})
        db.execute(text(
            "DELETE FROM visits WHERE id = :visit_id"
        ), {"visit_id": visit_id})
        db.commit()

        return {"detail": "Visit deleted"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting visit: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to delete visit")


@router.post("/{visit_id}/responses")
async def create_response(visit_id: str, response_data: dict, db: Session = Depends(get_db)):
    """Create a response for a visit."""
    try:
        # Insert response into database
        result = db.execute(text(
            """
            INSERT INTO b2b_visit_responses 
            (visit_id, question_id, score, answer_text, verbatim, actions)
            VALUES (:visit_id, :question_id, :score, :answer_text, :verbatim, :actions)
            RETURNING id, question_id, score, answer_text, verbatim, actions, created_at
            """
        ), {
            "visit_id": visit_id,
            "question_id": response_data.get("question_id"),
            "score": response_data.get("score"),
            "answer_text": response_data.get("answer_text"),
            "verbatim": response_data.get("verbatim"),
            "actions": json.dumps(response_data.get("actions", []))
        })
        
        # Commit the transaction to save changes
        db.commit()
        
        # Get the inserted response
        row = result.fetchone()
        return {
            "response_id": str(row[0]),
            "question_id": row[1],
            "visit_id": visit_id,
            "score": row[2],
            "answer_text": row[3],
            "verbatim": row[4],
            "actions": json.loads(row[5]) if row[5] else []
        }
    except Exception as e:
        print(f"Error creating response: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to create response")


@router.put("/{visit_id}/responses/{response_id}")
async def update_response(visit_id: str, response_id: str, response_data: dict, db: Session = Depends(get_db)):
    """Update a response for a visit."""
    try:
        # Update response in database
        result = db.execute(text(
            """
            UPDATE b2b_visit_responses 
            SET question_id = :question_id,
                score = :score,
                answer_text = :answer_text,
                verbatim = :verbatim,
                actions = :actions,
                updated_at = NOW()
            WHERE id = :response_id AND visit_id = :visit_id
            RETURNING id, question_id, score, answer_text, verbatim, actions, updated_at
            """
        ), {
            "response_id": response_id,
            "visit_id": visit_id,
            "question_id": response_data.get("question_id"),
            "score": response_data.get("score"),
            "answer_text": response_data.get("answer_text"),
            "verbatim": response_data.get("verbatim"),
            "actions": json.dumps(response_data.get("actions", []))
        })
        
        # Commit the transaction to save changes
        db.commit()
        
        # Get the updated response
        row = result.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Response not found")
            
        return {
            "response_id": str(row[0]),
            "question_id": row[1],
            "visit_id": visit_id,
            "score": row[2],
            "answer_text": row[3],
            "verbatim": row[4],
            "actions": json.loads(row[5]) if row[5] else []
        }
    except Exception as e:
        print(f"Error updating response: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to update response")


@router.put("/{visit_id}/submit")
async def submit_visit(visit_id: str, submit_data: dict, db: Session = Depends(get_db)):
    """Submit a visit for review."""
    try:
        # Update visit status to Pending
        db.execute(text(
            "UPDATE visits SET status = 'Pending' WHERE id = :visit_id"
        ), {"visit_id": visit_id})
        
        # Commit the transaction to save changes
        db.commit()
        
        return {
            "visit_id": visit_id,
            "status": "Pending",
            "message": "Visit submitted for review"
        }
    except Exception as e:
        print(f"Error submitting visit: {e}")
        return {"detail": "Failed to submit visit"}


@router.put("/{visit_id}/approve")
async def approve_visit(visit_id: str, approval_data: dict, db: Session = Depends(get_db)):
    """Approve a visit."""
    try:
        # Update visit status to Approved
        db.execute(text(
            """
            UPDATE visits 
            SET status = 'Approved', 
                approval_timestamp = NOW(),
                approval_notes = :approval_notes
            WHERE id = :visit_id
            """
        ), {
            "visit_id": visit_id,
            "approval_notes": approval_data.get("approval_notes")
        })
        
        # Commit the transaction
        db.commit()
        
        return {
            "visit_id": visit_id,
            "status": "Approved",
            "message": "Visit approved successfully"
        }
    except Exception as e:
        print(f"Error approving visit: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to approve visit")


@router.put("/{visit_id}/reject")
async def reject_visit(visit_id: str, rejection_data: dict, db: Session = Depends(get_db)):
    """Reject a visit."""
    try:
        # Update visit status to Rejected
        db.execute(text(
            """
            UPDATE visits 
            SET status = 'Rejected', 
                rejection_timestamp = NOW(),
                rejection_notes = :rejection_notes
            WHERE id = :visit_id
            """
        ), {
            "visit_id": visit_id,
            "rejection_notes": rejection_data.get("rejection_notes")
        })
        
        # Commit the transaction
        db.commit()
        
        return {
            "visit_id": visit_id,
            "status": "Rejected", 
            "message": "Visit rejected successfully"
        }
    except Exception as e:
        print(f"Error rejecting visit: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to reject visit")


@router.put("/{visit_id}/needs-changes")
async def request_changes(visit_id: str, changes_data: dict, db: Session = Depends(get_db)):
    """Request changes for a visit."""
    try:
        # Update visit status back to Draft with change notes
        db.execute(text(
            """
            UPDATE visits 
            SET status = 'Draft', 
                change_notes = :change_notes
            WHERE id = :visit_id
            """
        ), {
            "visit_id": visit_id,
            "change_notes": changes_data.get("change_notes")
        })
        
        # Commit the transaction
        db.commit()
        
        return {
            "visit_id": visit_id,
            "status": "Draft",
            "message": "Changes requested successfully"
        }
    except Exception as e:
        print(f"Error requesting changes: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to request changes")


@router.get("/{visit_id}")
async def get_visit_detail(
    visit_id: str, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get individual visit detail.

    This endpoint is used by both the dashboard and the survey frontend to load
    previously-saved answers.
    """
    try:
        print(f"DEBUG: Getting visit detail for visit_id: {visit_id}")
        
        # Get visit details
        visit_rows = db.execute(text(
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
            LEFT JOIN users u ON v.representative_id = u.id
            WHERE v.id = :visit_id
            """
        ), {"visit_id": visit_id}).all()
        
        print(f"DEBUG: Found {len(visit_rows)} visit rows")
        
        if not visit_rows:
            print(f"DEBUG: Visit not found for ID: {visit_id}")
            raise HTTPException(status_code=404, detail="Visit not found")
            
        visit_row = visit_rows[0]
        print(f"DEBUG: Visit found: {visit_row[2]}")
        
        # Get responses for this visit with correct question numbers
        response_rows = db.execute(text(
            """
            SELECT 
                r.id,
                r.question_id,
                r.score,
                r.answer_text,
                r.verbatim,
                r.actions,
                r.created_at,
                r.updated_at,
                q.question_number,
                q.question_text,
                q.input_type
            FROM b2b_visit_responses r
            LEFT JOIN questions q ON r.question_id = q.id
            WHERE r.visit_id = :visit_id
            ORDER BY q.question_number
            """
        ), {"visit_id": visit_id}).all()
        
        print(f"DEBUG: Found {len(response_rows)} response rows")
        
        # Format responses with correct question numbers
        responses = []
        for row in response_rows:
            # Parse actions if they exist
            actions = []
            if row[5]:
                try:
                    import json
                    actions = json.loads(row[5])
                except:
                    actions = []
            
            responses.append({
                "response_id": row[0],
                "question_id": row[1],
                "question_number": row[8] if row[8] else row[1],  # Use question_number from questions table, fallback to question_id
                "question_text": row[9],
                "question_type": row[10],
                "score": row[2],
                "answer_text": row[3],
                "verbatim": row[4],
                "actions": actions,
                "created_at": row[6].isoformat() if row[6] else None,
                "updated_at": row[7].isoformat() if row[7] else None
            })
        
        print(f"DEBUG: Formatted {len(responses)} responses")
        
        # Calculate mandatory answered/total counts, scoped to visit's survey_type_id
        mandatory_counts_row = db.execute(
            text(
                """
                SELECT
                    COALESCE(SUM(CASE WHEN q.is_mandatory = true AND r.id IS NOT NULL THEN 1 ELSE 0 END), 0) AS mandatory_answered_count,
                    COALESCE(SUM(CASE WHEN q.is_mandatory = true THEN 1 ELSE 0 END), 0) AS mandatory_total_count
                FROM questions q
                JOIN visits v ON v.survey_type_id = q.survey_type_id
                LEFT JOIN b2b_visit_responses r
                    ON r.visit_id = v.id
                    AND r.question_id = q.id
                WHERE v.id = :visit_id
                """
            ),
            {"visit_id": visit_id},
        ).fetchone()

        mandatory_answered_count = int(mandatory_counts_row[0] or 0) if mandatory_counts_row else 0
        mandatory_total_count = int(mandatory_counts_row[1] or 0) if mandatory_counts_row else 0

        print(f"DEBUG: Mandatory answered: {mandatory_answered_count}, Total mandatory: {mandatory_total_count}")
        
        return {
            "id": visit_row[0],
            "business_id": visit_row[1],
            "business_name": visit_row[2],
            "representative_id": visit_row[3],
            "representative_name": visit_row[4],
            "visit_date": visit_row[5],
            "visit_type": visit_row[6],
            "status": visit_row[7],
            "business_priority": visit_row[8],
            "mandatory_answered_count": mandatory_answered_count,
            "mandatory_total_count": mandatory_total_count,
            "is_started": len(responses) > 0,
            "is_completed": mandatory_total_count > 0 and mandatory_answered_count >= mandatory_total_count,
            "responses": responses
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting visit detail: {e}")
        raise HTTPException(status_code=500, detail="Failed to get visit detail")
