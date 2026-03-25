# Staging CI/CD Setup Checklist

This checklist is for fully automated staging deploys from GitHub Actions.

## Deployment mode

- `deploy-staging` is the primary workflow.
- It requires a self-hosted runner on the staging VM/network with labels: `self-hosted`, `linux`.
- Optional: add `staging` custom label for runner organization, but deployment workflow does not require it.
- Deployment is executed locally on that runner (no SSH copy from GitHub-hosted runners).

## 1) GitHub Environment

Create GitHub environment: `staging`.

Add required secrets:

- `STAGING_BASE_URL` (example: `https://cwscx-tst01.cwsey.com`)

## 2) VM prerequisites

On the staging VM:

- `/opt/cwscx` exists and writable by deploy user
- Nginx installed and enabled
- Python 3.11+ available
- Docker available (if running DB locally via compose)
- SSL cert/key present for Nginx deploy script defaults:
  - `/etc/ssl/cwscx/cwscx.crt`
  - `/etc/ssl/cwscx/cwscx.key`

## 3) Backend runtime prerequisites

- `/opt/cwscx/.env` exists with valid values for staging
- Entra values are set (`ENTRA_*`)
- DB connectivity works from VM (`DATABASE_URL`)

## 4) First validation run

Trigger `deploy-staging` manually using workflow dispatch.

Expected:

- Bundle uploaded to `/tmp/cwscx-release.zip`
- Bundle archived in `/opt/cwscx/releases/`
- Backend deploy runs when backend changed
- Frontend validation runs when frontend changed
- Nginx deploy runs
- `scripts/linux/verify_staging.sh` passes

## 5) Rollback behavior

If deploy verification fails:

- Pipeline attempts rollback using previous bundle in `/opt/cwscx/releases/`
- Re-runs backend/frontend/nginx deploy steps on rollback target

If no previous bundle exists, rollback cannot run. Keep at least one known-good release bundle in `/opt/cwscx/releases/`.
