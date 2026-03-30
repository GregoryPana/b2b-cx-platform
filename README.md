# CWSCX Platform

Enterprise Customer Experience platform for Cable and Wireless Seychelles.

This repository contains:

- a FastAPI backend
- multiple React/Vite frontends
- staging CI/CD automation
- deployment scripts and runbooks

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
- installation survey: `frontend/survey` (different base path)

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

For full troubleshooting and incident playbooks, use:

- `docs/DEPLOYMENT_END_TO_END_GUIDE.md`
- `docs/HANDOVER_GUIDE.md`

## Repository hygiene notes

- do not commit secrets, local DB files, or virtualenvs
- frontend API calls must use `/api` (relative path), not localhost URLs
- keep deployment behavior script-driven and reproducible
