from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class MeetingAttendeeOut(BaseModel):
    id: int
    name: str
    role: str

    model_config = ConfigDict(from_attributes=True)


class ResponseItem(BaseModel):
    response_id: int
    question_id: int
    score: int
    verbatim: str
    action_required: str | None = None
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
