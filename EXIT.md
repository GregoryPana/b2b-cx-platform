# EXIT.md — CWSCX Platform

---

## 1. Application Overview

**Application name:** CWSCX Platform

**One-line description:** Internal Cable & Wireless Seychelles customer experience platform for governance, survey execution, review, analytics, reporting, and supporting reference-data administration.

**Business purpose:** The CWSCX Platform exists to collect, review, and manage customer experience and operational quality data across multiple internal programmes: B2B surveys, Installation Assessment, and Mystery Shopper. It provides both the survey frontends used by assessors/surveyors and the governance dashboard used by reviewers and administrators. If it stops working, survey operations pause, review workflows stall, analytics become unavailable, and decision-makers lose visibility into service quality and operational issues.

**Primary users:** Internal CWS staff only. Main user groups are surveyors/representatives, admins/reviewers, and DTO/operations staff. Current scale appears to be internal-team usage rather than public/external customer traffic.

**Production URL (internal):** `https://cwscx-app01.cwsey.com`

**Status:** Deployed to production baseline infrastructure; authenticated API flow remediation still in progress.

**Date of first production deployment:** 2026-05-07

**Date this EXIT.md was last fully reviewed:** 2026-05-06

---

## 2. Tier Classification

**Tier:** Tier 1

**Classification rationale:** The platform is currently internal-only, Entra-protected, and used by staff rather than external customers. Although it contains operationally important data and supports multiple programmes, it is not yet customer-facing, not currently multi-tenant, and does not presently require a distributed high-availability topology. Based on the DTO tier model, that places it in Tier 1 for the current operating phase.

**Reclassification triggers:** Re-tier this application if any of the following happen:
- external/customer-facing access is introduced
- compliance or sensitivity requirements increase materially
- production requires separate app and database tiers for resilience
- multiple environments or consumers depend on stronger availability guarantees

---

## 3. Architecture Summary

**Architecture pattern:** Monorepo with multiple React/Vite frontends, one FastAPI backend, path-based Nginx routing, and PostgreSQL.

**Component diagram (text):**
```
Internal User Browser
       |
       | HTTPS
       v
+------------------------------+
| NGINX / Route Layer          |
| /dashboard/                  |
| /surveys/b2b/                |
| /surveys/installation/       |
| /surveys/mystery-shopper/    |
| /api/*                       |
+------------------------------+
                |
                v
+------------------------------+
| FastAPI Backend              |
| - auth validation            |
| - survey APIs                |
| - dashboard APIs             |
| - analytics                  |
| - review flows               |
+------------------------------+
                |
                v
+------------------------------+
| PostgreSQL 16                |
| - visits                     |
| - questions                  |
| - businesses                 |
| - users                      |
| - installation tables        |
| - mystery shopper tables     |
+------------------------------+

Separate observability VM currently provides:
- Uptime Kuma
- pgAdmin
```

**External dependencies:**
- Microsoft Entra ID
  - used for authentication and role claims
  - if unavailable, users cannot sign in or refresh sessions normally
- Entra JWKS / token validation path
  - backend token validation depends on this
  - staging currently includes a fallback strategy when JWKS validation is slow or unavailable
- SMTP relay
  - used for email delivery where configured (reports / future notifications)
  - if unavailable, email-based notifications or report delivery fail

**Internal dependencies:**
- observability VM hosting Uptime Kuma and pgAdmin
  - provides health monitoring and DB admin access for staging, later production
- staging VM runtime services
  - nginx, backend, and live PostgreSQL Docker container
- no other bespoke application dependency is currently documented as authoritative upstream or downstream for core operation

---

## 4. Infrastructure and VM Assignment

**Production VM:** `cwscx-app01`

| Property | Value |
|---|---|
| VM hostname | `cwscx-app01` |
| Internal IP | `172.17.1.211` |
| OS | Ubuntu 24.04 LTS |
| vCPU | 2 |
| RAM | 3.8 GiB |
| Disk | 38 GiB root volume |
| Network VLAN | prod-vlan |
| Provisioned by | IT / Infrastructure team |
| Date provisioned | Not yet recorded in this document |
| IT ticket reference | Not yet recorded in this document |

**Staging VM:** `cwscx-tst01` / `cwscx-tst01.cwsey.com` / `172.17.1.213`

