# Rollback Procedure

## Trigger Conditions
- Deployment fails health checks.
- Authorization or workflow regression.
- Migration failure.

## Steps
- Stop faulty containers.
- Revert to last known-good container image.
- Apply rollback migration if needed.
- Re-run smoke tests.
- Log rollback event and reason.
