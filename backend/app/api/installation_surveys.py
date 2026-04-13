from __future__ import annotations

import os
from datetime import date, datetime
from decimal import Decimal
from typing import Literal
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.orm import Session
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from ..core.auth.dependencies import INSTALL_ROLES, get_current_user, require_roles
from ..core.auth.entra import AuthUser
from ..core.database import get_db

router = APIRouter(prefix="/installation", tags=["installation"])

ALLOWED_CUSTOMER_TYPES = {"B2B", "B2C"}
ALLOWED_WORKER_TYPES = {"Field Team", "Contractor"}

INSTALLATION_QUESTION_FALLBACK = [
    {
        "question_number": 1,
        "category": "Technical Performance & Network Standards",
        "question_text": "Is the drop cable within installation length standard 3 pole max from FDP to house 180meters.",
        "score_min": 1,
        "score_max": 5,
    },
    {
        "question_number": 2,
        "category": "Technical Performance & Network Standards",
        "question_text": "Is there enough cable slack at FDP using the right FDP hole for running of drop cable.",
        "score_min": 1,
        "score_max": 5,
    },
    {
        "question_number": 3,
        "category": "Technical Performance & Network Standards",
        "question_text": "Is the trunking and internal cable as per standard, using the right clips or secure trunking with screw.",
        "score_min": 1,
        "score_max": 5,
    },
    {
        "question_number": 4,
        "category": "Technical Performance & Network Standards",
        "question_text": "Auditor verifies optimal signal (e.g., tests optical power, sound, or runs a speed test). TV displays clear picture/audio on all provisioned channels. Hardware is provisioned correctly on the network.",
        "score_min": 1,
        "score_max": 5,
    },
    {
        "question_number": 5,
        "category": "Physical Routing & Aesthetic Quality",
        "question_text": "Visual inspection confirms cables are neatly routed, clipped evenly, and concealed where possible. CPE (routers/set-top boxes) are placed in stable, unobstructed locations for optimal coverage. Is the device and socket properly install, level, neat and tidy.",
        "score_min": 1,
        "score_max": 5,
    },
    {
        "question_number": 6,
        "category": "Safety & Infrastructure Integrity",
        "question_text": "Visual inspection confirms exterior equipment is properly grounded. Correct outdoor-rated cabling was used for exterior drops. Exterior wall penetrations are properly sealed and weatherproofed.",
        "score_min": 1,
        "score_max": 5,
    },
    {
        "question_number": 7,
        "category": "Site Cleanliness & Property Damage",
        "question_text": "Audit confirms no leftover dust, drywall debris, wire clippings, or packaging left on the premises. No unauthorized modifications or damage to the customer's walls, skirting boards, or landscaping.",
        "score_min": 1,
        "score_max": 5,
    },
]


class InstallationResponseInput(BaseModel):
    question_number: int
    score: int = Field(ge=1, le=5)


class InstallationSurveyCreateRequest(BaseModel):
    inspector_name: str
    work_order: str
    customer_name: str
    customer_type: Literal["B2B", "B2C"]
    location: str
    date_work_done: date
    job_done_by: str
    responses: list[InstallationResponseInput]


def _normalize_worker_type(value: str | None) -> str:
    normalized = (value or "").strip().lower()
    if normalized in {"field team", "field_team", "field-team"}:
        return "Field Team"
    if normalized in {"contractor", "contractors"}:
        return "Contractor"
    return (value or "").strip()


def _normalize_customer_type(value: str | None) -> str:
    return (value or "").strip().upper()


def _to_float(value: Decimal | float | int | None) -> float | None:
    if value is None:
        return None
    return round(float(value), 2)


def _build_installation_where_clause(
    *,
    date_from: str | None = None,
    date_to: str | None = None,
    customer_type: str | None = None,
    worker_type: str | None = None,
):
    where = ["1=1"]
    params: dict[str, object] = {}
    if date_from:
        where.append("s.date_work_done >= :date_from")
        params["date_from"] = date_from
    if date_to:
        where.append("s.date_work_done <= :date_to")
        params["date_to"] = date_to
    normalized_customer_type = _normalize_customer_type(customer_type)
    if normalized_customer_type in ALLOWED_CUSTOMER_TYPES:
        where.append("s.customer_type = :customer_type")
        params["customer_type"] = normalized_customer_type
    normalized_worker_type = _normalize_worker_type(worker_type)
    if normalized_worker_type in ALLOWED_WORKER_TYPES:
        where.append("s.job_done_by = :worker_type")
        params["worker_type"] = normalized_worker_type
    return " AND ".join(where), params


def _get_installation_questions(db: Session) -> list[dict]:
    try:
        rows = db.execute(
            text(
                """
                SELECT question_number, category, question_text, score_min, score_max
                FROM installation_questions
                WHERE active = true
                ORDER BY question_number
                """
            )
        ).mappings().all()
        if not rows:
            return INSTALLATION_QUESTION_FALLBACK
        return [
            {
                "question_number": int(row["question_number"]),
                "category": row["category"],
                "question_text": row["question_text"],
                "score_min": int(row["score_min"]),
                "score_max": int(row["score_max"]),
            }
            for row in rows
        ]
    except Exception:
        return INSTALLATION_QUESTION_FALLBACK