**Database location:**
- Staging: PostgreSQL is Docker-hosted on the staging VM via `/opt/cwscx/docker-compose.yml`, service `postgres`, container `cwscx-postgres`, host port `5433`
- Production target: to be confirmed during Workstream 3; do not assume the staging layout will be copied unchanged

**Observability VM (current):** `cwscx-sql01` / `cwscx-sql01.cwsey.com` / `172.17.1.212`

**Backup target:**
- Staging DB backups currently live on the staging VM filesystem under `/opt/backups/postgres/`
- initial production DB backup approach is intended to follow the same VM-local pattern currently used on staging
- production backup destination should still be reviewed and hardened after first live deployment

**Network exposure:**
- Inbound:
  - production app VM currently has nginx listening on port `80`
  - `ufw` currently allows `443`, but nginx is not yet listening on `443`
  - TLS termination and production `443` listener still need to be configured on this VM before go-live
- Outbound:
  - Entra authentication endpoints / JWKS
  - SMTP relay where configured
- Firewall rules:
  - staging/observability routing and DB reachability are currently documented operationally, but formal rule IDs still need to be recorded in production documentation

---

## 5. Technology Stack

| Component | Version | Notes |
|---|---|---|
| Python | 3.11 in CI / 3.12 expected in runtime environments | Backend code currently runs with Python 3.11 in GitHub Actions and 3.12 on target VMs as observed in logs |
| FastAPI | 0.111.0 | `backend/requirements.txt` |
| Pydantic | via FastAPI dependency chain | direct version not pinned separately in `requirements.txt` |
| SQLAlchemy | 2.0.30 | `backend/requirements.txt` |
| Alembic | 1.13.2 | `backend/requirements.txt` |
| PostgreSQL | 16 | current staging Docker runtime |
| Node.js | 20 | used in CI/frontend builds |
| TypeScript | 5.6.3 in typed frontends | B2B and installation survey packages |
| React | 18.3.1 | all active frontends |
| Vite | 5.3.4 | all active frontends |
| NGINX | Ubuntu package on target VMs | path routing, TLS, static assets, `/api` proxy |
| Docker Engine | 29.x observed on observability VM; production/staging exact app VM versions should be recorded during cutover | |
| Docker Compose | v2 plugin where applicable | observability VM confirmed with Compose v5.1.3 |

**Why these choices:** Standard CWSCX / DTO stack with no intentional major deviation in the current platform shape, aside from the fact that the codebase is still a mixed JavaScript/TypeScript frontend estate rather than fully strict TypeScript.

---

## 6. Codebase Structure

**Repository location:** `git@github.com:GregoryPana/b2b-cx-platform.git`

**Repository visibility:** Private GitHub repository.

**Branch strategy:**
- `main` — default branch, deployment-capable but staging/prod deploys are triggered manually
- `production` — intended production-tracking branch / workflow path, still to be finalized operationally
- feature branches and hotfix branches used as needed during active work

**Folder layout:**
```
/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   ├── core/
│   │   ├── models/
│   │   ├── programs/
│   │   ├── routers/
│   │   ├── schemas/
│   │   └── main.py
│   ├── alembic/
│   ├── requirements.txt
│   └── tests/
├── frontend/
│   ├── dashboard-blueprint/
│   ├── survey/
│   ├── installation-survey/
│   ├── mystery-shopper/
│   └── user-guides/
├── scripts/linux/
├── docs/
├── DB_VM_SETUP_GUIDE.md
├── HEALTH_ENDPOINT_SPEC.md
├── WORKSTREAM_TRACKER.md
├── docker-compose.dev.yml
├── README.md
├── EXIT.md
└── EXIT-CONVENTIONS.md
```

**Folder conventions:**
- backend HTTP/API logic lives under `backend/app/api/` and `backend/app/routers/`
- frontend applications are split by programme under `frontend/`
- deployment and operational scripts live under `scripts/linux/`
- active documentation lives under `docs/`
- repo-root operational planning/tracker documents exist for current platform rollout work

---

## 7. Coding Conventions

This application inherits DTO-wide conventions from `EXIT-CONVENTIONS.md`.

**Documented current deviations that matter operationally:**
- backend is currently sync SQLAlchemy/engine based, not the async SQLAlchemy standard described in `EXIT-CONVENTIONS.md`
- frontend estate is mixed JS/TS rather than fully strict TypeScript
- API base paths in the current app are not consistently `/api/v1/*`

