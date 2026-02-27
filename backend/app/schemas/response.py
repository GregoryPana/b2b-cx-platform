from datetime import date
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ResponseActionCreate(BaseModel):
    action_required: str
    action_owner: str
    action_timeframe: str
    action_support_needed: str | None = None


class ResponseActionOut(BaseModel):
    id: int
    action_required: str
    action_owner: str
    action_timeframe: str
    action_support_needed: str | None = None

    model_config = ConfigDict(from_attributes=True)


class ResponseCreate(BaseModel):
    question_id: int
    score: int | None = Field(default=None)
    answer_text: str | None = None
    verbatim: str | None = None
    actions: list[ResponseActionCreate] = Field(default_factory=list)
    action_target: str | None = None
    priority_level: str | None = None
    due_date: date | None = None


class ResponseUpdate(BaseModel):
    score: int | None = Field(default=None)
    answer_text: str | None = None
    verbatim: str | None = None
    actions: list[ResponseActionCreate] | None = None
    action_target: str | None = None
    priority_level: str | None = None
    due_date: date | None = None


class ResponseOut(BaseModel):
    response_id: int
    visit_id: UUID
    question_id: int
    score: int | None = None
    answer_text: str | None = None
    verbatim: str | None = None
    actions: list[ResponseActionOut] = Field(default_factory=list)
    action_target: str | None = None
    priority_level: str | None = None
    due_date: date | None = None

    model_config = ConfigDict(from_attributes=True)
