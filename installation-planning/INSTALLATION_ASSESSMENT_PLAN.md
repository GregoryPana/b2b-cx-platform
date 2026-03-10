# Installation Assessment Implementation Plan

## Goal
Build the Installation Assessment survey platform with a dedicated survey frontend, shared database storage, and unified dashboard reporting. The system must capture auditable historical records with overall and per-category scoring derived from the questions in `questions install.md`.

## Requirements Summary
- Survey frontend for Installation Assessment only.
- Data stored in the same database as the B2B platform.
- Unified dashboard shows Installation assessments, filters, and analytics.
- Mandatory header fields per assessment:
  - Customer name
  - Customer type (B2B or B2C)
  - Location
  - Work date
  - Execution party (Field Team or Contractor)
- Questions, categories, scoring rules, and overall score formula come from `questions install.md`.
- Overall score = average of all 7 question scores (sum/7).
- Manager/Admin can:
  - See all assessments with overall score
  - View details with per-question and per-category scores
  - Filter by location, customer, B2B/B2C, field team/contractor, date
  - View analytics by variables (field team vs contractor, B2B vs B2C)

## Data Model (Shared DB)
Add a new table linked to visits:
- installation_assessments
  - id (PK)
  - visit_id (FK to visits.id, unique)
  - customer_name
  - customer_type (B2B/B2C)
  - location
  - work_date
  - execution_party (Field Team/Contractor)
  - team_name (optional)
  - contractor_name (optional)
  - created_at, updated_at

Use existing question/response model for answers, scoped by survey_type_id:
- survey_type: "Installation Assessment"
- 7 questions, input_type=score, score_min=1, score_max=5

## Backend Tasks
1) Schema and migrations
   - Add installation_assessments table.
   - Seed survey_types row for "Installation Assessment".
   - Seed installation questions from `questions install.md`.

2) API endpoints
   - Extend visit creation/update to accept installation header fields.
   - Create or update installation_assessments row in same transaction.
   - Extend detail endpoint to include:
     - header fields
     - per-question scores
     - per-category averages
     - overall score
   - Extend list endpoint to include header fields and filters:
     - location, customer_name, customer_type, execution_party, work_date range
   - Add analytics for Installation platform:
     - avg overall score by execution_party
     - avg overall score by customer_type
     - category averages by segment
     - score distribution by threshold bands

3) Validation
   - Ensure header fields are required for installation visits.
   - Ensure score inputs are within 1-5.

## Survey Frontend (Installation)
1) App structure
   - Dedicated app under `frontend-installation/` or `frontend/installation/`.
   - Use same API base pattern as existing apps.

2) Flow
   - Step 1: Capture header fields (customer, type, location, work date, execution party).
   - Step 2: Answer 7 scored questions.
   - Show live overall score and category averages.
   - Save draft responses and submit for review.

3) UX
   - Clear category grouping.
   - Display scoring thresholds and auditor actions from `questions install.md`.

## Unified Dashboard (Installation)
1) Results list
   - Show customer, location, work date, execution party, overall score, status.
   - Filters: location, customer name, B2B/B2C, field team/contractor, date.

2) Detail view
   - Header fields
   - Overall score
   - Per-category averages
   - Per-question scores
   - Reviewer actions (approve/reject/needs changes)

3) Analytics
   - Avg overall score by execution_party
   - Avg overall score by customer_type
   - Category averages by segment
   - Threshold band counts (Excellent, Needs Improvement, Rework, Critical)

## Phased Delivery
Phase A: Schema, seed data, backend endpoints.
Phase B: Installation survey frontend.
Phase C: Dashboard results + detail + analytics.
Phase D: Hardening, exports, audit trails.

## Open Decisions
- Should Installation assessments be tied to existing businesses or stand alone?
  - Recommended default: standalone header fields in installation_assessments to support B2B and B2C.
