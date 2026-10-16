# Analytics Calculation Assurance

**Historical preintegration test/audit record.** Publication and deployment statements below describe the earlier b83afa5 candidate, not current status. The integrated release subsequently passed backend318 (including analytics237), Node5/build and hosted CI; it is deployed to tst01 and app01 at application source1631859f71d8fe56befb7a6b400ea0a212e32285. Current runtime/service/migration/TLS/immutable-artifact evidence and remaining acceptance boundaries are in `docs/deployment/ANALYTICS_RELEASE_20261016.md` and the 16 October deployment handoff. Earlier count301 is historical, not a current failing/skipped suite.

## Status and boundary

CWSCX Platform, local branch `feature/analytics-counts-regression-20261015`, base `b83afa5` with existing local application source preserved. No commit, push, merge, migration or deployment. Original checkout untouched. Gregory approved calculation CI and, after Claude's quota interrupted the follow-up, approved Hermes finishing the remaining small fixes directly.

Evidence: local source, real PostgreSQL 16.2 SQL on disposable fixtures, Node metric tests, dashboard build and report/PDF tests. Production data, deployed revision, migration state and DMZ grants were not inspected. This is a local review candidate, not production-release approval.

## Defects and changes

- Fixed inflated Mystery CSAT observation/text/admin counts caused by `COUNT(CASE ... ELSE 0 END)` and null-score average dilution.
- Mystery report now uses authoritative `mystery_shopper_answers`, propagates selected visit/date/location scope, separates all-status inventory from Approved scored KPIs and reports scoring scales separately.
- Added fail-closed module scope: missing/blank means B2B, supported Mystery aliases/code resolve explicitly, unknown/all return 400 on analytics; legacy endpoints return empty, never unfiltered. Missing module schema metadata fails closed. Mystery never falls back to B2B mirror answers.
- Added question-module consistency across aggregate, location/staff/timing and report summary/scale/detail queries. Rogue other-module questions must not affect values. Mystery does not fabricate a B2B account from NULL business IDs. Admin counters remain explicitly global, not module KPIs.
- Dedicated Mystery traffic-light keys replace percentage thresholds on 0–10 scores. Report NPS precision is two decimals.
- Legacy Mystery NPS/category queries no longer require a business record. Coverage denominator counts distinct businesses; current-year defaults and documented repeat-business counts replace widened/placeholder calculations.
- Needs Changes is represented in status counters; partition reconciliation is tested. NPS excludes and reports invalid observations, and CSAT validates score bounds.
- B2B raw CSAT selects stable Q12, not any satisfaction-text question; legacy duplicate raw scores resolve deterministically. B2B reports reject other-module visit IDs and invalid UUIDs.
- Final parent test found B2B selected KPI/category/yes-no still lacked visit scope. Added `visit_id` propagation to all three consumers and yes/no analytics. Reproduced selected NPS 25 instead of 0 before fixing it.
- Unused `routers/dashboard.py` remains unmounted. Corrected latent counts/text import and added no-mount/source-hazard checks; no route/auth changes.
- Follow-up fixed repeat questionnaire bootstrap using an `EXCLUDED` alias outside an upsert. Parameter binding now makes repeat bootstrap valid; an idempotence/count regression covers it.
- Full-suite fixture preparation now attests and initializes PostgreSQL-native schema before legacy modules run. Auth fixtures retain native boolean/UUID/JSONB/enum types; review/dedup fixtures create owned locations/businesses and clean them up. Added missing approval/priority fixture columns. No application migration or production schema change was run.

## Metric contract and flow slice

- **NPS:** Approved visits, valid scores 0–10; promoters 9–10, passives 7–8, detractors 0–6; percentage promoters minus percentage detractors, two decimals; empty is null. Invalid observations are excluded and counted.
- **B2B CSAT:** valid Q12 answers; percentage scoring >=8. Buckets 0–2, 3–4, 5–7, 8, 9–10.
- **Mystery CSAT:** pooled mean of valid scored staff-interaction/store-environment satisfaction answers, 0–10. Count is scored answers, not visits or all rows. No switch to a percentage was made.
- **Relationship:** latest Approved visit per business, sum scores / sum declared maxima ×100. **Exposure:** accounts reporting competitor use on latest Approved visit / accounts.
- **Mystery Overall Experience:** existing category-based pooled mean, including NPS. **Quality:** declared 1–5 scale, not inferred from observed averages. Scores on different scales remain separate.
- **Coverage:** distinct active businesses with Approved B2B visits / active businesses. Repeat metric counts businesses with >1 Approved visit in the period, not extra visits. Default window follows documented current-year rules; explicit ranges remain available.
- Visit inventory/status counts can include all statuses; score KPIs use Approved visits. Raw per-visit answer detail is not an Approved-only KPI.

Flow: source answers and visits → module resolver → visit/question/status/date/location/business/selected-visit predicates → real SQL aggregates → dashboard payloads and report builders → metric cards, HTML and PDF. Mystery summary/detail/scale SQL independently applies authoritative-table and module rules. B2B selected KPI/question/category/yes-no consumers share selected visit scope. Lifetime comparison remains explicitly separate. Writes, mirroring, auth and approval workflows are untouched.

