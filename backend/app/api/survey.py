"""
Additional endpoints for the survey interface
"""

import json
import logging

logger = logging.getLogger(__name__)

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from pydantic import BaseModel
from ..core.database import get_db
from ..core.analytics_scope import AnalyticsSchemaError, resolve_module_scope, visit_belongs_to_scope
from ..core.auth.dependencies import (
    ALL_PLATFORM_ROLES,
    B2B_ROLES,
    MYSTERY_ROLES,
    require_roles,
)
from .mystery_shopper import MYSTERY_SHOPPER_QUESTIONS
import sqlite3

router = APIRouter()


def normalize_business_type(value: str | None) -> str:
    normalized = (value or "").strip().lower()
    if normalized in {
        "large_corporate",
        "large business/corporate",
        "large corporate",
        "high",
    }:
        return "large_corporate"
    return "sme"


DEFAULT_SURVEY_TYPES = [
    {"code": "B2B", "name": "B2B", "description": "Business-to-Business survey"},
    {
        "code": "INSTALLATION",
        "name": "Installation Assessment",
        "description": "Installation assessment survey",
    },
    {
        "code": "MYSTERY_SHOPPER",
        "name": "Mystery Shopper",
        "description": "Mystery shopper survey",
    },
]


from ..core.db_inspect import has_column, has_table  # noqa: E402  (replaces local helpers)


def is_b2b_survey_type(value: str | None) -> bool:
    normalized = (value or "B2B").strip().lower().replace(" ", "")
    return normalized in {"b2b", "businesstobusiness"}


def _b2b_scope_or_500(db: Session):
    try:
        return resolve_module_scope(db, "B2B")
    except AnalyticsSchemaError as exc:
        raise HTTPException(status_code=500, detail=f"B2B scope unavailable: {exc}")


def _require_b2b_visit(db: Session, visit_id: object) -> None:
    scope = _b2b_scope_or_500(db)
    if not visit_belongs_to_scope(db, str(visit_id), scope):
        raise HTTPException(status_code=404, detail="Visit not found")


def _require_known_question_module(db: Session, survey_type: str) -> None:
    if not has_table(db, "survey_types") or not has_column(db, "questions", "survey_type_id"):
        raise HTTPException(status_code=500, detail="Question module scope is unavailable")
    has_code = has_column(db, "survey_types", "code")
    code_clause = "OR lower(code) = lower(:survey_type)" if has_code else ""
    exists = db.execute(
        text(
            f"""SELECT 1 FROM survey_types
                WHERE lower(name) = lower(:survey_type) {code_clause}
                   OR replace(lower(name), ' ', '') = replace(lower(:survey_type), ' ', '')
                LIMIT 1"""
        ),
        {"survey_type": survey_type},
    ).scalar()
    if not exists:
        raise HTTPException(status_code=400, detail="Unsupported or unknown survey_type")


@router.get("/survey-types")
async def get_survey_types(db: Session = Depends(get_db)):
    """List available survey types.

    Returned values are the codenames/names that can be used in `survey_type` query/body params.
    """

    try:
        if not has_table(db, "survey_types"):
            return [
                {"id": idx + 1, **survey_type}
                for idx, survey_type in enumerate(DEFAULT_SURVEY_TYPES)
            ]

        has_code = has_column(db, "survey_types", "code")
        select_code = "code" if has_code else "name"
        rows = db.execute(
            text(
                """
                SELECT id, {select_code} as code, name, description
                FROM survey_types
                ORDER BY id
                """.format(select_code=select_code)
            )
        ).all()

        return [
            {"id": row[0], "code": row[1], "name": row[2], "description": row[3]}
            for row in rows
        ]
    except Exception as e:
        logger.exception("Error fetching survey types: %s", e)
        return [
            {"id": idx + 1, **survey_type}
            for idx, survey_type in enumerate(DEFAULT_SURVEY_TYPES)
        ]


