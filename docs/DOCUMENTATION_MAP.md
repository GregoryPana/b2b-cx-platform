# Documentation Map

This document shows how the active documentation in this repo fits together, what each section is for, and what order new contributors should read it in.

## Visual Map

```mermaid
flowchart TD
    INDEX[docs/INDEX.md]\nMain documentation entry point
    MAP[docs/DOCUMENTATION_MAP.md]\nVisual guide to the docs

    INDEX --> MAP
    INDEX --> ARCH[docs/architecture/] 
    INDEX --> DEPLOY[docs/deployment/]
    INDEX --> OPS[docs/operations/]
    INDEX --> FEAT[docs/features/]
    INDEX --> REF[docs/reference/]
    INDEX --> DESIGN[docs/design/]
    INDEX --> ARCHIVE[docs/archive/]

    OPS --> HANDOVER[HANDOVER_GUIDE.md]
    OPS --> ENTRA[ENTRA_SESSION_POLICY.md]
    OPS --> MOPS[MYSTERY_SHOPPER_OPERATIONS_GUIDE.md]
    OPS --> AISKILL[AI_SKILL_DEPLOYMENT_SOURCE.md]

    FEAT --> MYSTERYPLAN[MYSTERY_SHOPPER_IMPLEMENTATION_PLAN.md]
    FEAT --> MYSTERYLOG[MYSTERY_SHOPPER_AND_PLATFORM_TROUBLESHOOTING_LOG.md]
    FEAT --> INSTALLPLAN[features/installation/INSTALLATION_ASSESSMENT_PLAN.md]

    DEPLOY --> E2E[DEPLOYMENT_END_TO_END_GUIDE.md]
    DEPLOY --> STAGING[STAGING_CICD_SETUP.md]
    DEPLOY --> RUNBOOK[ENTERPRISE_DEPLOYMENT_RUNBOOK.md]

    ARCH --> ROLES[role-authorization-matrix.md]
    ARCH --> TOPO[deployment-topology.md]
    ARCH --> JWT[jwt-validation-contract.md]
    ARCH --> VISITS[visit-lifecycle.md]

    REF --> QB2B[questions-b2b.md]
    REF --> QINSTALL[questions-installation.md]
    REF --> QMYSTERY[questions-mystery-shopper.md]

    DESIGN --> DSMAP[DESIGN_SYSTEM_MAP.md]
    DESIGN --> UX[UX DESIGN GUIDE.md]
    DESIGN --> UI[FRONTEND_UI_UX_STANDARDS.md]

    ARCHIVE --> OLD[Historical / superseded material]
```

## What Each Section Contains

### `docs/INDEX.md`
- Primary starting point for active documentation.
- Best first stop if you are new to the repo.

### `docs/architecture/`
- Source-of-truth technical behavior and system contracts.
- Includes:
  - role model
  - deployment topology
  - auth/JWT behavior
  - visit lifecycle
  - approval/review state behavior

### `docs/deployment/`
- How code gets built, deployed, verified, and rolled back.
- Includes:
  - end-to-end deployment flow
  - staging CI/CD setup
  - deployment runbook
  - database migration guidance

### `docs/operations/`
- Day-to-day operational guidance.
- Includes:
  - handover material
  - Entra session behavior
  - Mystery Shopper operational workflow
  - deployment-oriented AI/source notes
- Also the best place for future cross-environment monitoring / alert-triage documentation.

### `docs/features/`
- Implementation plans, feature-specific notes, and troubleshooting history.
- Includes the main Mystery Shopper planning and troubleshooting documents.

### `docs/reference/`
- Stable reference material.
- Includes:
  - question sets
  - Entra group/object references

### `docs/design/`
- UI, UX, and design-system guidance.
- Useful when working on frontend behavior or visual consistency.

### `docs/archive/`
- Historical material.
- Keep for background context only.
- Do not treat archive documents as the current source of truth unless an active doc explicitly points back to them.

## Source Of Truth Guide

Use these as the main current references:

- Platform overview and doc navigation:
  - `docs/INDEX.md`
- Operational handoff and current runtime notes:
  - `docs/operations/HANDOVER_GUIDE.md`
- Current role/access model:
  - `docs/architecture/role-authorization-matrix.md`
- Current deploy/runtime topology:
  - `docs/architecture/deployment-topology.md`
- Current deploy flow:
  - `docs/deployment/DEPLOYMENT_END_TO_END_GUIDE.md`
- Mystery Shopper implementation direction:
  - `docs/features/MYSTERY_SHOPPER_IMPLEMENTATION_PLAN.md`
- Mystery/platform troubleshooting history:
  - `docs/features/MYSTERY_SHOPPER_AND_PLATFORM_TROUBLESHOOTING_LOG.md`

## Recommended Reading Order

### New developer
1. `docs/INDEX.md`
2. `docs/DOCUMENTATION_MAP.md`
3. `docs/operations/HANDOVER_GUIDE.md`
4. `docs/architecture/role-authorization-matrix.md`
5. `docs/architecture/deployment-topology.md`
6. `docs/deployment/DEPLOYMENT_END_TO_END_GUIDE.md`

### Working on Mystery Shopper
1. `docs/features/MYSTERY_SHOPPER_IMPLEMENTATION_PLAN.md`
2. `docs/features/MYSTERY_SHOPPER_AND_PLATFORM_TROUBLESHOOTING_LOG.md`
3. `docs/operations/MYSTERY_SHOPPER_OPERATIONS_GUIDE.md`
4. `docs/reference/questions-mystery-shopper.md`

### Working on deployment / operations
1. `docs/operations/HANDOVER_GUIDE.md`
2. `docs/deployment/DEPLOYMENT_END_TO_END_GUIDE.md`
3. `docs/deployment/ENTERPRISE_DEPLOYMENT_RUNBOOK.md`
4. `docs/architecture/ci-cd-flow.md`

## Notes

- Active docs describe the current intended runtime behavior.
- Archive docs provide useful history, but may contain outdated paths, workflows, or assumptions.
- When active docs and archived docs disagree, prefer the active docs.
