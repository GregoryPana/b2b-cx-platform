# Hermes Update Pack: CWSCX Analytics Calculation Assurance

## 1. Project
- Project: CWSCX Platform.
- Local candidate: `/home/gpanagary/cwscx-analytics-20261015`.
- Repository: `GregoryPana/b2b-cx-platform`.
- Branch: `feature/analytics-counts-regression-20261015`.
- HEAD: `b83afa53422910b6b97de61e0d4b51dd1cbacb3c` (base, not a fix commit).
- PR: none. Local changes uncommitted/unpushed.
- Original checkout preserved. Candidate inherits existing dirty source/docs; do not stage the entire tree. The list below identifies this task's delta, not all Git status entries.

## 2. Task summary
Audited reported Mystery Shopper NPS/CSAT count/calculation/display defects, report scope and isolation from B2B/other data. Fixed confirmed local defects and added broad executable calculation checks and approved CI. Follow-up resolved existing integration fixture failures and a real questionnaire re-bootstrap SQL bug. No production access or data repair.

Still not completed: source integration/remote CI, owner approval of derived Quality thresholds, production migration and user-visible release verification. Test results do not establish live reported figures.

## 3. Files changed
- `.github/workflows/analytics-calculation-assurance.yml`: Approved analytics/full-backend/Node/build gate with no-skips checks. Risk: medium. Suggested knowledge update: yes.
- `.opencode/hermes-pending-updates.md`: Current findings, verification and handoff status. Risk: low. Suggested knowledge update: yes.
- `backend/app/api/admin_dashboard.py`: Analytics/report module, count, selected-scope or bootstrap correction. Risk: medium. Suggested knowledge update: yes.
- `backend/app/api/dashboard_compat.py`: Analytics/report module, count, selected-scope or bootstrap correction. Risk: medium. Suggested knowledge update: yes.
- `backend/app/api/mystery_shopper.py`: Analytics/report module, count, selected-scope or bootstrap correction. Risk: medium. Suggested knowledge update: yes.
- `backend/app/api/visits_dashboard.py`: Analytics/report module, count, selected-scope or bootstrap correction. Risk: medium. Suggested knowledge update: yes.
- `backend/app/core/analytics_scope.py`: Analytics/report module, count, selected-scope or bootstrap correction. Risk: medium. Suggested knowledge update: yes.
- `backend/app/routers/analytics.py`: Analytics/report module, count, selected-scope or bootstrap correction. Risk: medium. Suggested knowledge update: yes.
- `backend/app/routers/dashboard.py`: Analytics/report module, count, selected-scope or bootstrap correction. Risk: medium. Suggested knowledge update: yes.
- `backend/requirements-analytics-test.txt`: CI-only disposable PostgreSQL dependency. Risk: low. Suggested knowledge update: yes.
- `backend/tests/analytics/conftest.py`: Regression fixture, value/scope/contract or safety coverage. Risk: low. Suggested knowledge update: yes.
- `backend/tests/analytics/fixture_guard.py`: Regression fixture, value/scope/contract or safety coverage. Risk: low. Suggested knowledge update: yes.
- `backend/tests/analytics/helpers.py`: Regression fixture, value/scope/contract or safety coverage. Risk: low. Suggested knowledge update: yes.
- `backend/tests/analytics/metric_threshold_contract.json`: Regression fixture, value/scope/contract or safety coverage. Risk: low. Suggested knowledge update: yes.
- `backend/tests/analytics/pg_schema.py`: Regression fixture, value/scope/contract or safety coverage. Risk: low. Suggested knowledge update: yes.
- `backend/tests/analytics/scenarios.py`: Regression fixture, value/scope/contract or safety coverage. Risk: low. Suggested knowledge update: yes.
- `backend/tests/analytics/test_b2b_report.py`: Regression fixture, value/scope/contract or safety coverage. Risk: low. Suggested knowledge update: yes.
- `backend/tests/analytics/test_coverage_and_compat.py`: Regression fixture, value/scope/contract or safety coverage. Risk: low. Suggested knowledge update: yes.
- `backend/tests/analytics/test_dashboard_compat_and_admin.py`: Regression fixture, value/scope/contract or safety coverage. Risk: low. Suggested knowledge update: yes.
- `backend/tests/analytics/test_fixture_guard.py`: Regression fixture, value/scope/contract or safety coverage. Risk: low. Suggested knowledge update: yes.
- `backend/tests/analytics/test_installation_aggregates.py`: Regression fixture, value/scope/contract or safety coverage. Risk: low. Suggested knowledge update: yes.
- `backend/tests/analytics/test_invalid_scores.py`: Regression fixture, value/scope/contract or safety coverage. Risk: low. Suggested knowledge update: yes.
- `backend/tests/analytics/test_metric_presentation.py`: Regression fixture, value/scope/contract or safety coverage. Risk: low. Suggested knowledge update: yes.
- `backend/tests/analytics/test_metric_values.py`: Regression fixture, value/scope/contract or safety coverage. Risk: low. Suggested knowledge update: yes.
- `backend/tests/analytics/test_module_scoping.py`: Regression fixture, value/scope/contract or safety coverage. Risk: low. Suggested knowledge update: yes.
- `backend/tests/analytics/test_mystery_bootstrap.py`: Regression fixture, value/scope/contract or safety coverage. Risk: low. Suggested knowledge update: yes.
- `backend/tests/analytics/test_mystery_report.py`: Regression fixture, value/scope/contract or safety coverage. Risk: low. Suggested knowledge update: yes.
- `backend/tests/analytics/test_question_module_predicates.py`: Regression fixture, value/scope/contract or safety coverage. Risk: low. Suggested knowledge update: yes.
- `backend/tests/analytics/test_unmounted_dashboard_router.py`: Regression fixture, value/scope/contract or safety coverage. Risk: low. Suggested knowledge update: yes.
- `backend/tests/analytics/test_yes_no_and_trends.py`: Regression fixture, value/scope/contract or safety coverage. Risk: low. Suggested knowledge update: yes.
- `backend/tests/test_mystery_public_auth_lifecycle.py`: Regression fixture, value/scope/contract or safety coverage. Risk: low. Suggested knowledge update: yes.
- `backend/tests/test_mystery_review.py`: Regression fixture, value/scope/contract or safety coverage. Risk: low. Suggested knowledge update: yes.
- `backend/tests/test_response_dedup.py`: Regression fixture, value/scope/contract or safety coverage. Risk: low. Suggested knowledge update: yes.
- `docs/testing/ANALYTICS_CALCULATION_ASSURANCE.md`: Current findings, verification and handoff status. Risk: low. Suggested knowledge update: yes.
- `frontend/dashboard-blueprint/src/features/mystery-shopper/components/MysteryAnalyticsSummarySection.jsx`: Mystery scale-aware score presentation and contract. Risk: medium. Suggested knowledge update: yes.
- `frontend/dashboard-blueprint/src/lib/utils.js`: Mystery scale-aware score presentation and contract. Risk: medium. Suggested knowledge update: yes.
- `frontend/dashboard-blueprint/src/lib/utils.test.mjs`: Regression fixture, value/scope/contract or safety coverage. Risk: low. Suggested knowledge update: yes.
- `frontend/dashboard-blueprint/src/pages/DashboardPage.jsx`: Mystery scale-aware score presentation and contract. Risk: medium. Suggested knowledge update: yes.
- `scripts/dev/verify_analytics_calculations.py`: Attested disposable database and repeatable complete verification. Risk: medium. Suggested knowledge update: yes.

