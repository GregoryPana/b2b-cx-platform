# Mystery Shopper And Platform Troubleshooting Log

## Purpose
This document records:
- the implementation work completed for Mystery Shopper
- the platform-wide regressions and runtime issues encountered
- the fixes that were attempted and/or shipped
- the current known state of the system

This is intended as a practical handoff log for continuing debugging or validating live/staging behavior.

## Major Product And Architecture Changes Made

### Role And Access Model
- Aligned frontend and backend access behavior to the confirmed Entra role model:
  - `B2B_SURVEYOR`
  - `B2B_ADMIN`
  - `MYSTERY_SURVEYOR`
  - `MYSTERY_ADMIN`
  - `INSTALL_SURVEYOR`
  - `INSTALL_ADMIN`
  - `CX_SUPER_ADMIN`
- Dashboard platform selection was changed to be admin-only per platform.
- Survey frontends were changed to allow both surveyors and admins for their own platform.

### Mystery Shopper Frontend Deployment
- Added deploy support for Mystery Shopper survey frontend under:
  - `/surveys/mystery-shopper/`
- Added nginx route support for that deployed subpath.
- Added Entra redirect and post-logout redirect handling for that subpath.

### Mystery Shopper Dashboard/API Isolation
- Moved Mystery Shopper survey frontend off shared `dashboard-visits` detail/save endpoints.
- Added Mystery-specific visit detail and response endpoints.
- Added Mystery-specific dashboard list/detail/review endpoints.
- Added Mystery-specific report endpoints.

### Mystery Shopper UI Extraction
- Began extracting Mystery sections out of the giant shared `DashboardPage.jsx` into dedicated feature components under:
  - `frontend/dashboard-blueprint/src/features/mystery-shopper/components/`

### Mystery Shopper Report Flow
- Added Mystery-specific report endpoints for:
  - HTML preview
  - HTML download
  - email sending
  - PDF generation

### Mystery Shopper Answer Storage
- Added dedicated `mystery_shopper_answers` table migration.
- Shifted Mystery write paths toward dedicated answer storage.
- Then changed rollout strategy to avoid heavy Alembic backfill due to DB migration hanging.

## Files Added Or Changed

### Planning / Docs
- `docs/features/MYSTERY_SHOPPER_IMPLEMENTATION_PLAN.md`
- `docs/features/MYSTERY_SHOPPER_REPORT_AUTOMATION_FUTURE_PHASE.md`
- `docs/features/MYSTERY_SHOPPER_AND_PLATFORM_TROUBLESHOOTING_LOG.md`

### Backend
- `backend/app/api/mystery_shopper.py`
- `backend/app/routers/analytics.py`
- `backend/app/core/auth/entra.py`
- `backend/alembic/versions/20260424_000019_add_mystery_shopper_answers.py`
- `backend/requirements.txt`

### Dashboard Frontend
- `frontend/dashboard-blueprint/src/App.jsx`
- `frontend/dashboard-blueprint/src/pages/DashboardPage.jsx`
- `frontend/dashboard-blueprint/src/components/layout/Sidebar.jsx`
- `frontend/dashboard-blueprint/src/components/layout/MainLayout.jsx`
- `frontend/dashboard-blueprint/src/components/user-guide/PlatformUserGuidePage.jsx`
- `frontend/dashboard-blueprint/src/components/b2b/ReviewQueueDataTable.jsx`
- `frontend/dashboard-blueprint/src/features/mystery-shopper/components/MysteryReviewQueueSection.jsx`
- `frontend/dashboard-blueprint/src/features/mystery-shopper/components/MysteryVisitDetailCard.jsx`
- `frontend/dashboard-blueprint/src/features/mystery-shopper/components/MysterySurveyResultsSection.jsx`
- `frontend/dashboard-blueprint/src/features/mystery-shopper/components/MysteryReportsSection.jsx`
- `frontend/dashboard-blueprint/src/features/mystery-shopper/components/MysteryAnalyticsSummarySection.jsx`
- `frontend/dashboard-blueprint/src/features/mystery-shopper/components/MysteryLocationsSection.jsx`
- `frontend/dashboard-blueprint/src/features/mystery-shopper/components/MysteryPurposesSection.jsx`

### Survey Frontends
- `frontend/mystery-shopper/src/App.jsx`
- `frontend/mystery-shopper/src/auth.js`
- `frontend/mystery-shopper/src/main.jsx`
- `frontend/mystery-shopper/src/index.css`
- `frontend/mystery-shopper/tailwind.config.js`
- `frontend/mystery-shopper/package.json`
- `frontend/mystery-shopper/package-lock.json`
- `frontend/survey/src/App.tsx`
- `frontend/installation-survey/src/App.jsx`

### Deploy / CI
- `scripts/linux/build_release_bundle.sh`
- `scripts/linux/deploy_nginx.sh`
- `.github/workflows/deploy-staging.yml`
- `.github/workflows/frontend-survey-ci.yml`

## High-Level Issues Encountered

