# Hermes Handoff After OpenCode Task Skill

## Purpose

Use this skill at the end of every meaningful OpenCode task so Hermes can update the CWS DTO / CWSCX knowledge graph, decision log, risk notes, architecture notes, and handover state.

This skill prevents project knowledge from staying trapped inside a single OpenCode session.

## Use When

Use this skill before ending any OpenCode session that does any of the following:

- changes code
- changes documentation
- changes deployment scripts or CI/CD workflows
- changes database schema, migrations, seed data, or SQL scripts
- changes authentication, authorization, roles, sessions, or Entra behavior
- changes architecture or runtime topology
- creates, resolves, or changes a risk
- confirms or rejects a decision
- discovers a reusable troubleshooting pattern
- leaves open questions, blockers, or follow-up work

Also use it after read-only investigations if the investigation produced new project knowledge Hermes should preserve.

## Inputs Required

Gather these before writing the handoff:

- current branch
- latest commit SHA if committed
- PR link if opened
- `git status --short`
- list of files changed
- summary of tests/builds/checks run
- any deployment, auth, data, or migration impact
- any docs or EXIT.md impact
- any confirmed decisions
- any new/resolved risks
- any reusable process lesson or skill update needed

Never include secret values.

## Rules

- Do not include API keys, passwords, tokens, cookies, private keys, connection strings, `.env` values, production credentials, or secret-bearing logs.
- Secret names and environment variable names may be mentioned; values must be `[REDACTED]`.
- Be specific. Avoid vague phrases like “updated some files” or “fixed issues”.
- Distinguish confirmed facts from assumptions.
- Distinguish completed work from proposed next steps.
- If no tests were run, say so directly and explain why.
- If a deployment was not performed, say “deployment performed: no”.
- If production impact is possible, mark it explicitly.
- If the work touched CWSCX Platform, assume production sensitivity by default.
- Do not claim Hermes has updated its vault. Hermes can only update its knowledge graph after the handoff is pasted or sent to Hermes.

## Process

1. Stop making changes.
2. Inspect repo state non-destructively.
3. Summarize the task outcome.
4. List changed files with risk classification.
5. Record tests and verification.
6. Identify deployment, auth, data, migration, and security impact.
7. Identify documentation and EXIT.md impact.
8. Record confirmed decisions only.
9. Record risks, open questions, and blockers.
10. Identify reusable lessons or skill updates.
11. Produce the Hermes Update Pack below.
12. Tell Gregory to paste/send the pack to Hermes for vault update.

## Hermes Update Pack Template

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
Use this exact format for confirmed decisions only:

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

## Verification

The handoff is complete only if:

- all 11 sections are present
- changed files are listed individually
- tests/checks are explicit
- deployment/auth/data/security impact is explicit
- secrets are redacted
- decisions are not mixed with proposals
- Hermes update targets are named

## Common Failure Patterns

- Ending with a generic summary instead of the structured update pack.
- Omitting tests not run.
- Forgetting deployment impact.
- Forgetting auth/data/security impact.
- Claiming a decision was made when it was only proposed.
- Hiding risk because the task “worked locally”.
- Including `.env` values or secret-bearing log snippets.

## References

- `skills/INSTALL_AND_USE.md`
- `skills/EXAMPLE_PROMPTS.md`
- `skills/documentation-exit-handover.md`
- `EXIT.md`
- Hermes vault project note: `CWSCX Platform - Overview`
