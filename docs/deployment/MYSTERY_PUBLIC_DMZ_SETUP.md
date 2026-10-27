# Mystery Shopper APN Application-VM Deployment Guide

> **Current access decision (2026-09-23):** no public IP or Internet exposure. `cwscx-web01` remains in its current location as an internal, non-public application VM reached by approved APN clients. It is not a public DMZ host. The repository identifiers `mystery_public`, `DMZ_HOST` and this legacy filename remain compatibility names, not network-exposure claims.
>
> **Current release procedure:** use [[MYSTERY_PUBLIC_VM_ADMIN_RUNBOOK]] with the repository-controlled immutable workflow. The internal production runner SSH-pushes the reviewed bundle to `cwscx-web01` and invokes one fixed root-owned deployment entrypoint. Older public-IP, Internet NAT/WAF, DMZ-hosted runner, mutable install, VPN-only and DMZ-run migration instructions are historical and must not control deployment.

This guide describes the separated Password+TOTP Mystery Shopper application instance used through APN connectivity.

## 1) Purpose

The Mystery Shopper survey remains on a separate internal application VM. Approved shopper devices reach it through APN connectivity; it is not Internet-facing.

Current target application VM:
- Hostname: `cwscx-web01.cwsey.com`
- IP: `172.17.0.200`

This VM is intended for:
- approved Mystery Shopper users connecting through APN
- non-organisational users on controlled CWS connectivity
- no Microsoft Entra login dependency

This VM is not the same as the internal production VM used by the dashboard and other internal frontends.

## 2) New target model

### Internal environments remain

- mystery staging remains on the current internal staging environment for testing
- internal governance dashboard remains internal-only

### APN application instance

- Password+TOTP Mystery Shopper frontend and backend run on the retained internal application VM
- APN clients reach NGINX on HTTPS `443` only
- backend `8011`, PostgreSQL and SSH are not APN-client surfaces
- the database remains in the current internal production environment

## 3) Proposed runtime shape

```text
APN-connected Shopper Device
  -> APN route -> HTTPS 443
Internal Mystery Application VM
  - nginx
  - Password+TOTP mystery frontend
  - mystery backend service
  -> restricted internal DB connection
Internal Production Database
```

## 4) Important design rules

- do not expose the internal dashboard on the APN application VM
- do not expose B2B or installation survey frontends on this VM
- do not expose PostgreSQL, SSH or backend `8011` to APN clients
- keep only the minimum shopper backend routes available through NGINX
- keep authentication implementation independent from internal Entra-only user flows
- no public FQDN, public IP, Internet NAT, WAF or Internet firewall publication is required
- use an internally trusted HTTPS certificate with named renewal ownership

### Authentication decision (DECIDED)

The APN Mystery Shopper instance uses **Password + TOTP** application 2FA.
APN connectivity is the selected network-access design.

- Full design and risks: `docs/architecture/MYSTERY_PUBLIC_AUTH_OPTIONS.md`
- Step-by-step build guide: `docs/architecture/MYSTERY_PUBLIC_2FA_IMPLEMENTATION.md`

**The test/staging VM must NOT use this authentication.** On the test VM the
Mystery Shopper frontend runs alongside the other internal frontends and is used
by internal Entra users — it keeps Entra. The new auth is gated by `AUTH_MODE`
(backend) and `VITE_AUTH_MODE` (frontend), both defaulting to `entra`. Only the
APN application-VM deployment sets `mystery_public`; the value identifies the
authentication mode, not public Internet exposure.

## 5) GitHub and CI/CD setup

### New workflow

Use:
- `.github/workflows/deploy-mystery-public.yml`

### New environment

Create a GitHub environment named:
- `mystery-public`

### Recommended runner labels

- `self-hosted`
- `linux`
- `mystery-public`

### Suggested runner name

- `cwscx-mystery-public-runner`

## 6) Required GitHub secrets

At minimum:

- `MYSTERY_PUBLIC_BASE_URL`
  - example: `https://mystery.example.com`

You may later add additional environment-specific secrets if the deployment process evolves.

## 7) Required VM baseline

