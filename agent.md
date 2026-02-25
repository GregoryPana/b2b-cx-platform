# B2B CX Governance Platform

## Problem Statement & Scope Boundaries
Design and deliver a deterministic, production-grade, role-segmented B2B Customer Experience Governance Platform for structured visit assessments, approval workflow, NPS, and coverage analytics. Scope includes survey and dashboard UIs, FastAPI backend, PostgreSQL storage, and segmented deployment (DMZ + Internal LAN). Out of scope: ad-hoc BI tooling, external integrations beyond Entra ID, and non-governed data sources.

## North Star & Measurable Success Criteria
- Governed B2B CX insight with auditability and strong consistency.
- Annual business coverage visibility and repeat-visit tracking.
- Reliable NPS calculation for approved visits only.
- Controlled approval pipeline with explicit state transitions.

## User Roles & Access Matrix
- Representative: create visits, edit drafts, submit, view own submissions; no dashboards; no approvals.
- Reviewer: view pending visits, approve/reject with rejection comments.
- Manager: view dashboards; filter by date, account executive, category; view coverage analytics.
- Admin: manage users, businesses, question set; override approval state; access all dashboards.
Authorization is enforced at backend; frontend rendering is secondary.

## Visit Lifecycle & Approval Workflow
Draft -> Pending Review -> Needs Changes or Approved or Rejected. Only Approved visits count toward coverage, dashboards, and NPS.

## NPS Calculation Contract
For approved visits only: Promoters are scores 9-10, Detractors are scores 0-6. NPS = %Promoters - %Detractors.

## Coverage Calculation Logic
Metrics: total active businesses, businesses visited YTD, coverage %, businesses not visited, repeat visits.

## Action-Required Logic
If action_required is filled, then action_target and priority_level are required. due_date is optional.

## API Contracts
Auth: POST /auth/login (dev mock), GET /auth/me
Businesses: GET /businesses, POST /businesses (Admin), PUT /businesses/{id}
Visits: POST /visits, GET /visits/my, GET /visits/pending, PUT /visits/{id}/submit, PUT /visits/{id}/needs-changes, PUT /visits/{id}/approve, PUT /visits/{id}/reject
Responses: POST /visits/{id}/responses
Dashboard: GET /dashboard/nps, GET /dashboard/coverage, GET /dashboard/category-breakdown

## Data Schema & Migrations
Tables: Users, Businesses, AccountExecutives, Visits, MeetingAttendees, Questions, Responses, AuditLogs.
Visits include UUID id, business_id, representative_id, visit_date, visit_type, status, reviewer_id, approval_timestamp.
Visits include review_timestamp and change_notes for Needs Changes state.
Visits include approval_notes and rejection_notes for decision context.
Responses include score, verbatim, action_required, action_target, priority_level, due_date.
Migrations must be deterministic and safe for segmented production.

## Environment Contracts (Dev / Staging / Prod)
DEV: local; STAGING: internal test VM; PRODUCTION: segmented DMZ + Internal VMs.
Each environment has separate .env, DB, Entra App Registration, and secrets.

## Segmented Deployment Topology
Survey frontend in DMZ VM; dashboard frontend in internal LAN only; API on internal VM; PostgreSQL on internal DB VM. Nginx reverse proxy with TLS termination and health checks; no direct DB access from frontend.

## CI/CD Summary
CI path-based workflows: backend/**, frontend/survey/**, frontend/dashboard/**. Lint, unit tests, build artifacts; CI failure blocks deploy.
CD: develop -> staging; main -> production with manual approval. Deploy via SSH, Docker container restart, migrations, smoke tests, emit deployment metadata.

## Failure Modes & Rollback Strategy
Potential failures: auth misconfig (Entra JWT), DB connectivity, migration errors, role enforcement regression, NPS/coverage logic errors. Rollback: revert to last known-good container and schema state; use deterministic migrations and documented rollback steps.

## Maintenance Log (Append-Only)
- 2026-02-19: Initialized agent.md from discovery and blueprint docs; consolidated roles, lifecycle, NPS/coverage logic, API and environment contracts.
- 2026-02-19: Added Needs Changes state and reviewer edit capability; updated lifecycle and authorization SOPs.
- 2026-02-19: Added needs-changes endpoint and review fields to Visits schema.
- 2026-02-19: Added approval/rejection notes to Visits schema and API responses.
- 2026-02-19: Synced reviewer decision notes in roles and overview.
- 2026-02-19: Added visit create/submit and response create schemas; added workflow validation errors.
- 2026-02-19: Added JWT validation contract, auth middleware spec, and implementation plan.
- 2026-02-19: Scaffolded monorepo folders, FastAPI app with /health, env example, and dev compose.
- 2026-02-19: Added backend deps/tests and CI workflows; added staging/production deploy workflows.
- 2026-02-19: Added SQLAlchemy models and Alembic initial migration; set deploy workflows to manual; noted local-only env status.
- 2026-02-19: Added visit/response routers, schemas, auth stub, frontend scaffolds, and local tooling scripts.
- 2026-02-19: Added Makefile, dev DB scripts, updated API docs, and aligned local CI dependencies.
- 2026-02-19: Noted header-based auth stubs for local development.
- 2026-02-19: Added PowerShell scripts for running backend, tests, and frontends.
- 2026-02-19: Added CMD equivalents for local run scripts.
- 2026-02-19: Reorganized scripts into scripts/cmd, scripts/powershell, and scripts/bash.
- 2026-02-19: Added CRUD endpoints, dashboard metrics, seed script, and wired frontends to API.
- 2026-02-19: Added visit detail endpoint and reviewer workflow UI in dashboard.
- 2026-02-19: Added dashboard toggle between metrics and review queue.