def _question_row_to_payload(row: Any) -> Dict[str, Any]:
    payload: Dict[str, Any] = {
        "id": row[0],
        "category": row[1],
        "question_text": row[2],
        "is_nps": bool(row[3]),
        "is_mandatory": bool(row[4]),
        "order_index": row[5],
        "question_key": row[6],
        "input_type": row[7],
        "score_min": row[8],
        "score_max": row[9],
        "requires_issue": bool(row[10]),
        "requires_escalation": bool(row[11]),
        "helper_text": row[12],
    }

    # Backward-compatible aliases (older survey UI versions)
    payload["order"] = payload["order_index"]
    payload["question_type"] = payload["input_type"]

    # Convenience for choice-based questions
    if payload["input_type"] in {"yes_no", "always_sometimes_never"}:
        if payload["input_type"] == "yes_no":
            payload["choices"] = ["Yes", "No"]
        else:
            payload["choices"] = ["Always", "Sometimes", "Monthly", "Never"]

    return payload


# Actual survey questions from questions.md
MOCK_QUESTIONS = [
    # Category 1: Relationship Strength
    {
        "id": 1,
        "category": "Category 1: Relationship Strength",
        "question_text": "Rate your relationship with C&W.",
        "question_type": "score",
        "min_score": 0,
        "max_score": 10,
        "order": 1,
    },
    {
        "id": 2,
        "category": "Category 1: Relationship Strength",
        "question_text": "Do you get enough information from your Account Executive on New Products and Services?",
        "question_type": "score",
        "min_score": 0,
        "max_score": 10,
        "order": 2,
    },
    {
        "id": 3,
        "category": "Category 1: Relationship Strength",
        "question_text": "How would you rate the level of professionalism when dealing with your C&W Account Executive?",
        "question_type": "score",
        "min_score": 0,
        "max_score": 10,
        "order": 3,
    },
    {
        "id": 4,
        "category": "Category 1: Relationship Strength",
        "question_text": "Does the C&W Account Executive understands your business?",
        "question_type": "choice",
        "min_score": 0,
        "max_score": 0,
        "order": 4,
        "choices": ["Yes", "No"],
    },
    {
        "id": 5,
        "category": "Category 1: Relationship Strength",
        "question_text": "How satisfied are you with your C&W contacts and number of visits?",
        "question_type": "score",
        "min_score": 0,
        "max_score": 10,
        "order": 5,
    },
    {
        "id": 6,
        "category": "Category 1: Relationship Strength",
        "question_text": "Are you receiving regular updates on your account?",
        "question_type": "choice",
        "min_score": 0,
        "max_score": 0,
        "order": 6,
        "choices": ["Yes", "No"],
    },
    # Category 2: Service & Operational Performance
    {
        "id": 7,
        "category": "Category 2: Service & Operational Performance",
        "question_text": "List Top 3 C&W services most satisfied with in the past 6 months.",
        "question_type": "text",
        "min_score": 0,
        "max_score": 0,
        "order": 7,
    },
    {
        "id": 8,
        "category": "Category 2: Service & Operational Performance",
        "question_text": "List 3 instances you have not been satisfied with C&W if any (Network Quality, Fault resolution, Visits, billing etc) if NW be specific.",
        "question_type": "text",
        "min_score": 0,
        "max_score": 0,
        "order": 8,
    },
    {
        "id": 9,
        "category": "Category 2: Service & Operational Performance",
        "question_text": "Are Issues resolved on time?",
        "question_type": "choice",
        "min_score": 0,
        "max_score": 0,
        "order": 9,
        "choices": ["Y", "N"],
    },
    {
        "id": 10,
        "category": "Category 2: Service & Operational Performance",
        "question_text": "How often do you call CWS to fix issues?",
        "question_type": "choice",
        "min_score": 0,
        "max_score": 0,
        "order": 10,
        "choices": ["3 months", "6 months", "9 months", "Rarely"],
    },
    {
        "id": 11,
        "category": "Category 2: Service & Operational Performance",
        "question_text": "What is your most recent unresolved issue with C&W?",
        "question_type": "text",
        "min_score": 0,
        "max_score": 0,
        "order": 11,
    },
    {
        "id": 12,
        "category": "Category 2: Service & Operational Performance",
        "question_text": "Rate overall C&W Satisfaction (Very Satisfied).",
        "question_type": "score",
        "min_score": 0,
        "max_score": 10,
        "order": 12,
    },
    # Category 3: Commercial & Billing
    {
        "id": 13,
        "category": "Category 3: Commercial & Billing",
        "question_text": "What are the top 3 most important factors of our services? Quality Price, Credit, Information, Faults resolution?",
        "question_type": "text",
        "min_score": 0,
        "max_score": 0,
        "order": 13,
    },
    {
        "id": 14,
        "category": "Category 3: Commercial & Billing",
        "question_text": "Is your statement of accounts accurate and up to date?",
        "question_type": "choice",
        "min_score": 0,
        "max_score": 0,
        "order": 14,
        "choices": ["Always", "Sometimes", "Monthly", "Never"],
    },
    # Category 4: Competitive & Portfolio Intelligence
    {
        "id": 15,
        "category": "Category 4: Competitive & Portfolio Intelligence",
        "question_text": "What Products and Services do you currently have with C&W.",
        "question_type": "text",
        "min_score": 0,
        "max_score": 0,
        "order": 15,
    },
    {
        "id": 16,
        "category": "Category 4: Competitive & Portfolio Intelligence",
        "question_text": "Do you have other products and services from other service providers?",
        "question_type": "choice",
        "min_score": 0,
        "max_score": 0,
        "order": 16,
        "choices": ["Yes", "No"],
    },
    {
        "id": 17,
        "category": "Category 4: Competitive & Portfolio Intelligence",
        "question_text": "List Products and services from competitor.",
        "question_type": "text",
        "min_score": 0,
        "max_score": 0,
        "order": 17,
    },
    {
        "id": 18,
        "category": "Category 4: Competitive & Portfolio Intelligence",
        "question_text": "Would you consider taking the same  competition services that you have now but with cws?",
        "question_type": "choice",
        "min_score": 0,
        "max_score": 0,
        "order": 18,
        "choices": ["Yes", "No"],
    },
    {
        "id": 19,
        "category": "Category 4: Competitive & Portfolio Intelligence",
        "question_text": "Which product would you want us to review to bring you to CWS?",
        "question_type": "text",
        "min_score": 0,
        "max_score": 0,
        "order": 19,
    },
    # Category 5: Growth & Expansion
    {
        "id": 20,
        "category": "Category 5: Growth & Expansion",
        "question_text": "New Telecommunications, or Digital Transformation requirements over next 6 to 12 months.",
        "question_type": "text",
        "min_score": 0,
        "max_score": 0,
        "order": 20,
    },
    {
        "id": 21,
        "category": "Category 5: Growth & Expansion",
        "question_text": "Types of products and services required for any expansion in 6 to 12 months.",
        "question_type": "text",
        "min_score": 0,
        "max_score": 0,
        "order": 21,
    },
    {
        "id": 22,
        "category": "Category 5: Growth & Expansion",
        "question_text": "What kinds of expansions in next 6-12 months.",
        "question_type": "text",
        "min_score": 0,
        "max_score": 0,
        "order": 22,
    },
    {
        "id": 23,
        "category": "Category 5: Growth & Expansion",
        "question_text": "What do you want to see more of from us?",
        "question_type": "text",
        "min_score": 0,
        "max_score": 0,
        "order": 23,
    },
    # Category 6: Advocacy
    {
        "id": 24,
        "category": "Category 6: Advocacy",
        "question_text": "NPS on a scale of 0 to 10, how much would you recommend us? 10 be very highly. 0 not at all.",
        "question_type": "score",
        "min_score": 0,
        "max_score": 10,
        "order": 24,
    },
    {
        "id": 25,
        "category": "Category 6: Advocacy",
        "question_text": "Any further comments from Customer.",
        "question_type": "text",
        "min_score": 0,
        "max_score": 0,
        "order": 25,
    },
]


