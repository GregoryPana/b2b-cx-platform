# Platform Standard For Future Bespoke Applications

This document defines the default DTO standard for future internal bespoke applications.

If a team wants to deviate from this standard, the deviation must be documented and approved before build work starts.

## 1. Plain-language summary

For future internal applications, we want one repeatable way of building and operating systems.

That means:
- the same backend language and framework
- the same frontend stack
- the same Linux deployment shape
- the same authentication model
- the same reverse proxy pattern
- the same deployment approach
- the same documentation and templates

This reduces support burden, speeds up onboarding, and avoids each new application becoming a one-off platform.

## 2. Approved architecture

### Production

Each live application should have its own dedicated Linux production VM.

Practical note for the current DTO environment:
- this is the target standard, not a promise that a new VM exists immediately on demand
- today, DTO has limited VM capacity
- pre-production currently uses a shared VM model by design
- production VM provisioning requires an infrastructure request and approval cycle
- juniors and project leads should plan for lead time rather than assuming instant dedicated VM availability

Default runtime on that VM:
- NGINX for TLS termination and reverse proxy
- one Python backend process managed by `systemd`
- one or more frontend static builds served by NGINX
- one Docker Compose PostgreSQL runtime on the same VM unless a reviewed exception is approved

Why:
- simpler operational model
- easier debugging
- fewer moving parts for Tier 1 internal apps
- matches what proved workable in CWSCX

Important note:
- this is the standard for future Tier 1 internal apps
- if a specific project later needs split web/app/database tiers, that is an approved exception, not the default

### Pre-production

Use one shared Linux pre-production VM for:
- staging
- testing
- validation
- dry runs of deployment and rollback

Rules for the shared pre-production VM:
- each app must use separate folders, ports, and environment variables
- naming must stay consistent
- one app must not break another app's runtime
- pre-production is not a substitute for a dedicated production VM

### Optional shared observability VM

Recommended shared tooling:
- Uptime Kuma
- pgAdmin

This should be treated as a shared operations utility, not as the primary application runtime.

## 3. Approved technology stack

### Backend

- Language: Python
- API framework: FastAPI
- ORM / DB access: SQLAlchemy
- Migrations: Alembic
- App server: Uvicorn

### Frontend

- Language: TypeScript only
- Framework: React
- Build tool: Vite
- Styling: Tailwind CSS
- Component library: shadcn/ui

Frontend rules:
- no new JavaScript frontends
- no mixed JS and TS in new apps
- TypeScript strict mode should be enabled
- use a shared component approach where sensible

### Database

- Engine: PostgreSQL
- Runtime: Docker Compose on app VM by default
- Backup method: scheduled `pg_dump` or approved equivalent

### Edge and routing

- Reverse proxy: NGINX
- TLS termination: NGINX
- upstream app proxying: NGINX to local backend service

### Identity

- Authentication provider: Microsoft Entra ID
- Internal applications should use Entra sign-in and role-based authorization

### CI/CD and repo management

- Current standard: GitHub + GitHub Actions
- Future target: self-hosted GitLab CE + GitLab CI
- All workflows should be written so migration is straightforward later

## 4. Standard runtime pattern

### Recommended route map

Minimum route pattern:
- `/api/` -> backend
- `/health` or `/api/health` -> health endpoint
- `/health/ready` or `/api/health/ready` -> readiness endpoint

If the app has one SPA:
- `/` or `/app/` -> frontend

If the app has multiple SPAs:
- `/dashboard/` -> admin/dashboard SPA
- `/app/` or another explicit path -> end-user SPA
- use explicit path-based routing, not ambiguous mixed routing

### Recommended filesystem layout on VM

```text
/opt/<app-name>/
  backend/
  frontends-src/
  releases/
  scripts/
  shared/
  logs/
  docker-compose.yml
  .env

/opt/backups/<app-name>/
  daily/
  weekly/
  monthly/
```

### Service control pattern

- backend managed by `systemd`
- nginx managed by `systemd`
- database managed by Docker Compose

## 5. Non-negotiable engineering rules

### Rule 1: No runtime schema mutation in request paths

Never create, alter, or repair database schema inside normal API request handling.

