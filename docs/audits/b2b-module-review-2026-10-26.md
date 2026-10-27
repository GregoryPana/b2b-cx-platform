# B2B Module Review — Baseline Map and Findings

Date: 2026-10-26
Status: Baseline for the feature / UI-UX review. **Static code read only. Nothing here was run in a browser or against a database.**

## 0. Evidence boundary

| Item | Value |
|---|---|
| Repo / branch / HEAD | `cx-b2b-platform` / `feature/installation-assessor-wording` / `b83afa5` |
| Worktree | Dirty (docs, agent config and scratch PDFs). No B2B source files were modified. |
| Covered | `frontend/dashboard-blueprint` (admin dashboard, B2B mode), `frontend/survey` (surveyor app), `backend/app` B2B routes, services, models, migrations |
| Not covered | Runtime behaviour, production DB contents, `frontend/dashboard` (legacy), `frontend-unified`, Mystery Shopper and Installation modes except where they share code |
| Unavailable | CodeGraph MCP failed to connect (`CONNECTION_CLOSED`). Search was done with Glob/Grep/Read. |
| Prior audit | `docs/audits/flow-inconsistencies-2026-05-27.md`. Approve/reject/needs-changes now have `require_role("Manager")` (`visits_dashboard.py:3381, 3417, 3454`); that was its #1/#2. Not re-verified at runtime. |

Evidence labels: **Implemented** = seen in code. **Likely** = follows from code but needs a runtime check. **Gap** = expected behaviour missing.

---

## 1. Applications and pages

B2B is two front-ends over one FastAPI backend (Vite proxy `/api` → backend, prefix stripped, `vite.config.js:16-21`).

### 1a. Admin dashboard (`dashboard-blueprint`, platform = "B2B")

Auth: Entra (MSAL) with role-gated platform picker (`App.jsx:30-46`). Every route renders the same 4,290-line `DashboardPage.jsx`, which switches on `location.pathname`. Routes: `App.jsx:121-137`; sidebar: `Sidebar.jsx:18-37`.

| Sidebar | Route | Shows | Main endpoints |
|---|---|---|---|
| Analytics | `/` | Business Focus filter; KPI cards; Question Trend; Category Breakdown; NPS; CSAT; Relationship Score; Competitive Exposure; Yes/No (Q4,6,9,16) | `GET /analytics`, `/analytics/questions`, `/analytics/questions/yes-no`, `/analytics/questions/{id}/trend`, `/analytics/account-executives/yes-no-trends`; also loads the pending list (`DashboardPage.jsx:1035-1038`) |
| Planned Visits | `/planned` | Create-visit form (business, date, type, AE, team members, inline "add AE"); Draft Visits table | `GET /dashboard-visits/all?status=Draft`, `POST /dashboard-visits`, `PUT /dashboard-visits/{id}/draft`, `DELETE /dashboard-visits/{id}`, `POST /account-executives` |
| Trends | `/trends` | Trend Explorer (question selector + line chart); AE Yes/No bar chart | `/analytics/questions`, `/analytics/questions/{id}/trend`, `/analytics/account-executives/yes-no-trends` |
| Review (red badge) | `/review` | Review Queue table; detail card with per-response edit and action points | `GET /dashboard-visits/all?status=Pending`, `GET /dashboard-visits/{id}`, `PUT .../approve`, `PUT .../reject`, `PUT .../responses/{rid}` |
| Action Points | `/actions` | 5 filters; two summary cards; one table per survey and business | `GET /dashboard-visits/actions`, `PUT /dashboard-visits/actions/status` |
| Surveys | `/surveys` | Status and business filters; Surveys table; read-only detail card | `GET /dashboard-visits/all`, `GET /dashboard-visits/{id}` |
| Reports | `/reports` | 3-step wizard: type (Selected Business / Selected Date / Lifetime / Action Points), scope, deliver (preview, HTML, PDF, email) | `GET /dashboard-visits/reports/surveys`, `/reports/export`, `/reports/pdf`, `POST /reports/email` |
| Businesses | `/businesses` | Business Directory (inline-edit table) | `GET /b2b/public/businesses`, `POST/PUT /businesses`, `PUT /b2b/businesses/{id}`, `DELETE /b2b/businesses/{id}` |
| Account Executives | `/executives` | AE Directory (inline-edit table) | `GET /b2b/public/account-executives`, `POST/PUT/DELETE /account-executives` |
| User Guide | `/user-guide` | `PlatformUserGuidePage platform="b2b"` | none |

