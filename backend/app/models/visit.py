import enum
import uuid

from sqlalchemy import Date, DateTime, Enum, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class VisitStatus(str, enum.Enum):
    DRAFT = "Draft"
    PENDING = "Pending"
    NEEDS_CHANGES = "Needs Changes"
    APPROVED = "Approved"
    REJECTED = "Rejected"


class Visit(Base):
    __tablename__ = "visits"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    business_id: Mapped[int] = mapped_column(ForeignKey("businesses.id"), nullable=False)
    representative_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    visit_date: Mapped[Date] = mapped_column(Date, nullable=False)
    visit_type: Mapped[str] = mapped_column(String(50), nullable=False)
    status: Mapped[VisitStatus] = mapped_column(
        Enum(
            VisitStatus,
            name="visit_status",
            values_callable=lambda enum_cls: [member.value for member in enum_cls],
        ),
        nullable=False,
        default=VisitStatus.DRAFT,
    )
    reviewer_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    review_timestamp: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    change_notes: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    approval_timestamp: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    approval_notes: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    rejection_notes: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
