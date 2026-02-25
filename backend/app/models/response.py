import uuid

from sqlalchemy import Date, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class Response(Base):
    __tablename__ = "responses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    visit_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("visits.id"), nullable=False)
    question_id: Mapped[int] = mapped_column(ForeignKey("questions.id"), nullable=False)
    score: Mapped[int] = mapped_column(Integer, nullable=False)
    verbatim: Mapped[str] = mapped_column(String(4000), nullable=False)
    action_required: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    action_target: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    priority_level: Mapped[str | None] = mapped_column(String(100), nullable=True)
    due_date: Mapped[Date | None] = mapped_column(Date, nullable=True)
