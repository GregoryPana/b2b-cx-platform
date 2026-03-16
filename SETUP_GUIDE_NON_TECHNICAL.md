# Complete Setup Guide (Non-Technical, Step-by-Step)

This guide is written for someone with little or no development background.

It explains:

1. How to prepare your computer
2. How to download (clone) this project from GitHub
3. How to install Docker
4. How to install PostgreSQL
5. How to connect this project to PostgreSQL
6. How to start backend and frontend services
7. How to verify everything is working
8. Common errors and how to fix them

If you follow this guide in order, you should be able to run the platform locally.

---

## 0) What you are setting up (plain English)

This project has 3 main parts:

- **Database (PostgreSQL)**: stores all data (businesses, visits, survey responses, analytics data)
- **Backend API (FastAPI)**: server that talks to the database
- **Frontends (React apps)**:
  - Dashboard (for managers/reviewers/admins)
  - Survey app (for representatives)

Think of it like this:

- Frontend = screen you use
- Backend = logic brain
- Database = memory

All 3 must be running for the full system to work.

---

## 1) Before you start

### Required software

Install these first:

1. **Git** (for pulling code)
   - https://git-scm.com/downloads
2. **Python 3.11+**
   - https://www.python.org/downloads/
3. **Node.js 20+ (LTS recommended)**
   - https://nodejs.org/
4. **Docker Desktop**
   - https://www.docker.com/products/docker-desktop/
5. **PostgreSQL 16**
   - https://www.postgresql.org/download/

### Why both Docker and PostgreSQL?

- This repo includes a Docker dev file (`docker-compose.dev.yml`) and Docker is useful for consistent environments.
- The database used by this project is PostgreSQL. You can run PostgreSQL either:
  - through Docker (recommended), or
  - through direct local install (native PostgreSQL service).

This guide gives both options.

---

## 2) Create a project folder on your computer

### Windows (recommended path)

1. Open File Explorer.
2. Create folder: `C:\Projects`
3. Inside it, keep all project code.

Reason: keeps code in one clean place and avoids permission issues in system folders.

---

## 3) Pull the repository from GitHub

### First-time clone

Open **PowerShell** and run:

```powershell
cd C:\Projects
git clone https://github.com/GregoryPana/b2b-cx-platform.git
cd b2b-cx-platform
```

### If you already cloned before (update latest code)

```powershell
cd C:\Projects\b2b-cx-platform
git pull
```

Reason:

- `clone` downloads the repo first time
- `pull` updates your local copy with latest changes

---

## 4) Database setup (PostgreSQL)

You have two supported approaches.

## Option A (Recommended): PostgreSQL via Docker

### 4A.1 Start Docker Desktop

1. Open Docker Desktop.
2. Wait until it says Docker is running.

### 4A.2 Start PostgreSQL container

From repo root:

```powershell
cd C:\Projects\b2b-cx-platform
docker compose -f docker-compose.dev.yml up -d
```

What this does:

- Starts PostgreSQL 16 container
- Uses these defaults from `docker-compose.dev.yml`:
  - user: `b2b`
  - password: `b2b`
  - database: `b2b`
  - port: `5432`

### 4A.3 Check container is running

```powershell
docker ps
```

You should see a postgres container listening on `0.0.0.0:5432`.

---

## Option B: Native PostgreSQL install

Use this if you prefer local PostgreSQL service instead of Docker.

### 4B.1 Install PostgreSQL

During install:

- keep port `5432`
- create a superuser password you remember

### 4B.2 Open pgAdmin (or psql)

Create:

- Database: `b2b`
- User: `b2b`
- Password: `b2b`

Grant user privileges on `b2b` database.

Reason: project defaults expect `postgresql://b2b:b2b@localhost:5432/b2b`.

---

## 5) Configure environment variables

This project uses `DATABASE_URL`.

### Windows PowerShell (temporary for current terminal)

```powershell
$env:DATABASE_URL="postgresql://b2b:b2b@localhost:5432/b2b"
```

You must set this in any terminal where you run backend or migrations.

### Optional persistent approach

