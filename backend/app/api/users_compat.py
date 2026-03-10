"""
Users compatibility endpoint for dashboard
Provides /users endpoint that frontend expects
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Dict
from ..core.database import get_db

router = APIRouter(prefix="/users", tags=["users-compat"])


@router.get("")
async def get_users(db: Session = Depends(get_db)):
    """Get all users for dashboard."""
    try:
        # Get users from the users table
        rows = db.execute(
            text("""
            SELECT 
                id,
                name,
                email,
                role,
                active
            FROM users
            ORDER BY id
            """)
        ).all()
        
        return [
            {
                "id": row[0],
                "name": row[1], 
                "email": row[2],
                "role": row[3],
                "active": bool(row[4])
            }
            for row in rows
        ]
    except Exception as e:
        print(f"Error fetching users: {e}")
        return []
