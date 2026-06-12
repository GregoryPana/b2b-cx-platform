# Hermes Single-Project Handoff Pack

## 1. Project Identity
- Project name: `CWSCX Platform`
- Business purpose: Internal Cable & Wireless Seychelles customer experience platform for survey capture, review, analytics, reporting, and supporting administration across B2B, Installation Assessment, and Mystery Shopper programmes.
- Current status: production; live/in use
- Is this currently used by real users? yes
- Owner: Gregory Panagary / DTO Lead (documented technical owner); business owner not fully recorded in repo docs
- Main stakeholders/users: internal surveyors/representatives, admins/reviewers, DTO/operations staff, product/business stakeholders
- Business criticality: medium-high internal operational system; outages block survey operations, review workflows, and analytics visibility

## 2. Project Access
- Current local project root path: `/mnt/c/Users/gpanagary/.gemini/antigravity/scratch/cx-b2b-platform`
- Windows path if detectable: `C:\Users\gpanagary\.gemini\antigravity\scratch\cx-b2b-platform`
- WSL/Linux path if detectable: `/mnt/c/Users/gpanagary/.gemini/antigravity/scratch/cx-b2b-platform`
- GitHub repo URL: `git@github.com:GregoryPana/b2b-cx-platform.git`
- Git remote(s):
  - `origin git@github.com:GregoryPana/b2b-cx-platform.git`
- Default branch: `main`
- Current branch: `main`
- Main active development branch: `main`
- Is working tree clean? no
- Any uncommitted changes? yes
- Current uncommitted state summary:
  - tracked deletions of multiple legacy SQL helper files at repo root
  - tracked modifications in `backend/app/api/installation_surveys.py`, `backend/app/api/users_compat.py`, archive SQL dump files, and `README.md`
  - untracked local folders/files including `.claude/`, `docs/audits/`, `docs/presentations/`, local logs, session exports, scratch markdown notes
  - do not assume any of these are safe to commit without review

## 3. Hermes Permissions Recommendation
Recommend what Hermes should be allowed to do for this repo:
- read only: yes
- create branches: yes
- make commits: yes, but prefer branch/PR flow
- open PRs: yes
- run tests: yes
- run local app: yes
- modify deployment config: yes, but PR-only and reviewed
- deploy staging: no, not without explicit approval
- deploy production: no

Also state what Hermes must not touch without explicit approval.

Hermes must not touch without explicit approval:
- production deployment execution
- production `.env` or secret-bearing config
- runner registrations/services
- database resets, truncations, or destructive SQL
- DMZ/public access publication changes
- any secret values
- any unrelated dirty worktree files created by other agents/users

## 4. Architecture Summary
Explain the system clearly:
- frontend:
  - Multiple React/Vite frontends:
    - governance dashboard
    - B2B survey
    - installation survey
    - mystery shopper survey
- backend:
  - Single FastAPI backend serving APIs for all programmes
  - Business logic includes survey flows, analytics, review queues, reports, and auth validation
- database:
  - PostgreSQL 16
  - Current production DB is hosted on `cwscx-app01` and exposed internally on port `5433`
- auth/access control:
  - Internal apps use Microsoft Entra ID bearer-token validation with role claims
  - Backend is authoritative for authorization
  - Staging has a fallback path for unverified token validation when JWKS fetches fail; production now uses stricter validation with retry hardening
- APIs:
  - Main API surface under `/api/*`
  - FastAPI route modules cover visits, survey responses, analytics, account executives, installation, mystery shopper, auth compatibility, and dashboard compatibility
- background jobs/schedulers:
  - No dedicated app job runner detected
  - Operational cron-based backup scripts exist on target VMs
  - monitoring via Uptime Kuma on observability VM
- file storage:
  - Static frontend bundles deployed under `/opt/cwscx/frontends-src/.../dist`
  - release zips under `/opt/cwscx/releases`
  - no dedicated object storage integration detected
