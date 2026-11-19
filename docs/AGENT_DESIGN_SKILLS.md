# Agent Design Skills — CWS CX B2B Platform

OpenCode and Claude implement this project. Hermes may orchestrate and select a design route, but the coding agent working in the repository must read and apply the project sources below.

## Policy and route

Do not load every design skill. Before substantial frontend/UI work, record:

```text
Design route
- Domain/product skill: CWS CX/B2B operational platform
- Visual direction: docs/design/DESIGN_SYSTEM.md
- Component/implementation skill: existing frontend stack
- Motion: CSS/restraint | Emil required | not relevant
- Interface polish: required | optional | not relevant — reason
- Final verification: frontend design quality gate
```

## Required sources and default bundle

1. `AGENTS.md`, the current agent adapter, and task-specific project skills.
2. `docs/design/DESIGN_SYSTEM.md` as the authoritative project design source.
3. **CWS SaaS Product UI** for role-based workflow clarity, surveys, dashboards, forms, tables, analytics and operational states.
4. Existing frontend component conventions; use shadcn guidance only where it matches the actual stack.
5. **Impeccable Frontend Craft** for static/structural implementation craft and evidence-based polish.
6. **Frontend Design Quality Gate** before implemented UI is accepted.

Optional: **Emil Kowalski Motion Polish** for state transitions and micro-interactions. Keep repeated assessor, dashboard and survey workflows fast and restrained. Use style exploration, GSAP or mobile-specific guidance only when justified by the task.

## Agent-agnostic source resolution

Central roots:

```text
WSL:     /mnt/c/Users/gpanagary/central-agent-skills
Windows: C:\Users\gpanagary\central-agent-skills
```

| Capability | Project minimum | Central agent skill | Hermes-local full source |
|---|---|---|---|
| CX/B2B workflow/design | `docs/design/DESIGN_SYSTEM.md` and project rules | No complete central equivalent | `/home/gpanagary/.hermes/skills/creative/cws-saas-product-ui/SKILL.md` |
| Component implementation | Existing frontend components and tokens | No central equivalent currently | `/home/gpanagary/.hermes/skills/software-development/shadcn-ui-components/SKILL.md` only where applicable |
| Static interface craft | This file and project design system | `skills/design/impeccable-frontend-craft/SKILL.md` | `/home/gpanagary/.hermes/skills/creative/interface-polish-engineering/SKILL.md` |
| Motion | Restrained operational-feedback rule | `skills/design/emil-kowalski-motion-polish/SKILL.md` | `/home/gpanagary/.hermes/skills/software-development/gsap-web-animation/SKILL.md` only for justified complex motion |
| Visual/mobile direction | Project design system and current responsive patterns | No complete central equivalent | Use applicable Hermes style/mobile skills only when needed |
| Final QA | Completion standard below | Impeccable supplies craft review only | `/home/gpanagary/.hermes/skills/software-development/frontend-design-quality-gate/SKILL.md` |

If a named central or Hermes source is inaccessible, apply the embedded project minimum, report the missing source, and do not claim its full checklist was performed.

## Completion standard

Before claiming frontend/UI work complete:

- run applicable lint, typecheck, tests, and build;
- inspect all changed routes/components in a browser;
- check console and failed network requests;
- check mobile/tablet/desktop behavior appropriate to assessor and dashboard surfaces;
- verify forms, analytics, tables, loading, empty, error, success, permission, and auth-adjacent states affected by the change;
- verify focus, labels, keyboard use, contrast, and reduced motion;
- record the interface-polish decision and inspected evidence;
- report what was verified, what was not, and any auth/data/analytics/deployment impact.
