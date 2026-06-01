# Deploy Verify Rollback Skill

## Purpose

Use this skill to run or design safe deploys with deterministic verification and rollback behavior.

## Use When

- creating deploy scripts
- diagnosing failed deploys
- hardening verification checks
- implementing rollback based on archived release bundles

## Rules

- deploy exact triggering commit only
- clean self-hosted runner workspace before build
- verify health and route checks after deploy
- keep previous release bundle for rollback
- do not rely on manual laptop copy as normal deployment

## Process

1. verify workflow targeting and runner labels
2. harden workspace
3. build release bundle
4. archive bundle on target host
5. install bundle
6. deploy backend, frontends, nginx
7. verify health, routes, and assets
8. rollback to previous bundle if required

## Common Failure Patterns

- wrong runner target
- asset 404 after deploy
- stale index.html vs asset mismatch
- rollback blocked by permissions

## References

- `docs/deployment/DEPLOYMENT_END_TO_END_GUIDE.md`
- `docs/deployment/ENTERPRISE_DEPLOYMENT_RUNBOOK.md`
- `scripts/linux/`
