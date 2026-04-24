# Mystery Shopper Platform Implementation Plan

## Purpose
Define the target architecture and phased delivery plan for the Mystery Shopper platform as a first-class CX program.

This plan reflects:
- the current codebase
- the approved question framework in `docs/reference/questions-mystery-shopper.md`
- the supplemental planning notes in:
  - `mystery shopper framework.md`
  - `mystery shopper wireframe.md`
  - `mystery shopper ui analytics charts.md`
- the confirmed product decisions from working sessions

## Confirmed Product Decisions

### Product Boundary
- Mystery Shopper surveys are completed in a separate frontend application, the same way B2B and Installation are handled.
- Mystery Shopper dashboard access remains inside the shared dashboard shell and platform selector.
- The dashboard must use dedicated mystery page modules, not a generic B2B-derived placeholder view.

### Role Model
- The system role model is:
  - `INSTALL_SURVEYOR`
  - `INSTALL_ADMIN`
  - `MYSTERY_SURVEYOR`
  - `MYSTERY_ADMIN`
  - `B2B_SURVEYOR`
  - `B2B_ADMIN`
  - `CX_SUPER_ADMIN`
- Platform access is constrained by those Entra roles.
- Admin roles control dashboard access for their platform.
- Surveyor roles control survey-frontend access for their platform.
- `CX_SUPER_ADMIN` has access to all dashboards and all survey frontends.
- A user may hold roles for multiple platforms.

### Dashboard Access Rules
- B2B dashboard access:
  - `B2B_ADMIN`
  - `CX_SUPER_ADMIN`
- Mystery Shopper dashboard access:
  - `MYSTERY_ADMIN`
  - `CX_SUPER_ADMIN`
- Installation dashboard access:
  - `INSTALL_ADMIN`
  - `CX_SUPER_ADMIN`

### Survey Frontend Access Rules
- B2B survey frontend access:
  - `B2B_SURVEYOR`
  - `B2B_ADMIN`
  - `CX_SUPER_ADMIN`
- Mystery Shopper survey frontend access:
  - `MYSTERY_SURVEYOR`
  - `MYSTERY_ADMIN`
  - `CX_SUPER_ADMIN`
- Installation survey frontend access:
  - `INSTALL_SURVEYOR`
  - `INSTALL_ADMIN`
  - `CX_SUPER_ADMIN`

### Reporting
- Reports must exist in two forms:
  - fully formatted PDF
  - HTML report preview suitable for in-app rendering and email preparation
- The HTML version must be suitable for preview before send.
- The PDF version must be suitable for formal distribution and audit retention.

### Future Reporting Automation
- Automated report generation and sending is explicitly in future scope.
- The architecture must support user-defined reporting routines such as:
  - lifetime summary reports sent monthly, weekly, bi-weekly, or custom cadence
  - report generation when a survey is approved
  - reports scoped to location, staff, purpose, date range, or other filters
  - user-selected recipients
  - user-defined included sections and metrics

### Scheduling and Assignment
- Scheduling and assignment are out of phase 1.
- The data model and APIs must remain assignment-ready so this can be added later without schema conflict.

### Survey Versioning
- The schema must be version-ready in phase 1.
- Only `v1` is active in phase 1.

## Current-State Summary
- The current Mystery Shopper implementation already has:
  - a separate survey frontend in `frontend/mystery-shopper`
  - dashboard support in `frontend/dashboard-blueprint`
  - partial mystery-specific backend APIs in `backend/app/api/mystery_shopper.py`
  - mystery-specific supporting tables for locations, assessments, and purposes
- The current implementation is still transitional because it also relies on shared visit and response infrastructure used by B2B.
- Shared business-oriented assumptions still leak into mystery list/detail/review paths and some analytics/table labels.
- Runtime schema bootstrapping currently exists and should be removed from the final design.

