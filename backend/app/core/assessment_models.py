from sqlalchemy import String, Text, Integer, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from .database.base import Base


class AssessmentTemplate(Base):
    """Versioned assessment templates for each program."""
    __tablename__ = "assessment_templates"
    
    program_id: Mapped[int] = mapped_column(ForeignKey("programs.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    version: Mapped[str] = mapped_column(String(20), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=True)
    
    # Relationships
    program: Mapped["Program"] = relationship("Program")
    questions: Mapped[list["Question"]] = relationship(back_populates="template")


class Question(Base):
    """Questions linked to assessment templates."""
    __tablename__ = "questions"
    
    template_id: Mapped[int] = mapped_column(ForeignKey("assessment_templates.id"), nullable=False, index=True)
    text: Mapped[str] = mapped_column(String(2000), nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    question_type: Mapped[str] = mapped_column(String(50), nullable=False)  # score, text, boolean, photo, attachment
    order_index: Mapped[int] = mapped_column(Integer, nullable=False)
    is_required: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    conditional_logic_json: Mapped[dict] = mapped_column(JSON, nullable=True)  # {"show_if": {"question_id": 5, "value": "yes"}}
    validation_rules_json: Mapped[dict] = mapped_column(JSON, nullable=True)  # {"min": 0, "max": 10}
    helper_text: Mapped[str] = mapped_column(Text, nullable=True)
    
    # Relationships
    template: Mapped["AssessmentTemplate"] = relationship(back_populates="questions")


class AssessmentInstance(Base):
    """Actual assessment instances (submitted forms)."""
    __tablename__ = "assessment_instances"
    
    program_id: Mapped[int] = mapped_column(ForeignKey("programs.id"), nullable=False, index=True)
    template_version: Mapped[str] = mapped_column(String(20), nullable=False)
    respondent_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    context_id: Mapped[int] = mapped_column(nullable=False, index=True)  # business_id, customer_id, site_id
    context_type: Mapped[str] = mapped_column(String(50), nullable=False)  # business, customer, site
    title: Mapped[str] = mapped_column(String(200), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="draft", nullable=False)  # draft, submitted, approved, rejected
    submitted_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=True)
    approved_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=True)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    program: Mapped["Program"] = relationship("Program")
    responses: Mapped[list["Response"]] = relationship(back_populates="assessment")


class Response(Base):
    """Typed responses to assessment questions."""
    __tablename__ = "responses"
    
    assessment_id: Mapped[int] = mapped_column(ForeignKey("assessment_instances.id"), nullable=False, index=True)
    question_id: Mapped[int] = mapped_column(ForeignKey("questions.id"), nullable=False, index=True)
    score_value: Mapped[int] = mapped_column(Integer, nullable=True)  # For numeric questions
    text_value: Mapped[str] = mapped_column(Text, nullable=True)  # For text questions
    boolean_value: Mapped[bool] = mapped_column(Boolean, nullable=True)  # For yes/no questions
    file_attachment_id: Mapped[int] = mapped_column(ForeignKey("file_attachments.id"), nullable=True)  # For photo/attachment questions
    
    # Relationships
    assessment: Mapped["AssessmentInstance"] = relationship(back_populates="responses")


class FileAttachment(Base):
    """File attachments for assessments (photos, documents)."""
    __tablename__ = "file_attachments"
    
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    file_size: Mapped[int] = mapped_column(Integer, nullable=False)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)
    uploaded_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    program_id: Mapped[int] = mapped_column(ForeignKey("programs.id"), nullable=True)
