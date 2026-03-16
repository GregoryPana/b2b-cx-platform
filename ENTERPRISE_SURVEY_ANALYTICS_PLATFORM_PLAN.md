# Enterprise Survey Creation, Management, and Analytics Platform Plan

## Purpose
Define the future-state plan to evolve this repository from program-specific survey flows into a configurable enterprise platform where Admin/Manager users can:
- Create and publish surveys without developer changes
- Configure sections, questions, input types, and answer options
- Control what appears in analytics and dashboard views
- Safely evolve survey structures while preserving historical data integrity

This document is planning-only and does not imply immediate implementation.

## Current State Snapshot

### What exists now
- Program-specific flows (`B2B`, `Mystery Shopper`, Installation planning docs)
- Survey runtime and dashboard runtime are mostly code-driven per program
- Question data exists in `questions`, responses in `b2b_visit_responses`
- Program-specific masters now exist (e.g., mystery locations, purpose options)
- Analytics endpoints currently include both hardcoded and question-key-based logic

### Current constraints
- Admins can configure only selected masters (not full survey schema)
- Question lifecycle (add/remove/edit) still requires backend/frontend updates
- Analytics assumptions can still be tightly coupled to fixed question sets
- Version compatibility behavior is not yet formalized platform-wide

## Target State (End Goal)

### Platform outcomes
- A no-code/low-code Survey Builder for Admin/Manager users
- Versioned surveys with immutable published releases
- Dynamic survey renderer driven entirely by metadata
- Analytics builder for KPI/charts tied to question keys/tags/formulas
- Governance controls (approval workflow, audit trail, impact checks)

### Product capabilities
1. **Survey Builder**
   - Sections, ordering, question creation, edit, archive
   - Input types and validation rules
   - Required/optional settings
   - Option lists and reference dictionaries
   - Conditional logic (show/hide, dependencies)
2. **Publishing**
   - Draft -> review -> publish -> archive lifecycle
   - Validation/quality gates before publish
   - Version compare and rollback
3. **Runtime Collection**
   - One dynamic frontend renderer for all survey types
   - Mobile-first UX with category navigation and progress tracking
4. **Analytics Builder**
   - KPI definitions based on question keys/tags
   - Aggregations, formulas, and dimensions
   - Version-aware compatibility and coverage indicators
5. **Governance and Security**
   - Role-based access and program scoping
   - Full audit logging of schema/metric changes

## Proposed Architecture

### A) Metadata-first survey model
- `programs`
- `surveys`
- `survey_versions`
- `survey_sections`
- `survey_questions`
- `question_option_sets` + `question_options`
- `question_validations` (min/max/regex/rules)
- `question_logic_rules` (conditional visibility)

### B) Response model
- Keep immutable reference to `survey_version_id` in every visit/response
- Store answers in a typed-flexible structure:
  - canonical JSON answer payload
  - optional typed projections for fast analytics
- Maintain `question_key` as stable analytics identity

### C) Analytics model
- `metrics` (definition records)
- `metric_versions`
- `metric_components` (question references, formula terms)
- `dashboard_widgets` (chart/table config)
- `dimension_mappings` (location/program/date/status/etc.)

### D) Governance model
- `change_requests` (draft edits)
- `approvals`
- `audit_events`
- `publish_reports` (breaking change checks, compatibility summary)

## Data Compatibility and Historical Integrity Strategy

### Versioning rules
- Published versions are immutable.
- Any schema-impacting edit creates a new version.
- Runtime forms always resolve to one explicit active version.

### Handling schema evolution
1. **Added question**
   - Historical responses = null (not error)
   - Analytics must show coverage % and denominator
2. **Archived/removed question**
   - Hidden from new forms
   - Historical analytics remains queryable
3. **Label change only**
   - Keep same `question_key`; no compatibility impact
4. **Input-type or scale change**
   - New question/version required
   - Old/new values not merged unless an explicit mapping is defined

### Analytics compatibility statuses
- `compatible`: metric can compute consistently across selected versions
- `partial`: computes with missing-version gaps (must show coverage)
- `incompatible`: blocked unless user narrows version/date scope

## Migration Plan from Existing Repository

### Phase 0: Discovery and Contract Freeze
- Inventory current tables, endpoints, and analytics assumptions
- Freeze current `question_key` naming and program IDs
- Document all hardcoded metric dependencies in backend/frontend

### Phase 1: Foundational Schema Extension
- Introduce survey metadata tables alongside existing schema
- Add `survey_version_id` to visit/response pathways
- Backfill existing B2B/Mystery records into baseline versions

### Phase 2: Config Admin APIs (No UI yet)
- CRUD for surveys/versions/sections/questions/options
- Publish endpoint with validation gates
- Metric definition CRUD + compatibility checks

### Phase 3: Dynamic Runtime Renderer
- Replace program-specific rendering logic with metadata-driven renderer
- Keep legacy routes as compatibility fallback during transition

### Phase 4: Analytics Builder and Dynamic Dashboard
- Move hardcoded KPI logic into metric definitions
- Add dashboard widget management per program/version
- Expose coverage and compatibility status in UI

### Phase 5: Governance and Workflow
- Add approval workflow for publish actions
- Add audit trail and change diff views
- Add rollback/version switch controls

### Phase 6: Decommission Legacy Hardcoding
- Remove old hardcoded question/metric logic after parity checks
- Keep migration snapshots and verification reports

## Required Guardrails Before Go-Live
- Publish validation checks:
  - duplicate keys
  - orphaned dependencies
  - incompatible metric references
  - mandatory question sanity
- Runtime safety:
  - if config invalid, block publish (never break runtime)
- Performance:
  - index strategy for version/date/program filters
  - caching for active survey definitions and metric specs

## Role and Permission Model (Proposed)
- **Admin**: full schema/metrics/publish control
- **Manager**: draft config edits, submit for approval
- **Analyst**: metrics/widgets only
- **Reviewer/Representative**: data entry/review only, no schema edits

## Enterprise UX Principles
- Builder screens should be form-driven and explicit, not hidden in nested menus
- Every destructive/compatibility-impacting action includes warnings and impact preview
- Mobile runtime remains simple and fast; complexity lives in admin tools, not survey-taking UI

## Risks and Mitigations
- **Risk:** metric drift from schema changes
  - **Mitigation:** metric compatibility engine + publish checks
- **Risk:** data ambiguity across versions
  - **Mitigation:** strict version linkage on all responses
- **Risk:** admin misconfiguration
  - **Mitigation:** staged publishing, approval workflow, rollback

## Success Criteria
- New survey creation requires no code changes
- New analytics KPIs/charts can be added by Admin/Analyst via config
- Historical analytics remains trustworthy with explicit compatibility indicators
- Program teams independently evolve surveys without developer dependency

## Future Deliverables to Prepare When Build Starts
- Detailed ERD and migration scripts
- API contract spec (OpenAPI additions)
- Builder UX wireframes and workflow map
- Compatibility test suite and backfill playbooks