- external integrations:
  - Microsoft Entra ID
  - SMTP relay for emailed reports / notifications
  - GitHub Actions
- deployment model:
  - Self-hosted runners on target/internal VMs
  - release bundle build, install, backend deploy, frontend validation, nginx deploy, verification
  - staging and production are manually triggered
  - public Mystery Shopper DMZ deployment groundwork exists in repo but is not yet active/live

If any area does not exist, say so.

## 5. Tech Stack
List detected technologies and versions where possible:
- frontend framework: React 18
- backend framework: FastAPI `0.111.0`
- language/runtime:
  - backend: Python `3.11` in CI, `3.12` on observed runtime VMs
  - frontend: JavaScript/TypeScript mixed estate; B2B survey uses TypeScript
- database: PostgreSQL 16
- ORM/query layer: SQLAlchemy `2.0.30`
- package manager:
  - frontend: npm
  - backend: pip / requirements.txt
- build tool: Vite `5.3.4`
- test framework: pytest `8.3.2`
- lint/typecheck tools: TypeScript compiler present in typed frontends; no single centralized lint summary confirmed from current repo scan
- deployment provider: self-hosted Linux VMs with NGINX and systemd
- CI/CD: GitHub Actions with self-hosted runners

## 6. Folder Structure
Explain the important folders and files.

Include:
- source code folders
- route/controller folders
- component folders
- config folders
- test folders
- docs folders
- scripts
- migrations
- CI/CD config
- deployment/infra config

- `backend/`
  - FastAPI app, Alembic migrations, backend scripts, tests
- `backend/app/api/`
  - main API modules, including `visits_dashboard.py`, `survey.py`, `installation_surveys.py`, `mystery_shopper.py`
- `backend/app/core/`
  - auth, database, health, settings, shared core behavior
- `backend/app/routers/`
  - analytics and related route modules
- `backend/alembic/versions/`
  - schema and data migrations
- `frontend/dashboard-blueprint/`
  - current governance dashboard frontend
- `frontend/survey/`
  - B2B survey frontend
- `frontend/installation-survey/`
  - installation survey frontend
- `frontend/mystery-shopper/`
  - mystery shopper frontend
- `frontend/shared-assets/branding/`
  - shared branding source assets
- `scripts/linux/`
  - release/deploy/verify scripts for internal and DMZ deployment paths
- `.github/workflows/`
  - CI/CD workflows for staging, production, and public mystery groundwork
- `docs/`
  - active docs, architecture, deployment, operations, references
- `INTERNAL DEV KIT/`
  - standards/templates pack for future applications
- `skills/`
  - agent-agnostic reusable engineering skills pack
- `.opencode/skills/academic-pptx/`
  - project-local OpenCode presentation skill
- `EXIT.md`
  - application operating/handover document at repo root
- `WORKSTREAM_TRACKER.md`
  - broader programme/workstream tracker

## 7. Key Files Hermes Should Read First
List 10–20 files or folders in priority order.

For each:
- path
- why Hermes should read it
- what it controls

1. `README.md`
   - why: entry-level overview
   - what it controls: platform summary and key doc links

2. `EXIT.md`
   - why: operational truth source for the application
   - what it controls: architecture, infra, runtime, ownership, risk framing

3. `docs/deployment/DEPLOYMENT_END_TO_END_GUIDE.md`
   - why: explains full deployment lifecycle
   - what it controls: bundle build/install/deploy/verify flow

4. `.github/workflows/deploy-staging.yml`
   - why: staging deploy target and verification logic
   - what it controls: staging runner selection, release, rollback path

5. `.github/workflows/deploy-production.yml`
   - why: production deploy model
   - what it controls: production runner targeting and deploy behavior

6. `scripts/linux/build_release_bundle.sh`
   - why: defines what goes into releases
   - what it controls: frontend builds, backend packaging

