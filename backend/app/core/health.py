from sqlalchemy import text

from app.core.database import engine
from app.core.settings import get_settings


def health_check(environment: str) -> dict:
    settings = get_settings()
    payload = {
        "status": "ok",
        "version": settings.app_version,
        "checks": {
            "database": "ok",
        },
    }

    if not settings.database_url:
        payload["status"] = "degraded"
        payload["checks"]["database"] = "error: not configured"
        return payload

    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return payload
    except Exception as exc:
        payload["status"] = "degraded"
        payload["checks"]["database"] = f"error: {type(exc).__name__}"
        return payload


def readiness_check(environment: str) -> dict:
    payload = health_check(environment)
    return {
        "status": "ready" if payload["status"] == "ok" else "not_ready",
        "version": payload["version"],
        "checks": payload["checks"],
    }