class QuestionResponse(BaseModel):
    id: int
    category: str
    question_text: str
    question_type: str
    min_score: int = None
    max_score: int = None
    order: int


class VisitResponse(BaseModel):
    id: str
    business_id: int
    business_name: str
    representative_id: int
    visit_date: str
    visit_type: str
    status: str
    business_priority: str = None
    responses: List[Dict[str, Any]] = []


@router.post("/businesses")
async def create_business(
    business_data: dict,
    db: Session = Depends(get_db),
    _access: bool = Depends(require_roles("CX_SUPER_ADMIN", "B2B_ADMIN")),
):
    """Create a new business."""
    try:
        # Insert new business
        result = db.execute(
            text("""
            INSERT INTO businesses (name, location, priority_level, active, account_executive_id)
            VALUES (:name, :location, :priority_level, :active, :account_executive_id)
            """),
            {
                "name": business_data.get("name"),
                "location": business_data.get("location", ""),
                "priority_level": normalize_business_type(
                    business_data.get("priority_level", "sme")
                ),
                "active": True,
                "account_executive_id": business_data.get("account_executive_id"),
            },
        )

        db.commit()

        return {
            "id": result.lastrowid if hasattr(result, "lastrowid") else result[0],
            "name": business_data.get("name"),
            "location": business_data.get("location", ""),
            "priority_level": normalize_business_type(
                business_data.get("priority_level", "sme")
            ),
            "active": True,
            "account_executive_id": business_data.get("account_executive_id"),
        }
    except Exception as e:
        logger.exception("Error creating business: %s", e)
        raise HTTPException(status_code=500, detail="Failed to create business")


