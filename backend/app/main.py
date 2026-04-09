import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Core Platform Imports
from app.core.router import router as core_router
from app.core.database import init_db

# Program Imports
from app.programs.b2b.router import router as b2b_router
# from app.programs.b2c.router import router as b2c_router  

# Survey Imports
from app.api.survey import router as survey_router
from app.api.mystery_shopper import router as mystery_shopper_router
from app.api.installation_surveys import router as installation_router
from app.api.auth import router as auth_router

# Dashboard Compatibility Imports
from app.api.dashboard_compat import router as dashboard_compat_router

# Users Compatibility Imports  
from app.api.users_compat import router as users_compat_router

# Visits Compatibility Imports
from app.api.visits_dashboard import router as visits_compat_router

# Admin Dashboard Imports
from app.api.admin_dashboard import router as admin_dashboard_router

# Analytics Imports
from app.routers.analytics import router as analytics_router
from app.routers.account_executives import router as account_executives_router

# Test Imports
from app.api.test import router as test_router
from app.core.auth.dependencies import (
    ALL_PLATFORM_ROLES,
    B2B_ROLES,
    DASHBOARD_ROLES,
    MYSTERY_ROLES,
    require_roles,
)


def create_app() -> FastAPI:
    backend_root = Path(__file__).resolve().parents[1]
    repo_root = Path(__file__).resolve().parents[2]
    for env_path in (repo_root / ".env", backend_root / ".env"):
        load_dotenv(env_path, override=False)

    cors_allow_origins = [
        origin.strip()
        for origin in os.getenv("CORS_ALLOW_ORIGINS", "").split(",")
        if origin.strip()
    ]
    cors_origin_regex = os.getenv("CORS_ALLOW_ORIGIN_REGEX", "").strip() or None
    environment = os.getenv("ENVIRONMENT", "dev")

    if not cors_allow_origins and not cors_origin_regex and environment == "dev":
        cors_origin_regex = (
            r"^https?://"
            r"(localhost|127\.0\.0\.1|0\.0\.0\.0|"
            r"192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|"
            r"172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)"
            r"(:\d+)?$"
        )

    # Allow skipping critical configuration validation during tests
    is_testing = os.getenv("TESTING") == "true"
    if not is_testing:
        missing = []
        if not os.getenv("DATABASE_URL"):
            missing.append("DATABASE_URL")
        if not os.getenv("ENTRA_TENANT_ID"):
            missing.append("ENTRA_TENANT_ID")
        if not os.getenv("ENTRA_CLIENT_ID"):
            missing.append("ENTRA_CLIENT_ID")
        if not os.getenv("ENTRA_AUTHORITY"):
            missing.append("ENTRA_AUTHORITY")
        if not os.getenv("ENTRA_ISSUER"):
            missing.append("ENTRA_ISSUER")
        if not os.getenv("ENTRA_AUDIENCE"):
            missing.append("ENTRA_AUDIENCE")
        if missing:
            print(f"[STARTUP] Missing required environment variables: {', '.join(missing)}")
            raise RuntimeError(f"Missing required environment variables: {', '.join(missing)}")

    # Startup configuration summary (no secrets)
    print("[STARTUP] Environment:", environment)
    print("[STARTUP] DATABASE_URL: set")
    print("[STARTUP] CORS_ALLOW_ORIGINS:", cors_allow_origins or "(any via regex)")
    print("[STARTUP] ENTRA_TENANT_ID: set")

    app = FastAPI(
        title="CX Assessment Platform",
        description="Multi-platform CX Assessment Platform",
        version="1.0.0"
    )

    # Add CORS middleware to allow cross-origin requests
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_allow_origins,
        allow_origin_regex=cors_origin_regex,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # Initialize database
    init_db()
    
    # Add a simple health endpoint that works without authentication
    @app.get("/health")
    async def health_check():
        return {"status": "healthy", "platform": "CX Assessment Platform", "mode": environment}
    
    # Core Platform Routes
    app.include_router(core_router, prefix="/core", tags=["core"], dependencies=[Depends(require_roles(*ALL_PLATFORM_ROLES))])
    
    # Program Routes
    app.include_router(b2b_router, prefix="/b2b", tags=["b2b"], dependencies=[Depends(require_roles(*B2B_ROLES))])
    # TODO: Add program routers as they are implemented
    # app.include_router(b2c_router, prefix="/api/b2c", tags=["b2c"])
    
    # Survey Routes (for the survey interface)
    app.include_router(survey_router, tags=["survey"], dependencies=[Depends(require_roles(*ALL_PLATFORM_ROLES))])
    app.include_router(mystery_shopper_router, dependencies=[Depends(require_roles(*MYSTERY_ROLES))])
    app.include_router(installation_router)
    app.include_router(auth_router, dependencies=[Depends(require_roles(*ALL_PLATFORM_ROLES))])
    
    # Dashboard Compatibility Routes (for dashboard metrics)
    app.include_router(dashboard_compat_router, dependencies=[Depends(require_roles(*DASHBOARD_ROLES))])
    
    # Users Compatibility Routes (for dashboard users)
    app.include_router(users_compat_router, dependencies=[Depends(require_roles(*DASHBOARD_ROLES))])
    
    # Visits Compatibility Routes (for dashboard visits)
    app.include_router(visits_compat_router, dependencies=[Depends(require_roles(*ALL_PLATFORM_ROLES))])
    
    # Admin Dashboard Routes (for admin management)
    app.include_router(admin_dashboard_router, dependencies=[Depends(require_roles(*DASHBOARD_ROLES))])
    
    # Analytics Routes (for comprehensive analytics)
    app.include_router(analytics_router, dependencies=[Depends(require_roles(*DASHBOARD_ROLES))])
    app.include_router(account_executives_router, dependencies=[Depends(require_roles(*B2B_ROLES))])
    
    # Test Routes (for debugging)
    app.include_router(test_router, tags=["test"])
    
    return app


app = create_app()
