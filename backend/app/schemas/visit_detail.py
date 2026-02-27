from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class MeetingAttendeeOut(BaseModel):
    id: int
    name: str
    role: str

    model_config = ConfigDict(from_attributes=True)


class ResponseActionItem(BaseModel):
    id: int
    action_required: str
    action_owner: str
    action_timeframe: str
    action_support_needed: str | None = None


class ResponseItem(BaseModel):
    response_id: int
    question_id: int
    score: int | None = None
    answer_text: str | None = None
    verbatim: str | None = None
    actions: list[ResponseActionItem]
    action_target: str | None = None
    priority_level: str | None = None
    due_date: date | None = None


class VisitDetail(BaseModel):
    visit_id: UUID
    business_id: int
    business_name: str
    business_priority: str
    representative_id: int
    visit_date: date
    visit_type: str
    escalation_occurred: bool
    issue_experienced: bool
    status: str
    reviewer_id: int | None = None
    review_timestamp: datetime | None = None
    change_notes: str | None = None
    approval_timestamp: datetime | None = None
    approval_notes: str | None = None
    rejection_notes: str | None = None
    attendees: list[MeetingAttendeeOut]
    responses: list[ResponseItem]

    model_config = ConfigDict(from_attributes=True)
