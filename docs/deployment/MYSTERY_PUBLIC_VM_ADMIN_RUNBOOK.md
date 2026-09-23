# Mystery Shopper APN Application-VM Admin Runbook

## Scope

Use this runbook on `cwscx-web01` after the release-readiness pull request is merged. The host remains an internal, non-public application VM reached through APN connectivity; it is not a public DMZ host. No public DNS, public IP, Internet NAT or WAF is required. Legacy `mystery_public` and `DMZ_*` identifiers remain compatibility names.

## Safety rules

- Do not print or copy `/opt/cwscx-mystery-public/.env` values.
- Do not run Alembic from the application VM. Shared-database migrations are owned by the internal production deployment.
- Do not expose backend port `8011`; it must listen only on `127.0.0.1`.
- Do not enable HSTS until the APN clients trust the installed certificate and renewal ownership is verified.
- Preserve `/opt/cwscx-mystery-public/.env`, `/shared`, and prior release directories.

## 0. One-time privileged entrypoint bootstrap

The `cxadmin` account never receives a broad sudoers grant. It is limited to
a single, fixed, root-owned command:
`/usr/local/sbin/cwscx-mystery-public-deploy`
(`scripts/linux/cwscx_mystery_public_deploy_entrypoint.sh`). The sudoers
rule names only that absolute path — it never grants `bash`, `sh`, or any
other interpreter, so `cxadmin` cannot use its NOPASSWD grant to run
arbitrary root commands.

Install or update this entrypoint (and its companion installer) with
`scripts/linux/bootstrap_mystery_public_deploy_entrypoint.sh`, run once by a
VM administrator and again only when that entrypoint/installer source
changes. The bootstrap script refuses to run against a checkout that is not
already owned by `root`:

```bash
sudo git clone --branch <reviewed-ref> <repo-url> /root/cwscx-mystery-public-src
cd /root/cwscx-mystery-public-src
sudo git log -1 --format='%H'   # record and compare against the reviewed commit
sudo install -o root -g root -m 0600 /root/reviewed-deploy-key.pub \
  /root/cwscx-mystery-public-deploy-signing-key.pub
sudo bash scripts/linux/bootstrap_mystery_public_deploy_entrypoint.sh
```

`reviewed-deploy-key.pub` must be the public key matching the existing
GitHub Environment secret `DMZ_SSH_KEY`. The workflow uses that private key
to create an SSH signature over the exact bundle. The root-owned entrypoint
verifies the signature against
`/etc/cwscx-mystery-public/deploy-allowed-signers` before any bundle content
is installed or executed. This prevents a local `cxadmin` session from
supplying an arbitrary bundle and matching caller-chosen checksum to gain
root code execution.

A checkout owned by the interactive `sudo` user (rather than `root`) is not
accepted, even though that user ran `sudo`: that account's files could be
replaced between review and install. If you must bootstrap from an existing
non-root checkout that has already been reviewed and is not concurrently
writable by anyone else, take ownership first so there is no window where
an unprivileged account still controls the source the bootstrap script
reads:

```bash
sudo chown -R root:root /path/to/checkout
sudo chmod -R go-w /path/to/checkout
sudo bash /path/to/checkout/scripts/linux/bootstrap_mystery_public_deploy_entrypoint.sh
```

Bootstrap also provisions the fixed, root-owned evidence directory
`/var/lib/cwscx-mystery-public/deploy-evidence` (mode `0755`). The deploy
entrypoint writes each run's verification evidence there as
`<release-id>.json`, mode `0644`, and never into `/tmp`: because only root
can write inside a `0755` root-owned directory, there is no window for
another account to plant or swap that file before the entrypoint (running
as root) writes it. The entrypoint never `chown`s evidence to `cxadmin` —
`0644` plus the `0755` directory is what lets `cxadmin` read it over SCP.
Evidence retention is bounded (newest 20 releases) rather than deleted
immediately after fetch, since deletion right after the workflow's SCP
would race a slow or retried fetch.

Verify the sudoers grant after bootstrapping:

```bash
sudo -l -U cxadmin
```

Expect exactly one NOPASSWD entry, for the fixed entrypoint path — nothing
naming `bash`, `sh`, `install_mystery_public_bundle.sh`, or any other script
directly.

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

The new release carries an offline Python wheelhouse; the application VM does not need public package-manager or PyPI access during deployment.

