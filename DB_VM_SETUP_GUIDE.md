# Observability VM Setup Guide

**Target VM:** observability VM currently being used for Uptime Kuma and pgAdmin
**Current role:** monitor the CWSCX staging environment now, then later add the production environment
**Current known observability VM hostname:** `cwscx-sql01`
**Current known observability VM FQDN:** `cwscx-sql01.cwsey.com`
**Current known observability VM IP:** `172.17.1.212`
**Current known staging app VM hostname:** `cwscx-tst01`
**Current known staging app VM FQDN:** `cwscx-tst01.cwsey.com`
**Current known staging app VM IP:** `172.17.1.213`

This guide is intentionally aligned to the current CWSCX codebase and the real staging runtime that is already in use.

## Address Format And Current Values

Whenever server information is recorded in this guide, use this format:

- **Hostname**
- **FQDN**
- **IP**

Current known values:

| Role | Hostname | FQDN | IP |
|---|---|---|---|
| Application Frontend VM | `cwscx-app01` | `cwscx-app01.cwsey.com` | `172.17.1.211` |
| Observability / SQL VM | `cwscx-sql01` | `cwscx-sql01.cwsey.com` | `172.17.1.212` |
| Staging VM | `cwscx-tst01` | `cwscx-tst01.cwsey.com` | `172.17.1.213` |
| Web VM | `cwscx-web01` | `cwscx-web01.cwsey.com` | `172.17.0.200` |

If any hostname or IP changes later, update this table first, then update the monitor URLs, pgAdmin connection values, and firewall notes below.

## How To Follow This Guide If You Are New

- Run the commands exactly as shown.
- Run them in the same order they appear in this guide.
- If a command starts with `sudo`, the VM will ask for your password.
- If a file needs to be created, this guide will give you the command to create it.
- If you prefer editing files in `nano`, use:

```bash
nano <filename>
```

Inside `nano`:

- press `Ctrl+O` to save
- press `Enter` to confirm the filename
- press `Ctrl+X` to exit

Where possible, this guide uses `cat <<'EOF'` commands so you can create files without needing to know an editor.

---

## 1. What Exists In The Current Platform

### Application routes

- Dashboard: `/dashboard/`
- B2B survey: `/surveys/b2b/`
- Installation survey: `/surveys/installation/`
- Mystery Shopper survey: `/surveys/mystery-shopper/`
- API base: `/api/`

### Health endpoints currently available

- `GET /api/health`
  - public, no authentication
  - database-aware
  - returns `200` when the backend and database are healthy
  - returns `503` when the backend is up but the database is unavailable
- `GET /api/health/ready`
  - public, no authentication
  - readiness-oriented alias
  - returns `200` with `status: "ready"` when the database is reachable
  - returns `503` with `status: "not_ready"` when the database is not reachable

### Current staging database runtime

This is the real live staging database configuration, not the dev compose file in the repo.

- live compose file on staging VM: `/opt/cwscx/docker-compose.yml`
- live compose service: `postgres`
- live container name: `cwscx-postgres`
- live host port mapping: `5433:5432`
- database name: `cwscx-postgres`
- database user: `cxadmin`

### Current staging pgAdmin runtime

- pgAdmin is already exposed locally on the staging VM at:
  - `127.0.0.1:5051 -> 80`
- This is not the pgAdmin instance that should be used for centralized observability.

---

## 2. Monitoring Scope For The Observability VM

The observability VM should host:

- Uptime Kuma
- pgAdmin

It should monitor:

- backend liveness and readiness
- frontend route reachability
- database TCP reachability
- pgAdmin reachability

It will **not** fully prove:

- Microsoft Entra interactive sign-in works end-to-end
- authenticated dashboard flows work
- real survey create/save/submit flows work
- frontend JavaScript has no runtime errors after login

Those gaps are expected and should be documented as observability limitations for now.

## Current Progress Checkpoint

If you have already completed these items:

- Docker Engine installed
- Docker Compose plugin installed
- Uptime Kuma deployed
- pgAdmin deployed
- first Kuma monitor created for `https://cwscx-tst01.cwsey.com/api/health`

