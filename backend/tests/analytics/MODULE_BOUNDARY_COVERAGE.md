# Backend module-boundary coverage inventory

Scope: B2B dashboard/survey and Mystery Shopper workspace/review/report consumers on the shared `visits`, `questions`, `b2b_visit_responses` and authoritative `mystery_shopper_answers` tables. Installation is an adversarial third module, not a redesigned module. No production data, database migrations, authentication, signing, or deployment changes.

## Contract

- Visits must have explicit ownership in the requested module. A valid foreign visit ID receives 404 on visit operations and 400 on selected report operations.
- Questions must match the module; only B2B retains the existing legacy NULL-question-ownership policy. NULL visit ownership is never accepted.
- Response updates bind the existing response ID, visit ID **and question ID**. A valid own-module question cannot be used to retarget a corrupt foreign-question response.
- B2B dashboard/report surfaces reject Mystery, Installation, unknown names and mismatched numeric survey-type IDs rather than widening their queries.
- Mystery metrics/reports/details use authoritative Mystery answers; dual writes into the shared B2B table remain intact.
- Survey questions fail closed when module metadata cannot be established, rather than returning B2B mock questions.

## Coverage by surface

| Surface | Boundary implementation | Executable coverage |
|---|---|---|
| `/analytics/*`, `/dashboard/*` compatibility metrics | Existing central `resolve_module_scope` visit/question predicates | Existing `test_module_scoping.py`, comprehensive/question/yes-no/scale tests; isolated PostgreSQL suite |
| `/dashboard-visits/all`, `/drafts`, `/pending`, `/actions` | Dedicated B2B scope; count only module-consistent questions | Mixed-module/Installation injection and both Draft/Pending queue tests |
| `/dashboard-visits/{id}` | Require B2B visit, filter response questions | Foreign visit denial; valid HTTP detail unaffected by foreign-answer injection |
| B2B create visit/answer; update draft/answer; submit/delete | Scope requested survey type/ID, require visit/question; bind existing answer ownership | Foreign visit/question/response HTTP writes; draft/delete denial; retarget regression; successful own answer update/readback |
| B2B approve/reject/needs-changes | Require B2B visit before mutation | All review transitions, full target-row readback after rejection |
| `/dashboard-visits/actions/status` | Join response to B2B visit and B2B/legacy question | Mystery mirror mutation denied with unchanged action JSON |
| `/dashboard-visits/reports/surveys` | Pin selected business's visits to B2B | Cross-associated Mystery visit cannot enter eligible/ineligible lists |
| B2B report payload, HTML export/download, PDF, email | Existing scoped builder, selected visit ownership check, scoped question aggregates | Selected foreign visit rejected by builder and HTTP HTML/PDF/email; real selected HTML download excludes foreign text; payload unchanged after injection |
| `/mystery-shopper/admin/visits`, `/visits/drafts` | Mystery visit ownership plus question ownership in response/mandatory counts | Mixed-module/Installation injection and both queue statuses |
| Mystery detail/header/create/update answer/submit | Existing visit-access ownership check, explicit question ownership, bind answer/visit/question | Foreign detail/header/visit/question/response denials; details unaffected by injection; valid answer update keeps authoritative/shared mirror synchronized |
| Mystery approve/reject/needs-changes | Require Mystery visit before mutation | Every transition, full rejected-target row readback |
| Mystery report selection/payload/HTML/PDF/email | Explicit visit ownership, authoritative scoped question joins | Cross-associated B2B visit excluded from report selector; foreign visit HTML/PDF/email denial; actual scoped HTML download and stable payload after injection |
| `/questions` (internal) and public Mystery question wrapper | Require known configured module metadata before query; no mock fallback | Real B2B/Mystery catalogues are nonempty/disjoint, unknown module rejected; existing public router/auth tests |
| `/visits/drafts`, `/visits/{id}`, `/survey-responses/{id}`, `/survey-actions/{id}`, `/historical-surveys` in `api/survey.py` | B2B scope, UUID-compatible ID/serialization; configured PostgreSQL response store replaces unrelated local SQLite/mock response lookup | Positive HTTP controls plus foreign IDs, mixed-question injection, history/draft membership, nonempty real responses/actions |
| Legacy survey update stub | Require B2B visit; preserve HTTP scope exceptions | Foreign ID rejected; existing same-module no-op semantics were not represented as persistence |
| `/b2b/public/businesses?with_approved_surveys=true` | Approved-visit EXISTS additionally requires B2B ownership | Mystery-only business association does not enter B2B analytics selector |
| `/b2b/visits` compatibility create/list/detail/update/delete and business visit lists | Fixed B2B visit predicate on reads and writes; UUID shared-store SQL replaces incompatible integer ORM mapping; create pins B2B and authenticated local actor | Real positive CRUD/readback and deletion with answer children; Mystery, Installation and NULL-owned foreign IDs rejected with full target/child snapshots |
| `/b2b/businesses/{id}/deletion-summary` and delete | Preview lists/counts only B2B visits; foreign/NULL visits, Mystery locations, or attached Mystery assessments block the whole cascade with 409; business row locked; deletion SQL independently pins B2B | Own-only business cascade succeeds; mixed businesses remain unchanged, including foreign answer rows; Mystery reference guard even when visits.business_id is NULL |
| Legacy `responses` / `response_actions` children | Shared cleanup binds every child delete to the caller's scoped visit subquery; works without ON DELETE CASCADE | Native PostgreSQL no-cascade FKs, successful cleanup via B2B visit/business and both admin module paths; unrelated foreign actions survive exactly |
| `/admin-dashboard/visits`, detail, search, responses, JSON/CSV export | Explicit optional survey_type; scoped visit/question predicates; scoped Mystery uses authoritative answers; no filter preserves labelled global operations | Nonempty positive reads/exports in both directions, injected foreign questions, exact filtered counts/pagination, divergent Mystery mirror cannot change scoped detail, CSV IDs/count match JSON |
| `/admin-dashboard` single response/visit deletion and purge | Scoped module-admin or unfiltered super-admin policy below; mutations bind selected IDs to module; Mystery response deletion keeps mirror synchronized; explicit metadata cleanup because assessment visit FK is absent | Foreign IDs rejected/read back; own deletes and dry-run/actual purges pass for both modules; global super-admin positives; mixed-role and program_code escalation attempts denied |

