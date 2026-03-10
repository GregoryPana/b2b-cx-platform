from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from typing import Optional
from ..database import get_db
from ..models import User, UserProgramRole, Program

# Make security optional for development
security = HTTPBearer(auto_error=False)


def get_current_user_dev():
    """Mock user for development without Entra ID."""
    return User(
        id=1,
        email="dev.user@company.com",
        name="Development User",
        department="IT",
        is_active=True
    )


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """Get current user - mock for development."""
    # TODO: Implement proper JWT validation
    # For now, mock user for development
    user = get_current_user_dev()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )
    return user


def require_program_access(program_code: str):
    """Factory function to create program access requirement dependency."""
    
    async def program_access_checker(
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db)
    ) -> bool:
        # For development, grant access to all programs for mock user
        if current_user.email == "dev.user@company.com":
            return True
            
        program = db.query(Program).filter(Program.code == program_code).first()
        if not program:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Program {program_code} not found"
            )
        
        user_role = db.query(UserProgramRole).filter(
            UserProgramRole.user_id == current_user.id,
            UserProgramRole.program_id == program.id
        ).first()
        
        if not user_role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied to program {program_code}"
            )
        
        return True
    
    return program_access_checker


def require_role(required_role: str):
    """Factory function to create role requirement dependency."""
    
    async def role_checker(
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
        program_code: str = "B2B"  # Default to B2B for now
    ) -> bool:
        # For development, grant all roles to mock user
        if current_user.email == "dev.user@company.com":
            return True
            
        program = db.query(Program).filter(Program.code == program_code).first()
        
        if not program:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Program {program_code} not found"
            )
        
        user_role = db.query(UserProgramRole).filter(
            UserProgramRole.user_id == current_user.id,
            UserProgramRole.program_id == program.id,
            UserProgramRole.role == required_role
        ).first()
        
        if not user_role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires {required_role} role for program {program_code}"
            )
        
        return True
    
    return role_checker
