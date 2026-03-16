# Enterprise Platform Migration Checklist (Future Use)

## Planning and Design
- [ ] Approve target architecture in `ENTERPRISE_SURVEY_ANALYTICS_PLATFORM_PLAN.md`
- [ ] Finalize permission matrix (Admin/Manager/Analyst/Reviewer/Representative)
- [ ] Finalize compatibility policy for cross-version analytics

## Discovery and Inventory
- [ ] Inventory all current survey programs and endpoints
- [ ] Inventory hardcoded question references in backend analytics
- [ ] Inventory hardcoded frontend assumptions in survey/dashboard apps
- [ ] Export baseline data quality report for current responses

## Schema Foundation
- [ ] Add metadata tables for surveys, versions, sections, questions, options
- [ ] Add analytics definition tables (metrics, widgets, formulas)
- [ ] Add governance tables (approvals, audit events, publish reports)
- [ ] Add `survey_version_id` linkage to runtime records

## Backfill and Baseline Migration
- [ ] Convert current B2B survey into baseline published version
- [ ] Convert current Mystery Shopper survey into baseline published version
- [ ] Import existing option masters (locations, purposes) into reusable config dictionaries
- [ ] Backfill historical responses to correct `survey_version_id`

## API Layer
- [ ] Create survey builder CRUD APIs
- [ ] Create publish/rollback APIs with validation reports
- [ ] Create metrics builder CRUD APIs
- [ ] Add compatibility-report endpoint for analytics ranges

## Frontend Migration
- [ ] Build admin Survey Builder UI in dashboard
- [ ] Build admin Analytics Builder UI in dashboard
- [ ] Build dynamic survey renderer for all programs
- [ ] Keep legacy renderer fallback during transition

## Analytics Migration
- [ ] Migrate existing hardcoded KPIs to metric definitions
- [ ] Migrate existing charts to widget config records
- [ ] Add compatibility/coverage badges to analytics UI

## Quality and Governance
- [ ] Add publish gates and approval workflow
- [ ] Add audit trail UI for schema and metric changes
- [ ] Add regression suite for versioned analytics correctness
- [ ] Add performance tests for high-volume historical analytics

## Rollout
- [ ] Pilot with one program in shadow mode
- [ ] Validate parity between legacy and dynamic analytics
- [ ] Gradually switch programs to dynamic mode
- [ ] Decommission legacy hardcoded logic after sign-off
