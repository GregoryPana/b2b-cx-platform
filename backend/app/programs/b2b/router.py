from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text, select
from typing import List

from ...core.database import get_db
from ...core.auth.dependencies import get_current_user, require_program_access, require_role
from ...core.models import User
from .services import BusinessService, AccountExecutiveService, B2BVisitService
from .schemas import (
    BusinessCreate, BusinessUpdate, BusinessOut, BusinessWithVisits,
    AccountExecutiveCreate, AccountExecutiveUpdate, AccountExecutiveOut, AccountExecutiveWithBusinesses,
    B2BVisitCreate, B2BVisitUpdate, B2BVisitOut
)

router = APIRouter(tags=["b2b"])


@router.get("/businesses", response_model=List[BusinessOut])
def list_businesses(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _access: bool = Depends(require_program_access("B2B"))
):
    """Get all B2B businesses."""
    return BusinessService.get_all_businesses(db)


@router.get("/businesses/{business_id}", response_model=BusinessOut)
def get_business(
    business_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _access: bool = Depends(require_program_access("B2B"))
):
    """Get a specific business by ID."""
    business = BusinessService.get_business_by_id(db, business_id)
    if not business:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Business not found"
        )
    return business


@router.get("/businesses/{business_id}/visits", response_model=List[B2BVisitOut])
def get_business_visits(
    business_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _access: bool = Depends(require_program_access("B2B"))
):
    """Get all visits for a specific business."""
    # Verify business exists
    business = BusinessService.get_business_by_id(db, business_id)
    if not business:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Business not found"
        )
    
    return B2BVisitService.get_visits_by_business(db, business_id)


@router.post("/businesses", response_model=BusinessOut, status_code=status.HTTP_201_CREATED)
def create_business(
    business_data: BusinessCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _access: bool = Depends(require_role("Admin"))
):
    """Create a new business."""
    return BusinessService.create_business(db, business_data)


@router.put("/businesses/{business_id}", response_model=BusinessOut)
def update_business(
    business_id: int,
    business_data: BusinessUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _access: bool = Depends(require_role("Admin"))
):
    """Update an existing business."""
    return BusinessService.update_business(db, business_id, business_data)


@router.get("/businesses/{business_id}/deletion-summary")
def get_business_deletion_summary(
    business_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _access: bool = Depends(require_program_access("B2B"))
):
    """Get summary of what will be deleted when business is deleted."""
    try:
        return BusinessService.get_business_deletion_summary(db, business_id)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get deletion summary: {exc}",
        )


@router.delete("/businesses/{business_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_business(
    business_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _access: bool = Depends(require_role("Admin"))  # Requires Admin role in B2B
):
    """Delete a business and all related records (cascade deletion)."""
    BusinessService.delete_business(db, business_id)


@router.put("/businesses/{business_id}/retire", response_model=BusinessOut)
def retire_business(
    business_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _access: bool = Depends(require_role("Admin"))
):
    """Retire a business (set active to false) - keeps all records."""
    return BusinessService.retire_business(db, business_id)


# Account Executive Endpoints
@router.get("/account-executives", response_model=List[AccountExecutiveOut])
def list_account_executives(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _access: bool = Depends(require_program_access("B2B"))
):
    """Get all account executives."""
    return AccountExecutiveService.get_all_account_executives(db)


@router.get("/public/businesses", response_model=List[dict])
def list_businesses_public(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _access: bool = Depends(require_program_access("B2B")),
):
    """Get all businesses for B2B-authorized users."""
    print("DEBUG: Public businesses endpoint called")
    try:
        # Use raw SQL to avoid service issues
        result = db.execute(
            text("""
                SELECT 
                    id,
                    name,
                    location,
                    priority_level,
                    active,
                    account_executive_id
                FROM businesses
                ORDER BY 
                    CASE 
                        WHEN priority_level = 'high' THEN 0
                        WHEN priority_level = 'medium' THEN 1
                        WHEN priority_level = 'low' THEN 2
                        ELSE 3
                    END,
                    name
                """)
        ).all()
        
        print(f"DEBUG: Raw SQL result: {len(result)} businesses")
        
        businesses = []
        for row in result:
            businesses.append({
                "id": row[0],
                "name": row[1],
                "location": row[2],
                "priority_level": row[3],
                "active": row[4],
                "account_executive_id": row[5]
            })
        
        print(f"DEBUG: Processed {len(businesses)} businesses for response")
        return businesses
        
    except Exception as e:
        print(f"ERROR: Error fetching businesses: {e}")
        return []


