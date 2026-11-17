import base64
import hashlib
import hmac
import html
import os
import secrets
import struct
import uuid
from datetime import datetime, timedelta, timezone
from urllib.parse import quote

from cryptography.fernet import Fernet
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..core.auth.entra import AuthUser
from ..core.database import get_db
from ..core.settings import get_settings

try:
    from argon2 import PasswordHasher
    from argon2.exceptions import VerifyMismatchError
except Exception:  # pragma: no cover
    PasswordHasher = None
    VerifyMismatchError = Exception


router = APIRouter(prefix="/auth", tags=["mystery-auth"])
admin_router = APIRouter(prefix="/mystery-admin/users", tags=["mystery-admin"])

SESSION_COOKIE_NAME = "ms_session"
SESSION_COOKIE_PATH = "/"
SESSION_COOKIE_SAMESITE = "strict"
ACTIVE_USER_STATUSES = {"active"}
ENROLLABLE_USER_STATUSES = {"invited", "recovery_pending", "active"}
UTC = timezone.utc
_PASSWORD_HASHER = PasswordHasher() if PasswordHasher else None


class MysteryLoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=1, max_length=4096)


class MysteryMfaRequest(BaseModel):
    challenge: str = Field(min_length=20, max_length=256)
    code: str = Field(min_length=6, max_length=12)


class EnrollmentStartRequest(BaseModel):
    enrollment_token: str = Field(min_length=20, max_length=256)


class EnrollmentConfirmRequest(BaseModel):
    enrollment_token: str = Field(min_length=20, max_length=256)
    password: str = Field(min_length=8, max_length=4096)
    code: str = Field(min_length=6, max_length=12)