## Goals
- Deliver Mystery Shopper as a cleanly defined platform within the shared CX system.
- Preserve the shared dashboard shell and platform-selection experience.
- Preserve separate survey frontends per platform.
- Eliminate B2B-specific leakage from Mystery Shopper data flows.
- Implement analytics and reporting that match the approved wireframe and KPI model.

## Target Architecture

### Frontend Topology
- Shared dashboard shell:
  - `frontend/dashboard-blueprint`
- Separate survey frontends:
  - `frontend/survey` for B2B
  - `frontend/mystery-shopper` for Mystery Shopper
  - `frontend/installation-survey` for Installation Assessment

### Entra Authentication Model
- All frontends authenticate through Entra using MSAL.
- Each frontend reads Entra token roles from claims and confirms them via `/auth/me`.
- Platform selection in the dashboard is derived from Entra roles.
- Survey frontend access is validated in the relevant survey frontend before rendering workspace routes.
- Backend authorization remains the source of truth for protected API actions.

### Dashboard Architecture
- Keep the shared dashboard shell.
- Replace mystery-specific branches inside a giant generic page with dedicated page modules.
- Recommended mystery feature module layout inside the dashboard app:
  - `src/features/mystery-shopper/pages/MysteryOverviewPage.jsx`
  - `src/features/mystery-shopper/pages/MysteryAnalyticsPage.jsx`
  - `src/features/mystery-shopper/pages/MysteryReviewPage.jsx`
  - `src/features/mystery-shopper/pages/MysterySurveysPage.jsx`
  - `src/features/mystery-shopper/pages/MysteryLocationsPage.jsx`
  - `src/features/mystery-shopper/pages/MysteryPurposesPage.jsx`
  - `src/features/mystery-shopper/pages/MysteryReportsPage.jsx`
  - `src/features/mystery-shopper/components/*`
  - `src/features/mystery-shopper/api.js`

### Survey Frontend Architecture
- Mystery Shopper survey remains a standalone frontend.
- It should be modularized into feature folders instead of a monolithic `App.jsx`.
- Recommended structure:
  - `src/features/session`
  - `src/features/visits`
  - `src/features/survey`
  - `src/features/submission`
  - `src/components/layout`
  - `src/components/survey`
  - `src/lib/api`
  - `src/lib/auth`

### Backend Architecture
- Introduce a dedicated Mystery Shopper domain service layer.
- Remove runtime schema mutation and bootstrap dependencies from request flow.
- Move schema creation and changes fully into Alembic migrations.
- Replace shared visit-detail and shared response dependencies with mystery-native APIs.

## Database Design

### Required Core Tables
- `mystery_locations`
- `mystery_purpose_options`
- `mystery_survey_versions`
- `mystery_survey_sections`
- `mystery_survey_questions`
- `mystery_visits`
- `mystery_visit_answers`
- `mystery_visit_reviews`
- `mystery_visit_status_history`

### Mystery Locations
- Fields:
  - `id`
  - `name`
  - `region` nullable
  - `active`
  - `created_at`
  - `updated_at`

### Purpose Options
- Fields:
  - `id`
  - `name`
  - `sort_order`
  - `active`
  - `created_at`
  - `updated_at`

### Survey Versions
- Fields:
  - `id`
  - `name`
  - `version_code`
  - `is_active`
  - `effective_from`
  - `effective_to`
  - `created_at`

### Survey Sections
- Fields:
  - `id`
  - `survey_version_id`
  - `section_code`
  - `title`
  - `sort_order`
  - `weight_percent`

### Survey Questions
- Fields:
  - `id`
  - `survey_version_id`
  - `section_id`
  - `question_key`
  - `question_number`
  - `question_text`
  - `input_type`
  - `score_min`
  - `score_max`
  - `choices_json`
  - `is_required`
  - `is_nps`
  - `analytics_role`
  - `sort_order`