@router.put("/businesses/{business_id}")
async def update_business(
    business_id: int,
    business_data: dict,
    db: Session = Depends(get_db),
    _access: bool = Depends(require_roles("CX_SUPER_ADMIN", "B2B_ADMIN")),
):
    """Update a business (for retirement/reactivation)."""
    try:
        # Update business
        result = db.execute(
            text("""
            UPDATE businesses
            SET name = COALESCE(:name, name),
                location = COALESCE(:location, location),
                priority_level = COALESCE(:priority_level, priority_level),
                active = COALESCE(:active, active),
                account_executive_id = COALESCE(:account_executive_id, account_executive_id)
            WHERE id = :business_id
            """),
            {
                "business_id": business_id,
                "name": business_data.get("name"),
                "location": business_data.get("location"),
                "priority_level": normalize_business_type(
                    business_data.get("priority_level")
                )
                if business_data.get("priority_level") is not None
                else None,
                "active": business_data.get("active"),
                "account_executive_id": business_data.get("account_executive_id"),
            },
        )

        db.commit()

        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Business not found")

        # Get updated business data
        updated_business = db.execute(
            text("""
            SELECT id, name, location, priority_level, active, account_executive_id
            FROM businesses
            WHERE id = :business_id
            """),
            {"business_id": business_id},
        ).fetchone()

        return {
            "id": updated_business[0],
            "name": updated_business[1],
            "location": updated_business[2],
            "priority_level": updated_business[3],
            "active": bool(updated_business[4]),
            "account_executive_id": updated_business[5],
        }
    except Exception as e:
        logger.exception("Error updating business: %s", e)
        raise HTTPException(status_code=500, detail="Failed to update business")