@router.get("/questions", dependencies=[Depends(require_roles(*INSTALL_ROLES))])
def get_installation_questions(db: Session = Depends(get_db)):
    try:
        return _get_installation_questions(db)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to load installation questions: {exc}")


@router.post("/surveys", dependencies=[Depends(require_roles(*INSTALL_ROLES))])
def create_installation_survey(
    payload: InstallationSurveyCreateRequest,
    db: Session = Depends(get_db),
    current_user: AuthUser = Depends(get_current_user),
):
    inspector_name = payload.inspector_name.strip()
    work_order = payload.work_order.strip()
    customer_name = payload.customer_name.strip()
    location = payload.location.strip()
    customer_type = _normalize_customer_type(payload.customer_type)
    worker_type = _normalize_worker_type(payload.job_done_by)

    if not inspector_name:
        raise HTTPException(status_code=400, detail="Quality Assurance Inspector name is required")
    if not work_order:
        raise HTTPException(status_code=400, detail="Work order is required")
    if not customer_name:
        raise HTTPException(status_code=400, detail="Customer name is required")
    if not location:
        raise HTTPException(status_code=400, detail="Location is required")
    if customer_type not in ALLOWED_CUSTOMER_TYPES:
        raise HTTPException(status_code=400, detail="customer_type must be B2B or B2C")
    if worker_type not in ALLOWED_WORKER_TYPES:
        raise HTTPException(status_code=400, detail="job_done_by must be Field Team or Contractor")

    questions = _get_installation_questions(db)
    if not questions:
        raise HTTPException(status_code=500, detail="Installation question set is not configured")

    expected_numbers = {item["question_number"] for item in questions}
    submitted_numbers = {item.question_number for item in payload.responses}

    if len(payload.responses) != len(expected_numbers):
        raise HTTPException(status_code=400, detail=f"Exactly {len(expected_numbers)} question scores are required")
    if submitted_numbers != expected_numbers:
        raise HTTPException(status_code=400, detail="Responses must include all installation questions exactly once")

    score_map = {item.question_number: int(item.score) for item in payload.responses}
    overall_score = round(sum(score_map.values()) / len(expected_numbers), 2)

    survey_id = str(uuid4())
    created_by_name = (getattr(current_user, "name", "") or "").strip() or None
    created_by_email = (getattr(current_user, "email", "") or "").strip() or None

    try:
        db.execute(
            text(
                """
                INSERT INTO installation_surveys (
                    id,
                    inspector_name,
                    work_order,
                    customer_name,
                    customer_type,
                    location,
                    date_work_done,
                    job_done_by,
                    overall_score,
                    created_by_name,
                    created_by_email
                ) VALUES (
                    CAST(:id AS uuid),
                    :inspector_name,
                    :work_order,
                    :customer_name,
                    :customer_type,
                    :location,
                    :date_work_done,
                    :job_done_by,
                    :overall_score,
                    :created_by_name,
                    :created_by_email
                )
                """
            ),
            {
                "id": survey_id,
                "inspector_name": inspector_name,
                "work_order": work_order,
                "customer_name": customer_name,
                "customer_type": customer_type,
                "location": location,
                "date_work_done": payload.date_work_done,
                "job_done_by": worker_type,
                "overall_score": overall_score,
                "created_by_name": created_by_name,
                "created_by_email": created_by_email,
            },
        )

        question_map = {item["question_number"]: item["question_text"] for item in questions}
        for question_number in sorted(expected_numbers):
            db.execute(
                text(
                    """
                    INSERT INTO installation_survey_responses (
                        survey_id,
                        question_number,
                        question_text,
                        score
                    ) VALUES (
                        CAST(:survey_id AS uuid),
                        :question_number,
                        :question_text,
                        :score
                    )
                    """
                ),
                {
                    "survey_id": survey_id,
                    "question_number": question_number,
                    "question_text": question_map[question_number],
                    "score": score_map[question_number],
                },
            )

        db.commit()
        return {
            "survey_id": survey_id,
            "overall_score": overall_score,
            "total_questions": len(expected_numbers),
            "message": "Installation survey submitted successfully",
        }
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to save installation survey: {exc}")


