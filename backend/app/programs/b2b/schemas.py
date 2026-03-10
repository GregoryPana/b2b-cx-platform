from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict


PriorityLevel = Literal["low", "medium", "high"]


class BusinessCreate(BaseModel):
    """Schema for creating a new business."""
    name: str
    location: str | None = None
    account_executive_id: int | None = None
    priority_level: PriorityLevel = "medium"
    active: bool = True


class BusinessUpdate(BaseModel):
    """Schema for updating an existing business."""
    name: str | None = None
    location: str | None = None
    account_executive_id: int | None = None
    priority_level: PriorityLevel | None = None
    active: bool | None = None


class BusinessOut(BaseModel):
    """Schema for business response data."""
    id: int
    name: str
    location: str | None
    account_executive_id: int | None
    priority_level: PriorityLevel
    active: bool
    created_at: datetime | None

    model_config = ConfigDict(from_attributes=True)


class AccountExecutiveCreate(BaseModel):
    """Schema for creating a new account executive."""
    name: str
    email: str
    phone: str | None = None
    active: bool = True


class AccountExecutiveUpdate(BaseModel):
    """Schema for updating an account executive."""
    name: str | None = None
    email: str | None = None
    phone: str | None = None
    active: bool | None = None


class AccountExecutiveOut(BaseModel):
    """Schema for account executive response data."""
    id: int
    name: str
    email: str
    phone: str | None
    active: bool
    created_at: datetime | None

    model_config = ConfigDict(from_attributes=True)


class B2BVisitCreate(BaseModel):
    """Schema for creating a new B2B visit."""
    business_id: int
    visit_date: str
    visit_type: str | None = None
    status: str = "draft"


class B2BVisitUpdate(BaseModel):
    """Schema for updating a B2B visit."""
    business_id: int | None = None
    visit_date: str | None = None
    visit_type: str | None = None
    status: str | None = None


class B2BVisitOut(BaseModel):
    """Schema for B2B visit response data."""
    id: int
    business_id: int
    representative_id: int
    visit_date: str
    visit_type: str | None
    status: str
    assessment_instance_id: int | None
    created_at: datetime | None

    model_config = ConfigDict(from_attributes=True)


class BusinessWithVisits(BusinessOut):
    """Schema for business with associated visits."""
    visits: list[B2BVisitOut] = []


class AccountExecutiveWithBusinesses(AccountExecutiveOut):
    """Schema for account executive with associated businesses."""
    businesses: list[BusinessOut] = []