class RecoveryRequest(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    recovery_code: str = Field(min_length=6, max_length=128)


MIN_ENROLL_LINK_MINUTES = 5
MAX_ENROLL_LINK_MINUTES = 7 * 24 * 60  # 7 days


class AdminCreateUserRequest(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    full_name: str = Field(min_length=2, max_length=255)
    # Optional per-link validity override (minutes). None -> MYSTERY_ENROLL_TOKEN_MINUTES.
    expires_in_minutes: int | None = Field(default=None, ge=MIN_ENROLL_LINK_MINUTES, le=MAX_ENROLL_LINK_MINUTES)


class AdminEnrollmentLinkRequest(BaseModel):
    expires_in_minutes: int | None = Field(default=None, ge=MIN_ENROLL_LINK_MINUTES, le=MAX_ENROLL_LINK_MINUTES)


def utcnow() -> datetime:
    return datetime.now(UTC)


def as_aware_utc(value: datetime | None) -> datetime | None:
    # PostgreSQL TIMESTAMP WITHOUT TIME ZONE columns come back naive (stored
    # as UTC); SQLite test converters return aware. Normalize before comparing
    # against utcnow().
    if value is not None and value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value


def normalize_email(value: str) -> str:
    return (value or "").strip().lower()


def _get_fernet() -> Fernet:
    settings = get_settings()
    if not settings.mystery_auth_secret_key:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Mystery auth secret key is not configured")
    try:
        return Fernet(settings.mystery_auth_secret_key.encode("utf-8"))
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Mystery auth secret key is invalid") from exc


def hash_password(password: str) -> str:
    if _PASSWORD_HASHER:
        return _PASSWORD_HASHER.hash(password)
    salt = secrets.token_bytes(16)
    derived = hashlib.scrypt(password.encode("utf-8"), salt=salt, n=2**14, r=8, p=1)
    return "scrypt$" + base64.b64encode(salt + derived).decode("utf-8")


def verify_password(password: str, password_hash: str | None) -> bool:
    if not password_hash:
        return False
    if password_hash.startswith("scrypt$"):
        try:
            decoded = base64.b64decode(password_hash.split("$", 1)[1].encode("utf-8"))
            salt, expected = decoded[:16], decoded[16:]
            actual = hashlib.scrypt(password.encode("utf-8"), salt=salt, n=2**14, r=8, p=1)
            return hmac.compare_digest(actual, expected)
        except Exception:
            return False
    if not _PASSWORD_HASHER:
        return False
    try:
        return bool(_PASSWORD_HASHER.verify(password_hash, password))
    except VerifyMismatchError:
        return False
    except Exception:
        return False


def encrypt_totp_secret(secret: str) -> str:
    return _get_fernet().encrypt(secret.encode("utf-8")).decode("utf-8")


def decrypt_totp_secret(secret_enc: str | None) -> str | None:
    if not secret_enc:
        return None
    return _get_fernet().decrypt(secret_enc.encode("utf-8")).decode("utf-8")


def new_totp_secret() -> str:
    return base64.b32encode(secrets.token_bytes(20)).decode("utf-8").rstrip("=")


def totp_uri(secret: str, email: str) -> str:
    issuer = quote("CWSCX Mystery Shopper")
    label = quote(f"CWSCX Mystery Shopper:{normalize_email(email)}")
    return f"otpauth://totp/{label}?secret={secret}&issuer={issuer}&algorithm=SHA1&digits=6&period=30"


def _totp_at(secret: str, counter: int, digits: int = 6) -> str:
    key = base64.b32decode(secret + "=" * ((8 - len(secret) % 8) % 8), casefold=True)
    msg = struct.pack(">Q", counter)
    digest = hmac.new(key, msg, hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    code = struct.unpack(">I", digest[offset:offset + 4])[0] & 0x7FFFFFFF
    return str(code % (10**digits)).zfill(digits)


def verify_totp(secret: str, code: str, last_step: int | None, *, window: int = 1, step_seconds: int = 30) -> int | None:
    candidate = "".join(ch for ch in str(code or "") if ch.isdigit())
    if len(candidate) != 6:
        return None
    now_step = int(utcnow().timestamp()) // step_seconds
    for offset in range(-window, window + 1):
        step_value = now_step + offset
        if last_step is not None and step_value <= int(last_step):
            continue
        if hmac.compare_digest(_totp_at(secret, step_value), candidate):
            return step_value
    return None


def generate_recovery_codes(n: int = 8) -> list[str]:
    codes: list[str] = []
    for _ in range(max(1, n)):
        raw = secrets.token_hex(4).upper()
        codes.append(f"{raw[:4]}-{raw[4:]}")
    return codes


def token_hash(value: str) -> str:
    return hashlib.sha256((value or "").encode("utf-8")).hexdigest()


def issue_session_cookie(response: Response, session_id: str) -> None:
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=session_id,
        httponly=True,
        secure=True,
        samesite=SESSION_COOKIE_SAMESITE,
        path=SESSION_COOKIE_PATH,
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(
        key=SESSION_COOKIE_NAME,
        httponly=True,
        secure=True,
        samesite=SESSION_COOKIE_SAMESITE,
        path=SESSION_COOKIE_PATH,
    )


def audit_auth_event(db: Session, *, event_type: str, request: Request | None = None, user_id: str | None = None, email: str | None = None) -> None:
    ip_address = request.client.host if request and request.client else None
    user_agent = request.headers.get("user-agent") if request else None
    db.execute(
        text(
            """
            INSERT INTO mystery_auth_audit (id, user_id, email, event_type, ip, user_agent, created_at)
            VALUES (:id, :user_id, :email, :event_type, :ip, :user_agent, NOW())
            """
        ),
        {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "email": normalize_email(email) if email else None,
            "event_type": event_type,
            "ip": ip_address,
            "user_agent": user_agent,
        },
    )


LOCKOUT_THRESHOLD = 5  # wrong attempts allowed before the account is temporarily locked


def _apply_lockout(now: datetime, failed_count: int) -> datetime | None:
    # A couple of typos must not lock a shopper out (a single wrong password used to lock the account
    # for a minute, so even the correct password was then rejected). Lock only from the 5th failure.
    if failed_count < LOCKOUT_THRESHOLD:
        return None
    return now + timedelta(minutes=min(60, 2 ** (failed_count - LOCKOUT_THRESHOLD)))


def _fetch_user_by_email(db: Session, email: str):
    return db.execute(text("SELECT * FROM mystery_users WHERE lower(email) = :email LIMIT 1"), {"email": normalize_email(email)}).mappings().first()


def _fetch_user_by_id(db: Session, user_id: str):
    return db.execute(text("SELECT * FROM mystery_users WHERE id = :user_id LIMIT 1"), {"user_id": user_id}).mappings().first()


def _is_locked(user_row, now: datetime) -> bool:
    locked_until = as_aware_utc(user_row.get("locked_until"))
    return bool(locked_until and locked_until > now)


def _reset_login_failures(db: Session, user_id: str) -> None:
    db.execute(
        text(
            "UPDATE mystery_users SET failed_login_count = 0, failed_mfa_count = 0, locked_until = NULL, updated_at = NOW() WHERE id = :user_id"
        ),
        {"user_id": user_id},
    )


def _record_failed_login(db: Session, user_row, now: datetime) -> None:
    next_count = int(user_row.get("failed_login_count") or 0) + 1
    db.execute(
        text("UPDATE mystery_users SET failed_login_count = :count, locked_until = :locked_until, updated_at = NOW() WHERE id = :user_id"),
        {"user_id": user_row["id"], "count": next_count, "locked_until": _apply_lockout(now, next_count)},
    )


def _record_failed_mfa(db: Session, user_row, now: datetime) -> None:
    next_count = int(user_row.get("failed_mfa_count") or 0) + 1
    db.execute(
        text("UPDATE mystery_users SET failed_mfa_count = :count, locked_until = :locked_until, updated_at = NOW() WHERE id = :user_id"),
        {"user_id": user_row["id"], "count": next_count, "locked_until": _apply_lockout(now, next_count)},
    )


def _issue_enrollment_token(
    db: Session, user_id: str, *, purpose: str = "enroll", expires_in_minutes: int | None = None
) -> tuple[str, datetime]:
    raw = secrets.token_urlsafe(32)
    minutes = expires_in_minutes or get_settings().mystery_enroll_token_minutes
    minutes = max(MIN_ENROLL_LINK_MINUTES, min(MAX_ENROLL_LINK_MINUTES, int(minutes)))
    now = utcnow()
    expires_at = now + timedelta(minutes=minutes)
    # A new link replaces any earlier unused link for this user (expire them now).
    db.execute(
        text(
            "UPDATE mystery_enrollment_tokens SET expires_at = :now "
            "WHERE user_id = :user_id AND used_at IS NULL AND expires_at > :now"
        ),
        {"user_id": user_id, "now": now},
    )
    db.execute(
        text(
            """
            INSERT INTO mystery_enrollment_tokens (
                token_hash, user_id, purpose, pending_totp_secret_enc, expires_at, used_at, created_at
            ) VALUES (
                :token_hash, :user_id, :purpose, NULL, :expires_at, NULL, NOW()
            )
            """
        ),
        {"token_hash": token_hash(raw), "user_id": user_id, "purpose": purpose, "expires_at": expires_at},
    )
    return raw, expires_at


def _fetch_enrollment_token_row(db: Session, raw_token: str):
    return db.execute(
        text("SELECT * FROM mystery_enrollment_tokens WHERE token_hash = :token_hash LIMIT 1"),
        {"token_hash": token_hash(raw_token)},
    ).mappings().first()


MSG_LINK_INVALID = (
    "This enrollment link is not valid. Please make sure you copied the whole link from the email, "
    "or ask your administrator to send you a new one."
)
MSG_LINK_EXPIRED = (
    "This enrollment link has expired or has been replaced by a newer link. "
    "Please ask your administrator to send you a new link."
)
MSG_LINK_USED = (
    "This enrollment link has already been used. If you have already enrolled, go to the sign-in page. "
    "If you can't sign in, ask your administrator for help."
)
MSG_NOT_ELIGIBLE = (
    "Your account can't be enrolled right now (it may be suspended). Please contact your administrator."
)
MSG_SETUP_EXPIRED = "Your authenticator setup was not found. Please reload this page to start again."
MSG_CODE_REJECTED = (
    "That authenticator code wasn't accepted. Codes change every 30 seconds, so wait for the next code and try again. "
    "If it keeps failing, check that your phone's date and time are set to automatic, and that you added the "
    "account you just scanned."
)
MSG_MFA_SESSION_TIMED_OUT = "Your sign-in session timed out. Please enter your email and password again."


def _assert_valid_enrollment_token(token_row, *, allow_used: bool = False):
    if not token_row:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=MSG_LINK_INVALID)
    if not allow_used and token_row.get("used_at"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=MSG_LINK_USED)
    if as_aware_utc(token_row.get("expires_at")) <= utcnow():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=MSG_LINK_EXPIRED)


def _store_pending_secret(db: Session, raw_token: str, secret: str) -> None:
    db.execute(
        text("UPDATE mystery_enrollment_tokens SET pending_totp_secret_enc = :secret WHERE token_hash = :token_hash"),
        {"secret": encrypt_totp_secret(secret), "token_hash": token_hash(raw_token)},
    )


def _replace_recovery_codes(db: Session, user_id: str) -> list[str]:
    db.execute(text("DELETE FROM mystery_recovery_codes WHERE user_id = :user_id"), {"user_id": user_id})
    codes = generate_recovery_codes()
    for code in codes:
        db.execute(
            text("INSERT INTO mystery_recovery_codes (id, user_id, code_hash, used_at, created_at) VALUES (:id, :user_id, :code_hash, NULL, NOW())"),
            {"id": str(uuid.uuid4()), "user_id": user_id, "code_hash": hash_password(code)},
        )
    return codes


def create_mfa_challenge(db: Session, user_id: str, request: Request) -> str:
    challenge = secrets.token_urlsafe(32)
    expires_at = utcnow() + timedelta(minutes=get_settings().mystery_mfa_challenge_minutes)
    db.execute(
        text(
            "INSERT INTO mystery_mfa_challenges (challenge_id, user_id, created_at, expires_at, used_at, ip, user_agent) VALUES (:challenge_id, :user_id, NOW(), :expires_at, NULL, :ip, :user_agent)"
        ),
        {
            "challenge_id": challenge,
            "user_id": user_id,
            "expires_at": expires_at,
            "ip": request.client.host if request.client else None,
            "user_agent": request.headers.get("user-agent"),
        },
    )
    return challenge


def create_session(db: Session, user_id: str, request: Request) -> str:
    settings = get_settings()
    now = utcnow()
    session_id = secrets.token_urlsafe(48)
    db.execute(
        text(
            """
            INSERT INTO mystery_sessions (
                session_id, user_id, created_at, last_seen_at, absolute_expires_at, idle_expires_at, revoked_at, ip, user_agent
            ) VALUES (
                :session_id, :user_id, :created_at, :last_seen_at, :absolute_expires_at, :idle_expires_at, NULL, :ip, :user_agent
            )
            """
        ),
        {
            "session_id": session_id,
            "user_id": user_id,
            "created_at": now,
            "last_seen_at": now,
            "absolute_expires_at": now + timedelta(hours=settings.mystery_session_absolute_hours),
            "idle_expires_at": now + timedelta(minutes=settings.mystery_session_idle_minutes),
            "ip": request.client.host if request.client else None,
            "user_agent": request.headers.get("user-agent"),
        },
    )
    return session_id


def revoke_session(db: Session, session_id: str | None) -> None:
    if session_id:
        db.execute(text("UPDATE mystery_sessions SET revoked_at = NOW() WHERE session_id = :session_id AND revoked_at IS NULL"), {"session_id": session_id})


def load_session(db: Session, session_id: str | None):
    if not session_id:
        return None, None
    row = db.execute(
        text(
            "SELECT s.*, u.email, u.full_name, u.status AS user_status FROM mystery_sessions s JOIN mystery_users u ON u.id = s.user_id WHERE s.session_id = :session_id LIMIT 1"
        ),
        {"session_id": session_id},
    ).mappings().first()
    if not row:
        return None, None
    now = utcnow()
    if row.get("revoked_at") or as_aware_utc(row.get("absolute_expires_at")) <= now or as_aware_utc(row.get("idle_expires_at")) <= now:
        revoke_session(db, session_id)
        return None, row
    if (row.get("user_status") or "").lower() not in ACTIVE_USER_STATUSES:
        revoke_session(db, session_id)
        return None, row
    db.execute(
        text("UPDATE mystery_sessions SET last_seen_at = :last_seen_at, idle_expires_at = :idle_expires_at WHERE session_id = :session_id"),
        {
            "session_id": session_id,
            "last_seen_at": now,
            "idle_expires_at": now + timedelta(minutes=get_settings().mystery_session_idle_minutes),
        },
    )
    return row, None


def build_auth_user(user_row) -> AuthUser:
    # The row may come from the mystery_sessions JOIN (user_id) or
    # directly from the mystery_users table (id).  Accept both.
    uid = str(user_row.get("user_id") or user_row.get("id"))
    return AuthUser(
        sub=f"mystery:{uid}",
        name=user_row.get("full_name") or user_row.get("email") or "Mystery User",
        preferred_username=user_row.get("email") or "",
        roles=("MYSTERY_SURVEYOR",),
        claims={"auth_mode": "mystery_public", "mystery_user_id": uid},
    )


def load_mystery_public_auth_user(db: Session, request: Request) -> AuthUser:
    session_id = request.cookies.get(SESSION_COOKIE_NAME)
    session_row, expired_row = load_session(db, session_id)
    if not session_row:
        if expired_row:
            audit_auth_event(db, event_type="session_expired", request=request, user_id=expired_row.get("user_id"), email=expired_row.get("email"))
            db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No active mystery public session")
    db.commit()
    return build_auth_user(session_row)


def _build_enrollment_payload(user_row, raw_token: str, expires_at: datetime) -> dict:
    base_url = os.getenv("MYSTERY_PUBLIC_BASE_URL", "").rstrip("/")
    enroll_url = f"{base_url}/?enroll={raw_token}" if base_url else None
    return {
        "user_id": str(user_row["id"]),
        "email": user_row.get("email"),
        "full_name": user_row.get("full_name"),
        "status": user_row.get("status"),
        "enrollment_token": raw_token,
        "enrollment_url": enroll_url,
        "expires_at": expires_at.isoformat(),
    }


@router.get("/session")
async def get_public_auth_session(request: Request, db: Session = Depends(get_db)):
    try:
        current_user = load_mystery_public_auth_user(db, request)
    except HTTPException:
        db.rollback()
        raise
    return {
        "sub": current_user.sub,
        "name": current_user.name,
        "preferred_username": current_user.preferred_username,
        "roles": list(current_user.roles),
    }


@router.post("/login")
async def login_public_user(payload: MysteryLoginRequest, request: Request, db: Session = Depends(get_db)):
    generic_error = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email, password, or account status")
    now = utcnow()
    email = normalize_email(payload.email)
    user_row = _fetch_user_by_email(db, email)
    if not user_row:
        audit_auth_event(db, event_type="login_fail", request=request, email=email)
        db.commit()
        raise generic_error
    if _is_locked(user_row, now):
        audit_auth_event(db, event_type="lockout", request=request, user_id=user_row["id"], email=email)
        db.commit()
        # Say so explicitly: the generic 401 made a locked account look like a rejected password.
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many unsuccessful attempts. Your account is temporarily locked. Please wait a few minutes and try again.",
        )
    if (user_row.get("status") or "").lower() not in ACTIVE_USER_STATUSES:
        audit_auth_event(db, event_type="login_fail", request=request, user_id=user_row["id"], email=email)
        db.commit()
        raise generic_error
    if not verify_password(payload.password, user_row.get("password_hash")):
        _record_failed_login(db, user_row, now)
        audit_auth_event(db, event_type="login_fail", request=request, user_id=user_row["id"], email=email)
        db.commit()
        raise generic_error
    _reset_login_failures(db, user_row["id"])
    challenge = create_mfa_challenge(db, user_row["id"], request)
    audit_auth_event(db, event_type="login_ok", request=request, user_id=user_row["id"], email=email)
    db.commit()
    return {"challenge": challenge, "mfa_required": True}


