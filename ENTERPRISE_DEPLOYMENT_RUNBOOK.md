# CWSCX Enterprise Deployment Runbook (Artifact-Based)

This is the canonical deployment guide for staging/prod-style rollout.

It replaces ad-hoc source-copy instructions and enforces artifact-based deployment.

## Scope and target layout

Server root:

```text
/opt/cwscx/
  backend/
    app/
    logs/
    venv/
  frontends-src/
    public/
      mystery-shopper/
    dashboard/
    internal-surveys/
      b2b/
      installation/
  scripts/
    linux/
  shared/
  .env
```

Network/routes:

- `/` -> mystery shopper (`/opt/cwscx/frontends-src/public/mystery-shopper/dist`)
- `/dashboard/` -> dashboard (`/opt/cwscx/frontends-src/dashboard/dist`)
- `/surveys/b2b/` -> b2b survey (`/opt/cwscx/frontends-src/internal-surveys/b2b/dist`)
- `/surveys/installation/` -> installation survey (`/opt/cwscx/frontends-src/internal-surveys/installation/dist`)
- `/api/*` -> FastAPI backend `127.0.0.1:8000`

---

## 1) One-time VM preparation

Run as root:

```bash
apt update
apt install -y nginx python3 python3-venv python3-pip rsync unzip ca-certificates curl gnupg

# Docker Engine (required for PostgreSQL)
# If Docker is already installed, skip this block.
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo $VERSION_CODENAME) stable" \
  | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

mkdir -p /opt/cwscx/backend/app
mkdir -p /opt/cwscx/backend/logs
mkdir -p /opt/cwscx/backend/venv
mkdir -p /opt/cwscx/frontends-src/public/mystery-shopper
mkdir -p /opt/cwscx/frontends-src/dashboard
mkdir -p /opt/cwscx/frontends-src/internal-surveys/b2b
mkdir -p /opt/cwscx/frontends-src/internal-surveys/installation
mkdir -p /opt/cwscx/shared
mkdir -p /opt/cwscx/scripts/linux

# Optional: location for release bundle archives (rollback)
mkdir -p /opt/cwscx/releases

chown -R cxadmin:www-data /opt/cwscx

# Allow cxadmin to run docker without sudo (re-login required)
usermod -aG docker cxadmin
```

---

## 2) Create release bundle on Windows (local machine)

From repo root in PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\build_release_bundle.ps1
```

Expected artifact:

- `%TEMP%\cwscx-release.zip`

Bundle contains:

- backend release files
- built frontend `dist` artifacts only
- linux deploy scripts
- `.env.example`

---

## 3) Upload release bundle to VM

From local PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\upload_release_bundle.ps1
```

Default upload target:

- `cxadmin@172.17.1.213:/tmp/cwscx-release.zip`

---

## 4) Install bundle into `/opt/cwscx` on VM

On VM:

```bash
cd /opt/cwscx
bash scripts/linux/install_release_bundle.sh /tmp/cwscx-release.zip
```

This script:

- syncs backend files to `/opt/cwscx/backend`
- syncs frontend dist artifacts to their required app directories
- syncs linux scripts to `/opt/cwscx/scripts/linux`
- creates `/opt/cwscx/.env` from `.env.example` if missing

---

## 5) Configure database and environment

### PostgreSQL (Docker)

```bash
cd /opt/cwscx

# Docker Postgres container
docker compose up -d
```

Expected docker-compose.yml (example):

```yaml
version: '3.8'
services:
  postgres:
    image: postgres:16
    container_name: cwscx-postgres
    environment:
      POSTGRES_DB: cwscx-postgres
      POSTGRES_USER: cxadmin
      POSTGRES_PASSWORD: cxadmin123
    ports:
      - "5433:5432"
    volumes:
      - cwscx_data:/var/lib/postgresql/data
    restart: unless-stopped

volumes:
  cwscx_data:
```

Database credentials (docker-compose):

- `POSTGRES_DB=cwscx-postgres`
- `POSTGRES_USER=cxadmin`
- `POSTGRES_PASSWORD=cxadmin123`
- Host port: `5433` (container port `5432`)

### Environment file

Edit `/opt/cwscx/.env`:

```dotenv
ENVIRONMENT=staging
DATABASE_URL=postgresql://cxadmin:cxadmin123@localhost:5433/cwscx-postgres

CORS_ALLOW_ORIGINS=https://cwscx-tst01.cwsey.com
CORS_ALLOW_ORIGIN_REGEX=

ENTRA_TENANT_ID=<tenant_id>
ENTRA_CLIENT_ID=<api_client_id>
ENTRA_AUTHORITY=https://login.microsoftonline.com/<tenant_id>
ENTRA_ISSUER=https://login.microsoftonline.com/<tenant_id>/v2.0
ENTRA_AUDIENCE=api://<api_client_id>
ENTRA_DEBUG=false
```

Notes:

- The API is protected by Microsoft Entra ID. Clients must send `Authorization: Bearer <access_token>`.
- Without a bearer token, protected endpoints return `403 Not authenticated`.

Backend service uses:

- Systemd unit: `/etc/systemd/system/cwscx-backend.service`
- Environment file: `/opt/cwscx/backend/backend/.env`

---

## 6) Deploy backend service

On VM:

```bash
cd /opt/cwscx
bash scripts/linux/deploy_backend.sh
```

This installs Python dependencies, runs migrations, and creates/starts systemd service:

- `cwscx-backend.service`

Health check:

```bash
curl -s http://127.0.0.1:8000/health
```

---

## 7) Validate frontend artifacts

On VM:

```bash
cd /opt/cwscx
bash scripts/linux/deploy_frontends.sh
```

This does not build. It validates required `dist/index.html` exists for each frontend.

---

## 8) Deploy Nginx config

On VM:

```bash
cd /opt/cwscx
sudo bash scripts/linux/deploy_nginx.sh
```

Nginx routes (generated by deploy script):

- `/` serves the mystery shopper SPA
- `/dashboard/` serves the dashboard SPA
- `/surveys/b2b/` serves the B2B surveys SPA
- `/surveys/installation/` serves the installation surveys SPA
- `/api/*` proxies to the backend (FastAPI) and strips the `/api` prefix

### Static assets note (important)

Each SPA build must include its bundled assets under a subpath-specific `dist/assets/` directory (for example, `.../b2b/dist/assets/*`).

Nginx is configured with explicit `^~ <base>/assets/` locations so that JS/CSS assets are served as real files and missing assets return `404`.

If the browser shows `Failed to load module script ... MIME type of "text/html"`, it typically indicates a missing/incorrectly deployed `dist/assets/*` directory (or an outdated Nginx config that is serving `index.html` for asset URLs).

---

## 9) Go-live checks

```bash
curl -s http://127.0.0.1:8000/health
sudo nginx -t
sudo systemctl status cwscx-backend --no-pager
```

Browser checks:

- `http://cwscx-tst01.cwsey.com/`
- `http://cwscx-tst01.cwsey.com/dashboard/`
- `http://cwscx-tst01.cwsey.com/surveys/b2b/`
- `http://cwscx-tst01.cwsey.com/surveys/installation/`
- `http://cwscx-tst01.cwsey.com/api/health`

### Troubleshooting quick commands

Backend:

```bash
sudo systemctl status cwscx-backend --no-pager
sudo journalctl -u cwscx-backend -n 200 --no-pager
curl -fsS http://127.0.0.1:8000/health
```

Database:

```bash
docker ps --filter name=cwscx-postgres
docker logs --tail 100 cwscx-postgres
psql "postgresql://cxadmin:cxadmin123@127.0.0.1:5433/cwscx-postgres" -c "select 1"
```

Nginx:

```bash
sudo nginx -t
sudo systemctl status nginx --no-pager
sudo tail -n 200 /var/log/nginx/error.log
curl -kfsS https://cwscx-tst01.cwsey.com/api/health
```

---

## 10) Enterprise controls checklist

- Artifact-only frontend deployment
- No frontend build on target server
- Environment and secrets outside git
- Systemd-managed backend process
- Nginx reverse proxy with explicit route mapping
- Repeatable deployment scripts under `scripts/linux` and `scripts/windows`

---

## 11) Rollback

Recommended:

- Keep release bundle per version (for example, `cwscx-release-2026-03-19.zip`)
- Reinstall previous bundle:

```bash
bash /opt/cwscx/scripts/linux/install_release_bundle.sh /tmp/cwscx-release-PREVIOUS.zip
bash /opt/cwscx/scripts/linux/deploy_backend.sh
sudo bash /opt/cwscx/scripts/linux/deploy_nginx.sh
```

Notes:

- The staging deployment workflow stores bundles under `/opt/cwscx/releases/`.
- For fast rollback, re-run install+deploy using the last known-good zip.
