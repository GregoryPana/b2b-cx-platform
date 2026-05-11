# EXIT-CONVENTIONS.md — DTO Cross-Application Standards

<!--
================================================================================
DOCUMENT PURPOSE
================================================================================
This file defines the standards that apply to EVERY application built or
maintained by the CWS Digital Transformation Office (DTO).

It exists to prevent the per-application EXIT.md files from each redefining
basic decisions — coding style, API conventions, anti-patterns, observability
contract — that should be the same across every application in the estate.

Per-application EXIT.md files reference this document instead of repeating it.
If an application needs to deviate from a convention here, it must be
documented as a deviation in that application's EXIT.md Section 18 (Risks)
with explicit DTO Lead and CTO approval.

================================================================================
SCOPE
================================================================================
Applies to every bespoke application owned by the DTO, including:
- Internal-only applications (staff-facing)
- External-facing applications (customer or partner-facing)
- Internal APIs (Warehouse API and similar)
- Internal automation services
- Anything deployed to a CWS-owned VM and built on the standard DTO stack

Does NOT apply to:
- Vendor systems (Cerillion, NI2, etc.)
- Microsoft Power Platform apps (Power Automate, Lists, Power BI)
- n8n workflow definitions (separate conventions document)
- Third-party SaaS configurations

================================================================================
HOW AI CODING AGENTS USE THIS DOCUMENT
================================================================================
If you are an AI coding agent working on any CWS DTO application:

  1. READ THIS DOCUMENT BEFORE READING THE PER-APPLICATION EXIT.md.
     The application's EXIT.md inherits these conventions and only documents
     deviations.

  2. The following sections are NON-NEGOTIABLE. Do not produce code that
     violates them, even if asked. Surface conflicts to the user.
       - Section 3 (Python coding conventions)
       - Section 4 (TypeScript coding conventions)
       - Section 5 (Naming conventions)
       - Section 6 (API conventions)
       - Section 7 (Database conventions)
       - Section 9 (Environment variables and secrets)
       - Section 10 (Observability contract)
       - Section 15 (Anti-patterns)

  3. If you are unsure whether a convention applies, default to following it.
     Do not pattern-match from training data when this document is explicit.

  4. If you encounter a convention that seems wrong or outdated, flag it but
     do not violate it. Update happens through the process in Section 17.

================================================================================
DECISIONS MARKED FOR DTO LEAD CONFIRMATION
================================================================================
Several decisions in this draft are marked [DTO LEAD CONFIRM]. These are
defensible defaults but require explicit confirmation before being treated as
locked. Once confirmed, remove the marker and add the confirmation date to
Section 17.
-->

---

## 1. Standard Technology Stack

Every CWS DTO application is built on the following stack unless an explicit deviation is documented and approved.

### 1.1 Backend

| Component | Standard | Rationale |
|---|---|---|
| Language | Python 3.12+ | Modern type system, mature async support |
| Web framework | FastAPI (latest minor) | Native async, OpenAPI generation, Pydantic integration |
| Data validation | Pydantic v2 | Bound to FastAPI, performance |
| ORM | SQLAlchemy 2.x async | Industry standard, async support |
| Migrations | Alembic | Bound to SQLAlchemy |
| Test framework | pytest + pytest-asyncio | Standard |
| HTTP client | httpx (async) | Bound to FastAPI ecosystem |

### 1.2 Frontend

| Component | Standard | Rationale |
|---|---|---|
| Language | TypeScript (strict mode) | Type safety, ecosystem |
| Framework | React 18+ | Standard, large talent pool |
| Build tool | Vite | Fast, modern, simple |
| State management | TanStack Query (server state), `useState`/`useReducer` (local) | No Redux unless application complexity justifies it |
| Styling | Tailwind CSS | DTO standard, no CSS-in-JS, no CSS modules |
| HTTP client | Auto-generated client from OpenAPI via `openapi-typescript` | Eliminates client/server schema drift |
| Test framework | Vitest + React Testing Library | Vitest aligns with Vite |

### 1.3 Data and Infrastructure

