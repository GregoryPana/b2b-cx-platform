from typing import Literal

from pydantic import BaseModel, ConfigDict


class QuestionCreate(BaseModel):
    category: str
    question_key: str
    question_text: str
    input_type: Literal["score", "text", "yes_no", "always_sometimes_never"] = "score"
    score_min: int | None = None
    score_max: int | None = None
    requires_issue: bool = False
    requires_escalation: bool = False
    helper_text: str | None = None
    is_nps: bool = False
    is_mandatory: bool = True
    order_index: int = 0


class QuestionUpdate(BaseModel):
    category: str | None = None
    question_key: str | None = None
    question_text: str | None = None
    input_type: Literal["score", "text", "yes_no", "always_sometimes_never"] | None = None
    score_min: int | None = None
    score_max: int | None = None
    requires_issue: bool | None = None
    requires_escalation: bool | None = None
    helper_text: str | None = None
    is_nps: bool | None = None
    is_mandatory: bool | None = None
    order_index: int | None = None


class QuestionOut(BaseModel):
    id: int
    category: str
    question_key: str
    question_text: str
    input_type: Literal["score", "text", "yes_no", "always_sometimes_never"]
    score_min: int | None = None
    score_max: int | None = None
    requires_issue: bool
    requires_escalation: bool
    helper_text: str | None = None
    is_nps: bool
    is_mandatory: bool
    order_index: int

    model_config = ConfigDict(from_attributes=True)
