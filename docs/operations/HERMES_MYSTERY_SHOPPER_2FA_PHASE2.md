# Hermes Mystery Shopper 2FA Phase 2 Handoff
## Feature: Enrollment Emails, Autofilled Names, Guides, Anchor Navigation, & Production Sync

**Status**: Features built and committed; pending: anchor-based guide navigation + production deployment verification  
**Branch**: `feature/mystery-public-2fa-lifecycle`  
**Last updated**: 2026-06-10  

---

## 1. Completed Work Summary

### 1.1 Commits in This Phase

| Commit | What | Details |
|--------|------|---------|
| `6e69f26` | Autofilled shopper name | Survey "Shopper Name" → "Mystery Shopper Name (You)", auto-populated from userInfo, disabled input, persists across draft loads |
| `f59bb93` | Admin enrollment email feature | New endpoint POST /mystery-admin/users/{id}/email-enrollment; SMTP helper in core/emailer.py; email explains purpose, VPN reminder, admin contact; MysteryUsersSection UI buttons to email link |
| `41d7d9c` | Scoring key & comprehensive guides | ScoringKeyCard shown at entry, top of survey, and in new User Guide tab; GuidePage with 8 detailed end-user sections; dashboard guides rewritten for admins including end-to-end lifecycle, Users mgmt, and Entra access explanation; B2B/Installation guides gain lifecycle sections |
| `1491c57` | Build script hardening | build_release_bundle.sh pins VITE_AUTH_MODE=entra explicitly to prevent .env.local or shell vars silently switching internal bundle to public 2FA mode |

### 1.2 New Files Created

- **frontend/mystery-shopper/src/SurveyGuide.jsx**
  - `ScoringKeyCard(compact)` component: explains 1-5 scale, 0-10 scale, yes/no/text types
  - `GuidePage()` component: 8 sections covering role, enrollment, sign-in, survey start, answering, submission, admin duties, safety
  - Exported from SurveyWorkspace as sidebar "User Guide" tab and shown on entry screen

- **backend/app/core/emailer.py**
  - `smtp_configured()`: check if SMTP env vars are set
  - `send_email(to, subject, text_body, html_body, reply_to)`: sends via SMTP_HOST/PORT with TLS/SSL fallback
  - Shared helper used by report-email and new enrollment-email features
  - Error handling for misconfigured SMTP; returns gracefully if not configured

### 1.3 Modified Files (Non-Breaking)

- **backend/app/api/mystery_auth.py**
  - Added `_build_enrollment_email(full_name, enroll_url, expires_at, admin_name, admin_email)`: returns (subject, text_body, html_body) tuple
  - Added POST `/mystery-admin/users/{user_id}/email-enrollment`: admin endpoint, takes Request + db, extracts current_user from security, issues fresh enrollment token, builds email, sends via emailer.py, commits only if send succeeds
  - Leverages existing as_aware_utc() helper for datetime comparisons (already ported from prior PostgreSQL fix)

- **frontend/mystery-shopper/src/SurveyWorkspace.jsx**
  - Imports BookOpen icon, GuidePage, ScoringKeyCard
  - Added "User Guide" sidebar tab (key: "guide")
  - Shows ScoringKeyCard on entry screen (under "How would you like to begin?")
  - Shows ScoringKeyCard at top of survey tab
  - Shows GuidePage when activeTab === "guide"
  - useEffect hook: auto-fills headerForm.shopper_name from userInfo?.name on mount; dependency on userInfo?.name ensures updates if account changes
  - Loads draft: shopper_name = userInfo?.name (overrides any previously typed value)
  - Field is disabled, readOnly, with title tooltip

- **frontend/dashboard-blueprint/src/features/mystery-shopper/components/MysteryUsersSection.jsx**
  - Added `emailMysteryUserLink` prop
  - "Email link" button in per-user action row
  - "Email link to user" button in enrollment-link panel
  - Both trigger emailMysteryUserLink handler with confirmation

- **frontend/dashboard-blueprint/src/pages/DashboardPage.jsx**
  - Added emailMysteryUserLink handler: POST to /mystery-admin/users/{id}/email-enrollment, shows loading toast, displays success message, reloads user list
  - Passes emailMysteryUserLink to MysteryUsersSection

- **frontend/dashboard-blueprint/src/components/user-guide/PlatformUserGuidePage.jsx**
  - Mystery Shopper guide: completely rewritten with 7 detailed sections (end-to-end lifecycle, Entra access, Users mgmt, review workflow, analytics/reports, plus new "Admin Access To The Survey Frontend" section explaining Entra sign-in vs public 2FA)
  - B2B guide: added "How The B2B Platform Works End To End" section
  - Installation guide: added "How The Installation Platform Works End To End" section