Any future cleanup should reduce these deviations rather than expand them.

---

## 8. Database

**Engine:** PostgreSQL 16

**Database name:** `cwscx-postgres` in current staging runtime

**Schema strategy:** Single `public` schema shared by the current platform tables.

**Migration tool:** Alembic

**Migration conventions:**
- migrations are stored in `backend/alembic/versions/`
- current platform practice is migration-upgrade-only during deploy
- recent hardening removed runtime schema mutation from active request paths where found
- migration safety has been a real operational concern in this codebase and must be treated carefully in production cutover

**Where the schema lives:**
- SQLAlchemy models: `backend/app/models/`
- Alembic migrations: `backend/alembic/versions/`
- seed/utility scripts: `backend/scripts/`

**Backup configuration:**
- Staging tool: VM-local backup script at `/opt/backups/postgres/backup.sh`
- Staging schedule: cron-driven
- Staging retention layout:
  - `/opt/backups/postgres/daily/`
  - `/opt/backups/postgres/weekly/`
  - `/opt/backups/postgres/monthly/`
- Production tool: VM-local backup script at `/opt/backups/postgres/backup.sh`
- Production schedule: cron-driven (`0 2 * * * /opt/backups/postgres/backup.sh >> /opt/backups/postgres/backup.log 2>&1`)
- Production retention layout:
  - `/opt/backups/postgres/daily/`
  - `/opt/backups/postgres/weekly/`
  - `/opt/backups/postgres/monthly/`
- Production backup target: currently local to the production VM; should be moved off-VM as a later hardening step
- RPO target: Not yet finalized. Must be agreed before production cutover.
- RTO target: Not yet finalized. Must be agreed before production cutover.
- Last successful restore test: production bootstrap validated by restoring a staging backup into the production database before first successful deployment (2026-05-07)

**Restore procedure:**
Current reference material exists in:
- `docs/deployment/postgres_migration.md`
- `docs/operations/HANDOVER_GUIDE.md`

Production restore procedure should be finalized with exact target-VM commands during Workstream 3 before first live cutover.

---

## 9. Authentication and Authorisation

**Authentication method:** Microsoft Entra ID via MSAL in the frontends and bearer-token validation in the backend.

**Authorisation model:** Role-based access control using Entra role claims.

**Roles defined:**

| Role | Permissions | Assigned via |
|---|---|---|
| `CX_SUPER_ADMIN` | Full access to all platforms and admin/dashboard functions | Entra role |
| `B2B_ADMIN` | B2B survey + B2B dashboard/admin access | Entra role |
| `B2B_SURVEYOR` | B2B survey create/save/submit only | Entra role |
| `MYSTERY_ADMIN` | Mystery survey + Mystery dashboard/admin/review access | Entra role |
| `MYSTERY_SURVEYOR` | Mystery survey create/save/submit only | Entra role |
| `INSTALL_ADMIN` | Installation survey + Installation dashboard/admin access | Entra role |
| `INSTALL_SURVEYOR` | Installation survey create/save/submit only | Entra role |

**How to add a new role:**
1. define the role in the backend auth dependency layer if it is a new application role
2. update frontend role-gating logic where relevant
3. update `docs/architecture/role-authorization-matrix.md`
4. update this file if the role changes operational behaviour
5. coordinate Entra assignment/group mapping with infrastructure/identity administrators

**Session and token handling:**
- frontends authenticate with MSAL redirect flow
- startup uses Entra claims directly; frontend startup no longer depends on `/auth/me`
- sign-out flow now uses an explicit signed-out guard to avoid instant re-login loops on refresh
- observability cannot fully validate interactive Entra flows through anonymous health checks

---

## 10. Environment Variables and Secrets

**`.env.example` is the documented contract.** Every environment variable the application reads must be documented there.

**Where real values live:**
- Production: production VM `.env` file path still to be finalized during cutover
- Staging: `/opt/cwscx/.env`
- Local dev: developer local `.env` only, never committed

**Required environment variables currently documented:**

