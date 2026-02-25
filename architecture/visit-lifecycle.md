# Visit Lifecycle Specification

## States
- Draft
- Pending
- Needs Changes
- Approved
- Rejected

## Rules
- Draft is editable by the Representative who created it.
- Pending is editable by Reviewer when correction is required.
- Needs Changes is editable by Reviewer and Representative.
- Approved and Rejected are immutable except by Admin override.
- Only Approved visits count toward coverage, dashboards, and NPS.
- Status changes are explicit and audited.

## Required Fields by State
- Draft: minimum fields to save draft.
- Pending: required visit metadata and required responses validated.
- Needs Changes: reviewer_id and review_timestamp required; change notes required.
- Approved/Rejected: reviewer_id and decision timestamp required.
