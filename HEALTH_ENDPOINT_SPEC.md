# Health Endpoint Specification

**Audience:** AI coding agent working on the CWS DTO application codebase.
**Purpose:** Implement (or verify and improve) a `/health` endpoint that meets the CWS DTO observability contract, enabling Uptime Kuma to monitor the application from the DB VM.
**Authority:** This specification implements EXIT-CONVENTIONS.md Section 6.8 and Section 10.

## Current CWSCX Status

As of the current CWSCX implementation:

- contract endpoint in use: `GET /health`
- public nginx path used by monitoring: `GET /api/health`
- additional readiness alias in use: `GET /health/ready`, exposed publicly as `GET /api/health/ready`
- current application does not use `/api/v1` versioning for the health endpoint
- database verification is implemented with `SELECT 1`
- the health response now includes:
  - `status`
  - `version`
  - `checks.database`

This specification should now be read as:
- the contract for the current CWSCX implementation
- the standard to apply to future DTO applications

---

## 1. Context — Why This Endpoint Exists

The DB VM is being repurposed as the interim observability host for the CWS DTO. Uptime Kuma is being deployed there to monitor application liveness across the estate. Each application must expose a dedicated health endpoint that Uptime Kuma polls at regular intervals.

A simple "200 OK if the web server is running" is insufficient. If the database is unreachable, the application is effectively down even though the web server may respond. The health endpoint must verify that critical dependencies are working, not just that the process is alive.

This endpoint is monitored every 60 seconds in production. A correct implementation gives the DTO real-time confidence that the application is functional. An incorrect implementation either misses outages or generates false alarms — both erode trust in the monitoring system.

---

## 2. Discovery Step — Before Writing Any Code

Before implementing or modifying anything, complete the following discovery and report findings to the user.

### 2.1 Search the codebase for existing health-check implementations

Search for any of the following patterns:

- A FastAPI route definition matching: `@app.get("/health")`, `@router.get("/health")`, `@app.get("/healthz")`, `@app.get("/api/v1/health")`, or similar variants
- A function named `health_check`, `healthcheck`, `liveness`, `readiness`, or similar
- Any existing route that returns a status object

### 2.2 If a health endpoint exists, evaluate it against the contract

Compare the existing implementation against Section 4 (Endpoint Contract) below. Report which contract requirements are met and which are not. Do not modify anything yet.

### 2.3 If no health endpoint exists

Confirm with the user, then implement per Section 5.

### 2.4 Report findings before proceeding

Output to the user, before writing or modifying code:

1. Whether a health endpoint exists and at what path
2. What dependencies the application has that the endpoint should check (database, cache, external APIs)
3. Which API versioning prefix is in use (e.g., `/api/v1`, `/api`, no prefix)
4. Whether the application uses sync or async route handlers
5. Which database access pattern is in use (SQLAlchemy async session, sync session, raw connection)
6. Proposed implementation plan based on findings

Wait for user approval before implementing.

---

## 3. Endpoint Contract — Non-Negotiable Requirements

The endpoint, once implemented, must meet all of the following:

### 3.1 Path

**If the application uses `/api/v1` versioning:** Endpoint is `GET /api/v1/health`
**If the application has no API versioning yet:** Endpoint is `GET /health` at the root, AND a follow-up task is added to migrate to `/api/v1/health` once API versioning is introduced.

Document the chosen path in the application's EXIT.md Section 14 (Observability).

### 3.2 Method

`GET` only. No `POST`, no other methods.

### 3.3 Authentication

**No authentication.** This endpoint must be reachable by Uptime Kuma without credentials. Do not apply any authentication dependency to this route. Do not include this route behind a router that has a global authentication dependency. If the application uses a global auth dependency, this route must be explicitly excluded.

### 3.4 Response — Healthy

When all checks pass, return:

- HTTP status code: `200`
- Content-Type: `application/json`
- Response body:

```json
{
  "status": "ok",
  "version": "1.2.3",
  "checks": {
    "database": "ok"
  }
}
```

Where `version` reflects the application's current version (from `pyproject.toml`, an `APP_VERSION` environment variable, or a constant). The `checks` object contains one key per dependency checked, with value `"ok"`.

### 3.5 Response — Unhealthy

When any check fails, return:

- HTTP status code: `503`
- Content-Type: `application/json`
- Response body:

```json
{
  "status": "degraded",
  "version": "1.2.3",
  "checks": {
    "database": "error: connection timeout"
  }
}
```

The status code is the primary signal Uptime Kuma uses. The body provides diagnostic context for humans investigating the alert.

### 3.6 Performance

The endpoint must respond within 100 milliseconds under normal conditions. This rules out:

- Running expensive queries (no `SELECT COUNT(*) FROM large_table`)
- Calling external APIs that may be slow
- Loading large datasets

The database check should be a trivial query: `SELECT 1`.

### 3.7 No Side Effects

The endpoint must not write data, send messages, modify state, or have any persistent effect. It is purely a read operation.