- **.env.example**
  - Added SMTP_HOST, SMTP_PORT, SMTP_USERNAME, SMTP_PASSWORD, SMTP_FROM, SMTP_USE_TLS, SMTP_USE_SSL documentation

- **scripts/linux/build_release_bundle.sh**
  - Added comment explaining VITE_AUTH_MODE=entra pinning
  - Updated echo to clarify "internal Entra variant"

---

## 2. How Two-Deployment Architecture Works

### 2.1 Deployment Topology

```
STAGING (Single environment):
├─ Internal host: backend + all frontends (dashboard, B2B survey, installation survey, mystery-shopper/entra)
│  └─ Uses Entra for auth; no public access
│
PRODUCTION (Two environments):
├─ Internal host: backend + all frontends (same as staging)
│  └─ Staff/admins sign in with Entra
│
└─ DMZ/Public host: separate backend instance + mystery-shopper/mystery_public frontend
   └─ External shoppers sign in with password + authenticator code (2FA)
```

### 2.2 URLs (Production Example)

| Component | URL | Auth | Who | Notes |
|-----------|-----|------|-----|-------|
| Internal Dashboard | `https://internal-prod.example.com/dashboard/` | Entra | Staff, admins | Reviews, analytics, configuration |
| Internal Mystery Survey | `https://internal-prod.example.com/surveys/mystery-shopper/` | Entra | Staff for testing/review | Can complete surveys, see same data as public |
| Public Mystery Survey | `https://public-dmz.example.com/surveys/mystery-shopper/` | Password + TOTP | External shoppers | Enrollment links point here; submitted surveys sync to internal DB |

### 2.3 Build Scripts

- **build_release_bundle.sh**: Internal bundle (staging + production internal hosts)
  - Builds mystery-shopper with `VITE_AUTH_MODE=entra` (pinned)
  - Includes full backend + all internal frontends
  - Output: `/tmp/cwscx-release.zip`

- **build_mystery_public_bundle.sh**: DMZ/public bundle (production DMZ only)
  - Builds mystery-shopper with `VITE_AUTH_MODE=mystery_public` (pinned)
  - Includes backend + public mystery-shopper frontend only
  - Output: `/tmp/cwscx-mystery-public-release.zip`

### 2.4 Backend & Database Sync Model

**Current design** (as evidenced by code):
- Both backend instances (internal and DMZ) connect to the **same PostgreSQL database** (shared or replicated)
- Enrollment tokens are stored in `mystery_enrollment_tokens` table; both backends can validate
- Submitted visits are stored in `visits` table; both visible to internal admin
- Firewall/network rules restrict DMZ backend access (mystery_public tables only; no admin/dashboard tables)

**Critical assumption for production**: The database must be **shared or kept perfectly in sync** so that:
- Admin generates token on internal backend → token written to shared DB
- Shopper validates token on DMZ backend → reads same DB, token is valid
- Shopper submits visit on DMZ backend → written to shared DB
- Admin reviews on internal backend → reads same DB, visit is there
- Shoppers see same locations/purposes on both frontends (reference data is synchronized)

**What is NOT yet verified**:
- Whether staging/production actually use a shared database or separate ones with replication
- How the shared database is configured (host, credentials, network routing)
- Whether replication is set up and how it's monitored
- How to roll back if sync fails
- Network latency/failover behavior if the shared database is on a different host

---

## 3. Pending Work

### 3.1 Feature: Anchor-Based Guide Navigation with Return Links

**What**: Add internal links from the User Guide to specific pages/tabs so users can:
1. Read a guide section (e.g., "5. Answering the questions")
2. Click "See this in the survey tab" → navigate to survey tab + scroll to relevant section
3. Click "← Back to guide" → return to exact spot in guide they left

**Implementation steps** (for next agent):
1. **Add URL parameter handling**:
   - Add `returnTo` query param to all links that jump away from guide
   - Example: `?tab=survey&returnTo=guide-answering-questions`

2. **Enhance ScoringKeyCard and GuidePage**:
   - Convert section titles to linkable anchors (e.g., `#guide-section-5`)
   - Add `<a href="?tab=survey&returnTo=guide-answering-questions">See this in action → Survey tab</a>` links in guide text
   - Track `returnTo` param state in SurveyWorkspace

3. **Add floating "Back to Guide" button**:
   - When `returnTo` param is set and user is on survey/planned tabs, show button at top of content
   - Button scrolls back to the anchor in the guide tab

4. **Implement anchor scrolling**:
   - When guide tab loads and an anchor is in the URL, useEffect scrolls to it
   - Smooth scroll with `window.scrollIntoView({ behavior: 'smooth' })`

