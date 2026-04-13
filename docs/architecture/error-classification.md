# Error Classification

## Validation Errors
- 400: malformed request
- 422: schema validation failure

## Workflow Validation Errors
- 422: missing change_notes on Needs Changes
- 422: missing rejection_notes on Reject
- 409: invalid state transition (e.g., approve from Draft)

## Authentication and Authorization
- 401: invalid or missing JWT
- 403: role not permitted

## Resource Errors
- 404: resource not found
- 409: invalid state transition or conflict

## Server Errors
- 500: unhandled exception
- 503: dependency unavailable (DB, auth provider)

## Error Payload
- error_code
- message
- correlation_id
- details (optional)
