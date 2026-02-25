from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.auth import CurrentUser, require_roles
from app.core.db import get_db
from app.core.roles import ROLE_ADMIN, ROLE_REPRESENTATIVE, ROLE_REVIEWER
from app.models import Response, Visit, VisitStatus
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


def _validate_action_required(
    action_required: str | None,
    action_target: str | None,
    priority_level: str | None,
) -> None:
    if action_required and (not action_target or not priority_level):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="action_target and priority_level are required when action_required is set",
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

    _validate_action_required(
        payload.action_required,
        payload.action_target,
        payload.priority_level,
    )

    response = Response(
        visit_id=visit_id,
        question_id=payload.question_id,
        score=payload.score,
        verbatim=payload.verbatim,
        action_required=payload.action_required,
        action_target=payload.action_target,
        priority_level=payload.priority_level,
        due_date=payload.due_date,
    )
    db.add(response)
    db.commit()
    db.refresh(response)
    return ResponseOut(
        response_id=response.id,
        visit_id=response.visit_id,
        question_id=response.question_id,
        score=response.score,
        verbatim=response.verbatim,
        action_required=response.action_required,
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

    update_data = payload.model_dump(exclude_unset=True)
    next_action_required = update_data.get("action_required", response.action_required)
    next_action_target = update_data.get("action_target", response.action_target)
    next_priority_level = update_data.get("priority_level", response.priority_level)
    _validate_action_required(next_action_required, next_action_target, next_priority_level)
    for field, value in update_data.items():
        setattr(response, field, value)

    db.commit()
    db.refresh(response)
    return ResponseOut(
        response_id=response.id,
        visit_id=response.visit_id,
        question_id=response.question_id,
        score=response.score,
        verbatim=response.verbatim,
        action_required=response.action_required,
        action_target=response.action_target,
        priority_level=response.priority_level,
        due_date=response.due_date,
    )