### 3.8 No Sensitive Data

The response must not include:

- Database connection strings or any part of them
- Internal IP addresses or hostnames
- Stack traces or exception details
- Environment variable values
- File paths
- User identifiers

The error string in `checks` may include a high-level error type (e.g., "connection timeout", "permission denied") but no sensitive context.

---

## 4. Implementation — FastAPI Reference

### 4.1 File Location

Create or modify:

- `app/api/v1/health.py` (preferred if `/api/v1` versioning is in use)
- OR `app/api/health.py` (if no versioning)

### 4.2 Reference Implementation

```python
"""Health check endpoint.

This endpoint is consumed by Uptime Kuma for liveness monitoring.
See EXIT-CONVENTIONS.md Section 6.8 and Section 10.

CRITICAL: Do not add authentication. Do not add expensive checks.
Do not include sensitive data in responses.
"""
from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import get_session  # adjust import to actual session factory


router = APIRouter(tags=["health"])


class HealthResponse(BaseModel):
    """Response model for the health endpoint."""

    status: Literal["ok", "degraded"]
    version: str
    checks: dict[str, str]


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Application health check",
    description="Returns 200 with status 'ok' if all dependencies are healthy, "
                "503 with status 'degraded' if any dependency check fails. "
                "Consumed by Uptime Kuma for liveness monitoring. No authentication required.",
    responses={
        200: {"description": "All dependencies healthy"},
        503: {"description": "One or more dependencies unhealthy"},
    },
)
async def health_check() -> JSONResponse:
    """Check application health by verifying critical dependencies.

    Currently checks: database connectivity via SELECT 1.

    Returns:
        JSONResponse with 200 status when healthy, 503 when degraded.
    """
    checks: dict[str, str] = {}
    all_healthy = True

    # Database connectivity check
    try:
        async with get_session() as session:
            await session.execute(text("SELECT 1"))
        checks["database"] = "ok"
    except Exception as exc:  # noqa: BLE001 — intentional broad catch for health
        # Record a high-level error type only, never the full exception detail
        error_type = type(exc).__name__
        checks["database"] = f"error: {error_type}"
        all_healthy = False

    response_body = HealthResponse(
        status="ok" if all_healthy else "degraded",
        version=settings.APP_VERSION,
        checks=checks,
    )

    status_code = status.HTTP_200_OK if all_healthy else status.HTTP_503_SERVICE_UNAVAILABLE

    return JSONResponse(
        status_code=status_code,
        content=response_body.model_dump(),
    )
```

### 4.3 Router Registration

In `app/main.py` or wherever routers are registered:

```python
from app.api.v1 import health  # adjust import path

app.include_router(health.router, prefix="/api/v1")
# Result: endpoint accessible at GET /api/v1/health
```

### 4.4 Settings Update

If `settings.APP_VERSION` does not exist, add it to `app/core/config.py`:

```python
class Settings(BaseSettings):
    # ... existing settings ...
    APP_VERSION: str = "0.1.0"  # override via env var APP_VERSION

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True)
```

And add to `.env.example`:

```
# Application version, surfaced in /health response
APP_VERSION=0.1.0
```

### 4.5 Excluding from Global Authentication (if applicable)

If the application has global authentication via middleware or a global dependency, the health endpoint must be excluded.

**If using a dependency on a parent router:**

```python
# Wrong — this applies auth to health
authenticated_router = APIRouter(dependencies=[Depends(require_auth)])
authenticated_router.include_router(health.router)

# Right — register health separately, no auth dependency
app.include_router(authenticated_router, prefix="/api/v1")
app.include_router(health.router, prefix="/api/v1")  # no auth applied
```

**If using middleware that authenticates all requests:**

The middleware must check the request path and skip authentication for `/health` (or the chosen path). Example:

```python
@app.middleware("http")
async def auth_middleware(request: Request, call_next):
    if request.url.path.endswith("/health"):
        return await call_next(request)
    # ... existing auth logic ...
    return await call_next(request)
```

---

## 5. Testing Requirements

### 5.1 Unit / Integration Test

Add a test in `tests/api/test_health.py`:

```python
"""Tests for the health endpoint."""
import pytest
from httpx import AsyncClient
from fastapi import status

from app.main import app  # adjust import


@pytest.mark.asyncio
async def test_health_returns_200_when_healthy():
    """Health endpoint returns 200 with status 'ok' when database is reachable."""
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/api/v1/health")

    assert response.status_code == status.HTTP_200_OK
    body = response.json()
    assert body["status"] == "ok"
    assert "version" in body
    assert body["checks"]["database"] == "ok"


@pytest.mark.asyncio
async def test_health_returns_503_when_database_unreachable(monkeypatch):
    """Health endpoint returns 503 with status 'degraded' when database fails."""
    # Mock the session factory to raise an exception
    # Implementation depends on how get_session is structured

    # Example (adjust to actual session pattern):
    # async with AsyncClient(app=app, base_url="http://test") as client:
    #     response = await client.get("/api/v1/health")
    # assert response.status_code == status.HTTP_503_SERVICE_UNAVAILABLE
    # body = response.json()
    # assert body["status"] == "degraded"
    # assert body["checks"]["database"].startswith("error:")
    pass  # complete based on actual fixtures available


@pytest.mark.asyncio
async def test_health_does_not_require_authentication():
    """Health endpoint is reachable without authentication credentials."""
    async with AsyncClient(app=app, base_url="http://test") as client:
        # Send no authentication headers at all
        response = await client.get("/api/v1/health")

    # Must NOT be 401 or 403
    assert response.status_code != status.HTTP_401_UNAUTHORIZED
    assert response.status_code != status.HTTP_403_FORBIDDEN


@pytest.mark.asyncio
async def test_health_responds_quickly():
    """Health endpoint responds within 100ms under normal conditions."""
    import time

    async with AsyncClient(app=app, base_url="http://test") as client:
        start = time.perf_counter()
        response = await client.get("/api/v1/health")
        elapsed_ms = (time.perf_counter() - start) * 1000

    assert response.status_code == status.HTTP_200_OK
    assert elapsed_ms < 100, f"Health endpoint took {elapsed_ms:.1f}ms, exceeds 100ms target"
```

### 5.2 Manual Validation

After deployment to staging:

```bash
# From the staging VM or any host with network access:
curl -i http://staging-vm-ip:port/api/v1/health

# Expected response:
# HTTP/1.1 200 OK
# Content-Type: application/json
# {"status":"ok","version":"0.1.0","checks":{"database":"ok"}}
```

To validate the failure path, temporarily stop the database container and re-curl:

```bash
docker compose stop postgres
curl -i http://staging-vm-ip:port/api/v1/health
# Expected: 503 with status "degraded"

docker compose start postgres
# Re-test, expect 200
```

---

## 6. Anti-Patterns — Do Not Do These Things

The following are forbidden in this endpoint. They are common mistakes that defeat the purpose of health monitoring.

1. **Do not add authentication.** Uptime Kuma must reach this endpoint anonymously.

2. **Do not run expensive checks.** No counts on large tables, no joins, no business logic. `SELECT 1` against the database is correct.

3. **Do not call external services from within the health check.** External services have their own monitoring. Including them couples your application's health to theirs and creates cascading false alarms.

4. **Do not return 200 when something is broken.** Some implementations return 200 with `"status": "degraded"` to "be nice." Uptime Kuma reads the HTTP status code. 503 is correct when broken.

5. **Do not include sensitive data in the response.** Connection strings, exception details, file paths, internal IPs. The error type name is sufficient.

6. **Do not log every health check call at INFO level.** This endpoint is hit every 60 seconds — it will dominate the logs. Log at DEBUG, or filter it out at the access log level.

7. **Do not add metrics scraping or Prometheus output to this endpoint.** Metrics belong on `/metrics` (separate endpoint, separate concern).

8. **Do not write to the database in this endpoint.** Read-only. No INSERT, UPDATE, DELETE.

9. **Do not introduce caching.** A cached health check defeats its purpose. Each call must verify current state.

10. **Do not skip writing the test for the unhealthy path.** It is easy to write a health check that always returns 200 because the failure path was never exercised.

---

## 7. Future Extensions — Out of Scope for This Task

Do not implement these now. They are future enhancements:

- **Cache health check** — only when Redis is added to the application
- **Background worker queue depth** — only when background workers are added
- **External API health probes** — only with explicit DTO Lead approval
- **Separate `/ready` endpoint for readiness vs liveness** — Kubernetes pattern, not currently relevant
- **Prometheus metrics endpoint** — separate task, separate endpoint at `/metrics`

---

## 8. Acceptance Criteria

The implementation is complete when ALL of the following are true:

- [ ] `GET /api/v1/health` (or `/health`) responds with HTTP 200 and the documented JSON body when the database is reachable
- [ ] Same endpoint responds with HTTP 503 and the documented JSON body when the database is unreachable
- [ ] Endpoint returns within 100ms in normal conditions (manually measured)
- [ ] Endpoint requires no authentication — verified by curl with no credentials
- [ ] Endpoint produces no log entries above DEBUG level on each call
- [ ] All four tests in Section 5.1 pass
- [ ] `APP_VERSION` is documented in `.env.example`
- [ ] Endpoint path is recorded in the application's EXIT.md Section 14 (Observability)
- [ ] No sensitive data appears in any health check response under any condition

---

## 9. Reporting Back

When implementation is complete, report to the user:

1. The exact endpoint path
2. The version of the application currently surfaced (`settings.APP_VERSION`)
3. Confirmation that the four tests pass
4. The result of manual curl validation against the staging environment
5. The result of the database-down failure test
6. Any deviations from this specification and why

If discovery in Section 2 found an existing implementation that already meets the contract, report that and propose no changes (do not modify a correct implementation).
