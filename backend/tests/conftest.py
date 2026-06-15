"""
Shared test fixtures and configuration for all backend tests.
Sets environment variables before any app module is imported so that
auth bypass and database settings are respected by every test client.
"""

import os

# Must be set before importing app modules — auth dependency reads these at request time
os.environ.setdefault("DEV_AUTH_BYPASS", "true")
os.environ.setdefault("ENVIRONMENT", "dev")
os.environ.setdefault("TESTING", "true")
# Point at the real dev Postgres even in test mode so SQLite is never used
os.environ.setdefault("DATABASE_URL", "postgresql://b2b:b2b@localhost:5432/b2b")

import pytest
from fastapi.testclient import TestClient


@pytest.fixture(scope="session")
def app():
    """Return a FastAPI app instance with auth dependency overridden for testing."""
    from app.main import create_app
    from app.core.auth.dependencies import get_current_user
    from app.core.auth.entra import AuthUser

    _app = create_app()

    def _test_admin() -> AuthUser:
        return AuthUser(
            sub="test-admin-sub",
            name="Test Admin",
            preferred_username="admin@test.example.com",
            roles=("CX_SUPER_ADMIN", "MYSTERY_ADMIN", "B2B_ADMIN"),
            claims={"roles": ["CX_SUPER_ADMIN", "MYSTERY_ADMIN", "B2B_ADMIN"]},
        )

    _app.dependency_overrides[get_current_user] = _test_admin
    return _app


@pytest.fixture(scope="session")
def client(app):
    """Shared TestClient with admin auth bypass active."""
    return TestClient(app, raise_server_exceptions=False)