@router.get("/survey-businesses", response_model=List[Dict])
async def get_survey_businesses(
    db: Session = Depends(get_db),
    _access: bool = Depends(require_roles(*B2B_ROLES)),
):
    """Get businesses formatted for the survey interface."""

    # Prefer Postgres
    try:
        rows = db.execute(
            text(
                """
                SELECT
                    b.id,
                    b.name,
                    b.location,
                    b.priority_level,
                    b.active,
                    ae.name AS account_executive_name,
                    ae.email AS account_executive_email
                FROM businesses b
                LEFT JOIN account_executives ae ON b.account_executive_id = ae.id
                WHERE b.active = true
                ORDER BY
                    CASE b.priority_level
                        WHEN 'large_corporate' THEN 1
                        WHEN 'high' THEN 1
                        WHEN 'sme' THEN 2
                        WHEN 'medium' THEN 2
                        WHEN 'low' THEN 2
                        ELSE 3
                    END,
                    b.name
                """
            )
        ).all()

        if rows:
            return [
                {
                    "id": row[0],
                    "name": row[1],
                    "location": row[2],
                    "priority_level": row[3],
                    "active": bool(row[4]),
                    "account_executive_name": row[5],
                    "account_executive_email": row[6],
                }
                for row in rows
            ]
    except Exception as e:
        logger.exception("Error fetching survey businesses from database: %s", e)

    # Fallback: legacy SQLite
    try:
        conn = sqlite3.connect("../dev_cx_platform.db")
        cursor = conn.cursor()

        cursor.execute(
            """
            SELECT
                b.id,
                b.name,
                b.location,
                b.priority_level,
                b.active,
                ae.name as account_executive_name,
                ae.email as account_executive_email
            FROM businesses b
            LEFT JOIN account_executives ae ON b.account_executive_id = ae.id
            WHERE b.active = 1
            ORDER BY
                CASE b.priority_level
                    WHEN 'large_corporate' THEN 1
                    WHEN 'high' THEN 1
                    WHEN 'sme' THEN 2
                    WHEN 'medium' THEN 2
                    WHEN 'low' THEN 2
                    ELSE 3
                END,
                b.name
            """
        )

        rows = cursor.fetchall()
        conn.close()

        return [
            {
                "id": row[0],
                "name": row[1],
                "location": row[2],
                "priority_level": row[3],
                "active": bool(row[4]),
                "account_executive_name": row[5],
                "account_executive_email": row[6],
            }
            for row in rows
        ]
    except Exception as e:
        logger.exception("Error fetching survey businesses from SQLite: %s", e)
        return []


@router.get("/questions")
async def get_questions(
    survey_type: str = "B2B",
    db: Session = Depends(get_db),
    _access: bool = Depends(require_roles(*ALL_PLATFORM_ROLES)),
):
    """Get all questions for the survey.

    `survey_type` is a codename/name (e.g., B2B, Mystery Shopper, Installation Assessment).
    Defaults to B2B for backward compatibility.
    """

    # Use the new database structure
    try:
        normalized_survey_type = (survey_type or "B2B").strip()
        _require_known_question_module(db, normalized_survey_type)
        has_question_number = has_column(db, "questions", "question_number")
        has_order_index = has_column(db, "questions", "order_index")
        has_survey_types = has_table(db, "survey_types")
        has_question_survey_type = has_column(db, "questions", "survey_type_id")
        has_survey_type_code = (
            has_column(db, "survey_types", "code") if has_survey_types else False
        )

        question_number_select = "q.id"
        if has_question_number:
            question_number_select = "q.question_number"
        elif has_order_index:
            question_number_select = "q.order_index"

        survey_type_select = "q.survey_type_id"
        join_clause = ""
        where_clause = ""

        if has_survey_types and has_question_survey_type:
            join_clause = "LEFT JOIN survey_types st ON q.survey_type_id = st.id"
            code_filter = "lower(st.name) = lower(:survey_type)"
            if has_survey_type_code:
                code_filter = "lower(st.code) = lower(:survey_type)"
            include_untyped_questions = is_b2b_survey_type(normalized_survey_type)
            null_survey_type_clause = (
                "OR q.survey_type_id IS NULL" if include_untyped_questions else ""
            )
            where_clause = """
                WHERE
                    lower(st.name) = lower(:survey_type)
                    OR {code_filter}
                    OR replace(lower(st.name), ' ', '') = replace(lower(:survey_type), ' ', '')
                    {null_survey_type_clause}
            """.format(
                code_filter=code_filter, null_survey_type_clause=null_survey_type_clause
            )
        else:
            survey_type_select = "NULL"

        rows = db.execute(
            text(
                f"""
                SELECT
                    q.id,
                    {survey_type_select} as survey_type_id,
                    {question_number_select} as question_number,
                    q.question_text,
                    q.category,
                    q.is_mandatory,
                    q.is_nps,
                    q.input_type,
                    q.score_min,
                    q.score_max,
                    q.choices,
                    q.helper_text,
                    q.requires_issue,
                    q.requires_escalation,
                    q.question_key
                FROM questions q
                {join_clause}
                {where_clause}
                ORDER BY {question_number_select}
                """
            ),
            {"survey_type": normalized_survey_type},
        ).all()

        questions = []
        for row in rows:
            choices = None
            if row[10] is not None:
                raw_choices = row[10]
                if isinstance(raw_choices, list):
                    choices = raw_choices
                elif isinstance(raw_choices, str):
                    try:
                        parsed = json.loads(raw_choices)
                        choices = parsed if isinstance(parsed, list) else None
                    except Exception:
                        choices = None

            if not choices:
                if row[7] == "yes_no":
                    choices = ["Y", "N"]
                elif row[7] == "always_sometimes_never":
                    choices = ["Always", "Sometimes", "Monthly", "Never"]

            questions.append(
                {
                    "id": row[0],
                    "survey_type_id": row[1],
                    "question_number": row[2],
                    "order_index": row[2],  # question_number
                    "question_text": row[3],
                    "category": row[4],
                    "is_mandatory": bool(row[5]),
                    "is_nps": bool(row[6]),
                    "input_type": row[7],
                    "score_min": row[8],
                    "score_max": row[9],
                    "choices": choices,
                    "helper_text": row[11],
                    "requires_issue": bool(row[12]),
                    "requires_escalation": bool(row[13]),
                    "question_key": row[14],
                    "order": row[2],  # Backward compatibility
                    "question_type": row[7],  # Backward compatibility
                }
            )

        return questions

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error fetching scoped questions: %s", e)
        raise HTTPException(status_code=500, detail="Question module scope is unavailable")