@router.post("/mfa")
async def verify_public_mfa(payload: MysteryMfaRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    generic_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=(
            "That code wasn't accepted. Wait for the next 6-digit code in your authenticator app and try again. "
            "After several wrong attempts your account is locked for a few minutes."
        ),
    )
    challenge_row = db.execute(text("SELECT * FROM mystery_mfa_challenges WHERE challenge_id = :challenge_id LIMIT 1"), {"challenge_id": payload.challenge}).mappings().first()
    now = utcnow()
    if not challenge_row or challenge_row.get("used_at") or as_aware_utc(challenge_row.get("expires_at")) <= now:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=MSG_MFA_SESSION_TIMED_OUT)
    user_row = _fetch_user_by_id(db, challenge_row["user_id"])
    if not user_row or (user_row.get("status") or "").lower() not in ACTIVE_USER_STATUSES or _is_locked(user_row, now):
        audit_auth_event(db, event_type="mfa_fail", request=request, user_id=challenge_row.get("user_id"), email=user_row.get("email") if user_row else None)
        db.commit()
        raise generic_error
    secret = decrypt_totp_secret(user_row.get("totp_secret_enc"))
    next_step = verify_totp(secret or "", payload.code, user_row.get("last_totp_step")) if secret else None
    if next_step is None:
        _record_failed_mfa(db, user_row, now)
        audit_auth_event(db, event_type="mfa_fail", request=request, user_id=user_row["id"], email=user_row.get("email"))
        db.commit()
        raise generic_error
    session_id = create_session(db, user_row["id"], request)
    db.execute(
        text("UPDATE mystery_users SET failed_mfa_count = 0, locked_until = NULL, last_totp_step = :last_totp_step, last_login_at = NOW(), updated_at = NOW() WHERE id = :user_id"),
        {"user_id": user_row["id"], "last_totp_step": int(next_step)},
    )
    db.execute(text("UPDATE mystery_mfa_challenges SET used_at = NOW() WHERE challenge_id = :challenge_id"), {"challenge_id": payload.challenge})
    audit_auth_event(db, event_type="mfa_ok", request=request, user_id=user_row["id"], email=user_row.get("email"))
    db.commit()
    issue_session_cookie(response, session_id)
    current_user = build_auth_user(user_row)
    return {"sub": current_user.sub, "name": current_user.name, "preferred_username": current_user.preferred_username, "roles": list(current_user.roles)}


