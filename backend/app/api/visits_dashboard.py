"""
Dashboard visits compatibility endpoint - DIFFERENT PREFIX
"""

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Dict, Optional
import json
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pydantic import BaseModel, EmailStr
from ..core.database import get_db
from ..core.auth.dependencies import get_current_user, require_role
from ..core.models import User

router = APIRouter(prefix="/dashboard-visits", tags=["dashboard-visits"])

_visit_signature_columns_checked = False


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


def get_response_table(db: Session) -> str | None:
    if has_table(db, "b2b_visit_responses"):
        return "b2b_visit_responses"
    if has_table(db, "responses"):
        return "responses"
    return None


ACTION_TIMEFRAME_OPTIONS = {"<1 month", "<3 months", "<6 months", ">6 months"}


class ReportEmailRequest(BaseModel):
    to: List[EmailStr]
    subject: str | None = None
    survey_type: str | None = "B2B"
    business_id: int | None = None
    date_from: str | None = None
    date_to: str | None = None
    message: str | None = None


def resolve_actor_user_id(db: Session, current_user: User) -> int:
    """Resolve authenticated user to a local users.id row.

    This prevents FK violations when Entra-authenticated users don't exist yet
    in the legacy `users` table used by visits.representative_id/created_by.
    """
    if not has_table(db, "users"):
        return int(current_user.id)

    email = (getattr(current_user, "email", "") or "").strip().lower()
    name = (getattr(current_user, "name", "") or "Survey User").strip()[:200]

    if email:
        existing_id = db.execute(
            text("SELECT id FROM users WHERE LOWER(email) = :email LIMIT 1"),
            {"email": email},
        ).scalar()
        if existing_id is not None:
            return int(existing_id)

    fallback_email = email or f"{(getattr(current_user, 'sub', '') or 'survey-user')}@entra.local"
    fallback_email = fallback_email.strip().lower()[:255]

    role = "Representative"
    roles = getattr(current_user, "roles", tuple()) or tuple()
    if any(str(item).upper() in {"CX_SUPER_ADMIN", "B2B_ADMIN", "MYSTERY_ADMIN", "INSTALL_ADMIN"} for item in roles):
        role = "Admin"

    try:
        created_id = db.execute(
            text(
                """
                INSERT INTO users (name, email, role, active)
                VALUES (:name, :email, :role, true)
                ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
                RETURNING id
                """
            ),
            {"name": name or "Survey User", "email": fallback_email, "role": role},
        ).scalar()
        if created_id is not None:
            return int(created_id)
    except Exception:
        existing_id = db.execute(
            text("SELECT id FROM users WHERE LOWER(email) = :email LIMIT 1"),
            {"email": fallback_email},
        ).scalar()
        if existing_id is not None:
            return int(existing_id)

    return int(current_user.id)


def ensure_visit_submission_columns(db: Session) -> None:
    global _visit_signature_columns_checked
    if _visit_signature_columns_checked:
        return
    if not has_table(db, "visits"):
        return
    has_name = has_column(db, "visits", "submitted_by_name")
    has_email = has_column(db, "visits", "submitted_by_email")
    has_submitted_at = has_column(db, "visits", "submitted_at")
    if has_name and has_email and has_submitted_at:
        _visit_signature_columns_checked = True
        return
    db.execute(text("ALTER TABLE visits ADD COLUMN IF NOT EXISTS submitted_by_name VARCHAR(255)"))
    db.execute(text("ALTER TABLE visits ADD COLUMN IF NOT EXISTS submitted_by_email VARCHAR(255)"))
    db.execute(text("ALTER TABLE visits ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ"))
    _visit_signature_columns_checked = True


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

    if not has_table(db, "survey_types"):
        return None

    has_code = has_column(db, "survey_types", "code")

    if not has_code:
        return db.execute(
            text("SELECT id FROM survey_types WHERE lower(name) = lower(:survey_type) LIMIT 1"),
            {"survey_type": survey_type},
        ).scalar()

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


