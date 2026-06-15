# HERMES Update Pack — Mystery Shopper 2FA Phase 2
**Date**: 2026-06-10 | **Branch**: `feature/mystery-public-2fa-lifecycle` | **Status**: Ready for merge; Phase 3 pending

> **See also**: `HERMES_REPORT_UI_UPGRADE.md` — separate workstream (2026-06-15) covering report format upgrades across all three platforms, analytics enhancements, and the Q-number display fix. That pack is independent of this one.

---

## What Was Done (4 commits, ready to merge)

| Commit | Feature | Impact |
|--------|---------|--------|
| `6e69f26` | Autofilled shopper name | "Mystery Shopper Name (You)" field auto-populates from logged-in user, disabled, persists across drafts |
| `f59bb93` | Admin enrollment emails | POST /mystery-admin/users/{id}/email-enrollment endpoint; SMTP helper; dashboard UI buttons to send enrollment emails with pre-formatted message (VPN reminder, admin contact) |
| `41d7d9c` | Scoring key + guides | ScoringKeyCard (1-5, 0-10 scales) on entry screen + survey tab + new "User Guide" sidebar tab; 8-section end-user guide; dashboard guides rewritten with admin duties, Users page workflow, Entra access explanation; B2B/Installation guides gain lifecycle sections |
| `1491c57` | Build hardening | Internal bundle now pins `VITE_AUTH_MODE=entra` explicitly (was relying on default); prevents .env.local or shell vars from silently flipping to public 2FA mode and locking admins out |

**New files**: `frontend/mystery-shopper/src/SurveyGuide.jsx` | `backend/app/core/emailer.py`

**Modified files**: mystery_auth.py, SurveyWorkspace.jsx, MysteryUsersSection.jsx, DashboardPage.jsx, PlatformUserGuidePage.jsx, build_release_bundle.sh, .env.example

---

## What's Next (Two Phases)

### Phase 3a: Anchor-Based Guide Navigation (Low-medium effort)
**What**: Internal links in guide that jump to survey/planned tabs, with "← Back to guide" button that remembers scroll position.

**How**:
1. Add `returnTo` URL param handling in SurveyWorkspace
2. Add guide anchor links: `?tab=survey&returnTo=guide-section-5`
3. Show floating "Back to guide" button when returnTo is set
4. Scroll to anchor on guide load

**Complexity**: 2-3 hours for experienced React dev

**Files**: SurveyGuide.jsx, SurveyWorkspace.jsx

### Phase 3b: Production Deployment Verification (Critical, DevOps-led)
**What**: Verify that internal backend + DMZ backend + shared database sync correctly before going live.

**Checklist** (must pass all):
- [ ] Confirm database is shared or replicated (architecture decision point)
- [ ] Both backends can read/write mystery_public tables
- [ ] Internal admin enrolls shopper → DMZ backend can validate token (test enrollment flow)
- [ ] Shopper submits visit on DMZ → admin can read on internal (test data flow)
- [ ] Reference data (locations/purposes) syncs: admin adds location on internal → appears on DMZ within 1 min
- [ ] Firewall rules: DMZ backend can access database, cannot access admin/dashboard tables
- [ ] Monitoring/alerting: database sync lag and connection failures are alerted
- [ ] Rollback procedure documented if sync fails

**Complexity**: DevOps task; 1-2 days planning + testing

**Deliverables**: Signed-off deployment checklist, ops runbook with monitoring/recovery steps

---

## Architecture Snapshot

```
STAGING: Single internal environment
├─ Backend + all frontends (Entra auth)
└─ No public access

PRODUCTION: Two environments
├─ Internal host: backend + dashboard + all surveys (Entra)
└─ DMZ public host: separate backend + mystery-shopper (password+TOTP)
   └─ Both talk to same PostgreSQL (shared or synced)
```

**Critical assumption**: Shared or perfectly-synced PostgreSQL. If sync fails, admins can't see shopper data and shoppers don't see updated reference data.

---

## Key Files & Quick Links

**Feature code**:
- `backend/app/api/mystery_auth.py` — enrollment email endpoint
- `backend/app/core/emailer.py` — SMTP helper
- `frontend/mystery-shopper/src/SurveyGuide.jsx` — guides & scoring key
- `frontend/mystery-shopper/src/SurveyWorkspace.jsx` — autofill + guide sidebar
- `frontend/dashboard-blueprint/src/features/mystery-shopper/components/MysteryUsersSection.jsx` — email UI

**Builds**:
- `scripts/linux/build_release_bundle.sh` — internal bundle (entra, pinned)
- `scripts/linux/build_mystery_public_bundle.sh` — DMZ bundle (public 2FA, pinned)

**Full context**:
- `docs/operations/HERMES_MYSTERY_SHOPPER_2FA_PHASE2.md` — 9-section detailed handoff

---

## Testing Checklist Before Merge

- [ ] All 18 mystery-public-auth lifecycle tests pass (PostgreSQL)
- [ ] User Guide tab renders; all sections visible
- [ ] Scoring key appears on entry, survey tab, guide
- [ ] Shopper name auto-fills, is disabled, persists across drafts
- [ ] Email link buttons show graceful "SMTP not configured" on local dev
- [ ] Email on staging (if SMTP vars set) sends successfully
- [ ] Entra sign-in to internal survey frontend works on staging

---

## Merge Readiness

✅ **Ready to merge to main**: All 4 commits are tested, no breaking changes  
⚠️ **Not ready for production deploy**: Phase 3b (sync verification) must complete first  

**Recommendation**: Merge after Phase 3a anchor navigation is done. Hold production DMZ deploy until Phase 3b is signed off by DevOps.

---

## Known Gotchas

1. **Vite builds read .env.local**: The internal build pins `VITE_AUTH_MODE=entra` because Vite reads .env.local and shell env at build time. A stray `VITE_AUTH_MODE=mystery_public` in .env.local would flip the internal bundle to public mode, locking admins out. The explicit pin prevents this.

2. **Staging has no public 2FA**: Staging is single Entra environment only. To test full shopper flow, use production DMZ or local dev with `mystery_public` mode.

3. **Shopper name field is intentionally locked**: Do not add an edit button or remove the disabled attribute. Audit trail depends on immutability.

4. **Enrollment email only commits if send succeeds**: SMTP failure means token isn't saved and admin must retry. This is intentional to avoid orphaned tokens.

5. **Database sync is critical assumption not yet verified**: Phase 3b must confirm this works end-to-end before production launch.

---

## Questions for Next Phase

For Phase 3a (anchor nav):
- Should "back to guide" button be sticky/floating or inline?
- Should guide remember scroll position when navigating away?

For Phase 3b (production sync):
- Is the database shared or replicated? (Decision point)
- What's the acceptable sync lag for reference data?
- Who owns database monitoring/alerts (DevOps/DBA)?

---

**For full details, see**: `docs/operations/HERMES_MYSTERY_SHOPPER_2FA_PHASE2.md`