### 1. Staging / Live Migration Hangs
Symptoms:
- Alembic hanging on `20260424_000019`
- DB lock timeout while attempting to create `mystery_shopper_answers`
- blocking sessions found in PostgreSQL system catalog locks

What was done:
- manually inspected locks with `pg_stat_activity`
- terminated blocking sessions
- manually created `mystery_shopper_answers`
- stamped Alembic revision manually on VM
- changed migration strategy so Alembic no longer performs heavy backfill during migration

Current understanding:
- heavy backfill in Alembic was unsafe in this environment
- safer approach is lightweight migration plus runtime compatibility / gradual data move

### 2. Stale / Old Frontend Assets On VM
Symptoms:
- VM kept serving frontend bundles containing old code after newer fixes had been pushed
- deployed JS still contained old `/auth/me` calls and old Mystery requests

What was done:
- verified source checkout on VM against expected code
- verified built dist contents by grepping deployed JS bundles
- identified that older release bundles were still being installed
- created and installed a fresh release bundle from a clean temp source clone on the VM

Current understanding:
- several earlier debugging cycles were affected by stale deployed frontend artifacts
- direct source-clone build on the VM gave a more trustworthy deployment path than relying on older bundles already in `/opt/cwscx/releases`

### 3. Mystery Shopper Frontend Runtime Errors
Symptoms:
- `Input is not defined`
- auth redirect behavior differed from B2B/Installation
- legacy custom CSS/glass-theme UX remained in place after functional changes

What was done:
- restored missing `Input` import
- aligned Mystery survey app with `BrowserRouter basename={VITE_BASE_PATH}`
- aligned Mystery auth setup with working survey frontends
- redesigned Mystery frontend away from legacy custom visual system toward Tailwind + shadcn style

Current understanding:
- Mystery frontend had multiple independent issues: runtime imports, auth routing, and legacy UI shell

### 4. Mystery Shopper Dashboard Broke Other Platforms After Switching
Symptoms:
- switching to Mystery could cause B2B dashboard to stop showing data until hard refresh
- stale requests and stale state appeared to bleed across platform switches

What was done:
- forced `DashboardPage` remounts when platform changed
- reset route to `/` when platform changed
- added stale-request/version guards to ignore late async responses from old platform state
- reduced Mystery request fan-out by scoping data loads to active pages only

Current understanding:
- the shared dashboard page is extremely stateful, and platform switching can produce cross-platform contamination if not isolated carefully

### 5. Frontend Startup Timeout / `/auth/me` Problems
Symptoms:
- frontends appeared to fail immediately with request timeout
- `/auth/me` would 504 or abort during startup
- browser often showed timeout before useful app UI appeared

What was done:
- first added timeout-and-fallback behavior for `/auth/me`
- then removed `/auth/me` as a required startup dependency entirely from frontend boot paths
- frontends now rely on Entra token claims at startup instead of waiting for profile endpoint

Current understanding:
- `/auth/me` was a bad startup dependency in this environment because a slow auth backend path poisoned the page load experience

### 6. Backend Entra/JWKS Validation Latency
Symptoms:
- protected API calls could time out in staging even though browser held a token
- likely due to delayed or blocked JWKS resolution when validating tokens server-side

What was done:
- added staging-only fallback in backend auth validator:
  - parse token claims without signature verification only if JWKS validation fails
  - still validate issuer, tenant, audience, and expiry

Current understanding:
- this is a staging-only operational workaround, not a preferred production security posture
- it was necessary to prevent repeated 504s in the staging environment

### 7. Mystery Dashboard Admin CRUD Fragility
Symptoms:
- adding/deleting/reactivating Mystery locations and purposes could fail badly on non-JSON error responses
- raw `fetch(...).json()` usage made gateway errors messy and opaque

What was done:
- switched those admin requests to the shared safe fetch helper pattern

Current understanding:
- this reduced one class of frontend failures, but not all Mystery page load problems

### 8. Mystery Draft Identity Bug
Symptoms:
- frontend sent Entra `sub` string as `representative_id`
- backend expected integer
- `/mystery-shopper/visits/drafts?...` returned `422`

What was done:
- stopped frontend from sending `representative_id` in draft-list request
- removed coercion of `Number(userId)` in Mystery visit create path
- made backend draft list tolerate string `representative_id` and fall back to authenticated user ID

Current understanding:
- this was a concrete bug and was fixed, but older deployed bundles continued to exhibit it until fresh source builds were deployed

## Specific Fixes Attempted And Shipped

### Frontend Auth / Startup
- removed startup dependency on `/auth/me`
- added fallback warning banners instead of hard failures
- aligned Mystery auth routing to deployed basename

### Dashboard Data Flow
- moved Mystery dashboard away from legacy shared endpoints where possible
- stopped Mystery from using legacy dashboard NPS/category endpoints
- moved Mystery pending count to mystery-specific endpoint
- scoped loaders by route to reduce unnecessary requests
- added stale request guards across platform switches

### Mystery Reporting
- added Mystery-specific reporting endpoints
- added PDF export path

### Mystery Data Storage
- introduced dedicated answer table
- converted rollout to lightweight migration + runtime fallback instead of heavy Alembic copy

