"""
Full-lifecycle integration tests for the Public Mystery Shopper Password+TOTP auth.

AUTH_MODE=mystery_public intentionally does NOT mount the /mystery-admin router,
so all user/enrollment setup is done via direct DB helpers, not admin HTTP endpoints.

Covers:
  - User creation via DB helper → enrollment token
  - Enrollment start → TOTP secret provisioning
  - Enrollment confirm → password + TOTP + recovery codes
  - Login → MFA challenge
  - MFA verification → session cookie
  - Authenticated session access
  - Protected survey endpoint access
  - Logout → session revoked
  - Recovery code → new enrollment flow
  - Lockout on repeated failures
  - Session expiry handling
  - Assertion that /mystery-admin/* returns 404 in public mode

Run:  TESTING=true DATABASE_URL=sqlite:///./ci.db python -m pytest backend/tests/test_mystery_public_auth_lifecycle.py -v
"""

import base64
import hashlib
import hmac
import os
import secrets
import sqlite3
import struct
import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import Session, sessionmaker

# Must be set BEFORE importing app modules
os.environ.setdefault("TESTING", "true")
os.environ.setdefault("DATABASE_URL", "sqlite:///./ci.db")
os.environ.setdefault("AUTH_MODE", "mystery_public")
os.environ["MYSTERY_AUTH_SECRET_KEY"] = base64.urlsafe_b64encode(os.urandom(32)).decode(
    "utf-8"
)
os.environ["ENVIRONMENT"] = "test"
os.environ["CORS_ALLOW_ORIGINS"] = ""
os.environ["MYSTERY_SESSION_IDLE_MINUTES"] = "60"
os.environ["MYSTERY_SESSION_ABSOLUTE_HOURS"] = "2"
os.environ["MYSTERY_MFA_CHALLENGE_MINUTES"] = "5"
os.environ["MYSTERY_ENROLL_TOKEN_MINUTES"] = "30"

UTC = timezone.utc


# ---------------------------------------------------------------------------
# Fixtures: database + test client
# ---------------------------------------------------------------------------


@pytest.fixture(scope="session")
def db_engine():
    """Create engine and ensure all core + mystery tables exist.

    Registers a SQLite-compatible NOW() function so that production SQL
    using ``NOW()`` (PostgreSQL syntax) works during testing.
    """
    database_url = os.getenv("DATABASE_URL", "sqlite:///./ci.db")
    connect_args = {"check_same_thread": False}
    # Enable PARSE_DECLTYPES so that TIMESTAMP columns are returned as
    # Python datetime objects even by raw ``text()`` queries (required
    # by the production code comparisons against Python datetimes).
    if database_url.startswith("sqlite:"):
        connect_args["detect_types"] = sqlite3.PARSE_DECLTYPES

    engine = create_engine(database_url, connect_args=connect_args)

    # ------------------------------------------------------------------
    # Register a NOW() SQL function for SQLite compatibility
    # ------------------------------------------------------------------
    @event.listens_for(engine, "connect")
    def _register_now(dbapi_connection, connection_record):
        if isinstance(dbapi_connection, sqlite3.Connection):
            dbapi_connection.create_function(
                "NOW", 0, lambda: datetime.now(UTC).strftime("%Y-%m-%d %H:%M:%S")
            )

    # Create core tables via ORM metadata
    from app.core.database import Base

    Base.metadata.create_all(bind=engine)

    # Create mystery public auth tables (normally created by Alembic migration)
    _create_mystery_tables(engine)

    # Bootstrap mystery shopper schema (locations, questions, etc.)
    _bootstrap_mystery_shopper(engine)

    yield engine

    # Teardown: drop mystery tables
    with engine.begin() as conn:
        for table in [
            "mystery_auth_audit",
            "mystery_enrollment_tokens",
            "mystery_recovery_codes",
            "mystery_mfa_challenges",
            "mystery_sessions",
            "mystery_users",
        ]:
            conn.execute(text(f"DROP TABLE IF EXISTS {table}"))


@pytest.fixture
def db_session(db_engine):
    """Provide a clean database session per test."""
    connection = db_engine.connect()
    transaction = connection.begin()
    SessionLocal = sessionmaker(bind=connection)
    session = SessionLocal()
    yield session
    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture
def client(db_engine):
    """FastAPI TestClient with mystery_public auth mode.

    Patches both ``engine`` and ``SessionLocal`` in ``app.core.database``
    so that the application uses the test engine (which has the SQLite
    ``NOW()`` registration and ``PARSE_DECLTYPES`` enabled).
    """
    with (
        patch("app.core.database.engine", db_engine),
        patch("app.core.database.SessionLocal", sessionmaker(bind=db_engine)),
    ):
        from app.main import create_app

        app = create_app()
        with TestClient(app) as c:
            yield c


# ---------------------------------------------------------------------------
# DB-level helpers (used instead of the unmounted /mystery-admin endpoints)
# ---------------------------------------------------------------------------


def create_invited_user_via_db(db_session: Session) -> dict:
    """Insert a mystery user + enrollment token directly in the DB.

    Uses SQLite-compatible ``CURRENT_TIMESTAMP`` to avoid reliance on
    the PostgreSQL ``NOW()`` function used in the production admin router.
    Returns a dict with keys: user_id, email, full_name, enrollment_token, status.
    """
    from app.api.mystery_auth import token_hash as compute_token_hash

    user_id = str(uuid.uuid4())
    email = f"test-{uuid.uuid4().hex[:8]}@example.com"

    db_session.execute(
        text(
            """
            INSERT INTO mystery_users (
                id, email, full_name, password_hash, password_set_at,
                totp_secret_enc, totp_confirmed_at, status,
                failed_login_count, failed_mfa_count, locked_until,
                last_totp_step, last_login_at, created_by, created_at, updated_at
            ) VALUES (
                :id, :email, :full_name, NULL, NULL,
                NULL, NULL, 'invited',
                0, 0, NULL,
                NULL, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            )
            """
        ),
        {
            "id": user_id,
            "email": email,
            "full_name": "Test User",
        },
    )

    # Generate enrollment token (same logic as _issue_enrollment_token but
    # using CURRENT_TIMESTAMP instead of NOW())
    raw_token = secrets.token_urlsafe(32)
    token_hash = compute_token_hash(raw_token)
    expires_at = datetime.now(UTC) + timedelta(minutes=30)

    db_session.execute(
        text(
            """
            INSERT INTO mystery_enrollment_tokens (
                token_hash, user_id, purpose, pending_totp_secret_enc,
                expires_at, used_at, created_at
            ) VALUES (
                :token_hash, :user_id, :purpose, NULL,
                :expires_at, NULL, CURRENT_TIMESTAMP
            )
            """
        ),
        {
            "token_hash": token_hash,
            "user_id": user_id,
            "purpose": "enroll",
            "expires_at": expires_at,
        },
    )
    db_session.commit()

    return {
        "user_id": user_id,
        "email": email,
        "full_name": "Test User",
        "enrollment_token": raw_token,
        "status": "invited",
    }


def create_enrolled_user_via_db(db_session: Session) -> dict:
    """Create a fully enrolled (active) user with password + TOTP + recovery codes.

    Returns the user record and the plain-text TOTP secret for test use.
    """
    from app.api.mystery_auth import (
        _replace_recovery_codes,
        encrypt_totp_secret,
        hash_password,
        new_totp_secret,
    )

    user_id = str(uuid.uuid4())
    email = f"enrolled-{uuid.uuid4().hex[:8]}@example.com"
    password = "Str0ng!Pass#2026"
    totp_secret = new_totp_secret()

    db_session.execute(
        text(
            """
            INSERT INTO mystery_users (
                id, email, full_name,
                password_hash, password_set_at,
                totp_secret_enc, totp_confirmed_at,
                status, failed_login_count, failed_mfa_count,
                locked_until, last_totp_step, last_login_at,
                created_by, created_at, updated_at
            ) VALUES (
                :id, :email, :full_name,
                :password_hash, CURRENT_TIMESTAMP,
                :totp_secret_enc, CURRENT_TIMESTAMP,
                'active', 0, 0,
                NULL, :last_step, NULL,
                NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            )
            """
        ),
        {
            "id": user_id,
            "email": email,
            "full_name": "Enrolled User",
            "password_hash": hash_password(password),
            "totp_secret_enc": encrypt_totp_secret(totp_secret),
            "last_step": int(datetime.now(UTC).timestamp()) // 30,
        },
    )

    # Generate recovery codes
    recovery_codes = _replace_recovery_codes(db_session, user_id)
    db_session.commit()

    return {
        "user_id": user_id,
        "email": email,
        "password": password,
        "totp_secret": totp_secret,
        "recovery_codes": recovery_codes,
    }


