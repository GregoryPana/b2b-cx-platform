from fastapi.routing import APIRoute

from app import main


PUBLIC_DMZ_ROUTES = {
    ("GET", "/health"),
    ("GET", "/health/ready"),
    ("GET", "/auth/session"),
    ("POST", "/auth/login"),
    ("POST", "/auth/mfa"),
    ("POST", "/auth/enroll/start"),
    ("POST", "/auth/enroll/confirm"),
    ("POST", "/auth/recovery"),
    ("POST", "/auth/logout"),
    ("GET", "/questions"),
    ("GET", "/mystery-shopper/locations"),
    ("GET", "/mystery-shopper/purposes"),
    ("POST", "/mystery-shopper/visits"),
    ("GET", "/mystery-shopper/visits/drafts"),
    ("GET", "/mystery-shopper/visits/{visit_id}"),
    ("POST", "/mystery-shopper/visits/{visit_id}/responses"),
    ("PUT", "/mystery-shopper/visits/{visit_id}/responses/{response_id}"),
    ("PUT", "/mystery-shopper/visits/{visit_id}/submit"),
}


def _operations(app):
    return {
        (method, route.path)
        for route in app.routes
        if isinstance(route, APIRoute)
        for method in route.methods
    }


def _build_app(monkeypatch, auth_mode):
    monkeypatch.setenv("TESTING", "true")
    monkeypatch.setenv("AUTH_MODE", auth_mode)
    monkeypatch.setattr(main, "init_db", lambda: None)
    return main.create_app()


def test_mystery_public_mounts_exact_allowlist(monkeypatch):
    app = _build_app(monkeypatch, "mystery_public")

    assert _operations(app) == PUBLIC_DMZ_ROUTES
    assert app.docs_url is None
    assert app.redoc_url is None
    assert app.openapi_url is None


def test_mystery_public_excludes_internal_and_privileged_route_families(monkeypatch):
    app = _build_app(monkeypatch, "mystery_public")
    paths = {route.path for route in app.routes if isinstance(route, APIRoute)}

    denied_prefixes = (
        "/admin",
        "/analytics",
        "/b2b",
        "/core",
        "/dashboard",
        "/installation",
        "/mystery-admin",
        "/test",
        "/users",
    )
    assert not any(path.startswith(denied_prefixes) for path in paths)
    assert not any("/reports" in path for path in paths)
    assert "/docs" not in paths
    assert "/redoc" not in paths
    assert "/openapi.json" not in paths


def test_entra_mode_keeps_full_internal_route_surface(monkeypatch):
    app = _build_app(monkeypatch, "entra")
    operations = _operations(app)

    assert ("GET", "/core/programs") in operations
    assert ("GET", "/questions") in operations
    assert ("POST", "/mystery-shopper/bootstrap") in operations
    assert ("GET", "/mystery-shopper/admin/visits") in operations
    assert ("GET", "/mystery-shopper/reports/export") in operations
    assert ("GET", "/mystery-admin/users") in operations
    assert app.docs_url == "/docs"
    assert app.redoc_url == "/redoc"
    assert app.openapi_url == "/openapi.json"