7. `scripts/linux/install_release_bundle.sh`
   - why: installs release bundles onto target VMs
   - what it controls: live file placement under `/opt/cwscx`

8. `scripts/linux/deploy_backend.sh`
   - why: backend deploy behavior
   - what it controls: venv, dependencies, Alembic upgrade, service restart

9. `scripts/linux/deploy_nginx.sh`
   - why: generated NGINX config behavior
   - what it controls: routing, TLS paths, staging extra-routes include

10. `backend/app/core/auth/entra.py`
   - why: production/staging Entra token validation logic
   - what it controls: issuer/audience/JWKS validation, retry hardening, staging fallback

11. `backend/app/api/visits_dashboard.py`
   - why: major source of B2B survey/dashboard logic and recent bug fixes
   - what it controls: draft visits, save/update flows, report data, team members

12. `backend/app/routers/analytics.py`
   - why: analytics behavior and multiple recent fixes
   - what it controls: B2B and Mystery analytics, location/business filters

13. `frontend/dashboard-blueprint/src/pages/DashboardPage.jsx`
   - why: central governance dashboard behavior
   - what it controls: analytics, reports, review queue, planned visits, UX state

14. `frontend/survey/src/features/survey/SurveyWorkspacePage.tsx`
   - why: B2B survey user flow
   - what it controls: visit preparation, account exec/team persistence, save/submit states

15. `docs/operations/HANDOVER_GUIDE.md`
   - why: plain-language operational summary
   - what it controls: incident and handover understanding

16. `docs/deployment/MYSTERY_PUBLIC_DMZ_SETUP.md`
   - why: public Mystery Shopper future-state groundwork
   - what it controls: DMZ VM, runner, nginx, DB connectivity expectations

17. `docs/architecture/MYSTERY_PUBLIC_AUTH_OPTIONS.md`
   - why: external-access auth options under consideration
   - what it controls: signed link / OTP / hybrid comparison

18. `skills/SKILL_OVERVIEW.md`
   - why: reusable engineering skills pack summary
   - what it controls: how future agents/developers should approach common work here

## 8. Development Commands
List exact commands if known:

- install dependencies:
  - backend: `pip install -r backend/requirements.txt`
  - dashboard: `cd frontend/dashboard-blueprint && npm ci --no-audit --no-fund`
  - B2B survey: `cd frontend/survey && npm ci --no-audit --no-fund`
  - installation: `cd frontend/installation-survey && npm ci --no-audit --no-fund`
  - mystery: `cd frontend/mystery-shopper && npm ci --no-audit --no-fund`
- run locally: unknown as one single root command
- run backend: likely `uvicorn app.main:app --reload --app-dir backend`
- run frontend:
  - dashboard: `cd frontend/dashboard-blueprint && npm run dev`
  - B2B survey: `cd frontend/survey && npm run dev`
  - installation: `cd frontend/installation-survey && npm run dev`
  - mystery: `cd frontend/mystery-shopper && npm run dev`
- run database: local dev DB command not clearly standardized in current repo; live environments use VM/container DBs
- run migrations:
  - likely `cd backend && alembic upgrade head`
  - deploy scripts use explicit Alembic target revision
- seed database:
  - backend seed scripts exist under `backend/scripts/`
  - exact canonical seed command is not clearly unified
- run tests:
  - `pytest backend/tests`
- run lint: unknown
- run typecheck: unknown centralized command
- build:
  - dashboard: `cd frontend/dashboard-blueprint && npm run build`
  - B2B survey: `cd frontend/survey && npm run build`
  - installation: `cd frontend/installation-survey && npm run build`
  - mystery: `cd frontend/mystery-shopper && npm run build`
- preview production build: unknown
- deploy staging:
  - GitHub Actions manual workflow: `deploy-staging`
- deploy production:
  - GitHub Actions manual workflow: `deploy-production`

## 9. Environment Variables
List variable names only. Do not include values.

