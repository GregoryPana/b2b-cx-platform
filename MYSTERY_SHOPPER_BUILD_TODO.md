# Mystery Shopper Build Todo

Use this checklist as the execution order for implementation.

## Phase 0 - Prep
- [x] Confirm source question wording and category names from `questions mystery shopper.md`
- [ ] Confirm initial location seed list for customer service centres
- [x] Confirm role matrix for Mystery Shopper users (Representative, Reviewer, Manager, Admin)

## Phase 1 - Backend Foundation

### 1.1 Survey Type and Questions
- [x] Add/verify `survey_types` entry: `Mystery Shopper`
- [ ] Create seed script for all 32 Mystery Shopper questions
- [x] Store `input_type`, score bounds, and `choices` for select questions
- [x] Verify question retrieval via `/questions?survey_type=Mystery Shopper`

### 1.2 Program Access Separation
- [ ] Add program scoping for user access and role checks
- [ ] Ensure Mystery Shopper users are not coupled to B2B user assumptions
- [ ] Add API-level guardrails for program-specific data access

### 1.3 Location Master
- [x] Create `mystery_shopper_locations` table
- [x] Add admin CRUD endpoints for locations
- [x] Add active/inactive handling for location lifecycle
- [ ] Add tests for create/update/deactivate/delete flows

### 1.4 Assessment Header
- [x] Create `mystery_shopper_assessments` table linked to `visit_id`
- [x] Add create/update/get APIs for mystery header fields
- [x] Wire location FK and validation
- [ ] Add migration + rollback checks

## Phase 2 - Backend Behavior and Validation

### 2.1 Input Validation
- [ ] Extend response validation for `select_single`, `date`, `time`, `nps`, score bands
- [ ] Validate yes/no values and allowed choices consistently
- [ ] Enforce mandatory question completion before submit

### 2.2 UTC+4 Report Date
- [x] Implement server-side UTC+4 date generation for `report_completed_date`
- [x] Apply on final submit (and update rules if needed)
- [ ] Add tests to verify UTC boundary behavior

### 2.3 List/Detail/Review APIs
- [x] Extend draft/list/detail endpoints with Mystery header fields
- [ ] Ensure review actions work for Mystery survey_type records
- [x] Add filtering support for location/purpose/staff/shopper/date/status

## Phase 3 - Mystery Shopper Survey Frontend

### 3.1 App Setup
- [x] Create `frontend/mystery-shopper` app scaffold
- [x] Add shared UI primitives (`button`, `input`, `select`, `textarea`, `tabs`, etc.)
- [x] Configure API base and LAN-safe host behavior
- [x] Align Mystery Shopper app to dashboard shadcn component usage for all interactive controls

### 3.2 Planned Visits and Drafts
- [x] Build today/upcoming planned visits screen
- [x] Ensure refresh-on-load retrieves drafts correctly
- [x] Ensure no clipping and proper spacing on mobile cards
- [x] Implement draft selection/resume behavior

### 3.3 Header and Questions
- [x] Build Section 1 and Section 8 header forms
- [x] Build dynamic renderer for all question input types
- [x] Add per-question save/update + draft persistence
- [x] Add validation messaging and toast feedback

### 3.4 Submit Flow
- [x] Add final submit action and status updates
- [x] Trigger UTC+4 report date generation through backend
- [ ] Confirm submit/review lifecycle end-to-end

### 3.5 Mobile UX Hardening
- [ ] Implement jump-to-category bottom sheet behavior
- [ ] Ensure close button is aligned and non-overlapping
- [ ] Verify touch targets and spacing across small viewports
- [ ] Verify safe-area and scrolling behavior

## Phase 4 - Dashboard Frontend for Mystery Shopper

### 4.1 Platform Integration
- [x] Add Mystery Shopper metadata in platform selector and guide
- [x] Add Mystery-specific nav/views in dashboard

### 4.2 Results and Detail
- [x] Build Mystery results table with filters
- [ ] Build detail panel for header + section responses
- [ ] Add status chips and action controls for review

### 4.3 Analytics
- [x] Add KPI cards: quality avg, CSAT avg, NPS
- [x] Add waiting time and service completion distributions
- [x] Add location/date trend breakdowns
- [ ] Add CSV export hooks if required

## Phase 5 - QA and Release

### 5.1 Verification
- [ ] Run backend tests
- [x] Build `frontend/mystery-shopper`
- [x] Build `frontend/dashboard`
- [ ] Validate role-based behavior for Mystery users
- [ ] Validate location admin lifecycle from dashboard/admin views
- [x] Add automated smoke script for bootstrap/location/draft/submit checks
- [x] Improve smoke script error output to include backend response body

### 5.2 Responsive Regression
- [ ] Validate 360x800 viewport
- [ ] Validate 390x844 viewport
- [ ] Validate 414x896 viewport
- [ ] Validate tablet layouts and desktop

### 5.3 Finalization
- [x] Update README and setup scripts for new frontend
- [x] Add operator/admin usage notes
- [ ] Commit by phase and push after each stable milestone

## Working Notes
- Keep Mystery Shopper implementation isolated from B2B assumptions.
- Prioritize mobile quality on survey pages.
- Do not rely on client timezone for report completion date.
