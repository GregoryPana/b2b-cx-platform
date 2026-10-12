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

Install or update this entrypoint (and its companion installer and signed-
archive guard) with
`scripts/linux/bootstrap_mystery_public_deploy_entrypoint.sh`, run once by a
VM administrator and again only when the entrypoint, installer, or release-guard
source changes. The bootstrap script refuses to run against a checkout that is not
already owned by `root`:

After a source fix to the entrypoint, merging the PR and rerunning the
workflow alone is not enough: the workflow calls the previously installed
root-owned `/usr/local/sbin/cwscx-mystery-public-deploy`. The VM administrator
must re-run this bootstrap from the exact reviewed commit before a retry.
The failed 2026-09-24 run `35974691718` passed sudo/signature checks but
stopped before installation because the installed entrypoint assigned a
readonly `TARGET_ROOT` variable; it did not activate a new release.

```bash
sudo git clone --branch <reviewed-ref> <repo-url> /root/cwscx-mystery-public-src
cd /root/cwscx-mystery-public-src
sudo git log -1 --format='%H'   # record and compare against the reviewed commit
sudo install -o root -g root -m 0600 /root/reviewed-release-signing-key.pub \
  /root/cwscx-mystery-public-release-signing-key.pub
sudo bash scripts/linux/bootstrap_mystery_public_deploy_entrypoint.sh
```

`reviewed-release-signing-key.pub` must match the dedicated GitHub Environment
secret `MYSTERY_PUBLIC_RELEASE_SIGNING_KEY`. It must not be the public half of
`DMZ_SSH_KEY`: SSH authenticates transport only, while the release key signs
the exact bundle and a separate, short-lived operation document. The root-owned
entrypoint verifies both namespaces against
`/etc/cwscx-mystery-public/release-allowed-signers` before changing state.
The operation binds the action, target release and bundle hash, live current
release, base URL, TLS mode, GitHub run ID/attempt, five-minute expiry and a
random nonce. Used nonces are retained under root-only
`/var/lib/cwscx-mystery-public/operation-nonces`, so copying a prior workflow
command or signature cannot authorize a local or replayed rollback.

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

Bootstrap also creates the only new runtime namespace used by this recovery
path: `/var/lib/cwscx-mystery-public/application-archives`, root-owned mode
`0700`. Each successful release is retained in an atomically published
`<release-id>/` directory containing the exact signed `bundle.zip`, detached
`bundle.zip.sig`, canonical `bundle.zip.sha256`, and root-owned `metadata.json`.
Readers can therefore never observe a partially published four-file archive.
Failed releases are never archived as rollback candidates. Normal
retention is three signed archives with a 10 GiB free-space reserve; the active
release, immediately previous release, and any archive carrying a root-created
`<release-id>.pinned` marker are never pruned.

The first successful GitHub-controlled deployment additionally creates the
root-owned `baseline-release-id` marker only after readiness and exact installed-
bundle verification pass and the signed archive verifies locally. The existing
manually repaired release is never imported, signed, archived, or treated as an
approved fallback by this process.

Bootstrap validates every source ancestor as root-owned and non-writable,
opens each source with `O_NOFOLLOW`, and installs the entrypoint, installer and
guard only from one root-only snapshot. It records a SHA-256 suite identity;
read-only status reports that identity, and every workflow operation refuses to
continue unless it matches the exact three privileged sources in the reviewed
GitHub revision.