For each:
- variable name
- purpose
- required for local/staging/prod
- where configured
- whether example/dummy value exists

### Main env files present
- `.env`
- `.env.example`
- `INTERNAL DEV KIT/templates/repository/.env.example.template`

### Core variables from `.env.example`
- `ENVIRONMENT`
  - purpose: environment identifier
  - required for: local/staging/prod
  - where configured: `.env`, target VM `.env`
  - example exists: yes

- `DATABASE_URL`
  - purpose: backend DB connection
  - required for: local/staging/prod
  - where configured: `.env`, target VM `.env`, CI test env
  - example exists: yes

- `CORS_ALLOW_ORIGINS`
  - purpose: allowed frontend origins
  - required for: staging/prod
  - where configured: `.env`
  - example exists: yes

- `CORS_ALLOW_ORIGIN_REGEX`
  - purpose: regex CORS override
  - required for: optional
  - where configured: `.env`
  - example exists: yes

- `LOG_LEVEL`
  - purpose: logging verbosity
  - required for: optional but useful in all envs
  - where configured: `.env`
  - example exists: yes

- `ENTRA_TENANT_ID`
  - purpose: Entra tenant binding
  - required for: staging/prod
  - where configured: `.env`, CI dummy env
  - example exists: yes

- `ENTRA_CLIENT_ID`
  - purpose: Entra app / audience support
  - required for: staging/prod
  - where configured: `.env`, CI dummy env
  - example exists: yes

- `ENTRA_AUTHORITY`
  - purpose: Entra authority base
  - required for: staging/prod
  - where configured: `.env`
  - example exists: yes

- `ENTRA_ISSUER`
  - purpose: expected token issuer
  - required for: staging/prod
  - where configured: `.env`
  - example exists: yes

- `ENTRA_AUDIENCE`
  - purpose: expected token audience(s)
  - required for: staging/prod
  - where configured: `.env`
  - example exists: yes

- `ENTRA_JWKS_URL`
  - purpose: optional JWKS override
  - required for: optional
  - where configured: `.env`
  - example exists: yes

- `ENTRA_DEBUG`
  - purpose: auth debug logging
  - required for: optional
  - where configured: `.env`
  - example exists: yes

### Additional auth/runtime vars referenced in code
- `ENTRA_JWKS_TIMEOUT_SECONDS`
- `ENTRA_JWKS_RETRY_ATTEMPTS`
- `ENTRA_JWKS_RETRY_BACKOFF_SECONDS`
- `ENTRA_ALLOW_STAGING_UNVERIFIED_TOKENS`

### Frontend build-time vars
- `VITE_API_URL`
- `VITE_ENTRA_TENANT_ID`
- `VITE_ENTRA_CLIENT_ID`
- `VITE_ENTRA_AUTHORITY`
- `VITE_ENTRA_API_SCOPE`
- `VITE_BASE_PATH`
- `VITE_APP_VERSION`
- `VITE_DEV_AUTH_BYPASS`
- `VITE_DEV_BYPASS_ROLES`
- `VITE_DEV_BYPASS_USER_ID`
- `VITE_DEV_BYPASS_NAME`
- `VITE_DEV_BYPASS_EMAIL`
- `VITE_DEV_HTTPS`
- `VITE_API_PROXY_TARGET`
- `VITE_SURVEY_TYPE`

