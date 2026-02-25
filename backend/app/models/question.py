from sqlalchemy import Boolean, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class Question(Base):
    __tablename__ = "questions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    category: Mapped[str] = mapped_column(String(200), nullable=False)
    question_text: Mapped[str] = mapped_column(String(2000), nullable=False)
    is_nps: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    is_mandatory: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
