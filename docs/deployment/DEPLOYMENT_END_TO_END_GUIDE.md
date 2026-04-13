# Deployment End-to-End Guide

This guide explains the complete deployment flow in plain language.

Audience:

- delivery managers
- QA leads
- operations analysts
- engineers
- new joiners

## 1) What deployment means in this project

Deployment means:

1. taking the latest approved code from GitHub
2. building deployable frontend artifacts
3. installing backend and frontend files into `/opt/cwscx`
4. updating backend service and Nginx
5. verifying the system is healthy
6. rolling back if verification fails

## 2) Trigger points

Primary workflow: `.github/workflows/deploy-staging.yml`

Deploy starts when:

- code is pushed to `main`, or
- workflow is run manually (`workflow_dispatch`)

## 3) Where each stage runs

### CI checks

Runs on GitHub-hosted runners:

- backend tests
- dashboard frontend build test
- survey frontend build test

### Deploy stage

Runs on self-hosted runner on staging VM/network (`runs-on: [self-hosted, linux]`).

This is required because staging VM is private-network only.

## 4) Step-by-step deployment flow

### Step A: Source checkout and workspace hardening

Deploy job does all of the following before any build:

- checkout repository with `fetch-depth: 0` and `clean: true`
- fetch/prune tags and branches
- force checkout exact triggering commit (`GITHUB_SHA`)
- clean untracked files (`git clean -ffdx`)

Purpose: ensures deploy always uses exact GitHub commit, not stale local files.

### Step B: Build release bundle on VM runner

Script: `scripts/linux/build_release_bundle.sh`

What it does:

- builds `frontend/dashboard-blueprint` with base path `/dashboard/`
- builds `frontend/survey` with base path `/surveys/b2b/`
- builds `frontend/installation-survey` with base path `/surveys/installation/`
- copies backend code, Alembic files, linux scripts, `.env.example`
- packages all into zip (`cwscx-release.zip`)

Bundle shape:

```text
release/
  backend/
  frontends/
    dashboard/dist/
    internal-surveys/b2b/dist/
    internal-surveys/installation/dist/
  scripts/linux/
  .env.example
```

### Step C: Archive release zip

Workflow copies generated zip into:

- `/opt/cwscx/releases/cwscx-release-<release-id>.zip`

This archive is used for rollback.

### Step D: Install bundle

Script: `scripts/linux/install_release_bundle.sh`

What it does:

- unzips release into temporary directory
- syncs backend into `/opt/cwscx/backend`
- syncs frontend dist artifacts into `/opt/cwscx/frontends-src/...`
- syncs deployment scripts into `/opt/cwscx/scripts/linux`
- creates `/opt/cwscx/.env` from `.env.example` if missing
- archives unexpected legacy frontend directories into `/opt/cwscx/frontends-archive/<timestamp>/`

### Step E: Deploy backend service

Script: `scripts/linux/deploy_backend.sh`

What it does:

- creates/updates virtual environment
- installs Python dependencies
- loads environment variables from backend `.env`
- runs Alembic upgrade to latest schema
- updates systemd service unit for `cwscx-backend`
- restarts backend service

Data safety behavior:

- deploy is migration-upgrade-only
- reset flags (`RESET_DATABASE`, `DB_RESET`) are blocked
- database reset is not part of standard deployment

### Step F: Validate frontend artifacts

Script: `scripts/linux/deploy_frontends.sh`

Required artifacts:

- `/opt/cwscx/frontends-src/dashboard/dist/index.html`
- `/opt/cwscx/frontends-src/internal-surveys/b2b/dist/index.html`
- `/opt/cwscx/frontends-src/internal-surveys/installation/dist/index.html`

Optional artifact:

- `/opt/cwscx/frontends-src/public/mystery-shopper/dist/index.html`

### Step G: Deploy Nginx config

Script: `scripts/linux/deploy_nginx.sh`

It writes and reloads site config so routes map correctly:

- `/api/*` -> backend
- `/dashboard/` -> dashboard dist
- `/surveys/b2b/` -> B2B dist
- `/surveys/installation/` -> installation dist
- `/mystery-shopper/` -> mystery shopper dist

### Step H: Verify release

Script: `scripts/linux/verify_staging.sh`

Checks include health, route availability, and static assets.

## 5) Rollback flow

If deploy fails:

1. workflow finds previous zip in `/opt/cwscx/releases`
2. re-installs previous bundle
3. re-runs backend, frontend, nginx deployment steps
4. re-runs verification

If no previous bundle exists, rollback cannot proceed.

## 6) Required VM permissions

Runner user must have:

- write access to `/opt/cwscx`
- passwordless sudo for deployment actions needing root

Common required binaries:

- `systemctl`
- `bash` (for root-run scripts)
- `nginx` reload path via deployment script

## 7) Quick operational checks

After successful deploy:

- `curl -fsS http://127.0.0.1:8000/health`
- open `/dashboard/`
- open `/surveys/b2b/`
- open `/surveys/installation/`
- open `/api/health` through Nginx URL

## 8) Common failure patterns and meaning

- `Missing build artifact ... dist/index.html`
  - frontend build artifact not produced or not synced
- `Passwordless sudo is required`
  - runner lacks required sudoers policy
- `relation "programs" already exists`
  - migration baseline mismatch; deploy script attempts baseline stamp and retry
- `MIME type text/html for JS module`
  - asset routing issue (usually wrong dist/assets deployment or nginx mapping)

## 9) Plain-language explanation for non-technical users

If you are not an engineer, deployment simply means:

1. the newest approved version of the system is packaged
2. the package is copied into the server folder
3. the website and API are refreshed to use that new package
4. checks run to make sure the pages still open correctly

If deployment works, users should see the new screens or fixes without needing a developer to manually copy files onto the server.

## 10) Change management checklist before production-like release

- CI jobs green (backend/dashboard/survey)
- deploy summary generated in workflow
- post-deploy smoke tests completed
- release zip retained in `/opt/cwscx/releases`
- rollback candidate identified

## 11) What this flow explicitly does not do

- does not copy files from a developer laptop to VM
- does not require VM to manually pull from developer machine
- does not clear/reset database during normal release
- does not run destructive git commands on server state