| Variable | Purpose | Example | Sensitive |
|---|---|---|---|
| `ENVIRONMENT` | runtime mode | `staging` | No |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` | Yes |
| `CORS_ALLOW_ORIGINS` | allowed frontend origins | `https://cwscx-tst01.cwsey.com` | No |
| `CORS_ALLOW_ORIGIN_REGEX` | regex fallback for CORS | empty or regex | No |
| `LOG_LEVEL` | app logging level | `INFO` | No |
| `ENTRA_TENANT_ID` | Entra tenant | UUID | No |
| `ENTRA_CLIENT_ID` | Entra app/client id | UUID | No |
| `ENTRA_AUTHORITY` | Entra authority URL | tenant login URL | No |
| `ENTRA_ISSUER` | expected issuer | tenant issuer URL | No |
| `ENTRA_AUDIENCE` | expected audience | `api://...` | No |
| `ENTRA_JWKS_URL` | override JWKS URL | URL | No |
| `ENTRA_DEBUG` | auth debug mode | `false` | No |
| `APP_VERSION` | surfaced version for health/build identity | `1.0.0` | No |
| `VITE_API_URL` | frontend API base | `/api` | No |
| `VITE_ENTRA_TENANT_ID` | frontend tenant id | UUID | No |
| `VITE_ENTRA_CLIENT_ID` | frontend app id | UUID | No |
| `VITE_ENTRA_AUTHORITY` | frontend authority URL | URL | No |
| `VITE_ENTRA_API_SCOPE` | frontend API scope | `api://.../access_as_user` | No |
| `VITE_BASE_PATH` | frontend deploy base path | `/dashboard/` etc. | No |

**Secrets that must NEVER be committed to git:**
- real `DATABASE_URL` credentials
- any Entra client secret if introduced
- SMTP credentials
- private keys or certificate material
- any real `.env` file

**Secret rotation procedure:**
- production secret rotation procedure is not yet fully documented here and must be finalized before first live cutover
- staging changes must be mirrored carefully between VM env files, monitor tooling, and any DB admin connections

---

## 11. API Conventions

**Base path:** current application uses `/api` as the active public base path, not `/api/v1`

**Versioning strategy:** no full `/api/v1` rollout is currently in place for this platform; this is a known deviation from DTO target conventions.

**Response envelope:** mixed current-state API behaviour. Some endpoints return bare JSON objects/lists; compatibility and platform routes are not yet normalized to a strict single contract.

**Pagination:** endpoint-specific; no globally enforced platform-wide pagination contract is documented yet.

**Error format:** current codebase uses a mixture of FastAPI `HTTPException` payloads and legacy compatibility responses. A unified RFC 7807 rollout has not yet been completed.

**OpenAPI specification:** FastAPI default OpenAPI is available from the backend application, but production access rules for docs/openapi still need formalizing.

**Health endpoints currently in use:**
- `GET /health`
- `GET /health/ready`
- public nginx paths monitored by observability:
  - `/api/health`
  - `/api/health/ready`

---

## 12. Build, Test, Deploy

**Local development setup:**
Current repo includes multiple app entry points and helper scripts. The exact first-day local setup varies by which frontend/backend slice is being worked on. Start from:
- `README.md`
- `docs/INDEX.md`
- relevant package `npm install` / `npm run dev`
- backend Python environment + requirements install

**Run tests:**
```bash
# Focused backend test example
pytest backend/tests

# Frontend builds
cd frontend/dashboard-blueprint && npm run build
cd frontend/survey && npm run build
cd frontend/installation-survey && npm run build
cd frontend/mystery-shopper && npm run build
```

**Build production images / release bundle:**
Current deploy flow packages a release zip rather than publishing OCI images as the primary release artifact.

**Deploy to staging:**
- `.github/workflows/deploy-staging.yml` exists and is manual (`workflow_dispatch`)
- release bundle is built and installed into `/opt/cwscx`
- backend, frontends, and nginx are refreshed
- verification script runs

**Deploy to production:**
- `.github/workflows/deploy-production.yml` exists and is manual (`workflow_dispatch`)
- production deploy is intended to run on an internal self-hosted GitHub Actions runner with labels:
  - `self-hosted`
  - `linux`
  - `production`
- release bundle is built on the runner and installed locally on the production VM
- production cutover procedure is still being finalized as part of Workstream 3

---

## 13. CI/CD

**Current state:** GitHub Actions, private GitHub repo, staging and production deploys both manually triggered via workflow dispatch, both target environments intended to use internal self-hosted runners.

**Future state:** GitLab self-hosted remains a planned future migration.