@router.get("/visits/drafts", response_model=List[VisitResponse])
async def get_draft_visits(
    db: Session = Depends(get_db),
    _access: bool = Depends(require_roles(*B2B_ROLES)),
):
    """Get all draft visits for the survey."""
    try:
        scope = _b2b_scope_or_500(db)
        if scope.survey_type_id is None:
            return []
        # Query B2B visits with business information
        query = """
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
        LEFT JOIN businesses b ON v.business_id = b.id
        WHERE (v.status = 'Draft' OR v.status IS NULL)
          AND v.survey_type_id = :survey_type_id
        ORDER BY b.priority_level, v.visit_date
        """

        result = db.execute(text(query), scope.params)
        visits = []

        for row in result:
            visits.append(
                {
                    "id": str(row[0]),
                    "business_id": row[1],
                    "business_name": row[2] or "Unknown Business",
                    "representative_id": row[3] or 0,
                    "visit_date": str(row[4]) if row[4] else "",
                    "visit_type": row[5] or "Assessment",
                    "status": row[6] or "draft",
                    "business_priority": row[7] or "medium",
                    "responses": [],
                }
            )

        return visits

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error fetching draft visits: %s", e)
        # Return empty list if there's an error
        return []


@router.get("/visits/{visit_id}")
async def get_visit_details(
    visit_id: str,
    db: Session = Depends(get_db),
    _access: bool = Depends(require_roles(*B2B_ROLES)),
):
    """Get detailed information about a specific visit."""
    try:
        _require_b2b_visit(db, visit_id)
        query = """
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
        LEFT JOIN businesses b ON v.business_id = b.id
        WHERE v.id = :visit_id
        """

        result = db.execute(text(query), {"visit_id": visit_id})
        row = result.fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="Visit not found")

        visit_data = {
            "id": str(row[0]),
            "business_id": row[1],
            "business_name": row[2] or "Unknown Business",
            "representative_id": row[3] or 0,
            "visit_date": str(row[4]) if row[4] else "",
            "visit_type": row[5] or "Assessment",
            "status": row[6] or "draft",
            "business_priority": row[7] or "medium",
            "responses": [],  # Empty responses for now
        }

        return visit_data

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error fetching visit details: %s", e)
        raise HTTPException(status_code=500, detail="Internal server error")


