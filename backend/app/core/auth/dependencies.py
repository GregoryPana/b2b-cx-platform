from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .entra import AuthUser, get_entra_validator

security = HTTPBearer(auto_error=True)


DASHBOARD_ROLES = (
    "CX_SUPER_ADMIN",
    "B2B_ADMIN",
    "MYSTERY_ADMIN",
    "INSTALL_ADMIN",
)

B2B_ROLES = (
    "CX_SUPER_ADMIN",
    "B2B_ADMIN",
    "B2B_SURVEYOR",
)

MYSTERY_ROLES = (
    "CX_SUPER_ADMIN",
    "MYSTERY_ADMIN",
    "MYSTERY_SURVEYOR",
)

INSTALL_ROLES = (
    "CX_SUPER_ADMIN",
    "INSTALL_ADMIN",
    "INSTALL_SURVEYOR",
)

ALL_PLATFORM_ROLES = tuple(dict.fromkeys((*B2B_ROLES, *MYSTERY_ROLES, *INSTALL_ROLES)))


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> AuthUser:
    if not credentials or not credentials.credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")

    token = credentials.credentials.strip()
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")

    validator = get_entra_validator()
    return validator.validate(token)


def require_roles(*allowed_roles: str):
    role_set = tuple(dict.fromkeys(allowed_roles))

    async def role_checker(current_user: AuthUser = Depends(get_current_user)) -> bool:
        if current_user.has_any_role(role_set):
            return True

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient role permissions for this resource",
        )

    return role_checker


def require_program_access(program_code: str):
    normalized = (program_code or "").strip().upper()
    if normalized == "B2B":
        return require_roles(*B2B_ROLES)
    if normalized in {"MYSTERY", "MYSTERY_SHOPPER"}:
        return require_roles(*MYSTERY_ROLES)
    if normalized in {"INSTALL", "INSTALLATION", "INSTALLATION_ASSESSMENT"}:
        return require_roles(*INSTALL_ROLES)
    return require_roles(*ALL_PLATFORM_ROLES)


def require_role(required_role: str):
    normalized = (required_role or "").strip().lower()

    async def role_checker(
        current_user: AuthUser = Depends(get_current_user),
        program_code: str = "B2B",
    ) -> bool:
        program = (program_code or "B2B").strip().upper()
        if program == "B2B":
            admin_roles = ("CX_SUPER_ADMIN", "B2B_ADMIN")
            survey_roles = ("CX_SUPER_ADMIN", "B2B_ADMIN", "B2B_SURVEYOR")
        elif program in {"MYSTERY", "MYSTERY_SHOPPER"}:
            admin_roles = ("CX_SUPER_ADMIN", "MYSTERY_ADMIN")
            survey_roles = ("CX_SUPER_ADMIN", "MYSTERY_ADMIN", "MYSTERY_SURVEYOR")
        elif program in {"INSTALL", "INSTALLATION", "INSTALLATION_ASSESSMENT"}:
            admin_roles = ("CX_SUPER_ADMIN", "INSTALL_ADMIN")
            survey_roles = ("CX_SUPER_ADMIN", "INSTALL_ADMIN", "INSTALL_SURVEYOR")
        else:
            admin_roles = DASHBOARD_ROLES
            survey_roles = ALL_PLATFORM_ROLES

        if normalized in {"admin"}:
            allowed = admin_roles
        elif normalized in {"representative", "surveyor"}:
            allowed = survey_roles
        else:
            allowed = survey_roles

        if current_user.has_any_role(allowed):
            return True

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Requires {required_role} permissions for program {program}",
        )

    return role_checker
