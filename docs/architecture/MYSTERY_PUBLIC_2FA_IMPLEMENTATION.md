# Mystery Shopper Public 2FA — Implementation & Setup Guide (Password + TOTP)

This is the **all-inclusive build guide** for adding Password + TOTP
authentication to the public Mystery Shopper survey on the DMZ VM. It is written
so an LLM coding agent (or engineer) can implement it end to end on a **new
feature branch**, deploy it to the DMZ for confirmation, and merge once working.

Read first: `docs/architecture/MYSTERY_PUBLIC_AUTH_OPTIONS.md` (the decided
design and risks) and `docs/deployment/MYSTERY_PUBLIC_DMZ_SETUP.md` (the DMZ
runtime shape).

---

## 0) Golden rules (do not violate)

1. **The test/staging VM must keep using Entra.** Mystery runs there next to the
   other frontends for internal users. The new auth is **off by default** and
   only switched on for the DMZ. Default behaviour must be byte-for-byte the
   current Entra flow.
2. **All new behaviour is gated** behind `AUTH_MODE` (backend) and
   `VITE_AUTH_MODE` (frontend), both defaulting to `entra`.
3. **No provisioning/admin endpoints on the DMZ.** The DMZ exposes only
   external-facing auth + survey routes. Creating/resetting users happens on the
   internal app.
4. **Secrets never in plaintext.** Passwords → Argon2id. TOTP secret →
   encrypted at rest. Session tokens → opaque, server-side.
5. **Downstream code stays unchanged.** The existing mystery endpoints use
   `get_current_user` → `require_roles(*MYSTERY_ROLES)`. The new auth must
   produce an `AuthUser` with role `MYSTERY_SURVEYOR` so none of that has to
   change.

---

## 1) Branch, scope, and merge plan

### Branch
```
git checkout -b feature/mystery-public-2fa
```

### Deliverable scope
- Backend: `AUTH_MODE` dispatch, new auth router(s), new tables + migration,
  TOTP/password/session helpers, internal admin provisioning endpoints.
- Frontend: `VITE_AUTH_MODE` switch, an auth adapter, login + MFA + enrolment +
  recovery screens, cookie-based API calls when in `mystery_public` mode.
- Deploy: DMZ build sets `VITE_AUTH_MODE=mystery_public`; DMZ `.env` gains
  `AUTH_MODE=mystery_public` + new secrets; bump the DMZ Alembic target.
- Docs + tests.

### Merge plan
1. Build on `feature/mystery-public-2fa`.
2. Deploy that branch to the **DMZ VM only** (the public workflow can deploy a
   branch). Internal test VM keeps running `main` with Entra — unaffected.
3. Confirm the DMZ login/enrol/recovery flows end to end (see §9 test plan).
4. Confirm the **test VM still uses Entra** (build the mystery frontend with the
   default and verify MSAL still loads).
5. Open PR → review → merge to `main`. Because everything is gated, merging does
   not change test or internal-production behaviour.

---

## 2) The gating switch (read this before writing code)

### Backend: `AUTH_MODE`
Add to `backend/app/core/settings.py`:
```python
auth_mode: str            # "entra" (default) | "mystery_public"
```
populated from `os.getenv("AUTH_MODE", "entra").strip().lower()`.

`backend/app/core/auth/dependencies.py` → `get_current_user` becomes a
dispatcher:
- `auth_mode == "entra"` (default): **exactly the current code** (dev bypass +
  Entra JWT validation). Do not modify this path's behaviour.
- `auth_mode == "mystery_public"`: read the session cookie, resolve the
  `mystery_users` row, and return an `AuthUser`:
  ```python
  AuthUser(
      sub=f"mystery:{user.id}",
      name=user.full_name,
      preferred_username=user.email,
      roles=("MYSTERY_SURVEYOR",),
      claims={"auth_mode": "mystery_public", "mystery_user_id": str(user.id)},
  )
  ```
  This keeps every existing `require_roles(*MYSTERY_ROLES)` and
  `get_current_user` call working with no changes.

### Frontend: `VITE_AUTH_MODE`
- `entra` (default): current MSAL behaviour in `main.jsx` / `App.jsx` /
  `auth.js`. Unchanged.
- `mystery_public`: mount a new `MysteryAuthProvider` instead of `MsalProvider`;
  use cookie auth and the new screens.

---