def fetch_dashboard_actions(
    db: Session,
    survey_type: str | None,
    lead_owner: str | None,
    support: str | None,
    timeline: str | None,
    business_id: int | None,
) -> list[dict]:
    response_table = get_response_table(db)
    if not response_table:
        return []

    has_visit_survey_type = has_column(db, "visits", "survey_type_id")
    resolved_survey_type_id = resolve_survey_type_id(db, survey_type, None)
    where_clauses = ["1=1"]
    params: dict[str, object] = {}

    if business_id is not None:
        where_clauses.append("v.business_id = :business_id")
        params["business_id"] = business_id

    if resolved_survey_type_id and has_visit_survey_type:
        where_clauses.append("v.survey_type_id = :survey_type_id")
        params["survey_type_id"] = resolved_survey_type_id

    if response_table == "b2b_visit_responses":
        sql = """
            SELECT
                v.id as visit_id,
                v.visit_date,
                v.status,
                b.id as business_id,
                b.name as business_name,
                q.id as question_id,
                q.question_text,
                action_item->>'action_required' as action_required,
                action_item->>'action_owner' as action_owner,
                action_item->>'action_timeframe' as action_timeframe,
                action_item->>'action_support_needed' as action_support_needed,
                COALESCE(st.name, :fallback_survey_type) as survey_type
            FROM b2b_visit_responses r
            JOIN visits v ON v.id = r.visit_id
            LEFT JOIN businesses b ON b.id = v.business_id
            LEFT JOIN questions q ON q.id = r.question_id
            LEFT JOIN survey_types st ON st.id = v.survey_type_id
            CROSS JOIN LATERAL jsonb_array_elements(COALESCE(r.actions, '[]'::jsonb)) action_item
            WHERE
                {where_sql}
                AND (
                    COALESCE(action_item->>'action_required', '') <> ''
                    OR COALESCE(action_item->>'action_owner', '') <> ''
                    OR COALESCE(action_item->>'action_timeframe', '') <> ''
                    OR COALESCE(action_item->>'action_support_needed', '') <> ''
                )
            ORDER BY v.visit_date DESC, v.id DESC
        """
        params["fallback_survey_type"] = survey_type or "B2B"
    else:
        sql = """
            SELECT
                v.id as visit_id,
                v.visit_date,
                v.status,
                b.id as business_id,
                b.name as business_name,
                q.id as question_id,
                q.question_text,
                r.action_required,
                r.action_owner,
                r.action_timeframe,
                r.action_support_needed,
                COALESCE(st.name, :fallback_survey_type) as survey_type
            FROM responses r
            JOIN visits v ON v.id = r.visit_id
            LEFT JOIN businesses b ON b.id = v.business_id
            LEFT JOIN questions q ON q.id = r.question_id
            LEFT JOIN survey_types st ON st.id = v.survey_type_id
            WHERE
                {where_sql}
                AND (
                    COALESCE(r.action_required, '') <> ''
                    OR COALESCE(r.action_owner, '') <> ''
                    OR COALESCE(r.action_timeframe, '') <> ''
                    OR COALESCE(r.action_support_needed, '') <> ''
                )
            ORDER BY v.visit_date DESC, v.id DESC
        """
        params["fallback_survey_type"] = survey_type or "B2B"

    where_sql = " AND ".join(where_clauses)
    rows = db.execute(text(sql.format(where_sql=where_sql)), params).mappings().all()

    items = []
    for row in rows:
        item = {
            "visit_id": str(row["visit_id"]),
            "visit_date": row["visit_date"].isoformat() if row["visit_date"] else None,
            "status": row["status"],
            "business_id": row["business_id"],
            "business_name": row["business_name"],
            "survey_type": row["survey_type"],
            "question_id": row["question_id"],
            "question_text": row["question_text"],
            "action_required": row["action_required"] or "",
            "action_owner": row["action_owner"] or "",
            "action_timeframe": row["action_timeframe"] or "",
            "action_support_needed": row["action_support_needed"] or "",
        }

        if lead_owner and lead_owner.strip().lower() not in item["action_owner"].lower():
            continue
        if support and support.strip().lower() not in item["action_support_needed"].lower():
            continue
        if timeline and item["action_timeframe"] != timeline:
            continue

        items.append(item)

    return items


