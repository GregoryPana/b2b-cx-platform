# Developer Onboarding Guide

This guide helps a new developer join a DTO bespoke application project.

## 1. Audience

This guide is for:
- new developers
- junior developers
- support engineers
- technical staff joining a project for the first time

## 2. Main contact

Primary contact for support and escalation:

- Gregory Panagary
- Digital Transformation Engineer
- `gregory.panagary@cwseychelles.com`

## 3. What you are joining

Future DTO internal bespoke applications should usually follow this standard stack:
- backend: Python + FastAPI
- frontend: React + TypeScript + Vite + Tailwind CSS + shadcn/ui
- database: PostgreSQL
- auth: Entra ID
- reverse proxy: NGINX
- deploy: GitHub Actions now, GitLab CE later

## 4. Prerequisites

Before starting, you should have:
- repository access
- access to required docs
- a development machine with Git installed
- Python 3.11 or newer
- Node 20 or newer
- npm installed
- Docker and Docker Compose available for local DB work if needed
- VS Code or another editor

## 5. Access checklist

Ask for access to:
- the GitHub repository
- the future GitLab project when applicable
- Entra app details if needed for local testing
- the staging/pre-production URL
- any VPN or internal network access required
- documentation index for the project

## 6. First-day reading order

1. project `README.md`
2. project docs index
3. INTERNAL DEV KIT platform standard
4. deployment guide
5. Entra integration notes

## 7. Local setup walkthrough

### Step 1: clone the repository

```bash
git clone <repo-url>
```

### Step 2: open the repository

```bash
cd <repo-folder>
```

### Step 3: create local env file

Copy `.env.example` to a local env file as instructed by the project.

Example:

```bash
cp .env.example .env
```

Then fill in the required local values.

### Step 4: set up backend dependencies

Example:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
```

### Step 5: set up frontend dependencies

Example:

```bash
cd frontend/app
npm install
```

Repeat for any additional frontend app such as `frontend/dashboard`.

### Step 6: start the local database if needed

If the project uses local Compose for development:

```bash
docker compose -f docker-compose.dev.yml up -d
```

### Step 7: run migrations

Example:

```bash
alembic -c backend/alembic.ini upgrade head
```

### Step 8: start the backend

Example:

```bash
uvicorn app.main:app --reload --app-dir backend
```

### Step 9: start the frontend

Example:

```bash
cd frontend/app
npm run dev
```

## 8. First run verification

Confirm:
- backend starts without errors
- frontend starts without errors
- health endpoint works
- login works if auth is configured
- a simple API call works
- frontend does not require a separate `/auth/me` bootstrap call just to render the authenticated shell if token claims already provide the needed identity and role data

## 9. What to do if local auth is not ready

Sometimes Entra local setup is not available on day one.

Only use an approved local-only auth stub when all of these are true:
- it is enabled by an explicit development-only environment flag
- it creates a fixed mock user identity and fixed mock roles
- it is disabled by default
- it is blocked in staging and production environments
- it is documented clearly in the repository

Example acceptable pattern:
- `DEV_AUTH_BYPASS=true` in local development only
- backend or frontend injects a fixed mock user such as `dev.user@local`
- mock roles are clearly listed
- code refuses to enable the bypass when `ENVIRONMENT` is `staging` or `production`

Not acceptable:
- ad hoc hard-coded admin access with no environment gate
- a bypass that can be enabled in deployed environments
- undocumented temporary hacks

## 10. Common beginner issues

### Problem: missing environment variables

Symptom:
- backend fails at startup
- frontend shows undefined config behavior

Fix:
- compare local `.env` against `.env.example`

### Problem: migrations fail

Symptom:
- app cannot start

Fix:
- verify DB is running
- verify DB URL is correct
- check migration history and current revision

### Problem: frontend loads old behavior

Fix:
- stop dev server
- restart it
- clear browser cache if testing deployed builds

### Problem: login works but API fails

Fix:
- confirm scope, audience, and role setup
- inspect the failing request and backend auth logs

## 11. Development working rules

- do not commit secrets
- do not modify production config casually
- do not add new frontend code in plain JavaScript
- do not add schema changes without a migration
- do not assume staging and production behave the same without checking docs

## 12. When to ask for help

Ask for help when:
- you cannot access the repo or environments
- you are unsure about auth config
- a migration change is unclear
- deployment scripts are failing
- production-like behavior differs from local in a way you cannot explain

## 13. Recommended first tasks for a new developer

Good starter tasks:
- update docs
- add a small API endpoint
- fix a small frontend issue
- add a health check improvement
- add or improve tests

## 14. Handover expectation

A developer is considered onboarded when they can:
- run the app locally
- explain the architecture
- find the main docs
- understand the deploy model
- describe the Entra auth flow at a high level
