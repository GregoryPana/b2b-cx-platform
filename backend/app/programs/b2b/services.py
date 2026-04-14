from typing import Optional, List
from sqlalchemy import case, select, text
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from .models import Business, AccountExecutive, B2BVisit
from .schemas import BusinessCreate, BusinessUpdate, AccountExecutiveCreate, AccountExecutiveUpdate, B2BVisitCreate, B2BVisitUpdate


class BusinessService:
    """Service for B2B business operations."""

    @staticmethod
    def normalize_business_type(value: str | None) -> str:
        normalized = (value or "").strip().lower()
        if normalized in {"large_corporate", "large business/corporate", "large corporate", "high"}:
            return "large_corporate"
        return "sme"

    @staticmethod
    def _business_row_to_dict(row) -> dict:
        return {
            "id": row[0],
            "name": row[1],
            "location": row[2],
            "account_executive_id": row[3],
            "priority_level": row[4],
            "active": row[5],
            "created_at": row[6],
        }
    
    @staticmethod
    def get_all_businesses(db: Session) -> List[Business]:
        """Get all businesses ordered by priority and name."""
        rows = db.execute(
            text(
                """
                SELECT id, name, location, account_executive_id, priority_level, active, created_at
                FROM businesses
                ORDER BY
                    CASE
                        WHEN priority_level IN ('large_corporate', 'high') THEN 0
                        WHEN priority_level IN ('sme', 'medium', 'low') THEN 1
                        ELSE 2
                    END,
                    name
                """
            )
        ).fetchall()
        return [BusinessService._business_row_to_dict(row) for row in rows]
    
    @staticmethod
    def get_business_by_id(db: Session, business_id: int) -> Optional[Business]:
        """Get a specific business by ID."""
        row = db.execute(
            text(
                """
                SELECT id, name, location, account_executive_id, priority_level, active, created_at
                FROM businesses
                WHERE id = :business_id
                """
            ),
            {"business_id": business_id},
        ).fetchone()
        return BusinessService._business_row_to_dict(row) if row else None
    
    @staticmethod
    def create_business(db: Session, business_data: BusinessCreate) -> Business:
        """Create a new business."""
        payload = business_data.model_dump()
        row = db.execute(
            text(
                """
                INSERT INTO businesses (name, location, account_executive_id, priority_level, active)
                VALUES (:name, :location, :account_executive_id, :priority_level, :active)
                RETURNING id, name, location, account_executive_id, priority_level, active, created_at
                """
            ),
            {
                "name": payload.get("name"),
                "location": payload.get("location"),
                "account_executive_id": payload.get("account_executive_id"),
                "priority_level": BusinessService.normalize_business_type(payload.get("priority_level", "sme")),
                "active": payload.get("active", True),
            },
        ).fetchone()
        db.commit()
        return BusinessService._business_row_to_dict(row)
    
    @staticmethod
    def update_business(db: Session, business_id: int, business_data: BusinessUpdate) -> Business:
        """Update an existing business."""
        existing = BusinessService.get_business_by_id(db, business_id)
        if not existing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, 
                detail="Business not found"
            )

        update_data = business_data.model_dump(exclude_unset=True)
        if "priority_level" in update_data:
            update_data["priority_level"] = BusinessService.normalize_business_type(update_data.get("priority_level"))
        if not update_data:
            return existing

        set_clauses = []
        params = {"business_id": business_id}
        for field, value in update_data.items():
            set_clauses.append(f"{field} = :{field}")
            params[field] = value

        row = db.execute(
            text(
                f"""
                UPDATE businesses
                SET {', '.join(set_clauses)}
                WHERE id = :business_id
                RETURNING id, name, location, account_executive_id, priority_level, active, created_at
                """
            ),
            params,
        ).fetchone()
        db.commit()
        return BusinessService._business_row_to_dict(row)
    
    @staticmethod
    def get_business_deletion_summary(db: Session, business_id: int) -> dict:
        """Get summary of what will be deleted when business is deleted."""
        business_row = db.execute(
            text(
                """
                SELECT id, name, location, priority_level, active
                FROM businesses
                WHERE id = :business_id
                """
            ),
            {"business_id": business_id},
        ).fetchone()

        if not business_row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, 
                detail="Business not found"
            )
        
        # Count related visits
        visit_count = db.execute(
            text("SELECT COUNT(*) FROM visits WHERE business_id = :business_id"),
            {"business_id": business_id}
        ).scalar()
        
        # Get visit details for warning
        visits = db.execute(
            text("""
                SELECT id, visit_date, status, representative_id
                FROM visits 
                WHERE business_id = :business_id
                ORDER BY visit_date DESC
            """),
            {"business_id": business_id}
        ).fetchall()
        
        return {
            "business": {
                "id": business_row[0],
                "name": business_row[1],
                "location": business_row[2],
                "priority_level": business_row[3],
                "active": business_row[4]
            },
            "related_records": {
                "total_visits": visit_count,
                "visits": [
                    {
                        "id": visit[0],
                        "visit_date": visit[1],
                        "status": visit[2],
                        "representative_id": visit[3]
                    }
                    for visit in visits
                ]
            }
        }
    
    @staticmethod
    def delete_business(db: Session, business_id: int) -> dict:
        """Delete a business and all related records safely."""
        business_exists = db.execute(
            text("SELECT 1 FROM businesses WHERE id = :business_id"),
            {"business_id": business_id},
        ).scalar()

        if not business_exists:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, 
                detail="Business not found"
            )
        
        try:
            deleted_response_count = 0
            for table_name in ("b2b_visit_responses", "responses"):
                table_exists = db.execute(
                    text("SELECT 1 FROM information_schema.tables WHERE table_name = :table_name LIMIT 1"),
                    {"table_name": table_name},
                ).scalar()
                if not table_exists:
                    continue
                deleted = db.execute(
                    text(
                        f"""
                        DELETE FROM {table_name}
                        WHERE visit_id IN (
                            SELECT id FROM visits WHERE business_id = :business_id
                        )
                        """
                    ),
                    {"business_id": business_id},
                )
                deleted_response_count += int(deleted.rowcount or 0)

            db.execute(
                text("DELETE FROM visits WHERE business_id = :business_id"),
                {"business_id": business_id}
            )
            
            # Delete the business
            db.execute(
                text("DELETE FROM businesses WHERE id = :business_id"),
                {"business_id": business_id},
            )
            db.commit()
            
            return {"deleted": True, "business_id": business_id, "deleted_response_count": deleted_response_count}
        except Exception as e:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to delete business: {str(e)}"
            )
    
    @staticmethod
    def retire_business(db: Session, business_id: int) -> Business:
        """Retire a business (set active to false) - keeps all records."""
        row = db.execute(
            text(
                """
                UPDATE businesses
                SET active = false
                WHERE id = :business_id
                RETURNING id, name, location, account_executive_id, priority_level, active, created_at
                """
            ),
            {"business_id": business_id},
        ).fetchone()
        if not row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, 
                detail="Business not found"
            )

        db.commit()
        return BusinessService._business_row_to_dict(row)


