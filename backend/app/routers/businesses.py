from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import case, select
from sqlalchemy.orm import Session

from app.core.auth import CurrentUser, require_roles
from app.core.db import get_db
from app.core.roles import ROLE_ADMIN, ROLE_MANAGER, ROLE_REPRESENTATIVE, ROLE_REVIEWER
from app.models import Business
from app.schemas.business import BusinessCreate, BusinessOut, BusinessUpdate

router = APIRouter(prefix="/businesses", tags=["businesses"])


def normalize_business_type(value: str | None) -> str:
    normalized = (value or "").strip().lower()
    if normalized in {"large_corporate", "large business/corporate", "large corporate", "high"}:
        return "large_corporate"
    return "sme"


@router.get("", response_model=list[BusinessOut])
def list_businesses(
    db: Session = Depends(get_db),
    _user: CurrentUser = Depends(
        require_roles([ROLE_REPRESENTATIVE, ROLE_REVIEWER, ROLE_MANAGER, ROLE_ADMIN])
    ),
):
    priority_order = case(
        (Business.priority_level.in_(["large_corporate", "high"]), 0),
        (Business.priority_level.in_(["sme", "medium", "low"]), 1),
        else_=2,
    )
    return db.scalars(select(Business).order_by(priority_order, Business.name)).all()


@router.post("", response_model=BusinessOut, status_code=status.HTTP_201_CREATED)
def create_business(
    payload: BusinessCreate,
    db: Session = Depends(get_db),
    _user: CurrentUser = Depends(require_roles([ROLE_ADMIN, ROLE_MANAGER, ROLE_REPRESENTATIVE])),
):
    data = payload.model_dump()
    data["priority_level"] = normalize_business_type(data.get("priority_level"))
    business = Business(**data)
    db.add(business)
    db.commit()
    db.refresh(business)
    return business


@router.put("/{business_id}", response_model=BusinessOut)
def update_business(
    business_id: int,
    payload: BusinessUpdate,
    db: Session = Depends(get_db),
    _user: CurrentUser = Depends(require_roles([ROLE_ADMIN, ROLE_MANAGER])),
):
    business = db.get(Business, business_id)
    if not business:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        if field == "priority_level":
            value = normalize_business_type(value)
        setattr(business, field, value)

    db.commit()
    db.refresh(business)
    return business