The bootstrap also converts the legacy mutable application root to the
reviewed ownership boundary observed on this VM: `/opt/cwscx-mystery-public`
becomes `root:root 0755`, `.env` becomes `root:root 0600`, and `releases/`
becomes `root:root 0755`. Only `shared/` remains service-writable as
`cxadmin:www-data 0770`. This does not restart the running legacy process;
the next signed deployment switches the service to the new root-controlled
immutable release and changes backend binding from the observed
`0.0.0.0:8011` to `127.0.0.1:8011`.

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
uname -m
python3 --version
( probe="$(mktemp -d /tmp/cwscx-venv-probe.XXXXXX)"; trap 'rm -rf -- "$probe"' EXIT; python3 -m venv "$probe/venv" && "$probe/venv/bin/python" -m pip --version )
timedatectl status
command -v nginx python3 curl ss systemctl openssl sha256sum
sudo nginx -t
sudo systemctl status nginx --no-pager
sudo systemctl status cwscx-mystery-public-backend --no-pager
sudo ss -lntp '( sport = :443 or sport = :8011 or sport = :22 )'
```

Required before deployment:

- The VM is `x86_64` with Python 3.12 and working `venv` support; the offline
  wheelhouse contains native x86-64 wheels and is smoke-installed against
  Python 3.12 on the build runner. Stop if the VM differs.
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
- Secret `MYSTERY_PUBLIC_RELEASE_SIGNING_KEY`: base64-encoded private signing
  key matching the separately installed root-owned release public key. It must
  be different from `DMZ_SSH_KEY`; never reuse the SSH transport key.
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
4. For the one-time clean rollout, trigger `deploy-mystery-public.yml` from
   `main`, select `establish_baseline`, enter the exact current release ID shown
   by read-only status, and leave fallback/rollback fields empty. After that
   succeeds, all later releases use `deploy` with the current approved signed
   fallback release ID.
5. Download and retain the deployment evidence artifact.

The workflow first checks `sudo -n -l` on the VM. It fails before bundle
transfer if the fixed deploy entrypoint is absent or any other passwordless
grant remains. A VM administrator must validate the fixed entrypoint and
remove the superseded broad `cxadmin-deploy` sudoers rule with `visudo`
before retrying; a failed preflight is not permission to relax the rule.

Do not trigger the Mystery deployment first.

## 5. What the Mystery workflow performs

- Builds one immutable artifact on a hosted runner.
- Records full Git SHA, build time, frontend auth mode and expected migration head.
- Downloads all Python wheels before transfer to the application VM.
- Hashes the bundle and every bundled file.
- Uses a pinned SSH host key.
- Reads the VM's real current release immediately before authorization. The
  one-time baseline input must exactly match that release. For a
  rollback, it also reads and verifies the selected local target archive and
  binds that exact archive hash into the signed request.
- Compares the installed privileged-suite identity returned by status with the
  entrypoint, installer and guard in the checked-out GitHub revision; a stale or
  mixed VM bootstrap fails before transfer or activation.
- Creates canonical JSON with a five-minute expiry and one-time nonce, signs it
  in the operation namespace, and signs fresh deploy bundles in the distinct
  release namespace using `MYSTERY_PUBLIC_RELEASE_SIGNING_KEY`.
- SCPs only the signed release bundle (for deploy) and signed operation
  document to validated `/tmp` filenames on the application VM. All privileged
  calls use `sudo -n` against the fixed entrypoint
  `/usr/local/sbin/cwscx-mystery-public-deploy`; status calls are read-only and
  each dispatch makes exactly one state-changing signed-operation call. It does not
  upload the installer to `/tmp` and does not run any other `sudo`
  command — the entrypoint itself performs installation, backend deploy,
  NGINX deploy, and verification using fixed, root-owned scripts already
  present in the immutable release (see §0).
- Installs under `/opt/cwscx-mystery-public/releases/<release-id>`.
- Before switching `current`, grants `www-data` read/traverse access only to the release root and its `backend`/`frontends` trees (retaining root ownership and no group write), then checks effective access as `cxadmin:www-data` and `www-data`. `.env` and shared data are untouched. A failed access check leaves `current` unchanged.
- Atomically changes `/opt/cwscx-mystery-public/current`.
- Preserves `.env`, shared data and prior releases.
- Keeps normal deploy fail-closed: its named fallback must be current and have
  a valid local signed archive plus matching installed files. The separate
  `establish_baseline` operation is allowed exactly once, only while the archive
  directory is empty and the current release is not already authenticated. It
  installs the new bundle without activation, verifies installed files and
  database compatibility read-only, then switches and runs the full readiness
  checks. Only that successful new artifact becomes the first baseline.
- Checks live database heads read-only. Normal deploy checks both the new and
  fallback manifests; first-baseline checks the newly installed release before
  switching. Exact head equality is required; no migration, downgrade,
  database backup or database restore is performed by this workflow.
- After installation, re-hashes every signed application file on disk before
  restart. For normal deploy, backend, NGINX or verification failure restores
  and verifies the authenticated fallback. Before every symlink switch, the
  entrypoint atomically writes and fsyncs a root-only
  `/var/lib/cwscx-mystery-public/active-operation.json` journal. EXIT/HUP/INT/TERM
  use it immediately; SIGKILL or power loss leaves it in place. Read-only status
  reports `recovery_required` and the exact pending transaction but never changes
  state. While a journal exists, deploy/rollback/baseline operations fail closed;
  only the separate protected, signed `recover` workflow action can reconcile it.
  Signed-release recovery re-authenticates and activates the archived fallback.
- The first-baseline operation has no authenticated fallback. Immediately before
  its first switch, the entrypoint snapshots the existing root-owned systemd and
  NGINX configuration into root-only state. The snapshot records exact
  presence/absence for the generated rate-limit and security-header fragments;
  they are optional on the legacy origin. A post-switch failure restores files
  that originally existed and removes generated fragments that were originally
  absent, then validates and reloads NGINX. All snapshot reads and recovery
  writes are descriptor-anchored, reject symlinks, and are fsynced before the
  recovery journal can be cleared. Recovery uses only fixed commands in the
  root-owned entrypoint (`systemctl`, `nginx`, and `curl`). It never
  invokes `deploy_mystery_public_backend.sh`, `deploy_mystery_public_nginx.sh`,
  `verify_mystery_public.sh`, or any other script from the unsigned old release
  as root. The old release remains unverified and is never signed, archived, or
  advertised as a rollback target.
- After successful verification only, stores the exact signed bundle locally
  and applies bounded retention (three archives, 10 GiB minimum free reserve,
  never pruning current/previous/pinned archives).
- The generated backend unit sets `PGSSLCERTMODE=disable` to avoid libpq probing an absent optional client certificate behind `ProtectHome=yes`; the required `DATABASE_URL` SSL mode remains `require`, `verify-ca` or `verify-full`. This does not prove PostgreSQL server identity; plan CA and `verify-full` separately.
- Binds Uvicorn to `127.0.0.1:8011`.
- Applies systemd hardening and NGINX rate limits/security headers.
- Performs read-only migration, database SSL, service, route and listener verification.
- Fetches verification evidence from the fixed, root-owned path
  `/var/lib/cwscx-mystery-public/deploy-evidence/<release-id>.json` over
  SCP and uploads it as a workflow artifact even when a deployment fails;
  failed verification evidence is made mode `0644` before recovery so it remains
  fetchable, and it is not deleted from the VM after fetching it.

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
- Current database migration head equals both the release manifest head and the installed Alembic source head. The new signed release is checked against the live database **before** `current` changes; this application workflow never migrates the shared database.
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

## 8. GitHub-authorized rollback and current release hold

Rollback means switching to a prior approved immutable release whose database/configuration contract is compatible. It does not mean re-enabling broad API routes, disabling MFA or restoring insecure network exposure. **The two releases currently listed on `cwscx-web01` both came from failed runs; neither is a verified rollback target. Do not trigger another signed deployment on the strength of the permission fix alone.**

Use the same manual workflow from `main`, select `rollback`, leave the deploy
fallback field empty, and provide the approved rollback release ID. The
protected `mystery-public` GitHub Environment records approval. **There is no
local rollback authorization path.** `cxadmin` may run the read-only
`--action status` command, including a validated release ID lookup, but direct
`--action rollback`, unsigned operation documents, expired documents and reused
nonces are rejected. An emergency still requires an approved protected-
environment workflow dispatch; a VM administrator must not bypass the gate.

The workflow reads the VM's actual `current` release ID and SHA before signing
and records before/after JSON. `/health/ready` reports a Git SHA, not the full
release ID or deployment history; Git branch names are not runtime identity.
The fixed entrypoint accepts only validated temporary operation/signature and,
for deploy, bundle/signature paths; it accepts no arbitrary path or shell
command. Status authenticates the selected archive independently of whether its
installed release directory still exists, and reports the signed archive hash,
verification timestamp/status, and `installed_release_present`. Rollback first
verifies that archive and the operation-bound hash. If the installed directory
is absent, the fixed root-owned installer recreates it from the exact archived
zip, builds its virtualenv solely from the archived offline wheelhouse, checks
service-user file access, and leaves `current` unchanged. The entrypoint then
re-verifies every signed installed file and checks exact live migration-head
compatibility read-only through the restored target virtualenv before switching.
If the directory exists but fails verification, rollback fails closed rather
than overwriting it. It also authenticates the current release so a failed or
interrupted post-switch activation restores and verifies the original release
automatically. `.env`, `shared/`, and the database are never modified by archive
restoration. Database downgrade, backup and restore are explicitly out of scope.

The current recovered release cannot be assumed to have a qualifying local
archive merely because readiness is healthy. Neither failed-run directory may
be marked `deploy_verified`, imported, pinned, or promoted as a shortcut. Use
the protected one-time `establish_baseline` action to make the first newly built,
signed, installed and readiness-verified release the baseline. Until that action
succeeds, normal deploy and rollback remain fail-closed.

If read-only status reports `"recovery_required": true`, do not delete the
journal, edit `current`, rerun baseline/deploy, or promote the visible release.
Trigger the protected `recover` action from `main` with all release-ID inputs
blank. The workflow signs the journal-reported origin, current release and
recovery checksum, and the root entrypoint then either restores the authenticated
fallback or performs fixed-command first-baseline origin restoration. It verifies
operational health before deleting the journal. A power loss after all baseline
verification/archive gates but before journal cleanup is finalized only when the
root-owned baseline marker and authenticated archive both prove that the commit
point was reached. In that committed case recovery keeps the new baseline,
re-runs its backend/NGINX activation and full readiness verifier, and emits a
fresh `recovery-<release-id>.json`; the workflow accepts the authenticated
committed release rather than incorrectly requiring the legacy origin. Every
recovery workflow run fetches that exact recovery evidence before declaring
success.

The recovery path never edits `.env`; bootstrap changes only its ownership/mode.
This matters for the VM-only legacy origin: restarting its snapshotted unit still
uses the existing `/opt/cwscx-mystery-public/.env`. The signed
`establish_baseline` operation now fails closed before installing or switching
unless all of the following are true: the legacy release, systemd
`WorkingDirectory`, and `ExecStart` launcher resolve inside the exact current
release; their ownership/modes are root-controlled; `cxadmin:www-data` can
traverse the working directory and execute the launcher; the unit declares the
fixed `.env`; and an actual pre-switch restart returns to `/health/ready` with
valid NGINX configuration. This restart uses fixed system commands and never
runs a script from the unsigned legacy release as root.

A VM administrator must first capture these **read-only** checks (do not read or
print the environment file contents):

```bash
current="$(readlink -f /opt/cwscx-mystery-public/current)"
sudo systemctl show cwscx-mystery-public-backend \
  -p User -p Group -p FragmentPath -p WorkingDirectory -p ExecStart -p EnvironmentFiles
