from __future__ import annotations

from datetime import date, datetime
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, validator
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..core.auth.dependencies import get_current_user
from ..core.auth.entra import AuthUser
from ..core.database import get_db


router = APIRouter(prefix="/installation", tags=["installation"])

INSTALLATION_SURVEY_NAME = "Installation Assessment"
INSTALLATION_SURVEY_CODE_CANDIDATES = (
    "installation_assessment",
    "install",
    "installation",
    "installation_assessment_survey",
)
_SURVEY_TYPE_ID_CACHE: int | None = None
_SURVEY_TYPES_HAS_CODE_COLUMN: bool | None = None


def _threshold_band(score: float) -> dict[str, str]:
    if score >= 4:
        return {
            "key": "excellent",
            "label": "Pass - Excellent",
            "description": "High-quality install. No further action needed.",
        }
    if score >= 3:
        return {
            "key": "needs_improvement",
            "label": "Pass - Needs Improvement",
            "description": "Minor touch-ups logged for the technician/contractor.",
        }
    if score >= 2:
        return {
            "key": "rework",
            "label": "Fail - Rework Required",
            "description": "Significant misses. Schedule rework order for original team.",
        }
    return {
        "key": "critical",
        "label": "Critical Fail",
        "description": "Escalate immediately for safety/property damage risks.",
    }


def _survey_types_supports_code(db: Session) -> bool:
    global _SURVEY_TYPES_HAS_CODE_COLUMN
    if _SURVEY_TYPES_HAS_CODE_COLUMN is not None:
        return _SURVEY_TYPES_HAS_CODE_COLUMN
    result = db.execute(
        text(
            """
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'survey_types'
              AND column_name = 'code'
            LIMIT 1
            """
        )
    ).scalar()
    _SURVEY_TYPES_HAS_CODE_COLUMN = bool(result)
    return _SURVEY_TYPES_HAS_CODE_COLUMN


def _get_installation_survey_type_id(db: Session) -> int:
    global _SURVEY_TYPE_ID_CACHE
    if _SURVEY_TYPE_ID_CACHE is not None:
        return _SURVEY_TYPE_ID_CACHE

    row = db.execute(
        text(
            """
            SELECT id
            FROM survey_types
            WHERE lower(name) = :name
            ORDER BY id
            LIMIT 1
            """
        ),
        {"name": INSTALLATION_SURVEY_NAME.lower()},
    ).scalar()

    if row is None and _survey_types_supports_code(db):
        for candidate in INSTALLATION_SURVEY_CODE_CANDIDATES:
            row = db.execute(
                text(
                    """
                    SELECT id
                    FROM survey_types
                    WHERE lower(code) = :code
                    ORDER BY id
                    LIMIT 1
                    """
                ),
                {"code": candidate.lower()},
            ).scalar()
            if row is not None:
                break

    if row is None:
        raise HTTPException(status_code=500, detail="Installation survey type not configured in database")

    _SURVEY_TYPE_ID_CACHE = int(row)
    return _SURVEY_TYPE_ID_CACHE


def _load_question_bank(db: Session) -> list[dict[str, Any]]:
    survey_type_id = _get_installation_survey_type_id(db)
    rows = db.execute(
        text(
            """
            SELECT
                question_number,
                COALESCE(question_key, CONCAT('install_q', question_number::text)) AS question_key,
                COALESCE(category, 'General') AS category,
                question_text,
                COALESCE(score_min, 1) AS score_min,
                COALESCE(score_max, 5) AS score_max,
                COALESCE(input_type, 'score') AS input_type,
                COALESCE(is_mandatory, true) AS is_mandatory
            FROM questions
            WHERE survey_type_id = :survey_type_id
            ORDER BY question_number
            """
        ),
        {"survey_type_id": survey_type_id},
    ).mappings().all()

    if not rows:
        raise HTTPException(status_code=500, detail="Installation question bank is empty")

    return [dict(row) for row in rows]


