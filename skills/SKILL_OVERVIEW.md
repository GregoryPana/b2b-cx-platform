# Skill Overview

This file explains what each skill does, when to use it, and what supporting material it relies on.

## Core build skills

### `platform-architecture.md`
Use when defining the application topology, runtime model, platform boundaries, and shared standards.

### `repository-structure.md`
Use when creating a new repository or reorganising one to match DTO conventions.

### `backend-fastapi-sqlalchemy-alembic.md`
Use when building or extending Python backend logic, APIs, models, and migrations.

### `frontend-react-vite-tailwind.md`
Use when creating or improving frontend applications with React, Vite, Tailwind, and consistent UX rules.

## Delivery and operations skills

### `nginx-reverse-proxy.md`
Use when creating or modifying NGINX routing, TLS termination, static asset routes, and API proxy behavior.

### `self-hosted-runners-and-github-actions.md`
Use when setting up self-hosted runners, workflow targeting, repo environments, and CI/CD safety.

### `deploy-verify-rollback.md`
Use when building deployment flows, release bundles, verification steps, and rollback logic.

### `postgres-backup-restore-and-migration-safety.md`
Use when planning or changing DB backup, restore, migration, or schema-safety behavior.

## Access and security skills

### `entra-auth-and-session.md`
Use when implementing Entra auth, role claims, silent renewal, or diagnosing token validation issues.

### `public-dmz-mystery-shopper.md`
Use when creating a public-facing, DMZ-hosted survey path separated from internal frontends.

## Quality and continuity skills

### `troubleshooting-patterns.md`
Use when diagnosing recurring issues like stale bundles, runner mismatch, auth failures, asset routing, or odd environment drift.

### `documentation-exit-handover.md`
Use when preparing operating docs, EXIT content, handover notes, or consistency trackers.

### `hermes-handoff-after-opencode-task.md`
Use before ending any OpenCode/coding-agent task that changes code, docs, deployment, auth, data, architecture, risks, or decisions. Produces the structured Hermes Update Pack required to keep the Hermes/Obsidian knowledge graph current.

## Supporting materials

### `support/skill-template.md`
Use as the default format when creating new skills.

### `support/common-checklists.md`
Reusable checklists for deploy, auth, DB, and handover validation.