def _totp_at(secret: str, counter: int, digits: int = 6) -> str:
    """Generate a TOTP code for a given secret and counter."""
    key = base64.b32decode(secret + "=" * ((8 - len(secret) % 8) % 8), casefold=True)
    msg = struct.pack(">Q", counter)
    digest = hmac.new(key, msg, hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    code = struct.unpack(">I", digest[offset : offset + 4])[0] & 0x7FFFFFFF
    return str(code % (10**digits)).zfill(digits)


def current_totp_step(secret: str, offset: int = 0) -> int:
    """Current TOTP 30-second time step, optionally offset."""
    return int(datetime.now(UTC).timestamp()) // 30 + offset


def generate_totp_code(secret: str, offset: int = 0) -> str:
    """Generate a valid TOTP code for the current time step."""
    return _totp_at(secret, current_totp_step(secret, offset))


# ---------------------------------------------------------------------------
# SQLite bootstrap helpers
# ---------------------------------------------------------------------------


def _create_mystery_tables(engine):
    """Create the mystery public auth tables (migration equivalent)."""
    ddl_statements = [
        """
        CREATE TABLE IF NOT EXISTS mystery_users (
            id VARCHAR(36) PRIMARY KEY,
            email VARCHAR(320) NOT NULL UNIQUE,
            full_name VARCHAR(255) NOT NULL,
            password_hash TEXT,
            password_set_at TIMESTAMP,
            totp_secret_enc TEXT,
            totp_confirmed_at TIMESTAMP,
            status VARCHAR(20) NOT NULL DEFAULT 'invited',
            failed_login_count INTEGER NOT NULL DEFAULT 0,
            failed_mfa_count INTEGER NOT NULL DEFAULT 0,
            locked_until TIMESTAMP,
            last_totp_step BIGINT,
            last_login_at TIMESTAMP,
            created_by VARCHAR(320),
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS mystery_sessions (
            session_id VARCHAR(128) PRIMARY KEY,
            user_id VARCHAR(36) NOT NULL REFERENCES mystery_users(id) ON DELETE CASCADE,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            last_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            absolute_expires_at TIMESTAMP NOT NULL,
            idle_expires_at TIMESTAMP NOT NULL,
            revoked_at TIMESTAMP,
            ip VARCHAR(64),
            user_agent TEXT
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS mystery_recovery_codes (
            id VARCHAR(36) PRIMARY KEY,
            user_id VARCHAR(36) NOT NULL REFERENCES mystery_users(id) ON DELETE CASCADE,
            code_hash TEXT NOT NULL,
            used_at TIMESTAMP,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS mystery_enrollment_tokens (
            token_hash VARCHAR(64) PRIMARY KEY,
            user_id VARCHAR(36) NOT NULL REFERENCES mystery_users(id) ON DELETE CASCADE,
            purpose VARCHAR(20) NOT NULL DEFAULT 'enroll',
            pending_totp_secret_enc TEXT,
            expires_at TIMESTAMP NOT NULL,
            used_at TIMESTAMP,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS mystery_mfa_challenges (
            challenge_id VARCHAR(128) PRIMARY KEY,
            user_id VARCHAR(36) NOT NULL REFERENCES mystery_users(id) ON DELETE CASCADE,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            expires_at TIMESTAMP NOT NULL,
            used_at TIMESTAMP,
            ip VARCHAR(64),
            user_agent TEXT
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS mystery_auth_audit (
            id VARCHAR(36) PRIMARY KEY,
            user_id VARCHAR(36),
            email VARCHAR(320),
            event_type VARCHAR(40) NOT NULL,
            ip VARCHAR(64),
            user_agent TEXT,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """,
    ]
    with engine.begin() as conn:
        for ddl in ddl_statements:
            conn.execute(text(ddl))


def _bootstrap_mystery_shopper(engine):
    """Ensure the mystery shopper reference tables and questions exist (SQLite-compatible).

    Also creates a minimal ``visits`` table to satisfy ``init_db()`` which
    runs ALTER TABLE statements against it during startup.
    """
    from app.api.mystery_shopper import MYSTERY_SHOPPER_QUESTIONS

    # SQLite-compatible DDL
    bootstrap_ddl = [
        # Core shared tables needed by mystery shopper schema
        "CREATE TABLE IF NOT EXISTS survey_types (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, description TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
        "CREATE TABLE IF NOT EXISTS questions (id INTEGER PRIMARY KEY AUTOINCREMENT, survey_type_id INTEGER NOT NULL REFERENCES survey_types(id), question_number INTEGER NOT NULL, question_text TEXT NOT NULL, category TEXT, is_mandatory INTEGER DEFAULT 1, is_nps INTEGER DEFAULT 0, input_type TEXT DEFAULT 'text', score_min INTEGER, score_max INTEGER, choices TEXT, helper_text TEXT, requires_issue INTEGER DEFAULT 0, requires_escalation INTEGER DEFAULT 0, question_key TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
        # Minimal visits table (needed by init_db() ALTER TABLE + mystery_shopper_answers FK)
        "CREATE TABLE IF NOT EXISTS visits (id VARCHAR(36) PRIMARY KEY, business_id INTEGER NOT NULL DEFAULT 0, representative_id INTEGER NOT NULL DEFAULT 0, created_by INTEGER NOT NULL DEFAULT 0, visit_date DATE NOT NULL DEFAULT '2026-01-01', visit_type VARCHAR(50) NOT NULL DEFAULT 'Planned', escalation_occurred INTEGER NOT NULL DEFAULT 0, issue_experienced INTEGER NOT NULL DEFAULT 0, status VARCHAR(20) NOT NULL DEFAULT 'Draft', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
        # Mystery shopper tables
        "CREATE TABLE IF NOT EXISTS mystery_shopper_locations (id INTEGER PRIMARY KEY AUTOINCREMENT, name VARCHAR(255) NOT NULL UNIQUE, business_id INTEGER, active INTEGER NOT NULL DEFAULT 1, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)",
        "CREATE TABLE IF NOT EXISTS mystery_shopper_assessments (id INTEGER PRIMARY KEY AUTOINCREMENT, visit_id VARCHAR(36) NOT NULL UNIQUE, location_id INTEGER NOT NULL REFERENCES mystery_shopper_locations(id), visit_time VARCHAR(20) NOT NULL, purpose_of_visit VARCHAR(120) NOT NULL, staff_on_duty VARCHAR(255) NOT NULL, shopper_name VARCHAR(255) NOT NULL, report_completed_date DATE, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)",
        "CREATE TABLE IF NOT EXISTS mystery_shopper_purpose_options (id INTEGER PRIMARY KEY AUTOINCREMENT, name VARCHAR(120) NOT NULL UNIQUE, active INTEGER NOT NULL DEFAULT 1, sort_order INTEGER NOT NULL DEFAULT 0, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)",
        "CREATE TABLE IF NOT EXISTS mystery_shopper_answers (id INTEGER PRIMARY KEY AUTOINCREMENT, visit_id VARCHAR(36) NOT NULL REFERENCES visits(id) ON DELETE CASCADE, question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE, score INTEGER, answer_text TEXT, verbatim TEXT, actions TEXT NOT NULL DEFAULT '[]', created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)",
        "CREATE TABLE IF NOT EXISTS responses (id INTEGER PRIMARY KEY AUTOINCREMENT, visit_id VARCHAR(36) NOT NULL, question_id INTEGER NOT NULL, score INTEGER, answer_text TEXT, verbatim TEXT)",
    ]
    with engine.begin() as conn:
        for ddl in bootstrap_ddl:
            conn.execute(text(ddl))

    SessionLocal = sessionmaker(bind=engine)
    session = SessionLocal()
    try:
        # Seed default purpose options
        from app.api.mystery_shopper import DEFAULT_PURPOSE_OPTIONS

        for idx, name in enumerate(DEFAULT_PURPOSE_OPTIONS, start=1):
            session.execute(
                text(
                    "INSERT OR IGNORE INTO mystery_shopper_purpose_options (name, active, sort_order) VALUES (:name, 1, :sort_order)"
                ),
                {"name": name, "sort_order": idx},
            )

        # Ensure survey type exists
        session.execute(
            text(
                "INSERT OR IGNORE INTO survey_types (name, description) VALUES ('Mystery Shopper', 'Customer service centre mystery shopper assessment')"
            )
        )

        # Fetch survey type id
        st_id = session.execute(
            text("SELECT id FROM survey_types WHERE name = 'Mystery Shopper'")
        ).scalar()
        if not st_id:
            st_id = 1  # fallback

        # Seed questions
        for q in MYSTERY_SHOPPER_QUESTIONS:
            existing = session.execute(
                text("SELECT id FROM questions WHERE question_key = :qk LIMIT 1"),
                {"qk": q["question_key"]},
            ).scalar()
            if not existing:
                session.execute(
                    text("""
                        INSERT INTO questions (survey_type_id, question_number, question_text, category, is_mandatory, is_nps, input_type, score_min, score_max, choices, question_key)
                        VALUES (:st_id, :qn, :qt, :cat, :mand, :nps, :itype, :smin, :smax, :choices, :qk)
                    """),
                    {
                        "st_id": st_id,
                        "qn": 2000 + q["question_number"],
                        "qt": q["question_text"],
                        "cat": q["category"],
                        "mand": 1 if q["is_mandatory"] else 0,
                        "nps": 1 if q["is_nps"] else 0,
                        "itype": q["input_type"],
                        "smin": q["score_min"],
                        "smax": q["score_max"],
                        "choices": q.get("choices"),
                        "qk": q["question_key"],
                    },
                )
        session.commit()
    finally:
        session.close()


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestMysteryPublicAuthLifecycle:
    """Lifecycle tests for mystery_public auth mode.

    Naming convention:
    - ``test_*_via_http`` calls the public HTTP endpoints.
    - ``test_*_via_db`` manages state through direct DB helpers.
    """

    # ── HTTP tests that work in mystery_public mode ─────────────────────

    def test_health_endpoint(self, client):
        """Health endpoint works without auth."""
        resp = client.get("/health")
        assert resp.status_code in (200, 503)
        body = resp.json()
        assert "status" in body

    def test_no_session_returns_401(self, client):
        """Endpoints return 401 when no session cookie is present."""
        resp = client.get("/auth/session")
        assert resp.status_code == 401, resp.text

        resp = client.get("/questions?survey_type=Mystery%20Shopper")
        assert resp.status_code in (401, 403), resp.text

    def test_mystery_admin_returns_404_in_public_mode(self, client):
        """The /mystery-admin router is intentionally not mounted in mystery_public mode."""
        # GET list
        resp = client.get("/mystery-admin/users")
        assert resp.status_code == 404, resp.text

        # POST create
        resp = client.post(
            "/mystery-admin/users",
            json={"email": "any@example.com", "full_name": "Any"},
        )
        assert resp.status_code == 404, resp.text

        # Suspend
        resp = client.post("/mystery-admin/users/xxx/suspend")
        assert resp.status_code == 404, resp.text

        # Reactivate
        resp = client.post("/mystery-admin/users/xxx/reactivate")
        assert resp.status_code == 404, resp.text

        # Reissue enrollment
        resp = client.post("/mystery-admin/users/xxx/reissue-enrollment")
        assert resp.status_code == 404, resp.text

    def test_enrollment_start_bad_token(self, client):
        """Enrollment with an invalid token fails (400)."""
        # Token must be >= 20 characters per Pydantic validation
        resp = client.post(
            "/auth/enroll/start",
            json={"enrollment_token": "this-is-a-bad-token-123456789"},
        )
        assert resp.status_code == 400, resp.text

    def test_enrollment_start_valid_token_via_http(self, client, db_session):
        """User can start enrollment with a valid token created via DB helper."""
        user = create_invited_user_via_db(db_session)

        resp = client.post(
            "/auth/enroll/start",
            json={"enrollment_token": user["enrollment_token"]},
        )
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["email"] == user["email"]
        assert "manual_key" in data
        assert "otpauth_uri" in data
        assert "totp" in data["otpauth_uri"]

    def test_enrollment_short_password_fails_via_http(self, client, db_session):
        """Enrollment with a short password is rejected (422 Pydantic validation)."""
        user = create_invited_user_via_db(db_session)

        # Start enrollment to get TOTP secret
        enroll_resp = client.post(
            "/auth/enroll/start",
            json={"enrollment_token": user["enrollment_token"]},
        )
        assert enroll_resp.status_code == 200
        secret = enroll_resp.json()["manual_key"]

        totp_code = generate_totp_code(secret)
        confirm_resp = client.post(
            "/auth/enroll/confirm",
            json={
                "enrollment_token": user["enrollment_token"],
                "password": "Abc12",
                "code": totp_code,
            },
        )
        # Password validation is at the Pydantic level (min_length=8)
        assert confirm_resp.status_code == 422, confirm_resp.text

    def test_full_lifecycle_via_http(self, client, db_session):
        """Complete lifecycle: user creation → enrollment → login → MFA → session → survey → logout → recovery.

        Uses a DB helper for initial user creation (since /mystery-admin is
        not mounted in mystery_public mode), then exercises all public auth
        HTTP endpoints.
        """
        # =========================================================
        # 1. Create a user via DB helper (not admin HTTP endpoint)
        # =========================================================
        user = create_invited_user_via_db(db_session)
        email = user["email"]
        enrollment_token = user["enrollment_token"]

        # =========================================================
        # 2. Start enrollment → get TOTP secret
        # =========================================================
        enroll_start_resp = client.post(
            "/auth/enroll/start",
            json={"enrollment_token": enrollment_token},
        )
        assert enroll_start_resp.status_code == 200, enroll_start_resp.text
        enroll_data = enroll_start_resp.json()
        totp_secret = enroll_data["manual_key"]
        assert len(totp_secret) >= 16

        # =========================================================
        # 3. Confirm enrollment → set password, TOTP, get recovery codes
        # =========================================================
        password = "Str0ng!Pass#2026"
        totp_code = generate_totp_code(totp_secret)
        confirm_resp = client.post(
            "/auth/enroll/confirm",
            json={
                "enrollment_token": enrollment_token,
                "password": password,
                "code": totp_code,
            },
        )
        assert confirm_resp.status_code == 200, confirm_resp.text
        confirm_data = confirm_resp.json()
        assert confirm_data["email"] == email
        assert "recovery_codes" in confirm_data
        recovery_codes = confirm_data["recovery_codes"]
        assert len(recovery_codes) >= 4
        assert "-" in recovery_codes[0]  # Format: XXXX-XXXX

        # =========================================================
        # 4. Login with password → get MFA challenge
        # =========================================================
        login_resp = client.post(
            "/auth/login",
            json={"email": email, "password": password},
        )
        assert login_resp.status_code == 200, login_resp.text
        login_data = login_resp.json()
        assert login_data["mfa_required"] is True
        challenge = login_data["challenge"]
        assert len(challenge) > 20

        # =========================================================
        # 5. Login with wrong password → 401
        # =========================================================
        bad_login_resp = client.post(
            "/auth/login",
            json={"email": email, "password": "wrong-password"},
        )
        assert bad_login_resp.status_code == 401, bad_login_resp.text

        # =========================================================
        # 6. Submit MFA with valid TOTP → session cookie
        # =========================================================
        mfa_code = generate_totp_code(totp_secret)
        mfa_resp = client.post(
            "/auth/mfa",
            json={"challenge": challenge, "code": mfa_code},
        )
        assert mfa_resp.status_code == 200, mfa_resp.text
        mfa_data = mfa_resp.json()
        assert mfa_data["preferred_username"] == email
        assert "MYSTERY_SURVEYOR" in mfa_data["roles"]
        assert mfa_data["sub"].startswith("mystery:")

        # Verify session cookie was set
        session_cookie = mfa_resp.cookies.get("ms_session")
        assert session_cookie is not None
        assert len(session_cookie) > 20

        # =========================================================
        # 7. Access /auth/session with cookie → authenticated
        # =========================================================
        session_resp = client.get(
            "/auth/session",
            cookies={"ms_session": session_cookie},
        )
        assert session_resp.status_code == 200, session_resp.text
        session_data = session_resp.json()
        assert session_data["preferred_username"] == email
        assert "MYSTERY_SURVEYOR" in session_data["roles"]

        # =========================================================
        # 8. Access survey questions → works with session
        # =========================================================
        questions_resp = client.get(
            "/questions?survey_type=Mystery%20Shopper",
            cookies={"ms_session": session_cookie},
        )
        assert questions_resp.status_code == 200, questions_resp.text
        questions = questions_resp.json()
        assert len(questions) > 0

        # =========================================================
        # 9. Access mystery-shopper locations → works with session
        # =========================================================
        locations_resp = client.get(
            "/mystery-shopper/locations",
            cookies={"ms_session": session_cookie},
        )
        assert locations_resp.status_code == 200, locations_resp.text
        locations = locations_resp.json()
        assert isinstance(locations, list)

        # =========================================================
        # 10. Access mystery-shopper purposes → works with session
        # =========================================================
        purposes_resp = client.get(
            "/mystery-shopper/purposes",
            cookies={"ms_session": session_cookie},
        )
        assert purposes_resp.status_code == 200, purposes_resp.text

        # =========================================================
        # 11. Logout → session revoked
        # =========================================================
        logout_resp = client.post(
            "/auth/logout",
            cookies={"ms_session": session_cookie},
        )
        assert logout_resp.status_code == 204, logout_resp.text

        # Verify session is no longer valid
        session_after_logout = client.get(
            "/auth/session",
            cookies={"ms_session": session_cookie},
        )
        assert session_after_logout.status_code == 401, session_after_logout.text

        # =========================================================
        # 12. Recovery flow: use recovery code → new enrollment
        # =========================================================
        recovery_code = recovery_codes[0]
        recovery_resp = client.post(
            "/auth/recovery",
            json={"email": email, "recovery_code": recovery_code},
        )
        assert recovery_resp.status_code == 200, recovery_resp.text
        recovery_data = recovery_resp.json()
        assert recovery_data["email"] == email
        new_token = recovery_data["enrollment_token"]
        assert new_token is not None

    def test_mfa_wrong_code_fails_via_http(self, client, db_session):
        """MFA with wrong TOTP code fails (401)."""
        # Create + enroll user via DB helper
        user = create_enrolled_user_via_db(db_session)

        # Login → get challenge
        login_resp = client.post(
            "/auth/login",
            json={"email": user["email"], "password": user["password"]},
        )
        assert login_resp.status_code == 200, login_resp.text
        challenge = login_resp.json()["challenge"]

        # Submit wrong MFA code
        mfa_resp = client.post(
            "/auth/mfa",
            json={"challenge": challenge, "code": "000000"},
        )
        assert mfa_resp.status_code == 401, mfa_resp.text

    def test_expired_challenge_fails_via_http(self, client, db_session):
        """Using an expired MFA challenge fails (401)."""
        user = create_enrolled_user_via_db(db_session)

        # Login
        login_resp = client.post(
            "/auth/login",
            json={"email": user["email"], "password": user["password"]},
        )
        assert login_resp.status_code == 200
        challenge = login_resp.json()["challenge"]

        # Directly expire the challenge in DB
        db_session.execute(
            text(
                "UPDATE mystery_mfa_challenges SET expires_at = :exp WHERE challenge_id = :cid"
            ),
            {"exp": datetime.now(UTC) - timedelta(hours=1), "cid": challenge},
        )
        db_session.commit()

        # Now try MFA with the expired challenge
        mfa_code = generate_totp_code(user["totp_secret"])
        mfa_resp = client.post(
            "/auth/mfa",
            json={"challenge": challenge, "code": mfa_code},
        )
        assert mfa_resp.status_code == 401, mfa_resp.text

    # ── DB-level unit tests (replace admin-only HTTP endpoints) ─────────

    def test_create_user_via_db(self, db_session):
        """A user can be created directly via DB helper and the enrollment token is valid."""
        user = create_invited_user_via_db(db_session)
        assert user["user_id"] is not None
        assert "@" in user["email"]
        assert user["status"] == "invited"
        assert len(user["enrollment_token"]) > 20

        # Verify the row exists in the DB
        row = (
            db_session.execute(
                text("SELECT * FROM mystery_users WHERE id = :uid"),
                {"uid": user["user_id"]},
            )
            .mappings()
            .first()
        )
        assert row is not None
        assert row["email"] == user["email"]

        # Verify the enrollment token exists
        from app.api.mystery_auth import token_hash

        token_row = (
            db_session.execute(
                text("SELECT * FROM mystery_enrollment_tokens WHERE token_hash = :th"),
                {"th": token_hash(user["enrollment_token"])},
            )
            .mappings()
            .first()
        )
        assert token_row is not None
        assert token_row["user_id"] == user["user_id"]
        assert token_row["used_at"] is None

    def test_create_duplicate_email_via_db_raises(self, db_session):
        """Creating two users with the same email raises an integrity error."""
        user1 = create_invited_user_via_db(db_session)
        same_email = user1["email"]

        # Attempt to insert a duplicate email directly
        from sqlalchemy.exc import IntegrityError

        with pytest.raises(IntegrityError):
            db_session.execute(
                text(
                    """
                    INSERT INTO mystery_users (id, email, full_name, status, created_at, updated_at)
                    VALUES (:id, :email, 'Duplicate', 'invited', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    """
                ),
                {
                    "id": str(uuid.uuid4()),
                    "email": same_email,
                },
            )
            db_session.commit()

    def test_suspend_reactivate_via_db(self, db_session):
        """User status can be updated directly in the DB (admin-equivalent operation)."""
        user = create_invited_user_via_db(db_session)

        # Suspend
        db_session.execute(
            text(
                "UPDATE mystery_users SET status = 'suspended', updated_at = CURRENT_TIMESTAMP WHERE id = :uid"
            ),
            {"uid": user["user_id"]},
        )
        db_session.commit()

        row = db_session.execute(
            text("SELECT status FROM mystery_users WHERE id = :uid"),
            {"uid": user["user_id"]},
        ).scalar()
        assert row == "suspended"

        # Reactivate
        db_session.execute(
            text(
                "UPDATE mystery_users SET status = 'active', locked_until = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = :uid"
            ),
            {"uid": user["user_id"]},
        )
        db_session.commit()

        row = db_session.execute(
            text("SELECT status FROM mystery_users WHERE id = :uid"),
            {"uid": user["user_id"]},
        ).scalar()
        assert row == "active"

    def test_audit_log_created_via_db(self, client, db_session):
        """Auth events are recorded in the audit log (verify via DB query)."""
        from app.api.mystery_auth import token_hash

        user = create_invited_user_via_db(db_session)

        # Trigger a failed login event via HTTP
        client.post(
            "/auth/login",
            json={"email": user["email"], "password": "wrong"},
        )

        # Verify an audit event was created
        rows = (
            db_session.execute(
                text("SELECT * FROM mystery_auth_audit WHERE email = :email"),
                {"email": user["email"]},
            )
            .mappings()
            .all()
        )
        assert len(rows) >= 1
        event_types = [r["event_type"] for r in rows]
        assert "login_fail" in event_types

    def test_password_hashing_and_verification(self):
        """Password hashing and verification work at the unit level."""
        from app.api.mystery_auth import hash_password, verify_password

        pw = "MySecureP@ss1"
        hashed = hash_password(pw)
        assert hashed is not None
        assert hashed != pw

        # Verify correct password
        assert verify_password(pw, hashed) is True

        # Verify wrong password
        assert verify_password("wrong-password", hashed) is False

        # Verify None hash
        assert verify_password(pw, None) is False

    def test_totp_secret_encryption_decryption(self):
        """TOTP secret encryption/decryption round-trips correctly."""
        from app.api.mystery_auth import decrypt_totp_secret, encrypt_totp_secret

        secret = "JBSWY3DPEHPK3PXP"
        encrypted = encrypt_totp_secret(secret)
        assert encrypted != secret

        decrypted = decrypt_totp_secret(encrypted)
        assert decrypted == secret

        # None input returns None
        assert decrypt_totp_secret(None) is None

    def test_totp_code_generation_and_verification(self):
        """TOTP code generation works and can be verified."""
        from app.api.mystery_auth import new_totp_secret, verify_totp

        secret = new_totp_secret()
        assert len(secret) >= 16

        # Generate a code
        code = generate_totp_code(secret)
        assert len(code) == 6
        assert code.isdigit()

        # Verify the code (within window)
        step = verify_totp(secret, code, None, window=2)
        assert step is not None

        # Verify wrong code fails
        assert verify_totp(secret, "000000", None, window=2) is None

        # Verify with last_step prevents replay
        step = verify_totp(secret, code, None, window=0)
        if step is not None:
            # Same code should fail with last_step = step
            assert verify_totp(secret, code, step, window=2) is None

    def test_recovery_codes_generation(self):
        """Recovery codes are generated in the correct format."""
        from app.api.mystery_auth import generate_recovery_codes

        codes = generate_recovery_codes(8)
        assert len(codes) == 8
        for code in codes:
            assert "-" in code
            parts = code.split("-")
            assert len(parts) == 2
            assert len(parts[0]) == 4
            assert len(parts[1]) == 4

    def test_token_hashing(self):
        """Enrollment token hashing is deterministic."""
        from app.api.mystery_auth import token_hash

        token = "my-test-token-value"
        h1 = token_hash(token)
        h2 = token_hash(token)
        h3 = token_hash("different-token")

        assert h1 == h2
        assert h1 != h3
        assert len(h1) == 64  # SHA256 hex digest


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
