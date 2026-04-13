# CWSCX Platform

CWSCX is Cable & Wireless Seychelles' customer experience platform for internal governance, survey capture, review, analytics, and reporting.

## Entry Points
- `/dashboard/` -> CX Governance Dashboard (internal, Entra-protected)
- `/surveys/b2b/` -> B2B Survey
- `/surveys/installation/` -> Installation Assessment Survey
- `/mystery-shopper/` -> Mystery Shopper (Entra-protected)
- `/` -> redirects to `/dashboard/`

## Tech Stack
- Frontend: React 18, Vite, Tailwind CSS, MSAL.js, TanStack Table, Recharts
- Backend: Python, FastAPI, SQLAlchemy 2.0, Alembic, Uvicorn
- Auth: Azure AD / Entra ID with RS256 JWT validation and role claims
- Database: PostgreSQL 16
- Proxy: Nginx

## Monorepo Structure
- `frontend/dashboard-blueprint/` -> CX Governance Dashboard
- `frontend/survey/` -> B2B Survey
- `frontend/installation-survey/` -> Installation Assessment Survey
- `frontend/mystery-shopper/` -> Mystery Shopper
- `backend/` -> FastAPI application
- `scripts/linux/` -> Deployment scripts
- `.github/workflows/` -> CI/CD pipelines
- `docs/` -> All documentation (start at `docs/INDEX.md`)

## Documentation
All documentation now lives under `docs/`.

Start here:
- `docs/INDEX.md`

## Quick Links
- Deployment guide: `docs/deployment/DEPLOYMENT_END_TO_END_GUIDE.md`
- Handover guide: `docs/operations/HANDOVER_GUIDE.md`
- CI/CD setup: `docs/deployment/STAGING_CICD_SETUP.md`
- Architecture index: `docs/architecture/`
- Design system: `docs/design/DESIGN_SYSTEM_MAP.md`
