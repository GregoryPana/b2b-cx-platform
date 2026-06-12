# Mystery Shopper Implementation Tracker

**Last updated:** 2026-06-12  
**Owner:** Gregory / current OpenCode session  
**Purpose:** Single working tracker for full Mystery Shopper implementation across the dashboard/admin experience and the mystery shopper survey frontend.

---

## 1. Current Local Dev Targets

- Dashboard/admin frontend: `http://localhost:5173`
- Dashboard/admin backend health: `http://localhost:8000/health`
- Mystery shopper survey frontend: `http://localhost:5177`
- Mystery shopper survey backend health: `http://localhost:8011/health`
- Local PostgreSQL container: `cx-b2b-postgres-local`

---

## 2. Status Legend

- `[ ]` Not started
- `[~]` In progress
- `[x]` Complete
- `[!]` Blocked / needs external decision or environment confirmation

---

## 3. Full Implementation Checklist

### 3.1 Survey Frontend (mystery shopper app)

- [x] Dedicated mystery shopper frontend exists
- [x] Mystery-public 2FA login/enrollment flow implemented
- [x] Shopper name auto-filled and locked
- [x] User guide and scoring key added
- [ ] Anchor-based guide navigation with return links
- [ ] Full manual regression of enrollment → login → draft save → submit
- [ ] Mobile/responsive QA for guide, entry, review, and submission states
- [ ] PDF/report parity verification from mystery report output

### 3.2 Dashboard / Admin Experience

- [x] Mystery locations management exists
- [x] Mystery purposes management exists
- [x] Mystery users management exists
- [x] Enrollment link generation exists
- [x] Enrollment email action exists
- [x] Review queue exists
- [x] Mystery analytics section exists
- [x] Mystery reports section exists
- [ ] End-to-end admin workflow QA: create user → send enrollment → review completed visit → report export
- [ ] Role/access QA for admin-only actions in mystery dashboard
- [ ] Admin UX polish backlog review after live testing

### 3.3 Backend / Data / API

- [x] Mystery shopper API module exists (`backend/app/api/mystery_shopper.py`)
- [x] Mystery auth API module exists (`backend/app/api/mystery_auth.py`)
- [x] PostgreSQL-backed local test path established
- [x] Lifecycle auth tests passing locally
- [ ] Broader mystery shopper API coverage beyond auth lifecycle
- [ ] Production/shared DB sync assumptions verified
- [ ] DMZ/internal token-validation architecture verified in real environment

### 3.4 Reporting / Exports

- [x] HTML report export exists
- [x] PDF download path exists
- [x] Friendly report filenames added
- [ ] Manual QA that PDF output faithfully preserves charts, colors, icons, and layout
- [ ] Decide whether backend `/reports/pdf` endpoints should be kept, replaced, or documented as secondary

### 3.5 Deployment / Operations

- [x] Internal build pins `VITE_AUTH_MODE=entra`
- [x] Public mystery build pins `VITE_AUTH_MODE=mystery_public`
- [ ] Confirm internal deployment path still matches current dashboard/survey reality
- [ ] Confirm DMZ/public deployment data sync model
- [ ] Document rollback / recovery path for mystery-public deployment issues

---

## 4. Current Objective

### Objective: Resume local Mystery Shopper development with both dashboard and survey running

- [x] Re-check implementation status and prior handoff notes
- [x] Create a single living tracker file for this workstream
- [~] Start/verify local dashboard + survey processes
- [ ] Run through the current mystery shopper flow manually and capture issues
- [ ] Choose the next concrete development slice after live testing

---

## 5. Recommended Next Development Order

1. **Bring up local stack and live-test both sides**
   - Dashboard/admin on 5173/8000
   - Mystery shopper survey on 5177/8011
   - Validate current flows before choosing the next code change

2. **Complete Phase 3a: guide anchor navigation**
   - Add guide anchors
   - Add `returnTo` links from guide to survey sections
   - Add “Back to Guide” behavior

3. **Perform focused end-to-end dashboard + survey QA**
   - Admin creates/chooses user
   - Enrollment link/email
   - Shopper enrolls and signs in
   - Shopper completes and submits visit
   - Admin reviews and exports report

4. **Close deployment-readiness gaps (Phase 3b)**
   - Verify shared/replicated database behavior for internal vs DMZ/public deployment
   - Confirm token, visit, and reference-data sync assumptions

---

## 6. Notes / Findings From This Session

- Prior Hermes handoff indicates the main unfinished functional feature is **guide anchor navigation**.
- The major unresolved operational risk remains **production DMZ/internal database sync verification**.
- Local app processes were not running when this session resumed, but local PostgreSQL remained up.
- Local report-email testing is currently blocked because SMTP environment variables are not configured on the local backend processes.
- Browser console error `A listener indicated an asynchronous response...` is likely extension/browser-noise rather than a backend application error.
- This file should be updated whenever current objectives or completed steps change.
