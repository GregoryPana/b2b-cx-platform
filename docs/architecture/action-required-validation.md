# Action-Required Validation

## Fields
- action_required (optional)
- action_target (conditional)
- priority_level (conditional)
- due_date (optional)

## Rules
- If action_required is provided, action_target and priority_level are required.
- due_date is optional and does not gate submission.
- Validation is enforced at backend.
