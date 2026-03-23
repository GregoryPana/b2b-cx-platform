from fastapi import APIRouter, Depends

from ..core.auth.dependencies import get_current_user
from ..core.auth.entra import AuthUser

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/me")
async def get_auth_me(current_user: AuthUser = Depends(get_current_user)):
    return {
        "sub": current_user.sub,
        "name": current_user.name,
        "preferred_username": current_user.preferred_username,
        "roles": list(current_user.roles),
    }