## 4. Tests / verification
Final combined `verify_analytics_calculations.py --scope all` exited0:
- Analytics237 passed.
- Full backend301 passed, including analytics237; zero failures/errors/skips. Do not add those nested suite totals.
- Node metric tests5 passed.
- Dashboard production build passed,2647 modules.
- Existing PDF/report checks run within the full suite; earlier independent subset16 passed.
- Workflow actionlint passed with network disabled/read-only mount.
- Full-suite JUnit verifies301 tests with zero skipped/failed/errors.
- Initial defect suite RED94 failed/65 passed; after initial fixes159 passed. Expanded scope and fixture cleanup now produce the results above.

Final runtime evidence is in local scratch logs/JUnit; source assurance doc records commands and limitations. Final fixture work removed prior6 failures/17 errors/3 skips through native schema preparation and owned test data, not skipped tests. Frontend build warns about existing bundle size/stale Browserslist. No live browser walkthrough against production, remote CI or migration-parity test performed.

## 5. Deployment impact
- Deployment performed: no.
- Deployment needed: yes, only after approved integration/release gates.
- Staging/production/self-hosted runners: unchanged.
- CI: new approved workflow for analytics/full-backend/Node/build, JUnit no-zero/no-skips gates. Not yet active remotely; branch-protection required-check settings not changed.
- Rollback: retain previous application release; no persistent production schema/data mutation from this work.

