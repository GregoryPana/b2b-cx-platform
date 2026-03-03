from sqlalchemy import Boolean, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class Question(Base):
    __tablename__ = "questions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    category: Mapped[str] = mapped_column(String(200), nullable=False)
    question_key: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    question_text: Mapped[str] = mapped_column(String(2000), nullable=False)
    input_type: Mapped[str] = mapped_column(String(40), nullable=False, server_default="score")
    score_min: Mapped[int | None] = mapped_column(Integer, nullable=True)
    score_max: Mapped[int | None] = mapped_column(Integer, nullable=True)
    requires_issue: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    requires_escalation: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    helper_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_nps: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    is_mandatory: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