Tests live in `test_endpoint_module_boundaries.py`, `test_legacy_management_boundaries.py` plus the existing analytics/report/auth suites. The latter mirrors main.py's B2B and dashboard mount guards in addition to retaining handler guards; only DB and authenticated identity are overridden. The new endpoint fixture overrides **identity and DB only**; individual endpoint role dependencies remain installed. It does not recreate main-app router-level auth configuration, which is covered separately. Handler commits/rollbacks run inside savepoints under a rolled-back outer transaction, with seeded data released before rejection/readback assertions.

## Administrator scope and compatibility policy

This policy distinguishes **global operational administration** from module dashboards. No frontend should label unfiltered admin management exports or operational counters as B2B/Mystery-exclusive KPIs.

| Operation | `survey_type` omitted | Explicit `B2B` or `Mystery Shopper` |
|---|---|---|
| Overview / analytics | Existing `DASHBOARD_ROLES` (`CX_SUPER_ADMIN`, `B2B_ADMIN`, `MYSTERY_ADMIN`, `INSTALL_ADMIN`), intentionally global | These two routes remain global and label it; use module analytics endpoints instead |
| Visits / details / search / responses / export | Same existing dashboard-admin global visibility, labelled `scope.module=all`, `global=true`; shared-response operational export reads the shared store including Mystery mirrors | Selected module's administrator or `CX_SUPER_ADMIN`; visit and question scope applied; authoritative Mystery answers used |
| Delete visit / response / purge (including dry-run) | **`CX_SUPER_ADMIN` only**; explicit global operational authority | Selected module's administrator or `CX_SUPER_ADMIN`; a foreign ID is 404 and cannot widen selection |

