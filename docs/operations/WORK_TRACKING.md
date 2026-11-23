# Work tracking standard

How every agent session (Claude Code, OpenCode, Hermes) records what it does, so a teammate or another session can pick the work up without asking. Added 2026-11-23 after a cross-session summary had to be rebuilt from memory.

## The rule

Tracking is part of the work, not an afterthought. A PR or task is not finished until its record is written. Write the record as you go (at each step), not from memory at the end.

## Where things are recorded

| What | Where | Who updates it |
| ---- | ----- | -------------- |
| Plan, findings, steps, per-PR progress, failures and fixes, assumptions and decisions for a workstream | One doc per workstream under `docs/audits/` (or `docs/features/`), e.g. `docs/audits/dashboard-audit-2026-11.md`. Updated in the same PR as the code. | The agent doing the work |
| One compact entry per meaningful change (branch, SHA, files, verification, flags) | `.opencode/hermes-pending-updates.md` (cadence in `skills/hermes-handoff-after-opencode-task.md`) | The agent, after each PR or investigation |
| Deploys, promotions, server actions | Pending log with flag `deployment-needed` or `deployed`, plus run IDs. Never deploy without the owner's go-ahead. | Whoever ran it |
| Durable lessons and working method for the next session | The agent's memory files (Claude Code: `memory/`) and, for rules everyone must follow, `CLAUDE.md` / `AGENTS.md` | The agent, when a lesson is learned or the owner gives a rule |
| Owner decisions | The workstream doc ("Decisions" section) with the date and what was decided | The agent, the moment the owner decides |

## What a workstream doc must contain

1. **Goal and scope**, and what is explicitly out of scope.
2. **Steps**: the planned PR/task list with status (`Planned`, `Built`, `Open #n`, `Merged #n`, `Deployed <run id>`). Use the real PR number once known; do not leave `Open` after a merge.
3. **Progress log**: one dated row per step: what changed, what was verified, what was not.
4. **Failures and fixes**: every failure that cost time or could recur (test failure, CI failure, tool error, a mistake of the agent's), with cause, fix and lesson. Record failures even when fixed immediately.
5. **Assumptions**: anything believed but not proven (for example "date params work on the real backend" when only the code was read). Mark each `verified` or `unverified` and say how to verify.
6. **Decisions**: who decided, when, what, and why. Keep owner decisions separate from the agent's own judgement calls.
7. **Behaviour/data changes** flagged separately from UI/UX-only changes.
8. **Open items and risks**: what is left undone and what could go wrong.

## Per-PR checklist (agent)

Before telling the owner a PR is ready:

- [ ] Workstream doc updated in the same PR (status row, progress log, failures, assumptions, decisions).
- [ ] Tests/build run before pushing and compared with the known baseline; results written down, including what was not run.
- [ ] Pending-log entry appended (`.opencode/hermes-pending-updates.md`).
- [ ] PR body says what changed, how it was verified, what was not, and flags behaviour/data changes.

After the owner merges:

- [ ] Replace `Open` with `Merged (#n)` in the workstream doc (it can ride on the next PR, but do not forget).
- [ ] Update memory if the status, method or a lesson changed.

## Cross-session handoff

When another session asks for a summary, answer from the records above, not from memory. The standard answer has five parts: (1) PRs opened/merged, (2) uncommitted, unpushed or branch-without-PR work and the checkout branch, (3) verification run and not run, (4) decisions, open risks and undone work, (5) anything deployed. If a part cannot be answered from the records, the records were incomplete: fix them.

## Shared checkout hygiene

The primary checkout often holds the owner's uncommitted files. Branch with `git checkout -b <name> origin/main`, stage explicit paths only, never `git stash`, never `git reset --hard`, and note in the pending log which files were deliberately left alone.