### Deploy / VM
- fixed nginx deploy script variable escaping bug
- added mystery survey route to nginx generation
- added Mystery survey build/deploy into release bundle process
- confirmed `/opt/cwscx` is a deploy target, not a git repo

## Commits Mentioned During This Work
- `015dd4a` Use score pickers across survey frontends
- `f2e4dcc` Align platform access roles and expand mystery shopper plan
- `b640034` Deploy mystery shopper survey under dedicated route
- `95c587d` Enable mystery shopper reports and guide pages
- `0291639` Use mystery-specific visit response endpoints
- `9b084cb` Use mystery-specific dashboard visit queries
- `a0e9682` Use mystery-specific review decision endpoints
- `a5d0f7d` Extract mystery dashboard review components
- `da59411` Add mystery-specific dashboard report flow
- `b3a3c0f` Fix mystery report HTML rendering syntax
- `0d61f48` Finish mystery dashboard extraction and PDF reports
- `d1e2491` Store mystery shopper answers in dedicated table
- `fc77f6f` Fix analytics question averages regression
- `c7ee339` Make mystery answer migration rollout safe
- `aa95d99` Fix mystery shopper input import
- `17f043c` Align mystery shopper auth routing setup
- `f5c7688` Redesign mystery shopper survey frontend
- `02abe35` Harden mystery shopper auth bootstrap
- `8e2f3d1` Fix mystery shopper draft identity handling
- `50666cc` Fallback faster when auth profile requests time out
- `d8b288b` Show frontend build versions in app chrome
- `0ec755a` Stop frontends depending on auth me at startup
- `9c680d1` Stop aborting normal dashboard data requests
- `3610cda` Harden mystery dashboard admin requests
- `f5aff7b` Reset route and stale state on platform switch
- `ff1eacd` Harden mystery survey request handling
- `6c47a47` Use mystery-specific pending count endpoint
- `de47c45` Ignore stale dashboard requests after platform switch
- `0f54c37` Remove mystery frontend bootstrap dependency
- `ab08f3e` Scope dashboard data loads to active pages
- `75b37aa` Allow staging auth fallback when JWKS times out
- `4d00c2e` Merge mystery shopper platform fixes
- `ee921d9` Abort stale dashboard requests on unmount
- `813925f` Stop mystery request paths from mutating schema
- `770cb25` Improve mystery survey create flow and mobile UX
- `e9fb98b` Scope mystery drafts to the owning user
- `7e8d73f` Fix visit reject review timestamp writes
- `fb24221` Improve sign-out flow and access messages

## Current Known State At Time Of Writing

### Confirmed Working At Backend Level From Logs
- B2B analytics endpoints returned `200`
- B2B dashboard compatibility endpoints returned `200`
- Mystery analytics endpoints returned `200`
- Mystery admin visits returned `200` after runtime schema mutation was removed from request handling
- Mystery bootstrap, locations, and purposes returned `200` in recent backend logs

### Confirmed Historical Live Problems
- stale frontend assets were repeatedly being served
- live dashboard sometimes still showed old JS behavior after newer fixes had been pushed
- Mystery dashboard could destabilize other platforms after switching
- Mystery frontend and dashboard could both fail from request storms, timeouts, or old asset behavior
- Mystery request paths previously ran live DDL and triggered deadlocks under traffic
- Mystery draft visibility previously broke because draft create and draft list used different user-ID resolution paths
- Mystery reject actions previously failed because code tried to write a non-existent `rejection_timestamp` column
- logout could previously trap users in an immediate sign-in loop after sign-out and refresh

### Current Stabilization State
- platform switching is now protected by abort cleanup and bounded polling in the dashboard shell
- Mystery request paths no longer mutate schema at runtime
- Mystery drafts are scoped to the owning user and protected from cross-user access
- Mystery survey frontend supports a clearer start-vs-load entry flow and better mobile sidebar behavior
- sign-out now lands users on a stable signed-out state instead of forcing immediate re-login
- current VM backup automation is cron-based and lives outside the repo deploy path:
  - cron entry points to `/opt/backups/postgres/backup.sh`
  - active backup layout uses:
    - `/opt/backups/postgres/daily/`
    - `/opt/backups/postgres/weekly/`
    - `/opt/backups/postgres/monthly/`

### Current Open Questions
- whether the latest deployed frontend artifacts on the VM always correspond to the latest pushed source
- whether any remaining Mystery platform issue is still stale-asset related versus one final live request-path issue
- whether nginx/browser/proxy/network conditions are contributing to pending/cancelled frontend requests in addition to application logic
- future work: centralized cross-environment operations monitoring for backup status, health checks, and alert triage remains out of scope for the current runtime

## Practical Next Debugging Steps If Problems Continue
1. Verify the currently served JS bundle on the VM and in browser match the expected latest commit.
2. Use `journalctl -u cwscx-backend -f` while reproducing the issue.
3. Capture the first red or pending request from browser devtools after a hard refresh with cache disabled.
4. Compare that live request against current source code and deployed dist contents.
5. Avoid introducing new broad refactors until the single current failing request path is isolated.
