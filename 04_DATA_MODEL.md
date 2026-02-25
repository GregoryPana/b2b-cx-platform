# Data Model

## Tables

### Users
- id
- name
- email
- role
- active
- created_at

### Businesses
- id
- name
- location
- account_executive_id
- priority_flag
- active
- created_at

### AccountExecutives
- id
- name
- email

### Visits
- id (UUID)
- business_id
- representative_id
- visit_date
- visit_type
- status (Draft, Pending, Approved, Rejected)
- status (Draft, Pending, Needs Changes, Approved, Rejected)
- reviewer_id
- review_timestamp
- change_notes
- approval_timestamp
- approval_notes
- rejection_notes
- created_at

### MeetingAttendees
- id
- visit_id
- name
- role

### Questions
- id
- category
- question_text
- is_nps
- is_mandatory
- order_index

### Responses
- id
- visit_id
- question_id
- score
- verbatim
- action_required
- action_target
- priority_level
- due_date

### AuditLogs
- id
- entity_type
- entity_id
- action
- modified_by
- timestamp
