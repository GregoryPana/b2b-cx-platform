from fastapi import APIRouter

from app.core.health import health_check

router = APIRouter(tags=["health"])


@router.get("/health")
def get_health():
    return health_check()