Then you do **not** need to restart from the top of the guide.

Resume from here instead:

- Section 9.2 to add the `staging-api-ready` monitor
- Section 9.3 to add the frontend route monitors
- Section 10 to complete pgAdmin login and add the staging PostgreSQL server connection

---

## 3. Pre-Flight Checks

Do these checks on the observability VM before deploying the stack.

### 3.1 Network checks to staging

Because the current internal VMs use self-signed certificates, use `curl -k` for HTTPS validation unless the observability VM already trusts the internal certificate authority.

Use real `GET` requests for health validation. Do not use `curl -I` here, because `-I` sends `HEAD` and some application health endpoints only allow `GET`.

```bash
# API liveness
curl -ksS https://cwscx-tst01.cwsey.com/api/health

# API readiness
curl -ksS https://cwscx-tst01.cwsey.com/api/health/ready

# Dashboard route
curl -ksS -o /dev/null -w '%{http_code}\n' https://cwscx-tst01.cwsey.com/dashboard/

# B2B survey route
curl -ksS -o /dev/null -w '%{http_code}\n' https://cwscx-tst01.cwsey.com/surveys/b2b/

# Installation survey route
curl -ksS -o /dev/null -w '%{http_code}\n' https://cwscx-tst01.cwsey.com/surveys/installation/

# Mystery survey route
curl -ksS -o /dev/null -w '%{http_code}\n' https://cwscx-tst01.cwsey.com/surveys/mystery-shopper/

# Staging PostgreSQL TCP port
nc -vz cwscx-tst01.cwsey.com 5433
```

If DNS is unavailable, use the current direct IP fallback:

```bash
nc -vz 172.17.1.213 5433
```

Expected:

- the `/api/health` endpoint returns JSON with `status: "ok"` when healthy
- the `/api/health/ready` endpoint returns JSON with `status: "ready"` when the backend can reach the database
- the frontend route checks return `200`
- the TCP check to `5433` succeeds

If you later install the internal CA certificate on the observability VM, you can remove `-k` and validate TLS normally.

### 3.2 Docker availability

```bash
docker --version
docker compose version
```

If `docker` is not installed at all, or the VM has been partially configured and you want to start over cleanly, use the reset procedure in Section 3.3 before reinstalling.

### 3.3 Reset Docker On A Fresh Or Partially Configured VM

Use this only if you want to wipe the current Docker installation and start over with a clean setup.

This will remove:

- Docker Engine packages
- Compose packages
- local Docker images, containers, networks, and volumes
- Docker state directories under `/var/lib/docker` and `/var/lib/containerd`

On a fresh observability VM this is usually acceptable. Do **not** run this on a host that is already running workloads you need to keep.

```bash
sudo systemctl stop docker docker.socket containerd 2>/dev/null || true

sudo apt-get purge -y \
  docker.io \
  docker-ce \
  docker-ce-cli \
  docker-buildx-plugin \
  docker-compose-plugin \
  docker-compose-v2 \
  docker-compose \
  containerd \
  containerd.io \
  runc

sudo apt-get autoremove -y --purge

sudo rm -rf /var/lib/docker /var/lib/containerd /etc/docker
sudo rm -f /etc/apt/sources.list.d/docker.list
sudo rm -f /etc/apt/keyrings/docker.asc

sudo groupdel docker 2>/dev/null || true

hash -r
```

Verification after reset:

```bash
docker --version
docker compose version
docker-compose --version
```

Expected:

- all three commands should fail with `command not found` or equivalent until Docker is reinstalled

### 3.4 Install Docker And Compose Cleanly

For a fresh observability VM, use Docker's official repository so `docker compose` is available consistently.

This is the preferred and validated setup for the current observability VM.

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg

sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo \"$VERSION_CODENAME\") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

