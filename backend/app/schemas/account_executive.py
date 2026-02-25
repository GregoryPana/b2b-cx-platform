from pydantic import BaseModel, ConfigDict


class AccountExecutiveCreate(BaseModel):
    name: str
    email: str


class AccountExecutiveUpdate(BaseModel):
    name: str | None = None
    email: str | None = None


class AccountExecutiveOut(BaseModel):
    id: int
    name: str
    email: str

    model_config = ConfigDict(from_attributes=True)