Sidebar badge: `App.jsx:64-98` polls `GET /dashboard-visits/all?status=Pending&survey_type=B2B` every 30 s and counts the array.

### 1b. Surveyor app (`frontend/survey`)

Sidebar: Planned Visits, Survey, User Guide (`Sidebar.tsx:15-19`). `SurveyWorkspacePage.tsx` (1,667 lines) does: pick or create a visit, fill responses (upsert), submit.

Endpoints: `/survey-businesses`, `/questions`, `/b2b/public/account-executives`, `/dashboard-visits/all`, `/dashboard-visits/{id}`, `POST /dashboard-visits`, `PUT .../draft`, `POST|PUT .../responses`, `PUT .../submit`, **`POST /account-executives` (:489)**, **`POST /b2b/businesses` (:592)**.

### 1c. Visit lifecycle (as implemented)

```
Planned (dashboard)  --create-->  Draft  --surveyor fills-->  Draft
Draft --submit--> Pending --approve--> Approved   (feeds analytics: all queries filter status='Approved')
                          --reject---> Rejected
                          --needs-changes--> Needs Changes   (backend only; no button in the dashboard)
Draft --delete (owner or admin)--> removed
```

---

## 2. Tables

| Page | Component | Columns | Row actions | Notes |
|---|---|---|---|---|
| Planned Visits | `PlannedVisitsDataTable.jsx` | Business, Date, Type, AE, Team Members, Status, Progress, Actions | Edit (inline: date, type, AE, team), Delete | "Planned" is just `status=Draft`, so started drafts appear too (Progress column). |
| Review | `ReviewQueueDataTable.jsx` | Business, Date, Submitted By, AE, Status, Actions | View, Approve, Reject | Approve/Reject use `window.prompt`. |
| Surveys | `SurveysDataTable.jsx` | Business, Date, AE, Team Members, Status, Progress, Action | View Details | Business filter sends the business **name**, not the ID. |
| Action Points | `ActionPointsDataTable.jsx` | Visit (hidden), Date, Question, Action Required, Lead Owner, Timeline, Status, Support Needed, Comments, Save | Save (per row) | One table per survey + business group. |
| Businesses | `BusinessesDataTable.jsx` | Name, Location, Business Type, AE, Status, Actions | Edit (inline), Retire, Delete, Add Business | Rows with no location or no AE are tinted (`bg-warning/10`, no legend). |
| Account Executives | `ExecutivesDataTable.jsx` | Name, Email, Actions | Edit (inline), Delete, Add | No count of assigned businesses. |

All six share the same TanStack scaffold (filter-by-column, view options, reset, pagination) copy-pasted per file.

---

## 3. Duplicates

