from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from .database import get_db
from .models import User, Program, UserProgramRole
from .auth.dependencies import get_current_user, require_program_access
from typing import List

router = APIRouter()


@router.get("/programs")
async def get_programs(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all programs the current user has access to."""
    
    # For development, return all programs for mock user
    if current_user.email == "dev.user@company.com":
        programs = db.query(Program).filter(Program.is_active == True).all()
    else:
        user_programs = db.query(Program).join(UserProgramRole).filter(
            UserProgramRole.user_id == current_user.id,
            Program.is_active == True
        ).all()
        programs = user_programs
    
    return [
        {
            "id": program.id,
            "code": program.code,
            "name": program.name,
            "description": program.description
        }
        for program in programs
    ]


@router.get("/overview")
async def get_platform_overview(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get platform overview with all accessible programs."""
    
    user_programs = db.query(Program).join(UserProgramRole).filter(
        UserProgramRole.user_id == current_user.id,
        Program.is_active == True
    ).all()
    
    return {
        "user": {
            "id": current_user.id,
            "email": current_user.email,
            "name": current_user.name,
            "department": current_user.department
        },
        "accessible_programs": [
            {
                "code": program.code,
                "name": program.name,
                "description": program.description
            }
            for program in user_programs
        ],
        "total_programs": len(user_programs)
    }
