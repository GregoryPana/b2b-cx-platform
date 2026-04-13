# Installation Planning

This folder now serves as the live specification area for the Installation Assessment platform.

## Docs
- `docs/features/installation/INSTALLATION_ASSESSMENT_PLAN.md`
  - historical implementation specification with current completion status
- `docs/features/installation/INSTALLATION_ANALYTICS_SPEC.md`
  - analytics definitions, calculation logic, API contract, and pseudo-SQL

## Current State
- ✓ Database schema implemented (via Alembic migrations)
- ✓ Backend API endpoints implemented
- ✓ Installation Survey frontend built and deployed (`/surveys/installation/`)
- ✓ Dashboard integration complete
- ✓ Auth roles (`INSTALL_ADMIN`, `INSTALL_SURVEYOR`) active in Entra

For current operational guidance, use:
- `docs/operations/HANDOVER_GUIDE.md`
- `docs/deployment/DEPLOYMENT_END_TO_END_GUIDE.md`
