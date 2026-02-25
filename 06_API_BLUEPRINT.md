# API Blueprint

## Auth
- POST /auth/login (dev mock)
- GET /auth/me

## Users
- GET /users (Admin)
- POST /users (Admin)
- PUT /users/{id} (Admin)

## Businesses
- GET /businesses
- POST /businesses (Admin)
- PUT /businesses/{id}

## Account Executives
- GET /account-executives
- POST /account-executives (Admin)
- PUT /account-executives/{id}

## Visits
- POST /visits
- GET /visits/my
- GET /visits/pending
- GET /visits/{id}
- PUT /visits/{id}/submit
- PUT /visits/{id}/needs-changes
- PUT /visits/{id}/approve
- PUT /visits/{id}/reject

### POST /visits
Request:
- business_id (uuid, required)
- representative_id (uuid, required)
- visit_date (date, required)
- visit_type (string, required)
- meeting_attendees (array, optional)

Response:
- visit_id
- status (Draft)
- created_at

### PUT /visits/{id}/submit
Request:
- submit_notes (string, optional)

Response:
- visit_id
- status (Pending)
- submitted_timestamp

### PUT /visits/{id}/needs-changes
Request:
- change_notes (string, required)

Response:
- visit_id
- status (Needs Changes)
- reviewer_id
- review_timestamp
- change_notes

### PUT /visits/{id}/approve
Request:
- approval_notes (string, optional)

Response:
- visit_id
- status (Approved)
- reviewer_id
- approval_timestamp
- approval_notes (if provided)

### PUT /visits/{id}/reject
Request:
- rejection_notes (string, required)

Response:
- visit_id
- status (Rejected)
- reviewer_id
- review_timestamp
- rejection_notes

## Responses
- POST /visits/{id}/responses
- PUT /visits/{id}/responses/{response_id}

### POST /visits/{id}/responses
Request:
- question_id (uuid, required)
- score (integer 0-10, required)
- verbatim (string, required)
- action_required (string, optional)
- action_target (string, optional)
- priority_level (string, optional)
- due_date (date, optional)

Response:
- response_id
- visit_id
- question_id
- score
- verbatim
- action_required
- action_target
- priority_level
- due_date

### PUT /visits/{id}/responses/{response_id}
Request:
- score (integer 0-10, optional)
- verbatim (string, optional)
- action_required (string, optional)
- action_target (string, optional)
- priority_level (string, optional)
- due_date (date, optional)

Response:
- response_id
- visit_id
- question_id
- score
- verbatim
- action_required
- action_target
- priority_level
- due_date

## Dashboard
- GET /dashboard/nps
- GET /dashboard/coverage
- GET /dashboard/category-breakdown

## Questions
- GET /questions
- POST /questions (Admin)
- PUT /questions/{id}