sudo usermod -aG docker $USER
```

Log out and back in after adding yourself to the `docker` group.

Verification:

```bash
docker --version
docker compose version
docker ps
```

Expected:

- Docker version prints successfully
- `docker compose version` prints successfully
- `docker ps` works without `sudo` after re-login

Known-good example from the current observability VM:

```bash
Docker version 29.4.2, build 055a478
Docker Compose version v5.1.3
```

### 3.5 Fallback If Official Docker Compose Is Not Available

If you already installed Ubuntu's `docker.io` package and do not want to reset immediately, you can try a fallback Compose package:

```bash
sudo apt-get update
sudo apt-get install -y docker-compose-v2 || sudo apt-get install -y docker-compose
```

Verification:

```bash
docker compose version || docker-compose --version
```

If only `docker-compose` works, you may continue, but the preferred long-term setup for this VM is still the clean Docker CE + Compose plugin install above.

### 3.6 Common Docker/Compose Troubleshooting On A Fresh Ubuntu VM

#### Case: `docker` works but `docker compose` does not

Example symptom:

```bash
docker --version
# works

docker compose version
# docker: unknown command: docker compose
```

Most likely cause:

- Ubuntu `docker.io` was installed first
- Compose plugin was not installed with it

Recommended fix:

- use the reset procedure in Section 3.3
- then reinstall using Docker's official repository from Section 3.4

Fallback if you do not want to reset immediately:

```bash
sudo apt-get update
sudo apt-get install -y docker-compose-v2 || sudo apt-get install -y docker-compose
```

#### Case: `docker ps` requires `sudo`

Cause:

- the current shell session has not picked up the `docker` group membership yet

Fix:

```bash
sudo usermod -aG docker $USER
```

Then log out and back in before continuing.

#### Case: Docker installed but daemon not ready

Check:

```bash
sudo systemctl status docker --no-pager
sudo systemctl status containerd --no-pager
```

If needed:

```bash
sudo systemctl enable --now docker
sudo systemctl enable --now containerd
```

### 3.7 Optional time sync sanity

```bash
timedatectl status
```

Keep the VM time correct so Kuma timing and future alert timestamps are trustworthy.

For the current CWSCX operational environment, set the observability VM timezone to `Indian/Mahe` so cron schedules, logs, and operational timestamps align with the local working timezone (`UTC+4`).

Recommended:

```bash
sudo timedatectl set-timezone Indian/Mahe
timedatectl status
```

Expected:

- `Time zone: Indian/Mahe (+04, +0400)`
- `System clock synchronized: yes`
- `NTP service: active`

If you leave the VM on `UTC`, the setup can still work correctly, but:

- cron schedules will run in UTC
- Uptime Kuma timestamps will be shown relative to UTC unless adjusted in the UI
- troubleshooting and backup timing may be less intuitive for operators working in Seychelles time

---

## 4. Firewall And Access Expectations

### Inbound to the observability VM

Recommended:

| Source                          | Port | Purpose        |
| ------------------------------- | ---: | -------------- |
| Internal network / admin subnet | 3001 | Uptime Kuma UI |
| Internal network / admin subnet | 5050 | pgAdmin UI     |
| Admin workstation(s)            |   22 | SSH            |

### Outbound from the observability VM

| Destination     | Port | Purpose                                 |
| --------------- | ---: | --------------------------------------- |
| `cwscx-tst01` |  443 | application route and API health checks |
| `cwscx-tst01` | 5433 | PostgreSQL access for pgAdmin           |

If you later add production monitoring, add production VM/API/database equivalents separately.

---

## 5. Recommended Directory Layout

As the service owner account on the observability VM:

1. Create the directories:

```bash
mkdir -p ~/observability/{data/uptime-kuma,data/pgadmin}
```

2. Move into the new folder:

```bash
cd ~/observability
```

3. Create the working files:

```bash
touch docker-compose.yml .env README.md
```

4. Set pgAdmin folder ownership and permissions:

```bash
sudo chown -R 5050:5050 ~/observability/data/pgadmin
sudo chmod 750 ~/observability/data/pgadmin
```

5. Set Uptime Kuma folder permissions:

```bash
sudo chmod 755 ~/observability/data/uptime-kuma
```

6. Confirm the structure exists:

```bash
ls -lah ~/observability
ls -lah ~/observability/data
```

Result:

```text
~/observability/
├── docker-compose.yml
├── .env
├── README.md
└── data/
    ├── uptime-kuma/
    └── pgadmin/
