import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Core Platform Imports
from app.core.router import router as core_router
from app.core.database import init_db

# Program Imports
from app.programs.b2b.router import router as b2b_router
# from app.programs.b2c.router import router as b2c_router  
# from app.programs.installation.router import router as installation_router

# Survey Imports
from app.api.survey import router as survey_router
from app.api.mystery_shopper import router as mystery_shopper_router

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

# Test Imports
from app.api.test import router as test_router


def create_app() -> FastAPI:
    repo_root = Path(__file__).resolve().parents[2]
    load_dotenv(repo_root / ".env")

    cors_origin_regex = os.getenv(
        "CORS_ALLOW_ORIGIN_REGEX",
        r"^https?://(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+):(5173|5174|5175|5176)$",
    )

    app = FastAPI(
        title="CX Assessment Platform",
        description="Multi-platform CX Assessment Platform",
        version="1.0.0"
    )

    # Add CORS middleware to allow cross-origin requests
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_origin_regex=cors_origin_regex,
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # Initialize database
    init_db()
    
    # Add a simple health endpoint that works without authentication
    @app.get("/health")
    async def health_check():
        return {"status": "healthy", "platform": "CX Assessment Platform", "mode": "development"}
    
    # Core Platform Routes
    app.include_router(core_router, prefix="/api/core", tags=["core"])
    
    # Program Routes
    app.include_router(b2b_router, prefix="/api/b2b", tags=["b2b"])
    # TODO: Add program routers as they are implemented
    # app.include_router(b2c_router, prefix="/api/b2c", tags=["b2c"])
    # app.include_router(installation_router, prefix="/api/install", tags=["installation"])
    
    # Survey Routes (for the survey interface)
    app.include_router(survey_router, tags=["survey"])
    app.include_router(mystery_shopper_router)
    
    # Dashboard Compatibility Routes (for dashboard metrics)
    app.include_router(dashboard_compat_router)
    
    # Users Compatibility Routes (for dashboard users)
    app.include_router(users_compat_router)
    
    # Visits Compatibility Routes (for dashboard visits)
    app.include_router(visits_compat_router)
    
    # Admin Dashboard Routes (for admin management)
    app.include_router(admin_dashboard_router)
    
    # Analytics Routes (for comprehensive analytics)
    app.include_router(analytics_router)
    
    # Test Routes (for debugging)
    app.include_router(test_router, tags=["test"])
    
    return app


app = create_app()
