# CWSCX Platform

Enterprise deployment-ready CX platform with FastAPI backend and multiple Vite frontends.

## Canonical Deployment Guide

Use `ENTERPRISE_DEPLOYMENT_RUNBOOK.md` as the single source of truth for deployment.

## Runtime Architecture

- Backend: FastAPI + Uvicorn on `127.0.0.1:8000`
- Reverse proxy: Nginx
- API route: `/api/*` -> backend
- Frontends:
  - `/` -> Mystery Shopper
  - `/dashboard/` -> Dashboard
  - `/surveys/b2b/` -> B2B Survey
  - `/surveys/installation/` -> Installation Survey

## Server Layout

```text
/opt/cwscx/
  backend/
  frontends-src/
    public/mystery-shopper/
    dashboard/
    internal-surveys/b2b/
    internal-surveys/installation/
  scripts/linux/
  shared/
  .env
```

## Artifact-Based Deployment

This repository uses artifact-based deployment for enterprise consistency:

1. Build release bundle on Windows with `scripts/windows/build_release_bundle.ps1`
2. Upload bundle with `scripts/windows/upload_release_bundle.ps1`
3. Install bundle on VM with `scripts/linux/install_release_bundle.sh`
4. Deploy backend with `scripts/linux/deploy_backend.sh`
5. Validate frontend artifacts with `scripts/linux/deploy_frontends.sh`
6. Deploy Nginx config with `scripts/linux/deploy_nginx.sh`

## Environment

Start from `.env.example` and set real values in `/opt/cwscx/.env` on server:

- `DATABASE_URL=postgresql://<user>:<password>@localhost:5432/cwscx`
- `CORS_ALLOW_ORIGINS=https://cwscx-tst01.cwsey.com`
- `ENTRA_*` values for token validation and frontend auth

## Notes

- Frontend API calls must use `/api` (relative path), not localhost URLs.
- Frontend `dist` artifacts are served directly by Nginx.
- Do not commit runtime secrets, virtualenvs, or local DB files.
