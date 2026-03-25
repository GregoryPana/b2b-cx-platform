# Staging CI/CD Setup Guide (Self-Hosted Runner)

This guide explains how to set up and operate staging deployment automation.

Use this document when:

- provisioning a new staging VM
- onboarding a new DevOps owner
- troubleshooting deployment pipeline issues

## 1) Deployment model summary

- workflow: `.github/workflows/deploy-staging.yml`
- trigger: push to `main` or manual run
- CI jobs run on GitHub-hosted runners
- deploy job runs on self-hosted Linux runner in staging network
- deployment is local on VM (no SCP from developer machine)

## 2) Minimum requirements

### GitHub

- environment: `staging`
- secret: `STAGING_BASE_URL` (for verification and summary links)

### Staging VM

- Ubuntu/Linux host with internet access to GitHub
- `/opt/cwscx` present
- runner user can write `/opt/cwscx`
- Python 3.11+, Node 20+, rsync, unzip, zip installed
- Nginx installed
- SSL certificate files available for nginx script defaults:
  - `/etc/ssl/cwscx/cwscx.crt`
  - `/etc/ssl/cwscx/cwscx.key`

### Permissions

Runner user must have passwordless sudo for deployment commands.

## 3) Self-hosted runner setup

1. install GitHub runner on staging VM
2. register runner to repository
3. run as systemd service
4. ensure runner labels include at least:
   - `self-hosted`
   - `linux`

Recommended:

- keep runner online 24/7 via systemd service
- set restart policy to always

## 4) Folder baseline on staging VM

Expected baseline:

```text
/opt/cwscx/
  backend/
  frontends-src/
  scripts/linux/
  releases/
  shared/
  .env
```

If folders are missing, install script creates required paths.

## 5) One-time sudo setup

Example sudoers entry (adjust user as needed):

```text
Defaults:cxadmin !requiretty
cxadmin ALL=(ALL) NOPASSWD: /usr/bin/systemctl, /bin/systemctl, /usr/bin/bash, /bin/bash, /usr/sbin/nginx, /usr/bin/nginx
```

Validate with:

```bash
sudo visudo -cf /etc/sudoers.d/<file>
```

## 6) Backend runtime prerequisites

Create `/opt/cwscx/.env` using `.env.example` as baseline and set real values.

Required startup variables include:

- `DATABASE_URL`
- `ENTRA_TENANT_ID`
- `ENTRA_CLIENT_ID`
- `ENTRA_AUTHORITY`
- `ENTRA_ISSUER`
- `ENTRA_AUDIENCE`

## 7) First deployment validation

Run `deploy-staging` manually once after setup.

Success criteria:

- all CI jobs pass
- deploy job runs on self-hosted runner
- release zip is archived under `/opt/cwscx/releases`
- backend service healthy
- nginx config test passes
- key routes respond:
  - `/dashboard/`
  - `/surveys/b2b/`
  - `/surveys/installation/`
  - `/api/health`

## 8) Data preservation policy

Staging deploy is designed to preserve data:

- migration upgrades only (`alembic upgrade head`)
- database reset flags are blocked in deploy script
- no drop/reset step in normal pipeline

## 9) Rollback behavior

If verification fails:

1. workflow selects previous bundle in `/opt/cwscx/releases`
2. reinstalls previous bundle
3. reruns backend/frontend/nginx deploy steps
4. reruns verification

Recommendation:

- always keep several known-good bundles in `/opt/cwscx/releases`

## 10) Operations checklist (weekly)

- confirm runner is online
- check disk usage for `/opt/cwscx/releases`
- verify backend service uptime
- confirm cert validity for nginx SSL paths
- verify route health checks

## 11) Common issues and fixes

- Deploy job queued forever
  - check runner online state and required labels
- Permission denied under `/opt/cwscx`
  - fix ownership/permissions for runner user
- Sudo password prompt in workflow
  - fix NOPASSWD sudoers configuration
- Missing frontend dist artifact
  - inspect build step logs and bundle layout
- Route returns 500
  - inspect backend logs and nginx route mapping

## 12) References

- end-to-end flow: `docs/DEPLOYMENT_END_TO_END_GUIDE.md`
- canonical runbook: `ENTERPRISE_DEPLOYMENT_RUNBOOK.md`
- handover guide: `docs/HANDOVER_GUIDE.md`
- AI structuring source: `docs/AI_SKILL_DEPLOYMENT_SOURCE.md`
