import os
import zlib
from dataclasses import dataclass
from functools import lru_cache

import jwt
from fastapi import HTTPException, status
from jwt import PyJWKClient
from jwt.exceptions import InvalidTokenError


@dataclass(frozen=True)
class AuthUser:
    sub: str
    name: str
    preferred_username: str
    roles: tuple[str, ...]
    claims: dict

    @property
    def email(self) -> str:
        return self.preferred_username

    @property
    def id(self) -> int:
        # Deterministic numeric identity for legacy integer audit columns.
        # Uses Entra `sub` (fallback to email) and remains stable per user.
        source = (self.sub or self.preferred_username or "").strip().encode("utf-8")
        if not source:
            return 1
        value = zlib.crc32(source) & 0x7FFFFFFF
        return value or 1

    @property
    def is_super_admin(self) -> bool:
        return "CX_SUPER_ADMIN" in self.roles

    def has_any_role(self, allowed_roles: tuple[str, ...]) -> bool:
        if self.is_super_admin:
            return True
        user_roles = set(self.roles)
        return any(role in user_roles for role in allowed_roles)


class EntraTokenValidator:
    def __init__(self) -> None:
        self.tenant_id = os.getenv("ENTRA_TENANT_ID", "97df7dc2-f178-4ce4-b55e-bcafc144485e")
        authority = os.getenv("ENTRA_AUTHORITY", f"https://login.microsoftonline.com/{self.tenant_id}").rstrip("/")

        self.expected_issuer = os.getenv("ENTRA_ISSUER", f"{authority}/v2.0")
        self.expected_audiences = self._resolve_audiences()
        self.jwks_url = os.getenv("ENTRA_JWKS_URL", f"{authority}/discovery/v2.0/keys")
        self.jwks_timeout_seconds = int(os.getenv("ENTRA_JWKS_TIMEOUT_SECONDS", "5"))
        self._jwk_client = PyJWKClient(self.jwks_url, timeout=self.jwks_timeout_seconds)

        # Optional debug logging (ASCII-safe for Windows consoles)
        if os.getenv("ENTRA_DEBUG", "false").strip().lower() in {"1", "true", "yes"}:
            print("Entra Validator Config:")
            print(f"  Tenant ID: {self.tenant_id}")
            print(f"  Authority: {authority}")
            print(f"  Expected Issuer: {self.expected_issuer}")
            print(f"  Expected Audiences: {self.expected_audiences}")
            print(f"  JWKS URL: {self.jwks_url}")
            print(f"  JWKS Timeout (s): {self.jwks_timeout_seconds}")

    def _resolve_audiences(self) -> tuple[str, ...]:
        raw_audience = os.getenv("ENTRA_AUDIENCE", "api://7e09a8c1-f113-4e3f-aeb7-21d1305cbd55")
        audiences = [item.strip() for item in raw_audience.split(",") if item.strip()]

        client_id = os.getenv("ENTRA_CLIENT_ID", "7e09a8c1-f113-4e3f-aeb7-21d1305cbd55")
        if client_id and client_id not in audiences:
            audiences.append(client_id)

        # Also accept the scope with /access_as_user suffix
        scope_audience = f"{raw_audience}/access_as_user"
        if scope_audience not in audiences:
            audiences.append(scope_audience)

        return tuple(audiences)

    def validate(self, token: str) -> AuthUser:
        try:
            signing_key = self._jwk_client.get_signing_key_from_jwt(token)
            claims = jwt.decode(
                token,
                signing_key.key,
                algorithms=["RS256"],
                audience=list(self.expected_audiences),
                options={"verify_signature": True, "verify_exp": True, "verify_aud": True, "verify_iss": False},
            )

            issuer = str(claims.get("iss", "")).rstrip("/")
            accepted_issuers = {
                str(self.expected_issuer).rstrip("/"),
                f"https://login.microsoftonline.com/{self.tenant_id}/v2.0",
                f"https://sts.windows.net/{self.tenant_id}",
            }
            if issuer not in accepted_issuers:
                raise InvalidTokenError("Invalid issuer")

            claim_tid = str(claims.get("tid", "")).lower()
            if claim_tid and claim_tid != str(self.tenant_id).lower():
                raise InvalidTokenError("Invalid tenant")
        except InvalidTokenError as exc:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Invalid access token: {exc}") from exc
        except Exception as exc:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Unable to validate access token: {exc}") from exc

        roles_claim = claims.get("roles") or []
        if isinstance(roles_claim, str):
            roles = (roles_claim,)
        elif isinstance(roles_claim, list):
            roles = tuple(str(role) for role in roles_claim)
        else:
            roles = tuple()

        return AuthUser(
            sub=str(claims.get("sub", "")),
            name=str(claims.get("name", "")),
            preferred_username=str(claims.get("preferred_username", "")),
            roles=roles,
            claims=claims,
        )


@lru_cache(maxsize=1)
def get_entra_validator() -> EntraTokenValidator:
    return EntraTokenValidator()
