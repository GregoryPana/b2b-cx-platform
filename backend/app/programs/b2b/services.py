from typing import Optional, List
from sqlalchemy import select, text
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from .models import Business, AccountExecutive
from ...core.visit_cleanup import delete_legacy_visit_responses
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
        
        scope = B2BVisitService._scope(db)
        params = {"business_id": business_id, **scope.params}
        # Count only B2B visits; foreign associations block deletion, not widen the preview.
        visit_count = db.execute(
            text(f"SELECT COUNT(*) FROM visits v WHERE business_id = :business_id {scope.visit_filter}"),
            params
        ).scalar()
        
        # Get visit details for warning
        visits = db.execute(
            text(f"""
                SELECT id, visit_date, status, representative_id
                FROM visits v
                WHERE business_id = :business_id {scope.visit_filter}
                ORDER BY visit_date DESC
            """),
            params
        ).fetchall()

        mystery_assessment_count = db.execute(
            text(
                """
                SELECT COUNT(*)
                FROM mystery_shopper_assessments msa
                JOIN visits v ON v.id = msa.visit_id
                WHERE v.business_id = :business_id
                """
            ),
            {"business_id": business_id},
        ).scalar()
        
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
                "deletion_blocked": bool(mystery_assessment_count or BusinessService._has_foreign_visits(db, business_id, scope.survey_type_id)),
                "visits": [
                    {
                        "id": str(visit[0]),
                        "visit_date": visit[1],
                        "status": visit[2],
                        "representative_id": visit[3]
                    }
                    for visit in visits
                ]
            }
        }
    
    @staticmethod
    def _has_foreign_visits(db, business_id, survey_type_id):
        return bool(db.execute(text("""
            SELECT 1 WHERE EXISTS (
                SELECT 1 FROM visits WHERE business_id = :business_id
                AND survey_type_id IS DISTINCT FROM :survey_type_id
            ) OR EXISTS (
                SELECT 1 FROM mystery_shopper_locations WHERE business_id = :business_id
            )
        """), {"business_id": business_id, "survey_type_id": survey_type_id}).scalar())

    @staticmethod
    def delete_business(db: Session, business_id: int) -> dict:
        """Delete a business and all related records safely."""
        business_exists = db.execute(
            text("SELECT 1 FROM businesses WHERE id = :business_id FOR UPDATE"),
            {"business_id": business_id},
        ).scalar()

        if not business_exists:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, 
                detail="Business not found"
            )
        
        try:
            scope = B2BVisitService._scope(db)
            if BusinessService._has_foreign_visits(db, business_id, scope.survey_type_id):
                raise HTTPException(status_code=409, detail="Business has non-B2B visits or Mystery locations; retire it instead")
            mystery_assessment_count = db.execute(
                text(
                    """
                    SELECT COUNT(*)
                    FROM mystery_shopper_assessments msa
                    JOIN visits v ON v.id = msa.visit_id
                    WHERE v.business_id = :business_id
                    """
                ),
                {"business_id": business_id},
            ).scalar()

            if mystery_assessment_count and int(mystery_assessment_count) > 0:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=(
                        "This business cannot be deleted because it is linked to Mystery Shopper assessments. "
                        "Retire the business instead to hide it from normal use while keeping historical data."
                    ),
                )

            deleted_response_count = delete_legacy_visit_responses(
                db, "v.business_id = :business_id" + scope.visit_filter,
                {"business_id": business_id, **scope.params},
            )
            for table_name in ("b2b_visit_responses",):
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
                            SELECT id FROM visits WHERE business_id = :business_id AND survey_type_id = :survey_type_id
                        )
                        """
                    ),
                    {"business_id": business_id, **scope.params},
                )
                deleted_response_count += int(deleted.rowcount or 0)

            db.execute(
                text("DELETE FROM visits WHERE business_id = :business_id AND survey_type_id = :survey_type_id"),
                {"business_id": business_id, **scope.params}
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
            if isinstance(e, HTTPException):
                raise e
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
    """Compatibility CRUD pinned to B2B on the shared UUID visit store.

    Do not use the legacy ORM mapping: its inherited integer ID and absent
    survey_type_id do not describe the deployed shared visits table.
    """

    @staticmethod
    def _scope(db):
        from ...core.analytics_scope import resolve_module_scope
        scope = resolve_module_scope(db, "B2B")
        if scope.survey_type_id is None:
            raise HTTPException(status_code=503, detail="B2B module is not configured")
        return scope

    @staticmethod
    def _rows(db, predicate="", params=None):
        scope = B2BVisitService._scope(db)
        from ...core.db_inspect import has_column
        assessment_id = "v.assessment_instance_id" if has_column(db, "visits", "assessment_instance_id") else "NULL"
        rows = db.execute(text(f"""
            SELECT v.id, v.business_id, v.representative_id, v.visit_date,
                   v.visit_type, v.status, v.created_at, {assessment_id} AS assessment_instance_id
            FROM visits v WHERE true {scope.visit_filter} {predicate}
            ORDER BY v.created_at DESC
        """), {**scope.params, **(params or {})}).mappings().all()
        return [{**row, "id": str(row["id"]),
                 "visit_date": row["visit_date"].isoformat() if row["visit_date"] else None} for row in rows]
    
    @staticmethod
    def get_all_visits(db: Session) -> List[dict]:
        """Get all B2B visits."""
        return B2BVisitService._rows(db)
    
    @staticmethod
    def get_visit_by_id(db: Session, visit_id: str) -> Optional[dict]:
        """Get a specific visit by ID."""
        rows = B2BVisitService._rows(db, "AND v.id = :visit_id", {"visit_id": visit_id})
        return rows[0] if rows else None
    
    @staticmethod
    def get_visits_by_business(db: Session, business_id: int) -> List[dict]:
        """Get all visits for a specific business."""
        return B2BVisitService._rows(db, "AND v.business_id = :business_id", {"business_id": business_id})
    
    @staticmethod
    def create_visit(db: Session, visit_data: B2BVisitCreate) -> dict:
        """Create a new B2B visit."""
        scope = B2BVisitService._scope(db)
        payload = visit_data.model_dump()
        payload["status"] = "Draft"  # Server-owned: CRUD cannot enter the review lifecycle.
        visit_id = db.execute(text("""
            INSERT INTO visits (business_id, representative_id, visit_date, visit_type, status, survey_type_id)
            VALUES (:business_id, :representative_id, :visit_date, :visit_type, :status, :survey_type_id)
            RETURNING id
        """), {**payload, **scope.params}).scalar_one()
        db.commit()
        return B2BVisitService.get_visit_by_id(db, str(visit_id))
    
    @staticmethod
    def update_visit(db: Session, visit_id: str, visit_data: B2BVisitUpdate) -> dict:
        """Update an existing B2B visit."""
        visit = B2BVisitService.get_visit_by_id(db, visit_id)
        if not visit:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, 
                detail="Visit not found"
            )
        
        payload = visit_data.model_dump(exclude_unset=True)
        if "status" in payload:
            raise HTTPException(status_code=403, detail="Use dedicated submit/review endpoints to change status")
        from ...core.answer_validity import require_visit_state
        require_visit_state(db, visit_id, {"Draft"})
        if payload:
            scope = B2BVisitService._scope(db)
            assignments = ", ".join(f"{field} = :{field}" for field in payload)
            db.execute(text(f"UPDATE visits v SET {assignments} WHERE v.id = :visit_id {scope.visit_filter}"),
                       {**payload, **scope.params, "visit_id": visit_id})
            db.commit()
        return B2BVisitService.get_visit_by_id(db, visit_id)
    
    @staticmethod
    def delete_visit(db: Session, visit_id: str) -> bool:
        """Delete a B2B visit."""
        visit = B2BVisitService.get_visit_by_id(db, visit_id)
        if not visit:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, 
                detail="Visit not found"
            )
        
        scope = B2BVisitService._scope(db)
        delete_legacy_visit_responses(db, "v.id = :visit_id" + scope.visit_filter,
                                      {**scope.params, "visit_id": visit_id})
        db.execute(text(f"DELETE FROM visits v WHERE v.id = :visit_id {scope.visit_filter}"),
                   {**scope.params, "visit_id": visit_id})
        db.commit()
        return True