| Duplicate | Where | Consequence |
|---|---|---|
| Create account executive ×3 | Planned page form, Executives page, Survey workspace | Three code paths. Surveyors get 403 (see F6). |
| Create business ×2 | Businesses page (`POST /businesses`), Survey workspace (`POST /b2b/businesses`) | Two different backend implementations (F1, F6). |
| Business create/update/delete via 3 backends | `survey.py:397/439`, `programs/b2b/router.py`, `routers/businesses.py` (not mounted) | Different validation, role checks and error behaviour. |
| Business list ×4 | `/b2b/businesses`, `/b2b/public/businesses`, `/survey-businesses`, legacy `/businesses` | Different columns and sort rules. |
| AE endpoints ×3 | `/account-executives`, `/b2b/account-executives`, `/b2b/public/account-executives` | Reads and writes on different prefixes. |
| Question Trend | Analytics page and Trends page | Same chart and selector. Only Analytics is filtered by business. |
| Draft listing | Planned Visits table and Surveys "Draft" filter | Same data, two entry points. |
| Pending listing | `/dashboard-visits/pending`, `/drafts` (unused by the dashboard) vs `/all?status=` | Dead endpoints with different shapes. |
| Business type vs priority | `businesses.priority_level` holds `sme`/`large_corporate`; legacy values `high/medium/low` still handled in SQL | `ORDER BY` in `/b2b/public/businesses` (`router.py:182-188`) only ranks high/medium/low, so new values all sort as "else". |
| AE identity | `businesses.account_executive_id` (FK) vs `visits.account_executive_name` (free text) | Two sources of truth that are never reconciled (F9). |
| Two ORM `Business` classes | `app/models/business.py` and `programs/b2b/models.py` on the same table | Drift risk. |
| Parallel tables | Migration `d01c3a366199` creates `b2b_businesses`, `b2b_account_executives` | Status unknown; see open questions. |

---

## 4. Findings

### High

**F1. Editing a business cannot clear the account executive or location.** *Implemented.*
`PUT /businesses/{id}` is served by `survey.py:439-498` and uses `COALESCE(:param, column)` (lines 451-457). The UI sends `null` when the AE or location is cleared (`DashboardPage.jsx:2287-2290`), so the old value stays. The success toast still says "Business updated". Also, typing an AE name that doesn't match exactly sets `account_executive_id: ""` (`BusinessesDataTable.jsx:139`), which is another silent no-op.

**F2. Backend swallows its own 404/validation errors into 500s.** *Implemented.*
`survey.py:475-476` raises `HTTPException(404)` inside a `try` whose `except Exception` (:496-498) re-raises a generic 500 "Failed to update business". Create (:397-436) does no name validation or duplicate check, forces `active=True` (ignoring the form), and reads `result.lastrowid` (:425). On Postgres that is likely `0`/`None`, so the returned `id` is probably wrong (*Likely*; the UI only uses `name`).

**F3. Business hard-delete is probably broken for any business with team-member data, and is under-warned.** *Likely.*
`BusinessService.delete_business` (`services.py:199-275`) deletes responses, then visits, then the business. It never clears `meeting_attendees`. `visits_dashboard.py:3027-3033` states that table references `visits.id` without ON DELETE CASCADE. A business with a visit that has team members would fail with a raw FK error returned as a 500 (rollback, nothing deleted). Separately, the UI confirm only says "cannot be undone" (`DashboardPage.jsx:2331-2334`). The `deletion-summary` endpoint (`router.py:88-104`) exists and is never called, so users can't see how many visits and responses they are about to destroy. Retire has no confirm and there is no "Reactivate" button (only Edit → Status).

**F4. Visit endpoints are open to every platform role, and `PUT /{id}/draft` has no status or actor check.** *Implemented.*
`visits_compat_router` is mounted with `ALL_PLATFORM_ROLES` (`main.py:171`), so Mystery/Install roles can call B2B visit routes. `GET /all`, `/actions`, `/drafts` and `PUT /{id}/draft` have no `get_current_user` or role dependency of their own (`visits_dashboard.py:733-741, 867-875, 2706, 2868`). `update_visit_draft` never checks `status = 'Draft'`, so it can change the date, type, rep or AE on Pending/Approved visits. It also does not call `mark_visit_edited`. `PUT /actions/status` has the same router-level-only exposure.