Traffic lights retain B2B/installation rules. Mystery NPS >=50 green/>=0 amber, CSAT/Overall >=8/>=6. Quality uses derived 4/3 on 1–5: **confirm this business threshold before release**. JSON test contracts assert backend/frontend parity; they are not a shared runtime implementation.

## Executable coverage

`backend/tests/analytics/` covers NPS boundaries/extremes/null/invalid/statuses; CSAT/buckets/denominators; relationship/exposure; visit/text counters; location/staff/timing/purpose; question/yes-no/AE/trends; scope aliases/unknown/missing schema and authoritative/mirror contamination; Mystery report selected/lifetime/visit/scale/details/HTML; B2B report selected/lifetime/date/visit/category/yes-no/Q12/duplicates/rejection; coverage repeat businesses and denominator fanout; installation summary/segments/questions/categories/trends/filters; admin counters; presentation parity; unused-router guard; fixture attestation.

Expected values are independently specified fixtures, not recalculated with application functions. Fixture schema is hand-written DDL plus application Mystery catalogue, not a production migration clone. This is broad regression coverage, not proof of every possible calculation/state/external consumer.

Database safety: runner creates disposable pgserver with no TCP listener. Before DDL, guard verifies runner-exported canonical pgdata, random nonce marker, server `SHOW data_directory` equality and empty `listen_addresses`. Unix socket alone is insufficient. A unique fixture database is created only inside that attested cluster; test transactions roll back and cleanup runs finally. No real/shared DB used.

## Final verification

- **237 analytics tests passed**, zero skips, including the new repeat-bootstrap regression.
- **5 Node metric tests passed**.
- **Dashboard build passed**, 2647 modules; existing chunk-size/Browserslist warnings remain.
- **16 existing report/PDF/export tests passed** after installing matching Chromium.
- **New workflow passed actionlint**, network disabled/read-only mount.
- **Full backend: 301 passed, zero failures/errors/skips.** The previous 6 failures/17 errors/3 skips are resolved by native fixture initialization and owned test data, not by suppressing tests or changing application approval rules.
- **Combined `--scope all` exits zero**: analytics237, full backend301, Node5 and production build all pass. Backend301 includes analytics237; they must not be added together as distinct tests. Final full-suite JUnit confirms 301 tests and zero failures/errors/skips. This is local test/build verification, not live production validation.

Initial 159-test RED run: 94 failed/65 passed against old source; initial GREEN:159 passed. Expanded final analytics suite:237 passed. Final B2B selected-visit test separately failed before scope propagation and passed after. Interrupted-session cleanup corrected a contradictory expected 9.0/9.25 assertion and a source regex matching its own explanatory comment. Previous broader-suite fixture failures are historical, not current release blockers.

## Commands

Use Python3.12, `backend/requirements.txt` plus `backend/requirements-analytics-test.txt`, and dashboard `npm ci`. Install matching Playwright Chromium for PDFs; Linux CI installs browser OS dependencies too.

```bash
python scripts/dev/verify_analytics_calculations.py --scope focused --scratch <scratch>
python scripts/dev/verify_analytics_calculations.py --scope analytics --scratch <scratch> -- -rs --junitxml=<scratch>/analytics.xml
python scripts/dev/verify_analytics_calculations.py --scope frontend
python scripts/dev/verify_analytics_calculations.py --scope build --build-outdir <scratch>/dashboard-build
python scripts/dev/verify_analytics_calculations.py --scope all --scratch <scratch> --build-outdir <scratch>/dashboard-build
```

`focused` = analytics+Node only. `all` = analytics+full backend+Node+build; final combined run passed. Set `PLAYWRIGHT_BROWSERS_PATH` for an isolated browser cache. `full` initializes native fixture schema only on the attested disposable cluster; it does not run migrations.

## Approved CI

New `.github/workflows/analytics-calculation-assurance.yml`: relevant push/PR/manual triggers, contents-read permission, isolated analytics AND full-backend PostgreSQL suites (including report/PDF tests), JUnit zero/skipped-test rejection for both suites, Node tests and dashboard build. CI-only requirements pin pgserver; runtime requirements unchanged. Deployment workflows unchanged.

**Local and linted, not yet pushed or executed on GitHub.** Equivalent checks ran locally. Requires approved integration to activate; required branch-protection checks are a separate GitHub settings action, not performed.

## Remaining gates/decisions

- Confirm derived Quality thresholds; existing pooled CSAT and NPS-inclusive Overall Experience retained pending any separately approved business-rule change.
- Legacy B2B NPS/category keeps active-business-only population; comprehensive analytics retains retired businesses' historical Approved responses. This retained difference can yield different values.
- Free-text staff identities/top-N limits unchanged. B2B inventory summary average retains its pre-existing response-weighted definition; characterization is not business approval of that definition.
- Full backend now passes without skips, including existing auth/review/dedup/PDF checks. Fixture DDL is still not a full production migration-parity proof; deployment migration verification remains separate.
- Review integrated diff, approve integration, commit/push and run remote CI before release. Set required checks separately.
- Production release still needs migration/service/user-visible proofs and reconciliation of the originally reported live figures. No historical data repair or production recalculation attempted.