class AccountExecutiveService:
    """Service for account executive operations."""
    
    @staticmethod
    def get_all_account_executives(db: Session) -> List[AccountExecutive]:
        """Get all account executives."""
        return db.scalars(select(AccountExecutive).order_by(AccountExecutive.name)).all()
    
    @staticmethod
    def get_account_executive_by_id(db: Session, ae_id: int) -> Optional[AccountExecutive]:
        """Get a specific account executive by ID."""
        return db.get(AccountExecutive, ae_id)
    
    @staticmethod
    def create_account_executive(db: Session, ae_data: AccountExecutiveCreate) -> AccountExecutive:
        """Create a new account executive."""
        account_executive = AccountExecutive(**ae_data.model_dump())
        db.add(account_executive)
        db.commit()
        db.refresh(account_executive)
        return account_executive
    
    @staticmethod
    def update_account_executive(db: Session, ae_id: int, ae_data: AccountExecutiveUpdate) -> AccountExecutive:
        """Update an existing account executive."""
        account_executive = db.get(AccountExecutive, ae_id)
        if not account_executive:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, 
                detail="Account executive not found"
            )
        
        for field, value in ae_data.model_dump(exclude_unset=True).items():
            setattr(account_executive, field, value)
        
        db.commit()
        db.refresh(account_executive)
        return account_executive
    
    @staticmethod
    def delete_account_executive(db: Session, ae_id: int) -> bool:
        """Delete an account executive."""
        account_executive = db.get(AccountExecutive, ae_id)
        if not account_executive:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, 
                detail="Account executive not found"
            )
        
        db.delete(account_executive)
        db.commit()
        return True


class B2BVisitService:
    """Service for B2B visit operations."""
    
    @staticmethod
    def get_all_visits(db: Session) -> List[B2BVisit]:
        """Get all B2B visits."""
        return db.scalars(select(B2BVisit).order_by(B2BVisit.created_at.desc())).all()
    
    @staticmethod
    def get_visit_by_id(db: Session, visit_id: int) -> Optional[B2BVisit]:
        """Get a specific visit by ID."""
        return db.get(B2BVisit, visit_id)
    
    @staticmethod
    def get_visits_by_business(db: Session, business_id: int) -> List[B2BVisit]:
        """Get all visits for a specific business."""
        return db.scalars(
            select(B2BVisit)
            .where(B2BVisit.business_id == business_id)
            .order_by(B2BVisit.created_at.desc())
        ).all()
    
    @staticmethod
    def create_visit(db: Session, visit_data: B2BVisitCreate) -> B2BVisit:
        """Create a new B2B visit."""
        visit = B2BVisit(**visit_data.model_dump())
        db.add(visit)
        db.commit()
        db.refresh(visit)
        return visit
    
    @staticmethod
    def update_visit(db: Session, visit_id: int, visit_data: B2BVisitUpdate) -> B2BVisit:
        """Update an existing B2B visit."""
        visit = db.get(B2BVisit, visit_id)
        if not visit:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, 
                detail="Visit not found"
            )
        
        for field, value in visit_data.model_dump(exclude_unset=True).items():
            setattr(visit, field, value)
        
        db.commit()
        db.refresh(visit)
        return visit
    
    @staticmethod
    def delete_visit(db: Session, visit_id: int) -> bool:
        """Delete a B2B visit."""
        visit = db.get(B2BVisit, visit_id)
        if not visit:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, 
                detail="Visit not found"
            )
        
        db.delete(visit)
        db.commit()
        return True