## 3) Backend implementation

### 3.1 New dependencies (`backend/requirements.txt`)
```
pyotp==2.9.0
qrcode[pil]==7.4.2
argon2-cffi==23.1.0
# 'cryptography' is already present (transitively via PyJWT[crypto]); pin it
# explicitly if you want: cryptography>=42
```

### 3.2 Database schema (new Alembic migration)
Create `backend/alembic/versions/20260527_000023_add_mystery_public_auth.py`
(set `down_revision` to the current head — at time of writing
`20260527_000022`). All statements idempotent / guarded, matching the style of
the existing migrations.

Tables (created in the shared internal production DB, which the DMZ backend
also connects to):

```sql
mystery_users(
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           VARCHAR(320) NOT NULL UNIQUE,
  full_name       VARCHAR(255) NOT NULL,
  password_hash   TEXT,                         -- Argon2id; NULL until enrolled
  password_set_at TIMESTAMPTZ,
  totp_secret_enc TEXT,                         -- encrypted base32; NULL until enrolled
  totp_confirmed_at TIMESTAMPTZ,
  status          VARCHAR(20) NOT NULL DEFAULT 'invited', -- invited|active|suspended|locked
  failed_login_count INTEGER NOT NULL DEFAULT 0,
  failed_mfa_count   INTEGER NOT NULL DEFAULT 0,
  locked_until    TIMESTAMPTZ,
  last_totp_step  BIGINT,                        -- replay guard
  last_login_at   TIMESTAMPTZ,
  created_by      VARCHAR(320),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
)

mystery_recovery_codes(
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   UUID NOT NULL REFERENCES mystery_users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,                       -- Argon2id of the code
  used_at   TIMESTAMPTZ
)

mystery_enrollment_tokens(
  token_hash TEXT PRIMARY KEY,                   -- sha256 of the raw token
  user_id    UUID NOT NULL REFERENCES mystery_users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ
)

mystery_sessions(
  session_id TEXT PRIMARY KEY,                   -- opaque random; the cookie value is sha256(session_id) lookup OR store hash
  user_id    UUID NOT NULL REFERENCES mystery_users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  absolute_expires_at TIMESTAMPTZ NOT NULL,
  idle_expires_at     TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  ip         VARCHAR(64),
  user_agent TEXT
)

mystery_auth_audit(
  id         BIGSERIAL PRIMARY KEY,
  user_id    UUID,                               -- nullable: failed login for unknown email
  email      VARCHAR(320),
  event_type VARCHAR(40) NOT NULL,               -- login_ok|login_fail|mfa_ok|mfa_fail|lockout|enroll_ok|recovery_used|password_reset|logout|session_expired
  ip         VARCHAR(64),
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
```

Store the **MFA challenge** (between password OK and TOTP OK) as a short-lived
signed value, not a table — sign it with the app secret, TTL 5 min, single use
(include a nonce you also stash in `mystery_sessions`-style memory or a tiny
`mystery_mfa_challenges` table if you prefer DB-backed single-use; a small table
is the safest for single-use enforcement).

### 3.3 New module: `backend/app/api/mystery_auth.py`
Helpers:
- `hash_password` / `verify_password` (argon2-cffi `PasswordHasher`).
- `encrypt_totp_secret` / `decrypt_totp_secret` using `cryptography.fernet`
  with key from `MYSTERY_AUTH_SECRET_KEY` (env). Generate per environment.
- `new_totp_secret()` → `pyotp.random_base32()`.
- `totp_uri(secret, email)` → `pyotp.totp.TOTP(secret).provisioning_uri(...)`.
- `verify_totp(secret, code, last_step)` → accept window ±1, reject if
  `code`'s step <= `last_step` (replay guard); return the new step to persist.
- `generate_recovery_codes(n=10)` + hashes.
- Session helpers: `create_session`, `load_session` (checks idle + absolute
  expiry, slides idle window, updates `last_seen_at`), `revoke_session`.
- Lockout helpers: increment counters, set `locked_until` with exponential
  backoff, auto-unlock when `now > locked_until`.

