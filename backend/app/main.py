from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers.health import router as health_router
from app.routers.account_executives import router as account_executives_router
from app.routers.businesses import router as businesses_router
from app.routers.dashboard import router as dashboard_router
from app.routers.questions import router as questions_router
from app.routers.responses import router as responses_router
from app.routers.users import router as users_router
from app.routers.visits import router as visits_router


def create_app() -> FastAPI:
    repo_root = Path(__file__).resolve().parents[2]
    load_dotenv(repo_root / ".env")
    app = FastAPI(title="B2B CX Governance Platform")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:5174",
            "http://127.0.0.1:5174",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(health_router)
    app.include_router(users_router)
    app.include_router(businesses_router)
    app.include_router(account_executives_router)
    app.include_router(visits_router)
    app.include_router(responses_router)
    app.include_router(questions_router)
    app.include_router(dashboard_router)
    return app


app = create_app()
