from datetime import datetime

from pydantic import BaseModel, ConfigDict


class BusinessCreate(BaseModel):
    name: str
    location: str | None = None
    account_executive_id: int | None = None
    priority_flag: bool = False
    active: bool = True


class BusinessUpdate(BaseModel):
    name: str | None = None
    location: str | None = None
    account_executive_id: int | None = None
    priority_flag: bool | None = None
    active: bool | None = None


class BusinessOut(BaseModel):
    id: int
    name: str
    location: str | None
    account_executive_id: int | None
    priority_flag: bool
    active: bool
    created_at: datetime | None

    model_config = ConfigDict(from_attributes=True)