@router.get("/surveys", dependencies=[Depends(require_roles(*INSTALL_ROLES))])
def list_installation_surveys(
    customer_name: str | None = None,
    inspector_name: str | None = None,
    work_order: str | None = None,
    location: str | None = None,
    date_work_done: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    customer_type: str | None = None,
    worker_type: str | None = None,
    db: Session = Depends(get_db),
):
    try:
        where = ["1=1"]
        params: dict[str, object] = {}

        if customer_name:
            where.append("LOWER(s.customer_name) LIKE LOWER(:customer_name)")
            params["customer_name"] = f"%{customer_name.strip()}%"
        if inspector_name:
            where.append("LOWER(s.inspector_name) LIKE LOWER(:inspector_name)")
            params["inspector_name"] = f"%{inspector_name.strip()}%"
        if work_order:
            where.append("LOWER(s.work_order) LIKE LOWER(:work_order)")
            params["work_order"] = f"%{work_order.strip()}%"
        if location:
            where.append("LOWER(s.location) LIKE LOWER(:location)")
            params["location"] = f"%{location.strip()}%"

        if date_work_done:
            where.append("s.date_work_done = :date_work_done")
            params["date_work_done"] = date_work_done
        if date_from:
            where.append("s.date_work_done >= :date_from")
            params["date_from"] = date_from
        if date_to:
            where.append("s.date_work_done <= :date_to")
            params["date_to"] = date_to

        normalized_customer_type = _normalize_customer_type(customer_type)
        if normalized_customer_type in ALLOWED_CUSTOMER_TYPES:
            where.append("s.customer_type = :customer_type")
            params["customer_type"] = normalized_customer_type

        normalized_worker_type = _normalize_worker_type(worker_type)
        if normalized_worker_type in ALLOWED_WORKER_TYPES:
            where.append("s.job_done_by = :worker_type")
            params["worker_type"] = normalized_worker_type

        rows = db.execute(
            text(
                f"""
                SELECT
                    s.id,
                    s.inspector_name,
                    s.work_order,
                    s.customer_name,
                    s.customer_type,
                    s.location,
                    s.date_work_done,
                    s.job_done_by,
                    s.overall_score,
                    s.created_by_name,
                    s.created_by_email,
                    s.created_at
                FROM installation_surveys s
                WHERE {' AND '.join(where)}
                ORDER BY s.date_work_done DESC, s.created_at DESC
                """
            ),
            params,
        ).mappings().all()

        return [
            {
                "survey_id": str(row["id"]),
                "inspector_name": row["inspector_name"],
                "work_order": row["work_order"],
                "customer_name": row["customer_name"],
                "customer_type": row["customer_type"],
                "location": row["location"],
                "date_work_done": row["date_work_done"].isoformat() if row["date_work_done"] else None,
                "job_done_by": row["job_done_by"],
                "overall_score": _to_float(row["overall_score"]),
                "created_by_name": row["created_by_name"],
                "created_by_email": row["created_by_email"],
                "created_at": row["created_at"].isoformat() if row["created_at"] else None,
            }
            for row in rows
        ]
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to list installation surveys: {exc}")


