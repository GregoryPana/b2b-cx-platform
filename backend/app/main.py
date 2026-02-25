from fastapi import FastAPI

from app.routers.health import router as health_router


def create_app() -> FastAPI:
    app = FastAPI(title="B2B CX Governance Platform")
    app.include_router(health_router)
    return app


app = create_app()