```

---

## 6. Environment File

Create `~/observability/.env`:

```bash
cat > ~/observability/.env <<'EOF'
PGADMIN_DEFAULT_EMAIL=dto-ops@cws.sc
PGADMIN_DEFAULT_PASSWORD=REPLACE_WITH_STRONG_PASSWORD
EOF

chmod 600 ~/observability/.env
```

Use a strong password and store it in your secret manager.

If you need to edit the file afterward:

```bash
nano ~/observability/.env
```

To confirm the file exists:

```bash
ls -lah ~/observability/.env
```

---

## 7. Docker Compose For The Observability VM

Create `~/observability/docker-compose.yml`:

```yaml
services:
  uptime-kuma:
    image: louislam/uptime-kuma:1
    container_name: uptime-kuma
    restart: unless-stopped
    ports:
      - "3001:3001"
    volumes:
      - ./data/uptime-kuma:/app/data
    environment:
      - UPTIME_KUMA_PORT=3001
    healthcheck:
      test: ["CMD", "extra/healthcheck"]
      interval: 60s
      timeout: 10s
      retries: 3
      start_period: 30s

  pgadmin:
    image: dpage/pgadmin4:latest
    container_name: pgadmin
    restart: unless-stopped
    ports:
      - "5050:80"
    volumes:
      - ./data/pgadmin:/var/lib/pgadmin
    environment:
      - PGADMIN_DEFAULT_EMAIL=${PGADMIN_DEFAULT_EMAIL}
      - PGADMIN_DEFAULT_PASSWORD=${PGADMIN_DEFAULT_PASSWORD}
      - PGADMIN_CONFIG_SERVER_MODE=True
      - PGADMIN_CONFIG_MASTER_PASSWORD_REQUIRED=True
      - PGADMIN_CONFIG_UPGRADE_CHECK_ENABLED=False
    healthcheck:
      test: ["CMD-SHELL", "wget --quiet --tries=1 --spider http://localhost:80/misc/ping || exit 1"]
      interval: 60s
      timeout: 10s
      retries: 3
      start_period: 60s

networks:
  default:
    name: observability-net
```

Now write that content into the file using this exact command:

```bash
cat > ~/observability/docker-compose.yml <<'EOF'
services:
  uptime-kuma:
    image: louislam/uptime-kuma:1
    container_name: uptime-kuma
    restart: unless-stopped
    ports:
      - "3001:3001"
    volumes:
      - ./data/uptime-kuma:/app/data
    environment:
      - UPTIME_KUMA_PORT=3001
    healthcheck:
      test: ["CMD", "extra/healthcheck"]
      interval: 60s
      timeout: 10s
      retries: 3
      start_period: 30s

  pgadmin:
    image: dpage/pgadmin4:latest
    container_name: pgadmin
    restart: unless-stopped
    ports:
      - "5050:80"
    volumes:
      - ./data/pgadmin:/var/lib/pgadmin
    environment:
      - PGADMIN_DEFAULT_EMAIL=${PGADMIN_DEFAULT_EMAIL}
      - PGADMIN_DEFAULT_PASSWORD=${PGADMIN_DEFAULT_PASSWORD}
      - PGADMIN_CONFIG_SERVER_MODE=True
      - PGADMIN_CONFIG_MASTER_PASSWORD_REQUIRED=True
      - PGADMIN_CONFIG_UPGRADE_CHECK_ENABLED=False
    healthcheck:
      test: ["CMD-SHELL", "wget --quiet --tries=1 --spider http://localhost:80/misc/ping || exit 1"]
      interval: 60s
      timeout: 10s
      retries: 3
      start_period: 60s

networks:
  default:
    name: observability-net