sudo namei -l /opt/cwscx-mystery-public/current
sudo namei -l "$current"
sudo stat -c '%U:%G %a %n' /opt/cwscx-mystery-public \
  /opt/cwscx-mystery-public/releases "$current" \
  /opt/cwscx-mystery-public/.env
sudo nginx -t
sudo systemctl is-active cwscx-mystery-public-backend nginx
curl -fsS http://127.0.0.1:8011/health/ready >/dev/null
```

Compare `WorkingDirectory` and the `path=` entry in `ExecStart` to `$current`;
both must resolve beneath it. Confirm `User=cxadmin`, `Group=www-data`,
`EnvironmentFiles` names the fixed `.env`, every shown parent is non-writable by
group/world, and `.env` is mode `600` or `640`. These checks are reconnaissance,
not restart proof; the protected baseline operation performs the controlled
restart proof immediately before installation. If any property is absent,
indirect, outside the current release, not root-controlled, or cannot be
confirmed without exposing a secret, stop and obtain VM-admin review rather
than bypassing the gate. `.env`, `shared/`, and the database remain outside all
recovery operations, and no migration/downgrade is attempted.

## 9. Credential-rotation control (not yet executed)

Rotation is an **independent cutover gate**, not evidence that a release is healthy. The VM administrator and credential owners must record an approved inventory (names, owners, expiry/revocation dates, dependencies and restore path; **never values**) for: GitHub Environment `DMZ_SSH_KEY`, `DMZ_SSH_KNOWN_HOSTS`, `MYSTERY_PUBLIC_RELEASE_SIGNING_KEY`, the VM's root-owned release allowed-signers file, the application `.env` database credential and `MYSTERY_AUTH_SECRET_KEY`, SMTP credentials if configured, and the APN TLS certificate/private key. Confirm any shared internal-production use of DB/SMTP credentials before changing them.

1. Prepare new identities in the approved secret store and obtain separate GitHub Environment/VM-admin approval. Keep private material out of git, workflow artifacts, terminal capture and handoffs. Verify the release signing key is distinct from the SSH transport key. Record fingerprints and secret version identifiers only.
2. Stage access overlap before revoking old identities. For SSH transport, install and independently verify the new VM authorized key and pinned host key from a trusted administrative channel, test the exact non-interactive runner login and narrow `sudo -n -l`, then change GitHub Environment secrets. Do not trust `ssh-keyscan` without a VM-side fingerprint comparison.
3. For release signing, VM admin must stage the existing trusted public key as root-owned `/root/cwscx-mystery-public-previous-release-signing-key.pub` and the newly approved key as `/root/cwscx-mystery-public-release-signing-key.pub` before running the reviewed bootstrap. The bootstrap checks that the former key is already trusted, publishes both keys atomically, and refuses publication if the proposed signer set cannot authenticate every retained archive. Verify old-archive rollback eligibility and a new-key operation signature offline; do not dispatch a deployment merely to test rotation. Keep the previous-key file in place through the approved overlap. Removing it and re-running bootstrap is permitted only after a newly signed healthy fallback and recovery drill exist **and no retained archive requires the old signer**; otherwise bootstrap fails closed. This was rehearsed in a disposable container, not on the application VM.
4. For database credentials, arrange overlap or a coordinated maintenance window with the database owner and internal-production owner; update only the approved stores and VM environment under VM-admin control. Validate the actual application connection and read-only exact Alembic heads after controlled restart. Do not run migrations here. Revoke the old DB identity only after both internal and APN services are confirmed working.
5. **Do not simply replace `MYSTERY_AUTH_SECRET_KEY`.** `backend/app/api/mystery_auth.py` uses it to decrypt stored shopper TOTP secrets; a replacement without a reviewed re-encryption/key-version or account re-enrollment plan can lock out users. Require a tested backup, rollback and session/recovery impact plan before any rotation. SMTP and TLS renewals similarly need owner-coordinated verification, including APN-device certificate trust.
6. Record approver, scope, fingerprints/version IDs, timed overlap, negative checks on revoked credentials, readiness/auth flow evidence, and rollback decision in the operations handover. Rotation is incomplete until old access is demonstrably revoked and dependent services are verified. Do not put a value or a decrypted connection string in the evidence.

**Current status:** procedure documented, inventory/owners and actual secret-store, VM and APN-device rotation remain to be confirmed by their owners. This runbook authorizes no credential change.

## APN/networking handoff

Keep the network request limited to controls unavailable through VM admin:

- APN DNS/routing to the retained internal VM.
- Permitted APN client/source scope reaching HTTPS `443` only.
- No APN-client route to `8011`, PostgreSQL or SSH.
- Internally trusted certificate/CA chain and renewal ownership.
- Monitoring, alert, incident and user-support ownership.
- PostgreSQL server certificate/CA and hostname needed to progress from `sslmode=require` to `verify-full`.

All repository, backend binding, systemd, NGINX, immutable release, VM audit and deployment-evidence work is owned by the project/VM-admin side.
