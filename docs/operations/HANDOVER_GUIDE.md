# Project Handover Guide

This guide is for new team members, including non-technical stakeholders.

It explains:
- what the platform is
- how teams use it day to day
- how deployment and operations work
- what to do when something goes wrong

## 1) Plain-language overview

The CWSCX platform helps Cable and Wireless Seychelles collect, review, and manage customer experience information across multiple survey programs.

## 2) Main personas and who does what
- Surveyor / Representative
  - creates or continues planned visits
  - enters responses and action items
  - submits visits
- Admin / Reviewer
  - reviews pending submissions
  - manages businesses and supporting reference data
  - monitors analytics
- Platform owner / Ops
  - manages environment health
  - supervises deployments and rollback
- Product / Business stakeholder
  - tracks customer metrics and operational trends

## 3) System modules (functional view)
- CX Governance Dashboard (`/dashboard/`)
  - analytics, trends, reports, review queues, business administration, and platform switching
- B2B Survey (`/surveys/b2b/`)
  - planned visits workflow, response capture, submission
- Installation Survey (`/surveys/installation/`)
  - installation assessment workflow with Entra sign-in and role-based access
- Mystery Shopper (`/surveys/mystery-shopper/`)
  - protected mystery shopper SPA flow
- API backend (`/api/*`)
  - serves data, handles business logic, validates auth

## 4) Technical building blocks (simplified)
- Backend: FastAPI + Alembic migrations + PostgreSQL
- Frontends: React + Vite
- Auth: Microsoft Entra bearer token validation
- Reverse proxy: Nginx
- Runtime control: systemd services
- CI/CD: GitHub Actions + self-hosted runners on internal network (staging and production)

## 5) Environment and architecture
### Staging
- single VM architecture
- deployment root: `/opt/cwscx`
- backend behind Nginx at `/api/*`
- frontend SPAs served from `frontends-src/*/dist`

### Production target pattern
- web VM (public routing)
- app VM (backend + internal frontends)
- database VM (PostgreSQL)

## 6) Day-to-day use flow (business operations)
Typical B2B cycle:
1. planner creates draft planned visits
2. surveyor opens planned visit
3. surveyor saves responses question by question
4. surveyor submits visit
5. reviewer validates pending queue
6. approved items feed analytics views

Typical installation cycle:
1. installation assessor signs in with Entra
2. assessor completes the installation quality survey
3. responses are saved and submitted
4. dashboard users review analytics, survey explorer, and reports for the installation platform

## 7) Data integrity and safety principles
- deployment uses migration upgrade only
- reset flags are blocked in deploy script
- release bundles are archived for rollback
- existing records are preserved across releases

## 8) Deployment lifecycle (high-level)
1. code is merged to `main`
2. CI checks run (backend tests, frontend builds)
3. deploy job is triggered manually and runs on self-hosted runner
4. release bundle is built and installed
5. backend, frontends, nginx updated
6. verification checks run
7. rollback attempted if verification fails

Full details: `docs/deployment/DEPLOYMENT_END_TO_END_GUIDE.md`

## 9) How to monitor health
Business-level checks:
- dashboard opens
- survey pages open
- submitting and reviewing visits works

Technical checks:
- `/api/health` responds healthy
- `cwscx-backend` service is active
- Nginx config test passes
- staging database container `cwscx-postgres` is up
- staging database host port `5433` is listening when remote DB access is expected

Backup and recovery checks:
- staging database backups are currently created by a VM cron job
- staging active script path: `/opt/backups/postgres/backup.sh`
- staging active log path: `/opt/backups/postgres/backup.log`
- staging live database compose source: `/opt/cwscx/docker-compose.yml`
- staging live database container: `cwscx-postgres`
- staging live database host port: `5433`
- backup layout:
  - `/opt/backups/postgres/daily/`
  - `/opt/backups/postgres/weekly/`
  - `/opt/backups/postgres/monthly/`
- restore-readiness should be verified periodically with `pg_restore --list` and a full restore drill

These paths and runtime details describe the current staging VM only. Production should be documented separately once the live environment is provisioned.

## 10) Incident handling playbook
### Scenario A: Frontend route returns 500 or blank
Check:
- dist files exist under expected `frontends-src/.../dist`
- nginx route mapping for that base path
- browser dev tools for missing assets

Action:
- rerun deployment workflow
- if still broken, reinstall previous release zip

### Scenario B: Backend service not healthy
Check:
- `systemctl status cwscx-backend`
- backend logs (`journalctl`)
- DB connectivity and env values

Action:
- fix env/DB issue, redeploy

### Scenario C: Deployment fails in workflow
Check:
- exact failing step in workflow logs
- runner connectivity and permissions
- sudoers and writable paths

Action:
- address specific preflight/deploy script error
- rerun workflow

## 11) Handover checklist for new owner
- understands route map and app modules
- can run and interpret health checks
- can trigger and monitor deploy workflow
- knows rollback procedure
- knows where secrets/config live
- knows common failure patterns and fixes

## 12) Knowledge transfer session agenda (recommended)
1. business context and platform goals
2. live walkthrough of dashboard and survey flows
3. architecture and environment map
4. deployment workflow walkthrough
5. troubleshooting drills and rollback demo

## 13) Important file map for maintainers
- workflow: `.github/workflows/deploy-staging.yml`
- bundle build: `scripts/linux/build_release_bundle.sh`
- bundle install: `scripts/linux/install_release_bundle.sh`
- backend deploy: `scripts/linux/deploy_backend.sh`
- frontend validation: `scripts/linux/deploy_frontends.sh`
- nginx deploy: `scripts/linux/deploy_nginx.sh`
- staging setup: `docs/deployment/STAGING_CICD_SETUP.md`
- canonical runbook: `docs/deployment/ENTERPRISE_DEPLOYMENT_RUNBOOK.md`

## 14) Future Operations Note
- A future cross-environment operations platform is planned to centralize:
  - backup status
  - health checks
  - alert intake
  - alert triage across multiple VMs, environments, and bespoke applications
- That future platform is not part of the current shipped runtime.

## 15) Language and communication guidance for non-technical users
When explaining status updates to non-technical teams:
- avoid low-level stack details unless asked
- lead with user impact (what works / what is blocked)
- provide expected recovery time
- provide clear next update time
