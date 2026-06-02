# Example Prompts

This file gives practical prompt examples for using the skills in this folder with different coding agents.

## 1. General Pattern

Use this structure with any coding agent:

```text
Use skills/<skill-file>.md.
Read any references it names.
Follow the rules and verification steps in that skill while completing this task:
<your task>
```

## 2. Architecture Prompts

### New bespoke internal platform

```text
Use skills/platform-architecture.md and skills/repository-structure.md.
Design a new bespoke internal application for DTO using the same stack and architecture standards as this repository.
Produce the recommended runtime topology, repo layout, route map, and environment structure.
```

### Public DMZ survey path

```text
Use skills/platform-architecture.md and skills/public-dmz-mystery-shopper.md.
Design a DMZ-hosted public survey deployment that keeps the internal dashboard private and only allows restricted backend/database connectivity inward.
```

## 3. Repository / Project Setup Prompts

### Create a new repo baseline

```text
Use skills/repository-structure.md.
Create the initial repository structure, README, env example, docs folders, and scripts folders for a new DTO application.
```

### Normalize an existing repo

```text
Use skills/repository-structure.md and skills/documentation-exit-handover.md.
Review this repository and propose the smallest changes needed to make it match the DTO structure and handover expectations.
```

## 4. NGINX / Deployment Prompts

### Add a new reverse proxy route

```text
Use skills/nginx-reverse-proxy.md.
Add a new frontend route behind NGINX, including asset routing, no-cache shell behavior, and API proxy checks.
```

### Fix broken asset routing after deploy

```text
Use skills/nginx-reverse-proxy.md and skills/deploy-verify-rollback.md.
Diagnose why a frontend route loads but its JS asset returns 404 or text/html after deployment.
```

### Set up staging/production runner targeting

```text
Use skills/self-hosted-runners-and-github-actions.md.
Review the workflows and fix runner labels and runs-on rules so staging and production cannot deploy onto the wrong host.
```

## 5. Backend Prompts

### Add an API safely

```text
Use skills/backend-fastapi-sqlalchemy-alembic.md.
Add a new backend endpoint and any required persistence changes, following migration safety and avoiding runtime schema mutation.
```

### Investigate backend 500 on save

```text
Use skills/backend-fastapi-sqlalchemy-alembic.md and skills/troubleshooting-patterns.md.
Trace a backend 500 triggered by a specific save or update operation and patch the smallest safe fix.
```

## 6. Frontend Prompts

### Improve a survey UX flow

```text
Use skills/frontend-react-vite-tailwind.md.
Improve this survey frontend so save/submit states are clearer, mobile behavior remains correct, and the UI uses the existing design language.
```

### Fix stale state or route bleed

```text
Use skills/frontend-react-vite-tailwind.md and skills/troubleshooting-patterns.md.
Investigate why switching views or platforms leaves stale state, timeouts, or blank sections in the frontend.
```

## 7. Auth Prompts

### Fix Entra 401s

```text
Use skills/entra-auth-and-session.md.
Diagnose the current Entra token validation failures and identify whether the issue is audience, issuer, JWKS connectivity, or frontend session behavior.
```

### Long-running survey session behavior

```text
Use skills/entra-auth-and-session.md and skills/frontend-react-vite-tailwind.md.
Make the survey experience safer for long-running sessions by using silent renewal and clear expiry recovery behavior.
```

## 8. Database / Backup Prompts

### Add DB backup and restore verification

```text
Use skills/postgres-backup-restore-and-migration-safety.md.
Set up a backup schedule and restore-readiness verification for this PostgreSQL deployment.
```

### Review a migration before production

```text
Use skills/postgres-backup-restore-and-migration-safety.md and skills/backend-fastapi-sqlalchemy-alembic.md.
Review whether this schema change is safe for production deployment and whether a rollback or restore plan is required.
```

## 9. Documentation / Handover Prompts

### Update handover docs after go-live

```text
Use skills/documentation-exit-handover.md.
Update README, EXIT, deployment documentation, and operations notes so the repository reflects the real current runtime and deployment state.
Before ending, use skills/hermes-handoff-after-opencode-task.md and produce the Hermes Update Pack.
```

### Build a reusable standards pack

```text
Use skills/documentation-exit-handover.md, skills/platform-architecture.md, and skills/repository-structure.md.
Create a reusable documentation and templates pack that future applications can follow.
Before ending, use skills/hermes-handoff-after-opencode-task.md and produce the Hermes Update Pack.
```

## 9.1 Mandatory Hermes handoff prompt

Use this at the end of every meaningful OpenCode task:

```text
Use skills/hermes-handoff-after-opencode-task.md.
Produce the Hermes Update Pack for this session.
Do not include secrets, tokens, passwords, cookies, connection-string values, `.env` values, or private keys.
If any secret-like value is relevant, replace it with `[REDACTED]`.
Be explicit about files changed, tests run, deployment impact, auth/security/data impact, documentation impact, decisions, risks, and suggested Hermes knowledge graph updates.
```

## 10. Presentation Prompts

### Build a platform overview deck

```text
Use .opencode/skills/academic-pptx/SKILL.md and skills/documentation-exit-handover.md.
Create a professional presentation deck explaining this platform for mixed technical and non-technical audiences.
```

### Build a deployment decision deck

```text
Use .opencode/skills/academic-pptx/SKILL.md, skills/platform-architecture.md, and skills/public-dmz-mystery-shopper.md.
Create a decision deck comparing the internal and public deployment options for Mystery Shopper.
```
