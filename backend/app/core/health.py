from app.core.settings import get_settings


def health_check() -> dict:
    settings = get_settings()
    return {
        "status": "ok",
        "db": "not_configured" if not settings.database_url else "unknown",
    }