The internal APN application VM should have:

- Ubuntu Linux
- nginx installed
- Python 3.11 or 3.12
- Node 20+
- git, curl, unzip, zip, rsync
- TLS certificate and key
- writable application directory
- network controls allowing HTTPS `443` only from approved APN sources

Current VM identity for setup tracking:
- Hostname: `cwscx-web01.cwsey.com`
- IP: `172.17.0.200`

## 8) Required directory layout on the APN application VM

Recommended:

```text
/opt/cwscx-mystery-public/
  backend/
  frontends-src/public/mystery-shopper/
  scripts/linux/
  releases/
  shared/
  .env
```

## 9) Required `.env` on the APN application VM

Path:

```text
/opt/cwscx-mystery-public/.env
```

This file should include:
- `ENVIRONMENT=production`
- `AUTH_MODE=mystery_public`  (APN application instance only — switches the app to Password + TOTP)
- `DATABASE_URL`
- `CORS_ALLOW_ORIGINS`
- `MYSTERY_AUTH_SECRET_KEY` (Fernet key for encrypting TOTP secrets at rest)
- `MYSTERY_SESSION_IDLE_MINUTES`, `MYSTERY_SESSION_ABSOLUTE_HOURS`,
  `MYSTERY_ENROLL_TOKEN_MINUTES`
- internal APN-reachable HTTPS base URL settings as needed
- no `ENTRA_*` values are required when `AUTH_MODE=mystery_public`

See `docs/architecture/MYSTERY_PUBLIC_2FA_IMPLEMENTATION.md` §5 for the full list.

## 10) Database connectivity

The database remains in the internal production environment.

That means infrastructure must allow:
- the APN application backend to reach the production database on the approved port

Recommended controls:
- allow only the specific application-VM source IP
- allow only the required DB port
- do not expose the DB to APN clients

## 11) NGINX shape on the APN application VM

The APN Mystery application VM should serve:

- `/` -> mystery shopper frontend
- `/api/*` -> mystery backend

It should not include internal dashboard routes.

## 12) What can be done now before auth decision

The following work is auth-agnostic and can be prepared immediately:

1. create the dedicated deploy workflow
2. retain deployment from the internal production runner over pinned SSH; do not add a runner to this VM
3. create `/opt/cwscx-mystery-public`
4. place TLS files on the VM
5. prepare nginx config for the APN Mystery frontend/backend only
6. prepare `.env` structure on the VM
7. retain restricted DB firewall access from the application VM to the internal production DB
8. add the GitHub environment and base URL secret

## 13) Auth decision — RESOLVED

The auth decision is closed: **Password + TOTP** (see
`docs/architecture/MYSTERY_PUBLIC_AUTH_OPTIONS.md`). What used to be blocked is
now fully specified in the build guide
(`docs/architecture/MYSTERY_PUBLIC_2FA_IMPLEMENTATION.md`):

- public authentication endpoints (`/api/auth/login`, `/api/auth/mfa`,
  `/api/auth/logout`, `/api/auth/enroll/*`, `/api/auth/recovery`)
- per-user account + server-side session model
- password (Argon2id), TOTP secret (encrypted at rest), recovery codes (hashed)
- login / MFA / enrolment / recovery screens
- idle + absolute session expiry, immediate suspension/revocation

All of it is gated by `AUTH_MODE` / `VITE_AUTH_MODE` so the test VM continues to
use Entra unchanged.

## 14) Verification checklist after first deploy

- frontend root page opens over HTTPS
- backend `/api/health` responds
- backend `/api/health/ready` responds
- APN frontend can call backend
- internal production deployment runner is online in GitHub
- release bundle archives on the application VM
- nginx config passes syntax test

## 15) Files introduced for this deployment path

- `.github/workflows/deploy-mystery-public.yml`
- `scripts/linux/build_mystery_public_bundle.sh`
- `scripts/linux/install_mystery_public_bundle.sh`
- `scripts/linux/deploy_mystery_public_backend.sh`
- `scripts/linux/deploy_mystery_public_nginx.sh`
- `scripts/linux/verify_mystery_public.sh`