5. **Test all navigation paths**:
   - Verify back button works in browser history
   - Verify return-to link scrolls to correct section
   - Test on mobile (sidebar collapse/expand)

**Files to modify**:
- `frontend/mystery-shopper/src/SurveyGuide.jsx`: add return link logic, anchors
- `frontend/mystery-shopper/src/SurveyWorkspace.jsx`: add returnTo param handling, floating back button

**Code complexity**: Low-medium. Mostly URL param handling + useEffect hooks for scroll.

### 3.2 DevOps: Production Deployment Sync & Verification

**Critical gaps to close before production**:

1. **Database architecture verification**:
   - [ ] Confirm shared vs replicated database setup for staging/production
   - [ ] Document connection string, credentials, network path for both backends
   - [ ] Verify both internal and DMZ backends can read/write mystery tables
   - [ ] Test: admin generates token on internal → DMZ backend can validate it
   - [ ] Test: shopper submits on DMZ → admin can read visit on internal

2. **Network/firewall rules**:
   - [ ] DMZ backend can reach database (host, port, credentials verified)
   - [ ] DMZ backend cannot reach admin/dashboard tables (firewall deny rules checked)
   - [ ] Internal backend can reach database
   - [ ] No accidental public routing of internal-only tables

3. **Reference data sync** (locations, purposes):
   - [ ] Sync mechanism exists (database replication, app-level sync, or shared tables)
   - [ ] Test: admin adds location on internal → shopper sees it on DMZ within 1 min
   - [ ] Test: both frontends show identical location list
   - [ ] Document sync latency and monitoring

4. **Authentication token validation**:
   - [ ] Enrollment tokens created on internal backend work on DMZ frontend
   - [ ] Test: internal admin emails link → shopper opens on DMZ → enrollment succeeds
   - [ ] Test: token expires correctly on both backends

5. **Session & user isolation**:
   - [ ] Shopper session on DMZ doesn't accidentally allow access to internal tables
   - [ ] Internal admin session cannot be used to access DMZ (and vice versa)
   - [ ] Role-based access control works correctly on both sides

6. **Monitoring & alerting**:
   - [ ] Database sync lag is monitored (if replicated)
   - [ ] Alert if internal and DMZ backends diverge
   - [ ] Alert if DMZ backend loses database connectivity
   - [ ] Alert if enrollment token validation fails

7. **Rollback procedure**:
   - [ ] If DMZ sync fails, how do we revert/recover?
   - [ ] Can we pause DMZ signups while fixing internal DB?
   - [ ] Document recovery steps in ops runbook

**Suggested next action**: Schedule a deployment readiness review call with the operations/DevOps team. Provide them with:
- This document
- The deployment topology diagram (see section 2.2)
- Test checklist (above)
- List of questions (see above)

---

## 4. Known Limitations & Design Notes

### 4.1 Staging (No Public 2FA)

Staging is a **single Entra environment**. There is no public DMZ variant on staging:
- External shoppers cannot enroll on staging
- Enrollment links generated on staging internal backend won't work (MYSTERY_PUBLIC_BASE_URL would need to be set, but there's no public staging site)
- Staging is for internal staff testing only

**Implication**: To test the full shopper flow (enrollment → 2FA → survey), you must use production DMZ or a local dev setup with both mystery_public and entra configs running.

### 4.2 Local Dev Setup

The local dev stack (`frontend/mystery-shopper` on 5177 with `VITE_AUTH_MODE=mystery_public`) is the **public variant**:
- It requires `MYSTERY_PUBLIC_BASE_URL` to be set in `.env.local` for enrollment emails to work
- Local enrollment links point to `http://localhost:5177/?enroll=...`
- The local mystery backend (8011) must have `AUTH_MODE=mystery_public` set to accept these flows

### 4.3 Shopper Name Autofill Behavior

- The "Mystery Shopper Name (You)" field is **permanently disabled** (readOnly + disabled)
- It is **auto-filled on component mount** from `userInfo?.name` (captured at login)
- Loading a draft **overrides any previously typed shopper name** with the current user's name
- This is intentional: ensures the shopper name always matches who signed in, even if they change accounts or load an old draft

**Why**: Mystery shopper submissions must be attributable to the person who signed in. Allowing them to edit the name would break audit trails.

### 4.4 SMTP Configuration

The enrollment email feature gracefully degrades:
- If SMTP is not configured, the endpoint returns a clear error: "SMTP is not configured on this backend"
- No email is sent; the enrollment token is not committed to the database
- On local dev: SMTP is not configured, so email buttons show this error
- On production/staging: SMTP_* env vars must be set for emails to work

---