Create a file at:

- `backend/.env`

with:

```env
DATABASE_URL=postgresql://b2b:b2b@localhost:5432/b2b
```

Reason: avoids retyping the variable each session.

---

## 6) Install backend dependencies and run DB migrations

### 6.1 Create Python virtual environment

```powershell
cd C:\Projects\b2b-cx-platform\backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

If PowerShell blocks activation, run once:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

### 6.2 Install Python packages

```powershell
pip install -r requirements.txt
```

### 6.3 Run Alembic migrations

From `backend` folder (with venv active and `DATABASE_URL` set):

```powershell
alembic upgrade head
```

Reason: migrations create/update required database tables.

### 6.4 (If needed) seed additional SQL structures

If your workflow requires SQL bootstrap scripts, run them explicitly. Example:

```powershell
psql -h localhost -U b2b -d b2b -f "..\CREATE_RESPONSE_TABLES.sql"
```

Only do this when needed by your branch or setup notes.

### 6.5 Bootstrap Mystery Shopper schema and questions

After backend starts, initialize Mystery Shopper once:

```powershell
Invoke-RestMethod -Method Post -Uri "http://localhost:8001/mystery-shopper/bootstrap"
```

Expected result includes:
- `survey_type_id`
- `question_count` (core questionnaire items; visit/header fields are stored separately)

This call is idempotent (safe to run again).

Optional automated smoke test (after backend is running):

```powershell
powershell -ExecutionPolicy Bypass -File scripts\powershell\smoke_mystery_shopper.ps1
```

This verifies bootstrap, location create/deactivate, draft visit creation, draft retrieval, and submit flow.

After bootstrap, add Customer Service Centre locations in the dashboard:

1. Open `http://localhost:5175`
2. Select platform: `Mystery Shopper`
3. Go to `Locations`
4. Add or deactivate centres as needed

---

## 7) Install frontend dependencies

### Dashboard frontend

```powershell
cd C:\Projects\b2b-cx-platform\frontend\dashboard
npm install
```

### Survey frontend

```powershell
cd C:\Projects\b2b-cx-platform\frontend\survey
npm install
```

### Mystery Shopper frontend

```powershell
cd C:\Projects\b2b-cx-platform\frontend\mystery-shopper
npm install
```

Reason: `npm install` downloads required frontend libraries.

---

## 8) Start all services

Open **4 separate terminals**.

## Terminal 1: Backend

```powershell
cd C:\Projects\b2b-cx-platform\backend
.\.venv\Scripts\Activate.ps1
$env:DATABASE_URL="postgresql://b2b:b2b@localhost:5432/b2b"
python -m uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

You should see server listening on `http://127.0.0.1:8001` (and LAN).

## Terminal 2: Dashboard

```powershell
cd C:\Projects\b2b-cx-platform\frontend\dashboard
npm run dev -- --host --port 5175
```

## Terminal 3: Survey

```powershell
cd C:\Projects\b2b-cx-platform\frontend\survey
npm run dev -- --host --port 5176
```

## Terminal 4: Mystery Shopper Survey

```powershell
cd C:\Projects\b2b-cx-platform\frontend\mystery-shopper
npm run dev -- --host --port 5177
```

### Shortcut scripts (Windows)

If you prefer one-click helpers, use the scripts in this repo:

- CMD:
  - `scripts\cmd\run_db.cmd`
  - `scripts\cmd\run_backend.cmd`
  - `scripts\cmd\run_dashboard.cmd`
  - `scripts\cmd\run_survey.cmd`
  - `scripts\cmd\run_mystery_shopper.cmd`
  - `scripts\cmd\smoke_mystery_shopper.cmd`
  - `scripts\cmd\run_all.cmd` (starts all)

- PowerShell:
  - `scripts\powershell\run_db.ps1`
  - `scripts\powershell\run_backend.ps1`
  - `scripts\powershell\run_dashboard.ps1`
  - `scripts\powershell\run_survey.ps1`
  - `scripts\powershell\run_mystery_shopper.ps1`
  - `scripts\powershell\smoke_mystery_shopper.ps1`
  - `scripts\powershell\run_all.ps1` (starts all)

