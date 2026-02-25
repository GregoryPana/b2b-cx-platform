# Auth Middleware Specification

## Responsibilities
- Extract bearer token from Authorization header.
- Validate JWT using Entra public keys.
- Attach user context (id, email, role) to request.
- Enforce role-based authorization at endpoint boundary.

## Logging
- Log authentication failures with correlation_id.
- Do not log raw tokens.

## Error Handling
- 401 for missing or invalid token.
- 403 for unauthorized role.