| Component | Standard | Rationale |
|---|---|---|
| Database | PostgreSQL 16 | CWS standard, data sovereignty (on-prem) |
| Cache (when needed) | Redis 7+ | Standard |
| Message broker (when needed) | n8n for workflow orchestration; defer dedicated broker until justified | Avoid premature complexity |
| Container runtime | Docker Engine + Compose v2 (plugin) | Standard, no Kubernetes until estate justifies it |
| Reverse proxy / TLS | NGINX | Standard, no Caddy in production until DTO Lead confirms |
| OS | Ubuntu 24.04 LTS | CWS standard |
| Identity | Microsoft Entra ID via OIDC | Enterprise SSO mandate |

### 1.4 Version Pinning Rules

- Application repositories pin **exact versions** in `pyproject.toml` and `package.json`. No floating version specifiers (`^`, `~`, `>=`) for production dependencies.
- Major version upgrades are **deliberate, scheduled work**. They do not happen in feature branches.
- Security patches are applied within [DTO LEAD CONFIRM: 14 days] of disclosure for HIGH/CRITICAL CVEs in production dependencies.

---

## 2. Repository Conventions

### 2.1 Repository Hosting

- **Current:** GitHub (CWS organisation account, private repositories)
- **Target:** GitLab CE self-hosted on `gitlab-vm` (when provisioned)
- **Personal accounts holding CWS code are not acceptable** under any circumstance. This includes accounts linked to organisation email but registered as personal.

### 2.2 Repository Naming

- Format: `cws-{domain}-{purpose}` — for example, `cws-finance-budget-tracker`, `cws-platform-warehouse-api`, `cws-hr-jam`
- All lowercase, hyphen-separated
- No abbreviations unless they are CWS-internal standard terms (CWS, BSS, DTO, JAM, EMS)

### 2.3 Branch Strategy

| Branch | Purpose | Protection |
|---|---|---|
| `main` | Default branch, deployment-capable branch for manual staging releases | Protected, no direct push, PR + 1 review required |
| `production` | Reflects current production state | Protected, no direct push, only fast-forward from tagged main commits |
| `feature/{ticket-id}-{short-description}` | Active development | Unprotected, deleted on merge |
| `hotfix/{ticket-id}-{short-description}` | Production fixes | Branched from `production`, merged to both `production` and `main` |

### 2.4 Commit Message Format

[DTO LEAD CONFIRM] Conventional Commits format:

```
{type}({scope}): {short description}

{optional body explaining why, not what}

{optional footer with breaking changes or issue references}
```

Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`, `build`, `ci`

### 2.5 Pull Request Requirements

- Title follows commit message format
- Description states: what changed, why, and how it was tested
- All CI checks must pass before merge
- At least one approval from a DTO team member other than the author
- No merging your own PRs without explicit DTO Lead approval (emergencies only)
- Squash and merge to keep `main` history linear [DTO LEAD CONFIRM: squash vs rebase]

### 2.6 Required Repository Files

Every CWS DTO repository must contain at the root:

| File | Purpose |
|---|---|
| `README.md` | Developer quickstart — clone, set up, run locally |
| `EXIT.md` | Operations and handover (template provided separately) |
| `.env.example` | Environment variable contract (no real values) |
| `.gitignore` | Must include `.env`, secrets, build artifacts |
| `LICENSE` | [DTO LEAD CONFIRM: organisation licence policy] |
| `docker-compose.yml` | Production composition |
| `docker-compose.dev.yml` | Local development overrides |
| `pyproject.toml` (backend) or `package.json` (frontend) | Dependency manifest |

---

## 3. Python Coding Conventions

### 3.1 Style and Formatting

- **Formatter:** Ruff format
- **Linter:** Ruff with rules: `E`, `F`, `W`, `I`, `N`, `UP`, `B`, `S`, `C4`, `T20`, `SIM`, `ASYNC`
- **Line length:** 100 [DTO LEAD CONFIRM]
- Both run as pre-commit hooks AND in CI. CI must enforce — local hooks can be bypassed, CI cannot.

### 3.2 Type Hints

- **Required on all function signatures** (parameters and return types) in `app/`, `services/`, `api/`, `db/`
- Required on class attributes
- Test files (`tests/`) are exempt but encouraged
- Use `from __future__ import annotations` at the top of every module
- Prefer modern syntax: `list[X]` not `List[X]`, `dict[K, V]` not `Dict[K, V]`, `X | None` not `Optional[X]`

### 3.3 Async Conventions

- **All FastAPI route handlers are async.** No synchronous handlers in new code.
- All database operations use SQLAlchemy async sessions.
- Blocking I/O (file system, sync HTTP libraries) inside async handlers is forbidden — use `asyncio.to_thread()` if absolutely necessary.
- HTTP calls use `httpx.AsyncClient`, never `requests`.

### 3.4 Module Structure

- Routers in `app/api/v1/{resource}.py`
- Business logic in `app/services/{domain}.py`
- Database models in `app/db/models/{domain}.py`
- Pydantic schemas in `app/schemas/{domain}.py`
- Configuration in `app/core/config.py` (single Settings class, environment-driven)
- **Routers contain HTTP concerns only.** No business logic, no direct database queries beyond simple lookups.

### 3.5 Docstrings

- **Style:** Google [DTO LEAD CONFIRM]
- Required on every public function, method, and class in `services/`, `api/`, `db/`
- Required on any function with non-obvious behaviour regardless of location

### 3.6 Logging

- Use `structlog` configured to emit JSON to stdout
- **Never** use `print()` in application code (linter blocks with `T20` rule)
- **Never** log sensitive data — see Section 9 for what counts as sensitive

### 3.7 Error Handling

- Use FastAPI exception handlers for converting exceptions to HTTP responses (see Section 6.4 for error format)
- **Never silently swallow exceptions.** Catching to log and re-raise is acceptable; catching and ignoring is not.
- Custom exceptions inherit from a per-application base exception class

---

## 4. TypeScript Coding Conventions

### 4.1 Style and Formatting

- **Formatter:** Prettier with project-level config committed to repo
- **Linter:** ESLint with `@typescript-eslint`, React, and React Hooks plugins
- **TypeScript strict mode:** enabled (`strict: true`, `noUncheckedIndexedAccess: true`, `noImplicitOverride: true`)
- Both run as pre-commit hooks AND in CI

### 4.2 Component Patterns

- **Function components only.** No class components.
- One component per file. File name matches component name (PascalCase).
- Component file structure:
  ```
  ComponentName.tsx          # Component
  ComponentName.test.tsx     # Tests
  ```
- Hooks live in `src/hooks/use{HookName}.ts`

### 4.3 State Management

- **Server state:** TanStack Query (React Query). All API calls go through query/mutation hooks.
- **Local UI state:** `useState`, `useReducer`
- **Cross-component state:** React Context for genuinely global concerns (auth, theme). Otherwise prop drilling is acceptable.
- **Redux, Zustand, MobX:** not used unless explicitly approved by DTO Lead

### 4.4 API Client

- Generated from backend OpenAPI spec via `openapi-typescript`
- Regenerated on every backend API change — `npm run generate:api`
- **Never hand-write API client types.** They drift from the backend.

### 4.5 Styling

- **Tailwind CSS only.** No CSS modules, no CSS-in-JS, no plain `.css` files except a single `index.css` for Tailwind directives.
- Component variants via `clsx` or `cva`, not via runtime style objects.

### 4.6 No HTML Forms in React

- Use controlled components with explicit submit handlers.
- HTML `<form>` tag with `onSubmit` is acceptable; uncontrolled forms via DOM refs are not.

---

## 5. Naming Conventions

| Surface | Convention | Example |
|---|---|---|
| Python modules and packages | `snake_case` | `app.services.budget_processor` |
| Python classes | `PascalCase` | `BudgetProcessor` |
| Python functions and variables | `snake_case` | `process_budget()` |
| Python constants | `UPPER_SNAKE_CASE` | `MAX_RETRIES` |
| Pydantic schema classes | `PascalCase` with suffix | `BudgetCreate`, `BudgetUpdate`, `BudgetRead` |
| TypeScript variables and functions | `camelCase` | `processBudget()` |
| TypeScript types and interfaces | `PascalCase` | `Budget`, `BudgetCreatePayload` |
| TypeScript constants | `UPPER_SNAKE_CASE` | `MAX_RETRIES` |
| React components | `PascalCase` | `BudgetTable` |
| React hooks | `camelCase` with `use` prefix | `useBudgets` |
| API endpoints | `kebab-case`, plural nouns | `/api/v1/budget-items` |
| JSON field names | `snake_case` (matches Python) [DTO LEAD CONFIRM: snake vs camel] | `created_at` |
| Database tables | `snake_case`, plural | `budget_items` |
| Database columns | `snake_case` | `created_at` |
| Database indexes | `ix_{table}_{columns}` | `ix_budget_items_status` |
| Environment variables | `UPPER_SNAKE_CASE` | `DATABASE_URL` |
| Docker Compose services | `kebab-case` | `budget-tracker-backend` |
| VM hostnames | `{role}-{env}-{name}` | `app-prod-budget-tracker` |

---

## 6. API Conventions

### 6.1 Versioning

- **URI versioning:** `/api/v1/{resource}`
- New major version (`/api/v2`) only for breaking changes
- Non-breaking changes (additive fields, new endpoints) do not require new version
- Old versions deprecated, not removed, until all consumers migrated — minimum 6 months parallel operation

### 6.2 Resource Naming

- Plural nouns: `/api/v1/budgets`, not `/api/v1/budget`
- Hyphens for multi-word: `/api/v1/budget-items`
- Sub-resources nested: `/api/v1/budgets/{id}/items`
- Actions on resources use POST sub-resource: `/api/v1/budgets/{id}/approve` (not `/api/v1/approve-budget`)

### 6.3 Response Format

- **Bare JSON, no envelope.** Return the resource directly, not `{"data": {...}}`.
- Collections return an object with `items` array and pagination metadata:
  ```json
  {
    "items": [...],
    "next_cursor": "abc123",
    "total_count": 1234
  }
  ```
- Single resources return the object directly.
- Empty success responses use HTTP 204 No Content with no body.

### 6.4 Error Format

RFC 7807 Problem Details:

```json
{
  "type": "https://cws.sc/errors/budget-not-found",
  "title": "Budget not found",
  "status": 404,
  "detail": "No budget exists with ID 123",
  "instance": "/api/v1/budgets/123",
  "code": "BUDGET_NOT_FOUND"
}
```

- `type` is a URI identifying the error category (does not need to resolve)
- `code` is a stable string identifier consumed by client error handling
- `detail` is human-readable, may contain non-sensitive context
- **Never include stack traces, SQL queries, or internal paths in production responses**

### 6.5 Pagination

- **Cursor-based.** Query parameters: `?cursor={token}&limit={n}`
- Default limit: 50
- Maximum limit: 200 (enforced server-side)
- Offset-based pagination forbidden — does not scale, inconsistent with concurrent writes

### 6.6 Timestamps

- ISO 8601 with timezone, always UTC: `"2026-05-05T14:30:00Z"`
- Field naming: `created_at`, `updated_at`, `deleted_at` (soft delete pattern only when justified)

### 6.7 OpenAPI

- Auto-generated from FastAPI route definitions
- Available at `/api/v1/openapi.json` (production: requires authentication)
- Swagger UI at `/api/v1/docs` (production: disabled or auth-gated)
- Frontend client regenerated from this on every backend release

### 6.8 Health Endpoint Contract

Every application exposes `GET /api/v1/health`:

```json
{
  "status": "ok",
  "version": "1.2.3",
  "checks": {
    "database": "ok",
    "cache": "ok"
  }
}
```

- HTTP 200 if all checks pass
- HTTP 503 if any required check fails
- **No authentication on this endpoint** — Uptime Kuma and Prometheus must reach it
- Response time: under 100ms

---

## 7. Database Conventions

### 7.1 Schema

- Single schema (`public`) per application database unless multi-tenancy justifies otherwise
- One database per application — no shared databases between applications
- Database name matches application name: `cws_{application_name}`

### 7.2 Migrations

- **Alembic, always.** No raw SQL migrations except for operations Alembic cannot express.
- Every migration has both `upgrade()` and `downgrade()` paths
- Auto-generated migrations are **inspected and edited** before commit — never committed unmodified
- Migration message: `alembic revision --autogenerate -m "add_budget_status_column"`
- One logical change per migration — do not bundle unrelated schema changes
- Migrations run automatically on deployment, before application start

### 7.3 Standard Audit Columns

Every table includes:

| Column | Type | Purpose |
|---|---|---|
| `id` | UUID v7 (preferred) or `BIGSERIAL` | Primary key |
| `created_at` | `TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()` | Record creation |
| `updated_at` | `TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()` | Last update (trigger-maintained) |
| `created_by` | `UUID` (foreign key to users) | Who created (when application has authenticated users) |
| `updated_by` | `UUID` (foreign key to users) | Who last updated |

### 7.4 Constraints

- Foreign keys are mandatory for referential relationships
- `NOT NULL` is the default — nullable columns require justification
- Unique constraints have explicit names: `uq_{table}_{columns}`
- Check constraints have explicit names: `ck_{table}_{description}`

### 7.5 Indexes

- Foreign key columns are indexed
- Columns used in WHERE clauses with high cardinality are indexed
- Indexes are reviewed quarterly — unused indexes removed
- Index naming: `ix_{table}_{columns}`

### 7.6 Forbidden Patterns

- **No application-managed schema changes outside Alembic.** No code that runs `CREATE TABLE` or `ALTER TABLE` at startup.
- **No storing JSON blobs as a primary data model.** JSONB columns are acceptable for genuinely unstructured user data, not as a substitute for proper schema design.
- **No password storage in application databases.** Authentication is delegated to Entra ID.

---

## 8. Authentication and Authorisation

### 8.1 Authentication

- **Microsoft Entra ID via OIDC** is the only authentication method for production applications
- Local accounts for development only, never enabled in production
- Tokens validated server-side on every request
- Token caching with reasonable TTL (5–15 minutes)

### 8.2 Authorisation Model

- Role-based access control (RBAC)
- Roles defined per application in code, mapped to Entra ID groups in configuration
- Permissions are explicit — no implicit "admin can do anything" defaults
- Authorisation enforced at the service layer, not just the router layer (defence in depth)

### 8.3 Service-to-Service Authentication

- For internal service calls (e.g., to Warehouse API), use OAuth 2.0 client credentials flow via Entra ID
- API keys for service-to-service are forbidden unless explicitly justified and approved
- Tokens scoped to minimum required permissions

---

## 9. Environment Variables and Secrets

### 9.1 Naming

- `UPPER_SNAKE_CASE`
- Group by prefix: `DATABASE_`, `ENTRA_`, `REDIS_`, `SMTP_`, `APP_`
- Boolean values: `"true"` / `"false"` (lowercase strings, parsed by app)

### 9.2 What Is Sensitive

The following are **always** sensitive and must never be committed to git, logged, or returned in API responses:

- Passwords, password hashes
- API keys, client secrets, tokens, JWTs
- Database connection strings containing credentials
- Private keys, certificates
- Personal identifiers (national ID, passport numbers, full names + DOB combinations)
- Phone numbers, email addresses (in logs — these are PII)
- Financial account numbers
- IP addresses (in some regulatory contexts — when in doubt, treat as sensitive)

### 9.3 Where Secrets Live

| Environment | Storage |
|---|---|
| Production | `.env` file on production VM, mode 600, owned by service user. NOT in git. |
| Staging | `.env` file on staging VM, same protection |
| Local development | Developer's local `.env`, never committed |
| CI/CD | Pipeline secret store (GitHub Actions Secrets / GitLab CI Variables, masked) |
| Future | HashiCorp Vault on dedicated VM (deferred until 4+ applications justify it) |

### 9.4 What `.env.example` Must Contain

- Every environment variable the application reads, with an explanatory comment
- Empty values for sensitive variables, sensible defaults for non-sensitive
- This file IS committed and IS the contract

### 9.5 Secret Rotation

- Documented per-application in EXIT.md Section 10
- Rotated annually at minimum, or on suspected compromise
- Rotation procedure tested at least once before relied upon

---

## 10. Observability Contract

Every CWS DTO application must expose the following, regardless of tier.

### 10.1 Health Endpoint

- `GET /api/v1/health` per Section 6.8
- Used by Uptime Kuma for liveness monitoring

### 10.2 Metrics Endpoint

- `GET /metrics` exposing Prometheus format
- Implemented via `prometheus-fastapi-instrumentator` for FastAPI applications
- Authenticated in production (Prometheus uses bearer token or mTLS)
- Standard metrics: HTTP request rate, latency histograms, error rate by status code, active database connections

### 10.3 Logging

- **Format:** Structured JSON via `structlog`
- **Destination:** stdout (Docker captures, Promtail ships to Loki)
- **No file logging** — containers must be stateless
- **Required fields:** `timestamp`, `level`, `logger`, `message`, `request_id` (for request-scoped logs), `user_id` (when authenticated)
- **Forbidden fields:** any sensitive data per Section 9.2

### 10.4 Error Tracking

- Sentry self-hosted (when deployed) on observability VM
- Every unhandled exception captured with request context
- PII redaction filter applied before transmission

### 10.5 Alerting Severity

| Severity | Definition | Response time |
|---|---|---|
| Sev-1 | Production application down or critical function unavailable | 15 minutes |
| Sev-2 | Degraded performance, partial functionality affected | 1 hour |
| Sev-3 | Minor issue, non-blocking | Next business day |

---

## 11. Security Baseline

### 11.1 Authentication Defaults

- **All endpoints require authentication unless explicitly documented otherwise** in the application's EXIT.md
- The `/api/v1/health` endpoint is the only standard exception

### 11.2 Transport

- HTTPS only in production. No HTTP fallback.
- TLS 1.2 minimum, TLS 1.3 preferred
- Certificates managed by [DTO LEAD CONFIRM: internal CA / Let's Encrypt internal / vendor]

### 11.3 Rate Limiting

- Authentication endpoints: rate-limited per source IP and per account
- Public-facing read endpoints: rate-limited per authenticated user
- Implementation: SlowAPI or NGINX-level limits

### 11.4 Dependency Security

- Pre-commit hook scans for committed secrets (`detect-secrets` or `gitleaks`)
- CI runs dependency vulnerability scan on every push
- HIGH/CRITICAL CVEs block merge to main
- Annual full audit of all production dependencies

### 11.5 Input Validation

- All input validated via Pydantic at the boundary (request handlers)
- SQL: parameterised queries only via SQLAlchemy. **No string concatenation into SQL, ever.**
- File uploads: type, size, and content validation. Stored outside webroot.

### 11.6 CSRF, CORS, Headers

- CORS: explicit allow-list of origins, no wildcards in production
- CSRF: not required for token-authenticated APIs (no cookies); required if cookie sessions used
- Security headers: `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`, `Content-Security-Policy` set by NGINX

---

## 12. Documentation Requirements

Every CWS DTO application repository must contain:

| Document | Purpose | Maintenance |
|---|---|---|
| `README.md` | Developer quickstart — getting the app running locally | Updated when local dev setup changes |
| `EXIT.md` | Operations and handover (template provided) | Updated on every material change, quarterly review |
| `.env.example` | Environment variable contract | Updated whenever a new env var is introduced |
| `docs/architecture.md` (if non-trivial) | Architecture decisions and diagrams | Updated when architecture changes |
| `docs/runbook.md` (Tier 2 and above) | Operational runbook for on-call | Updated after every incident |
| OpenAPI specification | API contract | Auto-generated, no manual edits |

**Rule:** if a developer onboarding to the application needs to ask another team member how to run it, the README is incomplete. If an on-call engineer needs to ask how to recover it, the EXIT.md is incomplete.

---

## 13. CI/CD Conventions

### 13.1 Pipeline Stages

Standard pipeline (currently GitHub Actions, migrating to GitLab CI):

1. **Lint** — Ruff (Python), ESLint + Prettier (TypeScript)
2. **Type check** — mypy or Pyright (Python), tsc --noEmit (TypeScript)
3. **Test** — pytest, Vitest
4. **Security scan** — Dependency vulnerability scan, secret detection
5. **Build** — Docker images, tagged with git commit SHA
6. **Push** — to container registry (GitHub Container Registry now, GitLab Registry later)
7. **Deploy staging** — manual workflow trigger against the intended commit
8. **Deploy production** — manual gate (tag-based or environment approval)

### 13.2 Image Tagging

- Every image tagged with: `{git_sha}`, `{branch_name}`, and `latest` (main only)
- Production deployments reference `{git_sha}` explicitly — never `latest`
- Image retention: 30 days for non-tagged builds, indefinite for tagged releases

### 13.3 Self-Hosted Runners

- All runners on CWS-owned VMs on internal network
- No code or secrets leave CWS infrastructure
- Runners run as non-root, isolated per repository where possible
- Runner VM access restricted to DTO Lead

---

## 14. Tier Model and Deployment

### 14.1 Tier Definitions

| Tier | Use case | VM model | Examples |
|---|---|---|---|
| Tier 1 | Internal staff-only application, low data sensitivity | Single VM (app + DB co-located) | Internal trackers, dashboards |
| Tier 2 | External-facing, multi-tenant, or compliance-scoped | Separate app VM + dedicated DB VM | Customer portals, partner APIs |
| Tier 3 | Multi-VM application requiring HA or horizontal scale | Multi-VM with load balancer, replicated DB | Future — not currently in scope |

### 14.2 Tier Selection Rules

Tier is selected at design time, recorded in EXIT.md Section 2, and reviewed at every quarterly review. Migration from Tier 1 to Tier 2 in production is a planned exercise involving downtime — do not over-provision but do not under-provision either. When in doubt, document the reasoning and choose the higher tier.

### 14.3 Deployment Gates

- Staging: manual gate via workflow dispatch
- Production: manual gate. Either tag-based (`v1.2.3` triggers production deploy) or pipeline approval step. **Never automatic on push.**
- Rollback procedure documented per application in EXIT.md

---

## 15. Cross-Application Anti-Patterns

These are forbidden in every CWS DTO application. Violations are blocked by review.

1. **Secrets, credentials, or `.env` files in git history.** Even private repositories. Even temporarily.
2. **Direct schema changes outside Alembic.** No `ALTER TABLE` in production except via migration.
3. **Business logic in API routers.** Routers handle HTTP only. Logic goes in services.
4. **New dependencies without approval.** Every library is a maintenance and security obligation.
5. **Major version upgrades without explicit approval.** Pinned versions are pinned for a reason.
6. **Disabling type checking, linting, or tests to make a build pass.** Fix the underlying problem.
7. **Logging sensitive data.** PII, tokens, passwords, full request bodies of authenticated endpoints.
8. **Bypassing authentication for "internal" endpoints.** Default is authenticated.
9. **Frontend talking directly to the database.** Frontend talks to backend. Backend talks to DB. Boundary is non-negotiable.
10. **State stored in container filesystem outside designated volumes.** Containers must be reproducible from images.
11. **Long-running operations in HTTP request handlers.** Anything over 5 seconds becomes a background job.
12. **Silent exception swallowing.** Catch to handle, catch to log, never catch to ignore.
13. **Hardcoded environment-specific values in code.** URLs, hostnames, paths, feature flags — all from configuration.
14. **Cross-application database access.** Application A does not query Application B's database. Use APIs.
15. **Synchronous calls between services in the request path.** Async/background where possible.
16. **Building features without observability hooks.** Every new endpoint exposes metrics. Every new background job is monitored.

---

## 16. Exceptions and Deviations

A DTO application may deviate from these conventions only when:

1. The deviation is **documented in that application's EXIT.md Section 18** (Risks)
2. The justification is recorded — what convention is violated, why, what was considered as an alternative
3. The deviation is **explicitly approved** by the DTO Lead, and for Section 15 anti-patterns, also by the CTO
4. A re-evaluation date is set — most deviations are time-bound

Examples of legitimate deviations:
- A pre-existing application built before these conventions existed (deviation: align over time, not all at once)
- A specific performance requirement that the standard pattern cannot meet (deviation: with documented benchmark)
- A vendor integration constraint that forces a non-standard approach (deviation: with vendor reference)

Examples of illegitimate deviations:
- "It was easier this way"
- "I didn't know this was a convention"
- "We can fix it later"

---

## 17. Document Maintenance

### 17.1 Ownership

- **Owner:** DTO Lead (Gregory)
- **Approvers for changes:** DTO Lead + CTO (for any change to Sections 15, 11, or 8)

### 17.2 Review Cadence

- **Quarterly review** by DTO Lead
- **Annual review** with CTO sign-off
- **Triggered review** after any production incident attributable to a convention gap

### 17.3 Change Process

1. Proposed change documented as a PR against this file
2. Discussed with DTO team before merge
3. Approved per Section 17.1
4. Communicated to all DTO team members and any active AI coding agents
5. Existing applications brought into alignment within a defined window (or deviation documented per Section 16)

### 17.4 Version History

| Date | Author | Change summary |
|---|---|---|
| [FILL: YYYY-MM-DD] | Gregory | Initial version |
| | | |

### 17.5 Pending Confirmations

Items marked [DTO LEAD CONFIRM] in this draft that require explicit decision before this document is treated as locked:

- Section 1.4: Security patch SLA (currently 14 days for HIGH/CRITICAL)
- Section 2.4: Conventional Commits as commit format
- Section 2.5: Squash vs rebase for merge strategy
- Section 2.6: Repository licence policy
- Section 3.1: Python line length (currently 100)
- Section 3.5: Docstring style (currently Google)
- Section 5: JSON field naming (snake_case vs camelCase)
- Section 11.2: Certificate management approach

Once each is decided, remove the marker and record the decision in Section 17.4.

---

<!--
================================================================================
END OF EXIT-CONVENTIONS.md
================================================================================
-->
