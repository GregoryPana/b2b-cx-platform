# CWSCX Platform

CWSCX is the Customer Experience platform used by Cable and Wireless Seychelles to collect survey feedback, review service quality, and track improvement actions.

In simple terms, this system helps teams:

- collect customer and field survey answers
- review completed work before it becomes part of reporting
- monitor dashboards and reports
- manage separate CX programs from one shared platform

This repository contains:

- a FastAPI backend API
- multiple React/Vite frontends
- Microsoft Entra role-based access control
- staging and production deployment automation
- operational guides and recovery runbooks

## Start here (documentation map)

If you are new, read in this order:

1. `README.md` (this file)
2. `docs/HANDOVER_GUIDE.md` (full project onboarding for new team members)
3. `docs/DEPLOYMENT_END_TO_END_GUIDE.md` (how deployment works end to end)
4. `STAGING_CICD_SETUP.md` (self-hosted runner setup and operations)
5. `ENTERPRISE_DEPLOYMENT_RUNBOOK.md` (script-level deployment reference)
6. `docs/AI_SKILL_DEPLOYMENT_SOURCE.md` (structured source for future agent skills)

## What the platform does

The platform supports multiple CX programs:

- B2B customer surveys and relationship tracking
- installation assessment surveys
- mystery shopper journeys (public-facing entry path)

Main capabilities include:

- planned visit lifecycle and field execution
- response capture with action tracking
- analytics (NPS, CSAT, relationship, competitor exposure)
- role-based access with Microsoft Entra
- audit signature capture on visit submission

## Which app should I open?

If you are a new or non-technical user, these are the main entry points:

- `https://<server>/dashboard/`
  - management dashboard for analytics, reports, review queues, and platform switching
- `https://<server>/surveys/b2b/`
  - B2B survey form used by internal staff
- `https://<server>/surveys/installation/`
  - Installation CX Survey used for installation quality assessments
- `https://<server>/`
  - mystery shopper public entry point

Access to each area depends on your Entra role. If you sign in and do not see a platform, your account likely has not been assigned that platform role yet.

## Runtime architecture

### Staging / testing (single VM)

- backend service: FastAPI + Uvicorn on `127.0.0.1:8000`
- reverse proxy: Nginx
- API route: `/api/*` -> backend
- frontends:
  - `/` -> mystery shopper
  - `/dashboard/` -> dashboard blueprint frontend
  - `/surveys/b2b/` -> B2B survey frontend
  - `/surveys/installation/` -> installation survey frontend

### Production (target multi-VM pattern)

- `cwscx-app01`: backend + internal frontends
- `cwscx-sql01`: PostgreSQL
- `cwscx-web01`: public entry and SSL termination

## Server layout (staging VM)

```text
/opt/cwscx/
  backend/
    backend/
      app/
      alembic/
      requirements.txt
      alembic.ini
      venv/
  frontends-src/
    dashboard/
      dist/
    internal-surveys/
      b2b/
        dist/
      installation/
        dist/
    public/
      mystery-shopper/
        dist/
  frontends-src-old/
  scripts/linux/
  releases/
  shared/
  .env
```

## Deployment model (current)

Staging deployment is self-hosted and local to the VM network.

- trigger: push to `main` or manual dispatch
- workflow: `.github/workflows/deploy-staging.yml`
- CI checks run on GitHub-hosted runners
- deploy job runs on self-hosted Linux runner
- deploy job checks out exact commit, builds bundle locally, installs to `/opt/cwscx`, deploys backend + nginx, verifies health/routes
- on failure, workflow attempts rollback using previous bundle in `/opt/cwscx/releases`

Important: deploy does not copy files from a local developer laptop.

## Data safety policy

Deploy flow is migration-upgrade-only.

- database is not dropped/reset as part of normal deploy
- backend deploy runs Alembic upgrade path only
- deploy script explicitly blocks reset flags (`RESET_DATABASE`, `DB_RESET`)

This preserves live staging data across releases.

## Frontend source of truth

Current build targets:

- dashboard: `frontend/dashboard-blueprint`
- B2B survey: `frontend/survey`
- installation survey: `frontend/installation-survey`

The deployment process builds these apps with the following live URLs:

- dashboard -> `/dashboard/`
- B2B survey -> `/surveys/b2b/`
- installation survey -> `/surveys/installation/`

## Environment essentials

Create `/opt/cwscx/.env` from `.env.example` and set real values.

Minimum required for backend startup:

- `DATABASE_URL`
- `ENTRA_TENANT_ID`
- `ENTRA_CLIENT_ID`
- `ENTRA_AUTHORITY`
- `ENTRA_ISSUER`
- `ENTRA_AUDIENCE`

## Operations quick links

- health endpoint: `/api/health`
- backend service: `cwscx-backend.service`
- deployment scripts: `scripts/linux/*.sh`

## Quick help for new users

If something looks wrong, use this simple checklist first:

1. Refresh the page once.
2. Confirm you are opening the correct URL for the correct platform.
3. Sign out and sign in again if access looks incomplete.
4. If a page still fails, tell support which URL you opened, what time it happened, and what message you saw.

For full troubleshooting and incident playbooks, use:

- `docs/DEPLOYMENT_END_TO_END_GUIDE.md`
- `docs/HANDOVER_GUIDE.md`

## Repository hygiene notes

- do not commit secrets, local DB files, or virtualenvs
- frontend API calls must use `/api` (relative path), not localhost URLs
- keep deployment behavior script-driven and reproducible
