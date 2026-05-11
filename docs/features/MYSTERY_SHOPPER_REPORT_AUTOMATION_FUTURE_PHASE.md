# Mystery Shopper Report Automation Future Phase

## Purpose
Define the future-phase architecture for automated Mystery Shopper reporting so phase-1 and phase-2 implementations do not block it.

## Outcome
Users will be able to define their own reporting routines, including:
- what report to generate
- what filters to apply
- when to generate it
- who receives it
- whether it is preview-only, email-only, PDF attachment, HTML email body, or both

## Examples
- Lifetime overview report sent monthly on the first business day.
- Weekly location report for a single service centre.
- Bi-weekly staff-on-duty report.
- Report generated every time a survey is approved.
- Report generated when a selected threshold is breached for a location or KPI.

## Design Principles
- Report automation must reuse the same report-definition layer as manual reports.
- Filters and report sections must be dynamic, not hardcoded.
- Scheduling must be user-configurable but permission-controlled.
- Rendering should be single-source so HTML and PDF outputs stay aligned.

## Core Concepts

### Report Definition
A reusable definition of what the report contains.

Suggested fields:
- `report_type`
- `title_template`
- `program_code`
- `scope_type`
- `selected_filters_json`
- `included_sections_json`
- `output_modes_json`

### Report Routine
A saved automation rule created by a user.

Suggested fields:
- `id`
- `program_code`
- `name`
- `description`
- `owner_user_id`
- `active`
- `trigger_type`
- `schedule_type`
- `schedule_config_json`
- `event_trigger_config_json`
- `report_definition_id`
- `recipient_config_json`
- `email_subject_template`
- `email_body_template`
- `last_run_at`
- `next_run_at`
- `created_at`
- `updated_at`

### Trigger Types
- `schedule`
- `event`
- `threshold`

### Schedule Types
- `daily`
- `weekly`
- `bi_weekly`
- `monthly`
- `custom_cron_like`

### Event Triggers
- survey approved
- survey submitted
- end of reporting period

### Recipients
- direct email addresses
- named distribution lists
- role-based recipients if needed later

## Recommended Database Additions
- `report_definitions`
- `report_routines`
- `report_routine_runs`
- `report_delivery_targets`

## Recommended API Surface
- `GET /reports/routines`
- `POST /reports/routines`
- `PUT /reports/routines/{id}`
- `DELETE /reports/routines/{id}`
- `POST /reports/routines/{id}/run-now`
- `GET /reports/routines/{id}/history`

## UI Requirements

### Routine Builder
The user should be able to configure:
- report type
- scope and filters
- included metrics and sections
- HTML and/or PDF output
- recipients
- send cadence or trigger

### Routine Preview
- preview the report before saving the routine
- preview email subject/body
- preview recipient list

### Run History
- show generated time
- show success/failure
- show recipients
- show links to generated HTML/PDF artifacts if retained

## Rendering Model
- Generate report data through the same report-query layer used for manual reports.
- Render HTML through a shared template engine or component-based report renderer.
- Render PDF from the same HTML or from the same report model through a controlled PDF pipeline.

## Scheduling Model
- Recommended execution model: background scheduler plus persisted job state.
- Trigger evaluation should not run in the browser.
- The backend should own:
  - schedule computation
  - event trigger handling
  - report rendering
  - email dispatch

## Permissions
- Platform admins may create and manage routines for their own platform.
- `CX_SUPER_ADMIN` may manage routines across all platforms.
- Surveyors should not create org-level dashboard reporting routines unless explicitly allowed later.

## Phase Planning

### Not in Phase 1
- background scheduler
- user-defined routines
- event-driven automated generation
- recurring email delivery

### Must Be Enabled by Phase 1 Design
- reusable report-definition layer
- reusable filter model
- reusable HTML/PDF rendering pipeline
- stable report query contracts

## Risks
- Hardcoded report templates would block user-configurable automation later.
- Separate HTML and PDF logic would drift and create inconsistent output.
- Embedding schedule logic in the frontend would be brittle and insecure.

## Success Criteria
- Manual reports and automated reports use the same rendering and filtering engine.
- Users can define dynamic reporting routines without engineering intervention.
- HTML preview, PDF output, and email delivery remain consistent for the same report definition.