@router.get("/public/account-executives", response_model=List[dict])
def list_account_executives_public(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _access: bool = Depends(require_program_access("B2B")),
):
    """Get all account executives for B2B-authorized users."""
    print("DEBUG: Public account executives endpoint called")
    try:
        # Use raw SQL to avoid service issues
        result = db.execute(
            text("""
                SELECT 
                    id,
                    name,
                    email
                FROM account_executives
                ORDER BY name
                """)
        ).all()
        
        print(f"DEBUG: Raw SQL result: {len(result)} account executives")
        
        account_executives = []
        for row in result:
            account_executives.append({
                "id": row[0],
                "name": row[1],
                "email": row[2]
            })
        
        print(f"DEBUG: Processed {len(account_executives)} account executives for response")
        return account_executives
        
    except Exception as e:
        print(f"ERROR: Error fetching account executives: {e}")
        return []


@router.get("/account-executives/{ae_id}", response_model=AccountExecutiveOut)
def get_account_executive(
    ae_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _access: bool = Depends(require_program_access("B2B"))
):
    """Get a specific account executive by ID."""
    ae = AccountExecutiveService.get_account_executive_by_id(db, ae_id)
    if not ae:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account executive not found"
        )
    return ae


@router.get("/account-executives/{ae_id}/businesses", response_model=List[BusinessOut])
def get_ae_businesses(
    ae_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _access: bool = Depends(require_program_access("B2B"))
):
    """Get all businesses for a specific account executive."""
    # Verify AE exists
    ae = AccountExecutiveService.get_account_executive_by_id(db, ae_id)
    if not ae:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account executive not found"
        )
    
    # Get businesses for this AE
    from .models import Business
    return db.scalars(
        select(Business).where(Business.account_executive_id == ae_id)
    ).all()


@router.post("/account-executives", response_model=AccountExecutiveOut, status_code=status.HTTP_201_CREATED)
def create_account_executive(
    ae_data: AccountExecutiveCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _access: bool = Depends(require_role("Admin"))
):
    """Create a new account executive."""
    return AccountExecutiveService.create_account_executive(db, ae_data)


@router.put("/account-executives/{ae_id}", response_model=AccountExecutiveOut)
def update_account_executive(
    ae_id: int,
    ae_data: AccountExecutiveUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _access: bool = Depends(require_role("Admin"))  # Requires Admin role in B2B
):
    """Update an existing account executive."""
    return AccountExecutiveService.update_account_executive(db, ae_id, ae_data)


@router.delete("/account-executives/{ae_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_account_executive(
    ae_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _access: bool = Depends(require_role("Admin"))  # Requires Admin role in B2B
):
    """Delete an account executive."""
    AccountExecutiveService.delete_account_executive(db, ae_id)


# Visit Endpoints
@router.get("/visits", response_model=List[B2BVisitOut])
def list_visits(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _access: bool = Depends(require_program_access("B2B"))
):
    """Get all B2B visits."""
    return B2BVisitService.get_all_visits(db)


@router.get("/visits/{visit_id}", response_model=B2BVisitOut)
def get_visit(
    visit_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _access: bool = Depends(require_program_access("B2B"))
):
    """Get a specific visit by ID."""
    visit = B2BVisitService.get_visit_by_id(db, visit_id)
    if not visit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Visit not found"
        )
    return visit


@router.post("/visits", response_model=B2BVisitOut, status_code=status.HTTP_201_CREATED)
def create_visit(
    visit_data: B2BVisitCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _access: bool = Depends(require_role("Surveyor"))
):
    """Create a new B2B visit."""
    # Set the representative_id to current user
    visit_data_dict = visit_data.model_dump()
    visit_data_dict["representative_id"] = current_user.id
    
    visit_data_modified = B2BVisitCreate(**visit_data_dict)
    return B2BVisitService.create_visit(db, visit_data_modified)


@router.put("/visits/{visit_id}", response_model=B2BVisitOut)
def update_visit(
    visit_id: int,
    visit_data: B2BVisitUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _access: bool = Depends(require_program_access("B2B"))
):
    """Update an existing B2B visit."""
    return B2BVisitService.update_visit(db, visit_id, visit_data)


@router.delete("/visits/{visit_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_visit(
    visit_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _access: bool = Depends(require_role("Admin"))
):
    """Delete a B2B visit."""
    B2BVisitService.delete_visit(db, visit_id)
