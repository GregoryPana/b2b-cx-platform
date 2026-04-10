from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.auth.dependencies import B2B_ROLES, get_current_user, require_roles
from app.core.auth.entra import AuthUser
from app.core.database import get_db
from app.models import AccountExecutive
from app.schemas.account_executive import (
    AccountExecutiveCreate,
    AccountExecutiveOut,
    AccountExecutiveUpdate,
)

router = APIRouter(prefix="/account-executives", tags=["account-executives"])


@router.get("", response_model=list[AccountExecutiveOut])
def list_account_executives(
    db: Session = Depends(get_db),
    _user: AuthUser = Depends(get_current_user),
    _allowed: bool = Depends(require_roles(*B2B_ROLES)),
):
    return db.scalars(select(AccountExecutive).order_by(AccountExecutive.name)).all()


@router.post("", response_model=AccountExecutiveOut, status_code=status.HTTP_201_CREATED)
def create_account_executive(
    payload: AccountExecutiveCreate,
    db: Session = Depends(get_db),
    _user: AuthUser = Depends(get_current_user),
    _allowed: bool = Depends(require_roles("CX_SUPER_ADMIN", "B2B_ADMIN")),
):
    executive = AccountExecutive(**payload.model_dump())
    db.add(executive)
    db.commit()
    db.refresh(executive)
    return executive


@router.put("/{executive_id}", response_model=AccountExecutiveOut)
def update_account_executive(
    executive_id: int,
    payload: AccountExecutiveUpdate,
    db: Session = Depends(get_db),
    _user: AuthUser = Depends(get_current_user),
    _allowed: bool = Depends(require_roles("CX_SUPER_ADMIN", "B2B_ADMIN")),
):
    executive = db.get(AccountExecutive, executive_id)
    if not executive:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account executive not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(executive, field, value)

    db.commit()
    db.refresh(executive)
    return executive


@router.delete("/{executive_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_account_executive(
    executive_id: int,
    db: Session = Depends(get_db),
    _user: AuthUser = Depends(get_current_user),
    _allowed: bool = Depends(require_roles("CX_SUPER_ADMIN", "B2B_ADMIN")),
):
    executive = db.get(AccountExecutive, executive_id)
    if not executive:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account executive not found")

    db.delete(executive)
    db.commit()
