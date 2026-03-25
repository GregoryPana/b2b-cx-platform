# CWSCX Platform

Enterprise deployment-ready CX platform with FastAPI backend and multiple Vite frontends.

## Canonical Deployment Guide

Use `ENTERPRISE_DEPLOYMENT_RUNBOOK.md` as the single source of truth for deployment.
For staging automation prerequisites, use `STAGING_CICD_SETUP.md`.

## Runtime Architecture

### Staging / Testing (single VM)

- Backend: FastAPI + Uvicorn on `127.0.0.1:8000`
- Reverse proxy: Nginx
- API route: `/api/*` -> backend
- Frontends:
  - `/` -> Mystery Shopper
  - `/dashboard/` -> Dashboard
  - `/surveys/b2b/` -> B2B Survey
  - `/surveys/installation/` -> Installation Survey

### Production (multi-VM)

- **cwscx-app01.cwsey.com (172.17.1.211)**

  - Backend FastAPI + internal-only frontends
  - Nginx reverse proxy (internal only)
  - API: `/api/*` -> local FastAPI
  - Frontends served:
    - `/dashboard/`
    - `/surveys/b2b/`
    - `/surveys/installation/`
  - No public SSL (internal cert only)
- **cwscx-sql01.cwsey.com (172.17.1.212)**

  - PostgreSQL (Docker, :5432)
  - No public exposure
- **cwscx-web01.cwsey.com (172.17.0.200)**

  - Public-facing frontends only
  - Nginx with public SSL
  - Proxies `/api/*` to backend on `cwscx-app01`
  - Optional: future mystery shopper SPA

#### Network diagram

```
Internet → NAT → cwscx-web01 (public frontends)
              |
              +--- internal network → cwscx-app01 (backend + internal frontends)
                                      |
                                      +--- cwscx-sql01 (PostgreSQL)
```

## Server Layout

### Staging (single VM)

```
/opt/cwscx/
  backend/
    backend/          # FastAPI app code
    backend/alembic/
    backend/app/
    backend/logs/
    backend/venv/
    alembic.ini
    requirements.txt
    venv/
  frontends-src/
    dashboard/
    internal-surveys/
      b2b/
      installation/
    public/
  scripts/linux/
  shared/
  .env
```

Note: The `install_release_bundle.sh` script creates the `frontends-src` directories and copies the `dist/` subdirectories into each frontend path. The backend is nested under `backend/backend`.

### Production (multi-VM)

```
cwscx-app01: (backend + internal frontends)
  /opt/cwscx/
    backend/
    frontends-src/
      dashboard/
      internal-surveys/b2b/
      internal-surveys/installation/
    scripts/linux/
    .env

cwscx-web01: (public frontends only)
  /opt/cwscx/
    frontends-src/
      public/mystery-shopper/
      dashboard/
      internal-surveys/b2b/
      internal-surveys/installation/
    scripts/linux/
    .env

cwscx-sql01: (PostgreSQL only)
  /opt/cwscx/docker-compose.yml
  Data volume: cwscx_data
```

## Artifact-Based Deployment

This repository uses artifact-based deployment for enterprise consistency.

### Build (Windows)

1. Build release bundle on Windows with `scripts/windows/build_release_bundle.ps1`
2. Upload bundle with `scripts/windows/upload_release_bundle.ps1`

Current bundle frontend sources:

- Dashboard: `frontend/dashboard-blueprint`
- B2B + Installation surveys: `frontend/survey`

### Install (VM)

3. Install bundle on VM with `scripts/linux/install_release_bundle.sh`
4. Deploy backend with `scripts/linux/deploy_backend.sh`
5. Validate frontend artifacts with `scripts/linux/deploy_frontends.sh`
6. Deploy Nginx config with `scripts/linux/deploy_nginx.sh`

### CI/CD

- GitHub Actions builds bundles and deploys to `cwscx-tst01.cwsey.com` (staging).
- Production will be multi-VM with role-based deployment.

## Environment

Start from `.env.example` and set real values in `/opt/cwscx/.env` on server:

### Staging

- `DATABASE_URL=postgresql://<user>:<password>@localhost:5432/cwscx`
- `CORS_ALLOW_ORIGINS=https://cwscx-tst01.cwsey.com`
- `ENTRA_*` values for token validation and frontend auth

### Production

- **Backend VM (cwscx-app01)**

  - Connects to remote PostgreSQL on `cwscx-sql01`
  - `DATABASE_URL=postgresql://cxadmin:cxadmin123@cwscx-sql01:5432/cwscx-prod`
  - Internal-only frontends; no public SSL
  - `CORS_ALLOW_ORIGINS=https://cwscx-app01.cwsey.com,https://cwscx-web01.cwsey.com`
- **Public VM (cwscx-web01)**

  - Serves static frontends only
  - Public SSL
  - Proxies `/api/*` to backend on `cwscx-app01`
  - `VITE_API_URL=https://cwscx-app01.cwsey.com/api` (frontend build-time)
  - `CORS_ALLOW_ORIGINS=https://cwscx-app01.cwsey.com,https://cwscx-web01.cwsey.com`

## Notes

- Frontend API calls must use `/api` (relative path), not localhost URLs.
- Frontend `dist` artifacts are served directly by Nginx.
- Do not commit runtime secrets, virtualenvs, or local DB files.
- Entra auth uses bearer tokens; configure redirect URIs per environment (see Entra section).
