from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.auth import CurrentUser, require_roles
from app.core.db import get_db
from app.core.roles import ROLE_ADMIN, ROLE_REPRESENTATIVE, ROLE_REVIEWER
from app.models import Question, Response, ResponseAction, Visit, VisitStatus
from app.schemas.response import ResponseCreate, ResponseOut, ResponseUpdate

router = APIRouter(prefix="/visits/{visit_id}/responses", tags=["responses"])


def _assert_can_edit(user: CurrentUser, visit: Visit) -> None:
    if user.role in {ROLE_ADMIN}:
        return
    if user.role == ROLE_REPRESENTATIVE and visit.representative_id == user.id:
        if visit.status in {VisitStatus.DRAFT, VisitStatus.NEEDS_CHANGES}:
            return
    if user.role == ROLE_REVIEWER:
        if visit.status in {VisitStatus.PENDING, VisitStatus.NEEDS_CHANGES}:
            return
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")


def _validate_actions(actions: list) -> None:
    for action in actions:
        required = (action.action_required or "").strip()
        owner = (action.action_owner or "").strip()
        timeframe = (action.action_timeframe or "").strip()

        if not required:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="action_required is required for each action",
            )

        if not owner or not timeframe:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="action_owner and action_timeframe are required for each action",
            )


def _validate_answer_against_question(
    *,
    question: Question,
    score: int | None,
    answer_text: str | None,
) -> None:
    if question.input_type == "score":
        if score is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="score is required for score questions",
            )

        if question.score_min is not None and score < question.score_min:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"score must be >= {question.score_min}",
            )

        if question.score_max is not None and score > question.score_max:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"score must be <= {question.score_max}",
            )

    if question.input_type == "text" and question.is_mandatory:
        if not answer_text or not answer_text.strip():
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="answer_text is required for this question",
            )

    if question.input_type == "yes_no":
        normalized = (answer_text or "").strip().upper()
        if normalized not in {"Y", "N"}:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="answer_text must be Y or N for yes/no questions",
            )

    if question.input_type == "always_sometimes_never":
        normalized = (answer_text or "").strip().lower()
        if normalized not in {"always", "sometimes", "never"}:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="answer_text must be Always, Sometimes, or Never",
            )


@router.post("", response_model=ResponseOut)
def create_response(
    visit_id: UUID,
    payload: ResponseCreate,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_roles([ROLE_REPRESENTATIVE, ROLE_REVIEWER, ROLE_ADMIN])),
):
    visit = db.get(Visit, visit_id)
    if not visit:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Visit not found")

    _assert_can_edit(user, visit)

    question = db.get(Question, payload.question_id)
    if not question:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")

    _validate_answer_against_question(
        question=question,
        score=payload.score,
        answer_text=payload.answer_text,
    )

    _validate_actions(payload.actions)

    response = Response(
        visit_id=visit_id,
        question_id=payload.question_id,
        score=payload.score,
        answer_text=payload.answer_text,
        verbatim=payload.verbatim,
        action_required=None,
        action_owner=None,
        action_timeframe=None,
        action_support_needed=None,
        action_target=payload.action_target,
        priority_level=payload.priority_level,
        due_date=payload.due_date,
    )
    db.add(response)
    db.flush()

    if payload.actions:
        db.add_all(
            [
                ResponseAction(
                    response_id=response.id,
                    action_required=action.action_required.strip(),
                    action_owner=action.action_owner.strip(),
                    action_timeframe=action.action_timeframe.strip(),
                    action_support_needed=(action.action_support_needed or "").strip() or None,
                )
                for action in payload.actions
            ]
        )

    db.commit()
    db.refresh(response)
    action_rows = db.scalars(
        select(ResponseAction).where(ResponseAction.response_id == response.id).order_by(ResponseAction.id)
    ).all()

    return ResponseOut(
        response_id=response.id,
        visit_id=response.visit_id,
        question_id=response.question_id,
        score=response.score,
        answer_text=response.answer_text,
        verbatim=response.verbatim,
        actions=action_rows,
        action_target=response.action_target,
        priority_level=response.priority_level,
        due_date=response.due_date,
    )


@router.put("/{response_id}", response_model=ResponseOut)
def update_response(
    visit_id: UUID,
    response_id: int,
    payload: ResponseUpdate,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_roles([ROLE_REPRESENTATIVE, ROLE_REVIEWER, ROLE_ADMIN])),
):
    visit = db.get(Visit, visit_id)
    if not visit:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Visit not found")

    _assert_can_edit(user, visit)

    response = db.scalar(
        select(Response).where(Response.id == response_id, Response.visit_id == visit_id)
    )
    if not response:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Response not found")

    question = db.get(Question, response.question_id)
    if not question:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")

    update_data = payload.model_dump(exclude_unset=True)

    next_score = update_data.get("score", response.score)
    next_answer_text = update_data.get("answer_text", response.answer_text)
    _validate_answer_against_question(
        question=question,
        score=next_score,
        answer_text=next_answer_text,
    )

    next_actions = update_data.get("actions")
    if next_actions is not None:
        _validate_actions(next_actions)

    for field, value in update_data.items():
        if field == "actions":
            continue
        setattr(response, field, value)

    if next_actions is not None:
        db.execute(delete(ResponseAction).where(ResponseAction.response_id == response.id))
        if next_actions:
            db.add_all(
                [
                    ResponseAction(
                        response_id=response.id,
                        action_required=action.action_required.strip(),
                        action_owner=action.action_owner.strip(),
                        action_timeframe=action.action_timeframe.strip(),
                        action_support_needed=(action.action_support_needed or "").strip() or None,
                    )
                    for action in next_actions
                ]
            )

    db.commit()
    db.refresh(response)
    action_rows = db.scalars(
        select(ResponseAction).where(ResponseAction.response_id == response.id).order_by(ResponseAction.id)
    ).all()

    return ResponseOut(
        response_id=response.id,
        visit_id=response.visit_id,
        question_id=response.question_id,
        score=response.score,
        answer_text=response.answer_text,
        verbatim=response.verbatim,
        actions=action_rows,
        action_target=response.action_target,
        priority_level=response.priority_level,
        due_date=response.due_date,
    )
