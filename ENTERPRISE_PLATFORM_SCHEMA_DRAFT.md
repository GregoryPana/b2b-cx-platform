# Enterprise Platform Schema Draft

## Purpose
Draft relational schema for a future metadata-driven survey and analytics platform.

This draft is intended to accelerate implementation planning and review.

## 1) Core Domain

### `programs`
- `id` (PK)
- `code` (unique, e.g. `B2B`, `MYSTERY_SHOPPER`)
- `name`
- `description`
- `active` (bool)
- `created_at`, `updated_at`

### `surveys`
- `id` (PK)
- `program_id` (FK -> `programs.id`)
- `key` (unique within program, stable id for API)
- `name`
- `description`
- `active` (bool)
- `created_by`, `updated_by` (FK -> `users.id`, nullable)
- `created_at`, `updated_at`

### `survey_versions`
- `id` (PK)
- `survey_id` (FK -> `surveys.id`)
- `version_number` (int)
- `status` (enum: `draft`, `pending_approval`, `published`, `archived`)
- `is_active_runtime` (bool)
- `published_at` (nullable)
- `published_by` (FK -> `users.id`, nullable)
- `change_summary` (text)
- `created_by`, `updated_by` (FK -> `users.id`, nullable)
- `created_at`, `updated_at`
- Unique: (`survey_id`, `version_number`)

## 2) Survey Structure

### `survey_sections`
- `id` (PK)
- `survey_version_id` (FK -> `survey_versions.id`)
- `section_key` (stable key within version)
- `title`
- `description` (nullable)
- `order_index` (int)
- `is_collapsible` (bool)
- `created_at`, `updated_at`
- Unique: (`survey_version_id`, `section_key`)

### `question_option_sets`
- `id` (PK)
- `program_id` (FK -> `programs.id`, nullable for global)
- `key` (unique)
- `name`
- `description` (nullable)
- `active` (bool)
- `created_at`, `updated_at`

### `question_options`
- `id` (PK)
- `option_set_id` (FK -> `question_option_sets.id`)
- `value` (stored answer value)
- `label` (display value)
- `active` (bool)
- `sort_order` (int)
- `metadata_json` (jsonb, nullable)
- `created_at`, `updated_at`

### `survey_questions`
- `id` (PK)
- `survey_version_id` (FK -> `survey_versions.id`)
- `section_id` (FK -> `survey_sections.id`)
- `question_key` (global stable logical key if reused)
- `version_question_key` (unique in version)
- `prompt`
- `help_text` (nullable)
- `input_type` (enum/string)
- `is_required` (bool)
- `order_index` (int)
- `score_min`, `score_max` (nullable ints)
- `is_nps` (bool)
- `option_set_id` (FK -> `question_option_sets.id`, nullable)
- `default_value_json` (jsonb, nullable)
- `metadata_json` (jsonb, nullable)
- `created_at`, `updated_at`
- Unique: (`survey_version_id`, `version_question_key`)

### `question_validations`
- `id` (PK)
- `survey_question_id` (FK -> `survey_questions.id`)
- `rule_type` (enum/string: `min`, `max`, `regex`, `allowed_values`, `custom`)
- `rule_config_json` (jsonb)
- `error_message`
- `created_at`, `updated_at`

### `question_logic_rules`
- `id` (PK)
- `survey_version_id` (FK -> `survey_versions.id`)
- `target_question_id` (FK -> `survey_questions.id`)
- `logic_type` (enum/string: `show_if`, `hide_if`, `required_if`)
- `expression_json` (jsonb)
- `created_at`, `updated_at`

## 3) Runtime Visits and Responses

### `visits` (existing table evolution)
- Keep existing IDs and operational fields
- Add:
  - `program_id` (FK -> `programs.id`)
  - `survey_id` (FK -> `surveys.id`)
  - `survey_version_id` (FK -> `survey_versions.id`)

### `visit_headers`
- `id` (PK)
- `visit_id` (FK -> `visits.id`, unique)
- `schema_json` (jsonb)
- `created_at`, `updated_at`

