"""
Dashboard visits compatibility endpoint - DIFFERENT PREFIX
"""

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Dict, Optional
import base64
import json
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pydantic import BaseModel, EmailStr
from ..core.database import get_db
from ..core.auth.dependencies import get_current_user, require_role
from ..core.models import User
from ..routers.analytics import get_comprehensive_analytics, get_question_averages, get_yes_no_question_analytics

router = APIRouter(prefix="/dashboard-visits", tags=["dashboard-visits"])

_visit_signature_columns_checked = False
_visit_metadata_columns_checked = False
_visit_edit_audit_columns_checked = False


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
ACTION_STATUS_OPTIONS = {"Outstanding", "Completed"}


class ReportEmailRequest(BaseModel):
    to: List[EmailStr]
    subject: str | None = None
    report_type: str | None = "lifetime"
    survey_type: str | None = "B2B"
    business_id: int | None = None
    visit_id: str | None = None
    report_date: str | None = None
    date_from: str | None = None
    date_to: str | None = None
    message: str | None = None


class ActionStatusUpdateRequest(BaseModel):
    response_id: int
    action_index: int
    status: str


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


def ensure_visit_metadata_columns(db: Session) -> None:
    global _visit_metadata_columns_checked
    if _visit_metadata_columns_checked:
        return
    if not has_table(db, "visits"):
        return
    if not has_column(db, "visits", "account_executive_name"):
        db.execute(text("ALTER TABLE visits ADD COLUMN IF NOT EXISTS account_executive_name VARCHAR(255)"))
    _visit_metadata_columns_checked = True


def ensure_visit_edit_audit_columns(db: Session) -> None:
    global _visit_edit_audit_columns_checked
    if _visit_edit_audit_columns_checked:
        return
    if not has_table(db, "visits"):
        return
    if not has_column(db, "visits", "edited_by_name"):
        db.execute(text("ALTER TABLE visits ADD COLUMN IF NOT EXISTS edited_by_name VARCHAR(255)"))
    if not has_column(db, "visits", "edited_by_email"):
        db.execute(text("ALTER TABLE visits ADD COLUMN IF NOT EXISTS edited_by_email VARCHAR(255)"))
    if not has_column(db, "visits", "edited_at"):
        db.execute(text("ALTER TABLE visits ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ"))
    _visit_edit_audit_columns_checked = True


def mark_visit_edited(db: Session, visit_id: str, current_user: object | None) -> None:
    ensure_visit_edit_audit_columns(db)
    if current_user is None:
        return
    db.execute(
        text(
            """
            UPDATE visits
            SET edited_by_name = :edited_by_name,
                edited_by_email = :edited_by_email,
                edited_at = NOW()
            WHERE id = :visit_id
            """
        ),
        {
            "visit_id": visit_id,
            "edited_by_name": getattr(current_user, "name", None),
            "edited_by_email": getattr(current_user, "email", None) or getattr(current_user, "preferred_username", None),
        },
    )


def normalize_team_member_names(values: list | None) -> list[str]:
    normalized: list[str] = []
    for item in values or []:
        if isinstance(item, dict):
            name = str(item.get("name") or "").strip()
        else:
            name = str(item or "").strip()
        if not name:
            continue
        if name not in normalized:
            normalized.append(name[:200])
    return normalized


def sync_visit_team_members(db: Session, visit_id: str, team_member_names: list[str] | None) -> None:
    if not has_table(db, "meeting_attendees"):
        return
    db.execute(
        text("DELETE FROM meeting_attendees WHERE visit_id = :visit_id AND role = 'Team Member'"),
        {"visit_id": visit_id},
    )
    for name in normalize_team_member_names(team_member_names):
        db.execute(
            text(
                """
                INSERT INTO meeting_attendees (visit_id, name, role)
                VALUES (:visit_id, :name, 'Team Member')
                """
            ),
            {"visit_id": visit_id, "name": name},
        )


