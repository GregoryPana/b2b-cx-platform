from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.auth import CurrentUser, require_roles
from app.core.db import get_db
from app.core.roles import ROLE_ADMIN, ROLE_MANAGER, ROLE_REPRESENTATIVE, ROLE_REVIEWER
from app.models import Question
from app.schemas.question import QuestionCreate, QuestionOut, QuestionUpdate

router = APIRouter(prefix="/questions", tags=["questions"])


def _normalize_score_bounds(question: Question) -> None:
    if question.input_type == "score":
        question.score_min = 0
        question.score_max = 10
    else:
        question.score_min = None
        question.score_max = None


@router.get("", response_model=list[QuestionOut])
def list_questions(
    db: Session = Depends(get_db),
    _user: CurrentUser = Depends(
        require_roles([ROLE_REPRESENTATIVE, ROLE_REVIEWER, ROLE_MANAGER, ROLE_ADMIN])
    ),
):
    return db.scalars(select(Question).order_by(Question.order_index)).all()


@router.post("", response_model=QuestionOut, status_code=status.HTTP_201_CREATED)
def create_question(
    payload: QuestionCreate,
    db: Session = Depends(get_db),
    _user: CurrentUser = Depends(require_roles([ROLE_ADMIN])),
):
    question = Question(**payload.model_dump())
    _normalize_score_bounds(question)
    db.add(question)
    db.commit()
    db.refresh(question)
    return question


@router.put("/{question_id}", response_model=QuestionOut)
def update_question(
    question_id: int,
    payload: QuestionUpdate,
    db: Session = Depends(get_db),
    _user: CurrentUser = Depends(require_roles([ROLE_ADMIN])),
):
    question = db.get(Question, question_id)
    if not question:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(question, field, value)

    _normalize_score_bounds(question)

    db.commit()
    db.refresh(question)
    return question
