from datetime import date, datetime
from typing import List
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class MeetingAttendeeCreate(BaseModel):
    name: str
    role: str


class VisitCreate(BaseModel):
    business_id: int
    representative_id: int
    visit_date: date
    visit_type: str
    escalation_occurred: bool = False
    issue_experienced: bool = False
    meeting_attendees: List[MeetingAttendeeCreate] = Field(default_factory=list)


class VisitSubmit(BaseModel):
    submit_notes: str | None = None


class VisitDraftUpdate(BaseModel):
    representative_id: int | None = None
    visit_date: date | None = None
    visit_type: str | None = None
    escalation_occurred: bool | None = None
    issue_experienced: bool | None = None


class VisitNeedsChanges(BaseModel):
    change_notes: str = Field(min_length=1)


class VisitApprove(BaseModel):
    approval_notes: str | None = None


class VisitReject(BaseModel):
    rejection_notes: str = Field(min_length=1)


class VisitResponse(BaseModel):
    visit_id: UUID
    status: str
    business_id: int | None = None
    business_name: str | None = None
    business_priority: str | None = None
    created_by: int | None = None
    created_by_role: str | None = None
    created_by_name: str | None = None
    representative_id: int | None = None
    visit_date: date | None = None
    visit_type: str | None = None
    escalation_occurred: bool | None = None
    issue_experienced: bool | None = None
    reviewer_id: int | None = None
    review_timestamp: datetime | None = None
    change_notes: str | None = None
    approval_timestamp: datetime | None = None
    approval_notes: str | None = None
    rejection_notes: str | None = None
    mandatory_answered_count: int | None = None
    mandatory_total_count: int | None = None
    is_started: bool | None = None
    is_completed: bool | None = None

    model_config = ConfigDict(from_attributes=True)