@router.post("/enroll/start")
async def enroll_start(payload: EnrollmentStartRequest, db: Session = Depends(get_db)):
    token_row = _fetch_enrollment_token_row(db, payload.enrollment_token)
    _assert_valid_enrollment_token(token_row)
    user_row = _fetch_user_by_id(db, token_row["user_id"])
    if not user_row or (user_row.get("status") or "").lower() not in ENROLLABLE_USER_STATUSES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=MSG_NOT_ELIGIBLE)
    secret = decrypt_totp_secret(token_row.get("pending_totp_secret_enc"))
    if not secret:
        secret = new_totp_secret()
        _store_pending_secret(db, payload.enrollment_token, secret)
    db.commit()
    return {
        "email": user_row.get("email"),
        "full_name": user_row.get("full_name"),
        "manual_key": secret,
        "otpauth_uri": totp_uri(secret, user_row.get("email") or ""),
        "expires_at": token_row.get("expires_at").isoformat() if token_row.get("expires_at") else None,
    }


@router.post("/enroll/confirm")
async def enroll_confirm(payload: EnrollmentConfirmRequest, request: Request, db: Session = Depends(get_db)):
    token_row = _fetch_enrollment_token_row(db, payload.enrollment_token)
    _assert_valid_enrollment_token(token_row)
    user_row = _fetch_user_by_id(db, token_row["user_id"])
    if not user_row or (user_row.get("status") or "").lower() not in ENROLLABLE_USER_STATUSES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=MSG_NOT_ELIGIBLE)
    secret = decrypt_totp_secret(token_row.get("pending_totp_secret_enc"))
    if not secret:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=MSG_SETUP_EXPIRED)
    next_step = verify_totp(secret, payload.code, None)
    if next_step is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=MSG_CODE_REJECTED)
    recovery_codes = _replace_recovery_codes(db, user_row["id"])
    db.execute(
        text(
            """
            UPDATE mystery_users
            SET password_hash = :password_hash,
                password_set_at = NOW(),
                totp_secret_enc = :totp_secret_enc,
                totp_confirmed_at = NOW(),
                status = 'active',
                failed_login_count = 0,
                failed_mfa_count = 0,
                locked_until = NULL,
                last_totp_step = :last_totp_step,
                updated_at = NOW()
            WHERE id = :user_id
            """
        ),
        {
            "user_id": user_row["id"],
            "password_hash": hash_password(payload.password),
            "totp_secret_enc": encrypt_totp_secret(secret),
            "last_totp_step": int(next_step),
        },
    )
    db.execute(text("UPDATE mystery_enrollment_tokens SET used_at = NOW() WHERE token_hash = :token_hash"), {"token_hash": token_hash(payload.enrollment_token)})
    audit_auth_event(db, event_type="enroll_ok", request=request, user_id=user_row["id"], email=user_row.get("email"))
    db.commit()
    return {"email": user_row.get("email"), "recovery_codes": recovery_codes}