class InstallationQuestionResponse(BaseModel):
    question_number: int = Field(..., ge=1)
    score: int = Field(..., ge=1, le=5)
    notes: str | None = Field(default=None, max_length=2000)


class InstallationAssessmentCreate(BaseModel):
    representative_name: str | None = Field(default=None, max_length=255)
    customer_name: str = Field(..., max_length=255)
    customer_type: str = Field(..., pattern=r"^(B2B|B2C)$")
    location: str = Field(..., max_length=255)
    work_date: date
    responses: list[InstallationQuestionResponse]


class InstallationAssessmentResponseItem(BaseModel):
    question_number: int
    question_key: str
    category: str
    question_text: str
    score: int
    notes: str | None = None


class InstallationAssessmentRecord(BaseModel):
    id: str
    representative_name: str
    customer_name: str
    customer_type: str
    location: str
    work_date: date
    overall_score: float
    threshold_band: str
    threshold_label: str
    created_at: datetime
    responses: list[InstallationAssessmentResponseItem] = []


@router.get("/questions")
def get_installation_questions(db: Session = Depends(get_db)):
    questions = _load_question_bank(db)
    return [
        {
            "question_number": item["question_number"],
            "question_key": item["question_key"],
            "category": item["category"],
            "question_text": item["question_text"],
            "input_type": item["input_type"],
            "score_min": item["score_min"],
            "score_max": item["score_max"],
            "is_mandatory": item["is_mandatory"],
        }
        for item in questions
    ]


@router.post("/assessments", response_model=InstallationAssessmentRecord)
def create_installation_assessment(
    payload: InstallationAssessmentCreate,
    db: Session = Depends(get_db),
    current_user: AuthUser = Depends(get_current_user),
):
    question_bank = _load_question_bank(db)
    question_map = {question["question_number"]: question for question in question_bank}
    responses_map = {response.question_number: response for response in payload.responses}
    missing_numbers = [
        question_number
        for question_number in sorted(question_map)
        if question_number not in responses_map
    ]
    if missing_numbers:
        raise HTTPException(
            status_code=400,
            detail=f"Missing responses for question numbers: {', '.join(str(num) for num in missing_numbers)}",
        )

    invalid_numbers = [number for number in responses_map if number not in question_map]
    if invalid_numbers:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown question numbers supplied: {', '.join(str(num) for num in invalid_numbers)}",
        )

    for number, response in responses_map.items():
        question = question_map[number]
        min_score = question["score_min"]
        max_score = question["score_max"]
        if response.score < min_score or response.score > max_score:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Score for question {number} must be between {min_score} and {max_score}."
                ),
            )

    score_values = [responses_map[number].score for number in responses_map]
    overall_score = sum(score_values) / len(score_values)
    band = _threshold_band(overall_score)

    representative_name = (payload.representative_name or current_user.name or current_user.preferred_username or "Unknown Representative").strip()
    assessment_id = str(uuid4())

    insert_payload = {
        "id": assessment_id,
        "inspector_name": representative_name,
        "customer_name": payload.customer_name.strip(),
        "customer_type": payload.customer_type,
        "location": payload.location.strip(),
        "work_date": payload.work_date,
        "execution_party": "Field Team",
        "overall_score": round(overall_score, 2),
        "threshold_band": band["key"],
    }

    try:
        db.execute(
            text(
                """
                INSERT INTO installation_assessments (
                    id, inspector_name, customer_name, customer_type, location,
                    work_date, execution_party, overall_score, threshold_band
                ) VALUES (
                    :id, :inspector_name, :customer_name, :customer_type, :location,
                    :work_date, :execution_party, :overall_score, :threshold_band
                )
                """
            ),
            insert_payload,
        )

        for question in question_bank:
            response = responses_map[question["question_number"]]
            db.execute(
                text(
                    """
                    INSERT INTO installation_assessment_responses (
                        assessment_id, question_number, question_key,
                        question_text, category, score, notes
                    ) VALUES (
                        :assessment_id, :question_number, :question_key,
                        :question_text, :category, :score, :notes
                    )
                    """
                ),
                {
                    "assessment_id": assessment_id,
                    "question_number": question["question_number"],
                    "question_key": question["question_key"],
                    "question_text": question["question_text"],
                    "category": question["category"],
                    "score": response.score,
                    "notes": response.notes.strip() if response.notes else None,
                },
            )

        db.commit()
    except Exception:
        db.rollback()
        raise

    record = _fetch_assessment(db, assessment_id)
    if record is None:
        raise HTTPException(status_code=500, detail="Failed to load saved assessment")
    return record


