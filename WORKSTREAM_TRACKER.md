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

| Task | Status | Decision Recorded |
|---|---|---|
| Section 1.4 — Security patch SLA window for HIGH/CRITICAL CVEs | [ ] | |
| Section 2.4 — Conventional Commits as commit format (yes/no) | [ ] | |
| Section 2.5 — Squash vs rebase vs merge commits | [ ] | |
| Section 2.6 — Repository licence policy | [ ] | |
| Section 3.1 — Python line length (88, 100, 120) | [ ] | |
| Section 3.5 — Docstring style (Google, NumPy, reST) | [ ] | |
| Section 5 — JSON field naming (snake_case vs camelCase) | [ ] | |
| Section 11.2 — Certificate management approach | [ ] | |

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

- [x] SSH access confirmed for DTO Lead
- [x] Hostname and internal IP recorded in DTO infrastructure documentation
- [x] Ubuntu version confirmed (24.04 LTS)
- [ ] Disk space confirmed sufficient (minimum 50 GB free)
- [ ] Internal DNS records: `monitoring.cws.internal` and `pgadmin.cws.internal` requested (or alternative naming) and provisioned
- [ ] Firewall rules confirmed: inbound 3001 (Uptime Kuma) and 5050 (pgAdmin) from internal network only
- [x] Outbound connectivity from DB VM to staging VM on port 5433 (Postgres) confirmed via `nc -zv`
- [x] Outbound connectivity from DB VM to staging VM on port 80/443 (HTTP) confirmed
- [ ] Outbound connectivity from DB VM to SMTP relay (for email alerts) confirmed
- [ ] Outbound connectivity from DB VM to Microsoft Teams webhook URL confirmed (if Teams alerting used)

### 2.2 Software prerequisites

- [x] Docker Engine installed (version recorded)
- [x] Docker Compose v2 plugin installed and confirmed (`docker compose version`)
- [ ] User `dto-ops` (or chosen service user) created and added to `docker` group
- [x] System time synchronised (NTP/chrony confirmed running)
- [ ] Timezone switched to `Indian/Mahe`

### 2.3 Application code changes (separate workstream — see HEALTH_ENDPOINT_SPEC.md)

- [x] Specification provided to AI agent working on application codebase
- [x] AI agent confirms current state of health endpoint (exists / does not exist / partial)
- [x] `/health` implemented per current no-versioning contract and exposed publicly as `/api/health`
- [x] `/health/ready` readiness alias implemented and exposed publicly as `/api/health/ready`
- [x] Endpoint changes committed and pushed for staging deploy
- [~] Endpoint validation from observability VM in progress
- [x] Endpoint accessible without authentication

### 2.4 Deploy Uptime Kuma and pgAdmin

- [x] observability working directory created on DB VM with appropriate ownership
- [x] `docker-compose.yml` placed (per setup guide)
- [x] `.env` file created with non-default credentials for pgAdmin
- [x] Persistent volume directories created and ownership set
- [x] `docker compose up -d` executed
- [x] Both containers reach healthy state
- [x] Logs reviewed for errors: `docker compose logs --tail=100`

### 2.5 Uptime Kuma initial configuration

- [x] Web UI accessed via internal network
- [x] Initial admin account created (strong password, recorded in secret store)
- [x] First monitor created: staging application `/api/health`
  - [x] Monitor type: HTTP(s)
  - [x] URL configured
  - [x] Method: GET
  - [x] Expected status code: 200
  - [x] Heartbeat interval: 60 seconds
  - [x] Retry on failure: 3
  - [x] Request timeout: 10 seconds
- [ ] Second monitor created: staging application `/api/health/ready`
- [ ] Frontend route monitors created for all four SPA paths
- [ ] Notification channel configured: email or Teams webhook
- [ ] Notification channel attached to staging monitor
- [ ] Status page created (optional but recommended): displays staging app status

### 2.6 Uptime Kuma alert validation

- [ ] Kill test: stop staging application container, observe Uptime Kuma transitions to DOWN within 3 minutes
- [ ] Down notification received via configured channel
- [ ] Recovery test: restart staging application container, observe Uptime Kuma transitions to UP
- [ ] Recovery notification received
- [ ] Test results documented (date, observed times)

### 2.7 pgAdmin initial configuration

- [ ] Web UI accessed via internal network
- [ ] Login with credentials from `.env`
- [ ] Master password set (recorded in secret store)
- [ ] First server connection created: staging Postgres
  - [ ] Hostname/IP: `172.17.1.213`
  - [ ] Port: `5433`
  - [ ] Database: `cwscx-postgres`
  - [ ] Username: `cxadmin` (current staging credential)
  - [ ] Connection saved with name: `staging-cwscx-postgres`
- [ ] Test query executed successfully: `SELECT current_database(), current_user;`
- [ ] Decision made on existing pgAdmin on staging VM: remove / keep as fallback / leave unchanged

### 2.8 Operational documentation

- [ ] `/opt/observability/README.md` written covering:
  - [ ] What runs on this VM
  - [ ] How to access each tool
  - [ ] How to add a new monitor when production app comes up
  - [ ] How to add a new pgAdmin server connection
  - [ ] Backup procedure for `/opt/observability/data/`
- [ ] Backup script for Uptime Kuma and pgAdmin volumes scheduled (cron or systemd timer)
- [ ] First backup run successfully and verified

### 2.9 Current progress note

- [x] Uptime Kuma installed on observability VM
- [x] pgAdmin installed on observability VM
- [x] First staging monitor for `/api/health` created in Kuma
- [ ] Continue from next practical step:
  - create `/api/health/ready` monitor
  - create frontend route monitors
  - complete pgAdmin first login and register the staging PostgreSQL server