- Global read visibility for module administrators is preserved from main.py's existing mount guard, not newly claimed as module-exclusive. This is a deliberate broader privilege than their scoped module workspaces.
- Global **destructive** access is tightened: the old default `require_role("Admin")` meant B2B admin and could be changed with `program_code`; it is no longer interpreted as global authority. `program_code` cannot change the new fixed resource guards. B2B compatibility management guards likewise name B2B roles explicitly, including the mixed `B2B_SURVEYOR` + `MYSTERY_ADMIN` adversarial case.
- An explicit blank, unknown, `all`, or unsupported Installation `survey_type` returns 400, never falls back to global. Omission is the documented global mode. Global overview/analytics do not offer a module-filter parameter.
- Response IDs retain their actual types: UUID shared-store mirror IDs and BIGSERIAL authoritative Mystery IDs serialize as strings; scoped mutations compare IDs only inside the selected response store plus visit/question predicates. No cross-store ID coercion is used.
- Mystery answer deletion removes its mirror; a super-admin global deletion addressed through the shared Mystery mirror also removes the corresponding authoritative answer. Visit deletion explicitly cleans assessment metadata because the existing bootstrap deliberately removes its visit FK. Legacy response/action FKs are cleaned before the parent when they do not cascade.
- Compatibility changes: `/b2b/visits` IDs now follow the deployed UUID store rather than the obsolete inherited integer model; creation defaults are `Draft` / `Planned`, actor and module are server-assigned. Business deletion summaries replace the foreign assessment count with `deletion_blocked`, while visit counts/details are B2B-only. A blocked delete returns 409; retirement remains a separate explicit action.
- This patch does not introduce schema migrations, data rewrites/backfills, login bypasses, signing changes, deployment, or commits. Additional reference columns/no-cascade tables exist only in the attested disposable test transactions.

## Explicit limits / wider audit findings

- `/admin-dashboard/analytics` is intentionally GLOBAL operational telemetry and explicitly labels `module=all`; the existing global-counter test remains unchanged. It must not be displayed as B2B/Mystery KPI data.
- Legacy `/admin-dashboard` management/search/export/delete/purge and `/b2b/visits` CRUD/business-cascade gaps are now covered above. Broken legacy export/search SQL, positional serialization and UUID-vs-integer visit mapping were repaired as prerequisites for real positive endpoint tests. Global administrator semantics remain an explicit exception, not an isolation claim.
- Business master records are shared reference data, not module-owned visits. Business create/update/retire retain their existing reference-management semantics. Deletion is deliberately refused rather than deleting another module's visits, detaching its historical references, or silently converting a requested hard delete into partial deletion.
- Old `app/routers/visits.py`, `responses.py`, `questions.py` are not mounted by current `app/main.py`; this patch does not redefine them. The debug/test API is also outside module analytics/workspace consumers.
- Boundary PDF rejection is exercised before Chromium rendering. Existing full-suite tests generate real PDF bytes for all report renderers; the new mixed-fixture positive path renders actual HTML, not mixed-fixture PDF text extraction.
- SMTP is prevented from being called for foreign reports; no actual email is sent. Auth/DMZ lifecycle regression tests run unchanged, but there is no live Entra/DMZ or deployed-business-data verification.
- Existing runtime schema-bootstrap helpers are unchanged. Fixture-only DDL adds missing reference columns in the attested disposable database; no shared database is used.

## Verified results

Final disposable PostgreSQL runs after legacy management/cascade closure:

- Analytics: **311 passed**, 24 deprecation warnings, 19.31 seconds; exit 0.
- Full backend `pytest tests`: **392 passed**, 37 deprecation warnings, 30.34 seconds; exit 0. No failures or skips reported; includes existing real PDF renderer checks.
- Legacy-management adversarial addition: **32 tests** beyond the preceding 279/360 baseline. Intermediate failures exposed the actual BIGSERIAL Mystery-answer vs UUID mirror IDs and the intentionally absent assessment visit FK; the final tests cover both shapes and explicit metadata cleanup.
- `git -c core.whitespace=cr-at-eol diff --check -- backend`: exit 0.
- Logs: `/home/gpanagary/.hermes/cache/scratch/legacy-boundaries-analytics.log` and `legacy-boundaries-full.log` in the same directory.

These are local fixture results for the inventoried mounted surfaces, not a blanket certification of every backend/debug route and not a deployment/business-data verification.

## Verification commands

Run from the isolated worktree, with interpreter contamination removed:

```bash
env -u PYTHONPATH -u VIRTUAL_ENV /home/gpanagary/.hermes/cache/scratch/cx-analytics-venv/bin/python scripts/dev/verify_analytics_calculations.py --scope analytics
env -u PYTHONPATH -u VIRTUAL_ENV /home/gpanagary/.hermes/cache/scratch/cx-analytics-venv/bin/python scripts/dev/verify_analytics_calculations.py --scope full
git -c core.whitespace=cr-at-eol diff --check -- backend
```

Both runners attest their own disposable PostgreSQL cluster: canonical data directory, nonce and Unix socket only, empty `listen_addresses`. Full suite prepares PostgreSQL-native fixtures and a separate migration-test database. CRLF in `api/survey.py` is intentionally preserved; `cr-at-eol` checks whitespace without normalizing the file.