@router.get("/assessments", response_model=list[InstallationAssessmentRecord])
def list_installation_assessments(
    limit: int = Query(20, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    rows = db.execute(
        text(
            """
            SELECT
                id,
                inspector_name,
                customer_name,
                customer_type,
                location,
                work_date,
                overall_score,
                threshold_band,
                created_at
            FROM installation_assessments
            ORDER BY created_at DESC
            LIMIT :limit OFFSET :offset
            """
        ),
        {"limit": limit, "offset": offset},
    ).mappings().all()

    assessments: list[InstallationAssessmentRecord] = []
    for row in rows:
        responses = _fetch_responses(db, row["id"])
        band = _threshold_band(float(row["overall_score"]))
        assessments.append(
            InstallationAssessmentRecord(
                id=str(row["id"]),
                representative_name=row["inspector_name"],
                customer_name=row["customer_name"],
                customer_type=row["customer_type"],
                location=row["location"],
                work_date=row["work_date"],
                overall_score=float(row["overall_score"]),
                threshold_band=row["threshold_band"],
                threshold_label=band["label"],
                created_at=row["created_at"],
                responses=responses,
            )
        )
    return assessments


@router.get("/assessments/{assessment_id}", response_model=InstallationAssessmentRecord)
def get_installation_assessment(assessment_id: str, db: Session = Depends(get_db)):
    record = _fetch_assessment(db, assessment_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Assessment not found")
    return record


def _fetch_assessment(db: Session, assessment_id: str) -> InstallationAssessmentRecord | None:
    row = db.execute(
        text(
            """
            SELECT
                id,
                inspector_name,
                customer_name,
                customer_type,
                location,
                work_date,
                overall_score,
                threshold_band,
                created_at
            FROM installation_assessments
            WHERE id = :assessment_id
            """
        ),
        {"assessment_id": assessment_id},
    ).mappings().one_or_none()

    if not row:
        return None

    responses = _fetch_responses(db, row["id"])
    band = _threshold_band(float(row["overall_score"]))
    return InstallationAssessmentRecord(
        id=str(row["id"]),
        representative_name=row["inspector_name"],
        customer_name=row["customer_name"],
        customer_type=row["customer_type"],
        location=row["location"],
        work_date=row["work_date"],
        overall_score=float(row["overall_score"]),
        threshold_band=row["threshold_band"],
        threshold_label=band["label"],
        created_at=row["created_at"],
        responses=responses,
    )


def _fetch_responses(db: Session, assessment_id: str) -> list[InstallationAssessmentResponseItem]:
    rows = db.execute(
        text(
            """
            SELECT question_number, question_key, question_text, category, score, notes
            FROM installation_assessment_responses
            WHERE assessment_id = :assessment_id
            ORDER BY question_number
            """
        ),
        {"assessment_id": assessment_id},
    ).mappings().all()

    return [
        InstallationAssessmentResponseItem(
            question_number=row["question_number"],
            question_key=row["question_key"],
            question_text=row["question_text"],
            category=row["category"],
            score=row["score"],
            notes=row["notes"],
        )
        for row in rows
    ]