### Visits
- Fields:
  - `id`
  - `survey_version_id`
  - `location_id`
  - `visit_date`
  - `visit_time`
  - `purpose_option_id`
  - `staff_on_duty`
  - `shopper_name`
  - `created_by_user_id`
  - `submitted_by_user_id` nullable
  - `status`
  - `submitted_at` nullable
  - `approved_at` nullable
  - `rejected_at` nullable
  - `needs_changes_at` nullable
  - `report_completed_date` nullable
  - `created_at`
  - `updated_at`

### Answers
- Fields:
  - `id`
  - `visit_id`
  - `question_id`
  - `score_value` nullable
  - `answer_text` nullable
  - `answer_choice` nullable
  - `comment_text` nullable
  - `created_at`
  - `updated_at`

### Reviews
- Fields:
  - `id`
  - `visit_id`
  - `reviewed_by_user_id`
  - `decision`
  - `review_notes`
  - `reviewed_at`

### Status History
- Fields:
  - `id`
  - `visit_id`
  - `from_status`
  - `to_status`
  - `changed_by_user_id`
  - `change_reason`
  - `created_at`

### Future-Phase Assignment Fields
- Keep these fields available for later addition in an assignment-ready manner:
  - `assigned_to_user_id`
  - `assigned_by_user_id`
  - `assigned_at`
  - `due_date`
  - `assignment_status`

These should not drive phase-1 UX, but the schema must not block them.

## Question Model
- Use `docs/reference/questions-mystery-shopper.md` as the `v1` source of truth.
- The approved structure remains 32 fields across the defined sections.
- Supported input types:
  - `score`
  - `yes_no`
  - `select_single`
  - `text`
  - `date`
  - `time`
  - `nps`

## API Architecture

### Config APIs
- `GET /mystery-shopper/config`
- `GET /mystery-shopper/locations`
- `POST /mystery-shopper/locations`
- `PUT /mystery-shopper/locations/{id}`
- `GET /mystery-shopper/purposes`
- `POST /mystery-shopper/purposes`
- `PUT /mystery-shopper/purposes/{id}`
- `GET /mystery-shopper/survey/active`

### Visit APIs
- `GET /mystery-shopper/visits`
- `POST /mystery-shopper/visits`
- `GET /mystery-shopper/visits/{id}`
- `PUT /mystery-shopper/visits/{id}`
- `PUT /mystery-shopper/visits/{id}/answers`
- `PUT /mystery-shopper/visits/{id}/submit`

### Review APIs
- `GET /mystery-shopper/review/queue`
- `GET /mystery-shopper/review/{visit_id}`
- `PUT /mystery-shopper/review/{visit_id}/approve`
- `PUT /mystery-shopper/review/{visit_id}/reject`
- `PUT /mystery-shopper/review/{visit_id}/needs-changes`

### Analytics APIs
- `GET /mystery-shopper/analytics/overview`
- `GET /mystery-shopper/analytics/categories`
- `GET /mystery-shopper/analytics/locations`
- `GET /mystery-shopper/analytics/questions`
- `GET /mystery-shopper/analytics/compliance`
- `GET /mystery-shopper/analytics/efficiency`
- `GET /mystery-shopper/analytics/trends`

### Reports APIs
- `GET /mystery-shopper/reports/html`
- `GET /mystery-shopper/reports/pdf`
- `POST /mystery-shopper/reports/email`

## Dashboard Information Architecture

### Mystery Dashboard Pages
- Overview
- Analytics
- Review
- Surveys
- Reports
- Locations
- Purposes
- User Guide

### Overview Page
- top filters
- KPI row
- CX trend chart
- top locations
- bottom locations
- key issues
- key strengths
- insight panel

### Analytics Page
- filters
- category performance
- location comparison
- question-level analysis
- compliance metrics
- operational efficiency
- trends
- CX index

### Review Page
- queue table
- detail pane
- approve
- reject
- needs changes
- reviewer notes

### Surveys Page
- searchable/filterable records table
- detail drawer or detail page
- export actions

