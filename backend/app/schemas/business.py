from datetime import datetime

from typing import Literal

from pydantic import BaseModel, ConfigDict


BusinessType = Literal["large_corporate", "sme"]


class BusinessCreate(BaseModel):
    name: str
    location: str | None = None
    account_executive_id: int | None = None
    priority_level: BusinessType = "sme"
    active: bool = True


class BusinessUpdate(BaseModel):
    name: str | None = None
    location: str | None = None
    account_executive_id: int | None = None
    priority_level: BusinessType | None = None
    active: bool | None = None


class BusinessOut(BaseModel):
    id: int
    name: str
    location: str | None
    account_executive_id: int | None
    priority_level: BusinessType
    active: bool
    created_at: datetime | None

    model_config = ConfigDict(from_attributes=True)
