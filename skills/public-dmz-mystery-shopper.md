# Public DMZ Mystery Shopper Skill

## Purpose

Use this skill to create or operate a public-facing Mystery Shopper deployment separate from the internal platform.

## Use When

- designing a DMZ-hosted survey app
- preparing a public frontend/backend VM
- deciding invitation, OTP, or hybrid access model
- creating a dedicated public deployment workflow

## Rules

- do not expose the internal dashboard publicly
- keep DB internal; only allow restricted inward connectivity
- use a separate deploy workflow and runner for the public path
- keep the auth model independent from the internal Entra-only flow unless deliberately changed

## Process

1. define DMZ VM and route exposure
2. set up target directories, TLS, and nginx
3. create a dedicated self-hosted runner and environment
4. build a mystery-only release path
5. choose access model: signed link, OTP, or hybrid
6. verify internal DB connectivity and public route behavior

## References

- `docs/deployment/MYSTERY_PUBLIC_DMZ_SETUP.md`
- `docs/architecture/MYSTERY_PUBLIC_AUTH_OPTIONS.md`
- `.github/workflows/deploy-mystery-public.yml`
- `scripts/linux/deploy_mystery_public_*.sh`