### Reports Page
- report type selection
- filter selection
- HTML preview pane
- PDF generation action
- email send preparation

## Survey Frontend UX

### Page Flow
- My Drafts / My Returned Visits
- Start Visit
- Survey Workspace
- Review & Submit
- Submission Confirmation

### UX Rules
- desktop and mobile must both be first-class supported
- sectioned flow must match the approved framework
- sticky category navigation on desktop
- compact category navigation on mobile
- explicit progress and completion state
- safe autosave behavior should replace purely manual per-question saving in the final target

## Analytics Specification

### KPI Set
- CX Score
- NPS
- CSAT
- Positive Experience Rate
- Resolution Rate

### Formula Rules
- CX Score:
  - weighted section score normalized to 100
- NPS:
  - `% promoters - % detractors`
- CSAT:
  - `(avg csat score / 10) * 100`
- Positive Experience Rate:
  - `% of 1-5 score responses >= 4`
- Resolution Rate:
  - `% solution provided = yes`

### Efficiency Rules
- Wait time score mapping:
  - `Under 3 min = 5`
  - `3-7 min = 4`
  - `7-15 min = 3`
  - `15+ min = 1`
- Service completion score mapping should be configured explicitly in question/report logic.

### CX Index Weights
- Customer Interaction: 30
- Staff Professionalism: 20
- Store Environment: 20
- First Impression: 15
- Efficiency: 15

## Reporting Architecture

### HTML Reports
- HTML reports are the canonical preview format in the frontend.
- They must support:
  - branded layout
  - printable formatting
  - clear sections, KPIs, charts, and narrative blocks
  - email-ready rendering

### PDF Reports
- PDFs are generated from the same report definition as HTML.
- PDF output must preserve:
  - title page/header
  - filters used
  - KPI summary
  - charts and tables
  - generated timestamp
  - generated by user

### Emailing
- A user must be able to prepare a report for email delivery from the dashboard.
- Email delivery should support target addresses and contextual subject/body content.

## Future-Phase Report Automation
- See `docs/features/MYSTERY_SHOPPER_REPORT_AUTOMATION_FUTURE_PHASE.md` for the detailed automation model.
- Phase 1 must keep report generation logic composable so automation can call the same report-definition and render pipeline later.

## Security and Access
- Use Entra roles as the canonical access signal.
- Frontend gating is for UX only; backend authorization is authoritative.
- Mystery Shopper data must never rely on B2B business identity to determine access or display context.
- `CX_SUPER_ADMIN` can access all platforms and survey frontends.

## Migration Strategy
- Create mystery-native tables through Alembic.
- Seed `v1` survey version, sections, and questions.
- Migrate legacy mystery locations and purposes.
- Migrate mystery visit metadata and answers out of shared compatibility paths.
- Verify analytics parity before retiring legacy reads.

## Delivery Phases

### Phase 1
- role-correct frontend and dashboard access gating
- mystery-native schema foundation
- survey version tables with `v1` active
- mystery-native visits and answers APIs
- locations and purposes management
- separate mystery dashboard page modules started

### Phase 2
- survey frontend refactor into feature modules
- mystery-native analytics endpoints
- overview and analytics pages aligned to approved wireframes
- reports page with HTML preview and PDF generation

### Phase 3
- review workflow hardening
- survey records and detail views
- reporting/email polish
- migration off remaining shared compatibility paths

### Phase 4
- future-phase automation for scheduled and trigger-based reports
- optional assignment and scheduling features
- advanced analytics and insights

## Definition of Done
- Mystery Shopper is a cleanly defined platform inside the shared CX ecosystem.
- Mystery survey access and dashboard access correctly follow Entra role assignments.
- Separate survey frontend is fully operational.
- Shared dashboard shell renders dedicated mystery modules.
- Reporting exists as both HTML preview and formatted PDF.
- The architecture is ready for future automation and assignment features without rework-heavy schema changes.
