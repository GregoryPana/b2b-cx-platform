from datetime import datetime

from pydantic import BaseModel, ConfigDict


class UserCreate(BaseModel):
    name: str
    email: str
    role: str
    active: bool = True


class UserUpdate(BaseModel):
    name: str | None = None
    email: str | None = None
    role: str | None = None
    active: bool | None = None


class UserOut(BaseModel):
    id: int
    name: str
    email: str
    role: str
    active: bool
    created_at: datetime | None

    model_config = ConfigDict(from_attributes=True)