**F5. Deleting an AE who is assigned to businesses, or creating a duplicate AE email, returns an unhandled 500.** *Likely.*
`businesses.account_executive_id` is an FK with no `ondelete` (`20260219_000001_initial_schema.py:42`). `routers/account_executives.py:61-73` calls `db.delete` with no guard. The email column is unique (`programs/b2b/models.py:27`) and `POST` has no duplicate handling. The Planned-page "Add AE" calls `await res.json()` directly (`DashboardPage.jsx:1516`), which throws on a non-JSON 500, so the user sees nothing.

**F6. Surveyors are offered actions the server refuses.** *Implemented.*
Survey workspace "new business" calls `POST /b2b/businesses` → `require_role("Admin")` (`router.py:70`); "add account executive" calls `POST /account-executives` → `B2B_ADMIN`/`CX_SUPER_ADMIN` only (`account_executives.py:32`). A `B2B_SURVEYOR` gets 403 after filling in the form.

### Medium (UX and flow)

**F7. "Type to search" business pickers don't accept typing.** *Implemented (React behaviour).*
Three places bind `value` to the *name of the selected ID* and only set the ID on an exact name match (`DashboardPage.jsx:3967-3978` Reports, `:4019-4028` Action-Points report, `:4272-4281` Actions filter). Typing a partial name leaves the ID unchanged, so React resets the input and the character vanishes. Only clicking a datalist option works. Placeholders say "Type to search business…". Worth a 30-second browser check.

**F8. Page state is thrown away on every sidebar click.** *Implemented.* `App.jsx:122-135` gives each route its own `key`, so `DashboardPage` remounts and refetches. The Analytics business selection, report scope and survey filters reset. The Trends page has no business filter (and can't inherit Analytics').

**F9. Planned-visit form ignores the business's assigned AE.** *Gap.* Choosing a business doesn't prefill the AE (`DashboardPage.jsx:3379`). The AE is free text with a datalist, so typos create "ghost" AE names on visits that match nothing in the directory. The first business is silently preselected (`:2436-2440`). The duplicate-day check (one visit per business per day) fails open on error (`visits_dashboard.py:617-619`).

**F10. "Needs Changes" exists in the backend and data, not in the dashboard.** *Gap.* Endpoint `PUT .../needs-changes`, status colour, and badge variant exist; the Review queue only offers Approve/Reject (`ReviewQueueDataTable.jsx:71-73`), via `window.prompt` with the note optional. `docs/architecture/visit-lifecycle.md` says notes are required for Needs Changes; the legacy dashboard enforced notes (`frontend/dashboard/src/App.jsx:922`).

**F11. Action Points table loses unsaved edits and refetches per keystroke.** *Implemented.*
`ActionPointsDataTable.jsx:30-37` rebuilds all drafts from `data` whenever `data` changes. Saving one row updates the list, which wipes unsaved edits in the other rows of that table. The Actions effect (`DashboardPage.jsx:1815-1818`) depends on `loadActionsBoard`, which depends on the filter object, so typing in "lead owner" or "support" fires a request per character. Also: the "Visit" column is a raw UUID and hidden by default; the "by Survey Type" summary card is a single row ("B2B") because the screen is B2B only; "Support Needed" and "Lead Owner" are free text.

**F12. Detail panels open below the table with no scroll.** *Implemented.* Review and Surveys render the visit detail card after the table card (`:3252`, `:4167`) and nothing scrolls to it (no `scrollIntoView` in `DashboardPage.jsx`). On a long table the click looks like a no-op. Review edits are saved one response at a time ("Save Response Edit"), before the approve decision, with no "unsaved changes" warning.

**F13. Toasts and confirms are in the wrong order.** *Implemented.* "Creating business…" fires before validation (`:2252`); "Deleting business…" fires before the confirm (`:2330-2334`); "Approving…" fires after `window.prompt`, so cancelling the prompt still approves (`:1650-1653`). `window.prompt` returns `null` on Cancel and the code coerces that to `""`.

