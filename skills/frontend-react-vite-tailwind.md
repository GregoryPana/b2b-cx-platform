# Frontend React Vite Tailwind Skill

## Purpose

Use this skill to build or refine frontends in a consistent, maintainable way across survey and dashboard applications.

## Use When

- adding a new frontend screen
- fixing state flow or platform-switch issues
- improving user feedback, clarity, or responsiveness
- aligning UI with shared standards

## Rules

- prefer TypeScript for new frontend work
- follow the shared visual and UX rules
- avoid stale request/state bleed between screens or platforms
- use clear save/submit states and meaningful user feedback
- preserve existing design language where already established

## Process

1. inspect current app structure and existing patterns
2. identify user flow and where state is stored
3. implement the smallest correct change
4. add helpful feedback: toasts, status, helper text, disabled states
5. verify mobile and desktop behavior
6. build the frontend before finishing

## Common Failure Patterns

- stale bundle after deploy
- wrong Vite base path
- requests updating state after platform switch
- no visual confirmation after save
- hidden active navigation state

## References

- `docs/design/FRONTEND_UI_UX_STANDARDS.md`
- `frontend/dashboard-blueprint/`
- `frontend/survey/`
- `frontend/installation-survey/`
- `frontend/mystery-shopper/`