def check_duplicate_visit(
    business_id: int,
    visit_date: str,
    db: Session,
    exclude_visit_id: str = None,
    survey_type_id: int | None = None,
):
    """Check if a visit already exists for the same business on the same date."""
    try:
        has_visit_survey_type = has_column(db, "visits", "survey_type_id")
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

        if survey_type_id is not None and has_visit_survey_type:
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
def create_visit(
    visit_data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new visit."""
    try:
        has_visit_survey_type = has_column(db, "visits", "survey_type_id")
        actor_user_id = resolve_actor_user_id(db, current_user)
        # Validate required fields
        business_id = visit_data.get("business_id")
        visit_date = visit_data.get("visit_date")
        survey_type_id = visit_data.get("survey_type_id")
        survey_type = visit_data.get("survey_type")
        
        if not business_id or not visit_date:
            raise HTTPException(status_code=400, detail="business_id and visit_date are required")

        survey_type_id = resolve_survey_type_id(db, survey_type, survey_type_id)

        if survey_type_id is None and has_table(db, "survey_types"):
            survey_type_id = db.execute(text(
                "SELECT id FROM survey_types WHERE name = 'B2B'"
            )).scalar()
        
        # Check for duplicate visit
        if check_duplicate_visit(business_id, visit_date, db, survey_type_id=survey_type_id):
            raise HTTPException(
                status_code=400, 
                detail=f"A visit for this business already exists on {visit_date}. Only one visit per business per day is allowed."
            )
        
        representative_id = visit_data.get("representative_id")
        if representative_id in (None, ""):
            representative_id = actor_user_id
        else:
            try:
                representative_id = int(representative_id)
            except Exception:
                raise HTTPException(status_code=400, detail="representative_id must be a valid integer")

        if has_table(db, "users"):
            rep_exists = db.execute(text("SELECT 1 FROM users WHERE id = :user_id LIMIT 1"), {"user_id": representative_id}).scalar()
            if not rep_exists:
                raise HTTPException(status_code=400, detail="Selected representative does not exist")

        # Insert new visit
        if has_visit_survey_type:
            created_visit_id = db.execute(text(
                """
                INSERT INTO visits
                (id, business_id, representative_id, created_by, visit_date, visit_type, status, survey_type_id)
                VALUES (gen_random_uuid(), :business_id, :rep_id, :created_by, :visit_date, :visit_type, 'Draft', :survey_type_id)
                RETURNING id
                """
            ), {
                "business_id": business_id,
                "rep_id": representative_id,
                "created_by": actor_user_id,
                "visit_date": visit_date,
                "visit_type": visit_data.get("visit_type"),
                "survey_type_id": survey_type_id,
            }).scalar()
        else:
            created_visit_id = db.execute(text(
                """
                INSERT INTO visits
                (id, business_id, representative_id, created_by, visit_date, visit_type, status)
                VALUES (gen_random_uuid(), :business_id, :rep_id, :created_by, :visit_date, :visit_type, 'Draft')
                RETURNING id
                """
            ), {
                "business_id": business_id,
                "rep_id": representative_id,
                "created_by": actor_user_id,
                "visit_date": visit_date,
                "visit_type": visit_data.get("visit_type"),
            }).scalar()
        
        # Commit the transaction
        db.commit()
        
        return {
            "visit_id": str(created_visit_id),
            "status": "Draft",
            "message": "Visit created successfully",
            "created_by": {
                "user_id": actor_user_id,
                "name": current_user.name,
                "email": current_user.email,
            },
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating visit: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to create visit")


@router.get("/all")
def get_all_visits(
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
        ensure_visit_submission_columns(db)
        # Build WHERE clause for filtering
        where_conditions = []
        params = {}
        response_table = get_response_table(db)
        has_visit_survey_type = has_column(db, "visits", "survey_type_id")
        has_question_survey_type = has_column(db, "questions", "survey_type_id")

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
        if resolved_survey_type_id and has_visit_survey_type:
            where_conditions.append("v.survey_type_id = :survey_type_id")
            params["survey_type_id"] = resolved_survey_type_id

        mandatory_total_expr = "(SELECT COUNT(*) FROM questions q2 WHERE q2.is_mandatory = true)"
        if has_visit_survey_type and has_question_survey_type:
            mandatory_total_expr = "(SELECT COUNT(*) FROM questions q2 WHERE q2.is_mandatory = true AND q2.survey_type_id = v.survey_type_id)"
        
        # Build WHERE clause string
        where_clause = ""
        if where_conditions:
            where_clause = "WHERE " + " AND ".join(where_conditions)
        
        # Build the complete query
        response_join = ""
        if response_table:
            response_join = f"LEFT JOIN {response_table} r ON v.id = r.visit_id"

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
                v.submitted_by_name,
                v.submitted_by_email,
                v.submitted_at,
                COUNT(r.id) as response_count,
                COUNT(CASE WHEN q.is_mandatory = true AND r.id IS NOT NULL THEN 1 END) as mandatory_answered_count,
                {mandatory_total_expr} as mandatory_total_count,
                false as is_started,
                false as is_completed
            FROM visits v
            JOIN businesses b ON v.business_id = b.id
            LEFT JOIN users u ON v.representative_id = u.id
            {response_join}
            LEFT JOIN questions q ON r.question_id = q.id
            {where_clause}
            GROUP BY v.id, v.business_id, b.name, v.representative_id, u.name, v.visit_date, v.visit_type, v.status, b.priority_level, v.submitted_by_name, v.submitted_by_email, v.submitted_at
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
                "submitted_by_name": row[9],
                "submitted_by_email": row[10],
                "submitted_at": row[11].isoformat() if row[11] else None,
                "response_count": row[12],
                "mandatory_answered_count": row[13] if len(row) > 13 else 0,
                "mandatory_total_count": row[14] if len(row) > 14 else 24,
                "is_started": row[12] > 0,
                "is_completed": row[16] if len(row) > 16 else False
            })
        
        return visits
        
    except Exception as e:
        print(f"Error getting all visits: {e}")
        raise HTTPException(status_code=500, detail="Failed to get visits")


@router.get("/actions")
def get_actions_dashboard(
    survey_type: str | None = "B2B",
    lead_owner: str | None = None,
    support: str | None = None,
    timeline: str | None = None,
    business_id: int | None = None,
    db: Session = Depends(get_db),
):
    """List action items raised during survey responses for admin follow-up."""
    try:
        if timeline and timeline not in ACTION_TIMEFRAME_OPTIONS:
            raise HTTPException(
                status_code=400,
                detail="Invalid timeline. Use one of: <1 month, <3 months, <6 months, >6 months",
            )

        items = fetch_dashboard_actions(
            db=db,
            survey_type=survey_type,
            lead_owner=lead_owner,
            support=support,
            timeline=timeline,
            business_id=business_id,
        )

        summary_by_business: dict[str, int] = {}
        summary_by_survey: dict[str, int] = {}
        for item in items:
            business_name = item.get("business_name") or "Unknown"
            survey_name = item.get("survey_type") or "Unknown"
            summary_by_business[business_name] = summary_by_business.get(business_name, 0) + 1
            summary_by_survey[survey_name] = summary_by_survey.get(survey_name, 0) + 1

        return {
            "items": items,
            "filters": {
                "survey_type": survey_type,
                "lead_owner": lead_owner,
                "support": support,
                "timeline": timeline,
                "business_id": business_id,
            },
            "summary": {
                "total_actions": len(items),
                "by_business": summary_by_business,
                "by_survey": summary_by_survey,
            },
            "timeline_options": sorted(ACTION_TIMEFRAME_OPTIONS),
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching actions dashboard: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch actions dashboard: {str(e)}")


def build_report_payload(
    db: Session,
    survey_type: str | None,
    business_id: int | None,
    date_from: str | None,
    date_to: str | None,
) -> dict:
    response_table = get_response_table(db)
    if not response_table:
        raise HTTPException(status_code=500, detail="No response table found")

    has_visit_survey_type = has_column(db, "visits", "survey_type_id")
    resolved_survey_type_id = resolve_survey_type_id(db, survey_type, None)

    where_parts = []
    params: dict = {}
    if business_id is not None:
        where_parts.append("v.business_id = :business_id")
        params["business_id"] = business_id
    if date_from:
        where_parts.append("v.visit_date >= :date_from")
        params["date_from"] = date_from
    if date_to:
        where_parts.append("v.visit_date <= :date_to")
        params["date_to"] = date_to
    if resolved_survey_type_id and has_visit_survey_type:
        where_parts.append("v.survey_type_id = :survey_type_id")
        params["survey_type_id"] = resolved_survey_type_id

    where_clause = ""
    if where_parts:
        where_clause = "WHERE " + " AND ".join(where_parts)

    visit_rows = db.execute(
        text(
            f"""
            SELECT
                v.id,
                v.visit_date,
                v.status,
                b.id AS business_id,
                b.name AS business_name,
                COUNT(r.id) AS response_count,
                AVG(r.score) FILTER (WHERE r.score IS NOT NULL) AS avg_score,
                SUM(CASE WHEN q.is_mandatory = true AND r.id IS NOT NULL THEN 1 ELSE 0 END) AS mandatory_answered_count,
                SUM(CASE WHEN q.is_mandatory = true THEN 1 ELSE 0 END) AS mandatory_total_count
            FROM visits v
            JOIN businesses b ON b.id = v.business_id
            LEFT JOIN {response_table} r ON r.visit_id = v.id
            LEFT JOIN questions q ON q.id = r.question_id
            {where_clause}
            GROUP BY v.id, v.visit_date, v.status, b.id, b.name
            ORDER BY v.visit_date DESC, b.name ASC
            """
        ),
        params,
    ).fetchall()

    visits = []
    total_responses = 0
    status_counts = {"Draft": 0, "Pending": 0, "Approved": 0, "Rejected": 0, "Needs Changes": 0}
    daily_map: dict[str, dict] = {}
    business_map: dict[int, dict] = {}
    weighted_score_total = 0.0
    weighted_score_count = 0

    for row in visit_rows:
        visit_date = row[1].isoformat() if row[1] else "--"
        response_count = int(row[5] or 0)
        avg_score = float(row[6]) if row[6] is not None else None
        mandatory_answered = int(row[7] or 0)
        mandatory_total = int(row[8] or 0)
        status_value = row[2] or "Draft"

        visits.append(
            {
                "visit_id": str(row[0]),
                "visit_date": visit_date,
                "status": status_value,
                "business_id": row[3],
                "business_name": row[4],
                "response_count": response_count,
                "avg_score": round(avg_score, 2) if avg_score is not None else None,
                "mandatory_answered_count": mandatory_answered,
                "mandatory_total_count": mandatory_total,
            }
        )

        status_counts[status_value] = status_counts.get(status_value, 0) + 1
        total_responses += response_count

        if avg_score is not None and response_count > 0:
            weighted_score_total += avg_score * response_count
            weighted_score_count += response_count

        if visit_date not in daily_map:
            daily_map[visit_date] = {
                "visit_date": visit_date,
                "visit_count": 0,
                "response_count": 0,
                "weighted_score_sum": 0.0,
                "weighted_score_count": 0,
            }
        daily_map[visit_date]["visit_count"] += 1
        daily_map[visit_date]["response_count"] += response_count
        if avg_score is not None and response_count > 0:
            daily_map[visit_date]["weighted_score_sum"] += avg_score * response_count
            daily_map[visit_date]["weighted_score_count"] += response_count

        if row[3] not in business_map:
            business_map[row[3]] = {
                "business_id": row[3],
                "business_name": row[4],
                "visit_count": 0,
                "response_count": 0,
                "weighted_score_sum": 0.0,
                "weighted_score_count": 0,
                "status_counts": {},
                "latest_visit_date": visit_date,
            }
        business_map[row[3]]["visit_count"] += 1
        business_map[row[3]]["response_count"] += response_count
        business_map[row[3]]["status_counts"][status_value] = business_map[row[3]]["status_counts"].get(status_value, 0) + 1
        if avg_score is not None and response_count > 0:
            business_map[row[3]]["weighted_score_sum"] += avg_score * response_count
            business_map[row[3]]["weighted_score_count"] += response_count

    daily_breakdown = []
    for day in sorted(daily_map.keys(), reverse=True):
        day_item = daily_map[day]
        avg_score = None
        if day_item["weighted_score_count"] > 0:
            avg_score = round(day_item["weighted_score_sum"] / day_item["weighted_score_count"], 2)
        daily_breakdown.append(
            {
                "visit_date": day_item["visit_date"],
                "visit_count": day_item["visit_count"],
                "response_count": day_item["response_count"],
                "avg_score": avg_score,
            }
        )

    business_breakdown = []
    for business in sorted(business_map.values(), key=lambda item: item["business_name"]):
        avg_score = None
        if business["weighted_score_count"] > 0:
            avg_score = round(business["weighted_score_sum"] / business["weighted_score_count"], 2)
        business_breakdown.append(
            {
                "business_id": business["business_id"],
                "business_name": business["business_name"],
                "visit_count": business["visit_count"],
                "response_count": business["response_count"],
                "avg_score": avg_score,
                "latest_visit_date": business["latest_visit_date"],
                "status_counts": business["status_counts"],
            }
        )

    summary_avg_score = None
    if weighted_score_count > 0:
        summary_avg_score = round(weighted_score_total / weighted_score_count, 2)

    return {
        "filters": {
            "survey_type": survey_type or "B2B",
            "business_id": business_id,
            "date_from": date_from,
            "date_to": date_to,
        },
        "summary": {
            "total_visits": len(visits),
            "total_businesses": len(business_breakdown),
            "total_responses": total_responses,
            "average_score": summary_avg_score,
            "status_counts": status_counts,
        },
        "daily_breakdown": daily_breakdown,
        "business_breakdown": business_breakdown,
        "visit_details": visits,
    }


def render_report_html(payload: dict, generated_by: str) -> str:
    summary = payload.get("summary", {})
    filters = payload.get("filters", {})
    daily_rows = payload.get("daily_breakdown", [])
    business_rows = payload.get("business_breakdown", [])
    visit_rows = payload.get("visit_details", [])

    status_counts = summary.get("status_counts", {}) or {}
    status_total = sum(int(value or 0) for value in status_counts.values()) or 1
    status_palette = {
        "Approved": "#16a34a",
        "Pending": "#d97706",
        "Needs Changes": "#ea580c",
        "Rejected": "#dc2626",
        "Draft": "#6b7280",
    }

    status_bars = "".join(
        (
            f"<div class='bar-row'><div class='bar-label'>{name}</div>"
            f"<div class='bar-track'><div class='bar-fill' style='width:{round((int(count or 0) / status_total) * 100, 1)}%;"
            f"background:{status_palette.get(name, '#6b7280')}'></div></div>"
            f"<div class='bar-value'>{int(count or 0)}</div></div>"
        )
        for name, count in status_counts.items()
    )

    top_business = business_rows[:6]
    max_business_responses = max([int(row.get("response_count") or 0) for row in top_business], default=1)
    business_bars = "".join(
        (
            f"<div class='bar-row'><div class='bar-label'>{row.get('business_name') or '--'}</div>"
            f"<div class='bar-track'><div class='bar-fill' style='width:{round((int(row.get('response_count') or 0) / max_business_responses) * 100, 1)}%;background:#2563eb'></div></div>"
            f"<div class='bar-value'>{int(row.get('response_count') or 0)}</div></div>"
        )
        for row in top_business
    )

    daily_table = "".join(
        f"<tr><td>{row['visit_date']}</td><td>{row['visit_count']}</td><td>{row['response_count']}</td><td>{row['avg_score'] if row['avg_score'] is not None else '--'}</td></tr>"
        for row in daily_rows
    )
    business_table = "".join(
        f"<tr><td>{row['business_name']}</td><td>{row['visit_count']}</td><td>{row['response_count']}</td><td>{row['avg_score'] if row['avg_score'] is not None else '--'}</td><td>{row['latest_visit_date']}</td></tr>"
        for row in business_rows
    )
    visit_table = "".join(
        f"<tr><td>{row['visit_date']}</td><td>{row['business_name']}</td><td>{row['status']}</td><td>{row['response_count']}</td><td>{row['mandatory_answered_count']}/{row['mandatory_total_count']}</td><td>{row['avg_score'] if row['avg_score'] is not None else '--'}</td></tr>"
        for row in visit_rows
    )

    return f"""
<!doctype html>
<html>
<head>
  <meta charset=\"utf-8\" />
  <title>CWSCX Survey Report</title>
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 24px; color: #111827; background:#f8fafc; }}
    .page {{ max-width: 1200px; margin: 0 auto; background:#ffffff; border:1px solid #e5e7eb; border-radius: 12px; padding: 24px; }}
    h1 {{ font-size: 24px; margin: 0 0 8px; }}
    h2 {{ font-size: 18px; margin: 28px 0 8px; }}
    p {{ margin: 4px 0; color: #374151; }}
    .summary {{ display: grid; grid-template-columns: repeat(4, minmax(160px, 1fr)); gap: 10px; margin-top: 14px; }}
    .card {{ border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 12px; background: #f9fafb; }}
    .label {{ font-size: 12px; color: #6b7280; }}
    .value {{ font-size: 20px; font-weight: 700; color: #111827; }}
    table {{ width: 100%; border-collapse: collapse; margin-top: 10px; }}
    th, td {{ border: 1px solid #e5e7eb; padding: 8px; font-size: 13px; text-align: left; }}
    th {{ background: #f3f4f6; font-weight: 600; }}
    .explain {{ border-left: 3px solid #d1d5db; padding-left: 10px; margin-top: 8px; }}
    .viz-grid {{ display:grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 12px; }}
    .bar-row {{ display:grid; grid-template-columns: 190px 1fr 52px; align-items:center; gap:8px; margin:6px 0; }}
    .bar-label {{ font-size: 12px; color:#374151; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }}
    .bar-track {{ height: 10px; background:#e5e7eb; border-radius: 999px; overflow: hidden; }}
    .bar-fill {{ height: 100%; border-radius: 999px; }}
    .bar-value {{ font-size: 12px; font-weight: 600; text-align: right; color:#111827; }}
    .legend {{ display:flex; flex-wrap: wrap; gap: 10px; margin-top: 10px; font-size:12px; color:#4b5563; }}
    .legend i {{ display:inline-block; width:10px; height:10px; border-radius: 999px; margin-right:6px; vertical-align: middle; }}
  </style>
</head>
<body>
  <div class=\"page\">
  <h1>CWSCX Survey and Analytics Report</h1>
  <p>Generated by: {generated_by}</p>
  <p>Survey Type: {filters.get('survey_type') or 'B2B'} | Date Range: {filters.get('date_from') or 'Any'} to {filters.get('date_to') or 'Any'} | Business ID: {filters.get('business_id') or 'All'}</p>

  <div class=\"summary\">
    <div class=\"card\"><div class=\"label\">Total Visits</div><div class=\"value\">{summary.get('total_visits', 0)}</div></div>
    <div class=\"card\"><div class=\"label\">Businesses Covered</div><div class=\"value\">{summary.get('total_businesses', 0)}</div></div>
    <div class=\"card\"><div class=\"label\">Responses Captured</div><div class=\"value\">{summary.get('total_responses', 0)}</div></div>
    <div class=\"card\"><div class=\"label\">Average Score</div><div class=\"value\">{summary.get('average_score') if summary.get('average_score') is not None else '--'}</div></div>
  </div>

  <div class=\"explain\">
    <p>This report helps managers review daily survey execution quality, account coverage, and response health. Use the per-day and per-business tables to identify trends and follow-up priorities.</p>
  </div>

  <h2>Visual Highlights</h2>
  <div class=\"viz-grid\">
    <div class=\"card\">
      <div class=\"label\">Visit Status Distribution</div>
      {status_bars or '<p class="label">No status data</p>'}
      <div class=\"legend\">
        <span><i style=\"background:#16a34a\"></i>Approved</span>
        <span><i style=\"background:#d97706\"></i>Pending</span>
        <span><i style=\"background:#ea580c\"></i>Needs Changes</span>
        <span><i style=\"background:#dc2626\"></i>Rejected</span>
        <span><i style=\"background:#6b7280\"></i>Draft</span>
      </div>
    </div>
    <div class=\"card\">
      <div class=\"label\">Top Businesses by Response Volume</div>
      {business_bars or '<p class="label">No business data</p>'}
      <p class=\"label\" style=\"margin-top:8px\">Bars compare response volume across businesses in this report range.</p>
    </div>
  </div>

  <h2>Daily Analytics</h2>
  <table>
    <thead><tr><th>Date</th><th>Visits</th><th>Responses</th><th>Average Score</th></tr></thead>
    <tbody>{daily_table or '<tr><td colspan="4">No data</td></tr>'}</tbody>
  </table>

  <h2>Business Analytics</h2>
  <table>
    <thead><tr><th>Business</th><th>Visits</th><th>Responses</th><th>Average Score</th><th>Latest Visit</th></tr></thead>
    <tbody>{business_table or '<tr><td colspan="5">No data</td></tr>'}</tbody>
  </table>

  <h2>Visit-Level Results</h2>
  <table>
    <thead><tr><th>Date</th><th>Business</th><th>Status</th><th>Responses</th><th>Mandatory Progress</th><th>Average Score</th></tr></thead>
    <tbody>{visit_table or '<tr><td colspan="6">No data</td></tr>'}</tbody>
  </table>
  </div>
</body>
</html>
"""


@router.get("/reports/export")
def export_report(
    survey_type: str | None = "B2B",
    business_id: int | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    download: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    payload = build_report_payload(db, survey_type, business_id, date_from, date_to)
    report_html = render_report_html(payload, getattr(current_user, "name", "Unknown User"))
    filename = "cwscx-survey-report.html"
    if download:
        return HTMLResponse(
            content=report_html,
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    return {
        "filename": filename,
        "report_html": report_html,
        "report": payload,
    }


@router.post("/reports/email")
def email_report(
    request: ReportEmailRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    smtp_host = os.getenv("SMTP_HOST", "").strip()
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USERNAME", "").strip()
    smtp_password = os.getenv("SMTP_PASSWORD", "").strip()
    smtp_from = os.getenv("SMTP_FROM", smtp_user).strip()
    smtp_use_tls = os.getenv("SMTP_USE_TLS", "true").strip().lower() in {"1", "true", "yes"}

    if not smtp_host or not smtp_from:
        raise HTTPException(status_code=400, detail="SMTP is not configured. Set SMTP_HOST and SMTP_FROM.")

    payload = build_report_payload(db, request.survey_type, request.business_id, request.date_from, request.date_to)
    report_html = render_report_html(payload, getattr(current_user, "name", "Unknown User"))

    subject = request.subject or "CWSCX Survey and Analytics Report"
    message = MIMEMultipart("alternative")
    message["Subject"] = subject
    message["From"] = smtp_from
    message["To"] = ", ".join(request.to)

    intro_text = request.message or "Please find the latest survey and analytics report below."
    text_part = MIMEText(f"{intro_text}\n\nThis email contains an HTML report. If you cannot view it, please open in an HTML-enabled email client.", "plain")
    html_part = MIMEText(f"<p>{intro_text}</p>{report_html}", "html")
    message.attach(text_part)
    message.attach(html_part)

    try:
        with smtplib.SMTP(smtp_host, smtp_port, timeout=15) as server:
            if smtp_use_tls:
                server.starttls()
            if smtp_user and smtp_password:
                server.login(smtp_user, smtp_password)
            server.sendmail(smtp_from, list(request.to), message.as_string())
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to send report email: {exc}")

    return {
        "status": "sent",
        "recipients": request.to,
        "subject": subject,
        "summary": payload.get("summary", {}),
    }


@router.get("/drafts")
def get_draft_visits(db: Session = Depends(get_db)):
    """Get draft visits for dashboard."""
    try:
        ensure_visit_submission_columns(db)
        has_visit_survey_type = has_column(db, "visits", "survey_type_id")
        has_question_survey_type = has_column(db, "questions", "survey_type_id")
        mandatory_total_expr = "(SELECT COUNT(*) FROM questions q2 WHERE q2.is_mandatory = true)"
        if has_visit_survey_type and has_question_survey_type:
            mandatory_total_expr = "(SELECT COUNT(*) FROM questions q2 WHERE q2.is_mandatory = true AND q2.survey_type_id = v.survey_type_id)"

        response_table = get_response_table(db)
        response_join = ""
        if response_table:
            response_join = f"LEFT JOIN {response_table} r ON v.id = r.visit_id"

        rows = db.execute(text(
            f"""
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
                v.submitted_by_name,
                v.submitted_by_email,
                v.submitted_at,
                COUNT(r.id) as response_count,
                COUNT(CASE WHEN q.is_mandatory = true AND r.id IS NOT NULL THEN 1 END) as mandatory_answered_count,
                {mandatory_total_expr} as mandatory_total_count
            FROM visits v
            JOIN businesses b ON v.business_id = b.id
            LEFT JOIN users u ON v.representative_id = u.id
            {response_join}
            LEFT JOIN questions q ON r.question_id = q.id
            WHERE v.status = 'Draft'
            GROUP BY v.id, v.business_id, b.name, v.representative_id, u.name, v.visit_date, v.visit_type, v.status, b.priority_level, v.submitted_by_name, v.submitted_by_email, v.submitted_at
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
                "submitted_by_name": row[9],
                "submitted_by_email": row[10],
                "submitted_at": row[11].isoformat() if row[11] else None,
                "response_count": row[12],
                "mandatory_answered_count": row[13],
                "mandatory_total_count": row[14],
                "is_started": row[12] > 0,
                "is_completed": False
            }
            for row in rows
        ]
        
    except Exception as e:
        print(f"Error fetching draft visits: {e}")
        return []


@router.get("/pending")
def get_pending_visits(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _manager_access: bool = Depends(require_role("Manager"))
):
    """Get pending visits for dashboard - requires Manager role."""
    try:
        ensure_visit_submission_columns(db)
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
                b.priority_level as business_priority,
                v.submitted_by_name,
                v.submitted_by_email,
                v.submitted_at
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
                "submitted_by_name": row[8],
                "submitted_by_email": row[9],
                "submitted_at": row[10].isoformat() if row[10] else None,
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
def update_visit_draft(visit_id: str, visit_data: dict, db: Session = Depends(get_db)):
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
                b.priority_level as business_priority,
                v.submitted_by_name,
                v.submitted_by_email,
                v.submitted_at
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
def delete_draft_visit(visit_id: str, db: Session = Depends(get_db)):
    """Delete a draft (planned) visit and its responses."""
    try:
        response_table = get_response_table(db)
        visit_row = db.execute(text(
            "SELECT status FROM visits WHERE id = :visit_id"
        ), {"visit_id": visit_id}).fetchone()

        if not visit_row:
            raise HTTPException(status_code=404, detail="Visit not found")

        status_value = visit_row[0]
        if status_value != "Draft":
            raise HTTPException(status_code=400, detail="Only Draft visits can be deleted")

        if response_table:
            db.execute(text(
                f"DELETE FROM {response_table} WHERE visit_id = :visit_id"
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
def create_response(visit_id: str, response_data: dict, db: Session = Depends(get_db)):
    """Create a response for a visit."""
    try:
        response_table = get_response_table(db)
        if response_table == "b2b_visit_responses":
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
        elif response_table == "responses":
            actions = response_data.get("actions", []) or []
            primary_action = actions[0] if actions else {}
            result = db.execute(text(
                """
                INSERT INTO responses
                (visit_id, question_id, score, answer_text, verbatim, action_required, action_owner, action_timeframe, action_support_needed)
                VALUES (:visit_id, :question_id, :score, :answer_text, :verbatim, :action_required, :action_owner, :action_timeframe, :action_support_needed)
                RETURNING id, question_id, score, answer_text, verbatim
                """
            ), {
                "visit_id": visit_id,
                "question_id": response_data.get("question_id"),
                "score": response_data.get("score"),
                "answer_text": response_data.get("answer_text"),
                "verbatim": response_data.get("verbatim"),
                "action_required": primary_action.get("action_required"),
                "action_owner": primary_action.get("action_owner"),
                "action_timeframe": primary_action.get("action_timeframe"),
                "action_support_needed": primary_action.get("action_support_needed"),
            })
        else:
            raise HTTPException(status_code=500, detail="No response table found")
        
        # Commit the transaction to save changes
        db.commit()
        
        # Get the inserted response
        row = result.fetchone()
        payload = {
            "response_id": str(row[0]),
            "question_id": row[1],
            "visit_id": visit_id,
            "score": row[2],
            "answer_text": row[3],
            "verbatim": row[4],
        }
        if response_table == "b2b_visit_responses":
            payload["actions"] = json.loads(row[5]) if row[5] else []
        else:
            payload["actions"] = response_data.get("actions", []) or []
        return payload
    except Exception as e:
        print(f"Error creating response: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to create response")


@router.put("/{visit_id}/responses/{response_id}")
def update_response(visit_id: str, response_id: str, response_data: dict, db: Session = Depends(get_db)):
    """Update a response for a visit."""
    try:
        response_table = get_response_table(db)
        if response_table == "b2b_visit_responses":
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
        elif response_table == "responses":
            actions = response_data.get("actions", []) or []
            primary_action = actions[0] if actions else {}
            result = db.execute(text(
                """
                UPDATE responses
                SET question_id = :question_id,
                    score = :score,
                    answer_text = :answer_text,
                    verbatim = :verbatim,
                    action_required = :action_required,
                    action_owner = :action_owner,
                    action_timeframe = :action_timeframe,
                    action_support_needed = :action_support_needed
                WHERE id = :response_id AND visit_id = :visit_id
                RETURNING id, question_id, score, answer_text, verbatim
                """
            ), {
                "response_id": response_id,
                "visit_id": visit_id,
                "question_id": response_data.get("question_id"),
                "score": response_data.get("score"),
                "answer_text": response_data.get("answer_text"),
                "verbatim": response_data.get("verbatim"),
                "action_required": primary_action.get("action_required"),
                "action_owner": primary_action.get("action_owner"),
                "action_timeframe": primary_action.get("action_timeframe"),
                "action_support_needed": primary_action.get("action_support_needed"),
            })
        else:
            raise HTTPException(status_code=500, detail="No response table found")
        
        # Commit the transaction to save changes
        db.commit()
        
        # Get the updated response
        row = result.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Response not found")
            
        payload = {
            "response_id": str(row[0]),
            "question_id": row[1],
            "visit_id": visit_id,
            "score": row[2],
            "answer_text": row[3],
            "verbatim": row[4],
        }
        if response_table == "b2b_visit_responses":
            payload["actions"] = json.loads(row[5]) if row[5] else []
        else:
            payload["actions"] = response_data.get("actions", []) or []
        return payload
    except Exception as e:
        print(f"Error updating response: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to update response")


@router.put("/{visit_id}/submit")
def submit_visit(
    visit_id: str,
    submit_data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Submit a visit for review."""
    try:
        # Update visit status to Pending
        has_submitted_by_name = has_column(db, "visits", "submitted_by_name")
        has_submitted_by_email = has_column(db, "visits", "submitted_by_email")
        has_submitted_at = has_column(db, "visits", "submitted_at")

        update_fields = ["status = 'Pending'"]
        params = {"visit_id": visit_id}

        if has_submitted_at:
            update_fields.append("submitted_at = NOW()")
        if has_submitted_by_name:
            update_fields.append("submitted_by_name = :submitted_by_name")
            params["submitted_by_name"] = getattr(current_user, "name", None)
        if has_submitted_by_email:
            update_fields.append("submitted_by_email = :submitted_by_email")
            params["submitted_by_email"] = getattr(current_user, "email", None)

        db.execute(text(
            f"""
            UPDATE visits
            SET {', '.join(update_fields)}
            WHERE id = :visit_id
            """
        ), params)
        
        # Commit the transaction to save changes
        db.commit()
        
        return {
            "visit_id": visit_id,
            "status": "Pending",
            "submitted_by_name": getattr(current_user, "name", None),
            "submitted_by_email": getattr(current_user, "email", None),
            "message": "Visit submitted for review"
        }
    except Exception as e:
        print(f"Error submitting visit: {e}")
        return {"detail": "Failed to submit visit"}


@router.put("/{visit_id}/approve")
def approve_visit(visit_id: str, approval_data: dict, db: Session = Depends(get_db)):
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
def reject_visit(visit_id: str, rejection_data: dict, db: Session = Depends(get_db)):
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
def request_changes(visit_id: str, changes_data: dict, db: Session = Depends(get_db)):
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
def get_visit_detail(
    visit_id: str, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get individual visit detail.

    This endpoint is used by both the dashboard and the survey frontend to load
    previously-saved answers.
    """
    try:
        ensure_visit_submission_columns(db)
        print(f"DEBUG: Getting visit detail for visit_id: {visit_id}")
        has_question_number = has_column(db, "questions", "question_number")
        has_order_index = has_column(db, "questions", "order_index")
        if has_question_number:
            question_order_col = "q.question_number"
        elif has_order_index:
            question_order_col = "q.order_index"
        else:
            question_order_col = "q.id"
        
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
                b.priority_level as business_priority,
                v.submitted_by_name,
                v.submitted_by_email,
                v.submitted_at
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
        
        response_table = get_response_table(db)
        if not response_table:
            raise HTTPException(status_code=500, detail="No response table found")

        # Get responses for this visit with correct question numbers
        response_rows = db.execute(text(
            f"""
            SELECT 
                r.id,
                r.question_id,
                r.score,
                r.answer_text,
                r.verbatim,
                {"r.actions" if response_table == "b2b_visit_responses" else "NULL"} as actions,
                {"r.created_at" if response_table == "b2b_visit_responses" else "NULL"} as created_at,
                {"r.updated_at" if response_table == "b2b_visit_responses" else "NULL"} as updated_at,
                {question_order_col} as question_number,
                q.question_text,
                q.input_type,
                q.category
            FROM {response_table} r
            LEFT JOIN questions q ON r.question_id = q.id
            WHERE r.visit_id = :visit_id
            ORDER BY {question_order_col}
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
                "category": row[11] or "Uncategorized",
                "score": row[2],
                "answer_text": row[3],
                "verbatim": row[4],
                "actions": actions,
                "created_at": row[6].isoformat() if row[6] else None,
                "updated_at": row[7].isoformat() if row[7] else None
            })
        
        print(f"DEBUG: Formatted {len(responses)} responses")
        
        # Calculate mandatory answered/total counts, scoped to visit's survey_type_id
        has_visit_survey_type = has_column(db, "visits", "survey_type_id")
        has_question_survey_type = has_column(db, "questions", "survey_type_id")
        if has_visit_survey_type and has_question_survey_type:
            mandatory_counts_row = db.execute(
                text(
                    f"""
                    SELECT
                        COALESCE(SUM(CASE WHEN q.is_mandatory = true AND r.id IS NOT NULL THEN 1 ELSE 0 END), 0) AS mandatory_answered_count,
                        COALESCE(SUM(CASE WHEN q.is_mandatory = true THEN 1 ELSE 0 END), 0) AS mandatory_total_count
                    FROM questions q
                    JOIN visits v ON v.survey_type_id = q.survey_type_id
                    LEFT JOIN {response_table} r
                        ON r.visit_id = v.id
                        AND r.question_id = q.id
                    WHERE v.id = :visit_id
                    """
                ),
                {"visit_id": visit_id},
            ).fetchone()
        else:
            mandatory_counts_row = db.execute(
                text(
                    f"""
                    SELECT
                        COALESCE(SUM(CASE WHEN q.is_mandatory = true AND r.id IS NOT NULL THEN 1 ELSE 0 END), 0) AS mandatory_answered_count,
                        COALESCE(SUM(CASE WHEN q.is_mandatory = true THEN 1 ELSE 0 END), 0) AS mandatory_total_count
                    FROM questions q
                    LEFT JOIN {response_table} r
                        ON r.question_id = q.id
                        AND r.visit_id = :visit_id
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
            "submitted_by_name": visit_row[9],
            "submitted_by_email": visit_row[10],
            "submitted_at": visit_row[11].isoformat() if visit_row[11] else None,
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
