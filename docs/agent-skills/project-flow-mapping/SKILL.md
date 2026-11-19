---
name: project-flow-mapping
description: Use when an agent must evidence-map an existing project's complete user, system, data, integration, operational, and delivery flows before planning or changing it.
version: 1.0.0
author: Gregory Panagary / Central Agent Skills
license: Internal Use
metadata:
  tags: [project-flow, repository-assessment, architecture, data-flow, traceability]
  category: software-development
  agents: [claude-code, codex, antigravity, opencode, hermes]
---

# Project Flow Mapping

## Purpose

Create an evidence-backed map of how a real project works across its full lifecycle. The output must distinguish implemented behaviour, documented intent, operational practice, inferred relationships, gaps, and unknowns. This is repository assessment first—not permission to change code.

Use for applications, APIs, automations, scripts, integrations, data products, websites, internal platforms, and mixed manual/digital workflows.

## Trigger

Load this skill when asked to:

- explain or map a project's end-to-end flow;
- assess how users, administrators, services, data, integrations, or operators interact;
- create a workflow, system, sequence, state, lifecycle, data-flow, or architecture artifact;
- understand a repository before substantial redesign, migration, architecture change, cross-cutting implementation, audit, handover, or deployment planning.

## Do Not Use When

- The task is a small, well-bounded change whose affected flow is already documented and traceable; perform targeted impact analysis instead.
- The user only wants a code explanation for one symbol, route, component, or test.
- The repository is unavailable and the only sources are unverified summaries; first obtain evidence or clearly limit the output to documented intent.
- A current approved flow map already covers the same boundary and live Git/runtime checks show no relevant drift; update only the affected slice.

## Safety and scope

1. Start read-only. Do not edit application, deployment, CI, database, secret, or runtime files merely to produce a map.
2. Inspect the live repository state before relying on handoffs or documentation.
3. Never expose secrets, credentials, personal records, customer data, exact sensitive values, or private operational details in a shareable artifact.
4. Separate local, committed, pushed, deployed, validated, accepted, and handed-over states.
5. Project-specific instructions and approved policies override this skill.
6. Treat names and filenames as leads, not proof. Cite the actual implementation or authoritative documentation behind every material claim.

## Required discovery

### 1. Establish the evidence boundary

Record:

- repository path, branch, HEAD, remote relationship, and dirty-worktree boundary;
- whether the assessment covers local code, a deployed environment, documentation, or a combination;
- files and runtime surfaces inspected;
- checks that were unavailable or blocked.

Use the repository's preferred code-intelligence system first when configured. Fall back to targeted search and file reads when it is unavailable, stale, or insufficient.

### 2. Read governing context

Inspect, where present:

- `AGENTS.md`, `CLAUDE.md`, `OPENCODE.md`, `README.md`;
- scope, architecture, data model, privacy/access, operations, deployment, API, test, and tracker documents;
- entrypoints, route registries, controllers/handlers, services, jobs, schemas/models, migrations, clients, and configuration examples;
- CI/CD definitions, infrastructure/deployment files, health/readiness checks, backup/restore and handover documentation.

Resolve contradictions by precedence and evidence. Do not silently blend historical design with current implementation.

### 3. Identify actors and boundaries

Map all materially different actors, including:

- public/anonymous users;
- authenticated users and role variants;
- administrators, reviewers, operators, support, and approvers;
- external services, identity providers, schedulers, queues, devices, and data sources;
- deployment/runtime components and manual operational actors.

Mark trust, authentication, authorization, privacy, environment, network, and organisational boundaries.

### 4. Trace every flow class

Assess each applicable class:

1. **User journeys** — entry, navigation, actions, decisions, completion, cancellation, recovery, and accessibility/device variants.
2. **Administrative journeys** — configuration, review, approval, correction, reporting, export, and closeout.
3. **System/request flows** — route or event entrypoint, validation, authorization, service calls, persistence, response, and side effects.
4. **Data lifecycle** — origin, collection, transformation, storage, linkage, retention, export, backup, restore, archival, and deletion.
5. **State lifecycle** — valid states, transitions, guards, retries, idempotency, duplicate handling, timeout, rollback, and terminal states.
6. **Integration flows** — authentication, payload direction, retries, rate limits, failure isolation, reconciliation, and ownership.
7. **Error and recovery flows** — invalid input, unauthorised access, dependency failure, partial completion, offline behaviour, retry, support, and recovery.
8. **Operational flows** — setup, configuration, monitoring, alerting, incident response, backup/restore, maintenance, and handover.
9. **Delivery flows** — local development, validation, branch/review, build, artifact, migration, deployment, smoke checks, promotion, rollback, and acceptance.
10. **Manual/off-system flows** — spreadsheets, paper, email, approval, data entry, or human controls that materially affect the system.