**Verification:** Staging application monitoring is live, alert routing tested end-to-end, pgAdmin successfully querying staging database.

---

## Workstream 3 — First Application Production Cutover

**Goal:** First application moved from staging to Application Frontend VM, monitored by DB VM tooling, EXIT.md complete.
**Owner:** DTO Lead
**Target completion:** After Workstreams 1 and 2 complete
**Blocked by:** Workstream 1 completion + Workstream 2 completion

### 3.1 EXIT.md production readiness gate

- [ ] EXIT.md template (slimmed version per Workstream 1.3) copied into application repository
- [ ] All `{{PLACEHOLDER}}` markers replaced with real values
- [ ] All `[FILL: ...]` markers resolved with content
- [ ] HTML comment instruction blocks removed from final version
- [ ] Section 1 — Application overview and purpose complete
- [ ] Section 2 — Tier classification confirmed (Tier 1) with rationale
- [ ] Section 3 — Architecture diagram present
- [ ] Section 4 — VM assignments accurate (Application Frontend VM as production)
- [ ] Section 5 — Technology stack with exact pinned versions
- [ ] Section 6 — Codebase structure documented
- [ ] Section 8 — Database backup schedule and **tested** restore procedure
- [ ] Section 10 — All environment variables documented with sensitivity classification
- [ ] Section 12 — Build, test, deploy commands accurate
- [ ] Section 13 — Current CI/CD state documented (GitHub Actions, transition plan to GitLab noted)
- [ ] Section 14 — Observability: Uptime Kuma monitor URL, pgAdmin connection name
- [ ] Section 15 — Backup procedure with last successful test date
- [ ] Section 16 — Common Tasks runbook completed for at least: add API endpoint, add DB table, add env var
- [ ] Section 17 — Deferred items listed (full observability stack, GitLab CI/CD)
- [ ] Section 18 — Risks documented and accepted by DTO Lead
- [ ] Section 20 — Ownership and escalation contacts populated
- [ ] EXIT.md committed to application repository root
- [ ] DTO Lead review and sign-off on EXIT.md

### 3.2 Application Frontend VM preparation

- [ ] Docker Engine and Compose v2 installed and version recorded
- [ ] Service user `app-svc` (or chosen name) created, non-root, in `docker` group
- [ ] Directory structure created: `/opt/{app_name}/{compose,data,logs,backups}`
- [ ] Internal DNS record `{app_name}.cws.internal` pointing to Application Frontend VM
- [ ] TLS certificate provisioned (internal CA / Let's Encrypt / self-signed per current standard)
- [ ] NGINX configuration prepared for TLS termination + reverse proxy
- [ ] Firewall rules confirmed:
  - [ ] Inbound 443 from internal network only
  - [ ] Outbound to Entra ID OIDC endpoints
  - [ ] Outbound to internal SMTP relay (if app sends email)
  - [ ] No other egress
- [ ] Production `.env` file placed at `/opt/{app_name}/.env`, mode 600, owned by service user
- [ ] All secrets in `.env` confirmed not present anywhere in git history

### 3.3 Database preparation

- [ ] PostgreSQL container configuration matches staging (version, extensions, locale)
- [ ] Backup tool configured (pgBackRest or pg_dump cron)
- [ ] Backup destination confirmed (NOT the same VM)
- [ ] Backup schedule active and verified with first successful run
- [ ] Restore procedure tested at least once before relying on it
- [ ] Restore test result recorded in EXIT.md Section 8

### 3.4 Cutover execution

- [ ] Maintenance window communicated to users (if applicable)
- [ ] Final staging Postgres backup taken
- [ ] Backup transferred to Application Frontend VM
- [ ] Database restored on Application Frontend VM
- [ ] Application started: `docker compose up -d`
- [ ] All containers reach healthy state
- [ ] Smoke tests executed:
  - [ ] Application loads
  - [ ] Authentication works (Entra ID redirect successful)
  - [ ] Critical user paths exercised (list specific paths in EXIT.md)
  - [ ] Database queries return expected data
- [ ] DNS confirmed resolving correctly
- [ ] TLS certificate valid and trusted by internal browsers

### 3.5 Production monitoring activation

- [ ] Uptime Kuma — production monitor added for `https://{app_name}.cws.internal/api/v1/health`
- [ ] Production monitor configured with same intervals and retries as staging
- [ ] Notification channel attached to production monitor
- [ ] pgAdmin — production server connection added on DB VM
- [ ] Connection name: `production-{app_name}`
- [ ] Test query executed successfully on production
- [ ] Kill-test on production after deployment confirms alert routing works

### 3.6 Post-cutover validation (24 hours)

- [ ] Uptime Kuma dashboard reviewed every 4 hours during first 24 hours
- [ ] No unexpected DOWN events
- [ ] Container logs reviewed for errors at 4h, 12h, 24h intervals
- [ ] Database connection count and query patterns within expected ranges (pgAdmin)
- [ ] First scheduled backup confirmed successful
- [ ] Resource usage (CPU, memory, disk) within expected ranges

### 3.7 Communication and closure

- [ ] Go-live communicated to application users
- [ ] DTO team notified that production monitoring is active
- [ ] Risk register updated with any new observations
- [ ] EXIT.md Section 21 version history updated with go-live date
- [ ] Lessons learned captured for second application cutover

**Verification:** Application stable in production for 24 hours, monitoring functioning, EXIT.md current.

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
