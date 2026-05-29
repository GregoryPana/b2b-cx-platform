# Public Mystery Shopper DMZ Deployment Guide

This guide describes the new public deployment model for the Mystery Shopper survey.

## 1) Purpose

The Mystery Shopper survey will move to a separate public-facing VM in the DMZ.

Current target DMZ VM:
- Hostname: `cwscx-web01.cwsey.com`
- IP: `172.17.0.200`

This VM is intended for:
- external users
- non-organisational users
- no Microsoft Entra login dependency

This VM is not the same as the internal production VM used by the dashboard and other internal frontends.

## 2) New target model

### Internal environments remain

- mystery staging remains on the current internal staging environment for testing
- internal governance dashboard remains internal-only

### Public production changes

- public Mystery Shopper frontend and backend run on a dedicated DMZ VM
- the database remains in the current internal production environment

## 3) Proposed runtime shape

```text
External User Browser
  -> HTTPS
DMZ Mystery VM
  - nginx
  - public mystery frontend
  - mystery backend service
  - self-hosted GitHub runner
  -> restricted internal DB connection
Internal Production Database
```

## 4) Important design rules

- do not expose the internal dashboard on the DMZ VM
- do not expose B2B or installation survey frontends on the DMZ VM
- do not expose PostgreSQL publicly
- keep only the minimum public backend routes open
- keep authentication implementation independent from internal Entra-only user flows

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

The DMZ Mystery VM should have:

- Ubuntu Linux
- internet access to GitHub Actions control plane
- nginx installed
- Python 3.11 or 3.12
- Node 20+
- git, curl, unzip, zip, rsync
- TLS certificate and key
- writable application directory
- firewall allowing public `443` only unless explicitly approved otherwise

Current VM identity for setup tracking:
- Hostname: `cwscx-web01.cwsey.com`
- IP: `172.17.0.200`

## 8) Required directory layout on the DMZ VM

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

## 9) Required `.env` on the DMZ VM

Path:

```text
/opt/cwscx-mystery-public/.env
```

This file should include:
- `ENVIRONMENT=production`
- `DATABASE_URL`
- `CORS_ALLOW_ORIGINS`
- public base URL settings as needed
- future public Mystery auth settings once signed-link or OTP implementation is chosen

## 10) Database connectivity

The database remains in the internal production environment.

That means infrastructure must allow:
- the DMZ Mystery backend to reach the production database on the approved port

Recommended controls:
- allow only the specific DMZ VM source IP
- allow only the required DB port
- do not expose the DB publicly

## 11) NGINX shape on the DMZ VM

The public Mystery VM should serve:

- `/` -> mystery shopper frontend
- `/api/*` -> mystery backend

It should not include internal dashboard routes.

## 12) What can be done now before auth decision

The following work is auth-agnostic and can be prepared immediately:

1. create the dedicated deploy workflow
2. register the self-hosted runner on the DMZ VM
3. create `/opt/cwscx-mystery-public`
4. place TLS files on the VM
5. prepare nginx config for public mystery frontend/backend only
6. prepare `.env` structure on the VM
7. request DB firewall access from the DMZ VM to the internal production DB
8. add the GitHub environment and base URL secret

## 13) What is blocked on auth decision

These items depend on signed links vs OTP:

- public authentication endpoints
- invitation/session model
- token or OTP storage rules
- user access flow screens
- expiry and revocation behavior

If the hybrid signed-link-plus-OTP option is chosen, implementation must support both invitation-token lifecycle and OTP verification lifecycle handling.

## 14) Verification checklist after first deploy

- frontend root page opens over HTTPS
- backend `/api/health` responds
- backend `/api/health/ready` responds
- public frontend can call backend
- runner is online in GitHub
- release bundle archives on the DMZ VM
- nginx config passes syntax test

## 15) Files introduced for this deployment path

- `.github/workflows/deploy-mystery-public.yml`
- `scripts/linux/build_mystery_public_bundle.sh`
- `scripts/linux/install_mystery_public_bundle.sh`
- `scripts/linux/deploy_mystery_public_backend.sh`
- `scripts/linux/deploy_mystery_public_nginx.sh`
- `scripts/linux/verify_mystery_public.sh`