Why:
- CWSCX hit operational risk here
- request-time schema logic can deadlock, fail unpredictably, and hide migration gaps

Correct pattern:
- schema changes only through reviewed Alembic migrations

### Rule 2: Migrations must be explicit and repeatable

- every schema change must have a migration
- deploy must run a reviewed migration command
- no hidden auto-create behavior in production
- migration chains must be tested on a clean database before relying on them

### Rule 3: Health endpoints are mandatory

Every new app must ship with:
- health endpoint
- readiness endpoint

At minimum they must verify:
- app process is running
- database connectivity is working

### Rule 4: Internal-only VMs deploy via self-hosted runners

Do not use public CI runners to SCP or SSH into internal-only servers.

Correct pattern:
- deploy job runs on a self-hosted runner inside the reachable network
- self-hosted runner workspace is forcibly cleaned and checked out to the exact triggering commit before build starts

### Rule 5: Staging and production deploys are manual by default

Do not auto-deploy to staging or production on every push unless a stricter release control process is approved.

Default trigger:
- manual dispatch

### Rule 6: Configuration must fail safely

Optional environment variables must not break the app when present but blank.

Why:
- CWSCX hit a production auth failure because a blank optional Entra URL was treated as a real URL

Required behavior:
- blank values are treated as unset where appropriate
- app startup validates required settings clearly

### Rule 7: Static assets must be deployed predictably

- frontend base paths must match NGINX route paths
- NGINX must serve the correct `dist/` folder
- cache handling must avoid stale shell HTML after release

## 6. Standard naming conventions

Use lowercase kebab-case for app names.

Examples:
- repo name: `customer-feedback-platform`
- VM folder: `/opt/customer-feedback-platform`
- service name: `customer-feedback-platform-backend`
- compose project: `customer-feedback-platform`
- backup path: `/opt/backups/customer-feedback-platform`

## 7. Standard environment model

### Production

- dedicated VM
- real internal DNS record
- real TLS cert or approved internal/self-signed cert
- real Entra app registration values
- production backup schedule
- production monitoring

### Pre-production

- shared VM
- environment-specific DNS/path
- separate `.env`
- separate database
- same deployment shape as production where possible

## 8. Security baseline

- secrets must not be committed to git
- `.env` on VM should be mode `600`
- runner users need only minimal required sudo access
- only required ports should be opened
- internal apps still require proper authentication and authorization
- backend authorization is authoritative, not frontend visibility

## 9. Observability baseline

Every new app should have:
- `/health`
- `/health/ready`
- Uptime Kuma monitors
- a user-facing status page if appropriate
- pgAdmin or approved DB admin path
- startup and auth error logs that are readable by support staff

## 10. Backup baseline

Before an app is considered production-ready:
- backups must be scheduled
- a manual backup must be tested
- restore-readiness must be checked
- retention folders must exist

Preferred baseline:
- daily backups
- weekly backups
- monthly backups

Important:
- a backup is not considered real until restore has been validated

## 11. What future apps should improve versus CWSCX

CWSCX provided good lessons. Future apps should improve on these points from the start:

- use TypeScript across all frontends from day one
- avoid mixed frontend patterns
- test migrations on a clean DB before first production use
- define Entra roles and redirect URLs before user testing starts
- ship monitoring and backup from the first deploy, not later
- prefer one clean repo standard and template from the beginning

## 12. Key institutional lessons from CWSCX

These lessons were expensive enough that they should be read early, not buried in later operations documents:

- internal-only deployments must use self-hosted runners inside the reachable network
- manual staging and production deploys are safer than automatic push-based deploys for this environment
- health and readiness endpoints must exist before go-live
- do not mutate schema from request-handling code
- blank optional auth settings must fail safely
- frontend base paths, static asset deployment, and cache behavior must be checked carefully to avoid stale UI problems
- restore-readiness matters as much as backup creation

## 13. Definition of done for architecture approval

A new app conforms to INTERNAL DEV KIT when:
- it uses the approved stack
- its environments follow the approved VM model
- it has documented routes, env vars, health checks, and backup plan
- it uses self-hosted deployment for internal environments
- its repo structure matches the standard
- its Entra integration follows the documented role and auth pattern
