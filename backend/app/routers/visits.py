from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.auth import CurrentUser, require_roles
from app.core.db import get_db
from app.core.roles import ROLE_ADMIN, ROLE_REPRESENTATIVE, ROLE_REVIEWER
from app.models import MeetingAttendee, Visit, VisitStatus
from app.schemas.visit import (
    VisitApprove,
    VisitCreate,
    VisitNeedsChanges,
    VisitReject,
    VisitResponse,
    VisitSubmit,
)

router = APIRouter(prefix="/visits", tags=["visits"])


@router.post("", response_model=VisitResponse)
def create_visit(
    payload: VisitCreate,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_roles([ROLE_REPRESENTATIVE, ROLE_ADMIN])),
):
    if payload.representative_id != user.id and user.role != ROLE_ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    visit = Visit(
        business_id=payload.business_id,
        representative_id=payload.representative_id,
        visit_date=payload.visit_date,
        visit_type=payload.visit_type,
        status=VisitStatus.DRAFT,
    )
    db.add(visit)
    db.flush()

    for attendee in payload.meeting_attendees:
        db.add(
            MeetingAttendee(
                visit_id=visit.id,
                name=attendee.name,
                role=attendee.role,
            )
        )

    db.commit()
    db.refresh(visit)
    return VisitResponse(
        visit_id=visit.id,
        status=visit.status.value,
    )


@router.get("/my", response_model=list[VisitResponse])
def get_my_visits(
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_roles([ROLE_REPRESENTATIVE, ROLE_ADMIN])),
):
    visits = db.scalars(select(Visit).where(Visit.representative_id == user.id)).all()
    return [
        VisitResponse(
            visit_id=visit.id,
            status=visit.status.value,
            reviewer_id=visit.reviewer_id,
            review_timestamp=visit.review_timestamp,
            change_notes=visit.change_notes,
            approval_timestamp=visit.approval_timestamp,
            approval_notes=visit.approval_notes,
            rejection_notes=visit.rejection_notes,
        )
        for visit in visits
    ]


@router.get("/pending", response_model=list[VisitResponse])
def get_pending_visits(
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_roles([ROLE_REVIEWER, ROLE_ADMIN])),
):
    visits = db.scalars(select(Visit).where(Visit.status == VisitStatus.PENDING)).all()
    return [
        VisitResponse(
            visit_id=visit.id,
            status=visit.status.value,
            reviewer_id=visit.reviewer_id,
            review_timestamp=visit.review_timestamp,
            change_notes=visit.change_notes,
            approval_timestamp=visit.approval_timestamp,
            approval_notes=visit.approval_notes,
            rejection_notes=visit.rejection_notes,
        )
        for visit in visits
    ]


@router.put("/{visit_id}/submit", response_model=VisitResponse)
def submit_visit(
    visit_id: UUID,
    _payload: VisitSubmit,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_roles([ROLE_REPRESENTATIVE, ROLE_ADMIN])),
):
    visit = db.get(Visit, visit_id)
    if not visit:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Visit not found")
    if visit.representative_id != user.id and user.role != ROLE_ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    if visit.status not in {VisitStatus.DRAFT, VisitStatus.NEEDS_CHANGES}:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Invalid state transition")

    visit.status = VisitStatus.PENDING
    visit.change_notes = None
    visit.reviewer_id = None
    visit.review_timestamp = None
    db.commit()
    db.refresh(visit)
    return VisitResponse(visit_id=visit.id, status=visit.status.value)


@router.put("/{visit_id}/needs-changes", response_model=VisitResponse)
def mark_needs_changes(
    visit_id: UUID,
    payload: VisitNeedsChanges,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_roles([ROLE_REVIEWER, ROLE_ADMIN])),
):
    visit = db.get(Visit, visit_id)
    if not visit:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Visit not found")
    if visit.status != VisitStatus.PENDING:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Invalid state transition")

    visit.status = VisitStatus.NEEDS_CHANGES
    visit.reviewer_id = user.id
    visit.review_timestamp = datetime.utcnow()
    visit.change_notes = payload.change_notes
    db.commit()
    db.refresh(visit)
    return VisitResponse(
        visit_id=visit.id,
        status=visit.status.value,
        reviewer_id=visit.reviewer_id,
        review_timestamp=visit.review_timestamp,
        change_notes=visit.change_notes,
    )


@router.put("/{visit_id}/approve", response_model=VisitResponse)
def approve_visit(
    visit_id: UUID,
    payload: VisitApprove,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_roles([ROLE_REVIEWER, ROLE_ADMIN])),
):
    visit = db.get(Visit, visit_id)
    if not visit:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Visit not found")
    if visit.status != VisitStatus.PENDING:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Invalid state transition")

    visit.status = VisitStatus.APPROVED
    visit.reviewer_id = user.id
    visit.approval_timestamp = datetime.utcnow()
    visit.approval_notes = payload.approval_notes
    db.commit()
    db.refresh(visit)
    return VisitResponse(
        visit_id=visit.id,
        status=visit.status.value,
        reviewer_id=visit.reviewer_id,
        approval_timestamp=visit.approval_timestamp,
        approval_notes=visit.approval_notes,
    )


@router.put("/{visit_id}/reject", response_model=VisitResponse)
def reject_visit(
    visit_id: UUID,
    payload: VisitReject,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_roles([ROLE_REVIEWER, ROLE_ADMIN])),
):
    visit = db.get(Visit, visit_id)
    if not visit:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Visit not found")
    if visit.status != VisitStatus.PENDING:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Invalid state transition")

    visit.status = VisitStatus.REJECTED
    visit.reviewer_id = user.id
    visit.review_timestamp = datetime.utcnow()
    visit.rejection_notes = payload.rejection_notes
    db.commit()
    db.refresh(visit)
    return VisitResponse(
        visit_id=visit.id,
        status=visit.status.value,
        reviewer_id=visit.reviewer_id,
        review_timestamp=visit.review_timestamp,
        rejection_notes=visit.rejection_notes,
    )
