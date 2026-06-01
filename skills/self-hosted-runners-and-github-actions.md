# Self-Hosted Runners And GitHub Actions Skill

## Purpose

Use this skill to set up or fix self-hosted runner based CI/CD for internal or restricted environments.

## Use When

- a VM must run deploy jobs locally
- staging or production is internal-only
- runner labels or workflow targeting are wrong
- deploys are landing on the wrong runner

## Rules

- use explicit runner labels for environment-specific deploys
- do not rely on broad `self-hosted, linux` labels when multiple runners can match
- verify exact host identity during deploy if misrouting has happened before
- do not assume secrets choose the execution host; `runs-on` does that

## Process

1. identify the target VM and runner name
2. define unique labels such as `production`, `staging`, or host-specific labels
3. register or re-register the runner with those labels
4. update workflow `runs-on`
5. add workspace hardening: exact commit checkout and `git clean -ffdx`
6. confirm service is installed and online

## Verification

- runner service is active via `systemctl`
- GitHub UI shows runner online
- workflow waits for the correct labels only
- deploy lands on the intended hostname

## References

- `INTERNAL DEV KIT/02_CICD_AND_REPO_STANDARD.md`
- `docs/deployment/STAGING_CICD_SETUP.md`
- `docs/deployment/PRODUCTION_CICD_SETUP.md`
- `.github/workflows/deploy-staging.yml`
- `.github/workflows/deploy-production.yml`
