# Mystery Shopper DMZ VM Admin Runbook

## Scope

Use this runbook on `cwscx-web01` after the release-readiness pull request is merged. It covers only work available through VM administrator access. It does not create public DNS, NAT, WAF or upstream firewall rules.

## Safety rules

- Do not print or copy `/opt/cwscx-mystery-public/.env` values.
- Do not run Alembic from the DMZ VM. Shared-database migrations are owned by the internal production deployment.
- Do not expose backend port `8011`; it must listen only on `127.0.0.1`.
- Do not enable HSTS until a client-trusted public certificate is installed and verified.
- Preserve `/opt/cwscx-mystery-public/.env`, `/shared`, and prior release directories.

## 1. Pre-deployment audit

From the repository, copy the audit script to the VM:

```bash
scp scripts/linux/audit_mystery_public_vm.sh cxadmin@172.17.0.200:/tmp/
ssh cxadmin@172.17.0.200
sudo bash /tmp/audit_mystery_public_vm.sh
```

Expected before the new immutable release:

- NGINX and the backend service are active.
- HTTPS `443` is listening.
- Existing backend `8011` may still show `0.0.0.0`; this is a release blocker that the new deployment corrects.
- Existing layout may not yet have `releases/` and `current`; those warnings are expected before the first immutable deployment.
- `.env` must exist with mode `600` or `640`.
- No secret values appear in the evidence file.

Preserve the generated JSON evidence. Do not edit the VM based only on an individual warning; complete the repository-controlled deployment first.

## 2. VM-admin prerequisites

Run read-only checks:

```bash
hostnamectl
ip -br address
ip route
df -hT / /opt
free -h
nproc
timedatectl status
command -v nginx python3 curl ss systemctl openssl sha256sum
sudo nginx -t
sudo systemctl status nginx --no-pager
sudo systemctl status cwscx-mystery-public-backend --no-pager
sudo ss -lntp '( sport = :443 or sport = :8011 or sport = :22 )'
```

Required before deployment:

- Python 3 with `venv` support is already installed.
- NGINX, curl, OpenSSL, systemd, `ss`, and SHA-256 tooling exist.
- `/opt/cwscx-mystery-public/.env` exists and is mode `600` or `640`.
- The VM can reach the internal database endpoint on TCP `5433`.
- The internal production runner can reach this VM on SSH `22`.

The new release carries an offline Python wheelhouse; the DMZ VM does not need public package-manager or PyPI access during deployment.

## 3. GitHub deployment prerequisites

The `mystery-public` GitHub Environment must contain:

- Secret `DMZ_SSH_KEY`: existing base64-encoded private deploy key.
- Secret `DMZ_SSH_KNOWN_HOSTS`: pinned OpenSSH known-hosts line for `172.17.0.200`.
- Secret `MYSTERY_PUBLIC_BASE_URL`: current HTTPS origin.
- Optional variable `MYSTERY_PUBLIC_TLS_MODE`: `prepublic` until trusted public TLS is installed; then `trusted`.

Generate the pinned host entry from an already trusted administrative path and compare its fingerprint on the VM:

```bash
sudo ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub
ssh-keyscan -t ed25519 172.17.0.200 > dmz-known-hosts
ssh-keygen -lf dmz-known-hosts
```

Only set the GitHub secret after the fingerprints match.

## 4. Deployment order

The shared database must reach the approved migration head before the DMZ release verifies it.

1. Merge the reviewed PR to `main` after CI passes.
2. Run internal staging deployment and verify service, migration revision and behavior.
3. Run internal production deployment. Confirm `alembic current` equals `20260714_000032` before proceeding.
4. Trigger `deploy-mystery-public.yml` from `main`.
5. Download and retain the deployment evidence artifact.

Do not trigger the Mystery deployment first.

## 5. What the Mystery workflow performs

- Builds one immutable artifact on a hosted runner.
- Records full Git SHA, build time, frontend auth mode and expected migration head.
- Downloads all Python wheels before entering the DMZ.
- Hashes the bundle and every bundled file.
- Uses a pinned SSH host key.
- Installs under `/opt/cwscx-mystery-public/releases/<release-id>`.
- Atomically changes `/opt/cwscx-mystery-public/current`.
- Preserves `.env`, shared data and prior releases.
- Binds Uvicorn to `127.0.0.1:8011`.
- Applies systemd hardening and NGINX rate limits/security headers.
- Performs read-only migration, database SSL, service, route and listener verification.
- Uploads installation and verification evidence even when a deployment fails.

## 6. Post-deployment VM checks

```bash
sudo ss -lntp '( sport = :443 or sport = :8011 or sport = :22 )'
sudo systemctl show cwscx-mystery-public-backend \
  -p ActiveState -p MainPID -p ActiveEnterTimestamp
sudo nginx -t
readlink -f /opt/cwscx-mystery-public/current
sudo bash /opt/cwscx-mystery-public/current/scripts/linux/audit_mystery_public_vm.sh
```

Required end state:

- Exactly one backend listener at `127.0.0.1:8011`.
- NGINX active on `443`.
- `current` resolves inside `/opt/cwscx-mystery-public/releases/`.
- Service restart timestamp is later than deployment start.
- Current database migration head equals the release manifest head.
- Database connection uses PostgreSQL SSL.
- `/api/health/ready` returns `200`.
- Anonymous `/api/auth/session` returns `401`.
- Security headers are present.

## 7. Functional acceptance

After IT enables the public edge, use a clearly labelled test shopper:

1. Internal administrator creates the test shopper and enrollment link.
2. External device opens the link and completes password plus TOTP setup.
3. Shopper signs in, creates a draft, completes and submits a test visit.
4. Internal dashboard confirms that exact visit in the review queue.
5. Test invalid login lockout, logout/session invalidation, recovery/re-enrollment and suspended-user denial.
6. Retire test records according to the operational data-cleanup procedure.

## 8. Rollback

Rollback means switching to a prior approved immutable release whose database/configuration contract is compatible. It does not mean re-enabling broad API routes, disabling MFA or restoring insecure network exposure.

Before rollback, record the active release and migration revision. Change the `current` symlink only to a verified prior release, restart backend, reload NGINX, and rerun the verifier. Database downgrade is not part of normal rollback.

## IT/networking-only handoff

Keep the IT request limited to controls unavailable through VM admin:

- Public FQDN and public DNS.
- NAT/load balancer/WAF or upstream firewall mapping Internet clients to DMZ HTTPS `443` only.
- No public route to `8011`, PostgreSQL or SSH.
- Publicly trusted certificate/CA chain and renewal ownership if centrally managed.
- Confirmation of upstream DDoS/abuse controls and external monitoring ownership.
- PostgreSQL server certificate/CA and hostname needed to progress from `sslmode=require` to `verify-full`.

All repository, backend binding, systemd, NGINX, immutable release, VM audit and deployment-evidence work is owned by the project/VM-admin side.
