from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import case, select
from sqlalchemy.orm import Session

from app.core.auth import CurrentUser, require_roles
from app.core.db import get_db
from app.core.roles import ROLE_ADMIN, ROLE_MANAGER, ROLE_REPRESENTATIVE, ROLE_REVIEWER
from app.models import Business
from app.schemas.business import BusinessCreate, BusinessOut, BusinessUpdate

router = APIRouter(prefix="/businesses", tags=["businesses"])


@router.get("", response_model=list[BusinessOut])
def list_businesses(
    db: Session = Depends(get_db),
    _user: CurrentUser = Depends(
        require_roles([ROLE_REPRESENTATIVE, ROLE_REVIEWER, ROLE_MANAGER, ROLE_ADMIN])
    ),
):
    priority_order = case(
        (Business.priority_level == "high", 0),
        (Business.priority_level == "medium", 1),
        (Business.priority_level == "low", 2),
        else_=3,
    )
    return db.scalars(select(Business).order_by(priority_order, Business.name)).all()


@router.post("", response_model=BusinessOut, status_code=status.HTTP_201_CREATED)
def create_business(
    payload: BusinessCreate,
    db: Session = Depends(get_db),
    _user: CurrentUser = Depends(require_roles([ROLE_ADMIN, ROLE_MANAGER, ROLE_REPRESENTATIVE])),
):
    business = Business(**payload.model_dump())
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
        setattr(business, field, value)

    db.commit()
    db.refresh(business)
    return business
