# Hermes Update Pack — CWSCX Platform

Produce the same consolidated Hermes Update Pack used by OpenCode for this repository.

## Rules

- Work read-only unless Gregory explicitly asks for edits.
- Use canonical project name: `CWSCX Platform`; do not use deprecated alias `CX B2B Platform`.
- Read `AGENTS.md`, `CLAUDE.md`, `OPENCODE.md`, `.opencode/skills/hermes-handoff-after-opencode-task/SKILL.md`, and `skills/hermes-handoff-after-opencode-task.md` first.
- Read all unflushed entries in `.opencode/hermes-pending-updates.md` if present.
- Include current branch, latest commit, push status, and pre-existing dirty files not touched.
- Do not include secrets, tokens, cookies, passwords, connection strings, `.env` values, private keys, or customer-sensitive data. Redact as `[REDACTED]`.

## Output sections

- Project metadata
- Task summary
- Files changed or inspected
- Pre-existing dirty/untracked files not touched
- Tests / verification
- Deployment impact
- Auth / security / data impact
- Documentation / handover impact
- Decisions
- Risks / open questions
- Suggested Hermes vault updates
- Next recommended task
