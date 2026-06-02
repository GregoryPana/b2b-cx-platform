---
name: hermes-handoff-after-opencode-task
description: Use before ending any OpenCode session that changes code, docs, deployment, database, auth, architecture, risks, decisions, or discovers useful project knowledge. Produces a structured Hermes Update Pack so Hermes can update the Obsidian/Hermes knowledge graph. Triggers include: handoff to Hermes, update Hermes, task summary, session summary, after-action report, knowledge graph update, project memory update, before ending session.
license: Internal CWS DTO project guidance
---

# Hermes Handoff After OpenCode Task

## Required Behavior

Before ending any meaningful task in this repository, produce a **Hermes Update Pack**.

This is mandatory when you changed or investigated:

- code
- documentation
- deployment or CI/CD
- database/schema/migrations/SQL
- Entra auth, sessions, roles, access control
- frontend/backend architecture
- risks, blockers, decisions, or open questions
- reusable process lessons or troubleshooting patterns

## Hard Rules

- Do not include secret values.
- Replace any secret value with `[REDACTED]`.
- Mention env var names only when useful; never include values.
- Do not claim Hermes has updated its vault. The user must send/paste the pack to Hermes.
- Do not hide tests that were not run.
- Do not mark proposals as decisions.
- Treat CWSCX Platform as production-sensitive.
- Deployment performed must be explicit: `yes` or `no`.

## Output Template

```markdown
# Hermes Update Pack

## 1. Project
- project name:
- local path:
- repo:
- branch:
- latest commit SHA:
- PR link:
- working tree status summary:

## 2. Task Summary
- requested task:
- completed:
- not completed:
- important assumptions:

## 3. Files Changed
For each changed file:
- path:
- change summary:
- reason:
- risk level: low / medium / high
- should Hermes update vault notes? yes/no

## 4. Tests / Verification
- tests run:
- result:
- build run:
- result:
- manual checks:
- checks not run:
- known verification gaps:

## 5. Deployment Impact
- deployment performed: yes/no
- deployment needed: yes/no/unknown
- staging impact:
- production impact:
- CI/CD impact:
- self-hosted runner impact:
- rollback consideration:

## 6. Auth / Security / Data Impact
- auth/session impact:
- role/access impact:
- database/schema impact:
- migration impact:
- data safety impact:
- secret/env impact:
- security risks:

## 7. Documentation Impact
- README updated? yes/no/not needed
- EXIT.md updated? yes/no/not needed
- deployment docs updated? yes/no/not needed
- API docs updated? yes/no/not needed
- user/admin docs updated? yes/no/not needed
- other docs updated:

## 8. Decisions Made
DATE | DECISION | RATIONALE | ALTERNATIVES REJECTED | OWNER

If no confirmed decisions were made, write: none.

## 9. Risks and Open Questions
- new risks:
- resolved risks:
- changed risks:
- open questions:
- blockers:

## 10. Skills / Process Lessons
- reusable lesson discovered? yes/no
- suggested skill update:
- exact lesson:
- where it should be recorded:

## 11. Suggested Hermes Knowledge Graph Updates
- project overview:
- technical architecture:
- deployment/CI-CD:
- risks/open questions:
- decision log:
- EXIT/handover:
- process/skills:
- import/work log:
```

## Final Instruction

End with:

> Send this Hermes Update Pack to Hermes so the project knowledge graph can be updated.