@router.post("/recovery")
async def recovery_start(payload: RecoveryRequest, request: Request, db: Session = Depends(get_db)):
    generic_error = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid recovery request")
    user_row = _fetch_user_by_email(db, payload.email)
    if not user_row:
        audit_auth_event(db, event_type="recovery_fail", request=request, email=payload.email)
        db.commit()
        raise generic_error
    recovery_rows = db.execute(text("SELECT * FROM mystery_recovery_codes WHERE user_id = :user_id AND used_at IS NULL"), {"user_id": user_row["id"]}).mappings().all()
    matched = None
    for row in recovery_rows:
        if verify_password(payload.recovery_code, row.get("code_hash")):
            matched = row
            break
    if not matched:
        audit_auth_event(db, event_type="recovery_fail", request=request, user_id=user_row["id"], email=user_row.get("email"))
        db.commit()
        raise generic_error
    db.execute(text("UPDATE mystery_recovery_codes SET used_at = NOW() WHERE id = :id"), {"id": matched["id"]})
    db.execute(text("UPDATE mystery_users SET status = 'recovery_pending', updated_at = NOW() WHERE id = :user_id"), {"user_id": user_row["id"]})
    raw_token, expires_at = _issue_enrollment_token(db, user_row["id"], purpose="recovery")
    audit_auth_event(db, event_type="recovery_used", request=request, user_id=user_row["id"], email=user_row.get("email"))
    db.commit()
    return _build_enrollment_payload(user_row, raw_token, expires_at)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout_public_user(request: Request, response: Response, db: Session = Depends(get_db)):
    session_id = request.cookies.get(SESSION_COOKIE_NAME)
    session_row, _ = load_session(db, session_id)
    revoke_session(db, session_id)
    if session_row:
        audit_auth_event(db, event_type="logout", request=request, user_id=session_row.get("user_id"), email=session_row.get("email"))
    db.commit()
    clear_session_cookie(response)
    return None


