"""Least-privilege API composition for the public Mystery Shopper backend."""

from fastapi import APIRouter, Depends
from fastapi.routing import APIRoute
from sqlalchemy.orm import Session

from ..core.auth.dependencies import MYSTERY_ROLES, require_roles
from ..core.database import get_db
from .mystery_shopper import router as full_mystery_shopper_router
from .survey import get_questions


# Only operations used by the public Mystery Shopper workspace belong here.
# Paths already contain the full router prefix from mystery_shopper.router.
PUBLIC_MYSTERY_OPERATIONS = {
    ("GET", "/mystery-shopper/locations"),
    ("GET", "/mystery-shopper/purposes"),
    ("POST", "/mystery-shopper/visits"),
    ("GET", "/mystery-shopper/visits/drafts"),
    ("GET", "/mystery-shopper/visits/{visit_id}"),
    ("POST", "/mystery-shopper/visits/{visit_id}/responses"),
    ("PUT", "/mystery-shopper/visits/{visit_id}/responses/{response_id}"),
    ("PUT", "/mystery-shopper/visits/{visit_id}/submit"),
}

router = APIRouter(dependencies=[Depends(require_roles(*MYSTERY_ROLES))])


@router.get("/questions")
async def get_mystery_public_questions(db: Session = Depends(get_db)):
    """Return Mystery Shopper questions without exposing other programmes."""

    return await get_questions(survey_type="Mystery Shopper", db=db)


for route in full_mystery_shopper_router.routes:
    if not isinstance(route, APIRoute):
        continue
    if any((method, route.path) in PUBLIC_MYSTERY_OPERATIONS for method in route.methods):
        router.routes.append(route)