@router.get("/surveys/{survey_id}", dependencies=[Depends(require_roles(*INSTALL_ROLES))])
def get_installation_survey_detail(survey_id: str, db: Session = Depends(get_db)):
    try:
        survey = db.execute(
            text(
                """
                SELECT
                    id,
                    inspector_name,
                    work_order,
                    customer_name,
                    customer_type,
                    location,
                    date_work_done,
                    job_done_by,
                    overall_score,
                    created_by_name,
                    created_by_email,
                    created_at
                FROM installation_surveys
                WHERE id = CAST(:survey_id AS uuid)
                """
            ),
            {"survey_id": survey_id},
        ).mappings().first()

        if not survey:
            raise HTTPException(status_code=404, detail="Installation survey not found")

        response_rows = db.execute(
            text(
                """
                SELECT
                    r.question_number,
                    r.question_text,
                    r.score,
                    q.category
                FROM installation_survey_responses r
                LEFT JOIN installation_questions q ON r.question_number = q.question_number
                WHERE r.survey_id = CAST(:survey_id AS uuid)
                ORDER BY r.question_number
                """
            ),
            {"survey_id": survey_id},
        ).mappings().all()

        return {
            "survey_id": str(survey["id"]),
            "inspector_name": survey["inspector_name"],
            "work_order": survey["work_order"],
            "customer_name": survey["customer_name"],
            "customer_type": survey["customer_type"],
            "location": survey["location"],
            "date_work_done": survey["date_work_done"].isoformat() if survey["date_work_done"] else None,
            "job_done_by": survey["job_done_by"],
            "overall_score": _to_float(survey["overall_score"]),
            "created_by_name": survey["created_by_name"],
            "created_by_email": survey["created_by_email"],
            "created_at": survey["created_at"].isoformat() if survey["created_at"] else None,
            "responses": [
                {
                    "question_number": int(row["question_number"]),
                    "question_text": row["question_text"],
                    "category": row["category"],
                    "score": int(row["score"]),
                }
                for row in response_rows
            ],
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to load installation survey: {exc}")


@router.get("/analytics", dependencies=[Depends(require_roles(*INSTALL_ROLES))])
def get_installation_analytics(
    date_from: str | None = None,
    date_to: str | None = None,
    customer_type: str | None = None,
    worker_type: str | None = None,
    db: Session = Depends(get_db),
):
    try:
        where_sql, params = _build_installation_where_clause(
            date_from=date_from,
            date_to=date_to,
            customer_type=customer_type,
            worker_type=worker_type,
        )

        summary_row = db.execute(
            text(
                f"""
                SELECT
                    COUNT(*) AS total_surveys,
                    AVG(s.overall_score)::numeric(10,2) AS overall_average_score
                FROM installation_surveys s
                WHERE {where_sql}
                """
            ),
            params,
        ).mappings().first()

        customer_rows = db.execute(
            text(
                f"""
                SELECT
                    s.customer_type,
                    COUNT(*) AS survey_count,
                    AVG(s.overall_score)::numeric(10,2) AS average_score
                FROM installation_surveys s
                WHERE {where_sql}
                GROUP BY s.customer_type
                """
            ),
            params,
        ).mappings().all()
        customer_map = {row["customer_type"]: row for row in customer_rows}

        worker_rows = db.execute(
            text(
                f"""
                SELECT
                    s.job_done_by AS worker_type,
                    COUNT(*) AS survey_count,
                    AVG(s.overall_score)::numeric(10,2) AS average_score
                FROM installation_surveys s
                WHERE {where_sql}
                GROUP BY s.job_done_by
                """
            ),
            params,
        ).mappings().all()
        worker_map = {row["worker_type"]: row for row in worker_rows}

        question_rows = db.execute(
            text(
                """
                SELECT question_number, question_text
                FROM installation_questions
                WHERE active = true
                ORDER BY question_number
                """
            )
        ).mappings().all()

        question_avg_rows = db.execute(
            text(
                f"""
                SELECT
                    r.question_number,
                    AVG(r.score)::numeric(10,2) AS average_score,
                    COUNT(*) AS response_count
                FROM installation_survey_responses r
                JOIN installation_surveys s ON s.id = r.survey_id
                WHERE {where_sql}
                GROUP BY r.question_number
                """
            ),
            params,
        ).mappings().all()
        question_avg_map = {int(row["question_number"]): row for row in question_avg_rows}

        # Category averages: join questions with responses and group by category
        category_rows = db.execute(
            text(
                f"""
                SELECT
                    q.category,
                    AVG(r.score)::numeric(10,2) AS average_score,
                    COUNT(*) AS response_count
                FROM installation_survey_responses r
                JOIN installation_surveys s ON s.id = r.survey_id
                JOIN installation_questions q ON q.question_number = r.question_number
                WHERE {where_sql}
                GROUP BY q.category
                ORDER BY q.category
                """
            ),
            params,
        ).mappings().all()

        category_averages = [
            {
                "category": row["category"],
                "average_score": _to_float(row["average_score"]),
                "response_count": int(row["response_count"]),
            }
            for row in category_rows
        ]

        trend_rows = db.execute(
            text(
                f"""
                SELECT
                    date_trunc('month', s.date_work_done)::date AS period,
                    AVG(s.overall_score)::numeric(10,2) AS average_score,
                    COUNT(*) AS survey_count
                FROM installation_surveys s
                WHERE {where_sql}
                GROUP BY date_trunc('month', s.date_work_done)
                ORDER BY period
                """
            ),
            params,
        ).mappings().all()

        customer_type_averages = []
        for customer_type in ("B2B", "B2C"):
            row = customer_map.get(customer_type)
            customer_type_averages.append(
                {
                    "customer_type": customer_type,
                    "survey_count": int(row["survey_count"] or 0) if row else 0,
                    "average_score": _to_float(row["average_score"]) if row else None,
                }
            )

        worker_type_averages = []
        for worker_type in ("Field Team", "Contractor"):
            row = worker_map.get(worker_type)
            worker_type_averages.append(
                {
                    "worker_type": worker_type,
                    "survey_count": int(row["survey_count"] or 0) if row else 0,
                    "average_score": _to_float(row["average_score"]) if row else None,
                }
            )

        question_averages = []
        for question in question_rows:
            question_number = int(question["question_number"])
            avg_row = question_avg_map.get(question_number)
            question_averages.append(
                {
                    "question_number": question_number,
                    "question_text": question["question_text"],
                    "average_score": _to_float(avg_row["average_score"]) if avg_row else None,
                    "response_count": int(avg_row["response_count"] or 0) if avg_row else 0,
                }
            )

        thresholds = [
            {
                "range": "4 to 5",
                "label": "Pass - Excellent",
                "action": "High-quality install. No further action needed.",
            },
            {
                "range": "3 to 4",
                "label": "Pass - Needs Improvement",
                "action": "Minor issues. Auditor can correct minor items and log feedback.",
            },
            {
                "range": "2",
                "label": "Fail - Rework Required",
                "action": "Significant misses. Rework order should be generated.",
            },
            {
                "range": "1",
                "label": "Critical Fail",
                "action": "Major safety/property/network issue. Immediate escalation required.",
            },
        ]

        return {
            "summary": {
                "total_surveys": int(summary_row["total_surveys"] or 0) if summary_row else 0,
                "overall_average_score": _to_float(summary_row["overall_average_score"]) if summary_row else None,
            },
            "customer_type_averages": customer_type_averages,
            "worker_type_averages": worker_type_averages,
            "category_averages": category_averages,
            "question_averages": question_averages,
            "monthly_trend": [
                {
                    "period": row["period"].isoformat() if row["period"] else None,
                    "average_score": _to_float(row["average_score"]),
                    "survey_count": int(row["survey_count"] or 0),
                }
                for row in trend_rows
            ],
            "thresholds": thresholds,
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to load installation analytics: {exc}")


@router.get("/trends", dependencies=[Depends(require_roles(*INSTALL_ROLES))])
def get_installation_trends(
    date_from: str | None = None,
    date_to: str | None = None,
    customer_type: str | None = None,
    worker_type: str | None = None,
    db: Session = Depends(get_db),
):
    try:
        where_sql, params = _build_installation_where_clause(
            date_from=date_from,
            date_to=date_to,
            customer_type=customer_type,
            worker_type=worker_type,
        )

        overall_rows = db.execute(
            text(
                f"""
                SELECT
                    date_trunc('month', s.date_work_done)::date AS period,
                    AVG(s.overall_score)::numeric(10,2) AS average_score,
                    COUNT(*) AS survey_count
                FROM installation_surveys s
                WHERE {where_sql}
                GROUP BY date_trunc('month', s.date_work_done)
                ORDER BY period
                """
            ),
            params,
        ).mappings().all()

        question_rows = db.execute(
            text(
                f"""
                SELECT
                    date_trunc('month', s.date_work_done)::date AS period,
                    r.question_number,
                    q.question_text,
                    AVG(r.score)::numeric(10,2) AS average_score
                FROM installation_survey_responses r
                JOIN installation_surveys s ON s.id = r.survey_id
                JOIN installation_questions q ON q.question_number = r.question_number
                WHERE {where_sql}
                GROUP BY date_trunc('month', s.date_work_done), r.question_number, q.question_text
                ORDER BY period, r.question_number
                """
            ),
            params,
        ).mappings().all()

        customer_rows = db.execute(
            text(
                f"""
                SELECT
                    date_trunc('month', s.date_work_done)::date AS period,
                    s.customer_type,
                    AVG(s.overall_score)::numeric(10,2) AS average_score
                FROM installation_surveys s
                WHERE {where_sql}
                GROUP BY date_trunc('month', s.date_work_done), s.customer_type
                ORDER BY period, s.customer_type
                """
            ),
            params,
        ).mappings().all()

        worker_rows = db.execute(
            text(
                f"""
                SELECT
                    date_trunc('month', s.date_work_done)::date AS period,
                    s.job_done_by AS worker_type,
                    AVG(s.overall_score)::numeric(10,2) AS average_score
                FROM installation_surveys s
                WHERE {where_sql}
                GROUP BY date_trunc('month', s.date_work_done), s.job_done_by
                ORDER BY period, s.job_done_by
                """
            ),
            params,
        ).mappings().all()

        return {
            "overall_trend": [
                {
                    "period": row["period"].isoformat() if row["period"] else None,
                    "average_score": _to_float(row["average_score"]),
                    "survey_count": int(row["survey_count"] or 0),
                }
                for row in overall_rows
            ],
            "question_trends": [
                {
                    "period": row["period"].isoformat() if row["period"] else None,
                    "question_number": int(row["question_number"]),
                    "question_text": row["question_text"],
                    "average_score": _to_float(row["average_score"]),
                }
                for row in question_rows
            ],
            "customer_type_trends": [
                {
                    "period": row["period"].isoformat() if row["period"] else None,
                    "customer_type": row["customer_type"],
                    "average_score": _to_float(row["average_score"]),
                }
                for row in customer_rows
            ],
            "worker_type_trends": [
                {
                    "period": row["period"].isoformat() if row["period"] else None,
                    "worker_type": row["worker_type"],
                    "average_score": _to_float(row["average_score"]),
                }
                for row in worker_rows
            ],
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to load installation trends: {exc}")


class ReportEmailRequest(BaseModel):
    report_type: str
    date_from: str | None = None
    date_to: str | None = None
    survey_id: str | None = None
    to: list[str]
    subject: str | None = None
    message: str | None = None


@router.get("/reports/export", dependencies=[Depends(require_roles(*INSTALL_ROLES))])
def export_installation_report(
    report_type: str = "lifetime",
    date_from: str | None = None,
    date_to: str | None = None,
    survey_id: str | None = None,
    db: Session = Depends(get_db),
    current_user: AuthUser = Depends(get_current_user),
):
    try:
        # Build payload data
        where = ["1=1"]
        params: dict[str, object] = {}

        if date_from:
            where.append("s.date_work_done >= :date_from")
            params["date_from"] = date_from
        if date_to:
            where.append("s.date_work_done <= :date_to")
            params["date_to"] = date_to

        where_sql = " AND ".join(where)

        # Summary
        summary_row = db.execute(
            text(
                f"""
                SELECT COUNT(*) AS total_surveys, AVG(overall_score)::numeric(10,2) AS overall_average_score
                FROM installation_surveys s
                WHERE {where_sql}
                """
            ),
            params,
        ).mappings().first()

        # Customer type averages
        customer_rows = db.execute(
            text(
                f"""
                SELECT s.customer_type, COUNT(*) AS survey_count, AVG(overall_score)::numeric(10,2) AS average_score
                FROM installation_surveys s
                WHERE {where_sql}
                GROUP BY s.customer_type
                """
            ),
            params,
        ).mappings().all()

        # Worker type averages
        worker_rows = db.execute(
            text(
                f"""
                SELECT s.job_done_by AS worker_type, COUNT(*) AS survey_count, AVG(overall_score)::numeric(10,2) AS average_score
                FROM installation_surveys s
                WHERE {where_sql}
                GROUP BY s.job_done_by
                """
            ),
            params,
        ).mappings().all()

        # Category averages
        category_rows = db.execute(
            text(
                f"""
                SELECT q.category, AVG(r.score)::numeric(10,2) AS average_score, COUNT(*) AS response_count
                FROM installation_survey_responses r
                JOIN installation_surveys s ON s.id = r.survey_id
                JOIN installation_questions q ON r.question_number = q.question_number
                WHERE {where_sql}
                GROUP BY q.category
                ORDER BY q.category
                """
            ),
            params,
        ).mappings().all()

        # Question averages
        question_rows = db.execute(
            text(
                """
                SELECT question_number, question_text
                FROM installation_questions
                WHERE active = true
                ORDER BY question_number
                """
            )
        ).mappings().all()

        question_avg_rows = db.execute(
            text(
                f"""
                SELECT r.question_number, AVG(r.score)::numeric(10,2) AS average_score, COUNT(*) AS response_count
                FROM installation_survey_responses r
                JOIN installation_surveys s ON s.id = r.survey_id
                WHERE {where_sql}
                GROUP BY r.question_number
                """
            ),
            params,
        ).mappings().all()
        question_avg_map = {int(row["question_number"]): row for row in question_avg_rows}

        # Monthly trend
        trend_rows = db.execute(
            text(
                f"""
                SELECT date_trunc('month', s.date_work_done)::date AS period,
                       AVG(s.overall_score)::numeric(10,2) AS average_score,
                       COUNT(*) AS survey_count
                FROM installation_surveys s
                WHERE {where_sql}
                GROUP BY date_trunc('month', s.date_work_done)
                ORDER BY period
                """
            ),
            params,
        ).mappings().all()

        # Single survey detail if requested
        survey_detail = None
        if survey_id:
            survey = db.execute(
                text(
                    """
                    SELECT id, inspector_name, work_order, customer_name, customer_type, location, date_work_done, job_done_by, overall_score, created_at
                    FROM installation_surveys
                    WHERE id = CAST(:survey_id AS uuid)
                    """
                ),
                {"survey_id": survey_id},
            ).mappings().first()

            if survey:
                response_rows = db.execute(
                    text(
                        """
                        SELECT r.question_number, r.question_text, r.score, q.category
                        FROM installation_survey_responses r
                        LEFT JOIN installation_questions q ON r.question_number = q.question_number
                        WHERE r.survey_id = CAST(:survey_id AS uuid)
                        ORDER BY r.question_number
                        """
                    ),
                    {"survey_id": survey_id},
                ).mappings().all()

                survey_detail = {
                    "survey_id": str(survey["id"]),
                    "inspector_name": survey["inspector_name"],
                    "work_order": survey["work_order"],
                    "customer_name": survey["customer_name"],
                    "customer_type": survey["customer_type"],
                    "location": survey["location"],
                    "date_work_done": survey["date_work_done"].isoformat() if survey["date_work_done"] else None,
                    "job_done_by": survey["job_done_by"],
                    "overall_score": _to_float(survey["overall_score"]),
                    "created_at": survey["created_at"].isoformat() if survey["created_at"] else None,
                    "responses": [
                        {
                            "question_number": int(row["question_number"]),
                            "question_text": row["question_text"],
                            "category": row["category"],
                            "score": int(row["score"]),
                        }
                        for row in response_rows
                    ],
                }

        # Build payload
        payload = {
            "summary": {
                "total_surveys": int(summary_row["total_surveys"] or 0) if summary_row else 0,
                "overall_average_score": _to_float(summary_row["overall_average_score"]) if summary_row else None,
            },
            "customer_type_averages": [
                {
                    "customer_type": row["customer_type"],
                    "survey_count": int(row["survey_count"]),
                    "average_score": _to_float(row["average_score"]),
                }
                for row in customer_rows
            ],
            "worker_type_averages": [
                {
                    "worker_type": row["worker_type"],
                    "survey_count": int(row["survey_count"]),
                    "average_score": _to_float(row["average_score"]),
                }
                for row in worker_rows
            ],
            "category_averages": [
                {
                    "category": row["category"],
                    "average_score": _to_float(row["average_score"]),
                    "response_count": int(row["response_count"]),
                }
                for row in category_rows
            ],
            "question_averages": [
                {
                    "question_number": int(q["question_number"]),
                    "question_text": q["question_text"],
                    "average_score": _to_float(question_avg_map.get(int(q["question_number"]), {}).get("average_score")),
                    "response_count": int(question_avg_map.get(int(q["question_number"]), {}).get("response_count", 0)),
                }
                for q in question_rows
            ],
            "monthly_trend": [
                {
                    "period": row["period"].isoformat() if row["period"] else None,
                    "average_score": _to_float(row["average_score"]),
                    "survey_count": int(row["survey_count"]),
                }
                for row in trend_rows
            ],
            "survey_detail": survey_detail,
            "scoring_range": "1-5",
        }

        # Render HTML for preview
        report_html = render_installation_report_html(payload, getattr(current_user, "name", "Unknown User"))

        return {
            "report": payload,
            "report_html": report_html,
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to build installation report: {exc}")


@router.post("/reports/email", dependencies=[Depends(require_roles(*INSTALL_ROLES))])
def email_installation_report(
    request: ReportEmailRequest,
    db: Session = Depends(get_db),
    current_user: AuthUser = Depends(get_current_user),
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

    # Build report payload
    params = {
        "report_type": request.report_type,
        "date_from": request.date_from,
        "date_to": request.date_to,
        "survey_id": request.survey_id,
    }
    payload = export_installation_report(
        report_type=request.report_type,
        date_from=request.date_from,
        date_to=request.date_to,
        survey_id=request.survey_id,
        db=db,
    )

    # Render HTML
    report_html = render_installation_report_html(payload, getattr(current_user, "name", "Unknown User"))

    subject = request.subject or "Installation Assessment Report"
    message = MIMEMultipart("alternative")
    message["Subject"] = subject
    message["From"] = smtp_from
    message["To"] = ", ".join(request.to)

    intro_text = request.message or "Please find the installation assessment report below."
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
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to send email: {exc}")

    return {"message": f"Report emailed to {len(request.to)} recipient(s)", "recipients": request.to}



def render_installation_report_html(payload: dict, generated_by: str) -> str:
    summary = payload.get("summary", {})
    total_surveys = summary.get("total_surveys", 0)
    overall_avg = summary.get("overall_average_score")

    customer_type_averages = payload.get("customer_type_averages", [])
    worker_type_averages = payload.get("worker_type_averages", [])
    category_averages = payload.get("category_averages", [])
    question_averages = payload.get("question_averages", [])
    monthly_trend = payload.get("monthly_trend", [])
    survey_detail = payload.get("survey_detail")
    scoring_range = payload.get("scoring_range", "1-5")

    def number(num):
        if num is None:
            return "—"
        if isinstance(num, (int, float)):
            return f"{num:.2f}"
        return str(num)

    def format_period(period_str):
        if not period_str:
            return "—"
        try:
            from datetime import datetime
            dt = datetime.fromisoformat(period_str[:10])
            return dt.strftime("%b %Y")
        except:
            return period_str[:7]

    def score_color_install(avg):
        """Return color for installation score (1-5 scale)."""
        try:
            a = float(avg)
            if a >= 4.5: return "#22c55e"
            if a >= 3.5: return "#84cc16"
            if a >= 2.5: return "#f59e0b"
            return "#ef4444"
        except:
            return None

    # Build question scores table rows
    question_rows_html = ""
    if survey_detail:
        grouped = {}
        for resp in survey_detail.get("responses", []):
            cat = resp.get("category") or "Uncategorized"
            grouped.setdefault(cat, []).append(resp)
        for cat, items in grouped.items():
            question_rows_html += f"<tr><td colspan='3' class='font-semibold bg-muted py-1 px-2'>{cat}</td></tr>"
            for item in items:
                question_rows_html += f"<tr><td class='py-1 px-2'>Q{item['question_number']}: {item['question_text']}</td><td class='text-center'>{item['score']}</td><td class='text-center'>{scoring_range}</td></tr>"
    else:
        for qa in question_averages:
            avg = qa.get('average_score')
            avg_display = number(avg)
            color = score_color_install(avg)
            if color:
                avg_display = f"<span style='color:{color};font-weight:600'>{avg_display}</span>"
            question_rows_html += f"<tr><td class='py-1 px-2'>Q{qa['question_number']}: {qa['question_text']}</td><td class='text-center'>{avg_display}</td><td class='text-center'>{scoring_range}</td></tr>"

    # Build category table rows (without response count)
    category_rows_html = ""
    for cat in category_averages:
        category_rows_html += f"<tr><td class='py-1 px-2'>{cat['category']}</td><td class='text-center'>{number(cat['average_score'])}</td></tr>"

    # Generate horizontal bar visualization for category averages
    category_bars_html = ""
    for cat in category_averages:
        cat_name = cat['category']
        avg = float(cat['average_score'] or 0)
        color = score_color_install(avg)
        width = min(100, max(0, (avg / 5) * 100))
        category_bars_html += (
            f"<div class='bar-row'>"
            f"<div class='bar-label'>{cat_name}</div>"
            f"<div class='bar-track'><div class='bar-fill' style='width:{width}%;background:{color}'></div></div>"
            f"<div class='bar-value' style='color:{color}'>{number(avg)}</div>"
            f"</div>"
        )

    html = f"""
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Installation Assessment Report</title>
  <style>
    body {{ font-family: Arial, sans-serif; margin: 20px; }}
    h1, h2, h3 {{ color: #1e293b; }}
    .report-meta {{ color: #64748b; font-size: 0.9rem; margin-bottom: 1rem; }}
    table {{ border-collapse: collapse; width: 100%; margin-bottom: 1rem; }}
    th, td {{ border: 1px solid #e2e8f0; padding: 8px; }}
    th {{ background: #f1f5f9; }}
    .grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1rem; }}
    .stat-card {{ border: 1px solid #e2e8f0; padding: 1rem; border-radius: 6px; }}
    .stat-title {{ font-size: 0.8rem; color: #64748b; text-transform: uppercase; }}
    .stat-value {{ font-size: 1.5rem; font-weight: 700; color: #0f766e; }}
    .bar-row {{ display: grid; grid-template-columns: 180px 1fr 60px; align-items: center; gap: 8px; margin: 6px 0; font-size: 12px; }}
    .bar-label {{ color: #475569; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }}
    .bar-track {{ height: 10px; background: #e2e8f0; border-radius: 999px; overflow: hidden; }}
    .bar-fill {{ height: 100%; border-radius: 999px; }}
    .bar-value {{ text-align: right; font-weight: 600; }}
  </style>
</head>
<body>
  <h1>Installation Assessment Report</h1>
  <p class="report-meta">Generated by: {generated_by} | Generated at: {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}</p>
"""

    if survey_detail:
        s = survey_detail
        html += f"""
        <h2>Survey Detail Report</h2>
        <div class='grid'>
          <div class='stat-card'><div class='stat-title'>Customer</div><div class='stat-value'>{s['customer_name']}</div></div>
          <div class='stat-card'><div class='stat-title'>Location</div><div class='stat-value'>{s['location']}</div></div>
          <div class='stat-card'><div class='stat-title'>Date Work Done</div><div class='stat-value'>{s['date_work_done']}</div></div>
          <div class='stat-card'><div class='stat-title'>Overall Score</div><div class='stat-value'>{number(s['overall_score'])}</div></div>
        </div>
        <p><strong>Inspector/Auditor:</strong> {s['inspector_name']}</p>
        <p><strong>Customer Type:</strong> {s['customer_type']}</p>
        <p><strong>Worker Type:</strong> {s['job_done_by']}</p>
        <h3>Question Scores (Range: {scoring_range})</h3>
        <table>
          <thead><tr><th>Question</th><th>Score</th><th>Range</th></tr></thead>
          <tbody>{question_rows_html}</tbody>
        </table>
        """
    else:
        html += f"""
        <h2>Lifetime Analytics Report</h2>
        <div class='grid'>
          <div class='stat-card'><div class='stat-title'>Total Surveys</div><div class='stat-value'>{total_surveys}</div></div>
          <div class='stat-card'><div class='stat-title'>Overall Average</div><div class='stat-value'>{number(overall_avg)}</div></div>
        </div>

        <h3>Customer Type Averages</h3>
        <table>
          <thead><tr><th>Customer Type</th><th>Average Score</th><th>Survey Count</th></tr></thead>
          <tbody>
            {"".join(f"<tr><td>{ct['customer_type']}</td><td class='text-center'>{number(ct['average_score'])}</td><td class='text-center'>{ct['survey_count']}</td></tr>" for ct in customer_type_averages)}
          </tbody>
        </table>

        <h3>Worker Type Averages</h3>
        <table>
          <thead><tr><th>Worker Type</th><th>Average Score</th><th>Survey Count</th></tr></thead>
          <tbody>
            {"".join(f"<tr><td>{wt['worker_type']}</td><td class='text-center'>{number(wt['average_score'])}</td><td class='text-center'>{wt['survey_count']}</td></tr>" for wt in worker_type_averages)}
          </tbody>
        </table>

        <h3>Category Averages</h3>
        <table>
          <thead><tr><th>Category</th><th>Average Score</th></tr></thead>
          <tbody>{category_rows_html}</tbody>
        </table>

        <h3>Category Score Overview</h3>
        <div class="card" style="border:1px solid #e2e8f0; border-radius:8px; padding:12px; background:#f9fafb; margin-bottom:4px;">
          <div class="label">Selected Scope Averages</div>
          {category_bars_html or '<p class="label">No category data</p>'}
        </div>

        <h3>Question Averages</h3>
        <table>
          <thead><tr><th>Question</th><th>Average</th><th>Range</th></tr></thead>
          <tbody>{question_rows_html}</tbody>
        </table>

        <h3>Monthly Trend</h3>
        <table>
          <thead><tr><th>Month</th><th>Average Score</th><th>Survey Count</th></tr></thead>
          <tbody>
            {"".join(f"<tr><td>{format_period(t['period'])}</td><td class='text-center'>{number(t['average_score'])}</td><td class='text-center'>{t['survey_count']}</td></tr>" for t in monthly_trend)}
          </tbody>
        </table>
        """

    html += f"""
      <hr style="margin: 2rem 0; border: none; border-top: 1px solid #e2e8f0;">
      <p style="color: #64748b; font-size: 0.8rem;">
        <strong>Scoring Range:</strong> {scoring_range}<br>
        <strong>Note:</strong> Scores are averages of all question responses. Higher scores indicate better installation quality.
      </p>
    </body>
    </html>
    """

    return html
