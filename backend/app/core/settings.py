import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    environment: str
    database_url: str | None
    auth_mode: str
    mystery_auth_secret_key: str | None
    mystery_session_idle_minutes: int
    mystery_session_absolute_hours: int
    mystery_mfa_challenge_minutes: int
    mystery_enroll_token_minutes: int
    entra_issuer: str | None
    entra_audience: str | None
    app_version: str


def get_settings() -> Settings:
    return Settings(
        environment=os.getenv("ENVIRONMENT", "dev"),
        database_url=os.getenv("DATABASE_URL"),
        auth_mode=os.getenv("AUTH_MODE", "entra").strip().lower(),
        mystery_auth_secret_key=os.getenv("MYSTERY_AUTH_SECRET_KEY"),
        mystery_session_idle_minutes=max(5, int(os.getenv("MYSTERY_SESSION_IDLE_MINUTES", "45"))),
        mystery_session_absolute_hours=max(1, int(os.getenv("MYSTERY_SESSION_ABSOLUTE_HOURS", "10"))),
        mystery_mfa_challenge_minutes=max(1, int(os.getenv("MYSTERY_MFA_CHALLENGE_MINUTES", "5"))),
        mystery_enroll_token_minutes=max(5, int(os.getenv("MYSTERY_ENROLL_TOKEN_MINUTES", "30"))),
        entra_issuer=os.getenv("ENTRA_ISSUER"),
        entra_audience=os.getenv("ENTRA_AUDIENCE"),
        app_version=os.getenv("APP_VERSION", "1.0.0"),
    )