### `visit_responses` (new canonical response table)
- `id` (PK)
- `visit_id` (FK -> `visits.id`)
- `survey_question_id` (FK -> `survey_questions.id`)
- `question_key` (denormalized for compatibility)
- `answer_json` (jsonb)
- `score_value` (numeric, nullable)
- `text_value` (text, nullable)
- `selected_option_value` (text, nullable)
- `is_missing_by_design` (bool default false)
- `created_at`, `updated_at`
- Unique: (`visit_id`, `survey_question_id`)

### `response_actions` (existing semantics retained)
- `id` (PK)
- `response_id` (FK -> `visit_responses.id`)
- `action_required`
- `action_owner`
- `action_timeframe`
- `action_support_needed`
- `created_at`, `updated_at`

## 4) Analytics Configuration

### `metrics`
- `id` (PK)
- `program_id` (FK -> `programs.id`)
- `key` (unique)
- `name`
- `description`
- `active` (bool)
- `created_at`, `updated_at`

### `metric_versions`
- `id` (PK)
- `metric_id` (FK -> `metrics.id`)
- `version_number` (int)
- `status` (enum: `draft`, `published`, `archived`)
- `definition_json` (jsonb)  // formula DSL, filters, dimensions
- `created_at`, `updated_at`
- Unique: (`metric_id`, `version_number`)

### `dashboard_widgets`
- `id` (PK)
- `program_id` (FK -> `programs.id`)
- `key` (unique)
- `name`
- `widget_type` (enum/string: `kpi`, `line`, `bar`, `table`, `distribution`)
- `config_json` (jsonb)
- `active` (bool)
- `created_at`, `updated_at`

### `widget_metric_links`
- `id` (PK)
- `widget_id` (FK -> `dashboard_widgets.id`)
- `metric_version_id` (FK -> `metric_versions.id`)
- `display_order` (int)

## 5) Governance and Audit

### `config_change_requests`
- `id` (PK)
- `entity_type` (survey, question, metric, widget)
- `entity_id`
- `proposed_change_json` (jsonb)
- `status` (draft, submitted, approved, rejected)
- `requested_by`, `reviewed_by` (FK -> `users.id`, nullable)
- `review_notes` (nullable)
- `created_at`, `updated_at`

### `publish_reports`
- `id` (PK)
- `entity_type` (survey_version, metric_version)
- `entity_id`
- `compatibility_json` (jsonb)
- `warnings_json` (jsonb)
- `blocking_errors_json` (jsonb)
- `created_at`

### `audit_events`
- `id` (PK)
- `actor_user_id` (FK -> `users.id`, nullable)
- `event_type`
- `entity_type`
- `entity_id`
- `before_json` (jsonb, nullable)
- `after_json` (jsonb, nullable)
- `created_at`

## 6) Compatibility Tracking (Optional but Recommended)

### `question_compatibility_mappings`
- `id` (PK)
- `from_survey_question_id` (FK -> `survey_questions.id`)
- `to_survey_question_id` (FK -> `survey_questions.id`)
- `mapping_type` (equivalent, scaled, derived, incompatible)
- `mapping_config_json` (jsonb, nullable)
- `created_at`

### `metric_compatibility_cache`
- `id` (PK)
- `metric_version_id` (FK -> `metric_versions.id`)
- `date_from`, `date_to`
- `compatibility_status` (compatible, partial, incompatible)
- `coverage_pct` (numeric)
- `details_json` (jsonb)
- `updated_at`

## 7) Key Design Rules
- Always resolve runtime responses through `survey_version_id`.
- Never mutate published survey/metric versions in place.
- Prefer stable `question_key` for analytics references.
- Show coverage/compatibility when aggregating across versions.
- Keep option sets reusable and centrally manageable.

## 8) Phased Adoption Notes
- Stage 1: add new tables in parallel with existing runtime tables.
- Stage 2: dual-write to new response model while keeping legacy paths.
- Stage 3: migrate dashboards to metric/widget definitions.
- Stage 4: retire legacy hardcoded analytics paths after parity validation.
