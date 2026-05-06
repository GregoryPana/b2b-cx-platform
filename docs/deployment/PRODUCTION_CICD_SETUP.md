# Production CI/CD Setup Guide (Self-Hosted Runner)

This guide explains how to prepare the production Application Frontend VM so GitHub Actions can deploy to it from inside the internal network.

Current production target VM:
- Hostname: `cwscx-app01`
- FQDN: `cwscx-app01.cwsey.com`
- IP: `172.17.1.211`

## 1) Deployment model summary

- workflow: `.github/workflows/deploy-production.yml`
- trigger: manual only (`workflow_dispatch`)
- CI/build steps run on the production self-hosted runner
- deploy runs locally on the production VM
- no SCP from public GitHub runners
- no SSH from public GitHub runners

This is required because the production VM is internal-only.

## 2) Minimum requirements

### GitHub
- environment: `production`
- secret: `PRODUCTION_BASE_URL`

### Production VM
- Ubuntu/Linux host with internet access to GitHub
- `/opt/cwscx` present and writable by runner user
- Python 3.11+ / 3.12 acceptable
- Node available for release bundle build
- rsync, unzip, zip, git, curl installed
- nginx installed
- TLS files available at:
  - `/etc/ssl/cwscx/cwscx.crt`
  - `/etc/ssl/cwscx/cwscx.key`
- Docker installed if local PostgreSQL container is part of the runtime

## 3) Prepare the production VM runtime

Current agreed model:
- backend: systemd-managed Python process
- frontends: static built assets served by nginx
- database: local Docker PostgreSQL container on `cwscx-app01`

Required local paths:

```text
/opt/cwscx/
  backend/
  docker-compose.yml
  frontends-src/
  scripts/linux/
  releases/
  shared/
  .env
```

## 4) Production self-hosted runner setup

### 4.1 Create the runner working directory

```bash
mkdir -p ~/actions-runner
cd ~/actions-runner
```

### 4.2 Download the GitHub runner package

Use the latest Linux x64 runner package from GitHub Actions releases.

Example:

```bash
curl -o actions-runner-linux-x64.tar.gz -L https://github.com/actions/runner/releases/download/v2.327.1/actions-runner-linux-x64-2.327.1.tar.gz
tar xzf ./actions-runner-linux-x64.tar.gz
```

### 4.3 Register the runner

In GitHub:
1. open the repository
2. go to **Settings** -> **Actions** -> **Runners**
3. click **New self-hosted runner**
4. choose **Linux** and **x64**
5. copy the registration command shown by GitHub

Run the config command on `cwscx-app01`.

Recommended runner labels:
- `self-hosted`
- `linux`
- `production`

Example interactive command structure:

```bash
./config.sh --url https://github.com/<owner>/<repo> --token <runner-token>
```

When prompted:
- runner name: `cwscx-app01-production-runner`
- labels: `self-hosted,linux,production`
- work folder: `_work`

### 4.4 Install as a service

```bash
sudo ./svc.sh install
sudo ./svc.sh start
```

### 4.5 Verify runner status

```bash
sudo ./svc.sh status
```

Then confirm in GitHub UI that the runner is online.

## 5) One-time sudo setup for the runner user

The runner user must be able to run deployment scripts that call `systemctl`, `nginx`, and privileged bash scripts.

Example sudoers entry for `cxadmin`:

```text
Defaults:cxadmin !requiretty
cxadmin ALL=(ALL) NOPASSWD: /usr/bin/systemctl, /bin/systemctl, /usr/bin/bash, /bin/bash, /usr/sbin/nginx, /usr/bin/nginx
```

Validate with:

```bash
sudo visudo -cf /etc/sudoers.d/<file>
```

## 6) Production database runtime notes

Current intended production database runtime:
- compose file: `/opt/cwscx/docker-compose.yml`
- compose service: `postgres`
- container name: `cwscx-postgres`
- host port exposure: `5433 -> 5432`

Current access expectations:
- local backend uses `localhost:5433`
- observability VM reaches DB at `cwscx-app01.cwsey.com:5433`

Useful checks:

```bash
docker compose -f /opt/cwscx/docker-compose.yml ps
docker ps --format 'table {{.Names}}\t{{.Ports}}'
ss -ltnp | grep 5433
```

## 7) Required production environment file

The deploy scripts expect:

```text
/opt/cwscx/.env
```

At minimum it must contain valid values for:
- `ENVIRONMENT=production`
- `DATABASE_URL`
- `CORS_ALLOW_ORIGINS`
- `ENTRA_TENANT_ID`
- `ENTRA_CLIENT_ID`
- `ENTRA_AUTHORITY`
- `ENTRA_ISSUER`
- `ENTRA_AUDIENCE`

## 8) Required GitHub production settings

Current production workflow should use:
- environment: `production`
- secret: `PRODUCTION_BASE_URL`

Because deployment is local to the runner, SSH/SCP secrets are no longer the primary path for deployment execution.

## 9) First production validation

Before the first real production deploy:

1. ensure runner is online in GitHub
2. ensure `/opt/cwscx/.env` exists and is populated
3. ensure local DB container is up
4. ensure TLS files exist
5. ensure nginx is installed and healthy
6. ensure `docker compose -f /opt/cwscx/docker-compose.yml ps` works

## 10) References

- staging deploy model: `docs/deployment/STAGING_CICD_SETUP.md`
- end-to-end deploy flow: `docs/deployment/DEPLOYMENT_END_TO_END_GUIDE.md`
- current deployment runbook: `docs/deployment/ENTERPRISE_DEPLOYMENT_RUNBOOK.md`
- current platform handover: `docs/operations/HANDOVER_GUIDE.md`