@admin_router.get("")
async def list_public_mystery_users(db: Session = Depends(get_db)):
    rows = db.execute(
        text(
            """
            SELECT id, email, full_name, status, last_login_at, locked_until, created_at, updated_at,
                   (
                       SELECT MAX(t.expires_at) FROM mystery_enrollment_tokens t
                       WHERE t.user_id = mystery_users.id AND t.used_at IS NULL
                   ) AS active_link_expires_at
            FROM mystery_users
            ORDER BY created_at DESC, email ASC
            """
        )
    ).mappings().all()
    result = []
    for row in rows:
        item = dict(row)
        link_expiry = as_aware_utc(item.get("active_link_expires_at"))
        item["active_link_expires_at"] = link_expiry.isoformat() if link_expiry else None
        result.append(item)
    return result


@admin_router.post("")
async def create_public_mystery_user(payload: AdminCreateUserRequest, db: Session = Depends(get_db)):
    existing = _fetch_user_by_email(db, payload.email)
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A mystery public user with this email already exists")
    user_id = str(uuid.uuid4())
    db.execute(
        text(
            """
            INSERT INTO mystery_users (
                id, email, full_name, password_hash, password_set_at, totp_secret_enc, totp_confirmed_at,
                status, failed_login_count, failed_mfa_count, locked_until, last_totp_step, last_login_at,
                created_by, created_at, updated_at
            ) VALUES (
                :id, :email, :full_name, NULL, NULL, NULL, NULL,
                'invited', 0, 0, NULL, NULL, NULL,
                NULL, NOW(), NOW()
            )
            """
        ),
        {"id": user_id, "email": normalize_email(payload.email), "full_name": payload.full_name.strip()},
    )
    user_row = _fetch_user_by_id(db, user_id)
    raw_token, expires_at = _issue_enrollment_token(
        db, user_id, purpose="enroll", expires_in_minutes=payload.expires_in_minutes
    )
    db.commit()
    return _build_enrollment_payload(user_row, raw_token, expires_at)


@admin_router.post("/{user_id}/reissue-enrollment")
async def reissue_enrollment(
    user_id: str, payload: AdminEnrollmentLinkRequest | None = None, db: Session = Depends(get_db)
):
    user_row = _fetch_user_by_id(db, user_id)
    if not user_row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mystery public user not found")
    raw_token, expires_at = _issue_enrollment_token(
        db, user_id, purpose="enroll", expires_in_minutes=payload.expires_in_minutes if payload else None
    )
    db.commit()
    return _build_enrollment_payload(user_row, raw_token, expires_at)


