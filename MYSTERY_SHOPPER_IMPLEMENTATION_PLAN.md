# Mystery Shopper Platform Implementation Plan

## Goal
Implement the Mystery Shopper platform as a first-class program with:
- Dedicated survey frontend (`frontend/mystery-shopper`)
- Dashboard support in existing governance dashboard (`frontend/dashboard`)
- Isolated users/access from B2B
- Dedicated customer service centre location master managed by Admin
- Full question framework from `questions mystery shopper.md`

## Confirmed Product Decisions
- Date completed report is auto-generated from current date using UTC+4 timezone.
- Users/access are separate from B2B (separate program scope and role assignment).
- Customer Service Centre is a managed location list that Admin can add/remove.

## Scope
- Survey type: `Mystery Shopper`
- Total fields: 32 (as defined in source question framework)
- End-to-end lifecycle: draft -> in progress -> submit for review -> reviewer action
- Dashboard coverage: list, detail, review, and analytics for Mystery Shopper only

## Architecture
- Reuse shared visit/response patterns where possible.
- Keep Mystery Shopper data partitioned by `survey_type_id` and program-specific tables.
- Introduce Mystery-specific header table and location master table.

## Data Model

### 1) Program Identity and Access
- Add explicit program identity for users and role checks.
- Do not reuse B2B user pool in UI selectors or permission assumptions.
- Add program-scoped role enforcement for representative/reviewer/manager/admin.

### 2) Location Master
- New table: `mystery_shopper_locations`
  - `id` (PK)
  - `name` (unique, required)
  - `active` (bool, default true)
  - `created_at`, `updated_at`
  - `created_by`, `updated_by` (optional audit)
- Admin CRUD endpoints for location management.

### 3) Assessment Header Table
- New table: `mystery_shopper_assessments`
  - `id` (PK)
  - `visit_id` (FK to `visits.id`, unique)
  - `location_id` (FK to `mystery_shopper_locations.id`, required)
  - `visit_time` (time, required)
  - `purpose_of_visit` (enum/string, required)
  - `staff_on_duty` (text, required)
  - `shopper_name` (text, required)
  - `report_completed_date` (date, auto set in UTC+4)
  - `created_at`, `updated_at`

## Question Model and Input Types

### Supported Inputs Required for Mystery Shopper
- `score` (range constrained: 1-5 or 0-10)
- `yes_no` (Y/N)
- `select_single` (fixed choice list)
- `text`
- `date`
- `time`
- `nps` (0-10)

### Source of Truth
- Seed all questions from `questions mystery shopper.md`.
- Persist per-question metadata:
  - `category`
  - `question_text`
  - `question_key`
  - `order_index`
  - `input_type`
  - `score_min` / `score_max` where relevant
  - `choices` JSON for dropdown/multiple choice

## Backend Implementation

### A) Migrations and Seed
1. Add `Mystery Shopper` record in `survey_types`.
2. Create `mystery_shopper_locations` table.
3. Create `mystery_shopper_assessments` table.
4. Seed initial location values (if provided).
5. Seed all Mystery Shopper questions.

### B) API Additions
- Location Admin APIs:
  - `GET /mystery-shopper/locations`
  - `POST /mystery-shopper/locations`
  - `PUT /mystery-shopper/locations/{id}`
  - `DELETE /mystery-shopper/locations/{id}` (soft delete/active false recommended)
- Assessment header APIs:
  - `POST /mystery-shopper/visits/{visit_id}/header`
  - `PUT /mystery-shopper/visits/{visit_id}/header`
  - `GET /mystery-shopper/visits/{visit_id}/header`
- Extend list/detail APIs used by dashboard to include header fields.

### C) Validation Rules
- Enforce type-safe response validation by question metadata.
- Enforce score boundaries and allowed choices.
- For mandatory fields, reject incomplete submit.
- Set `report_completed_date` automatically on submit/update-final using UTC+4 date.

### D) Timezone Rule (UTC+4)
- Use timezone-aware date derivation in backend service layer.
- Never trust client local timezone for `report_completed_date`.
- `report_completed_date = now_utc shifted +4 hours -> date component`.

## Mystery Shopper Survey Frontend (`frontend/mystery-shopper`)

### Core Features
- Identity and role context aligned to Mystery Shopper user domain.
- Planned visits view: today/upcoming, refresh, draft selection.
- Header capture form (Section 1 + Section 8 fields).
- Dynamic question rendering by input type.
- Save response per question and full submit flow.
- Mobile jump-to-category, sticky controls, and no clipping in cards.

### UX Requirements
- Sectioned layout matching 8 sections.
- Consistent spacing and touch targets on mobile.
- Inline validation + toast feedback.
- Safe area handling for bottom nav on mobile.

## Dashboard Frontend (`frontend/dashboard`)

### Platform Integration
- Add Mystery Shopper mode in platform guide and navigation.
- Show Mystery-only views when selected.

### Results and Review
- Results list columns:
  - location, visit date, visit time, purpose, staff on duty, shopper name, status
  - quality score, CSAT, NPS
- Detail panel includes section-level breakdown.
- Review workflow mirrors existing status transitions.

### Analytics
- Average score (1-5 blocks)
- CSAT average (two 0-10 questions)
- NPS distribution/score
- Waiting time and service completion distributions
- Location comparison and date trends

## Security and Access
- Program-scoped access checks so Mystery users do not cross into B2B by default.
- Admin permissions required for location management and question admin changes.

## Testing and Verification

### Backend
- Unit tests for validation, timezone behavior, and endpoints.
- Integration tests for draft/create/update/submit/review lifecycle.

### Frontend
- Build checks for `frontend/mystery-shopper` and `frontend/dashboard`.
- Functional checks:
  - load drafts on refresh
  - jump to category on mobile
  - submit/review path
  - filters and analytics correctness
- Responsive checks: 360px, 390px, 414px, tablet, desktop.

## Delivery Phases
- Phase 1: backend schema + seed + location APIs
- Phase 2: mystery shopper survey frontend MVP
- Phase 3: dashboard mystery list/detail/review
- Phase 4: analytics and mobile polish
- Phase 5: QA hardening and docs

## Risks and Mitigations
- Input type drift between questions and frontend renderer -> enforce strict schema + fallback rendering guard.
- Timezone confusion for report date -> compute only in backend from UTC source.
- Access leakage across programs -> explicit program filters in all queries.

## Definition of Done
- Mystery Shopper fully operational as an independent program.
- All 32 fields implemented and validated.
- Admin location management live.
- UTC+4 report completion date generated reliably.
- Dashboard review + analytics complete for Mystery Shopper.
- Mobile UX verified with no clipping/overlap issues.
