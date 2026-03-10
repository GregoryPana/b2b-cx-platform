from sqlalchemy import String, Boolean
from sqlalchemy.orm import Mapped, mapped_column
from .database.base import Base


class User(Base):
    """Platform-wide user accounts."""
    __tablename__ = "users"
    
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    department: Mapped[str] = mapped_column(String(100), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class Program(Base):
    """CX Platform programs (B2B, B2C, Installation)."""
    __tablename__ = "programs"
    
    code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, index=True)  # B2B, B2C, INSTALL
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(String(500), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class UserProgramRole(Base):
    """User access and roles per program."""
    __tablename__ = "user_program_roles"
    
    user_id: Mapped[int] = mapped_column(nullable=False, index=True)
    program_id: Mapped[int] = mapped_column(nullable=False, index=True)
    role: Mapped[str] = mapped_column(String(50), nullable=False)  # Admin, Manager, Viewer, Technician, Representative