@admin_router.post("/{user_id}/suspend")
async def suspend_public_mystery_user(user_id: str, db: Session = Depends(get_db)):
    user_row = _fetch_user_by_id(db, user_id)
    if not user_row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mystery public user not found")
    db.execute(text("UPDATE mystery_users SET status = 'suspended', updated_at = NOW() WHERE id = :user_id"), {"user_id": user_id})
    db.execute(text("UPDATE mystery_sessions SET revoked_at = NOW() WHERE user_id = :user_id AND revoked_at IS NULL"), {"user_id": user_id})
    db.commit()
    return {"status": "suspended", "user_id": user_id}


@admin_router.post("/{user_id}/reactivate")
async def reactivate_public_mystery_user(user_id: str, db: Session = Depends(get_db)):
    user_row = _fetch_user_by_id(db, user_id)
    if not user_row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mystery public user not found")
    db.execute(text("UPDATE mystery_users SET status = 'active', locked_until = NULL, updated_at = NOW() WHERE id = :user_id"), {"user_id": user_id})
    db.commit()
    return {"status": "active", "user_id": user_id}


SEYCHELLES_TZ = timezone(timedelta(hours=4), "SCT")  # Seychelles: UTC+4, no daylight saving

AUTHENTICATOR_APPS = (
    ("Microsoft Authenticator", "https://apps.apple.com/app/microsoft-authenticator/id983156458",
     "https://play.google.com/store/apps/details?id=com.azure.authenticator"),
    ("Google Authenticator", "https://apps.apple.com/app/google-authenticator/id388497605",
     "https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2"),
)


def _format_validity(expires_at: datetime) -> str:
    """Human wording for how long a freshly issued link lasts, e.g. '30 minutes', '24 hours', '3 days'."""
    minutes = max(1, round((expires_at - utcnow()).total_seconds() / 60))
    if minutes >= 2 * 24 * 60 - 30:
        return f"{round(minutes / (24 * 60))} days"
    if minutes >= 120 - 5:
        return f"{round(minutes / 60)} hours"
    if minutes >= 60 - 2:
        return "1 hour"
    return f"{minutes} minutes"


