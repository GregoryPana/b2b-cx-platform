from sqlalchemy import Boolean, String, Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ...core.database.base import Base


class Business(Base):
    """B2B business entities."""
    __tablename__ = "businesses"
    
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    location: Mapped[str] = mapped_column(String(255), nullable=True)
    account_executive_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("account_executives.id"), nullable=True, index=True
    )
    priority_level: Mapped[str] = mapped_column(String(20), nullable=False, default="medium")
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    
    # Relationships
    account_executive: Mapped["AccountExecutive"] = relationship(back_populates="businesses")


class AccountExecutive(Base):
    """B2B account executives."""
    __tablename__ = "account_executives"
    
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    phone: Mapped[str] = mapped_column(String(50), nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    
    # Relationships
    businesses: Mapped[list["Business"]] = relationship(back_populates="account_executive")


class B2BVisit(Base):
    """B2B assessment instances (legacy compatibility)."""
    __tablename__ = "visits"
    
    business_id: Mapped[int] = mapped_column(ForeignKey("businesses.id"), nullable=False, index=True)
    representative_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    visit_date: Mapped[str] = mapped_column(String(50), nullable=False)  # Will be converted to proper date
    visit_type: Mapped[str] = mapped_column(String(100), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="draft", nullable=False)
    assessment_instance_id: Mapped[int | None] = mapped_column(
        ForeignKey("assessment_instances.id"), nullable=True, index=True
    )
    
    # Relationships
    business: Mapped["Business"] = relationship()
    # Note: User relationship removed to avoid circular import issues