def _scoped_survey_responses(db: Session, visit_id: str) -> list[dict]:
    """Read the authoritative shared store, never an unrelated local SQLite file."""
    from .visits_dashboard import get_response_table, normalize_actions_value

    _require_b2b_visit(db, visit_id)
    scope = _b2b_scope_or_500(db)
    table = get_response_table(db)
    if table is None:
        raise HTTPException(status_code=500, detail="No response table found")
    rows = db.execute(
        text(f"""SELECT r.*, q.category, q.question_text, q.input_type AS question_type,
                        q.choices
                 FROM {table} r JOIN questions q ON q.id = r.question_id
                 WHERE r.visit_id = :visit_id
                   AND (q.survey_type_id IS NULL OR q.survey_type_id = :survey_type_id)
                 ORDER BY q.id"""),
        {"visit_id": visit_id, **scope.params},
    ).mappings().all()
    result = []
    for row in rows:
        response = dict(row)
        response["actions"] = normalize_actions_value(response.get("actions"))
        result.append(response)
    return result


@router.get("/survey-responses/{visit_id}")
async def get_survey_responses(
    visit_id: str,
    db: Session = Depends(get_db),
    _access: bool = Depends(require_roles(*B2B_ROLES)),
):
    """Get module-consistent B2B responses from the configured database."""
    return _scoped_survey_responses(db, visit_id)


@router.get("/survey-actions/{visit_id}")
async def get_survey_actions(
    visit_id: str,
    db: Session = Depends(get_db),
    _access: bool = Depends(require_roles(*B2B_ROLES)),
):
    """Get actions only from responses belonging to this B2B visit/module."""
    actions = []
    for response in _scoped_survey_responses(db, visit_id):
        for index, action in enumerate(response["actions"]):
            if isinstance(action, dict):
                actions.append({**action, "response_id": str(response["id"]),
                                "action_index": index,
                                "status": action.get("action_status", "Outstanding")})
    return actions


@router.get("/historical-surveys")
async def get_historical_surveys(
    db: Session = Depends(get_db),
    _access: bool = Depends(require_roles(*B2B_ROLES)),
):
    """Get approved B2B surveys with module-consistent response counts."""
    try:
        scope = _b2b_scope_or_500(db)
        if scope.survey_type_id is None:
            return []
        response_table = "b2b_visit_responses" if has_table(db, "b2b_visit_responses") else "responses"
        rows = db.execute(
            text(
                f"""
                SELECT
                    v.id, v.business_id, b.name AS business_name,
                    v.representative_id, v.visit_date, v.visit_type, v.status,
                    COUNT(CASE WHEN q.id IS NOT NULL THEN r.id END) AS response_count
                FROM visits v
                LEFT JOIN businesses b ON v.business_id = b.id
                LEFT JOIN {response_table} r ON v.id = r.visit_id
                LEFT JOIN questions q ON q.id = r.question_id
                    AND (q.survey_type_id IS NULL OR q.survey_type_id = :survey_type_id)
                WHERE v.status = 'Approved' AND v.survey_type_id = :survey_type_id
                GROUP BY v.id, b.name
                ORDER BY v.visit_date DESC
                """
            ),
            scope.params,
        ).all()
        return [
            {
                "id": row[0], "business_id": row[1], "business_name": row[2],
                "representative_id": row[3], "visit_date": row[4], "visit_type": row[5],
                "status": row[6], "response_count": int(row[7] or 0),
            }
            for row in rows
        ]
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error fetching historical surveys: %s", e)
        return []


async def save_visit_responses(
    visit_id: str, responses: Dict[str, Any], db: Session = Depends(get_db)
):
    """Save responses for a visit."""
    try:
        _require_b2b_visit(db, visit_id)
        # For now, just return success
        # In a real implementation, you would save to a responses table
        return {"message": "Responses saved successfully", "visit_id": visit_id}

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error saving responses: %s", e)
        raise HTTPException(status_code=500, detail="Failed to save responses")


@router.put("/visits/{visit_id}")
async def update_visit(
    visit_id: str,
    visit_data: Dict[str, Any],
    db: Session = Depends(get_db),
    _access: bool = Depends(require_roles(*B2B_ROLES)),
):
    """Update visit information."""
    try:
        _require_b2b_visit(db, visit_id)
        # For now, just return success
        # In a real implementation, you would update the visit
        return {"message": "Visit updated successfully", "visit_id": visit_id}

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error updating visit: %s", e)
        raise HTTPException(status_code=500, detail="Failed to update visit")