def fetch_visit_team_members(db: Session, visit_id: str) -> list[str]:
    if not has_table(db, "meeting_attendees"):
        return []
    rows = db.execute(
        text(
            """
            SELECT name
            FROM meeting_attendees
            WHERE visit_id = :visit_id AND role = 'Team Member'
            ORDER BY id
            """
        ),
        {"visit_id": visit_id},
    ).fetchall()
    return [str(row[0]).strip() for row in rows if row and row[0]]


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
    action_status: str | None,
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
                r.id as response_id,
                q.id as question_id,
                q.question_text,
                r.score,
                r.answer_text,
                action_item.ordinality - 1 as action_index,
                action_item.value->>'action_required' as action_required,
                action_item.value->>'action_owner' as action_owner,
                action_item.value->>'action_timeframe' as action_timeframe,
                action_item.value->>'action_support_needed' as action_support_needed,
                COALESCE(NULLIF(action_item.value->>'action_status', ''), 'Outstanding') as action_status,
                COALESCE(st.name, :fallback_survey_type) as survey_type
            FROM b2b_visit_responses r
            JOIN visits v ON v.id = r.visit_id
            LEFT JOIN businesses b ON b.id = v.business_id
            LEFT JOIN questions q ON q.id = r.question_id
            LEFT JOIN survey_types st ON st.id = v.survey_type_id
            CROSS JOIN LATERAL jsonb_array_elements(COALESCE(r.actions, '[]'::jsonb)) WITH ORDINALITY action_item(value, ordinality)
            WHERE
                {where_sql}
                AND (
                    COALESCE(action_item.value->>'action_required', '') <> ''
                    OR COALESCE(action_item.value->>'action_owner', '') <> ''
                    OR COALESCE(action_item.value->>'action_timeframe', '') <> ''
                    OR COALESCE(action_item.value->>'action_support_needed', '') <> ''
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
                r.id as response_id,
                q.id as question_id,
                q.question_text,
                0 as action_index,
                r.action_required,
                r.action_owner,
                r.action_timeframe,
                r.action_support_needed,
                'Outstanding' as action_status,
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
        response_id = row.get("response_id")
        if response_id is None:
            continue
        item = {
            "visit_id": str(row["visit_id"]),
            "visit_date": row["visit_date"].isoformat() if row["visit_date"] else None,
            "status": row["status"],
            "business_id": row["business_id"],
            "business_name": row["business_name"],
            "survey_type": row["survey_type"],
            "response_id": int(response_id),
            "question_id": row["question_id"],
            "question_text": row["question_text"],
            "question_score": row.get("score"),
            "question_answer": row.get("answer_text"),
            "action_index": int(row.get("action_index") or 0),
            "action_required": row["action_required"] or "",
            "action_owner": row["action_owner"] or "",
            "action_timeframe": row["action_timeframe"] or "",
            "action_support_needed": row["action_support_needed"] or "",
            "action_status": row.get("action_status") or "Outstanding",
        }

        if lead_owner and lead_owner.strip().lower() not in item["action_owner"].lower():
            continue
        if support and support.strip().lower() not in item["action_support_needed"].lower():
            continue
        if timeline and item["action_timeframe"] != timeline:
            continue
        if action_status and item["action_status"] != action_status:
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
        ensure_visit_metadata_columns(db)
        # Validate required fields
        business_id = visit_data.get("business_id")
        visit_date = visit_data.get("visit_date")
        survey_type_id = visit_data.get("survey_type_id")
        survey_type = visit_data.get("survey_type")
        account_executive_name = str(visit_data.get("account_executive_name") or "").strip() or None
        team_member_names = normalize_team_member_names(visit_data.get("team_member_names") or visit_data.get("meeting_attendees") or [])
        
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
                (id, business_id, representative_id, created_by, visit_date, visit_type, status, survey_type_id, account_executive_name)
                VALUES (gen_random_uuid(), :business_id, :rep_id, :created_by, :visit_date, :visit_type, 'Draft', :survey_type_id, :account_executive_name)
                RETURNING id
                """
            ), {
                "business_id": business_id,
                "rep_id": representative_id,
                "created_by": actor_user_id,
                "visit_date": visit_date,
                "visit_type": visit_data.get("visit_type"),
                "survey_type_id": survey_type_id,
                "account_executive_name": account_executive_name,
            }).scalar()
        else:
            created_visit_id = db.execute(text(
                """
                INSERT INTO visits
                (id, business_id, representative_id, created_by, visit_date, visit_type, status, account_executive_name)
                VALUES (gen_random_uuid(), :business_id, :rep_id, :created_by, :visit_date, :visit_type, 'Draft', :account_executive_name)
                RETURNING id
                """
            ), {
                "business_id": business_id,
                "rep_id": representative_id,
                "created_by": actor_user_id,
                "visit_date": visit_date,
                "visit_type": visit_data.get("visit_type"),
                "account_executive_name": account_executive_name,
            }).scalar()

        sync_visit_team_members(db, str(created_visit_id), team_member_names)

        # Commit the transaction
        db.commit()

        return {
            "visit_id": str(created_visit_id),
            "status": "Draft",
            "message": "Visit created successfully",
            "account_executive_name": account_executive_name,
            "team_member_names": team_member_names,
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
        ensure_visit_metadata_columns(db)
        ensure_visit_edit_audit_columns(db)
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
                v.account_executive_name,
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
            GROUP BY v.id, v.business_id, b.name, v.representative_id, u.name, v.visit_date, v.visit_type, v.status, b.priority_level, v.account_executive_name, v.submitted_by_name, v.submitted_by_email, v.submitted_at
            ORDER BY v.visit_date DESC
        """
        
        # Execute query
        result = db.execute(text(query), params)
        
        # Fetch visits
        visits = []
        for row in result:
            visit_id = row[0]
            visits.append({
                "id": visit_id,
                "business_id": row[1],
                "business_name": row[2],
                "representative_id": row[3],
                "representative_name": row[4],
                "visit_date": row[5].isoformat() if row[5] else None,
                "visit_type": row[6],
                "status": row[7],
                "business_priority": row[8],
                "account_executive_name": row[9],
                "team_member_names": fetch_visit_team_members(db, str(visit_id)),
                "submitted_by_name": row[10],
                "submitted_by_email": row[11],
                "submitted_at": row[12].isoformat() if row[12] else None,
                "response_count": row[13],
                "mandatory_answered_count": row[14] if len(row) > 14 else 0,
                "mandatory_total_count": row[15] if len(row) > 15 else 24,
                "is_started": row[13] > 0,
                "is_completed": row[17] if len(row) > 17 else False
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
    action_status: str | None = None,
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
        if action_status and action_status not in ACTION_STATUS_OPTIONS:
            raise HTTPException(status_code=400, detail="Invalid action_status. Use Outstanding or Completed")

        items = fetch_dashboard_actions(
            db=db,
            survey_type=survey_type,
            lead_owner=lead_owner,
            support=support,
            timeline=timeline,
            action_status=action_status,
            business_id=business_id,
        )

        summary_by_business: dict[str, int] = {}
        summary_by_survey: dict[str, int] = {}
        summary_by_status: dict[str, int] = {}
        for item in items:
            business_name = item.get("business_name") or "Unknown"
            survey_name = item.get("survey_type") or "Unknown"
            status_name = item.get("action_status") or "Outstanding"
            summary_by_business[business_name] = summary_by_business.get(business_name, 0) + 1
            summary_by_survey[survey_name] = summary_by_survey.get(survey_name, 0) + 1
            summary_by_status[status_name] = summary_by_status.get(status_name, 0) + 1

        return {
            "items": items,
            "filters": {
                "survey_type": survey_type,
                "lead_owner": lead_owner,
                "support": support,
                "timeline": timeline,
                "action_status": action_status,
                "business_id": business_id,
            },
            "summary": {
                "total_actions": len(items),
                "by_business": summary_by_business,
                "by_survey": summary_by_survey,
                "by_status": summary_by_status,
            },
            "timeline_options": sorted(ACTION_TIMEFRAME_OPTIONS),
            "status_options": sorted(ACTION_STATUS_OPTIONS),
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching actions dashboard: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch actions dashboard: {str(e)}")


@router.put("/actions/status")
def update_action_status(
    request: ActionStatusUpdateRequest,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    """Update action point status (Outstanding/Completed) for JSON-based action items."""
    try:
        if request.status not in ACTION_STATUS_OPTIONS:
            raise HTTPException(status_code=400, detail="Invalid status. Use Outstanding or Completed")

        response_table = get_response_table(db)
        if response_table != "b2b_visit_responses":
            raise HTTPException(status_code=400, detail="Action status updates are supported for B2B responses only")

        row = db.execute(
            text("SELECT actions FROM b2b_visit_responses WHERE id = :response_id"),
            {"response_id": request.response_id},
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Response not found")

        actions = row[0] or []
        if isinstance(actions, str):
            try:
                actions = json.loads(actions)
            except Exception:
                actions = []
        if not isinstance(actions, list):
            actions = []

        if request.action_index < 0 or request.action_index >= len(actions):
            raise HTTPException(status_code=400, detail="action_index is out of range")

        selected = actions[request.action_index]
        if not isinstance(selected, dict):
            selected = {}
        selected["action_status"] = request.status
        actions[request.action_index] = selected

        db.execute(
            text("UPDATE b2b_visit_responses SET actions = CAST(:actions AS jsonb) WHERE id = :response_id"),
            {"response_id": request.response_id, "actions": json.dumps(actions)},
        )
        db.commit()

        return {
            "status": "updated",
            "response_id": request.response_id,
            "action_index": request.action_index,
            "action_status": request.status,
        }
    except HTTPException:
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update action status: {exc}")


@router.get("/reports/surveys")
def get_report_surveys_for_business(
    business_id: int,
    survey_type: str | None = "B2B",
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    """List business surveys and whether each is report-eligible."""
    try:
        has_visit_survey_type = has_column(db, "visits", "survey_type_id")
        resolved_survey_type_id = resolve_survey_type_id(db, survey_type, None)

        where_clauses = ["v.business_id = :business_id"]
        params: dict[str, object] = {"business_id": business_id}
        if resolved_survey_type_id and has_visit_survey_type:
            where_clauses.append("v.survey_type_id = :survey_type_id")
            params["survey_type_id"] = resolved_survey_type_id

        rows = db.execute(
            text(
                f"""
                SELECT
                    v.id,
                    v.visit_date,
                    v.status,
                    b.name as business_name,
                    COALESCE(st.name, :fallback_survey_type) as survey_type_name
                FROM visits v
                JOIN businesses b ON b.id = v.business_id
                LEFT JOIN survey_types st ON st.id = v.survey_type_id
                WHERE {' AND '.join(where_clauses)}
                ORDER BY v.visit_date DESC, v.id DESC
                """
            ),
            {**params, "fallback_survey_type": survey_type or "B2B"},
        ).fetchall()

        eligible_statuses = {"Approved", "Completed"}
        eligible: list[dict] = []
        ineligible: list[dict] = []

        for row in rows:
            visit = {
                "visit_id": str(row[0]),
                "visit_date": row[1].isoformat() if row[1] else None,
                "status": row[2] or "Draft",
                "business_name": row[3],
                "survey_type": row[4],
            }
            if visit["status"] in eligible_statuses:
                eligible.append(visit)
            else:
                visit["reason"] = "Survey is not completed/approved yet"
                ineligible.append(visit)

        return {
            "business_id": business_id,
            "survey_type": survey_type or "B2B",
            "eligible": eligible,
            "ineligible": ineligible,
            "eligible_statuses": sorted(eligible_statuses),
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to load report-eligible surveys: {exc}")


def _fetch_single_visit_scores(db: Session, visit_id: str, response_table: str) -> dict:
    """Fetch raw NPS and CSAT scores for a single visit."""
    nps_row = db.execute(
        text(
            f"""
            SELECT r.score, q.question_text
            FROM {response_table} r
            JOIN questions q ON r.question_id = q.id
            WHERE r.visit_id = :visit_id AND q.is_nps = true AND r.score IS NOT NULL
            LIMIT 1
            """
        ),
        {"visit_id": visit_id},
    ).mappings().one_or_none()

    csat_row = db.execute(
        text(
            f"""
            SELECT r.score, q.question_text
            FROM {response_table} r
            JOIN questions q ON r.question_id = q.id
            WHERE r.visit_id = :visit_id
              AND (lower(q.question_text) LIKE '%satisfaction%' OR lower(q.question_text) LIKE '%csat%')
              AND r.score IS NOT NULL
            LIMIT 1
            """
        ),
        {"visit_id": visit_id},
    ).mappings().one_or_none()

    return {
        "nps_raw_score": int(nps_row["score"]) if nps_row else None,
        "nps_question_text": nps_row["question_text"] if nps_row else None,
        "csat_raw_score": int(csat_row["score"]) if csat_row else None,
        "csat_question_text": csat_row["question_text"] if csat_row else None,
    }


def _fetch_pending_visits(db: Session, survey_type: str | None) -> list[dict]:
    """Fetch visits with Pending status, grouped by business."""
    has_survey_type = has_column(db, "visits", "survey_type_id")
    where = ["v.status = 'Pending'"]
    params = {}
    if has_survey_type and survey_type:
        where.append("st.name = :survey_type")
        params["survey_type"] = survey_type
    where_sql = " AND ".join(where)
    join_sql = "LEFT JOIN survey_types st ON st.id = v.survey_type_id" if has_survey_type else ""
    rows = db.execute(
        text(
            f"""
            SELECT v.id, v.visit_date, v.status, b.name as business_name
            FROM visits v
            LEFT JOIN businesses b ON b.id = v.business_id
            {join_sql}
            WHERE {where_sql}
            ORDER BY b.name, v.visit_date
            """
        ),
        params,
    ).mappings().all()
    return [
        {
            "visit_id": str(row["id"]),
            "visit_date": row["visit_date"].isoformat() if row["visit_date"] else None,
            "status": row["status"],
            "business_name": row["business_name"] or "--",
        }
        for row in rows
    ]


def build_report_payload(
    db: Session,
    report_type: str | None,
    survey_type: str | None,
    business_id: int | None,
    visit_id: str | None,
    report_date: str | None,
    date_from: str | None,
    date_to: str | None,
) -> dict:
    response_table = get_response_table(db)
    if not response_table:
        raise HTTPException(status_code=500, detail="No response table found")

    has_visit_survey_type = has_column(db, "visits", "survey_type_id")
    resolved_survey_type_id = resolve_survey_type_id(db, survey_type, None)
    normalized_report_type = (report_type or "lifetime").strip().lower()
    if normalized_report_type not in {"survey", "date", "lifetime", "action_points"}:
        normalized_report_type = "lifetime"

    effective_business_id = business_id
    effective_date_from = date_from
    effective_date_to = date_to
    effective_visit_id = visit_id

    if normalized_report_type == "survey":
        if not effective_visit_id:
            raise HTTPException(status_code=400, detail="visit_id is required for survey report")
    elif normalized_report_type == "date":
        if report_date:
            effective_date_from = report_date
            effective_date_to = report_date
        elif not (effective_date_from or effective_date_to):
            raise HTTPException(status_code=400, detail="report_date or date range is required for date report")

    where_parts = []
    params: dict = {}
    if effective_business_id is not None:
        where_parts.append("v.business_id = :business_id")
        params["business_id"] = effective_business_id
    if effective_date_from:
        where_parts.append("v.visit_date >= :date_from")
        params["date_from"] = effective_date_from
    if effective_date_to:
        where_parts.append("v.visit_date <= :date_to")
        params["date_to"] = effective_date_to
    if effective_visit_id:
        where_parts.append("v.id = :visit_id")
        params["visit_id"] = effective_visit_id
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

    report_survey_type = survey_type or "B2B"
    filtered_business_ids = str(effective_business_id) if effective_business_id is not None else None
    include_overall_comparison = normalized_report_type == "lifetime"

    try:
        filtered_analytics = get_comprehensive_analytics(
            survey_type=report_survey_type,
            business_ids=filtered_business_ids,
            date_from=effective_date_from,
            date_to=effective_date_to,
            db=db,
        )
    except Exception:
        filtered_analytics = {}

    overall_analytics = {}
    if include_overall_comparison:
        try:
            overall_analytics = get_comprehensive_analytics(
                survey_type=report_survey_type,
                business_ids=None,
                date_from=None,
                date_to=None,
                db=db,
            )
        except Exception:
            overall_analytics = {}

    try:
        filtered_yes_no = get_yes_no_question_analytics(
            survey_type=report_survey_type,
            business_ids=filtered_business_ids,
            date_from=effective_date_from,
            date_to=effective_date_to,
            db=db,
        )
    except Exception:
        filtered_yes_no = {"items": []}

    overall_yes_no = {"items": []}
    if include_overall_comparison:
        try:
            overall_yes_no = get_yes_no_question_analytics(
                survey_type=report_survey_type,
                business_ids=None,
                date_from=None,
                date_to=None,
                db=db,
            )
        except Exception:
            overall_yes_no = {"items": []}

    try:
        selected_question_averages = get_question_averages(
            survey_type=report_survey_type,
            business_ids=filtered_business_ids,
            date_from=effective_date_from,
            date_to=effective_date_to,
            db=db,
        )
    except Exception:
        selected_question_averages = {"items": []}

    overall_question_averages = {"items": []}
    if include_overall_comparison:
        try:
            overall_question_averages = get_question_averages(
                survey_type=report_survey_type,
                business_ids=None,
                date_from=None,
                date_to=None,
                db=db,
            )
        except Exception:
            overall_question_averages = {"items": []}

    filtered_yes_no_items = list(filtered_yes_no.get("items") or [])
    overall_yes_no_by_question = {int(item.get("question_number") or item.get("question_id") or 0): item for item in list(overall_yes_no.get("items") or [])}
    priority_yes_no_questions = {4, 6, 9, 16}
    focused_yes_no = [
        item for item in filtered_yes_no_items if int(item.get("question_number") or item.get("question_id") or 0) in priority_yes_no_questions
    ]
    if not focused_yes_no:
        focused_yes_no = filtered_yes_no_items[:6]

    yes_no_comparison = []
    for item in focused_yes_no:
        qn = int(item.get("question_number") or item.get("question_id") or 0)
        overall_item = overall_yes_no_by_question.get(qn, {})
        yes_no_comparison.append(
            {
                "question_number": qn,
                "question_text": item.get("question_text") or "--",
                "filtered_yes_percent": float(item.get("yes_percent") or 0.0),
                "filtered_no_percent": float(item.get("no_percent") or 0.0),
                "overall_yes_percent": float(overall_item.get("yes_percent") or 0.0) if include_overall_comparison else None,
                "overall_no_percent": float(overall_item.get("no_percent") or 0.0) if include_overall_comparison else None,
            }
        )

    def category_rollup(items: list[dict]) -> tuple[list[dict], dict[str, list[dict]]]:
        category_totals: dict[str, dict] = {}
        category_questions: dict[str, list[dict]] = {}

        for item in items:
            category = str(item.get("category") or "Uncategorized").strip() or "Uncategorized"
            average_score = float(item.get("average_score") or 0.0)
            response_count = int(item.get("response_count") or 0)

            if category not in category_totals:
                category_totals[category] = {
                    "weighted_sum": 0.0,
                    "response_count": 0,
                    "question_count": 0,
                }
            category_totals[category]["weighted_sum"] += average_score * max(response_count, 1)
            category_totals[category]["response_count"] += max(response_count, 1)
            category_totals[category]["question_count"] += 1

            if category not in category_questions:
                category_questions[category] = []
            category_questions[category].append(
                {
                    "question_number": item.get("question_number"),
                    "question_text": item.get("question_text"),
                    "average_score": average_score,
                    "response_count": response_count,
                    "score_min": item.get("score_min"),
                    "score_max": item.get("score_max"),
                }
            )

        rollup = []
        for category, total in category_totals.items():
            score = round(total["weighted_sum"] / total["response_count"], 2) if total["response_count"] else 0.0
            rollup.append(
                {
                    "category": category,
                    "average_score": score,
                    "question_count": total["question_count"],
                }
            )

        rollup.sort(key=lambda row: row["category"])
        for category in category_questions:
            category_questions[category].sort(key=lambda row: int(row.get("question_number") or 0))

        return rollup, category_questions

    selected_category_rollup, selected_category_questions = category_rollup(list(selected_question_averages.get("items") or []))
    overall_category_rollup, _ = category_rollup(list(overall_question_averages.get("items") or []))
    overall_category_by_name = {row["category"]: row for row in overall_category_rollup}

    category_comparison = []
    for row in selected_category_rollup:
        overall_row = overall_category_by_name.get(row["category"], {})
        selected_avg = float(row.get("average_score") or 0.0)
        overall_avg = float(overall_row.get("average_score") or 0.0) if overall_row else 0.0
        category_comparison.append(
            {
                "category": row["category"],
                "selected_average_score": selected_avg,
                "overall_average_score": overall_avg if (overall_row and include_overall_comparison) else None,
                "delta": round(selected_avg - overall_avg, 2) if (overall_row and include_overall_comparison) else None,
                "question_count": row.get("question_count", 0),
                "questions": selected_category_questions.get(row["category"], []),
            }
        )

    kpi_comparison = {
        "nps": {
            "selected": (filtered_analytics.get("nps") or {}).get("nps"),
            "overall": (overall_analytics.get("nps") or {}).get("nps"),
        },
        "csat": {
            "selected": (filtered_analytics.get("customer_satisfaction") or {}).get("csat_score"),
            "overall": (overall_analytics.get("customer_satisfaction") or {}).get("csat_score"),
        },
        "relationship_score": {
            "selected": (filtered_analytics.get("relationship_score") or {}).get("score"),
            "overall": (overall_analytics.get("relationship_score") or {}).get("score"),
        },
        "competitor_exposure": {
            "selected": (filtered_analytics.get("competitive_exposure") or {}).get("exposure_rate"),
            "overall": (overall_analytics.get("competitive_exposure") or {}).get("exposure_rate"),
        },
    }

    selected_actions = fetch_dashboard_actions(
        db=db,
        survey_type=report_survey_type,
        lead_owner=None,
        support=None,
        timeline=None,
        action_status=None,
        business_id=effective_business_id,
    )

    # For action_points report, visit_id carries the status filter (Outstanding/Completed)
    action_status_filter = None
    if normalized_report_type == "action_points" and effective_visit_id and effective_visit_id in {"Outstanding", "Completed"}:
        action_status_filter = effective_visit_id
        effective_visit_id = None  # Clear so it's not used as a visit filter

    if effective_date_from or effective_date_to or effective_visit_id or action_status_filter:
        filtered_actions = []
        for action in selected_actions:
            visit_date_value = action.get("visit_date")
            if effective_visit_id and str(action.get("visit_id")) != str(effective_visit_id):
                continue
            if effective_date_from and visit_date_value and visit_date_value < effective_date_from:
                continue
            if effective_date_to and visit_date_value and visit_date_value > effective_date_to:
                continue
            if action_status_filter and action.get("action_status") != action_status_filter:
                continue
            filtered_actions.append(action)
        selected_actions = filtered_actions

    def timeline_sort_key(value: str | None) -> int:
        ordering = {"<1 month": 1, "<3 months": 2, "<6 months": 3, ">6 months": 4}
        return ordering.get(value or "", 9)

    action_points = sorted(
        selected_actions,
        key=lambda item: (
            item.get("action_status") != "Outstanding",
            timeline_sort_key(item.get("action_timeframe")),
            item.get("business_name") or "",
            item.get("visit_date") or "",
        ),
    )

    survey_question_details: list[dict] = []
    selected_visit_info: dict | None = None
    if normalized_report_type == "survey" and effective_visit_id:
        ensure_visit_metadata_columns(db)
        ensure_visit_edit_audit_columns(db)
        visit_info_row = db.execute(
            text(
                """
                SELECT
                    v.id,
                    b.name AS business_name,
                    v.visit_date,
                    v.status,
                    v.account_executive_name,
                    v.edited_by_name,
                    v.edited_at,
                    u.name AS representative_name
                FROM visits v
                JOIN businesses b ON b.id = v.business_id
                LEFT JOIN users u ON u.id = v.representative_id
                WHERE v.id = :visit_id
                LIMIT 1
                """
            ),
            {"visit_id": effective_visit_id},
        ).mappings().first()
        if visit_info_row:
            selected_visit_info = {
                "visit_id": str(visit_info_row["id"]),
                "business_name": visit_info_row["business_name"],
                "visit_date": visit_info_row["visit_date"].isoformat() if visit_info_row["visit_date"] else None,
                "status": visit_info_row["status"],
                "account_executive_name": visit_info_row["account_executive_name"],
                "edited_by_name": visit_info_row["edited_by_name"],
                "edited_at": visit_info_row["edited_at"].isoformat() if visit_info_row["edited_at"] else None,
                "representative_name": visit_info_row["representative_name"],
                "team_member_names": fetch_visit_team_members(db, effective_visit_id),
            }

        has_question_order = has_column(db, "questions", "order_index")
        question_order_col = "q.order_index" if has_question_order else "q.id"
        if response_table == "b2b_visit_responses":
            response_rows = db.execute(
                text(
                    f"""
                    SELECT
                        q.id as question_id,
                        {question_order_col} as question_number,
                        q.category,
                        q.question_text,
                        q.input_type,
                        q.score_min,
                        q.score_max,
                        r.score,
                        r.answer_text,
                        r.verbatim,
                        r.actions
                    FROM b2b_visit_responses r
                    JOIN questions q ON q.id = r.question_id
                    WHERE r.visit_id = :visit_id
                    ORDER BY {question_order_col}, q.id
                    """
                ),
                {"visit_id": effective_visit_id},
            ).mappings().all()
            for row in response_rows:
                raw_actions = row.get("actions")
                if isinstance(raw_actions, str):
                    try:
                        raw_actions = json.loads(raw_actions)
                    except Exception:
                        raw_actions = []
                survey_question_details.append(
                    {
                        "question_id": row["question_id"],
                        "question_number": row["question_number"],
                        "category": row["category"] or "Uncategorized",
                        "question_text": row["question_text"],
                        "input_type": row["input_type"],
                        "score_min": row["score_min"],
                        "score_max": row["score_max"],
                        "score": row["score"],
                        "answer_text": row["answer_text"],
                        "verbatim": row["verbatim"],
                        "actions": raw_actions if isinstance(raw_actions, list) else [],
                    }
                )

    return {
        "filters": {
            "report_type": normalized_report_type,
            "survey_type": report_survey_type,
            "business_id": effective_business_id,
            "visit_id": effective_visit_id,
            "report_date": report_date,
            "date_from": effective_date_from,
            "date_to": effective_date_to,
        },
        "summary": {
            "total_visits": len(visits),
            "total_businesses": len(business_breakdown),
            "total_responses": total_responses,
            "average_score": summary_avg_score,
            "status_counts": status_counts,
            "is_single_visit": normalized_report_type == "survey" and effective_visit_id is not None,
        },
        "single_visit_scores": _fetch_single_visit_scores(db, effective_visit_id, response_table) if normalized_report_type == "survey" and effective_visit_id else None,
        "analytics_comparison": kpi_comparison,
        "analytics_selected": filtered_analytics,
        "analytics_overall": overall_analytics,
        "yes_no_comparison": yes_no_comparison,
        "category_comparison": category_comparison,
        "action_points": action_points,
        "selected_visit_info": selected_visit_info,
        "survey_question_details": survey_question_details,
        "daily_breakdown": daily_breakdown,
        "business_breakdown": business_breakdown,
        "visit_details": visits,
        "pending_visits": _fetch_pending_visits(db, report_survey_type) if normalized_report_type == "lifetime" else [],
    }


def render_report_html(payload: dict, generated_by: str) -> str:
    summary = payload.get("summary", {})
    filters = payload.get("filters", {})
    report_type = str(filters.get("report_type") or "lifetime")
    include_overall = report_type not in {"lifetime", "action_points"}
    is_single_visit = summary.get("is_single_visit", False)
    single_scores = payload.get("single_visit_scores") or {}
    comparison = payload.get("analytics_comparison", {})
    yes_no_comparison = payload.get("yes_no_comparison", [])
    category_comparison = payload.get("category_comparison", [])
    action_points = payload.get("action_points", [])
    daily_rows = payload.get("daily_breakdown", [])
    business_rows = payload.get("business_breakdown", [])
    visit_rows = payload.get("visit_details", [])
    selected_visit_info = payload.get("selected_visit_info") or {}

    def format_metric(value, suffix: str = ""):
        if value is None:
            return "--"
        try:
            return f"{float(value):.1f}{suffix}"
        except Exception:
            return f"{value}{suffix}"

    if report_type == "action_points":
        from collections import OrderedDict
        from itertools import groupby

        _ap_cw_logo = '<svg width="44" height="44" viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg"><circle cx="22" cy="22" r="20" fill="#0056A1"/><text x="22" y="16" text-anchor="middle" fill="#ffffff" font-size="10" font-weight="700" font-family="sans-serif">CW</text><text x="22" y="30" text-anchor="middle" fill="#ffffff" font-size="7" font-weight="500" font-family="sans-serif">SCX</text></svg>'

        def _timeline_color(tf: str | None) -> str:
            t = (tf or "").strip()
            if t == "<1 month":
                return "rgba(239,68,68,0.08)"
            if t == "<3 months":
                return "rgba(249,115,22,0.08)"
            if t == "<6 months":
                return "rgba(234,179,8,0.08)"
            if t == ">6 months":
                return "rgba(34,197,94,0.06)"
            return "transparent"

        def _answer_display(item: dict) -> str:
            score = item.get("question_score")
            answer = item.get("question_answer")
            if score is not None:
                return f"{score}/5"
            if answer:
                return answer
            return "--"

        outstanding = [a for a in action_points if a.get("action_status") != "Completed"]
        completed = [a for a in action_points if a.get("action_status") == "Completed"]

        def _build_section(items: list[dict], section_id: str) -> str:
            if not items:
                return '<p class="label">No action points in this section.</p>'
            sorted_items = sorted(items, key=lambda x: (x.get("business_name") or "", x.get("visit_date") or "", x.get("action_timeframe") or ""))
            groups = groupby(sorted_items, key=lambda x: x.get("business_name") or "--")
            sections: list[str] = []
            for biz_name, biz_group in groups:
                biz_items = list(biz_group)
                survey_groups = groupby(biz_items, key=lambda x: x.get("visit_date") or "--")
                rows: list[str] = []
                group_idx = 0
                for survey_date, survey_items in survey_groups:
                    group_idx += 1
                    bg = "#f8fafc" if group_idx % 2 == 1 else "#ffffff"
                    for item in survey_items:
                        tf = item.get("action_timeframe") or "--"
                        tf_bg = _timeline_color(tf)
                        rows.append(
                            f'<tr style="background:{bg}">'
                            f'<td>{item.get("visit_date") or "--"}</td>'
                            f'<td>{item.get("action_required") or "--"}</td>'
                            f'<td>{item.get("action_owner") or "--"}</td>'
                            f'<td style="background:{tf_bg}">{tf}</td>'
                            f'<td>{item.get("action_support_needed") or "--"}</td>'
                            f'<td>{item.get("question_text") or "--"}</td>'
                            f'<td>{_answer_display(item)}</td>'
                            f'</tr>'
                        )
                sections.append(
                    f'<tr><td colspan="7" style="background:#f1f5f9;font-weight:600;padding:10px 12px;color:#0f172a;">{biz_name} ({len(biz_items)} action point{"s" if len(biz_items) != 1 else ""})</td></tr>'
                    + "".join(rows)
                )
            return f'''<div class="table-wrap"><table>
                <thead><tr><th>Survey Date</th><th>Action Point</th><th>Lead Owner</th><th>Timeline</th><th>Support Needed</th><th>Linked Question</th><th>Answer</th></tr></thead>
                <tbody>{"".join(sections)}</tbody>
            </table></div>'''

        outstanding_html = _build_section(outstanding, "outstanding")
        completed_html = _build_section(completed, "completed")

        filters = payload.get("filters", {})
        return f"""<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>CWSCX Action Points Report</title>
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 24px; color: #0f172a; background:#f8fafc; line-height: 1.5; -webkit-text-size-adjust: 100%; overflow-x: hidden; }}
    .page {{ max-width: 1200px; margin: 0 auto; background:#ffffff; border:1px solid #e2e8f0; border-radius: 12px; padding: 28px; box-sizing: border-box; }}
    h1 {{ font-size: 26px; line-height: 1.2; margin: 0 0 10px; color: #0b1220; }}
    h2 {{ font-size: 19px; line-height: 1.3; margin: 30px 0 10px; color: #0f172a; }}
    h3 {{ font-size: 16px; line-height: 1.3; margin: 20px 0 8px; color: #334155; }}
    p {{ margin: 4px 0; color: #475569; }}
    .label {{ font-size: 12px; color: #64748b; font-weight: 500; }}
    table {{ width: 100%; border-collapse: collapse; margin-top: 10px; word-wrap: break-word; }}
    th, td {{ border: 1px solid #e5e7eb; padding: 10px 12px; font-size: 13px; text-align: left; color: #334155; }}
    th {{ background: #f1f5f9; font-weight: 600; color: #1e293b; }}
    .table-wrap {{ overflow-x: auto; -webkit-overflow-scrolling: touch; margin-top: 10px; border: 1px solid #e5e7eb; border-radius: 6px; }}
    .table-wrap table {{ margin-top: 0; border: none; }}
    .table-wrap th {{ border-top: none; }}
    .table-wrap th:first-child {{ border-left: none; }}
    .table-wrap td:first-child {{ border-left: none; }}
    .table-wrap th:last-child {{ border-right: none; }}
    .table-wrap td:last-child {{ border-right: none; }}
    @media (max-width: 900px) {{
      body {{ margin: 8px; padding: 0; }}
      .page {{ padding: 16px; }}
      h1 {{ font-size: 22px; }}
      h2 {{ font-size: 17px; }}
      th, td {{ font-size: 12px; padding: 8px 10px; }}
    }}
  </style>
</head>
<body>
  <div class="page">
  <div style="display:flex;align-items:center;gap:16px;margin-bottom:16px;border-bottom:3px solid #0056A1;padding-bottom:14px;">
    {_ap_cw_logo}
    <div>
      <h1 style="margin:0;">Cable &amp; Wireless — Action Points Report</h1>
      <p style="margin:2px 0 0;color:#64748b;font-size:13px;">Generated by: {generated_by}</p>
    </div>
  </div>
  <p>Survey Type: {filters.get('survey_type') or 'B2B'} | Date Range: {filters.get('date_from') or 'Any'} to {filters.get('date_to') or 'Any'} | Business: {filters.get('business_id') or 'All'}</p>

  <h2>Outstanding Action Points ({len(outstanding)})</h2>
  {outstanding_html}

  <h2>Completed Action Points ({len(completed)})</h2>
  {completed_html}

  </div>
</body>
</html>"""

    def svg_pie_chart(values: list[float], colors: list[str], size: int = 120) -> str:
        """Generate an inline SVG pie chart — compatible with all email clients."""
        import math as _m
        total = sum(max(float(v or 0.0), 0.0) for v in values)
        cx = cy = size / 2
        r = size / 2 - 2
        if total <= 0:
            return (
                f'<svg width="{size}" height="{size}" viewBox="0 0 {size} {size}" '
                f'style="display:block" xmlns="http://www.w3.org/2000/svg">'
                f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="#e5e7eb"/>'
                f'<circle cx="{cx}" cy="{cy}" r="{r * 0.55}" fill="#ffffff"/></svg>'
            )
        slices: list[tuple[float, str]] = []
        for value, color in zip(values, colors):
            pct = max(float(value or 0.0), 0.0) / total
            if pct > 0:
                slices.append((pct, color))
        if not slices:
            return (
                f'<svg width="{size}" height="{size}" viewBox="0 0 {size} {size}" '
                f'style="display:block" xmlns="http://www.w3.org/2000/svg">'
                f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="#e5e7eb"/>'
                f'<circle cx="{cx}" cy="{cy}" r="{r * 0.55}" fill="#ffffff"/></svg>'
            )
        paths: list[str] = []
        angle = -_m.pi / 2
        for pct, color in slices:
            end = angle + 2 * _m.pi * pct
            large = 1 if (end - angle) > _m.pi else 0
            x1 = cx + r * _m.cos(angle)
            y1 = cy + r * _m.sin(angle)
            x2 = cx + r * _m.cos(end)
            y2 = cy + r * _m.sin(end)
            d = f"M{cx},{cy} L{x1:.2f},{y1:.2f} A{r},{r} 0 {large},1 {x2:.2f},{y2:.2f} Z"
            paths.append(f'<path d="{d}" fill="{color}"/>')
            angle = end
        hole = r * 0.55
        return (
            f'<svg width="{size}" height="{size}" viewBox="0 0 {size} {size}" '
            f'style="display:block" xmlns="http://www.w3.org/2000/svg">'
            + "".join(paths)
            + f'<circle cx="{cx}" cy="{cy}" r="{hole}" fill="#ffffff"/></svg>'
        )

    status_counts = summary.get("status_counts", {}) or {}
    status_total = sum(int(value or 0) for value in status_counts.values()) or 1
    status_palette = {
        "Approved": "#22c55e",
        "Pending": "#f59e0b",
        "Needs Changes": "#f97316",
        "Rejected": "#ef4444",
        "Draft": "#94a3b8",
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
    max_business_responses = max([int(row.get("visit_count") or 0) for row in top_business], default=1)
    business_bars = "".join(
        (
            f"<div class='bar-row'><div class='bar-label'>{row.get('business_name') or '--'}</div>"
            f"<div class='bar-track'><div class='bar-fill' style='width:{round((int(row.get('visit_count') or 0) / max_business_responses) * 100, 1)}%;background:#3b82f6'></div></div>"
            f"<div class='bar-value'>{int(row.get('visit_count') or 0)}</div></div>"
        )
        for row in top_business
    )

    if is_single_visit:
        yes_no_cards = "".join(
            (
                f"<div class='card'><div class='label'>Q{int(item.get('question_number') or 0)} Yes/No</div>"
                f"<p style='margin:6px 0 10px; font-size:12px; color:#475569'>{item.get('question_text') or '--'}</p>"
                f"<div style='margin:4px 0;'><span style='font-size:14px; font-weight:700; color:{'#22c55e' if float(item.get('filtered_yes_percent') or 0.0) >= 50.0 else '#ef4444'}'>{'Yes' if float(item.get('filtered_yes_percent') or 0.0) >= 50.0 else 'No'}</span></div>"
                + f"</div>"
            )
            for item in yes_no_comparison
        )
    else:
        yes_no_cards = "".join(
            (
                f"<div class='card'><div class='label'>Q{int(item.get('question_number') or 0)} Yes/No</div>"
                f"<p style='margin:6px 0 10px; font-size:12px; color:#475569'>{item.get('question_text') or '--'}</p>"
                f"<div class='bar-row'><div class='bar-label'>Selected: Yes</div><div class='bar-track'><div class='bar-fill' style='width:{min(max(float(item.get('filtered_yes_percent') or 0.0), 0.0), 100.0)}%; background:#22c55e'></div></div><div class='bar-value'>{float(item.get('filtered_yes_percent') or 0.0):.1f}%</div></div>"
                + (
                    f"<div class='bar-row'><div class='bar-label'>Overall: Yes</div><div class='bar-track'><div class='bar-fill' style='width:{min(max(float(item.get('overall_yes_percent') or 0.0), 0.0), 100.0)}%; background:#6366f1'></div></div><div class='bar-value'>{float(item.get('overall_yes_percent') or 0.0):.1f}%</div></div>"
                    if include_overall
                    else ""
                )
                + f"</div>"
            )
            for item in yes_no_comparison
        )

    category_rows = "".join(
        (
            f"<tr><td>{row.get('category') or '--'}</td>"
            f"<td>{format_metric(row.get('selected_average_score'))}</td>"
            + (
                f"<td>{format_metric(row.get('overall_average_score'))}</td>"
                f"<td>{format_metric(row.get('delta'))}</td>"
                if include_overall
                else ""
            )
            + "</tr>"
        )
        for row in category_comparison
    )

    def score_color(score, score_max):
        """Return color for score based on thresholds. Assumes score and max are numeric."""
        try:
            s = float(score)
            m = float(score_max) if score_max is not None else 10
            # Normalize to 0-10 scale for thresholds
            if m != 10:
                s = (s / m) * 10
                m = 10
            # Now s is 0-10
            if s >= 9:
                return "#22c55e"  # green-500 excellent
            if s >= 7:
                return "#84cc16"  # lime-500 good
            if s >= 5:
                return "#f59e0b"  # amber-500 fail
            return "#ef4444"  # red-500 critical fail
        except:
            return None

    category_detail_blocks = ""
    for row in category_comparison:
        questions = list(row.get("questions") or [])
        rows_html_parts = []
        for q in questions:
            qnum = int(q.get('question_number') or 0)
            qtext = q.get('question_text') or '--'
            avg = q.get('average_score')
            score_max = q.get('score_max')
            color = score_color(avg, score_max)
            # Build cell: if color, show colored badge
            if color:
                avg_display = format_metric(avg)
                avg_cell = f"<span style='display:inline-block;min-width:60px;text-align:right;margin-right:8px;font-weight:600;color:{color}'>{avg_display}</span>"
            else:
                avg_cell = format_metric(avg)
            rows_html_parts.append(
                f"<tr>"
                f"<td>Q{qnum}: {qtext}</td>"
                f"<td>{avg_cell}</td>"
                f"</tr>"
            )
        table_body = "".join(rows_html_parts)
        category_detail_blocks += (
            f"<div class='card'><div class='label'>{row.get('category') or '--'} (Selected Scope)</div>"
            f"<div class='table-wrap'><table><thead><tr><th>Question</th><th>Average</th></tr></thead><tbody>"
            + table_body
            + "</tbody></table></div></div>"
         )

    # Generate horizontal bar visualization for category averages
    category_bars = ""
    for row in category_comparison:
        cat = row.get('category') or '--'
        avg = float(row.get('selected_average_score') or 0)
        color = score_color(avg, 10)  # assume 10 as max for normalization
        width = min(100, max(0, (avg / 10) * 100))
        category_bars += (
            f"<div class='bar-row'>"
            f"<div class='bar-label'>{cat}</div>"
            f"<div class='bar-track'><div class='bar-fill' style='width:{width}%;background:{color}'></div></div>"
            f"<div class='bar-value' style='color:{color}'>{format_metric(avg)}</div>"
            f"</div>"
        )

    action_rows = "".join(
        (
            f"<tr><td>{item.get('visit_date') or '--'}</td><td>{item.get('business_name') or '--'}</td>"
            f"<td>{item.get('action_required') or '--'}</td><td>{item.get('action_owner') or '--'}</td>"
            f"<td>{item.get('action_timeframe') or '--'}</td><td>{item.get('action_status') or 'Outstanding'}</td>"
            f"<td>{item.get('action_support_needed') or '--'}</td></tr>"
        )
        for item in action_points
    )

    action_rows_outstanding = "".join(
        (
            f"<tr><td>{item.get('visit_date') or '--'}</td><td>{item.get('business_name') or '--'}</td>"
            f"<td>{item.get('action_required') or '--'}</td><td>{item.get('action_owner') or '--'}</td>"
            f"<td>{item.get('action_timeframe') or '--'}</td><td>{item.get('action_support_needed') or '--'}</td></tr>"
        )
        for item in action_points
        if item.get("action_status") != "Completed"
    )

    action_rows_completed = "".join(
        (
            f"<tr><td>{item.get('visit_date') or '--'}</td><td>{item.get('business_name') or '--'}</td>"
            f"<td>{item.get('action_required') or '--'}</td><td>{item.get('action_owner') or '--'}</td>"
            f"<td>{item.get('action_timeframe') or '--'}</td><td>{item.get('action_support_needed') or '--'}</td></tr>"
        )
        for item in action_points
        if item.get("action_status") == "Completed"
    )

    survey_question_rows = list(payload.get("survey_question_details") or [])
    survey_detail_blocks = ""
    if report_type == "survey" and survey_question_rows:
        category_map: dict[str, list[dict]] = {}
        for item in survey_question_rows:
            category = str(item.get("category") or "Uncategorized")
            category_map.setdefault(category, []).append(item)

        rendered = []
        for category_name in sorted(category_map.keys()):
            rows = []
            for row in category_map[category_name]:
                qnum = int(row.get('question_number') or 0)
                qtext = row.get('question_text') or '--'
                score = row.get('score')
                score_min = row.get('score_min')
                score_max = row.get('score_max')
                answer_text = row.get('answer_text') or '--'
                verbatim = row.get('verbatim') or '--'

                # Determine answer display with range if score is numeric
                if score is not None:
                    if score_max is not None:
                        try:
                            score_val = float(score)
                            max_val = float(score_max)
                            if score_val.is_integer() and max_val.is_integer():
                                answer_display = f"{int(score_val)} / {int(max_val)}"
                            else:
                                answer_display = f"{score_val:.1f} / {max_val:.1f}"
                        except Exception:
                            answer_display = f"{score} / {score_max}"
                    else:
                        answer_display = format_metric(score)
                else:
                    answer_display = answer_text

                rows.append(
                    f"<tr>"
                    f"<td>Q{qnum}</td>"
                    f"<td>{qtext}</td>"
                    f"<td>{answer_display}</td>"
                    f"<td>{verbatim}</td>"
                    f"</tr>"
                )
            table_body = "".join(rows)
            rendered.append(
                f"<div class='card'><div class='label'>{category_name}</div>"
                f"<div class='table-wrap'><table><thead><tr><th>Question</th><th>Prompt</th><th>Answer (Range)</th><th>Verbatim</th></tr></thead><tbody>{table_body}</tbody></table></div></div>"
            )
        survey_detail_blocks = "".join(rendered)

    nps_obj = comparison.get("nps") or {}
    csat_obj = comparison.get("csat") or {}
    selected_analytics = payload.get("analytics_selected", {}) or {}
    nps_breakdown = selected_analytics.get("nps") or {}
    csat_breakdown = (selected_analytics.get("customer_satisfaction") or {}).get("score_distribution") or {}

    nps_pie_svg = svg_pie_chart(
        [nps_breakdown.get("promoters", 0), nps_breakdown.get("passives", 0), nps_breakdown.get("detractors", 0)],
        ["#22c55e", "#eab308", "#ef4444"],
    )
    csat_pie_svg = svg_pie_chart(
        [
            csat_breakdown.get("very_satisfied", 0),
            csat_breakdown.get("satisfied", 0),
            csat_breakdown.get("neutral", 0),
            csat_breakdown.get("dissatisfied", 0),
            csat_breakdown.get("very_dissatisfied", 0),
        ],
        ["#22c55e", "#86efac", "#94a3b8", "#f59e0b", "#ef4444"],
    )

    daily_table = "".join(
        f"<tr><td>{row['visit_date']}</td><td>{row['visit_count']}</td><td>{row['avg_score'] if row['avg_score'] is not None else '--'}</td></tr>"
        for row in daily_rows
    )
    business_table = "".join(
        f"<tr><td>{row['business_name']}</td><td>{row['visit_count']}</td><td>{row['avg_score'] if row['avg_score'] is not None else '--'}</td><td>{row['latest_visit_date']}</td></tr>"
        for row in business_rows
    )
    visit_table = "".join(
        f"<tr><td>{row['visit_date']}</td><td>{row['business_name']}</td><td>{row['status']}</td><td>{row['avg_score'] if row['avg_score'] is not None else '--'}</td></tr>"
        for row in visit_rows
    )

    _svg = lambda path: f'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0056A1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">{path}</svg>'
    icon_nps = _svg('<path d="M7 17L17 7"/><path d="M17 7H7"/><path d="M17 7V17"/>') + _svg('<path d="M17 7L7 17"/><path d="M7 17H17"/><path d="M7 17V7"/>')
    icon_csat = _svg('<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>')
    icon_handshake = _svg('<path d="M11 17a1 1 0 0 1-1 1H7a5 5 0 0 1 5-5"/><path d="M13 17a1 1 0 0 0 1 1h3a5 5 0 0 0-5-5"/><path d="M2 14h2a2 2 0 0 0 2-2V8"/><path d="M20 14h-2a2 2 0 0 1-2-2V8"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>')
    icon_swords = _svg('<path d="m2 2 8 8"/><path d="m22 2-8 8"/><path d="M10 4.5 7.5 2"/><path d="M14 4.5 16.5 2"/><path d="M10 19.5 7.5 22"/><path d="M14 19.5 16.5 22"/><path d="m2 22 8-8"/><path d="m22 22-8-8"/>')
    icon_target = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0056A1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px;margin-right:6px;"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>'
    icon_globe = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0056A1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px;margin-right:6px;"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>'
    def _load_image_data_uri(filename: str) -> str | None:
        try:
            base_dir = Path(__file__).resolve().parents[3]
            for candidate in [base_dir / "assets" / filename, base_dir / filename]:
                if candidate.exists():
                    data = base64.b64encode(candidate.read_bytes()).decode()
                    return f"data:image/png;base64,{data}"
        except Exception:
            pass
        return None

    _cws_banner_data = _load_image_data_uri("cable and wireless banner.png")
    _cws_logo_data = _load_image_data_uri("Cable-and-Wireless-Seychelles.png")
    _svg_logo = '<svg width="44" height="44" viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg"><circle cx="22" cy="22" r="20" fill="#0056A1"/><text x="22" y="16" text-anchor="middle" fill="#ffffff" font-size="10" font-weight="700" font-family="sans-serif">CW</text><text x="22" y="30" text-anchor="middle" fill="#ffffff" font-size="7" font-weight="500" font-family="sans-serif">SCX</text></svg>'
    if _cws_banner_data:
        cw_logo = f'<img src="{_cws_banner_data}" alt="Cable &amp; Wireless" style="height:48px;" />'
    elif _cws_logo_data:
        cw_logo = f'<img src="{_cws_logo_data}" alt="Cable &amp; Wireless" style="height:48px;" />'
    else:
        cw_logo = _svg_logo

    summary_section = ""
    if not is_single_visit:
        summary_section = (
            f'<div class="summary">'
            f'<div class="card"><div class="label">Total Visits</div><div class="value">{summary.get("total_visits", 0)}</div></div>'
            f'<div class="card"><div class="label">Businesses Covered</div><div class="value">{summary.get("total_businesses", 0)}</div></div>'
            f'</div>'
        )

    selected_kpi_section = ""
    if not is_single_visit:
        selected_scope_title = "Lifetime KPIs" if report_type == "lifetime" else "Selected Scope KPIs"
        selected_kpi_section = (
            f'<h2>{icon_target}{selected_scope_title}</h2>'
            f'<div class="summary">'
            f'<div class="card"><div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">{icon_nps}</div><div class="label">NPS</div><div class="value">{format_metric((comparison.get("nps") or {}).get("selected"))}</div></div>'
            f'<div class="card">{icon_csat}<div class="label">CSAT</div><div class="value">{format_metric((comparison.get("csat") or {}).get("selected"), "%")}</div></div>'
            f'<div class="card">{icon_handshake}<div class="label">Relationship Score</div><div class="value">{format_metric((comparison.get("relationship_score") or {}).get("selected"))}</div></div>'
            f'<div class="card">{icon_swords}<div class="label">Competitive Exposure</div><div class="value">{format_metric((comparison.get("competitor_exposure") or {}).get("selected"), "%")}</div></div>'
            f'</div>'
        )

    overall_benchmark_section = ""
    if include_overall:
        overall_benchmark_section = (
            f'<h2>{icon_globe}Overall Benchmark KPIs</h2>'
            f'<div class="summary">'
            f'<div class="card"><div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">{icon_nps}</div><div class="label">NPS</div><div class="value">{format_metric((comparison.get("nps") or {}).get("overall"))}</div></div>'
            f'<div class="card">{icon_csat}<div class="label">CSAT</div><div class="value">{format_metric((comparison.get("csat") or {}).get("overall"), "%")}</div></div>'
            f'<div class="card">{icon_handshake}<div class="label">Relationship Score</div><div class="value">{format_metric((comparison.get("relationship_score") or {}).get("overall"))}</div></div>'
            f'<div class="card">{icon_swords}<div class="label">Competitive Exposure</div><div class="value">{format_metric((comparison.get("competitor_exposure") or {}).get("overall"), "%")}</div></div>'
            f'</div>'
        )

    pie_section = ""
    if not is_single_visit:
        overall_nps_benchmark = f'<p class="label">Overall NPS Benchmark: {format_metric(nps_obj.get("overall"))}</p>' if include_overall else ""
        overall_csat_benchmark = f'<p class="label">Overall CSAT Benchmark: {format_metric(csat_obj.get("overall"), "%")}</p>' if include_overall else ""
        pie_section = (
            f'<div class="mini-grid" style="margin-top:12px">'
            f'<div class="card"><div class="label">NPS Distribution</div><div class="pie-wrap">{nps_pie_svg}<div>'
            f'<p class="label">Promoters: {int(nps_breakdown.get("promoters") or 0)}</p>'
            f'<p class="label">Passives: {int(nps_breakdown.get("passives") or 0)}</p>'
            f'<p class="label">Detractors: {int(nps_breakdown.get("detractors") or 0)}</p>'
            f'<p class="label" style="margin-top:8px">Selected NPS: {format_metric(nps_obj.get("selected"))}</p>'
            f'{overall_nps_benchmark}'
            f'</div></div></div>'
            f'<div class="card"><div class="label">CSAT Distribution</div><div class="pie-wrap">{csat_pie_svg}<div>'
            f'<p class="label">Very Satisfied: {int(csat_breakdown.get("very_satisfied") or 0)}</p>'
            f'<p class="label">Satisfied: {int(csat_breakdown.get("satisfied") or 0)}</p>'
            f'<p class="label">Neutral: {int(csat_breakdown.get("neutral") or 0)}</p>'
            f'<p class="label">Dissatisfied: {int(csat_breakdown.get("dissatisfied") or 0)}</p>'
            f'<p class="label">Very Dissatisfied: {int(csat_breakdown.get("very_dissatisfied") or 0)}</p>'
            f'<p class="label" style="margin-top:8px">Selected CSAT: {format_metric(csat_obj.get("selected"), "%")}</p>'
            f'{overall_csat_benchmark}'
            f'</div></div></div>'
            f'</div>'
        )

    if report_type == "action_points":
        no_outstanding_actions = '<tr><td colspan="6">No outstanding action points.</td></tr>'
        no_completed_actions = '<tr><td colspan="6">No completed action points.</td></tr>'
        action_points_section = (
            f'<h3>Outstanding Action Points</h3><div class="table-wrap"><table>'
            f'<thead><tr><th>Survey Date</th><th>Business</th><th>Action Point</th><th>Lead Owner</th><th>Timeline</th><th>Support Needed</th></tr></thead>'
            f'<tbody>{action_rows_outstanding or no_outstanding_actions}</tbody></table></div>'
            f'<h3>Completed Action Points</h3><div class="table-wrap"><table>'
            f'<thead><tr><th>Survey Date</th><th>Business</th><th>Action Point</th><th>Lead Owner</th><th>Timeline</th><th>Support Needed</th></tr></thead>'
            f'<tbody>{action_rows_completed or no_completed_actions}</tbody></table></div>'
        )
    else:
        no_action_points = '<tr><td colspan="7">No action points found for this report scope.</td></tr>'
        action_points_section = (
            f'<div class="table-wrap"><table>'
            f'<thead><tr><th>Survey Date</th><th>Business</th><th>Action Point</th><th>Lead Owner</th><th>Timeline</th><th>Status</th><th>Support Needed</th></tr></thead>'
            f'<tbody>{action_rows or no_action_points}</tbody></table></div>'
        )

    visual_highlights_section = ""
    if not is_single_visit:
        no_status_data = '<p class="label">No status data</p>'
        no_business_data = '<p class="label">No business data</p>'
        visual_highlights_section = (
            f'<h2>Visual Highlights</h2><div class="viz-grid">'
            f'<div class="card"><div class="label">Visit Status Distribution</div>{status_bars or no_status_data}'
            f'<div class="legend"><span><i style="background:#22c55e"></i>Approved</span><span><i style="background:#f59e0b"></i>Pending</span><span><i style="background:#f97316"></i>Needs Changes</span><span><i style="background:#ef4444"></i>Rejected</span><span><i style="background:#94a3b8"></i>Draft</span></div></div>'
            f'<div class="card"><div class="label">Visits per Business</div>{business_bars or no_business_data}<p class="label" style="margin-top:8px">Bars compare response volume across businesses in this report range.</p></div>'
            f'</div>'
        )

    selected_vs_overall_section = ""
    if include_overall and not is_single_visit:
        selected_vs_overall_section = (
            f'<h2>Selected vs Overall Comparison</h2><div class="table-wrap"><table>'
            f'<thead><tr><th>Metric</th><th>Selected Scope</th><th>Overall Scope</th><th>Interpretation</th></tr></thead>'
            f'<tbody>'
            f'<tr><td>NPS</td><td>{format_metric((comparison.get("nps") or {}).get("selected"))}</td><td>{format_metric((comparison.get("nps") or {}).get("overall"))}</td><td>Higher is better. Positive means more promoters than detractors.</td></tr>'
            f'<tr><td>CSAT</td><td>{format_metric((comparison.get("csat") or {}).get("selected"), "%")}</td><td>{format_metric((comparison.get("csat") or {}).get("overall"), "%")}</td><td>Higher means more satisfied accounts.</td></tr>'
            f'<tr><td>Overall Relationship Score</td><td>{format_metric((comparison.get("relationship_score") or {}).get("selected"))}</td><td>{format_metric((comparison.get("relationship_score") or {}).get("overall"))}</td><td>Composite relationship strength score (0-100).</td></tr>'
            f'<tr><td>Competitor Exposure</td><td>{format_metric((comparison.get("competitor_exposure") or {}).get("selected"), "%")}</td><td>{format_metric((comparison.get("competitor_exposure") or {}).get("overall"), "%")}</td><td>Lower is better. Measures accounts using competitor services.</td></tr>'
            f'</tbody></table></div>'
        )

    pending_visits_section = ""
    if report_type == "lifetime" and (payload.get("pending_visits") or []):
        pending_rows = "".join(
            f"<tr><td>{v['business_name']}</td><td>{v['visit_date'] or '--'}</td><td>{v['status']}</td></tr>" for v in (payload.get("pending_visits") or [])
        )
        no_pending_visits = '<tr><td colspan="3">No pending visits.</td></tr>'
        pending_visits_section = (
            f'<h2>Businesses with Pending Visits</h2><div class="table-wrap"><table>'
            f'<thead><tr><th>Business</th><th>Visit Date</th><th>Status</th></tr></thead>'
            f'<tbody>{pending_rows or no_pending_visits}</tbody></table></div>'
        )

    selected_survey_section = ""
    if report_type == "survey":
        edited_suffix = f" ({selected_visit_info.get('edited_at')})" if selected_visit_info.get("edited_at") else ""
        no_survey_details = '<div class="card"><p class="label">No survey response details found.</p></div>'
        selected_survey_section = (
            f'<h2>Selected Survey Summary</h2>'
            f'<div class="summary">'
            f'<div class="card"><div class="label">Business</div><div class="value">{selected_visit_info.get("business_name") or "--"}</div></div>'
            f'<div class="card"><div class="label">Visit Date</div><div class="value">{selected_visit_info.get("visit_date") or "--"}</div></div>'
            f'<div class="card"><div class="label">Account Executive</div><div class="value">{selected_visit_info.get("account_executive_name") or "--"}</div></div>'
            f'<div class="card"><div class="label">Survey Team</div><div class="value">{", ".join(selected_visit_info.get("team_member_names") or []) or "--"}</div></div>'
            f'</div>'
            f'<div class="explain"><p>Representative: {selected_visit_info.get("representative_name") or "--"}</p><p>Edited before review: {selected_visit_info.get("edited_by_name") or "--"}{edited_suffix}</p></div>'
            f'<h2>Survey Responses and Verbatim</h2>'
            f'<div class="viz-grid">{survey_detail_blocks or no_survey_details}</div>'
        )

    daily_analytics_section = ""
    business_analytics_section = ""
    visit_results_section = ""
    if report_type != "survey":
        no_daily_data = '<tr><td colspan="3">No data</td></tr>'
        no_business_analytics = '<tr><td colspan="4">No data</td></tr>'
        no_visit_results = '<tr><td colspan="4">No data</td></tr>'
        daily_analytics_section = f'<h2>Daily Analytics</h2><div class="table-wrap"><table><thead><tr><th>Date</th><th>Visits</th><th>Average Score</th></tr></thead><tbody>{daily_table or no_daily_data}</tbody></table></div>'
        business_analytics_section = f'<h2>Business Analytics</h2><div class="table-wrap"><table><thead><tr><th>Business</th><th>Visits</th><th>Average Score</th><th>Latest Visit</th></tr></thead><tbody>{business_table or no_business_analytics}</tbody></table></div>'
        visit_results_section = f'<h2>Visit-Level Results</h2><div class="table-wrap"><table><thead><tr><th>Date</th><th>Business</th><th>Status</th><th>Average Score</th></tr></thead><tbody>{visit_table or no_visit_results}</tbody></table></div>'

    return f"""
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>CWSCX Survey Report</title>
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 24px; color: #0f172a; background:#f8fafc; line-height: 1.5; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; overflow-x: hidden; }}
    .page {{ max-width: 1200px; margin: 0 auto; background:#ffffff; border:1px solid #e2e8f0; border-radius: 12px; padding: 28px; box-sizing: border-box; }}
    h1 {{ font-size: 26px; line-height: 1.2; margin: 0 0 10px; color: #0b1220; letter-spacing: -0.01em; }}
    h2 {{ font-size: 19px; line-height: 1.3; margin: 30px 0 10px; color: #0f172a; letter-spacing: -0.01em; }}
    p {{ margin: 4px 0; color: #475569; }}
    .summary {{ display: grid; grid-template-columns: repeat(4, minmax(140px, 1fr)); gap: 12px; margin-top: 14px; }}
    .card {{ border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 14px; background: #f9fafb; margin-bottom: 4px; }}
    .label {{ font-size: 12px; color: #64748b; font-weight: 500; }}
    .value {{ font-size: 20px; font-weight: 700; color: #0f172a; line-height: 1.2; }}
    table {{ width: 100%; border-collapse: collapse; margin-top: 10px; word-wrap: break-word; }}
    th, td {{ border: 1px solid #e5e7eb; padding: 10px 12px; font-size: 13px; text-align: left; color: #334155; }}
    th {{ background: #f1f5f9; font-weight: 600; color: #1e293b; }}
    td {{ background: #ffffff; }}
    tr:nth-child(even) td {{ background: #f8fafc; }}
    .explain {{ border-left: 3px solid #cbd5e1; padding: 10px 14px; margin-top: 8px; background: #f8fafc; border-radius: 0 6px 6px 0; }}
    .viz-grid {{ display:grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 12px; }}
    .bar-row {{ display:grid; grid-template-columns: 190px 1fr 52px; align-items:center; gap:8px; margin:6px 0; }}
    .bar-label {{ font-size: 12px; color:#475569; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }}
    .bar-track {{ height: 10px; background:#e2e8f0; border-radius: 999px; overflow: hidden; }}
    .bar-fill {{ height: 100%; border-radius: 999px; transition: width 0.3s ease; }}
    .bar-value {{ font-size: 12px; font-weight: 600; text-align: right; color:#334155; }}
    .legend {{ display:flex; flex-wrap: wrap; gap: 10px; margin-top: 10px; font-size:12px; color:#64748b; }}
    .legend i {{ display:inline-block; width:10px; height:10px; border-radius: 999px; margin-right:6px; vertical-align: middle; }}
    .pie-wrap {{ display:flex; align-items:center; gap:16px; margin-top:8px; }}
    .mini-grid {{ display:grid; grid-template-columns: 1fr 1fr; gap:14px; }}
    .table-wrap {{ overflow-x: auto; -webkit-overflow-scrolling: touch; margin-top: 10px; border: 1px solid #e5e7eb; border-radius: 6px; }}
    .table-wrap table {{ margin-top: 0; border: none; }}
    .table-wrap th {{ border-top: none; }}
    .table-wrap th:first-child {{ border-left: none; }}
    .table-wrap td:first-child {{ border-left: none; }}
    .table-wrap th:last-child {{ border-right: none; }}
    .table-wrap td:last-child {{ border-right: none; }}
    @media (max-width: 900px) {{
      body {{ margin: 8px; padding: 0; }}
      .page {{ padding: 16px; border-radius: 10px; }}
      .summary {{ grid-template-columns: 1fr 1fr; gap: 8px; }}
      .viz-grid {{ grid-template-columns: 1fr; gap: 10px; }}
      .mini-grid {{ grid-template-columns: 1fr; gap: 10px; }}
      h1 {{ font-size: 22px; }}
      h2 {{ font-size: 17px; margin-top: 24px; }}
      .value {{ font-size: 18px; }}
      .bar-row {{ grid-template-columns: 130px 1fr 46px; }}
      .pie-wrap {{ flex-direction: column; align-items: flex-start; }}
      th, td {{ font-size: 12px; padding: 8px 10px; }}
      .table-wrap {{ border-radius: 4px; }}
    }}
    @media (max-width: 600px) {{
      body {{ margin: 4px; }}
      .page {{ padding: 12px; border-radius: 8px; }}
      .summary {{ grid-template-columns: 1fr; }}
      h1 {{ font-size: 20px; }}
      h2 {{ font-size: 16px; margin-top: 20px; }}
      .bar-row {{ grid-template-columns: 100px 1fr 40px; }}
      th, td {{ font-size: 11px; padding: 6px 8px; }}
    }}
  </style>
</head>
<body>
  <div class="page">
  <div style="display:flex;align-items:center;gap:16px;margin-bottom:16px;border-bottom:3px solid #0056A1;padding-bottom:14px;">
    {cw_logo}
    <div>
      <h1 style="margin:0;">Cable &amp; Wireless — Survey and Analytics Report</h1>
      <p style="margin:2px 0 0;color:#64748b;font-size:13px;">Generated by: {generated_by}</p>
    </div>
  </div>
  <p>Survey Type: {filters.get('survey_type') or 'B2B'} | Date Range: {filters.get('date_from') or 'Any'} to {filters.get('date_to') or 'Any'} | Business ID: {filters.get('business_id') or 'All'}</p>

  {summary_section}
  {selected_kpi_section}
  {overall_benchmark_section}
  {pie_section}

  <h2>Action Points</h2>
  {action_points_section}

  <div class="explain">
    <p>This report helps managers review daily survey execution quality, account coverage, and response health. Use the per-day and per-business tables to identify trends and follow-up priorities.</p>
  </div>

  {visual_highlights_section}
  {selected_vs_overall_section}
  {pending_visits_section}

  <h2>Yes/No Question Comparison</h2>
  <div class="viz-grid">
    {yes_no_cards or '<div class="card"><p class="label">No yes/no analytics in current scope.</p></div>'}
  </div>

   <h2>Category Breakdown</h2>
   <div class="table-wrap"><table>
     <thead><tr><th>Category</th><th>Selected Avg</th>{'<th>Overall Avg</th><th>Delta</th>' if include_overall else ''}</tr></thead>
     <tbody>{category_rows or f'<tr><td colspan="{4 if include_overall else 2}">No category score data</td></tr>'}</tbody>
   </table></div>

   <h2>Category Score Overview</h2>
   <div class="card">
     <div class="label">Selected Scope Averages</div>
     {category_bars or '<p class="label">No category score data</p>'}
   </div>

   <h2>Category Question Details (Selected Scope)</h2>
  <div class="viz-grid">
    {category_detail_blocks or '<div class="card"><p class="label">No category question details available.</p></div>'}
  </div>

  {selected_survey_section}
  {daily_analytics_section}
  {business_analytics_section}
  {visit_results_section}
  <p class="label" style="margin-top:12px;font-size:12px;color:#64748b;">
    Note: Scoring ranges vary by question. Answers are displayed as "score / max" (e.g., 7 / 10 indicates a score of 7 out of a possible 10). Most questions use a 1-10 scale; NPS questions use 0-10.
  </p>
  </div>
</body>
</html>
"""


@router.get("/reports/export")
def export_report(
    report_type: str | None = "lifetime",
    survey_type: str | None = "B2B",
    business_id: int | None = None,
    visit_id: str | None = None,
    report_date: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    download: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    payload = build_report_payload(db, report_type, survey_type, business_id, visit_id, report_date, date_from, date_to)
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
    smtp_from = (
        os.getenv("SMTP_FROM", "").strip()
        or os.getenv("SMTP_EMAIL", "").strip()
        or os.getenv("STMP_EMAIL", "").strip()
        or smtp_user
    )
    smtp_use_tls_raw = os.getenv("SMTP_USE_TLS", "").strip().lower()
    smtp_use_ssl_raw = os.getenv("SMTP_USE_SSL", "").strip().lower()
    smtp_use_tls = (smtp_port == 587) if smtp_use_tls_raw == "" else smtp_use_tls_raw in {"1", "true", "yes"}
    smtp_use_ssl = (smtp_port == 465) if smtp_use_ssl_raw == "" else smtp_use_ssl_raw in {"1", "true", "yes"}

    if not smtp_host or not smtp_from:
        raise HTTPException(status_code=400, detail="SMTP is not configured. Set SMTP_HOST and SMTP_FROM (or SMTP_EMAIL/STMP_EMAIL).")

    payload = build_report_payload(
        db,
        request.report_type,
        request.survey_type,
        request.business_id,
        request.visit_id,
        request.report_date,
        request.date_from,
        request.date_to,
    )
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
        smtp_client_cls = smtplib.SMTP_SSL if smtp_use_ssl else smtplib.SMTP
        with smtp_client_cls(smtp_host, smtp_port, timeout=20) as server:
            if not smtp_use_ssl:
                try:
                    server.ehlo()
                except Exception:
                    pass
                if smtp_use_tls:
                    if getattr(server, "has_extn", lambda *_args: False)("starttls"):
                        server.starttls()
                        try:
                            server.ehlo()
                        except Exception:
                            pass
                    else:
                        raise HTTPException(
                            status_code=500,
                            detail="SMTP server does not support STARTTLS. Set SMTP_USE_TLS=false or use an SMTP server/port with TLS support.",
                        )
            if smtp_user and smtp_password:
                server.login(smtp_user, smtp_password)
            server.sendmail(smtp_from, list(request.to), message.as_string())
    except HTTPException:
        raise
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
        ensure_visit_metadata_columns(db)
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

        if "account_executive_name" in visit_data:
            update_fields.append("account_executive_name = :account_executive_name")
            params["account_executive_name"] = str(visit_data.get("account_executive_name") or "").strip() or None
        
        if not update_fields:
            raise HTTPException(status_code=400, detail="No valid fields to update")
        
        # Build dynamic UPDATE query
        query = f"UPDATE visits SET {', '.join(update_fields)} WHERE id = :visit_id"
        db.execute(text(query), params)

        if "team_member_names" in visit_data or "meeting_attendees" in visit_data:
            sync_visit_team_members(
                db,
                visit_id,
                visit_data.get("team_member_names") or visit_data.get("meeting_attendees") or [],
            )
        
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
                v.account_executive_name,
                v.edited_by_name,
                v.edited_by_email,
                v.edited_at,
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
        team_member_names = fetch_visit_team_members(db, visit_id)
        return {
            "visit_id": row[0],
            "business_id": row[1],
            "business_name": row[2],
            "representative_id": row[3],
            "representative_name": row[4],
            "visit_date": row[5],
            "visit_type": row[6],
            "status": row[7],
            "business_priority": row[8],
            "account_executive_name": row[9],
            "team_member_names": team_member_names,
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
def create_response(
    visit_id: str,
    response_data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
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
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating response: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create response: {str(e)}")


@router.put("/{visit_id}/responses/{response_id}")
def update_response(
    visit_id: str,
    response_id: str,
    response_data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
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
        
        mark_visit_edited(db, visit_id, current_user)

        mark_visit_edited(db, visit_id, current_user)

        mark_visit_edited(db, visit_id, current_user)

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
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating response: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update response: {str(e)}")


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
        ensure_visit_metadata_columns(db)
        ensure_visit_edit_audit_columns(db)
        print(f"DEBUG: Getting visit detail for visit_id: {visit_id}")
        has_question_number = has_column(db, "questions", "question_number")
        has_order_index = has_column(db, "questions", "order_index")
        if has_question_number:
            question_order_col = "q.question_number"
        elif has_order_index:
            question_order_col = "q.order_index"
        else:
            question_order_col = "q.id"

        visit_row = db.execute(text(
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
                v.account_executive_name,
                v.edited_by_name,
                v.edited_by_email,
                v.edited_at,
                v.submitted_by_name,
                v.submitted_by_email,
                v.submitted_at
            FROM visits v
            JOIN businesses b ON v.business_id = b.id
            LEFT JOIN users u ON v.representative_id = u.id
            WHERE v.id = :visit_id
            """
        ), {"visit_id": visit_id}).mappings().first()

        if not visit_row:
            print(f"DEBUG: Visit not found for ID: {visit_id}")
            raise HTTPException(status_code=404, detail="Visit not found")

        print(f"DEBUG: Visit found: {visit_row['business_name']}")

        response_table = get_response_table(db)
        if not response_table:
            raise HTTPException(status_code=500, detail="No response table found")

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
        ), {"visit_id": visit_id}).mappings().all()

        print(f"DEBUG: Found {len(response_rows)} response rows")

        responses = []
        for row in response_rows:
            actions = []
            if row["actions"]:
                try:
                    import json
                    actions = json.loads(row["actions"])
                except Exception:
                    actions = []

            responses.append({
                "response_id": row["id"],
                "question_id": row["question_id"],
                "question_number": row["question_number"] if row["question_number"] else row["question_id"],
                "question_text": row["question_text"],
                "question_type": row["input_type"],
                "category": row["category"] or "Uncategorized",
                "score": row["score"],
                "answer_text": row["answer_text"],
                "verbatim": row["verbatim"],
                "actions": actions,
                "created_at": row["created_at"].isoformat() if row["created_at"] else None,
                "updated_at": row["updated_at"].isoformat() if row["updated_at"] else None,
            })

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
        team_member_names = fetch_visit_team_members(db, visit_id)

        return {
            "id": visit_row["id"],
            "business_id": visit_row["business_id"],
            "business_name": visit_row["business_name"],
            "representative_id": visit_row["representative_id"],
            "representative_name": visit_row["representative_name"],
            "visit_date": visit_row["visit_date"],
            "visit_type": visit_row["visit_type"],
            "status": visit_row["status"],
            "business_priority": visit_row["business_priority"],
            "account_executive_name": visit_row["account_executive_name"],
            "team_member_names": team_member_names,
            "edited_by_name": visit_row["edited_by_name"],
            "edited_by_email": visit_row["edited_by_email"],
            "edited_at": visit_row["edited_at"].isoformat() if visit_row["edited_at"] else None,
            "submitted_by_name": visit_row["submitted_by_name"],
            "submitted_by_email": visit_row["submitted_by_email"],
            "submitted_at": visit_row["submitted_at"].isoformat() if visit_row["submitted_at"] else None,
            "mandatory_answered_count": mandatory_answered_count,
            "mandatory_total_count": mandatory_total_count,
            "is_started": len(responses) > 0,
            "is_completed": mandatory_total_count > 0 and mandatory_answered_count >= mandatory_total_count,
            "responses": responses,
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting visit detail: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get visit detail: {str(e)}")
