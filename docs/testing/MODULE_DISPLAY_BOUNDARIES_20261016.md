# Module display and data-boundary correction

## Approved scope
Fix misleading metric presentation and improve plain-language titles/help across B2B, Mystery Shopper and Installation pages. Verify bidirectional segregation of analytics, survey lists/details, review queues and reports; no B2B reads/writes through Mystery context or vice versa. Do not redesign schema, backfill data, change authentication/deployment controls or touch the parallel web01 release. Work locally in this isolated worktree; deployment is a separate gate.

## Implementation tasks
1. Dashboard frontend: fix B2B CSAT chart appearing in Mystery; explicit mean/10 versus percentage contract. Distinguish visits, answers and ratings; valid zero versus absent data; metadata-based score scales/quality grouping; prevent stale cross-module view data. Contextual page headings and accessible concise help across routes. Own DashboardPage, App, layout, Mystery components, shared dashboard helper/tests.
2. Backend: audit and enforce bidirectional module/question/visit boundaries in analytics, list/detail views, review queues/actions, reports and exports. Explicit unknown-module failure; no auth bypass/schema change. Add adversarial mixed-module regression tests using owned disposable fixtures. Record coverage and actual tests.
3. Installation/frontend legacy: audit Installation titles/scale/count/empty-state/help and survey-facing/report wording, fix legacy dashboard mixed CSAT context. No overlap with task1 files. Maintain actual semantics and accessible help.
4. Parent integration: independent spec review, then quality/security review; address defects. Exercise PostgreSQL analytics/full backend suite, frontend tests/build, browser-rendered fixtures if live browser unavailable. Confirm route inventory and survey/report coverage; explicitly record remaining gaps. No claim of runtime/business verification from local fixtures.

## Acceptance examples
One approved Mystery visit with satisfaction9/8 and recommendation8: satisfaction8.50/10 from2 ratings and1 visit; NPS0 from1 passive answer. No B2B percentage card in Mystery. Inject B2B records without changing Mystery values/list/queue/report, and vice versa. Selected visit IDs from another module must not leak. Empty scopes show no answers, not measured zero. Scales come from declared question metadata.

## Results
Pending execution and independent review.
