# Common Checklists

## Deployment Checklist

- exact commit checked out
- workspace cleaned
- release bundle built
- frontend artifacts present
- backend service restarted
- nginx config tested
- health endpoint verified
- route checks verified

## Auth Checklist

- client ID and tenant ID correct
- redirect URLs correct
- audience correct
- issuer correct
- roles assigned
- silent renewal working if applicable

## Database Checklist

- migration reviewed
- migration path tested
- backup exists
- restore readiness verified
- destructive reset not included in deploy

## Handover Checklist

- README current
- EXIT current
- env vars documented
- services documented
- monitoring documented
- rollback documented