EOF
```

Confirm the file contents:

```bash
sed -n '1,220p' ~/observability/docker-compose.yml
```

If you prefer to edit with `nano` instead:

```bash
nano ~/observability/docker-compose.yml
```

---

## 8. Initial Deployment

1. Move into the observability folder:

```bash
cd ~/observability
```

2. Pull the images:

```bash
docker compose pull
```

3. Start the stack in the background:

```bash
docker compose up -d
```

4. Check container status:

```bash
docker compose ps
```

5. Check recent logs:

```bash
docker compose logs --tail=50
```

Expected:

- `uptime-kuma` is up
- `pgadmin` is up
- health checks go healthy after startup settles

---

## 9. Uptime Kuma Setup

1. Open a browser from your workstation.
2. Go to:
   - `http://cwscx-sql01.cwsey.com:3001`
   - `http://172.17.1.212:3001`
3. Create the first Uptime Kuma account when prompted.
4. Save that username and password in your secret manager.

### Recommended staging monitors

#### 9.1 API liveness

- Monitor type: `HTTP(s)`
- Friendly name: `staging-api-health`
- URL: `https://cwscx-tst01.cwsey.com/api/health`
- Method: `GET`
- Heartbeat interval: `60 seconds`
- Timeout: `10 seconds`
- Retries: `3`
- Accepted status codes: `200-299`
- Optional keyword: `"status":"ok"`
- If the staging certificate is still self-signed:
  - enable Kuma's option to ignore TLS / invalid certificate errors for this monitor

#### 9.2 API readiness

- Monitor type: `HTTP(s)`
- Friendly name: `staging-api-ready`
- URL: `https://cwscx-tst01.cwsey.com/api/health/ready`
- Method: `GET`
- Heartbeat interval: `60 seconds`
- Timeout: `10 seconds`
- Retries: `3`
- Accepted status codes: `200-299`
- Optional keyword: `"status":"ready"`
- If the staging certificate is still self-signed:
  - enable Kuma's option to ignore TLS / invalid certificate errors for this monitor

#### 9.3 Frontend route reachability

Create one `HTTP(s)` monitor each for:

- `https://cwscx-tst01.cwsey.com/dashboard/`
- `https://cwscx-tst01.cwsey.com/surveys/b2b/`
- `https://cwscx-tst01.cwsey.com/surveys/installation/`
- `https://cwscx-tst01.cwsey.com/surveys/mystery-shopper/`

These only confirm route reachability, not authenticated functionality.

For each of these HTTPS monitors, if staging still uses self-signed certificates:

- enable Kuma's option to ignore TLS / invalid certificate errors

#### 9.4 Database reachability

- Monitor type: `TCP Port`
- Friendly name: `staging-postgres-tcp`
- Host: `cwscx-tst01.cwsey.com`
- Port: `5433`

#### 9.5 pgAdmin reachability on staging

Optional:

- Monitor type: `HTTP(s)`
- URL: `https://cwscx-tst01.cwsey.com/pgadmin/`
- If staging still uses self-signed certificates:
  - enable Kuma's option to ignore TLS / invalid certificate errors

### 9.6 How to add a monitor in Uptime Kuma

Repeat these steps for each monitor listed above:

1. Log in to Uptime Kuma.
2. Click **Add New Monitor**.
3. Choose the monitor type shown in this guide.
4. Enter the name exactly as shown in this guide.
5. Enter the URL or host/port exactly as shown in this guide.
6. Set:
   - Heartbeat interval: `60 seconds`
   - Retries: `3`
   - Timeout: `10 seconds`
7. If the monitor uses HTTPS and the target uses a self-signed certificate:
   - enable the option to ignore TLS / invalid certificate errors
8. Click **Save**.
9. Wait for the first check result and confirm the monitor turns green.

### 9.7 How to create a status page in Uptime Kuma

1. Log in to Uptime Kuma.
2. In the left menu, click **Status Pages**.
3. Click **Add New Status Page**.
4. Use:
   - **Slug:** `cwscx-staging`
   - **Title:** `CWSCX Staging Status`
5. Save the page.
6. Add the staging monitors to the status page.

