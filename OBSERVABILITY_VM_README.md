# Observability VM README

**Purpose:** This VM hosts the DTO observability tools used to monitor the CWSCX platform and, later, additional bespoke applications in other environments.  
**Current observability VM hostname:** `cwscx-sql01`  
**Current observability VM FQDN:** `cwscx-sql01.cwsey.com`  
**Current observability VM IP:** `172.17.1.212`  
**Current staging application VM hostname:** `cwscx-tst01`  
**Current staging application FQDN:** `cwscx-tst01.cwsey.com`  
**Current staging application VM IP:** `172.17.1.213`

This document is written for both technical and non-technical users. It explains what is running here, how to access it, what it monitors, and what to do when something goes wrong.

## Naming Format And Current Values

When recording server details, always use this format:

- **Hostname**
- **FQDN**
- **IP**

Current known values:

| Role | Hostname | FQDN | IP |
|---|---|---|---|
| Application Frontend VM | `cwscx-app01` | `cwscx-app01.cwsey.com` | `172.17.1.211` |
| Observability / SQL VM | `cwscx-sql01` | `cwscx-sql01.cwsey.com` | `172.17.1.212` |
| Staging VM | `cwscx-tst01` | `cwscx-tst01.cwsey.com` | `172.17.1.213` |


If IT changes any hostname or IP later:
1. update this table first
2. then update all URLs, hostnames, IPs, and monitor targets in this document

---

## 1. What This VM Does

This VM currently hosts two services:

1. **Uptime Kuma**
   - used to monitor whether the CWSCX staging application is reachable and healthy
   - used to send alert emails when monitored services fail or recover

2. **pgAdmin**
   - used to connect to the staging PostgreSQL database from a central admin location
   - used for database inspection, manual checks, and future production database access

This VM does **not** currently host the CWSCX application itself.

---

## 2. Where Things Live On This VM

Main working folder:

```text
~/observability/
```

Expected layout:

```text
~/observability/
├── docker-compose.yml
├── .env
├── README.md
└── data/
    ├── uptime-kuma/
    └── pgadmin/
```

Purpose of each file/folder:

- `docker-compose.yml`
  - defines the Uptime Kuma and pgAdmin containers
- `.env`
  - stores the pgAdmin login credentials for the container startup
- `README.md`
  - this operational guide
- `data/uptime-kuma/`
  - persistent Uptime Kuma data
- `data/pgadmin/`
  - persistent pgAdmin data

---

## 3. How To Access The Services

### Uptime Kuma

Open in a browser:

```text
http://cwscx-sql01.cwsey.com:3001
```

Current direct IP fallback:

```text
http://172.17.1.212:3001
```

### pgAdmin

Open in a browser:

```text
http://cwscx-sql01.cwsey.com:5050
```

Current direct IP fallback:

```text
http://172.17.1.212:5050
```

### Notes for non-technical users

- If the page does not load, first check that you are connected to the internal network or VPN.
- If the browser shows a certificate or security warning on other internal tools, this may be due to self-signed certificates in the environment.
- If you do not know the VM IP, ask the DTO Lead or check the infrastructure inventory.

---

## 4. What Is Currently Being Monitored

### Current staging monitors in Uptime Kuma

These are the intended monitors for the CWSCX staging environment:

1. `staging-api-health`
   - URL: `https://cwscx-tst01.cwsey.com/api/health`
   - purpose: backend liveness + DB-aware health response

2. `staging-api-ready`
   - URL: `https://cwscx-tst01.cwsey.com/api/health/ready`
   - purpose: backend readiness and database reachability from the app itself

3. `staging-dashboard-route`
   - URL: `https://cwscx-tst01.cwsey.com/dashboard/`
   - purpose: dashboard route reachability

4. `staging-b2b-route`
   - URL: `https://cwscx-tst01.cwsey.com/surveys/b2b/`
   - purpose: B2B survey route reachability

5. `staging-installation-route`
   - URL: `https://cwscx-tst01.cwsey.com/surveys/installation/`
   - purpose: installation survey route reachability

6. `staging-mystery-route`
   - URL: `https://cwscx-tst01.cwsey.com/surveys/mystery-shopper/`
   - purpose: Mystery Shopper survey route reachability

7. `staging-postgres-tcp`
   - Host: `cwscx-tst01.cwsey.com`
   - Port: `5433`
   - purpose: TCP reachability to the staging PostgreSQL host port

8. `staging-pgadmin-route`
   - URL: `https://cwscx-tst01.cwsey.com/pgadmin/`
   - purpose: confirm the staging pgAdmin route is reachable if needed

### Important limitation

These monitors confirm that key routes and services are reachable, but they do **not** fully prove:
- Microsoft Entra login flow is working end-to-end
- protected dashboard functionality works after login
- surveys can be created/submitted successfully
- frontend JavaScript has no runtime errors after loading

That is expected. These are current observability limits, not mistakes.

---

## 5. Current pgAdmin Connection Details

The staging database is currently reachable from this observability VM using:

- Host: `cwscx-tst01.cwsey.com`
- Port: `5433`
- Maintenance database: `cwscx-postgres`
- Username: `cxadmin`

Current direct IP fallback:
- Host: `172.17.1.213`

The saved pgAdmin server connection name should be:

```text
staging-cwscx-postgres
```

### Notes

- The staging database is exposed from the staging VM's Docker container through host port `5433`.
- This is a staging-specific configuration and may differ later in production.

---

## 6. How To Start, Stop, And Check The Observability Stack

### Start the stack

```bash
cd ~/observability
docker compose up -d
```

### Stop the stack

```bash
cd ~/observability
docker compose down
```

### Check whether containers are running

```bash
cd ~/observability
docker compose ps
```

### View logs

