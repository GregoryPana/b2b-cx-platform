from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select, text
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


def _assert_email_available(db: Session, email: str, exclude_id: int | None = None) -> None:
    query = select(AccountExecutive.id).where(func.lower(AccountExecutive.email) == email.lower())
    if exclude_id is not None:
        query = query.where(AccountExecutive.id != exclude_id)
    if db.scalar(query.limit(1)) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account executive with this email already exists",
        )


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
    # Surveyors add an executive inline while setting up a visit; edit/delete stay admin-only.
    _allowed: bool = Depends(require_roles(*B2B_ROLES)),
):
    _assert_email_available(db, payload.email)
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

    changes = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if "email" in changes:
        _assert_email_available(db, changes["email"], exclude_id=executive_id)
    for field, value in changes.items():
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

    assigned = db.execute(
        text("SELECT COUNT(*) FROM businesses WHERE account_executive_id = :ae_id"),
        {"ae_id": executive_id},
    ).scalar() or 0
    if assigned:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"{executive.name} is assigned to {assigned} business{'es' if assigned != 1 else ''}. "
                "Reassign or unassign those businesses before deleting this account executive."
            ),
        )

    db.delete(executive)
    db.commit()