## 6. Auth / security / data impact
Auth/session/role rules and dual-write unchanged. Lifecycle/review test fixtures improved, no production auth change. No migrations executed. All test DDL confined to attested disposable PostgreSQL clusters: canonical pgdata+nonce marker+server path equality+no TCP listener before DDL, unique fixture database and cleanup. Module/question filtering now fails closed and authoritative Mystery data never falls back to B2B mirrors. No secret values included or changed.

## 7. Documentation impact
README/EXIT/deployment docs: not needed. Existing historical HERMES_UPDATE_PACK.md preserved. Current assurance doc and this named pack provide API/metric/risk/test context; pending log updated. Vault/knowledge graph not updated in this pass.

## 8. Confirmed decisions
- 2026-10-15: Gregory approved automatic calculation CI; no deployment authorised.
- 2026-10-15: Gregory approved direct Hermes completion after Claude quota; no fresh Claude sessions started at quota100%.
- Existing Mystery pooled mean0–10 and B2B CSAT>=8 percentage retained; no top-box redefinition.
- Missing module parameter means B2B; unknown/all does not widen dataset. Current repository callers use explicit supported modules.

## 9. Risks and open questions
- Derived Mystery Quality colour thresholds4/3 on1–5 require confirmation before release.
- Legacy B2B active-business-only population differs from comprehensive historical analytics; retained, documented.
- Free-text staff identities/top-N truncation and legacy B2B summary-average definition retained.
- Fixture DDL is not complete production migration-parity evidence, despite all current tests passing.
- Need approved commit/PR route, hosted CI, required-check settings and production service/migration/user-visible proofs; live data reconciliation not performed.

## 10. Skills / process lessons
Updated software-quality-workflows: dialect-real analytics fixtures; independent expected denominators/consumer scope; nullable COUNT cases; attestation before fixture DDL; no-skips CI and honest local/remote state. Additional lesson: prepare the same native fixture schema before mixed integration modules; do not let SQLite-compatible fallback DDL replace PostgreSQL booleans/enums/UUIDs. Seed owned business/location parents rather than rely on live/reference data. Re-bootstrap must be idempotent and covered by tests.

## 11. Suggested knowledge graph updates
Project overview: local analytics review candidate, not deployed.
Architecture: authoritative Mystery answer source; explicit visit/question/module/population/scale contract.
CI/CD: approved analytics/full-backend workflow, locally validated, not remotely executed.
Risk/decision log: retain threshold/population/summary decisions above.
Handover: selective integration only; inherited dirty files must not be bulk-staged.
Import/work log: link this pack and ANALYTICS_CALCULATION_ASSURANCE.md; do not claim vault ingestion occurred.

> Send this Hermes Update Pack to Hermes so the project knowledge graph can be updated.