### SMTP vars referenced in backend
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USERNAME`
- `SMTP_PASSWORD`
- `SMTP_FROM`
- `SMTP_EMAIL`
- `STMP_EMAIL`
- `SMTP_USE_TLS`
- `SMTP_USE_SSL`

### GitHub Actions secrets referenced by name only
- `STAGING_BASE_URL`
- `PRODUCTION_BASE_URL`
- `MYSTERY_PUBLIC_BASE_URL`

## 10. Database / Data Model
Explain:
- database type
- schema/model location
- migrations location
- key tables/entities/models
- seed data
- local database setup
- staging/prod assumptions
- backup/rollback assumptions if known

- database type: PostgreSQL 16
- schema/model location:
  - SQLAlchemy models under `backend/app/models/`
  - some programme-specific logic also in API/router layers
- migrations location:
  - `backend/alembic/versions/`
- key tables/entities/models:
  - `visits`
  - `questions`
  - `businesses`
  - `users`
  - `meeting_attendees`
  - `b2b_visit_responses`
  - `mystery_shopper_assessments`
  - `mystery_shopper_answers`
  - installation-related survey tables
- seed data:
  - `backend/scripts/seed.py`
  - other backend seed scripts under `backend/scripts/`
- local database setup:
  - not fully standardized in current repo docs
  - CI uses sqlite for tests
- staging/prod assumptions:
  - staging/prod use PostgreSQL
  - current internal production DB is hosted on `cwscx-app01` on port `5433`
  - staging DB runtime details are documented in deployment/ops docs
- backup/rollback assumptions:
  - release bundle rollback exists
  - DB rollback is not part of normal deploy
  - backup/restore readiness is expected and documented operationally

## 11. Auth and Access Control
Explain:
- auth method
- user roles
- admin access
- protected routes
- token/session/JWT handling
- CORS/CSRF if relevant
- known auth risks

- auth method: Microsoft Entra ID bearer token validation for internal frontends
- user roles:
  - `CX_SUPER_ADMIN`
  - `B2B_ADMIN`
  - `B2B_SURVEYOR`
  - `MYSTERY_ADMIN`
  - `MYSTERY_SURVEYOR`
  - `INSTALL_ADMIN`
  - `INSTALL_SURVEYOR`
- admin access:
  - platform and route access depend on role claims
  - backend is authoritative
- protected routes:
  - internal dashboard and internal survey APIs are protected by role-gated backend routes
- token/session/JWT handling:
  - backend validates JWT issuer, audience, expiry, and tenant
  - production now includes JWKS fetch retry hardening
  - staging includes optional unverified-token fallback if configured
  - B2B survey now uses silent token renewal logic similar to dashboard/installation
- CORS/CSRF:
  - CORS configured via env
  - no separate CSRF framework surfaced in current scan
- known auth risks:
  - intermittent JWKS fetch resets have occurred
  - user-facing `Signing in...` states can happen when token acquisition or backend auth validation fails
  - session behavior is not yet fully harmonized across every frontend

## 12. API Surface
If there is an API, list:
- main API routes
- route files
- OpenAPI/Swagger availability
- validation method
- error handling pattern
- request/response conventions

- main API routes:
  - `/api/dashboard-visits/*`
  - `/api/analytics/*`
  - `/api/b2b/*`
  - `/api/mystery-shopper/*`
  - `/api/installation/*`
  - `/api/auth/*`
  - `/api/health`
  - `/api/health/ready`
- route files:
  - `backend/app/api/visits_dashboard.py`
  - `backend/app/api/survey.py`
  - `backend/app/api/mystery_shopper.py`
  - `backend/app/api/installation_surveys.py`
  - `backend/app/routers/analytics.py`
  - `backend/app/api/admin_dashboard.py`
  - others under `backend/app/api/`
- OpenAPI/Swagger availability: not confirmed from current scan, but FastAPI normally exposes it if not disabled
- validation method:
  - Pydantic and route-level payload handling
  - some endpoints still use plain dict payloads
- error handling pattern:
  - `HTTPException`
  - explicit 400/401/403/404/500 responses
- request/response conventions:
  - JSON APIs
  - health endpoints return structured status payloads
  - some route families are compatibility-oriented and not fully standardized

## 13. CI/CD and Deployment
Explain:
- GitHub Actions workflows
- deployment provider
- staging environment
- production environment
- branch-to-environment mapping
- deployment triggers
- required secrets by name only
- rollback method if known

- GitHub Actions workflows:
  - `deploy-staging.yml`
  - `deploy-production.yml`
  - `deploy-mystery-public.yml` groundwork exists
  - frontend/backend CI workflows also exist
- deployment provider:
  - self-hosted Linux VMs
- staging environment:
  - internal staging VM runner
  - manual workflow dispatch
- production environment:
  - internal production VM runner
  - manual workflow dispatch
- branch-to-environment mapping:
  - `main` is deployable via manual workflows
- deployment triggers:
  - manual `workflow_dispatch`
- required secrets by name only:
  - `STAGING_BASE_URL`
  - `PRODUCTION_BASE_URL`
  - `MYSTERY_PUBLIC_BASE_URL`
- rollback method if known:
  - previous release zip reinstalled from `/opt/cwscx/releases`
  - redeploy backend/frontend/nginx from prior bundle

## 14. Current State of Build
Summarize:
- what is complete
- what is partially complete
- what is not started
- known bugs
- known TODOs
- unfinished features
- risky shortcuts
- current blockers

- complete:
  - internal multi-frontend platform exists and is live
  - production deployment path exists
  - staging and production bundle-based deploy path exists
  - B2B planned visit/account executive/team-member UX improvements are largely implemented
  - silent token renewal for B2B survey is now implemented
  - local and reusable skills packs exist in repo
  - DMZ Mystery groundwork exists in repo
- partially complete:
  - public Mystery Shopper DMZ deployment path
  - auth decision for public Mystery access
  - some documentation still mixes historical and current operational truth
- not started / not completed:
  - full external/public Mystery auth implementation
  - DMZ runner registration completion dependent on GitHub outbound access
  - external publication of DMZ host to public internet
- known bugs / risks:
  - staging/production divergence can occur if runner targeting is wrong
  - some user-specific login/session issues may still need validation after latest auth fixes
  - working tree contains many unrelated modifications/deletions that should be reviewed before future commits
- risky shortcuts:
  - mixed JS/TS frontend estate
  - some legacy compatibility behavior remains
  - some backend endpoints still use dict payloads rather than stricter typed schemas
- current blockers:
  - DMZ runner outbound GitHub HTTPS
  - final public Mystery auth model
  - unresolved unrelated local worktree noise

## 15. Documentation / EXIT.md Readiness
Assess:
- README exists? yes
- EXIT.md exists? yes
- docs folder exists? yes
- deployment docs exist? yes
- API docs exist? partially
- troubleshooting docs exist? yes

If EXIT.md exists, assess whether it is complete.
If missing, propose what it must contain.

EXIT.md completeness assessment:
- exists and is substantial
- but historical notes in the repo indicate some sections may still be stale if not recently refreshed
- it should be reviewed again before formal handover closure, especially:
  - status text
  - ownership/escalation contacts
  - production/public Mystery future-state notes

## 16. Production Readiness
Assess honestly:
- production-ready? yes for internal live use; not yet for the public Mystery future-state
- safe for internal use? yes, with active operational management
- safe for external/public use? partially; public Mystery groundwork exists, but public auth model and DMZ runner/public publication are not complete
- top risks before broader use:
  - auth/JWKS intermittency
  - runner-targeting mistakes
  - stale or mixed local modifications being committed accidentally
  - incomplete public DMZ auth/publication path
- minimum fixes before production:
  - validate latest auth/session fixes in live environments
  - keep staging and production deploy targeting explicit
  - finish public Mystery auth/publication before exposing externally

## 17. Security Review
Do not reveal secrets.

Check for:
- committed .env files
- hardcoded credentials
- exposed tokens
- unsafe CORS
- weak auth
- missing role checks
- sensitive data in logs
- dependency risks
- missing rate limits
- missing backups

For each issue:
- file/path
- severity
- recommendation

1. `.env`
- file/path: `.env`
- severity: medium
- note: env file exists in repo root; values were not inspected here; ensure it is not committed with live secrets
- recommendation: keep only safe local/dev content in repo-local `.env`, or remove from tracked scope if necessary

2. Entra JWKS intermittency
- file/path: `backend/app/core/auth/entra.py`
- severity: medium
- note: token validation depends on live Microsoft JWKS fetch; transient resets have occurred
- recommendation: latest retry hardening is in place; validate in staging/production after deploy

3. Broad dirty worktree / local artifacts
- file/path: repo root / multiple files
- severity: medium
- note: many local scratch files, session exports, logs, and unrelated deletions exist
- recommendation: review carefully before any future bulk commit

4. Potentially stale docs/ops truth
- file/path: `EXIT.md`, `WORKSTREAM_TRACKER.md`, broader docs
- severity: low-medium
- note: this is an operational/security risk if responders act on stale instructions
- recommendation: refresh before formal handover or major environment changes

5. Missing rate limits
- file/path: not clearly found in current scan
- severity: medium for future public path
- recommendation: add explicit rate limiting before public Mystery access goes live

6. Backups and restore
- file/path: deployment/ops docs
- severity: medium
- note: backup/restore logic exists operationally, but should stay continuously verified
- recommendation: keep restore-readiness checks and off-host backup hardening

## 18. Recommended Hermes Mode
Choose one:
- docs-only
- read-only repo scan
- assisted development
- branch/PR development
- full orchestration with deployment prohibited

Chosen mode:
- `branch/PR development`

Explain why.

Why:
- project is live and production-sensitive
- repo has working deployment automation and active users
- Hermes should support controlled development and documentation work
- direct deploy/production orchestration should remain prohibited without explicit approval

## 19. Immediate Next Actions for Hermes
Give 5–10 concrete actions Hermes should take next for this project.

1. Verify staging and production receive the latest auth/session and B2B workflow fixes before further user testing.
2. Review and clean the dirty worktree before any future broad commit.
3. Refresh `EXIT.md` and tracker documents so they reflect actual current state.
4. Validate the B2B survey flow end to end:
   - planned visit edit
   - team members
   - account executive persistence
   - response save state
   - submit behavior
5. Continue DMZ Mystery Shopper work only behind branch/PR flow.
6. Resolve public Mystery auth decision:
   - signed link
   - OTP
   - signed link + OTP
7. Complete DMZ runner setup once outbound GitHub HTTPS is allowed.
8. Validate public DNS/NAT/TLS/publication for `cwscx-web01`.
9. Review whether `.env` and other local artifacts are safely handled in git.
10. Use the `skills/` pack and `.opencode/skills/academic-pptx/` for future deterministic agent work.

## 20. Concise Memory Summary
Write a short summary Hermes can store as project context:
- what this project is
- where it lives
- repo URL
- current status
- deployment status
- main stack
- key risks
- what Hermes should do next

CWSCX Platform lives at `/mnt/c/Users/gpanagary/.gemini/antigravity/scratch/cx-b2b-platform` and uses `git@github.com:GregoryPana/b2b-cx-platform.git` on branch `main`. It is a live internal customer experience platform with React/Vite frontends, a FastAPI backend, PostgreSQL, NGINX, and GitHub Actions self-hosted runner deployments. Internal production is live; public Mystery Shopper DMZ deployment groundwork exists but is not yet complete. Current key risks are auth/JWKS intermittency, deploy-runner targeting mistakes, and a dirty local worktree with many unrelated changes. Hermes should operate in branch/PR development mode, avoid deploys/secrets/destructive DB actions, validate the latest B2B/auth fixes in staging/production, and continue the public Mystery path only through controlled documented changes.

## 21. Addendum Policy

Any meaningful project changes after this handoff should be added as an addendum to this file rather than silently replacing prior operational context.

Recommended addendum format:

### Addendum YYYY-MM-DD
- change summary:
- files affected:
- deployment impact:
- auth/data impact:
- documentation updated:
- follow-up actions:
