# Workstream Tracker — DTO Platform Foundation and First Application Cutover

**Last updated:** 2026-05-05
**Owner:** DTO Lead (Gregory)

This tracker covers four parallel workstreams. Workstream 3 (production cutover) is gated by completion of Workstreams 1 and 2. Workstream 4 is independent.

**Status legend:**

- `[ ]` Not started
- `[~]` In progress
- `[x]` Complete
- `[!]` Blocked

---

## Workstream 1 — Documentation Lock-In

**Goal:** EXIT-CONVENTIONS.md and EXIT.md template adopted as DTO standards before first production cutover.
**Owner:** DTO Lead
**Target completion:** Before Workstream 3 begins

### 1.1 Resolve `[DTO LEAD CONFIRM]` decisions in EXIT-CONVENTIONS.md

| Task                                                            | Status | Decision Recorded |
| --------------------------------------------------------------- | ------ | ----------------- |
| Section 1.4 — Security patch SLA window for HIGH/CRITICAL CVEs | [ ]    |                   |
| Section 2.4 — Conventional Commits as commit format (yes/no)   | [ ]    |                   |
| Section 2.5 — Squash vs rebase vs merge commits                | [ ]    |                   |
| Section 2.6 — Repository licence policy                        | [ ]    |                   |
| Section 3.1 — Python line length (88, 100, 120)                | [ ]    |                   |
| Section 3.5 — Docstring style (Google, NumPy, reST)            | [ ]    |                   |
| Section 5 — JSON field naming (snake_case vs camelCase)        | [ ]    |                   |
| Section 11.2 — Certificate management approach                 | [ ]    |                   |

**Verification:** All eight items resolved. Section 17.5 of EXIT-CONVENTIONS.md updated with decisions and confirmation date. Section 17.4 version history entry added.

### 1.2 Decide where the documents live

- [ ] Decision made: separate platform repo / first app repo / wait for GitLab
- [ ] If new repo: created on GitHub with name `cws-dto-platform` (or chosen alternative)
- [ ] EXIT-CONVENTIONS.md committed to chosen location
- [ ] EXIT.md template committed to chosen location
- [ ] Read access granted to all DTO team members

**Verification:** Both files accessible at a stable, documented URL referenceable from any application repository.

### 1.3 Slim down EXIT.md template to reference EXIT-CONVENTIONS.md

- [ ] EXIT.md Section 7 (Coding Conventions) replaced with reference and deviations placeholder
- [ ] EXIT.md Section 11 (API Conventions) replaced with reference and deviations placeholder
- [ ] EXIT.md Section 19 (Anti-Patterns) replaced with reference and application-specific placeholder
- [ ] Slimmed template committed alongside EXIT-CONVENTIONS.md

**Verification:** Per-application EXIT.md is materially shorter and references EXIT-CONVENTIONS.md for inherited content.

### 1.4 Brief the DTO team

- [ ] 30-minute walkthrough session scheduled with both juniors
- [ ] Session covers: purpose of both documents, non-negotiable sections, anti-patterns, EXIT.md as Definition of Done
- [ ] Acknowledgement recorded — both juniors confirm understanding
- [ ] EXIT-CONVENTIONS.md and EXIT.md added to onboarding runbook for any future DTO hires

**Verification:** Junior team members can articulate the difference between DTO-wide conventions and application-specific deviations.

---

## Workstream 2 — DB VM as Interim Observability Host

**Goal:** Uptime Kuma and pgAdmin operational on DB VM, monitoring staging application before production cutover.
**Owner:** DTO Lead
**Target completion:** Before Workstream 3 begins
**Runs in parallel with:** Workstream 1

### 2.1 Pre-flight checks on DB VM

- [X] SSH access confirmed for DTO Lead
- [X] Hostname and internal IP recorded in DTO infrastructure documentation
- [X] Ubuntu version confirmed (24.04 LTS)
- [X] Disk space confirmed sufficient (minimum 50 GB free)
- [ ] Internal DNS records: `monitoring.cws.internal` and `pgadmin.cws.internal` requested (or alternative naming) and provisioned
- [X] Firewall rules confirmed: inbound 3001 (Uptime Kuma) and 5050 (pgAdmin) from internal network only
- [X] Outbound connectivity from DB VM to staging VM on port 5433 (Postgres) confirmed via `nc -zv`
- [X] Outbound connectivity from DB VM to staging VM on port 80/443 (HTTP) confirmed
- [X] Outbound connectivity from DB VM to SMTP relay (for email alerts) confirmed
- [ ] Outbound connectivity from DB VM to Microsoft Teams webhook URL confirmed (if Teams alerting used)

### 2.2 Software prerequisites

- [X] Docker Engine installed (version recorded)
- [X] Docker Compose v2 plugin installed and confirmed (`docker compose version`)
- [ ] User `dto-ops` (or chosen service user) created and added to `docker` group
- [X] System time synchronised (NTP/chrony confirmed running)
- [X] Timezone switched to `Indian/Mahe`

### 2.3 Application code changes (separate workstream — see HEALTH_ENDPOINT_SPEC.md)

- [X] Specification provided to AI agent working on application codebase
- [X] AI agent confirms current state of health endpoint (exists / does not exist / partial)
- [X] `/health` implemented per current no-versioning contract and exposed publicly as `/api/health`
- [X] `/health/ready` readiness alias implemented and exposed publicly as `/api/health/ready`
- [X] Endpoint changes committed and pushed for staging deploy

- [~] Endpoint validation from observability VM in progress

- [X] Endpoint accessible without authentication

### 2.4 Deploy Uptime Kuma and pgAdmin

- [X] observability working directory created on DB VM with appropriate ownership
- [X] `docker-compose.yml` placed (per setup guide)
- [X] `.env` file created with non-default credentials for pgAdmin
- [X] Persistent volume directories created and ownership set
- [X] `docker compose up -d` executed
- [X] Both containers reach healthy state
- [X] Logs reviewed for errors: `docker compose logs --tail=100`

### 2.5 Uptime Kuma initial configuration

- [X] Web UI accessed via internal network
- [X] Initial admin account created (strong password, recorded in secret store)
- [X] First monitor created: staging application `/api/health`
  - [X] Monitor type: HTTP(s)
  - [X] URL configured
  - [X] Method: GET
  - [X] Expected status code: 200
  - [X] Heartbeat interval: 60 seconds
  - [X] Retry on failure: 3
  - [X] Request timeout: 10 seconds
- [X] Second monitor created: staging application `/api/health/ready`
- [X] Frontend route monitors created for all four SPA paths
- [X] Notification channel configured: email
- [X] Notification channel attached to staging monitor
- [X] Status page created (optional but recommended): displays staging app status

### 2.6 Uptime Kuma alert validation

- [X] Kill test: stop staging application container, observe Uptime Kuma transitions to DOWN within 3 minutes
- [X] Down notification received via configured channel
- [X] Recovery test: restart staging application container, observe Uptime Kuma transitions to UP
- [X] Recovery notification received
- [X] Test results documented (2026-05-06, 08:55 AM)

### 2.7 pgAdmin initial configuration

- [X] Web UI accessed via internal network
- [X] Login with credentials from `.env`
- [X] Master password set (recorded in secret store)
- [X] First server connection created: staging Postgres
  - [X] Hostname/IP: `172.17.1.213`
  - [X] Port: `5433`
  - [X] Database: `cwscx-postgres`
  - [X] Username: `cxadmin` (current staging credential)
  - [X] Connection saved with name: `staging-cwscx-postgres`
- [X] Test query executed successfully: `SELECT current_database(), current_user;`
- [X] Decision made on existing pgAdmin on staging VM: keep as fallback

### 2.8 Operational documentation

- [X] `/opt/observability/README.md` written covering:
  - [X] What runs on this VM
  - [X] How to access each tool
  - [X] How to add a new monitor when production app comes up
  - [X] How to add a new pgAdmin server connection
  - [X] Backup procedure for `/opt/observability/data/`
- [X] Backup script for Uptime Kuma and pgAdmin volumes scheduled (cron or systemd timer)
- [X] First backup run successfully and verified

### 2.9 Current progress note

- [X] Uptime Kuma installed on observability VM
- [X] pgAdmin installed on observability VM
- [X] First staging monitor for `/api/health` created in Kuma
- [X] Staging readiness monitor for `/api/health/ready` created in Kuma
- [X] Frontend route monitors created for all four SPA paths
- [X] Email notification configured and validated for down and recovery alerts
- [X] pgAdmin master password set and staging database connection verified
- [X] Observability VM README created on the VM
- [~] Continue from next practical step:
  - confirm DNS naming decision for observability URLs
  - decide whether to add Teams notifications in addition to email

**Verification:** Staging application monitoring is live, alert routing tested end-to-end, pgAdmin successfully querying staging database.

---

## Workstream 3 — First Application Production Cutover

**Goal:** First application moved from staging to Application Frontend VM, monitored by DB VM tooling, EXIT.md complete.
**Owner:** DTO Lead
**Target completion:** After Workstreams 1 and 2 complete
**Blocked by:** Workstream 1 completion + Workstream 2 completion

### 3.1 EXIT.md production readiness gate

- [X] EXIT.md template (slimmed version per Workstream 1.3) copied into application repository
- [X] All `{{PLACEHOLDER}}` markers replaced with real values
- [X] All `[FILL: ...]` markers resolved with content
- [X] HTML comment instruction blocks removed from final version
- [X] Section 1 — Application overview and purpose complete
- [X] Section 2 — Tier classification confirmed (Tier 1) with rationale
- [X] Section 3 — Architecture diagram present
- [X] Section 4 — VM assignments accurate (Application Frontend VM as production)
- [X] Section 5 — Technology stack with exact pinned versions
- [X] Section 6 — Codebase structure documented
- [X] Section 8 — Database backup schedule and **tested** restore procedure
- [X] Section 10 — All environment variables documented with sensitivity classification
- [X] Section 12 — Build, test, deploy commands accurate
- [X] Section 13 — Current CI/CD state documented (GitHub Actions, transition plan to GitLab noted)
- [X] Section 14 — Observability: Uptime Kuma monitor URL, pgAdmin connection name
- [X] Section 15 — Backup procedure with last successful test date
- [X] Section 16 — Common Tasks runbook completed for at least: add API endpoint, add DB table, add env var
- [X] Section 17 — Deferred items listed (full observability stack, GitLab CI/CD)
- [X] Section 18 — Risks documented and accepted by DTO Lead
- [ ] Section 20 — Ownership and escalation contacts populated
- [ ] EXIT.md committed to application repository root
- [ ] DTO Lead review and sign-off on EXIT.md

### 3.2 Application Frontend VM preparation

- [X] Docker Engine and Compose v2 installed and version recorded
- [ ] Service user `app-svc` (or chosen name) created, non-root, in `docker` group
- [X] Directory structure created: `/opt/{app_name}/{compose,data,logs,backups}`
- [ ] Internal DNS record `{app_name}.cws.internal` pointing to Application Frontend VM
- [X] TLS certificate provisioned (internal CA / Let's Encrypt / self-signed per current standard)
- [X] NGINX configuration prepared for TLS termination + reverse proxy
- [ ] Firewall rules confirmed:
  - [X] Inbound 443 from internal network only
  - [ ] Outbound to Entra ID OIDC endpoints
  - [ ] Outbound to internal SMTP relay (if app sends email)
  - [ ] No other egress
- [X] Production `.env` file placed at `/opt/{app_name}/.env`, mode 600, owned by service user
- [ ] All secrets in `.env` confirmed not present anywhere in git history
- [X] Self-hosted production GitHub Actions runner installed and online with `production` label

### 3.3 Database preparation

- [X] PostgreSQL container configuration matches staging (version, extensions, locale)
- [X] Backup tool configured (pg_dump cron / staging-style local pattern)
- [!] Backup destination confirmed (NOT the same VM)
- [X] Backup schedule active and verified with first successful run
- [X] Restore procedure tested at least once before relying on it
- [X] Restore test result recorded in EXIT.md Section 8

### 3.4 Cutover execution

- [ ] Maintenance window communicated to users (if applicable)
- [X] Final staging Postgres backup taken
- [X] Backup transferred to Application Frontend VM
- [X] Database restored on Application Frontend VM
- [X] Application started: `docker compose up -d`
- [X] All containers reach healthy state
- [ ] Smoke tests executed:
  - [X] Application loads
  - [X] Authentication works (Entra ID redirect successful)
  - [X] Critical user paths exercised (list specific paths in EXIT.md)
  - [X] Database queries return expected data
- [X] DNS confirmed resolving correctly
- [X] TLS certificate valid and trusted by internal browsers

### 3.4.1 Production data baseline sanitisation

- [X] Fresh pre-sanitisation production backup taken
- [X] Production transactional data cleared
- [X] Reference/configuration tables preserved
- [X] Legacy B2B response rows confirmed cleared
- [X] Post-sanitisation verification query completed successfully
- [X] Production baseline now reflects a clean first-use data state

### 3.5 Production monitoring activation

- [X] Uptime Kuma — production monitor added for `https://cwscx-app01.cwsey.com/api/health`
- [X] Production monitor configured with same intervals and retries as staging
- [X] Notification channel attached to production monitor
- [X] Production SPA route monitors added
- [X] Production database TCP monitor added
- [X] pgAdmin — production server connection added on DB VM
- [X] Connection name: `production-cwscx-postgres`
- [X] Test query executed successfully on production
- [ ] Kill-test on production after deployment confirms alert routing works
- [X] Production status page created in Uptime Kuma

### 3.6 Post-cutover validation (24 hours)

- [ ] Uptime Kuma dashboard reviewed every 4 hours during first 24 hours
- [ ] No unexpected DOWN events
- [ ] Container logs reviewed for errors at 4h, 12h, 24h intervals
- [ ] Database connection count and query patterns within expected ranges (pgAdmin)
- [ ] First scheduled backup confirmed successful
- [ ] Resource usage (CPU, memory, disk) within expected ranges

### 3.7 Communication and closure

- [ ] Go-live communicated to application users
- [X] DTO team notified that production monitoring is active
- [X] User-facing production URL and troubleshooting message prepared
- [ ] Risk register updated with any new observations
- [X] EXIT.md Section 21 version history updated with go-live date
- [ ] Lessons learned captured for second application cutover

**Verification:** Application stable in production for 24 hours, monitoring functioning, EXIT.md current.

**Current note:** Production infrastructure deployment succeeded on 2026-05-07, health endpoints are healthy, SPA routes are reachable, authenticated dashboard/API flows are working, database connectivity from the observability VM works, production local DB backup is configured and verified, the production data set has been sanitised to a clean first-use baseline, and production Uptime Kuma monitoring is active for backend, SPA routes, and database reachability. Remaining hardening step: move production backups off the same VM when infrastructure permits.

---

## Workstream 4 — Repository Governance Migration

**Goal:** All CWS bespoke code on CWS-controlled infrastructure (GitLab self-hosted), migrated cleanly from current GitHub state.
**Owner:** DTO Lead
**Target completion:** Dependent on GitLab VM provisioning
**Runs in parallel with:** All other workstreams (preparation can start now)

### 4.1 GitHub state audit (can start now)

- [ ] Inventory of every CWS-related repository compiled
  - [ ] Personal account repositories listed
  - [ ] Organisation-email-linked personal account repositories listed
  - [ ] Organisation account repositories listed
- [ ] For each personal-account repository: ownership transfer to CWS organisation account initiated
- [ ] For each repository: secret scan of full commit history
  - [ ] Tool used: `gitleaks` or `truffleHog` (record which)
  - [ ] Findings documented per repository
  - [ ] All identified secrets rotated regardless of when committed
  - [ ] Secret scan results retained as evidence
- [ ] For each repository: confirm `.env`, `*.key`, `*.pem`, `secrets/` patterns in `.gitignore`
- [ ] For each repository: confirm no current `.env` file is tracked

### 4.2 Repository standardisation against EXIT-CONVENTIONS.md

For each existing repository:

- [ ] README.md present and current
- [ ] EXIT.md present (minimum viable — full version per Workstream 3 pattern)
- [ ] `.env.example` documents every environment variable
- [ ] Pre-commit hooks installed: `detect-secrets` or `gitleaks`
- [ ] Linting and formatting tools configured per EXIT-CONVENTIONS Section 3 and 4
- [ ] CI pipeline updated to enforce conventions

### 4.3 GitLab provisioning (blocked on infrastructure)

- [ ] GitLab VM provisioning ticket raised with IT
- [ ] VM provisioned per spec (8 vCPU / 16 GB RAM / 500 GB SSD, Ubuntu 24.04 LTS)
- [ ] Internal DNS record `gitlab.cws.internal` provisioned
- [ ] TLS certificate provisioned
- [ ] GitLab CE installed (Omnibus package)
- [ ] Initial admin password set, recorded in secret store
- [ ] SMTP configured for notifications
- [ ] Backup configured (`gitlab-backup create` scheduled)

### 4.4 GitLab Entra ID integration

- [ ] Entra ID application registration created
- [ ] OIDC configuration applied to GitLab
- [ ] First test user successfully authenticates via Entra ID
- [ ] Group-to-role mapping configured
- [ ] Local account creation disabled (Entra ID only)

### 4.5 Self-hosted runner migration

- [ ] Inventory of existing self-hosted runners on GitHub Actions
- [ ] Runner registration tokens generated in GitLab
- [ ] Runners re-registered against GitLab (one runner can serve both during transition)
- [ ] Runner connectivity validated against GitLab

### 4.6 Pilot repository migration

- [ ] Smallest, lowest-risk repository selected as pilot
- [ ] Repository pushed to GitLab via `git remote add` and `git push`
- [ ] GitHub Actions workflows translated to GitLab CI YAML
- [ ] Pipeline runs successfully end-to-end on GitLab
- [ ] Lessons documented for subsequent migrations

### 4.7 Bulk migration

- [ ] Migration order defined (small to large, low-risk to high-risk)
- [ ] For each repository: migrate code, translate pipelines, validate, archive on GitHub
- [ ] EXIT.md files updated to reflect new repository URL
- [ ] Personal GitHub accounts: all CWS code removed, accounts disconnected from CWS work

### 4.8 GitHub decommissioning

- [ ] All organisation repositories archived (preserved, not deleted)
- [ ] Self-hosted runner registrations removed from GitHub
- [ ] EXIT-CONVENTIONS.md Section 2.1 updated to reflect GitLab as current state
- [ ] Communication to all DTO team that GitHub is read-only / deprecated

**Verification:** Zero CWS bespoke code remains on personal accounts. All active development happens on GitLab. GitHub repositories preserved for audit history only.

---

## Cross-Workstream Dependencies

```
Workstream 1 ──┐
               ├──> Workstream 3 ──> First production deployment
Workstream 2 ──┘

Workstream 4 — independent (parallel)
```

---

## Quarterly Review

- [ ] All four workstreams reviewed at the next DTO quarterly review
- [ ] Any tasks still incomplete: re-prioritised, re-scoped, or escalated
- [ ] EXIT-CONVENTIONS.md reviewed for needed updates per Section 17.2
