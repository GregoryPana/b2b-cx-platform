import re

from pydantic import BaseModel, ConfigDict, field_validator

_EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _clean_name(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = " ".join(str(value).split())
    if not cleaned:
        raise ValueError("Name is required")
    return cleaned


def _clean_email(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = str(value).strip().lower()
    if not _EMAIL_PATTERN.match(cleaned):
        raise ValueError("Enter a valid email address")
    return cleaned


class AccountExecutiveCreate(BaseModel):
    name: str
    email: str

    _validate_name = field_validator("name")(_clean_name)
    _validate_email = field_validator("email")(_clean_email)


class AccountExecutiveUpdate(BaseModel):
    name: str | None = None
    email: str | None = None

    _validate_name = field_validator("name")(_clean_name)
    _validate_email = field_validator("email")(_clean_email)


class AccountExecutiveOut(BaseModel):
    id: int
    name: str
    email: str

    model_config = ConfigDict(from_attributes=True)
