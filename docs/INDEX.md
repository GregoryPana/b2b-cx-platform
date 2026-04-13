# CWSCX Documentation Index

CWSCX is the Cable & Wireless Seychelles Customer Experience Platform. It combines internal governance, survey capture, review workflows, reporting, and operations guidance across the B2B Survey, Installation Assessment, Mystery Shopper, and the CX Governance Dashboard.

## What This Platform Does
- `CX Governance Dashboard` -> `/dashboard/`
  Purpose: Internal management, analytics, review queues, reports, and admin operations.
- `B2B Survey` -> `/surveys/b2b/`
  Purpose: Business customer experience surveys, visit execution, and account feedback.
- `Installation Assessment` -> `/surveys/installation/`
  Purpose: Installation quality inspections, work-order-based assessments, and technical scoring.
- `Mystery Shopper` -> `/mystery-shopper/`
  Purpose: Structured mystery shopper survey capture and service-quality evaluation.

## Who This Documentation Is For
- New Developer
  Start here: `docs/operations/HANDOVER_GUIDE.md` -> `docs/architecture/` -> `docs/deployment/`
- DevOps / Deployment
  Start here: `docs/deployment/`
- Platform Architect / Planner
  Start here: `docs/architecture/` -> `docs/features/`

## Tech Stack At A Glance
- Frontend: React 18, Vite, Tailwind CSS, MSAL.js, TanStack Table, Recharts
- Backend: Python, FastAPI, SQLAlchemy 2.0, Alembic, Uvicorn
- Auth: Azure AD / Entra ID (RS256 JWT, role claims)
- Database: PostgreSQL 16
- Proxy: Nginx
- Infra: systemd, GitHub Actions (self-hosted runner), Docker (dev only)

## Development Conventions
- Design system: `docs/design/DESIGN_SYSTEM_MAP.md`
- UI/UX standards: `docs/design/FRONTEND_UI_UX_STANDARDS.md`
- UX guide: `docs/design/UX DESIGN GUIDE.md`
- Architecture specifications: `docs/architecture/`

## Table Of Contents

### Architecture
- `docs/architecture/visit-lifecycle.md`
- `docs/architecture/approval-state-transitions.md`
- `docs/architecture/role-authorization-matrix.md`
- `docs/architecture/jwt-validation-contract.md`
- `docs/architecture/auth-middleware.md`
- `docs/architecture/nps-engine-rules.md`
- `docs/architecture/coverage-engine-rules.md`
- `docs/architecture/action-required-validation.md`
- `docs/architecture/error-classification.md`
- `docs/architecture/deployment-topology.md`
- `docs/architecture/migration-strategy.md`
- `docs/architecture/rollback-procedure.md`
- `docs/architecture/ci-cd-flow.md`

### Deployment
- `docs/deployment/DEPLOYMENT_END_TO_END_GUIDE.md`
- `docs/deployment/STAGING_CICD_SETUP.md`
- `docs/deployment/postgres_migration.md`
- `docs/deployment/installation_database_setup.md`
- `docs/deployment/ENTERPRISE_DEPLOYMENT_RUNBOOK.md`

### Design
- `docs/design/blueprint.md`
- `docs/design/claude design.md`
- `docs/design/FRONTEND_UI_UX_STANDARDS.md`
- `docs/design/UX DESIGN GUIDE.md`
- `docs/design/SaaS Design.md`
- `docs/design/DESIGN_SYSTEM_MAP.md`
- `docs/design/TABS_JUMP_QA_CHECKLIST.md`

### Operations
- `docs/operations/HANDOVER_GUIDE.md`
- `docs/operations/ENTRA_SESSION_POLICY.md`
- `docs/operations/MYSTERY_SHOPPER_OPERATIONS_GUIDE.md`
- `docs/operations/AI_SKILL_DEPLOYMENT_SOURCE.md`

### Features
- `docs/features/ADMIN_DASHBOARD_IMPLEMENTATION.md`
- `docs/features/BUSINESS_DELETION_AND_RETIREMENT_IMPLEMENTATION.md`
- `docs/features/DUPLICATE_VISIT_VALIDATION_IMPLEMENTATION.md`
- `docs/features/MYSTERY_SHOPPER_IMPLEMENTATION_PLAN.md`
- `docs/features/installation/INSTALLATION_ASSESSMENT_PLAN.md`
- `docs/features/installation/INSTALLATION_ANALYTICS_SPEC.md`
- `docs/features/installation/README.md`

### Reference
- `docs/reference/questions-b2b.md`
- `docs/reference/questions-installation.md`
- `docs/reference/questions-mystery-shopper.md`
- `docs/reference/ENTRA_APP_GROUP_OBJ_ID.md`

### Archive
- `docs/archive/10_CICD_STRATEGY.md`
- `docs/archive/AI_INSTALLATION_IMPLEMENTATION_PROMPT.md`
- `docs/archive/CONTINUE_PROMPT_DEPLOYMENT.md`
- `docs/archive/ENTERPRISE_DEPLOYMENT_RUNBOOK.md`
- `docs/archive/ENTERPRISE_PLATFORM_MIGRATION_CHECKLIST.md`
- `docs/archive/ENTERPRISE_PLATFORM_SCHEMA_DRAFT.md`
- `docs/archive/ENTERPRISE_SURVEY_ANALYTICS_PLATFORM_PLAN.md`
- `docs/archive/MANUAL_SQL_GUIDE.md`
- `docs/archive/SURVEY_RESPONSE_FINAL_FIX.md`
- `docs/archive/b2b_customer_experience_database_schema_v1.md`
- `docs/archive/deployment-topology.md`