**Public router** `mystery_auth_public_router` (prefix `/auth`), mounted **only
when `AUTH_MODE=mystery_public`**:
- `POST /api/auth/login` — body `{email, password}`. Verifies allow-list +
  active + password. On success returns a single-use MFA challenge token. Always
  rate-limited; always audited. Use constant-time comparisons and uniform error
  messages (don't reveal whether email exists).
- `POST /api/auth/mfa` — body `{challenge, code}`. Verifies TOTP, issues the
  session cookie (`Set-Cookie: ms_session=...; HttpOnly; Secure; SameSite=Strict;
  Path=/`). Persists `last_totp_step`.
- `POST /api/auth/logout` — revokes the session, clears the cookie.
- `POST /api/auth/enroll/start` — body `{enrollment_token}`. Returns TOTP secret
  + provisioning URI (+ QR data URL via `qrcode`). Does not activate yet.
- `POST /api/auth/enroll/confirm` — body `{enrollment_token, password, code}`.
  Sets password, confirms TOTP, flips status to `active`, returns the recovery
  codes (shown once).
- `POST /api/auth/recovery` — body `{email, recovery_code}`. Consumes a recovery
  code, then lets the user re-run TOTP enrolment (re-issues a secret). Heavily
  rate-limited + audited.
- `GET /api/auth/session` — returns the current user summary (for the frontend
  to know it is logged in) or 401.

**Admin router** `mystery_auth_admin_router` (prefix `/mystery-admin/users`),
mounted **only when `AUTH_MODE=entra`**, guarded by
`require_roles("CX_SUPER_ADMIN", "MYSTERY_ADMIN")`:
- `POST` create user (email, full_name) → status `invited` + returns a one-time
  enrolment link/token.
- `GET` list users + status.
- `POST /{id}/reset-password` → issue single-use reset.
- `POST /{id}/reissue-enrollment` → new enrolment token.
- `POST /{id}/suspend` and `/{id}/reactivate`.
- `POST /{id}/regenerate-recovery-codes`.

### 3.4 Wire it in `backend/app/main.py`
Near the other `include_router` calls, branch on auth mode:
```python
from app.core.settings import get_settings
settings = get_settings()

if settings.auth_mode == "mystery_public":
    app.include_router(mystery_auth_public_router, prefix="/api", tags=["mystery-auth"])
else:
    app.include_router(
        mystery_auth_admin_router,
        prefix="/api",
        tags=["mystery-admin"],
        dependencies=[Depends(require_roles("CX_SUPER_ADMIN", "MYSTERY_ADMIN"))],
    )
```
Note the public auth router must be reachable **without** a prior
`require_roles` dependency (login can't require being logged in). Mount it as its
own `include_router` with no global auth dependency — unlike the existing
mystery router which is globally gated.

### 3.5 CORS / cookies
On the DMZ, frontend and backend are same-origin (nginx serves `/` and `/api/*`
from one host), so SameSite=Strict cookies work with no CORS credentials dance.
Keep `CORS_ALLOW_ORIGINS` tight to the DMZ public origin.

---

## 4) Frontend implementation (`frontend/mystery-shopper`)

The frontend currently hard-wires MSAL in `auth.js`, `main.jsx`, and uses
`useMsal`/`useIsAuthenticated` + bearer tokens in `App.jsx`. Introduce an
**auth adapter** so the rest of the app doesn't care which mode is active.

### 4.1 Build switch
Read `import.meta.env.VITE_AUTH_MODE` (default `"entra"`).

### 4.2 New files
- `src/authMode.js` — `export const AUTH_MODE = (import.meta.env.VITE_AUTH_MODE || "entra")`.
- `src/mysteryAuth/MysteryAuthContext.jsx` — React context providing
  `{ isAuthenticated, user, login(email,password), submitMfa(code), logout(),
  loading, error, mfaPending }`. Talks to `/api/auth/*` with
  `fetch(url, { credentials: "include" })` (cookie-based; no bearer token).
- `src/mysteryAuth/LoginScreen.jsx` — email + password, then the TOTP step.
- `src/mysteryAuth/EnrollScreen.jsx` — reads `?enroll=<token>`, password set +
  QR display + confirm code + recovery-code download.
- `src/mysteryAuth/RecoveryScreen.jsx` — email + recovery code → re-enrol TOTP.

### 4.3 `main.jsx`
```jsx
import { AUTH_MODE } from "./authMode";
// ...
const tree = AUTH_MODE === "mystery_public"
  ? <MysteryAuthProvider><BrowserRouter basename={routerBase}><App/></BrowserRouter></MysteryAuthProvider>
  : <MsalProvider instance={msalInstance}><BrowserRouter basename={routerBase}><App/></BrowserRouter></MsalProvider>;
```
Only call `ensureMsalInitialized()` in the `entra` branch (skip MSAL entirely in
`mystery_public`, so MSAL never initialises on the DMZ build).

### 4.4 `App.jsx`
Abstract the few auth touch-points behind a tiny hook, e.g. `useAppAuth()` that
returns `{ isAuthenticated, getAuthHeaders, logout }`:
- `entra` mode: wraps the existing MSAL token acquisition; `getAuthHeaders()`
  returns `{ Authorization: 'Bearer ...' }` (current behaviour).
- `mystery_public` mode: `isAuthenticated` comes from the context;
  `getAuthHeaders()` returns `{}` and all `fetch` calls add
  `credentials: "include"`.
Keep the change surgical — the survey UI itself does not change.

### 4.5 Roles
In `mystery_public` mode the backend always returns role `MYSTERY_SURVEYOR`, so
the existing `hasMysteryAccess` check passes unchanged.

---

## 5) Environment variables

### Backend `.env` (DMZ VM only): `/opt/cwscx-mystery-public/.env`
```
ENVIRONMENT=production
AUTH_MODE=mystery_public
DATABASE_URL=postgresql+psycopg://<user>:<pwd>@<internal-db-host>:5432/<db>
CORS_ALLOW_ORIGINS=https://<public-mystery-host>
MYSTERY_AUTH_SECRET_KEY=<fernet key, generate once: python -c "from cryptography.fernet import Fernet;print(Fernet.generate_key().decode())">
MYSTERY_SESSION_IDLE_MINUTES=45
MYSTERY_SESSION_ABSOLUTE_HOURS=10
MYSTERY_ENROLL_TOKEN_MINUTES=30
# NOTE: no ENTRA_* values are required when AUTH_MODE=mystery_public
```

### Backend (test VM + internal production): unchanged
`AUTH_MODE` unset (defaults to `entra`). Keep all existing `ENTRA_*` values.

### Frontend builds
- DMZ build (`build_mystery_public_bundle.sh`): add
  `VITE_AUTH_MODE=mystery_public` to the build env.
- Test/internal builds (existing CI for the test VM): leave `VITE_AUTH_MODE`
  unset → defaults to `entra` → MSAL as today.

Add the new keys to `.env.example` under a clearly commented
"Mystery public DMZ only" section so they're discoverable but obviously optional.

---

## 6) Deploy script changes

### 6.1 `scripts/linux/build_mystery_public_bundle.sh`
Add `VITE_AUTH_MODE=mystery_public` to the frontend build line (line ~16):
```bash
VITE_API_URL="/api" VITE_BASE_PATH="/" VITE_AUTH_MODE="mystery_public" \
  VITE_APP_VERSION="$(git -C "${REPO_ROOT}" rev-parse --short HEAD)" npm run build
```

### 6.2 `scripts/linux/deploy_mystery_public_backend.sh`
Bump the Alembic target so the new auth tables migration runs (line ~10):
```bash
ALEMBIC_TARGET_REVISION="${ALEMBIC_TARGET_REVISION:-20260527_000023}"
```
Add a guard that fails fast if `AUTH_MODE=mystery_public` but
`MYSTERY_AUTH_SECRET_KEY` is missing from the `.env`.

### 6.3 Internal production deploy
`scripts/linux/deploy_backend.sh` is already at target `20260527_000022`. Bump it
to `20260527_000023` too, so the internal production DB (shared with the DMZ)
gets the new tables — that is where the admin provisioning endpoints write.
The test VM picks up the migration automatically; the empty tables are harmless
because `AUTH_MODE=entra` there.

### 6.4 nginx (DMZ)
No structural change needed — it already serves `/` and `/api/*`. Confirm a
rate-limit zone covers `/api/auth/`. Do **not** add the internal dashboard or
other frontends to the DMZ server block.

---

## 7) Onboarding runbook (operational)

For each new external mystery shopper:
1. Internal admin → `POST /api/mystery-admin/users` with email + name. Capture
   the one-time enrolment link.
2. In the supervised NDA + VPN session, have the user open the enrolment link on
   their provisioned device.
3. User sets password → scans QR in their authenticator app → enters confirming
   code → downloads/records the recovery codes.
4. Verify the user can log in once end to end before the session ends.
5. Record completion. The account is now `active`.

Offboarding: `POST /api/mystery-admin/users/{id}/suspend` — takes effect on the
next request and active sessions can be revoked.

---

## 8) Security checklist (must all hold before merge)

- [ ] `AUTH_MODE` defaults to `entra`; test VM + internal prod behaviour
      identical to before.
- [ ] Public auth router is **not** mounted unless `AUTH_MODE=mystery_public`.
- [ ] Admin provisioning router is **not** mounted on the DMZ.
- [ ] Passwords Argon2id; TOTP secrets Fernet-encrypted; recovery codes hashed.
- [ ] Session cookie HttpOnly + Secure + SameSite=Strict; opaque server-side id.
- [ ] Idle + absolute session expiry enforced; survey autosave verified.
- [ ] Rate limiting on `/api/auth/*`; soft lockout with auto-unlock.
- [ ] TOTP replay guard (`last_totp_step`) and ±1 window.
- [ ] Uniform auth error messages (no user-enumeration).
- [ ] Full audit logging of auth events.
- [ ] No `ENTRA_*` dependency when `AUTH_MODE=mystery_public` (MSAL never
      initialises on the DMZ build).

---

## 9) Test plan

### 9.1 Backend unit/integration (pytest, `AUTH_MODE=mystery_public`)
- enrol → confirm → login → mfa → access a mystery endpoint → logout.
- wrong password / wrong TOTP → 401, counters increment, lockout triggers, then
  auto-unlocks.
- TOTP replay rejected; ±1 window accepted.
- recovery code single-use; second use rejected.
- expired enrolment token rejected; expired session rejected; idle slide works.
- suspended user cannot log in; existing session revoked.

### 9.2 Regression (must stay green) — `AUTH_MODE` unset/`entra`
- Run the existing backend test suite. Mystery endpoints behave exactly as
  before under Entra. No new tables are required for those tests to pass.

### 9.3 Frontend
- DMZ build (`VITE_AUTH_MODE=mystery_public`): MSAL bundle not initialised;
  login/MFA/enrol/recovery screens work against the DMZ API; survey loads after
  login; API calls send the cookie.
- Default build (`VITE_AUTH_MODE` unset): MSAL login unchanged.

### 9.4 Deploy validation on the DMZ
Use `scripts/linux/verify_mystery_public.sh` plus manual checks:
- `/api/health` and `/api/health/ready` respond.
- `GET /api/auth/session` returns 401 before login.
- Full login + survey submit works over HTTPS via the VPN.
- Confirm the **test VM** mystery frontend still shows the Entra login.

---

## 10) Rollback

- The feature is gated; to disable on the DMZ, set `AUTH_MODE=entra` (or
  redeploy the previous bundle) and rebuild the frontend without
  `VITE_AUTH_MODE`. The new tables can remain — they are inert when unused.
- The Alembic migration has a working `downgrade()` dropping the four tables if a
  full revert is ever required.

---

## 11) File-change summary (what the agent will touch)

Backend:
- `backend/app/core/settings.py` — add `auth_mode`.
- `backend/app/core/auth/dependencies.py` — dispatch `get_current_user`.
- `backend/app/api/mystery_auth.py` — **new** (helpers + public + admin routers).
- `backend/app/main.py` — conditional router wiring.
- `backend/alembic/versions/20260527_000023_add_mystery_public_auth.py` — **new**.
- `backend/requirements.txt` — add pyotp, qrcode, argon2-cffi.
- `.env.example` — document the new DMZ-only vars.

Frontend (`frontend/mystery-shopper`):
- `src/authMode.js` — **new**.
- `src/mysteryAuth/*` — **new** (context + 3 screens).
- `src/main.jsx` — branch on `AUTH_MODE`.
- `src/App.jsx` — auth adapter (`useAppAuth`).

Deploy:
- `scripts/linux/build_mystery_public_bundle.sh` — `VITE_AUTH_MODE`.
- `scripts/linux/deploy_mystery_public_backend.sh` — bump Alembic target + secret guard.
- `scripts/linux/deploy_backend.sh` — bump Alembic target to include the new migration.

Docs:
- this file + `MYSTERY_PUBLIC_AUTH_OPTIONS.md` (already updated) +
  `MYSTERY_PUBLIC_DMZ_SETUP.md` (auth sections updated).
