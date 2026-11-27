# Agent Operating Guide — CWSCX Platform

This repository is the production-sensitive CWSCX Platform (`b2b-cx-platform`). It includes React/Vite frontends, FastAPI backend services, PostgreSQL migrations, Entra/internal flows, and the mystery_public DMZ flow.

Use canonical project name **CWSCX Platform**. Do not use the deprecated alias "CX B2B Platform" in handoff packs or durable notes.

## Required reading order

1. `AGENTS.md` — this cross-agent operating contract.
2. `CLAUDE.md` — detailed repository context and existing architecture notes.
3. `OPENCODE.md` — OpenCode adapter and Hermes Update Pack parity.
4. `.opencode/skills/hermes-handoff-after-opencode-task/SKILL.md` and `skills/hermes-handoff-after-opencode-task.md` for handoffs.
5. `HERMES_UPDATE_PACK.md` for latest known pack context.
6. Relevant docs under `docs/architecture/`, `docs/deployment/`, `docs/operations/`, and `docs/testing/` before touching those areas.
7. `docs/AGENT_DESIGN_SKILLS.md` and `docs/design/DESIGN_SYSTEM.md` before substantial frontend/UI work; record the selected design route before implementation.

## CodeGraph-first navigation

Use CodeGraph before grep/read discovery for repo orientation, symbol lookup, route tracing, caller/callee checks, and impact analysis.

```bash
codegraph status
codegraph query <term>
codegraph files
codegraph callers <symbol>
codegraph callees <symbol>
codegraph impact <symbol>
```

The older `codegraph --search` examples in historical docs should be treated as obsolete; use `codegraph query` with the current CLI.

## Production-sensitive safety rules

- Preserve the existing dirty worktree. Do not stage or commit unrelated files.
- Do not deploy, change CI/CD, alter production/DMZ config, run destructive database commands, run migrations, force-push, or rewrite history without Gregory's explicit approval.
- Do not inspect or print `.env` values, tokens, cookies, passwords, private keys, or connection-string values.
- Treat auth, roles, mystery_public 2FA, database migrations, deployment scripts, and DMZ/internal split behavior as high risk.
- Separate changed files from pre-existing dirty/untracked files in all handoffs.

## Validation expectations

Before claiming completion, report files changed, commands/tests/checks run, verification gaps, deployment impact, auth/security/data impact, docs/handover impact, risks, and next actions.

## Hermes Update Pack cadence

After meaningful work, append a compact entry to `.opencode/hermes-pending-updates.md`, then ask Gregory whether to generate the consolidated Hermes Update Pack. Only produce the full pack when he says yes or runs `/hermes-handoff`; skip the queue only for production/staging deployment, auth/schema/migration, destructive, or security events.


## Work tracking (mandatory)

Follow `docs/operations/WORK_TRACKING.md` on every task: record steps, failures and fixes, assumptions (verified or not) and decisions in the workstream doc in the same PR as the code, append to `.opencode/hermes-pending-updates.md` after each PR, and mark PRs `Merged (#n)` once merged. Answer cross-session summary requests from these records, not from memory.

## Project flow mapping

Before substantial redesign, migration, architecture change, cross-cutting implementation, audit, handover, or deployment planning, read `docs/agent-skills/project-flow-mapping/SKILL.md`. Use it to map the applicable user, administrator, system, data, state, integration, failure/recovery, operational, delivery, and manual flows from repository evidence. Do not require a full remap for a small, bounded change when a current flow map already covers the affected area; update only the impacted slice. Start read-only and do not convert discovered gaps into implementation scope without owner approval.
