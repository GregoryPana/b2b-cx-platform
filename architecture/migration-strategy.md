# Migration Strategy

## Principles
- Deterministic, repeatable migrations.
- Safe for segmented production.
- No destructive changes without explicit rollback plan.

## Process
- Versioned migrations in backend.
- Apply migrations during deployment.
- Verify schema post-migration with health checks.

## Constraints
- No direct DB access from frontend.
- Strong relational integrity is required.
