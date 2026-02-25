from datetime import date
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ResponseCreate(BaseModel):
    question_id: int
    score: int = Field(ge=0, le=10)
    verbatim: str
    action_required: str | None = None
    action_target: str | None = None
    priority_level: str | None = None
    due_date: date | None = None


class ResponseUpdate(BaseModel):
    score: int | None = Field(default=None, ge=0, le=10)
    verbatim: str | None = None
    action_required: str | None = None
    action_target: str | None = None
    priority_level: str | None = None
    due_date: date | None = None


class ResponseOut(BaseModel):
    response_id: int
    visit_id: UUID
    question_id: int
    score: int
    verbatim: str
    action_required: str | None = None
    action_target: str | None = None
    priority_level: str | None = None
    due_date: date | None = None

    model_config = ConfigDict(from_attributes=True)