def _build_enrollment_email(
    full_name: str, enroll_url: str, expires_at: datetime, admin_name: str, admin_email: str, has_video: bool = False
) -> tuple[str, str, str]:
    subject = "Your CWS Mystery Shopper enrollment link"
    local_expiry = expires_at.astimezone(SEYCHELLES_TZ)
    expiry_text = local_expiry.strftime("%A %d %B %Y at %H:%M") + " (Seychelles time)"
    validity_text = _format_validity(expires_at)
    safe_name = html.escape(full_name)
    safe_url = html.escape(enroll_url, quote=True)
    safe_admin_name = html.escape(admin_name)
    safe_admin_email = html.escape(admin_email)

    # Only when a walkthrough video is actually attached to this message (see core/enrollment_video.py).
    video_text = (
        "WATCH FIRST (optional, about 2 minutes)\n"
        "A short video walkthrough of these steps is attached to this email. You can watch it any time,\n"
        "including before you connect to the CWS VPN. (You still need the CWS VPN to open your enrollment link.)\n"
        "\n"
        if has_video
        else ""
    )
    video_html = (
        '<p style="background:#f0fdfa;border:1px solid #99f6e4;border-radius:6px;padding:10px 12px">'
        "<strong>Watch first (optional, about 2 minutes)</strong><br>"
        "A short video walkthrough of these steps is attached to this email. You can watch it any time, "
        "including before you connect to the CWS VPN. (You still need the CWS VPN to open your enrollment link.)</p>"
        if has_video
        else ""
    )

    app_lines_text = "".join(
        f"  - {name}\n      iPhone/iPad: {ios}\n      Android:     {android}\n"
        for name, ios, android in AUTHENTICATOR_APPS
    )
    text_body = (
        f"Hello {full_name},\n"
        "\n"
        "You have been invited to the Cable & Wireless Seychelles Mystery Shopper platform.\n"
        "\n"
        f"{video_text}"
        "STEP 1 - GET AN AUTHENTICATOR APP (free, on your phone)\n"
        "To keep your account secure you sign in with your password AND a 6-digit code from an\n"
        "authenticator app. If you do not already have one, install either of these first:\n"
        f"{app_lines_text}"
        "\n"
        "STEP 2 - OPEN YOUR ENROLLMENT LINK\n"
        f"This link is valid for {validity_text}: it expires {expiry_text} and can only be used once.\n"
        f"{enroll_url}\n"
        "\n"
        "On that page you will:\n"
        "  1. Scan a QR code with your authenticator app (this adds your account to the app).\n"
        "  2. Choose the password you will use to sign in.\n"
        "  3. Enter the 6-digit code shown in the app, then save your one-time recovery codes.\n"
        "\n"
        "IMPORTANT: You must be connected to the CWS VPN to access the platform.\n"
        "Connect to the CWS VPN before opening the link and before every future sign-in.\n"
        "\n"
        f"If the link has expired or you run into any issues, contact {admin_name} at {admin_email}.\n"
        "\n"
        "Kind regards,\n"
        "CWS Team\n"
        "(This is an automated message sent on behalf of the administrator named above.)\n"
    )

    app_items_html = "".join(
        f"<li><strong>{html.escape(name)}</strong> &mdash; "
        f"<a href=\"{html.escape(ios, quote=True)}\">iPhone / iPad</a> &middot; "
        f"<a href=\"{html.escape(android, quote=True)}\">Android</a></li>"
        for name, ios, android in AUTHENTICATOR_APPS
    )
    html_body = (
        f"<p>Hello {safe_name},</p>"
        "<p>You have been invited to the <strong>Cable &amp; Wireless Seychelles Mystery Shopper platform</strong>.</p>"
        f"{video_html}"
        "<p><strong>Step 1 &mdash; Get an authenticator app (free, on your phone)</strong><br>"
        "To keep your account secure you sign in with your password <em>and</em> a 6-digit code from an authenticator app. "
        "If you don&rsquo;t already have one, install either of these first:</p>"
        f"<ul>{app_items_html}</ul>"
        "<p><strong>Step 2 &mdash; Open your enrollment link</strong></p>"
        # "Bulletproof" button: the padding and colour live on the table cell and the anchor fills it, so the whole
        # button is clickable in Outlook (its Word renderer ignores padding on inline-block anchors).
        "<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"margin:8px 0 12px 0;\"><tr>"
        "<td align=\"center\" bgcolor=\"#0f766e\" style=\"border-radius:6px;background:#0f766e;\">"
        f"<a href=\"{safe_url}\" target=\"_blank\" rel=\"noopener noreferrer\" "
        "style=\"display:block;padding:12px 24px;font-family:Arial,Helvetica,sans-serif;font-size:15px;"
        "font-weight:bold;color:#ffffff;text-decoration:none;border-radius:6px;\">"
        "<span style=\"color:#ffffff;\">Open my enrollment page</span></a>"
        "</td></tr></table>"
        f"<p>This link is valid for <strong>{validity_text}</strong>: it expires <strong>{expiry_text}</strong> "
        "and can only be used once.</p>"
        "<p>On that page you will:</p>"
        "<ol>"
        "<li>Scan a QR code with your authenticator app (this adds your account to the app).</li>"
        "<li>Choose the password you will use to sign in.</li>"
        "<li>Enter the 6-digit code shown in the app, then save your one-time recovery codes.</li>"
        "</ol>"
        "<p style=\"font-size:12px;color:#555\">If the button doesn&rsquo;t work, copy this full link into your browser:<br>"
        f"<a href=\"{safe_url}\" style=\"word-break:break-all\">{safe_url}</a></p>"
        "<p style=\"color:#b91c1c\"><strong>Important:</strong> you must be connected to the CWS VPN to access the "
        "platform &mdash; connect before opening the link and before every future sign-in.</p>"
        f"<p>If the link has expired or you run into any issues, contact {safe_admin_name} at "
        f"<a href=\"mailto:{safe_admin_email}\">{safe_admin_email}</a>.</p>"
        "<p>Kind regards,<br>CWS Team<br>"
        "<span style=\"font-size:12px;color:#555\">This is an automated message sent on behalf of the administrator named above.</span></p>"
    )
    return subject, text_body, html_body


@admin_router.post("/{user_id}/email-enrollment")
async def email_enrollment_link(
    user_id: str, request: Request, payload: AdminEnrollmentLinkRequest | None = None, db: Session = Depends(get_db)
):
    # Late import: app.core.auth.dependencies imports from this module, so a
    # top-level import here would be circular.
    from ..core.auth.dependencies import get_current_user, security
    from ..core.emailer import send_email

    credentials = await security(request)
    current_user = await get_current_user(request, db, credentials)

    user_row = _fetch_user_by_id(db, user_id)
    if not user_row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mystery public user not found")

    base_url = os.getenv("MYSTERY_PUBLIC_BASE_URL", "").rstrip("/")
    if not base_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="MYSTERY_PUBLIC_BASE_URL is not configured on this backend, so a full enrollment link cannot be emailed.",
        )

    raw_token, expires_at = _issue_enrollment_token(
        db, user_id, purpose="enroll", expires_in_minutes=payload.expires_in_minutes if payload else None
    )
    enroll_url = f"{base_url}/?enroll={raw_token}"

    admin_email = current_user.preferred_username or ""
    admin_name = current_user.name or admin_email or "the CX administrator"
    from ..core.enrollment_video import load_enrollment_video_attachments

    video_attachments = load_enrollment_video_attachments()  # [] unless explicitly enabled (default off)
    subject, text_body, html_body = _build_enrollment_email(
        user_row.get("full_name") or "there", enroll_url, expires_at, admin_name, admin_email, has_video=bool(video_attachments)
    )
    send_email(
        [user_row["email"]], subject, text_body, html_body, reply_to=admin_email or None, attachments=video_attachments or None
    )
    db.commit()
    return {
        "status": "sent",
        "user_id": str(user_row["id"]),
        "email": user_row.get("email"),
        "expires_at": expires_at.isoformat(),
        "contact": admin_email,
    }
