import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    environment: str
    database_url: str | None
    entra_issuer: str | None
    entra_audience: str | None


def get_settings() -> Settings:
    return Settings(
        environment=os.getenv("ENVIRONMENT", "dev"),
        database_url=os.getenv("DATABASE_URL"),
        entra_issuer=os.getenv("ENTRA_ISSUER"),
        entra_audience=os.getenv("ENTRA_AUDIENCE"),
    )