If a class is not applicable, state why. If evidence is missing, mark it unknown rather than inventing a flow.

## Evidence classification

Label every mapped element as one of:

- **Implemented** — directly supported by current code/config evidence.
- **Runtime-verified** — exercised against a running environment during this assessment.
- **Documented intent** — specified but not confirmed in current implementation.
- **Operational policy** — a human/process requirement outside application code.
- **Inferred** — a bounded interpretation that needs confirmation.
- **Gap** — expected or documented behaviour is absent, contradictory, or incomplete.
- **Unknown/TBC** — evidence is insufficient.

Include source paths and, where useful, symbols, routes, jobs, tables, or sections. Avoid false precision when line numbers may drift.

## Required outputs

Produce all of the following unless the user narrows the request:

### A. Executive flow summary

- project purpose and assessed boundary;
- primary actors and value path;
- major systems/data stores/integrations;
- highest-risk gaps and unknowns.

### B. Flow inventory

For each flow:

- ID and name;
- actor/trigger;
- preconditions;
- ordered steps;
- decisions and branches;
- system/data side effects;
- success/terminal state;
- errors, recovery, and retries;
- evidence status and citations;
- gaps/unknowns.

### C. Traceability matrix

Map:

`actor → interface/entrypoint → route/event/job → service/handler → data/integration → resulting state → evidence`

### D. Visual map

Choose the lowest-complexity format that remains truthful:

- workflow/flowchart for business and user journeys;
- sequence diagram for request/integration interaction;
- state diagram for lifecycle-heavy behaviour;
- data-flow/lineage diagram for information movement;
- architecture view for runtime/trust boundaries;
- interactive HTML when multiple roles, phases, filters, details, or evidence layers need exploration.

When a validated diagram renderer such as Archify is available, prefer it for factual technical diagrams. Otherwise use Mermaid, editable diagram source, or self-contained HTML. Do not produce a decorative diagram that omits exceptions, evidence status, or important boundaries.

### E. Gap and decision register

List contradictions, unimplemented intent, security/privacy risks, operational gaps, open decisions, and the evidence needed to close each item. Do not convert a gap into implementation scope without owner approval.

## Interactive HTML requirements

When HTML is requested:

- provide role and lifecycle filters;
- support search and compact/detailed views;
- make steps selectable for evidence, inputs, effects, next states, exceptions, and gaps;
- show trust/data/environment boundaries;
- distinguish evidence classifications visually and textually;
- be responsive and keyboard-usable;
- avoid external dependencies when a portable single file is practical;
- do not embed secrets or sensitive records.

## Verification

Before completion:

- [ ] Repository state and assessment boundary are recorded.
- [ ] Governing instructions and authoritative project docs were read.
- [ ] Entrypoints were traced into handlers/services/data rather than inferred from route names.
- [ ] Applicable user, admin, system, data, state, integration, failure, operational, delivery, and manual flows were assessed.
- [ ] Authentication, authorization, privacy, trust, and environment boundaries are visible.
- [ ] Implemented, runtime-verified, documented, operational, inferred, gap, and unknown states are not conflated.
- [ ] Material claims cite repository evidence.
- [ ] The visual source is editable and the rendered artifact was opened or validated.
- [ ] Interactive controls were exercised; browser console and responsive layout were checked when HTML was produced.
- [ ] No application/runtime changes, commits, pushes, or deployments occurred unless separately approved.

## Common Failure Modes

- **Drawing before tracing:** a visually plausible map is produced from filenames or route labels. Mitigation: trace entrypoints through handlers, services, data, integrations, and resulting states first.
- **Treating documentation as implementation:** historical or planned behaviour is shown as live. Mitigation: apply the evidence classifications to every material element.
- **Ignoring non-happy paths:** retries, offline behaviour, duplicate handling, partial failure, rollback, and support are omitted. Mitigation: assess the error/recovery and operational flow classes explicitly.
- **Making every task heavyweight:** a full-project map is demanded for a tiny isolated change. Mitigation: follow `Do Not Use When` and update only the affected flow slice when a current map exists.
- **Leaking sensitive detail:** secrets, personal records, internal endpoints, or exact sensitive values enter a shareable artifact. Mitigation: redact or abstract them while preserving boundary and ownership information.
- **Assuming central-path access:** an agent is told about a skill file it cannot read. Mitigation: prefer the repo-local copy and verify readability before assessment.

## Expected handoff

Report:

- files/artifacts created;
- evidence boundary and key sources;
- verification actually performed;
- unresolved gaps/unknowns;
- whether the map is current-local, deployed, or mixed evidence;
- the next owner decision before any implementation.
