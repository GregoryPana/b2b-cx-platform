# Approval State Transitions

## Allowed Transitions
- Draft -> Pending
- Pending -> Needs Changes
- Pending -> Approved
- Pending -> Rejected
- Needs Changes -> Pending
- Rejected -> Draft (Admin override only)
- Approved -> Rejected (Admin override only)

## Rules
- Reviewer can request edits only when status is Pending.
- Reviewer can approve or reject only when status is Pending.
- Rejection requires rejection comments.
- Needs Changes requires change notes and reviewer_id.
- Approval can include optional approval_notes.
- Representative cannot approve or reject.
- Admin can override state with audit log entry.

## Audit Requirements
- Log entity_type, entity_id, action, modified_by, timestamp.
- Log includes previous_status and new_status.
- Log includes change_notes when status is Needs Changes.
- Log includes approval_notes or rejection_notes when provided.