## 5. Testing Checklist for Next Phase

Before closing the feature:

- [ ] Run all 18 mystery-public-auth lifecycle tests against PostgreSQL (current status: pass)
- [ ] Click "User Guide" tab on local survey app; verify all sections render
- [ ] Verify scoring key card appears on entry screen, survey tab top, and guide
- [ ] Verify autofilled shopper name shows current user's name and is disabled
- [ ] Create a mystery user on dashboard, click "Email link", verify no SMTP error shown gracefully
- [ ] Verify internal and DMZ URLs work correctly on staging (if deployed)
- [ ] Verify Entra sign-in works on internal survey frontend at staging
- [ ] Full flow test on production DMZ: enroll shopper → sign in → complete survey → review on internal

---

## 6. Git Status & Deployment Readiness

**Current branch**: `feature/mystery-public-2fa-lifecycle`  
**Commits ready to merge**: 4 commits (listed in section 1.1)  
**Uncommitted changes**: None related to this feature  

**Deployment readiness**:
- ✅ Internal (staging) bundle: ready to deploy (build_release_bundle.sh)
- ⚠️ DMZ (production) bundle: build script exists but deployment config (sync, monitoring) not yet verified
- ⚠️ Production database sync: critical gaps (see section 3.2)

**Recommendation**: Merge to main when anchor-navigation is done and production sync is verified. Do NOT deploy to production DMZ until section 3.2 checklist is complete.

---

## 7. For Next Agent: Key Files & Quick Reference

**Core feature files**:
- `backend/app/api/mystery_auth.py` — enrollment email endpoint (`_build_enrollment_email`, `POST /{user_id}/email-enrollment`)
- `backend/app/core/emailer.py` — SMTP helper
- `frontend/mystery-shopper/src/SurveyGuide.jsx` — scoring key + guide content
- `frontend/mystery-shopper/src/SurveyWorkspace.jsx` — sidebar integration, autofill logic
- `frontend/dashboard-blueprint/src/features/mystery-shopper/components/MysteryUsersSection.jsx` — "Email link" UI

**Build configuration**:
- `scripts/linux/build_release_bundle.sh` — internal bundle (entra mode)
- `scripts/linux/build_mystery_public_bundle.sh` — DMZ bundle (public 2FA mode)

**Documentation**:
- `docs/architecture/deployment-topology.md` — existing deployment docs
- `docs/architecture/MYSTERY_PUBLIC_2FA_IMPLEMENTATION.md` — prior phase notes
- This file (`docs/operations/HERMES_MYSTERY_SHOPPER_2FA_PHASE2.md`) — current phase context

**Environment variables** (in `.env.example`):
- `MYSTERY_PUBLIC_BASE_URL` — URL where enrollment links point (DMZ frontend)
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_FROM`, `SMTP_USE_TLS`, `SMTP_USE_SSL`

---

## 8. Known Issues & Gotchas

1. **Vite reads .env.local during build**: The internal build script now pins `VITE_AUTH_MODE=entra` explicitly because Vite reads shell env and .env.local at build time. A stray `VITE_AUTH_MODE=mystery_public` in .env.local or shell would silently flip the internal bundle to public mode, locking admins out. The DMZ build does the same (pins mystery_public). **Keep this in mind when troubleshooting local builds.**

2. **PostgreSQL vs SQLite datetime handling**: Prior phase fixed a crash where naive and aware datetimes were compared. The fix (`as_aware_utc()`) is already in place. This phase didn't touch it, but be aware if you modify enrollment token expiry logic.

3. **Enrollment email only commits if send succeeds**: The endpoint sends email, then commits the token. If SMTP fails, the token is not saved and the admin will need to re-trigger. **This is intentional** to avoid orphaned tokens, but means SMTP failures are user-visible.

4. **Shopper name field is intentionally locked**: Do not add an edit button or remove the disabled attribute. Audit trail depends on it being immutable per session.

---

## 9. Questions for Production DevOps Review

When handing to ops team, ask them to confirm/clarify:

1. **Database**: Is it shared between internal and DMZ, or replicated? If replicated, how is replication monitored and what's the acceptable lag?
2. **Network**: Can DMZ backend reach the database? What are the firewall rules?
3. **Credentials**: How are database credentials managed for DMZ? Does it use a different account (with limited table access) or the same account as internal?
4. **Monitoring**: Is database sync health monitored? Are there alerts for sync lag or connection failures?
5. **Rollback**: If DMZ sync fails, what's the procedure? Can we pause signups?
6. **Testing**: Has a full flow test (internal admin enrolls shopper, shopper uses DMZ, admin reviews on internal) been done in staging or production?

---

**End of Handoff**
