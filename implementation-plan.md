# Implementation Plan

## Sequence
1. Database schema updates and migrations.
2. Domain models and enums (VisitStatus includes Needs Changes).
3. API contracts and request/response schemas.
4. Auth middleware and role enforcement.
5. Visit creation and submission logic.
6. Review workflow: Needs Changes, Approve, Reject.
7. Response create and edit logic with validation.
8. NPS and coverage calculation updates (Approved only).
9. Dashboard endpoints and filters.
10. Frontend integration for survey and dashboard.

## Local Verification
- Migration up/down smoke test.
- API contract tests for visit lifecycle and response edits.
- Auth role tests for representative/reviewer/manager/admin.
- NPS and coverage calculation tests.
