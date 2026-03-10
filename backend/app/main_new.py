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


def create_app() -> FastAPI:
    repo_root = Path(__file__).resolve().parents[2]
    load_dotenv(repo_root / ".env")

    cors_origin_regex = os.getenv(
        "CORS_ALLOW_ORIGIN_REGEX",
        r"^https?://(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+):(5173|5174)$",
    )

    app = FastAPI(title="CX Assessment Platform")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:5174",
            "http://127.0.0.1:5174",
        ],
        allow_origin_regex=cors_origin_regex,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # Initialize database
    init_db()
    
    # Core Platform Routes
    app.include_router(core_router, prefix="/api/core", tags=["core"])
    
    # Program Routes
    app.include_router(b2b_router, prefix="/api/b2b", tags=["b2b"])
    # TODO: Add program routers as they are implemented
    # app.include_router(b2c_router, prefix="/api/b2c", tags=["b2c"])
    # app.include_router(installation_router, prefix="/api/install", tags=["installation"])
    
    return app


app = create_app()
