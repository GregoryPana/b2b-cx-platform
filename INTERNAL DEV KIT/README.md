# INTERNAL DEV KIT

INTERNAL DEV KIT is the standard foundation pack for future bespoke internal applications.

It is based on what was proven, fixed, and documented during the first CWSCX production rollout.

Use this folder when:
- starting a new bespoke internal application
- reviewing whether a new app matches DTO standards
- onboarding a developer or operator
- preparing a Linux VM deployment
- setting up Entra ID auth for an internal app

## What is inside

- `TRACKER.md`
  - progress tracker for this documentation pack
- `01_PLATFORM_STANDARD.md`
  - the approved architecture, stack, and non-negotiable standards
- `02_CICD_AND_REPO_STANDARD.md`
  - current GitHub model and future GitLab CE target model
- `03_NGINX_REVERSE_PROXY_GUIDE.md`
  - step-by-step NGINX reverse proxy guide with template and troubleshooting
- `04_DOCKER_COMPOSE_STANDARD.md`
  - Docker Compose standard for app VM services and operations
- `05_REPOSITORY_STRUCTURE_STANDARD.md`
  - repo layout, folder conventions, `.gitignore`, `.env.example`, and `README` guidance
- `06_ENTRA_ID_INTEGRATION_GUIDE.md`
  - app registration, roles, redirect URLs, assignments, frontend/backend integration, and troubleshooting
- `07_DEVELOPER_ONBOARDING_GUIDE.md`
  - prerequisites, local setup, first run, and support path
- `08_OPERATIONS_AND_HANDOVER_CHECKLISTS.md`
  - operational readiness, go-live, monitoring, backup, and handover checklists
- `EXIT_TEMPLATE.md`
  - the separate repo-root `EXIT.md` template to copy into each application repository
- `templates/`
  - reusable starter templates

## Core direction

Future bespoke internal applications should standardise on:
- Linux-based dedicated production VM per live application
- shared pre-production VM for staging, testing, and validation
- Python backend with FastAPI, SQLAlchemy, Alembic, and PostgreSQL
- TypeScript-only frontend with React, Vite, Tailwind CSS, and shadcn/ui
- NGINX reverse proxy with TLS termination
- backend managed by `systemd`
- database runtime in Docker Compose on the VM unless a reviewed exception is approved
- GitHub Actions now, with structure ready to migrate to self-hosted GitLab CE later
- Microsoft Entra ID for internal authentication and role-based access

This future standard intentionally prefers a simpler single production app VM pattern for Tier 1 internal applications.
If an older document mentions a split `web VM + app VM + database VM` target, treat that as project-specific or historical unless a new exception is approved.

## Important lessons captured from CWSCX

- internal-only VMs must deploy using self-hosted runners, not public SSH/SCP jobs
- deployment should be manual for staging and production unless a stricter release process is approved
- database migrations must be explicit, reviewed, and never triggered indirectly by request handling
- health and readiness endpoints must exist from the start
- static frontend paths, API routing, and no-cache handling must be consistent to avoid stale deployments
- Entra configuration must fail safely when optional values are blank or omitted
- backup and restore must be proven, not assumed
- status monitoring and a user-facing status page should be part of the operating baseline

## Recommended order for a new app

1. Read `01_PLATFORM_STANDARD.md`
2. Copy the templates from `templates/`
3. Apply `05_REPOSITORY_STRUCTURE_STANDARD.md`
4. Configure Entra using `06_ENTRA_ID_INTEGRATION_GUIDE.md`
5. Prepare VM/runtime using `03_NGINX_REVERSE_PROXY_GUIDE.md` and `04_DOCKER_COMPOSE_STANDARD.md`
6. Set up CI/CD using `02_CICD_AND_REPO_STANDARD.md`
7. Onboard the team with `07_DEVELOPER_ONBOARDING_GUIDE.md`
8. Copy `EXIT_TEMPLATE.md` to the new repository root as `EXIT.md`
9. Validate go-live readiness with `08_OPERATIONS_AND_HANDOVER_CHECKLISTS.md`
