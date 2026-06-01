# Troubleshooting Patterns Skill

## Purpose

Use this skill to diagnose recurring issues based on real CWSCX patterns already encountered.

## Use When

- auth suddenly breaks after deploy
- frontend still serves old code
- runner deploy lands on wrong VM
- API returns 500 after a targeted UI action
- route works but asset fetch fails

## Common recurring patterns

### Stale bundle or wrong asset path
- route returns 200
- JS asset returns 404 or HTML
- likely base path, alias, or wrong VM deploy target issue

### Wrong runner target
- deploy logs mention the wrong hostname or environment
- workflow labels are too broad

### Entra JWKS reset
- intermittent `401`
- `Unable to validate access token`
- connection reset during JWKS fetch

### Optional-column SQL crash
- backend 500 after a save/edit path
- query assumes columns exist in every environment

### Frontend runtime crash after change
- blank page
- `ReferenceError` or missing import in console

## Process

1. isolate whether failure is frontend, backend, deploy target, or environment
2. collect the exact failing request/log line
3. compare with known recurring patterns
4. validate the live environment, not just repo code

## References

- `session-ses_20e4.md`
- `session-ses_300a.md`
- `docs/features/MYSTERY_SHOPPER_AND_PLATFORM_TROUBLESHOOTING_LOG.md`
- `docs/audits/`
