# CX B2B Platform — Flow Inconsistency & Inefficiency Audit

Date: 2026-05-27
Scope: backend (`backend/app/...`, alembic, seed scripts), four frontends (survey, dashboard-blueprint, mystery-shopper, installation-survey), plus SQL bootstrap dumps.

## Critical (breaks user flow)

### 1. Approve / Reject / Needs-changes have no role check at all

**Location:** `backend/app/api/visits_dashboard.py:2952-3046`

**Observation:** `approve_visit`, `reject_visit`, and `request_changes` (the `/needs-changes` route) are declared as `def approve_visit(visit_id: str, approval_data: dict, db: Session = Depends(get_db))` — no `current_user`, no `require_role` dependency. The router-level guard in `main.py:158` is only `require_roles(*ALL_PLATFORM_ROLES)`, which lets any surveyor through. By contrast, `/pending` has `require_role("Manager")` (line 2530).

**Why it's a problem:** Any authenticated B2B/Mystery/Install surveyor (the broadest role set) can approve or reject any visit by hitting these endpoints directly. The review queue UI hides the buttons for non-managers, but the endpoint accepts the call. Combined with finding #2, even the `/pending` "Manager" gate is effectively a no-op anyway, so management actions are entirely unprotected on the server.

**Suggested fix:** Add `_admin: bool = Depends(require_roles("CX_SUPER_ADMIN", "B2B_ADMIN"))` (or the equivalent program-aware dependency) to each of the three handlers, mirroring how `/pending` does it but with a real role.

**Confidence:** high

### 2. `require_role("Manager")` is a no-op — falls into the "surveyor" allow branch

**Location:** `backend/app/core/auth/dependencies.py:99-135`, used by `backend/app/api/visits_dashboard.py:2530`

**Observation:** `require_role` lowercases `required_role` and only recognises the literals `"admin"`, `"representative"`, and `"surveyor"`. Anything else (including `"Manager"`) hits the final `else: allowed = survey_roles` branch, which for program B2B is `(CX_SUPER_ADMIN, B2B_ADMIN, B2B_SURVEYOR)`. The `/pending` route therefore lets every B2B surveyor read pending visits even though the developer clearly intended a manager-only gate.

**Why it's a problem:** Silent permission downgrade — the call signature reads correctly but the dependency does the wrong thing. Any future call to `require_role("Manager")` or `require_role("Approver")` will silently widen permissions.

**Suggested fix:** Either delete the catch-all `else` branch and raise on unknown role names, or add an explicit `"manager"` branch mapping to `admin_roles`. Audit all `require_role(...)` call sites at the same time.

**Confidence:** high

### 3. `get_all_visits` indexes `row[17]` from a 16-column result

**Location:** `backend/app/api/visits_dashboard.py:741-743`

**Observation:** The SELECT in `get_all_visits` returns columns 0-15 (response_count = row[13], mandatory_answered_count = row[14], mandatory_total_count = row[15]). The mapping then reads `row[15]` for `mandatory_total_count` and `row[17]` for `is_completed`. There is no row[17].

```
"mandatory_total_count": row[15] if len(row) > 15 else 24,
"is_started": row[13] > 0,
"is_completed": row[17] if len(row) > 17 else False
```

**Why it's a problem:** `is_completed` is always `False` for every visit returned by `/dashboard-visits/all`, because `len(row) > 17` is never true. Any dashboard list that depends on `is_completed` to drive a badge / progress indicator is stuck. The hard-coded `24` for the total mandatory count is a second, separate code-smell — the migration just added a question so the real total varies by survey type.

**Suggested fix:** Drop the `row[17]` reference (it was probably a leftover after a query refactor) and compute `is_completed` from `mandatory_answered_count >= mandatory_total_count` like `get_visit_detail` already does on line 3220. Replace the literal `24` fallback with `mandatory_answered_count` or 0.

**Confidence:** high

### 4. `/dashboard-visits/pending` does not return AE or team members — review queue cells always show "--"

**Location:** `backend/app/api/visits_dashboard.py:2526-2580` vs. `frontend/dashboard-blueprint/src/components/b2b/ReviewQueueDataTable.jsx:45-49`