**Pipeline stages currently represented:**
1. backend tests
2. dashboard frontend build
3. survey frontend build
4. release bundle build/install
5. staging deploy and verification

**Production deployment gate:** manual workflow execution with production secrets and remote SSH/SCP steps.
**Production deployment gate:** manual workflow execution on internal self-hosted production runner.

**Pipeline definition files:**
- `.github/workflows/deploy-staging.yml`
- `.github/workflows/deploy-production.yml`
- `.github/workflows/backend-ci.yml`
- `.github/workflows/frontend-dashboard-ci.yml`
- `.github/workflows/frontend-survey-ci.yml`

---

## 14. Observability

**Health endpoints:**
- `GET /health`
- `GET /health/ready`

**Public monitored paths through nginx:**
- `GET /api/health`
- `GET /api/health/ready`

**Current observability host:**
- `cwscx-sql01` / `cwscx-sql01.cwsey.com` / `172.17.1.212`

**Current production baseline health state (2026-05-07):**
- `https://cwscx-app01.cwsey.com/api/health` returns healthy
- `https://cwscx-app01.cwsey.com/api/health/ready` returns healthy
- production DB port `5433` is reachable from observability VM
- production SPA routes respond over HTTPS
- authenticated dashboard/API calls are now working

**Current staging monitors:**
- `staging-api-health`
- `staging-api-ready`
- `staging-dashboard-route`
- `staging-b2b-route`
- `staging-installation-route`
- `staging-mystery-route`
- `staging-postgres-tcp`

**Current production monitors / connections completed so far:**
- production pgAdmin database connection is configured on the observability VM:
  - `production-cwscx-postgres`
- production Uptime Kuma monitoring is active for:
  - `https://cwscx-app01.cwsey.com/api/health`
  - `https://cwscx-app01.cwsey.com/api/health/ready`
  - `https://cwscx-app01.cwsey.com/dashboard/`
  - `https://cwscx-app01.cwsey.com/surveys/b2b/`
  - `https://cwscx-app01.cwsey.com/surveys/installation/`
  - `https://cwscx-app01.cwsey.com/surveys/mystery-shopper/`
  - PostgreSQL TCP reachability on `cwscx-app01.cwsey.com:5433`

**Alert routing:** email is currently configured and tested for down and recovery notifications. Teams notifications are deferred.

**Log aggregation:** not yet a full Prometheus/Grafana/Loki stack. Current state is:
- app/service logs on the target VM(s)
- Uptime Kuma monitoring on observability VM
- pgAdmin on observability VM

**What to check first when something is wrong:**
1. Uptime Kuma monitor status
2. `/api/health` and `/api/health/ready`
3. `systemctl status cwscx-backend`
4. `journalctl -u cwscx-backend`
5. pgAdmin or direct DB connectivity checks

---

## 15. Backup and Recovery

**What is backed up:**
- staging PostgreSQL logical dumps via `/opt/backups/postgres/backup.sh`
- observability VM data via `/backup/observability/` procedure documented in the observability README/guide

**What is NOT yet fully production-hardened:**
- production backup target and restore procedure are not yet finalized in this file
- centralized alert-triage and backup-freshness observability remain future work

**Disaster recovery procedure (current state):**
- staging DB restore guidance: `docs/deployment/postgres_migration.md`
- observability VM data archive guidance: `OBSERVABILITY_VM_README.md`
- production full-VM-loss runbook still needs to be completed before first live deployment

**Last DR drill date:** NEVER formally recorded for production. Staging operational backup verification exists, but a full documented production-grade DR drill is still outstanding.

---

## 16. Common Tasks (AI Agent Runbook)

### 16.1 Add a new API endpoint
1. identify whether it belongs under `backend/app/api/` or `backend/app/routers/`
2. add/update the route in the appropriate module
3. ensure auth dependencies are correct
4. add or update tests under `backend/tests/`
5. update docs if route changes operational behaviour

### 16.2 Add a new database table
1. add/update SQLAlchemy model
2. create Alembic migration in `backend/alembic/versions/`
3. inspect migration manually
4. verify upgrade path carefully
5. avoid runtime schema mutation in application request paths

### 16.3 Add a new environment variable
1. add it to `.env.example`
2. add it to `backend/app/core/settings.py` or the relevant frontend config path
3. update this file Section 10
4. update staging/prod VM env files manually

