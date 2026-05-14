# INTERNAL DEV KIT Tracker

**Owner:** Gregory Panagary, Digital Transformation Engineer
**Contact:** `gregory.panagary@cwseychelles.com`
**Purpose:** Track creation, review, and handover readiness for the INTERNAL DEV KIT standards pack.

## Status legend

- `[ ]` Not started
- `[~]` In progress
- `[x]` Complete

## Document tracker

| Document | Purpose | Status | Review notes |
|---|---|---:|---|
| `README.md` | entry point and navigation | [x] | reviewed against CWSCX lessons |
| `01_PLATFORM_STANDARD.md` | architecture, stack, environment, and standards baseline | [x] | reviewed against CWSCX lessons |
| `02_CICD_AND_REPO_STANDARD.md` | GitHub now, GitLab CE later | [x] | reviewed against CWSCX lessons |
| `03_NGINX_REVERSE_PROXY_GUIDE.md` | NGINX setup, routing, TLS, headers, upstreams | [x] | reviewed against CWSCX lessons |
| `04_DOCKER_COMPOSE_STANDARD.md` | Compose standard, networking, health checks, env injection | [x] | reviewed against CWSCX lessons |
| `05_REPOSITORY_STRUCTURE_STANDARD.md` | repo layout, conventions, templates, examples | [x] | reviewed against CWSCX lessons |
| `06_ENTRA_ID_INTEGRATION_GUIDE.md` | Entra registration and app integration | [x] | reviewed against CWSCX lessons |
| `07_DEVELOPER_ONBOARDING_GUIDE.md` | onboarding and first-run walkthrough | [x] | reviewed against CWSCX lessons |
| `08_OPERATIONS_AND_HANDOVER_CHECKLISTS.md` | readiness, backup, observability, handover | [x] | reviewed against CWSCX lessons |
| `EXIT_TEMPLATE.md` | repo-root application handover template | [x] | created and aligned with Entra and handover guidance |
| `templates/nginx/app.conf.template` | NGINX site template | [x] | reviewed against CWSCX lessons |
| `templates/docker/docker-compose.app-vm.yml` | Compose starter template | [x] | reviewed against CWSCX lessons |
| `templates/systemd/backend.service.template` | backend service template | [x] | reviewed against CWSCX lessons |
| `templates/repository/.gitignore.template` | repo ignore baseline | [x] | reviewed against CWSCX lessons |
| `templates/repository/.env.example.template` | env example baseline | [x] | reviewed against CWSCX lessons |
| `templates/repository/README_TEMPLATE.md` | repo readme template | [x] | reviewed against CWSCX lessons |
| `templates/github/workflows/deploy-staging.yml.template` | current staging deploy template | [x] | reviewed against CWSCX lessons |
| `templates/github/workflows/deploy-production.yml.template` | current production deploy template | [x] | reviewed against CWSCX lessons |
| `templates/gitlab/.gitlab-ci.yml.template` | future GitLab CE starter | [x] | reviewed against CWSCX lessons |

## Lessons explicitly carried over from CWSCX

- [x] internal self-hosted runner model captured
- [x] manual staging/production deployment rule captured
- [x] path-based NGINX routing captured
- [x] static frontend plus `systemd` backend runtime captured
- [x] Docker Compose PostgreSQL runtime captured
- [x] health/readiness endpoints captured
- [x] migration safety and no runtime schema mutation captured
- [x] Entra config failure modes captured
- [x] backup, restore, and observability requirements captured
- [x] troubleshooting guidance included for beginners

## Review checklist

- [x] each document uses the same standard architecture assumptions
- [x] templates align with the written guides
- [x] GitHub current-state guidance matches what CWSCX now uses
- [x] GitLab CE future-state guidance does not conflict with current GitHub flow
- [x] Entra guide includes roles, redirects, assignments, and troubleshooting
- [x] operational guidance includes backup verification and monitoring
- [x] beginner-focused step-by-step instructions are present where needed
- [x] self-hosted runner workspace hardening is captured in docs and templates
- [x] auth bootstrap guidance avoids mandatory `/auth/me` dependency

## Final handover condition

INTERNAL DEV KIT is handover-ready when:
- all document tracker rows are `[x]`
- all review checklist rows are `[x]`
- no template contradicts the approved platform standard