```bash
cd ~/observability
docker compose logs --tail=100
```

### View logs for one service only

```bash
cd ~/observability
docker compose logs uptime-kuma --tail=100
docker compose logs pgadmin --tail=100
```

### Update images

```bash
cd ~/observability
docker compose pull
docker compose up -d
```

---

## 7. How To Add A New Uptime Kuma Monitor

Use these steps for any new application or environment.

1. Log in to Uptime Kuma.
2. Click **Add New Monitor**.
3. Choose the monitor type:
   - `HTTP(s)` for routes and API endpoints
   - `TCP Port` for database socket reachability
4. Enter the monitor name.
5. Enter the target URL or host/port.
6. Set:
   - Heartbeat interval: `60 seconds`
   - Retries: `3`
   - Timeout: `10 seconds`
7. If the target uses a self-signed certificate:
   - enable the option to ignore TLS / invalid certificate errors
8. Click **Save**.
9. Wait for the first heartbeat.

### Recommended naming pattern

Use:

```text
{environment}-{service}
```

Examples:
- `staging-api-health`
- `staging-dashboard-route`
- `prod-api-health`

---

## 8. How To Add A New pgAdmin Database Connection

1. Log in to pgAdmin.
2. In the left navigation, right-click **Servers**.
3. Click **Register**.
4. Click **Server...**

### General tab

- Name: choose a clear name such as:

```text
staging-cwscx-postgres
```

### Connection tab

Fill in:
- Host name/address
- Port
- Maintenance database
- Username
- Password

Then click **Save**.

### Verification query

In the Query Tool, run:

```sql
SELECT current_database(), current_user;
```

If the connection works, you should see the current database and username returned.

---

## 9. How To Create A Status Page In Uptime Kuma

A status page gives you one simple page showing whether the staging services are up.

### Step-by-step

1. Log in to Uptime Kuma.
2. In the left menu, click **Status Pages**.
3. Click **Add New Status Page**.
4. Fill in:
   - **Slug:** `cwscx-staging`
   - **Title:** `CWSCX Staging Status`
5. Save the page.
6. Add the staging monitors to the status page.

### Recommended monitors to include

- `staging-api-health`
- `staging-api-ready`
- `staging-dashboard-route`
- `staging-b2b-route`
- `staging-installation-route`
- `staging-mystery-route`
- `staging-postgres-tcp`

### Suggested grouping

Create groups like:

1. **Application API**
   - `staging-api-health`
   - `staging-api-ready`

2. **Frontend Routes**
   - `staging-dashboard-route`
   - `staging-b2b-route`
   - `staging-installation-route`
   - `staging-mystery-route`

3. **Database**
   - `staging-postgres-tcp`

### What the status page is for

- quick non-technical visibility for whether the staging estate is up
- one place to check service state before escalation
- useful evidence during production cutover rehearsal

### What the status page does not prove

- it does not prove users can successfully sign in with Entra
- it does not prove protected business flows work
- it does not replace manual smoke tests

---

## 10. Alerts

Email notifications are currently in use and have already been tested for:

- service down detection
- service recovery detection

If a monitor fails, the expected flow is:
1. Kuma marks the service unhealthy
2. email is sent
3. when the service recovers, recovery email is sent

### Current note

Microsoft Teams notifications are planned later but are not required right now.

---

## 11. Backup Of Observability Data

The observability VM should be backed up because it stores:

- Uptime Kuma configuration and monitor history
- pgAdmin connection configuration and state

### Simple backup command

If the backup folder does not exist yet:

```bash
sudo mkdir -p /backup/observability
```

Then create a backup:

```bash
sudo tar -czf /backup/observability/observability-$(date +%Y%m%d).tar.gz -C ~/observability data/
```

---

## 12. Troubleshooting

### Uptime Kuma does not load

Run:

```bash
cd ~/observability
docker compose ps
docker compose logs uptime-kuma --tail=100
```

### pgAdmin does not load

Run:

```bash
cd ~/observability
docker compose ps
docker compose logs pgadmin --tail=100
```

### A monitor shows `502`

This usually means:
- nginx is reachable
- but the backend service behind it is not healthy

This is a valid outage signal.

### pgAdmin cannot connect to the staging DB

Check from the observability VM:

```bash
nc -vz cwscx-tst01.cwsey.com 5433
psql "postgresql://cxadmin:cxadmin123@cwscx-tst01.cwsey.com:5433/cwscx-postgres" -c "select current_database(), current_user;"
```

Direct IP fallback:

```bash
nc -vz 172.17.1.213 5433
psql "postgresql://cxadmin:cxadmin123@172.17.1.213:5433/cwscx-postgres" -c "select current_database(), current_user;"
```

### HTTPS monitor fails because of certificate issues

If the service is otherwise reachable and uses a self-signed certificate:
- enable Kuma's option to ignore TLS / invalid certificate errors

Long term, trust the internal CA properly.

---

## 13. Current Decisions Recorded

- current observability VM: `cwscx-sql01` / `cwscx-sql01.cwsey.com` / `172.17.1.212`
- staging application VM: `cwscx-tst01` / `cwscx-tst01.cwsey.com` / `172.17.1.213`
- additional known DTO hosts:
  - `cwscx-app01` / `cwscx-app01.cwsey.com` / `172.17.1.211`
  - `cwscx-web01` / `cwscx-web01.cwsey.com` / `172.17.0.200`
- staging pgAdmin will be kept as fallback
- email notifications are active and tested
- Teams notifications will be added later if needed

---

## 14. Next Expected Work

Once staging monitoring is complete:

1. keep this VM monitoring staging
2. add equivalent monitors for production later
3. add a production pgAdmin server connection later
4. continue toward a fuller observability and alert-triage platform in the future
