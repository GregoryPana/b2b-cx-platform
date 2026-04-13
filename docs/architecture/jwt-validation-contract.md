# JWT Validation Contract

## Provider
Microsoft Entra ID (JWT-based).

## Requirements
- Validate signature, issuer, and audience.
- Enforce token expiration and not-before claims.
- Require user identity claims for role resolution.

## Role Resolution
- Role is resolved from token claims and mapped to application roles.
- If role is missing or unmapped, deny access.

## Failure Behavior
- Invalid or missing token returns 401.
- Valid token without sufficient role returns 403.
