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


QUESTION_DEFINITIONS: list[dict[str, Any]] = [
    {
        "question_number": 1,
        "question_key": "install_drop_length",
        "category": "Technical Performance & Network Standards",
        "question_text": "Is the drop cable within installation length standard (max 3 poles / 180 m)?",
    },
    {
        "question_number": 2,
        "question_key": "install_fdp_slack",
        "category": "Technical Performance & Network Standards",
        "question_text": "Is there enough cable slack at the FDP using the right port for the drop cable?",
    },
    {
        "question_number": 3,
        "question_key": "install_trunking_standard",
        "category": "Technical Performance & Network Standards",
        "question_text": "Is the trunking/internal cable installed to spec using approved clips or screws?",
    },
    {
        "question_number": 4,
        "question_key": "install_signal_validation",
        "category": "Technical Performance & Network Standards",
        "question_text": "Does the auditor confirm optimal signal (power test / speed test / correct provisioning)?",
    },
    {
        "question_number": 5,
        "question_key": "install_routing_aesthetic",
        "category": "Physical Routing & Aesthetic Quality",
        "question_text": "Are cables neatly routed and devices installed level, neat, and unobstructed?",
    },
    {
        "question_number": 6,
        "question_key": "install_safety_integrity",
        "category": "Safety & Infrastructure Integrity",
        "question_text": "Are exterior penetrations sealed, grounded, and using outdoor-rated cabling?",
    },
    {
        "question_number": 7,
        "question_key": "install_cleanliness_damage",
        "category": "Site Cleanliness & Property Damage",
        "question_text": "Is the site free of debris or damage caused by the installation team?",
    },
]

QUESTION_INDEX = {item["question_number"]: item for item in QUESTION_DEFINITIONS}


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


class InstallationQuestionResponse(BaseModel):
    question_number: int = Field(..., ge=1)
    score: int = Field(..., ge=1, le=5)
    notes: str | None = Field(default=None, max_length=2000)


class InstallationAssessmentCreate(BaseModel):
    inspector_name: str | None = Field(default=None, max_length=255)
    customer_name: str = Field(..., max_length=255)
    customer_type: str = Field(..., regex=r"^(B2B|B2C)$")
    location: str = Field(..., max_length=255)
    work_date: date
    execution_party: str = Field(..., regex=r"^(Field Team|Contractor)$")
    team_name: str | None = Field(default=None, max_length=255)
    contractor_name: str | None = Field(default=None, max_length=255)
    responses: list[InstallationQuestionResponse]

    @validator("team_name", always=True)
    def validate_team_name(cls, value, values):
        if values.get("execution_party") == "Field Team" and not value:
            raise ValueError("Team name is required for Field Team installs")
        return value

    @validator("contractor_name", always=True)
    def validate_contractor_name(cls, value, values):
        if values.get("execution_party") == "Contractor" and not value:
            raise ValueError("Contractor name is required for contractor installs")
        return value


class InstallationAssessmentResponseItem(BaseModel):
    question_number: int
    question_key: str
    category: str
    question_text: str
    score: int
    notes: str | None = None


class InstallationAssessmentRecord(BaseModel):
    id: str
    inspector_name: str
    customer_name: str
    customer_type: str
    location: str
    work_date: date
    execution_party: str
    team_name: str | None
    contractor_name: str | None
    overall_score: float
    threshold_band: str
    threshold_label: str
    created_at: datetime
    responses: list[InstallationAssessmentResponseItem] = []


@router.get("/questions")
def get_installation_questions():
    return [
        {
            **question,
            "input_type": "score",
            "score_min": 1,
            "score_max": 5,
            "is_mandatory": True,
        }
        for question in QUESTION_DEFINITIONS
    ]


@router.post("/assessments", response_model=InstallationAssessmentRecord)
def create_installation_assessment(
    payload: InstallationAssessmentCreate,
    db: Session = Depends(get_db),
    current_user: AuthUser = Depends(get_current_user),
):
    responses_map = {response.question_number: response for response in payload.responses}
    missing_numbers = [
        question["question_number"]
        for question in QUESTION_DEFINITIONS
        if question["question_number"] not in responses_map
    ]
    if missing_numbers:
        raise HTTPException(
            status_code=400,
            detail=f"Missing responses for question numbers: {', '.join(str(num) for num in missing_numbers)}",
        )

    score_values = [responses_map[number].score for number in responses_map]
    overall_score = sum(score_values) / len(score_values)
    band = _threshold_band(overall_score)

    inspector_name = (payload.inspector_name or current_user.name or current_user.preferred_username or "Unknown Inspector").strip()
    assessment_id = str(uuid4())

    insert_payload = {
        "id": assessment_id,
        "inspector_name": inspector_name,
        "customer_name": payload.customer_name.strip(),
        "customer_type": payload.customer_type,
        "location": payload.location.strip(),
        "work_date": payload.work_date,
        "execution_party": payload.execution_party,
        "team_name": payload.team_name.strip() if payload.team_name else None,
        "contractor_name": payload.contractor_name.strip() if payload.contractor_name else None,
        "overall_score": round(overall_score, 2),
        "threshold_band": band["key"],
    }

    try:
        db.execute(
            text(
                """
                INSERT INTO installation_assessments (
                    id, inspector_name, customer_name, customer_type, location,
                    work_date, execution_party, team_name, contractor_name,
                    overall_score, threshold_band
                ) VALUES (
                    :id, :inspector_name, :customer_name, :customer_type, :location,
                    :work_date, :execution_party, :team_name, :contractor_name,
                    :overall_score, :threshold_band
                )
                """
            ),
            insert_payload,
        )

        for question in QUESTION_DEFINITIONS:
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
                execution_party,
                team_name,
                contractor_name,
                overall_score,
                threshold_band,
                created_at
            FROM installation_assessments
            ORDER BY created_at DESC
            LIMIT :limit OFFSET :offset
            """
        ),
        {"limit": limit, "offset": offset},
    ).all()

    assessments: list[InstallationAssessmentRecord] = []
    for row in rows:
        responses = _fetch_responses(db, row[0])
        band = _threshold_band(float(row[9]))
        assessments.append(
            InstallationAssessmentRecord(
                id=str(row[0]),
                inspector_name=row[1],
                customer_name=row[2],
                customer_type=row[3],
                location=row[4],
                work_date=row[5],
                execution_party=row[6],
                team_name=row[7],
                contractor_name=row[8],
                overall_score=float(row[9]),
                threshold_band=band["key"],
                threshold_label=band["label"],
                created_at=row[11],
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
                execution_party,
                team_name,
                contractor_name,
                overall_score,
                threshold_band,
                created_at
            FROM installation_assessments
            WHERE id = :assessment_id
            """
        ),
        {"assessment_id": assessment_id},
    ).one_or_none()

    if not row:
        return None

    responses = _fetch_responses(db, row[0])
    band = _threshold_band(float(row[9]))
    return InstallationAssessmentRecord(
        id=str(row[0]),
        inspector_name=row[1],
        customer_name=row[2],
        customer_type=row[3],
        location=row[4],
        work_date=row[5],
        execution_party=row[6],
        team_name=row[7],
        contractor_name=row[8],
        overall_score=float(row[9]),
        threshold_band=band["key"],
        threshold_label=band["label"],
        created_at=row[11],
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
    ).all()

    return [
        InstallationAssessmentResponseItem(
            question_number=row[0],
            question_key=row[1],
            question_text=row[2],
            category=row[3],
            score=row[4],
            notes=row[5],
        )
        for row in rows
    ]
