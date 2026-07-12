# OpenCode Operating Rules — CWSCX Platform

This file is the OpenCode adapter for the repo-local agent harness. Read `AGENTS.md` first, then `CLAUDE.md` for detailed architecture context.

Use canonical project name **CWSCX Platform**. Never title packs or durable notes with the deprecated alias "CX B2B Platform".

## Required reading order

1. `AGENTS.md`
2. `CLAUDE.md`
3. `.opencode/skills/hermes-handoff-after-opencode-task/SKILL.md`
4. `skills/hermes-handoff-after-opencode-task.md`
5. `HERMES_UPDATE_PACK.md`
6. Relevant `docs/architecture/`, `docs/deployment/`, `docs/operations/`, or `docs/testing/` files for the task

## Operating rules

- Use CodeGraph first for navigation and impact analysis.
- Use current CodeGraph CLI commands: `codegraph status`, `codegraph query`, `codegraph files`, `codegraph callers`, `codegraph callees`, `codegraph impact`.
- Preserve the existing dirty worktree and never stage unrelated changes.
- Do not deploy, alter CI/CD, change production/DMZ config, run destructive DB commands, run migrations, force-push, or inspect secret values without explicit Gregory approval.
- Treat auth, roles, mystery_public 2FA, database migrations, deployment scripts, and DMZ/internal split behavior as high risk.

## Hermes Update Pack cadence

After meaningful work, append a compact 3–8 line entry to `.opencode/hermes-pending-updates.md`, then ask exactly:

`Hermes pending log: N entries since <oldest date>. Generate the consolidated Hermes Update Pack now?`

Generate the full pack only when Gregory says yes or runs `/hermes-handoff`; skip the queue only for production/staging deployment, auth/schema/migration, destructive, or security events.

When producing the pack, include branch/status, latest commit/push status, changed files, pre-existing dirty files not touched, commands/tests, deployment impact, auth/security/data impact, docs impact, decisions, risks, and suggested Hermes vault updates. Never include secret values; redact as `[REDACTED]`.
