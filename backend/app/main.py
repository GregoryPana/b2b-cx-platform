from fastapi import FastAPI

from app.routers.health import router as health_router
from app.routers.responses import router as responses_router
from app.routers.visits import router as visits_router


def create_app() -> FastAPI:
    app = FastAPI(title="B2B CX Governance Platform")
    app.include_router(health_router)
    app.include_router(visits_router)
    app.include_router(responses_router)
    return app


app = create_app()