Recommended monitors for the staging status page:
- `staging-api-health`
- `staging-api-ready`
- `staging-dashboard-route`
- `staging-b2b-route`
- `staging-installation-route`
- `staging-mystery-route`
- `staging-postgres-tcp`

Recommended groups:
- **Application API**
- **Frontend Routes**
- **Database**

This status page is useful for quick human visibility, especially for non-technical users, but it does not replace detailed investigation or smoke tests.

---

## 10. pgAdmin Setup

1. Open a browser from your workstation.
2. Go to:
   - `http://cwscx-sql01.cwsey.com:5050`
   - `http://172.17.1.212:5050`
3. Log in with the email and password stored in `~/observability/.env`.
4. When pgAdmin asks for a master password, create one and store it in your secret manager.

### Add the staging database

Register a new server with these exact steps:

1. In the left navigation, right-click **Servers**.
2. Click **Register**.
3. Click **Server...**

**General**

- Name: `staging-cwscx-postgres`

**Connection**

- Host name/address: `cwscx-tst01.cwsey.com`
- Port: `5433`
- Maintenance database: `cwscx-postgres`
- Username: `cxadmin`
- Password: `cxadmin123`

If DNS is unavailable, use:
- Host name/address: `172.17.1.213`

4. Click **Save**.

If you later rotate credentials, update them here as well.

If you do not see the server appear immediately in the left panel:

1. click the small refresh icon in pgAdmin, or
2. collapse and re-expand **Servers**

### Verification query

1. In pgAdmin, expand the new server connection.
2. Open the target database.
3. Right-click the database.
4. Click **Query Tool**.
5. Paste the SQL below.
6. Click the run/execute button.
7. Wait for the results grid to appear at the bottom of the page.

```sql
SELECT current_database(), current_user;
```

Expected:

- `cwscx-postgres`
- `cxadmin`

---

## 11. What Kuma Can And Cannot See Today

### Visible now

- backend process reachable through nginx
- backend + database readiness via `/api/health` and `/api/health/ready`
- frontend route reachability
- staging PostgreSQL TCP reachability
- pgAdmin route reachability

### Not fully visible yet

- Microsoft Entra interactive login health
- authenticated dashboard behavior after login
- survey create/save/submit functional correctness
- frontend JavaScript runtime errors after the page loads
- backup freshness and backup success state via application endpoint

These should be treated as current observability gaps, not as setup mistakes.

### TLS note for all HTTPS monitors

- With the current self-signed certificate setup, HTTPS reachability checks can fail even when the service is healthy if the certificate is not trusted by the observability VM.
- Short-term recommendation:
  - enable Kuma's option to ignore TLS/SSL validation errors on internal HTTPS monitors
- Better long-term recommendation:
  - distribute and trust the internal CA certificate on the observability VM and browsers used by operators

---

## 12. Backup Recommendation For The Observability VM

Back up the observability stack data directory:

```bash
sudo tar -czf /backup/observability-$(date +%Y%m%d).tar.gz -C ~/observability data/
```

If the backup folder does not exist yet, create it first:

```bash
sudo mkdir -p /backup/observability
```

This protects:

- Uptime Kuma configuration/history
- pgAdmin configuration/state

---

## 13. Operational Validation Checklist

- [X] Uptime Kuma UI loads
- [X] pgAdmin UI loads
- [X] `staging-api-health` monitor is green
- [X] `staging-api-ready` monitor is green
- [ ] dashboard route monitor is green
- [ ] B2B survey route monitor is green
- [ ] installation survey route monitor is green
- [ ] mystery survey route monitor is green
- [X] staging PostgreSQL TCP monitor is green
- [X] pgAdmin can connect to staging PostgreSQL on `cwscx-tst01.cwsey.com:5433` (or direct IP fallback `172.17.1.213:5433`)
- [X] `SELECT current_database(), current_user;` succeeds in pgAdmin

---

## 14. Future Production Expansion

When production is ready, add equivalent monitors and pgAdmin connections for the production VM.

Do not assume the production environment will use:

- the same database host port
- the same compose file location
- the same credentials
- the same route exposure policy

Document those separately at production cutover time.
