from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, field_validator


BusinessType = Literal["large_corporate", "sme"]


def _clean_required_name(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = " ".join(str(value).split())
    if not cleaned:
        raise ValueError("Name is required")
    return cleaned


def _clean_optional_text(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = " ".join(str(value).split())
    return cleaned or None


class BusinessCreate(BaseModel):
    """Schema for creating a new business."""
    name: str
    location: str | None = None
    account_executive_id: int | None = None
    priority_level: BusinessType = "sme"
    active: bool = True

    _clean_name = field_validator("name")(_clean_required_name)
    _clean_location = field_validator("location")(_clean_optional_text)


class BusinessUpdate(BaseModel):
    """Schema for updating an existing business.

    Only fields present in the request body are applied (``exclude_unset``), so
    sending ``"account_executive_id": null`` or ``"location": null`` clears the value.
    """
    name: str | None = None
    location: str | None = None
    account_executive_id: int | None = None
    priority_level: BusinessType | None = None
    active: bool | None = None

    _clean_name = field_validator("name")(_clean_required_name)
    _clean_location = field_validator("location")(_clean_optional_text)


class BusinessOut(BaseModel):
    """Schema for business response data."""
    id: int
    name: str
    location: str | None
    account_executive_id: int | None
    priority_level: BusinessType
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
    visit_type: str = "Planned"
    status: str = "Draft"
    representative_id: int | None = None


class B2BVisitUpdate(BaseModel):
    """Schema for updating a B2B visit."""
    business_id: int | None = None
    visit_date: str | None = None
    visit_type: str | None = None
    status: str | None = None


class B2BVisitOut(BaseModel):
    """Schema for B2B visit response data."""
    id: str
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