---

## 9) Verify everything is working

### Local checks (same computer)

Open browser:

- Backend health: `http://localhost:8001/health`
- Dashboard: `http://localhost:5175`
- Survey: `http://localhost:5176`
- Mystery Shopper: `http://localhost:5177`

Expected:

- health endpoint returns success response
- dashboard and survey pages load without backend fetch errors

### LAN checks (other phone/tablet/laptop)

1. Find your computer IP:

```powershell
ipconfig
```

2. Use URLs from another device on same network:

- `http://YOUR_IP:5175` (dashboard)
- `http://YOUR_IP:5176` (survey)
- `http://YOUR_IP:5177` (mystery shopper)
- `http://YOUR_IP:8001/health` (backend)

---

## 10) Common issues and fixes

## Issue A: `psycopg` or DB connection error

Symptoms:

- backend fails at startup
- errors mentioning cannot connect to postgres

Fix:

1. Ensure PostgreSQL is running (Docker container or native service)
2. Verify `DATABASE_URL` exactly:
   - `postgresql://b2b:b2b@localhost:5432/b2b`
3. Test port usage:

```powershell
netstat -ano | findstr :5432
```

---

## Issue B: CORS errors in browser

Symptoms:

- “No Access-Control-Allow-Origin header”

Fix:

1. Ensure backend is running from this repo version.
2. Restart backend after pulling updates.
3. Ensure frontend points to correct host (`window.location.hostname` already used).
4. Hard refresh browser (`Ctrl + F5`).

---

## Issue C: `alembic upgrade head` fails

Fix checklist:

1. Run from `backend` directory.
2. Activate venv.
3. Confirm `DATABASE_URL` is set in same terminal.
4. Ensure postgres is reachable on 5432.

---

## Issue D: `npm` command not found

Fix:

1. Install Node.js LTS.
2. Close and reopen terminal.
3. Verify:

```powershell
node -v
npm -v
```

---

## Issue E: Port already in use (8001/5175/5176/5177)

Check process using port:

```powershell
netstat -ano | findstr :8001
netstat -ano | findstr :5175
netstat -ano | findstr :5176
netstat -ano | findstr :5177
```

Kill process by PID:

```powershell
taskkill /PID <PID> /F
```

---

## Issue F: Vite/Rollup optional dependency error (Mystery Shopper)

Symptoms:

- `Cannot find module @rollup/rollup-win32-x64-msvc`
- Mystery Shopper frontend fails to start on Windows

Fix (run in `frontend\mystery-shopper`):

```powershell
Remove-Item -Recurse -Force node_modules
Remove-Item -Force package-lock.json
npm install --include=optional
npm run dev -- --host --port 5177
```

Reason:

- npm can occasionally skip optional platform binaries (known npm issue)
- reinstalling with optional deps resolves the missing Rollup binary

---

## Issue F: Docker won’t start

Fix:

1. Reboot machine
2. Open Docker Desktop as Administrator
3. Check WSL2 is installed/enabled (Docker Desktop may prompt this)

---

## 11) Daily startup routine (quick version)

Each day:

1. Start Docker Desktop (if using Docker DB)
2. `git pull`
3. Start backend (with venv + `DATABASE_URL`)
4. Start dashboard frontend
5. Start survey frontend

---

## 12) Helpful commands reference

```powershell
# Update code
git pull

# Start postgres via docker
docker compose -f docker-compose.dev.yml up -d

# Stop postgres via docker
docker compose -f docker-compose.dev.yml down

# Run migrations
cd backend
.\.venv\Scripts\Activate.ps1
$env:DATABASE_URL="postgresql://b2b:b2b@localhost:5432/b2b"
alembic upgrade head

# Start backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

---

## 13) Final checklist

You are done when all are true:

- [ ] PostgreSQL is running
- [ ] `alembic upgrade head` succeeded
- [ ] Backend health endpoint works
- [ ] Dashboard opens and loads data
- [ ] Survey opens and loads questions
- [ ] No CORS errors in browser console
