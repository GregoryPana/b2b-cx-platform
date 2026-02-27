from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class ResponseAction(Base):
    __tablename__ = "response_actions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    response_id: Mapped[int] = mapped_column(
        ForeignKey("responses.id", ondelete="CASCADE"), nullable=False
    )
    action_required: Mapped[str] = mapped_column(String(2000), nullable=False)
    action_owner: Mapped[str] = mapped_column(String(255), nullable=False)
    action_timeframe: Mapped[str] = mapped_column(String(20), nullable=False)
    action_support_needed: Mapped[str | None] = mapped_column(String(2000), nullable=True)
