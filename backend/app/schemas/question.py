from pydantic import BaseModel, ConfigDict


class QuestionCreate(BaseModel):
    category: str
    question_text: str
    is_nps: bool = False
    is_mandatory: bool = True
    order_index: int = 0


class QuestionUpdate(BaseModel):
    category: str | None = None
    question_text: str | None = None
    is_nps: bool | None = None
    is_mandatory: bool | None = None
    order_index: int | None = None


class QuestionOut(BaseModel):
    id: int
    category: str
    question_text: str
    is_nps: bool
    is_mandatory: bool
    order_index: int

    model_config = ConfigDict(from_attributes=True)