## 3. GitHub deployment prerequisites

The `mystery-public` GitHub Environment must contain:

- Secret `DMZ_SSH_KEY`: existing base64-encoded private deploy key.
- Secret `DMZ_SSH_KNOWN_HOSTS`: pinned OpenSSH known-hosts line for `172.17.0.200`.
- Secret `MYSTERY_PUBLIC_BASE_URL`: current internal HTTPS origin reachable through APN.
- Optional variable `MYSTERY_PUBLIC_TLS_MODE`: `prepublic` until the APN clients trust the certificate; then `trusted`. The name is retained for compatibility.

Generate the pinned host entry from an already trusted administrative path and compare its fingerprint on the VM:

```bash
sudo ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub
ssh-keyscan -t ed25519 172.17.0.200 > dmz-known-hosts
ssh-keygen -lf dmz-known-hosts
```

Only set the GitHub secret after the fingerprints match.

## 4. Deployment order

The shared database must reach the approved migration head before the APN application release verifies it.

1. Merge the reviewed PR to `main` after CI passes.
2. Run internal staging deployment and verify service, migration revision and behavior.
3. Run internal production deployment. Confirm `alembic current` equals `20260714_000032` before proceeding.
4. Trigger `deploy-mystery-public.yml` from `main`.
5. Download and retain the deployment evidence artifact.

Do not trigger the Mystery deployment first.

## 5. What the Mystery workflow performs

- Builds one immutable artifact on a hosted runner.
- Records full Git SHA, build time, frontend auth mode and expected migration head.
- Downloads all Python wheels before transfer to the application VM.
- Hashes the bundle and every bundled file.
- Uses a pinned SSH host key.
- SCPs only the release bundle to `/tmp` on the application VM, then makes
  exactly one privileged call over SSH: `sudo -n` against the fixed
  entrypoint `/usr/local/sbin/cwscx-mystery-public-deploy`. It does not
  upload the installer to `/tmp` and does not run any other `sudo`
  command — the entrypoint itself performs installation, backend deploy,
  NGINX deploy, and verification using fixed, root-owned scripts already
  present in the immutable release (see §0).
- Installs under `/opt/cwscx-mystery-public/releases/<release-id>`.
- Atomically changes `/opt/cwscx-mystery-public/current`.
- Preserves `.env`, shared data and prior releases.
- Binds Uvicorn to `127.0.0.1:8011`.
- Applies systemd hardening and NGINX rate limits/security headers.
- Performs read-only migration, database SSL, service, route and listener verification.
- Fetches verification evidence from the fixed, root-owned path
  `/var/lib/cwscx-mystery-public/deploy-evidence/<release-id>.json` over
  SCP and uploads it as a workflow artifact even when a deployment fails;
  it does not delete that evidence on the VM after fetching it.

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

After APN routing and certificate trust are confirmed, use a clearly labelled test shopper from an APN-connected device:

1. Internal administrator creates the test shopper and enrollment link.
2. External device opens the link and completes password plus TOTP setup.
3. Shopper signs in, creates a draft, completes and submits a test visit.
4. Internal dashboard confirms that exact visit in the review queue.
5. Test invalid login lockout, logout/session invalidation, recovery/re-enrollment and suspended-user denial.
6. Retire test records according to the operational data-cleanup procedure.

## 8. Rollback

Rollback means switching to a prior approved immutable release whose database/configuration contract is compatible. It does not mean re-enabling broad API routes, disabling MFA or restoring insecure network exposure.

Before rollback, record the active release and migration revision. Change the `current` symlink only to a verified prior release, restart backend, reload NGINX, and rerun the verifier. Database downgrade is not part of normal rollback.

## APN/networking handoff

Keep the network request limited to controls unavailable through VM admin:

- APN DNS/routing to the retained internal VM.
- Permitted APN client/source scope reaching HTTPS `443` only.
- No APN-client route to `8011`, PostgreSQL or SSH.
- Internally trusted certificate/CA chain and renewal ownership.
- Monitoring, alert, incident and user-support ownership.
- PostgreSQL server certificate/CA and hostname needed to progress from `sslmode=require` to `verify-full`.

All repository, backend binding, systemd, NGINX, immutable release, VM audit and deployment-evidence work is owned by the project/VM-admin side.