**Observation:** `get_pending_visits` selects `submitted_by_*` and `business_priority` but not `account_executive_name`, and never calls `fetch_visit_team_members`. The review queue column `account_executive_name` therefore always renders `--` even when the visit was created with an AE filled in. The same data IS returned by `/dashboard-visits/all` (line 734) and `/{visit_id}` (line 3209), so the dashboard's other tables show it correctly.

**Why it's a problem:** Reviewer can't see who the AE was without opening each visit, defeating the purpose of the AE filter (line 103 of ReviewQueueDataTable) that's already wired in the UI.

**Suggested fix:** Add `v.account_executive_name` to the SELECT and `team_member_names: fetch_visit_team_members(db, str(row[0]))` to the dict (or, better, do a single subquery to avoid N+1; see finding #11).

**Confidence:** high

## High (silent data loss or drift)

### 5. SQL bootstrap dumps still reflect pre-reorder ordering and miss q18_competitor_service_with_cws

**Location:** `data.sql:129`, `local_data.sql:112-113`, `production_data.sql:112-113`, `MIGRATE_B2B_QUESTIONS.sql:246`

**Observation:** All four dump/migration SQL files still place `q15_current_products_services` in Category 4 at `question_number = 15`, matching the pre-`20260527_000020` state. They also do not contain `q18_competitor_service_with_cws` (added by `20260415_000016`). They are at least two migrations behind the live schema.

**Why it's a problem:** Anyone bootstrapping a fresh local DB by running `psql < data.sql` or `psql < production_data.sql` will end up with old ordering and a missing question. The next `alembic upgrade head` then runs the reorder against a state it doesn't recognize (q15 might not exist as expected), and the new q15→7 move silently fails on the parking step because the row count differs. The seed.py blueprint is the only file that's currently correct.

**Suggested fix:** Either regenerate the dumps from current production, or delete them in favour of `alembic upgrade head` + `python -m scripts.seed`. Add a note in README that the `.sql` dumps are archived snapshots and not authoritative.

**Confidence:** high

### 6. Duplicate `q18_` question_key prefixes in seed and live data

**Location:** `backend/scripts/seed.py:175` and `:185`

**Observation:** Seed defines both `q18_competitor_service_with_cws` (order_index 18) and `q18_product_review_needed` (order_index 19). Two distinct question_keys share the `q18_` prefix. Migration `20260415_000016` introduced the first and shifted the second to position 19, but the legacy key name `q18_product_review_needed` was never renamed to `q19_product_review_needed`.

**Why it's a problem:** Any code that pattern-matches on a `q18_` prefix (none today, but `q23_nps` style detection is common) will be ambiguous. More importantly, the human/analyst reading the key cannot trust the leading number — q18 != q18.

**Suggested fix:** Rename `q18_product_review_needed` → `q19_product_review_needed` (and update the existing key in the DB via a small data migration). Apply the same naming pass after every reorder.

**Confidence:** high

### 7. seed.py order_index 21 and 22 are swapped relative to question_key

**Location:** `backend/scripts/seed.py:200-215`

**Observation:** `q20_expansion_services_required` is given `order_index: 22` and `q21_expansion_types` is given `order_index: 21`. The keys say q20 should come before q21; the order_index puts q21 first.

**Why it's a problem:** Surveys ordered by `order_index` show q21 before q20. If question_number is treated as authoritative (it tracks order_index), the displayed "Q20" and "Q21" labels swap relative to their stable keys. Most analytics consumers use question_key, but the survey UI uses question_number for the "Q{n}" prefix.

**Suggested fix:** Swap the two `order_index` values in seed.py and add an alembic patch that does the same against the live `questions` table.

**Confidence:** high

### 8. Analytics fallback chain on `order_index` / `question_number` is brittle to future reorders

**Location:** `backend/app/routers/analytics.py:222-250`

**Observation:** The branch picks `question_key = 'q12_overall_satisfaction'` when available, otherwise falls back to `order_index = 13` and finally `question_number = 13`. The `13` matches today only because q12 happens to still be at position 13 after the q15→q7 reorder shifted q07-q14 up by one. The same is true for `q16_filter = q.order_index = 16` (q16 didn't move). But the relationship range `BETWEEN 1 AND 6` is now wrong if anyone reads it as "the six AE/relationship questions" — q15_current_products_services is at order_index 7, sitting inside the AE block visually, and there are still six relationship items at 1-6 only by chance.

**Why it's a problem:** The fallback exists for old DBs that don't have `question_key`. Those DBs are by definition the pre-reorder ones, so the numeric ranges were correct in their universe — but the next reorder will silently shift them. There is no test that catches "the integer literal in analytics.py drifted from the key it shadows".

**Suggested fix:** Drop the order_index / question_number fallbacks entirely once `question_key` is guaranteed (it's been NOT NULL in seed for two release cycles). If they must stay, derive the integers at startup by SELECTing the order for each known key.

**Confidence:** medium

### 9. POST `/{visit_id}/responses` doesn't mark the visit as edited

**Location:** `backend/app/api/visits_dashboard.py:2731-2805` vs. `2807-2900`

**Observation:** `update_response` (PUT) calls `mark_visit_edited(db, visit_id, current_user)` on line 2872. `create_response` (POST, line 2731) does not. Both code paths mutate the visit's response set from the survey workspace.

**Why it's a problem:** "Last edited by / at" tracked on the visit will be wrong when the surveyor adds new answers but doesn't go back to revise existing ones. Audit trail under-reports activity.

**Suggested fix:** Call `mark_visit_edited(db, visit_id, current_user)` right before the `db.commit()` in `create_response`.

**Confidence:** high

### 10. Survey workspace POST sends both `team_member_names` and legacy `meeting_attendees`; backend ignores the latter on writes but reads it as a fallback

**Location:** `frontend/survey/src/features/survey/SurveyWorkspacePage.tsx:557-558` and `backend/app/api/visits_dashboard.py:539, 2637`

**Observation:** The survey POST builds both `team_member_names: [...]` and `meeting_attendees: [{name, role: "Team Member"}, ...]`. The backend's `create_visit` and `update_visit_draft` accept either (`team_member_names or meeting_attendees or []`). The PUT path (line 590) only sends `team_member_names`. The dashboard-blueprint `handleCreatePlannedVisit` and `savePlannedVisitEdit` only send `team_member_names`.

**Why it's a problem:** Three callers, two different payload shapes. If someone "cleans up" by removing the `or visit_data.get("meeting_attendees")` fallback, the survey workspace create flow keeps working but only because it always sends both keys — the safety net is invisible. If someone "cleans up" the survey workspace to stop sending `meeting_attendees`, nothing breaks. The duplicate field encourages drift.

**Suggested fix:** Drop the `meeting_attendees` payload field from `SurveyWorkspacePage.tsx:558` (the simplest fix) and the backend fallback at `:539` and `:2637`. Settle on `team_member_names` as the wire format.

**Confidence:** high

## Medium (rough edges)

### 11. `fetch_visit_team_members` runs once per visit row in `/all` and `/drafts` (N+1)

**Location:** `backend/app/api/visits_dashboard.py:735` (inside the list comprehension of `get_all_visits`) and similar pattern elsewhere

**Observation:** Each row triggers an extra `SELECT name FROM meeting_attendees WHERE visit_id = :vid` plus an `information_schema` lookup via `has_table(db, "meeting_attendees")` (the `has_table` call is itself executed each invocation — see finding #12).

**Why it's a problem:** A page that lists 200 draft visits runs 400+ extra queries. On a remote DB this can dominate the response time.

**Suggested fix:** Pre-aggregate team members in the same SELECT: `LEFT JOIN LATERAL (SELECT array_agg(name ORDER BY id) AS members FROM meeting_attendees WHERE visit_id = v.id AND role = 'Team Member') ma ON true`, then return `row.members or []`.

**Confidence:** high

### 12. `has_table` / `has_column` are uncached and duplicated in 5 files

**Location:** `backend/app/api/visits_dashboard.py:30-50`, `mystery_shopper.py:81-100`, `dashboard_compat.py:15-30`, `survey.py:34-50`, `routers/analytics.py:14-30`

**Observation:** Five near-identical implementations, all of which round-trip to `information_schema` on every call. `visits_dashboard.py` makes 47 `has_table`/`has_column` calls across its 3.2 kloc; a single GET to `/dashboard-visits/{id}` runs 7+ of them.

**Why it's a problem:** Every request pays for schema introspection that almost never changes within a process. Also five copies = five places to fix when columns get added.

**Suggested fix:** Move them to `app/core/db_inspect.py` and cache results with `@functools.lru_cache` keyed by `(table_name, column_name)` — the cache survives the process lifetime, which is exactly the right TTL (schema changes require a restart anyway).

**Confidence:** high

### 13. `get_visit_detail` mandatory-count query has no visit-type filter on legacy DBs

**Location:** `backend/app/api/visits_dashboard.py:3179-3193`

**Observation:** When the DB doesn't have `survey_type_id` on either `visits` or `questions`, the fallback query counts `is_mandatory = true` across *all* questions, regardless of survey type. The non-fallback path joins on `survey_type_id` and is correct.

**Why it's a problem:** Any legacy DB where B2B, mystery-shopper, and installation questions live in the same `questions` table without the column will inflate `mandatory_total_count`, leaving every visit stuck at "not complete". This is the same legacy state the SQL dumps (finding #5) would re-create.

**Suggested fix:** In the fallback branch, restrict to questions that have at least one response in this visit, or accept that the legacy path is unsupported and raise a clearer 500.

**Confidence:** medium

### 14. Survey workspace "Save Visit Details" can't update `representative_id` while planned-visit load does

**Location:** `frontend/survey/src/features/survey/SurveyWorkspacePage.tsx:518-528` (planned load) vs. `:587-595` (active save)

**Observation:** The "load planned visit" PUT at line 518 sends `representative_id: Number(userId)`. The active-view "Save Visit Details" PUT at line 587 omits it. The backend's `update_visit_draft` only changes `representative_id` when it's present, so this is currently safe — but a surveyor swapping ownership via the active view has no way to do so.

**Why it's a problem:** Two PUTs to the same endpoint with different payload shapes from the same screen. If anyone later wires a "reassign rep" control into the active panel, they'll wonder why it doesn't persist.

**Suggested fix:** Either send `representative_id` from both forms (harmless on the load path since it's already correct), or split the endpoints into `/draft/details` (date/type/AE/team) and `/draft/ownership` (representative_id).

**Confidence:** medium

### 15. Yes/No card config in DashboardPage hardcodes pre-reorder question_number for q09

**Location:** `frontend/dashboard-blueprint/src/pages/DashboardPage.jsx:1952-1955`

**Observation:** `requiredQuestions` has `{ key: "q09_issues_resolved_on_time", number: 9, ... }`. After migration `20260527_000020` the actual `question_number` for that key is **10** (q07-q14 shifted up to make room for q15 at position 7). The matcher on line 1970 still works because it tries `question_key === required.key` first, but the visible label `Q${item.question_number}` renders **Q10** while the card config still says `Question 9` in the description string.

**Why it's a problem:** Label drift between the chip and the bar chart. Future-you adds a fourth card that's only keyed by number and silently shows the wrong question.

**Suggested fix:** Drop the `number` field entirely from `requiredQuestions` (and from the matcher). Always match on `question_key`. Derive the displayed "Q{n}" from the API response.

**Confidence:** medium

### 16. Installation survey backend joins on `question_number` exclusively — there's no `question_key` fallback

**Location:** `backend/app/api/installation_surveys.py:667, 827, 992, 1172, 1247`

**Observation:** Every join is `JOIN installation_questions q ON r.question_number = q.question_number`. There is no question_key column in `installation_questions` (verified by absence in those SELECTs).

**Why it's a problem:** Installation is the one program that *cannot* survive a reorder. Renumbering an installation question silently rewrites the analytics history because old responses keyed by `question_number` will join to a different question.

**Suggested fix:** Add a `question_key` column to `installation_questions`, store it on responses (`installation_survey_responses.question_key`), and migrate joins. Treat `question_number` as a display-only field. Until then, document that installation questions are append-only.

**Confidence:** high

### 17. Two seed scripts coexist with overlapping intent

**Location:** `backend/scripts/seed.py`, `backend/scripts/seed_old_obsolete.py`, plus `seed_realistic_survey_process.py` and `seed_cx_platform.py`

**Observation:** `seed_old_obsolete.py` still imports and runs cleanly; nothing in the codebase prevents someone running it. Its blueprint matches the pre-reorder layout — same risk as the SQL dumps. `seed_cx_platform.py` defines four entirely different `question_key` values (`relationship_strength`, `ae_professionalism`, `service_quality`, `would_recommend`) that don't match anything else in the platform.

**Why it's a problem:** A new dev running the wrong seed populates the DB with stale or invented questions. Diagnosing the resulting analytics drift takes longer than the cleanup.

**Suggested fix:** Delete `seed_old_obsolete.py` and `seed_cx_platform.py`. If `seed_cx_platform.py` represents a planned consolidation, rename it `seed_cx_platform.draft.py` and exclude it from any Makefile target.

**Confidence:** high

## Low (cleanup)

### 18. 36 `print(...)` statements left in production API code

**Location:** `backend/app/api/visits_dashboard.py` (19), `survey.py` (13), `dashboard_compat.py` (3), `users_compat.py` (1); see e.g. `visits_dashboard.py:3063,3102,3105,3133`

**Observation:** Many handlers `print(f"DEBUG: ...")` on the hot path. `get_visit_detail` prints four lines per request.

**Why it's a problem:** Noisy logs, hides real errors, leaks DB internals to stdout. Several exception branches `print(...)` *and* re-raise / return `{detail: ...}` swallowing the stack trace.

**Suggested fix:** Replace with `logging.getLogger(__name__).debug(...)` / `.exception(...)`; drop the `print` prefix entirely on hot endpoints.

**Confidence:** high

### 19. `delete_draft_visit` doesn't check role or current_user

**Location:** `backend/app/api/visits_dashboard.py:2697-2728`

**Observation:** `def delete_draft_visit(visit_id: str, db: Session = Depends(get_db))` — no `current_user`, only the router-level `ALL_PLATFORM_ROLES` guard. Any surveyor can delete any draft visit, including ones owned by another surveyor.

**Why it's a problem:** Lack of "you can only delete your own draft" check. Less severe than #1 since only Drafts (status check on line 2710) can be deleted, but still allows cross-user data loss.

**Suggested fix:** Inject `current_user`, then `if visit_row.created_by != current_user.id and not is_admin: raise 403`.

**Confidence:** medium

### 20. `mandatory_total_count` defaults to literal `24` if SELECT shape changes

**Location:** `backend/app/api/visits_dashboard.py:741`

**Observation:** Same line as finding #3 — `"mandatory_total_count": row[15] if len(row) > 15 else 24` hardcodes the old question count.

**Why it's a problem:** The reorder migration added a question (B2B now has 25 mandatory + non-mandatory questions), so `24` was already wrong before today, and the recent reorder makes it more so. The fallback path is dead given the SELECT is static, but the literal is a footgun for the next person editing the query.

**Suggested fix:** Remove the `else 24` arm entirely; return `0` or omit the key on shape mismatch.

**Confidence:** high

### 21. `get_visit_detail` mandatory count never raises if `survey_type_id` join finds zero rows

**Location:** `backend/app/api/visits_dashboard.py:3162-3196`

**Observation:** If a visit's `survey_type_id` is NULL (legacy data), the JOIN `JOIN visits v ON v.survey_type_id = q.survey_type_id` yields zero rows and `mandatory_total_count` becomes 0, so `is_completed` on line 3220 becomes `False` (because `mandatory_total_count > 0` is False).

**Why it's a problem:** Legacy visits with NULL survey_type_id show "incomplete" forever. Cosmetic but confusing.

**Suggested fix:** Fall back to the non-typed query when `mandatory_total_count == 0`, or coalesce the join with `OR (q.survey_type_id IS NULL AND v.survey_type_id IS NULL)`.

**Confidence:** low
