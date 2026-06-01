# Entra Auth And Session Skill

## Purpose

Use this skill to implement or troubleshoot Entra authentication, role handling, token validation, and session continuity.

## Use When

- users get `401 Unauthorized`
- users get stuck on `Signing in...`
- silent renewal is needed for long sessions
- JWT validation or JWKS fetch behavior fails

## Rules

- treat blank optional auth values as unset
- backend must validate issuer, audience, expiry, and tenant
- do not use staging-only fallback behavior in production unless explicitly intended
- prefer silent token renewal over hard app-side timeout logic for long-running sessions

## Process

1. inspect frontend MSAL flow
2. inspect backend validator env and behavior
3. verify redirect URIs and app registration setup
4. test silent token renewal
5. test JWKS connectivity from the VM
6. harden retry behavior for transient JWKS resets

## Common Failure Patterns

- wrong audience or scope
- blank `ENTRA_JWKS_URL`
- intermittent Microsoft JWKS fetch resets
- strict app-side timeout fighting Entra renewal
- role claims missing or stale

## References

- `INTERNAL DEV KIT/06_ENTRA_ID_INTEGRATION_GUIDE.md`
- `backend/app/core/auth/entra.py`
- `docs/operations/ENTRA_SESSION_POLICY.md`
- `frontend/*/src/auth.*`