**F14. "Planned" = "Draft".** *Gap.* The Planned list includes visits a surveyor has already started. The Surveys page has a Draft filter too. There is no deep link between the dashboard and the survey app (no `VITE_SURVEY…` or `returnTo` in `dashboard-blueprint/src`); the page tells users to "open it" in the other app. The survey app silently changes an overdue visit's date to today on confirm (`SurveyWorkspacePage.tsx:536-559`), using the unguarded `/draft` endpoint (F4).

**F15. Errors that look like empty data.** *Implemented.* `/b2b/public/businesses` and `/b2b/public/account-executives` catch every exception, `print("DEBUG…")`, and return `[]` (`router.py:159-210, 220-249`). A DB failure shows as "No businesses…" and the filter list as "No businesses with approved surveys yet".

**F16. Schema changes at request time, and a heavy poll.** *Implemented.* `ensure_visit_*_columns` run `ALTER TABLE visits` from GET/POST handlers (`visits_dashboard.py:237-282`). `GET /all` (a GROUP BY over visits × responses × questions with a per-visit mandatory-question subquery) is polled every 30 s per admin tab just to count Pending rows.

### Low

- `InfoHint` is declared inside the component (`DashboardPage.jsx:792`), so it remounts on every state change and closes its popover.
- Analytics "Question Trend" shows "Loading trend data…" forever when there is no data (`:2836`); the CSAT pie has no empty state (`:2964`).
- Date format is DD-MM-YYYY in tables and ISO in detail cards.
- Yes/No card copy hard-codes "Questions 4, 6, 9, and 16" (`:3089`); the Trends AE card hard-codes Q4/Q6. These will drift when questions are reordered (prior audit #8).
- Frontend sends `X-User-Id`/`X-User-Role` headers (`App.jsx:276-284`) that the backend ignores; `representative_id: Number(headers["X-User-Id"])` is `NaN` for Entra GUIDs and serialises to `null` (works only because the server falls back).
- Planned-visit edit PUT does not reassign the representative to the surveyor who takes the visit, so "Representative" on the detail card is the creator.
- Reports "Action Points" type stores its status filter in `reportVisitId` (`:4045`).
- Survey filter by business **name** (`:3873`) conflates same-named businesses.
- AE has `phone`/`active` columns in the model but neither is exposed.

---

## 5. Request-to-DB trace summary

| UI action | Entry | Handler | Writes |
|---|---|---|---|
| Create planned visit | `POST /dashboard-visits` | `visits_dashboard.create_visit` | `visits` (+ `meeting_attendees`); needs `survey_types` row 'B2B' |
| Edit planned visit | `PUT /{id}/draft` | `update_visit_draft` (F4) | `visits`, `meeting_attendees` |
| Delete planned visit | `DELETE /{id}` | `delete_draft_visit` (owner or admin, Draft only) | responses, attendees, visit |
| Approve / Reject | `PUT /{id}/approve|reject` | `require_role("Manager")` | `visits.status` |
| Edit response in review | `PUT /{id}/responses/{rid}` | `update_response` | `b2b_visit_responses` (actions are JSONB) |
| Update action status | `PUT /actions/status` | read-modify-write of the JSONB `actions` array, no lock | `b2b_visit_responses.actions` |
| Create / edit business | `POST|PUT /businesses` | `survey.py` raw SQL (F1, F2) | `businesses` |
| Retire business | `PUT /b2b/businesses/{id}` `{active:false}` | `BusinessService.update_business` (the dedicated `/retire` route is unused) | `businesses.active` |
| Delete business | `DELETE /b2b/businesses/{id}` | `BusinessService.delete_business` (F3) | responses, visits, business |
| AE CRUD | `/account-executives` | `routers/account_executives.py` (F5) | `account_executives` |
| Analytics | `GET /analytics*` | `routers/analytics.py` — all queries filter `status='Approved'` | read-only |

---

## 6. Open questions for the owner

1. Should deleting a business remain possible, or become retire-only with an admin purge behind a deletion summary?
2. Should the Planned page default the AE from the business, and should AE on a visit be an FK instead of free text?
3. Is "Needs Changes" meant to be in the dashboard (and should reject/needs-changes require a note)?
4. Are Mystery/Install roles intended to read B2B visits? (F4)
5. Are `b2b_businesses` / `b2b_account_executives` tables live, or dead?
6. Should Trends and Analytics be merged, or should Trends gain the business filter and keep state?

## 7. Suggested next step

You said you'd point me at specific areas. Good candidates for a first deep-dive are F1/F2/F3 (Businesses page) and F7/F11 (filters and Action Points), since each is self-contained. A short browser pass on F7, F12 and F13 would turn those from "code-evident" into "runtime-verified". No code has been changed.

---

## 8. Remediation status (branch `feature/b2b-review-fixes`)

Decisions taken with the owner: delete-with-safeguards (typed name + deletion summary); block AE delete when assigned (409); add Needs Changes with required notes for Reject/Needs Changes; restrict `/dashboard-visits/*` to B2B roles and make `/draft` Draft-only.

| Finding | Status | What changed |
|---|---|---|
| F1 clear AE/location | Fixed | UI now uses validated `PUT /b2b/businesses/{id}` (explicit nulls clear); unmatched AE text is rejected client-side |
| F2 404→500, no validation | Fixed | Pydantic name/location cleaning, duplicate (name+location) 409, AE-exists 400, real ids returned; `survey.py` update no longer converts 404 to 500 |
| F3 business delete | Fixed | Deletes `meeting_attendees` first (reproduced as a failing test on old code); deletion summary now shows visits/responses/status counts; dialog needs the business name typed; Retire has a confirm; Reactivate button added |
| F4 visit access | Fixed | `/dashboard-visits/*` mounted for B2B roles only; `/draft` needs login, Draft status, valid rep, and records the editor; review decisions require Pending |
| F5 AE delete / duplicate email | Fixed | 409 with clear messages; email validated and normalised; safe JSON parsing in the UI |
| F6 surveyor 403s | Fixed | Create business / create AE allowed for B2B surveyors (edit/delete stay admin-only) |
| F7 pickers | Fixed | New `EntityCombobox` replaces the three pickers |
| F8 state reset | Partly | Analytics business filter persists for the session and shows on Trends; other filters still reset per tab |
| F9 planned form | Fixed | AE prefilled from the business, no silent first-business preselect, hint when the AE is not in the directory |
| F10 Needs Changes | Fixed | Dialog replaces `window.prompt`; Needs Changes button; notes required (B2B); reviewer note shown to surveyors on the returned visit |
| F11 Action Points | Fixed | Unsaved edits survive saving another row; filter requests debounced; "Save changes" highlights dirty rows |
| F12 detail panels | Partly | B2B detail cards scroll into view; per-response save unchanged |
| F13 toast order | Fixed | Replaced by dialogs |
| F15 silent `[]` | Fixed | Public lists return 500 with a message; debug prints removed; business-type ordering corrected |
| F16 poll cost | Partly | Sidebar badge uses new `GET /dashboard-visits/pending-count`; request-time `ALTER TABLE` helpers left in place |
| Low items | Partly | `InfoHint` hoisted, trend empty state fixed; date formats, hard-coded Q numbers, rep reassignment left |

Not changed (needs a decision or separate work): request-time DDL in `visits_dashboard.py`; duplicate business/AE endpoints and the unmounted `routers/businesses.py`; **alembic has three heads and does not build an empty database** (`mystery_shopper_locations` ALTER fails), so release must continue to rely on the existing database state.

Verification: 11 new backend tests (`backend/tests/test_b2b_review_fixes.py`, 9 fail on the old code) pass against a throwaway Postgres; `vite build` passes for `dashboard-blueprint` and `survey`; `tsc` clean for `survey`. **Not verified:** the UI in a browser (the Chrome extension was unavailable), and the existing mystery/dedup suites against a full schema.