### 16.4 Add a new frontend page
1. identify the correct frontend app under `frontend/`
2. add route/page/component in that frontend only
3. preserve current base path and MSAL assumptions
4. run `npm run build` for that frontend before shipping

### 16.5 Add a new monitor to observability
1. use `DB_VM_SETUP_GUIDE.md`
2. use `OBSERVABILITY_VM_README.md`
3. create monitor in Uptime Kuma with clear environment-prefixed name
4. update observability docs if the monitor is now part of the standard estate

---

## 17. Known Limitations and Deferred Items

| Item | Why deferred | When to revisit |
|---|---|---|
| GitLab migration | GitHub is still the active source of truth | After GitLab infrastructure is ready |
| Full `/api/v1` contract alignment | current platform still uses `/api` base and mixed legacy routes | API normalization phase |
| Full Prometheus/Grafana/Loki observability | current observability is Uptime Kuma + pgAdmin only | later observability phase |
| Teams alert routing | email currently sufficient for initial rollout | when broader incident routing is needed |
| Centralized alert-triage platform | future DTO platform capability | after initial production cutover |

---

## 18. Risks and Risk Acceptance

| Risk | Impact | Likelihood | Mitigation | Accepted by | Date |
|---|---|---|---|---|---|
| Current app deviates from DTO target conventions (sync backend DB access, non-versioned API base, mixed JS/TS estate) | operational/documentation drift and harder inheritance | Medium | document clearly here and reduce incrementally | DTO Lead | 2026-05-06 |
| Production infrastructure details still incomplete | cutover risk if assumptions remain undocumented | High | complete Workstream 3 before go-live | DTO Lead | 2026-05-06 |
| Observability does not fully prove authenticated business flows | outages may still require manual smoke confirmation | Medium | keep health, route, DB, and manual smoke checks together | DTO Lead | 2026-05-06 |
| Production backups currently live on the same VM as the runtime | backup loss risk if the whole VM is lost | Medium | move backups to separate host/NAS/object storage as a follow-up hardening step | DTO Lead | 2026-05-07 |
| Production dataset still contains staging-derived data pending sanitisation | business/data integrity risk for first-use production state | High | sanitise data before operational handover and normal user onboarding | DTO Lead | 2026-05-07 |

---

## 19. Anti-Patterns

This platform inherits DTO-wide anti-patterns from `EXIT-CONVENTIONS.md`.

Additional platform-specific anti-patterns learned during current work:
1. do not run schema-changing SQL in request paths or startup convenience hooks
2. do not make frontend boot depend on slow optional profile endpoints like `/auth/me`
3. do not assume dashboard route reachability proves authenticated business functionality

---

## 20. Ownership and Escalation

| Role | Name | Contact | Backup contact |
|---|---|---|---|
| Application owner (business) | Not yet recorded | Not yet recorded | Not yet recorded |
| Technical owner (DTO Lead) | Gregory | Not yet recorded in this document | Not yet recorded in this document |
| Database owner | DTO / Infrastructure (current staging shared ownership) | Not yet recorded | Not yet recorded |
| Infrastructure escalation | IT / Infrastructure team | Not yet recorded | Not yet recorded |
| Security incidents | Not yet recorded | Not yet recorded | Not yet recorded |
| After-hours on-call | Not yet recorded | Not yet recorded | Not yet recorded |

**Escalation path:**
1. check Uptime Kuma / `/api/health` / `/api/health/ready`
2. inspect backend/nginx runtime state
3. inspect DB connectivity
4. escalate to DTO Lead if unresolved
5. escalate to Infrastructure for network/VM issues
6. escalate immediately per security policy for security incidents

---

## 21. Document Maintenance

**This file is updated when:**
- infrastructure/runtime changes
- deploy flow changes
- auth/role model changes
- backup/observability changes
- production cutover details are finalized

**This file is reviewed by:**
- DTO Lead during production readiness and quarterly review

**Version history:**

| Date | Author | Change summary |
|---|---|---|
| 2026-05-06 | OpenCode / Gregory collaboration | Initial populated current-state version for CWSCX staging-to-production preparation |
| 2026-05-07 | OpenCode / Gregory collaboration | Updated current state after first successful production infrastructure deployment and recorded remaining auth blocker |
| 2026-05-07 | OpenCode / Gregory collaboration | Updated current state after auth remediation, baseline production success, and production backup setup |
