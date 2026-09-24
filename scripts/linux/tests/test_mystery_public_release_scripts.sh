#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
failures=0

require() { grep -Fq -- "$2" "$1" && printf '[PASS] %s\n' "$3" || { printf '[FAIL] %s\n' "$3" >&2; failures=$((failures+1)); }; }
forbid() { ! grep -Fq -- "$2" "$1" && printf '[PASS] %s\n' "$3" || { printf '[FAIL] %s\n' "$3" >&2; failures=$((failures+1)); }; }
count_exactly() {
  local file="$1" needle="$2" expected="$3" desc="$4" n
  n="$(grep -Fc -- "$needle" "$file" || true)"
  [[ "${n}" -eq "${expected}" ]] && printf '[PASS] %s\n' "$desc" \
    || { printf '[FAIL] %s (found %s, expected %s)\n' "$desc" "$n" "$expected" >&2; failures=$((failures+1)); }
}

BUILD="$ROOT/scripts/linux/build_mystery_public_bundle.sh"
INSTALL="$ROOT/scripts/linux/install_mystery_public_bundle.sh"
BACKEND="$ROOT/scripts/linux/deploy_mystery_public_backend.sh"
NGINX="$ROOT/scripts/linux/deploy_mystery_public_nginx.sh"
VERIFY="$ROOT/scripts/linux/verify_mystery_public.sh"
ENTRYPOINT="$ROOT/scripts/linux/cwscx_mystery_public_deploy_entrypoint.sh"
BOOTSTRAP="$ROOT/scripts/linux/bootstrap_mystery_public_deploy_entrypoint.sh"
WORKFLOW="$ROOT/.github/workflows/deploy-mystery-public.yml"

require "$BUILD" 'release-manifest.json' 'bundle includes release manifest'
require "$BUILD" 'expected_migration_heads' 'manifest records expected migration heads'
require "$BUILD" 'pip download' 'bundle builds offline wheelhouse'
require "$BUILD" 'sys.version_info[:2] == (3, 12)' 'bundle refuses an incompatible offline wheelhouse Python'
require "$BUILD" 'wheelhouse-smoke/bin/python' 'build tests offline wheel installation before release transfer'
require "$WORKFLOW" 'python-version: "3.12"' 'workflow builds the wheelhouse with VM-compatible Python 3.12'
require "$BUILD" 'SHA256SUMS' 'bundle records file hashes'
require "$INSTALL" 'releases/${RELEASE_ID}' 'installer uses immutable release directory'
require "$INSTALL" 'mv -Tf' 'installer switches current symlink atomically'
require "$INSTALL" '--no-index' 'installer installs Python dependencies offline'
require "$INSTALL" 'EXPECTED_BUNDLE_SHA256' 'installer verifies outer bundle checksum'
require "$BACKEND" '--host 127.0.0.1 --port 8011' 'DMZ backend binds loopback only'
forbid "$BACKEND" 'alembic" upgrade' 'DMZ backend never runs shared migrations'
require "$BACKEND" 'NoNewPrivileges=true' 'systemd prevents privilege escalation'
require "$BACKEND" 'ProtectSystem=strict' 'systemd protects filesystem'
require "$BACKEND" 'mktemp /tmp/cwscx-mystery-public-backend.XXXXXX.service' 'backend validates a temporary file with a valid systemd unit suffix'
if command -v systemd-analyze >/dev/null 2>&1; then
  # Exercise the exact filename template, not just a textual source assertion.
  UNIT_FILE="$(mktemp /tmp/cwscx-mystery-public-backend.XXXXXX.service)"
  printf '[Service]\nExecStart=/usr/bin/true\n' >"${UNIT_FILE}"
  if systemd-analyze verify "${UNIT_FILE}" >/dev/null 2>&1; then
    printf '[PASS] systemd accepts the backend temporary unit filename\n'
  else
    printf '[FAIL] systemd rejects the backend temporary unit filename\n' >&2
    failures=$((failures+1))
  fi
  rm -f -- "${UNIT_FILE}"
fi
require "$NGINX" 'limit_req_zone' 'NGINX defines request rate limits'
require "$NGINX" 'limit_conn_zone' 'NGINX defines connection limits'
require "$NGINX" 'Content-Security-Policy' 'NGINX sends CSP'
require "$NGINX" 'proxy_pass http://127.0.0.1:8011' 'NGINX proxies only to loopback backend'
require "$VERIFY" 'VERIFY_TLS_MODE' 'verifier distinguishes prepublic/trusted TLS'
require "$VERIFY" 'expected_migration_heads' 'verifier compares migration heads read-only'
require "$VERIFY" '127.0.0.1:8011' 'verifier checks loopback listener'
require "$VERIFY" 'EVIDENCE_FILE' 'verifier emits machine-readable evidence'

# --- Deploy entrypoint: no evidence in /tmp, single privileged surface -----
forbid "$ENTRYPOINT" '--evidence-path' 'entrypoint does not accept a caller-controlled evidence path'
require "$ENTRYPOINT" 'EVIDENCE_ROOT="${STATE_ROOT}/deploy-evidence"' 'entrypoint writes evidence under a fixed root-owned directory, not /tmp'
require "$ENTRYPOINT" 'EVIDENCE_ROOT_OWNER}" == "root"' 'entrypoint requires the evidence root to be root-owned'
require "$ENTRYPOINT" '8#${EVIDENCE_ROOT_MODE} & 8#022' 'entrypoint rejects a group/world-writable evidence root'
require "$ENTRYPOINT" 'release-manifest.json' 'entrypoint derives the evidence filename from the installed release manifest, not a caller argument'
require "$ENTRYPOINT" 'EVIDENCE_RETAIN_COUNT' 'entrypoint bounds evidence retention'
require "$ENTRYPOINT" 'INCOMING_ROOT="${STATE_ROOT}/incoming"' 'entrypoint stages bundles in a fixed root-owned directory'
require "$ENTRYPOINT" 'install -o root -g root -m 0600' 'entrypoint copies the caller bundle into root-owned storage before verification'
require "$ENTRYPOINT" 'sha256sum -- "${ROOT_BUNDLE}"' 'entrypoint verifies the root-owned bundle copy'
require "$ENTRYPOINT" 'ssh-keygen' 'entrypoint requires cryptographic bundle-signature verification'
require "$ENTRYPOINT" '-Y verify' 'entrypoint verifies the CI bundle signature'
require "$ENTRYPOINT" 'deploy-allowed-signers' 'entrypoint uses a fixed root-owned allowed-signers file'
require "$ENTRYPOINT" 'bundle signature is not authorized' 'entrypoint fails closed on an unauthorized bundle signature'
require "$ENTRYPOINT" 'explicitly so `set -e` does not terminate after valid input' 'entrypoint path validator returns success for secure input'
require "$ENTRYPOINT" 'current release resolves outside the immutable releases directory' 'entrypoint rejects a current symlink outside releases'
require "$ENTRYPOINT" 'verification did not produce fresh evidence' 'entrypoint requires fresh verifier evidence'
require "$ENTRYPOINT" 'require_root_controlled_dir "${TARGET_ROOT}" "target root"' 'entrypoint rejects a deployment-user-writable target root'
require "$ENTRYPOINT" 'export TARGET_ROOT' 'entrypoint exports fixed target root to children without reassigning readonly variable'
forbid "$ENTRYPOINT" 'TARGET_ROOT="${TARGET_ROOT}"' 'entrypoint never assigns readonly target root in child command prefix'
require "$ENTRYPOINT" 'require_root_controlled_dir "${CURRENT_REAL}" "current release directory"' 'entrypoint requires the active immutable release to remain root-controlled'
require "$ENTRYPOINT" 'environment file must be root-owned' 'entrypoint requires root ownership of the secret-bearing environment file'
forbid "$ENTRYPOINT" 'DEPLOY_UID' 'entrypoint never chowns evidence to the deploy user'
require "$ENTRYPOINT" 'chmod 0644 -- "${EVIDENCE_FILE}"' 'entrypoint makes final evidence world-readable for SCP fetch'
require "$ENTRYPOINT" '"${BASH_BIN}" "${BACKEND_SCRIPT}"' 'entrypoint invokes the backend deploy script via a fixed interpreter, not the extracted exec bit'
require "$ENTRYPOINT" '"${BASH_BIN}" "${NGINX_SCRIPT}"' 'entrypoint invokes the NGINX deploy script via a fixed interpreter'
require "$ENTRYPOINT" '"${BASH_BIN}" "${VERIFY_SCRIPT}"' 'entrypoint invokes the verifier via a fixed interpreter'
require "$ENTRYPOINT" 'never grants bash' 'entrypoint documents that sudoers grants only this fixed path, never bash'

# --- Bootstrap: source must be root-owned, evidence directory provisioned --
forbid "$BOOTSTRAP" 'expected_owner' 'bootstrap no longer accepts a SUDO_USER-owned source as an alternative to root'
require "$BOOTSTRAP" 'must be owned by root' 'bootstrap fails closed unless entrypoint/installer source is root-owned'
require "$BOOTSTRAP" 'install -d -o root -g root -m 0755 "${EVIDENCE_ROOT}"' 'bootstrap provisions the fixed, root-owned evidence directory'
require "$BOOTSTRAP" 'install -d -o root -g root -m 0700 "${INCOMING_ROOT}"' 'bootstrap provisions a root-only incoming directory'
require "$BOOTSTRAP" 'cwscx-mystery-public-deploy-signing-key.pub' 'bootstrap requires a root-owned deployment signing public key'
require "$BOOTSTRAP" 'deploy-allowed-signers' 'bootstrap installs a root-owned SSH allowed-signers file'
require "$BOOTSTRAP" 'chown root:root "${TARGET_ROOT}"' 'bootstrap transfers the legacy application root to root ownership'
require "$BOOTSTRAP" 'chmod 0755 "${TARGET_ROOT}"' 'bootstrap removes deployment-user write access from the application root'
require "$BOOTSTRAP" 'chown root:root "${ENV_FILE}"' 'bootstrap transfers the environment file to root ownership'
require "$BOOTSTRAP" 'chmod 0600 "${ENV_FILE}"' 'bootstrap restricts the secret-bearing environment file'
require "$BOOTSTRAP" 'install -d -o "${DEPLOY_USER}" -g "${SERVICE_GROUP}" -m 0770 "${SHARED_ROOT}"' 'bootstrap preserves a separate service-writable shared directory'
require "$BOOTSTRAP" 'explicitly so `set -e` callers do not treat a secure file as failure' 'bootstrap ownership validator returns success for secure files'
require "$BOOTSTRAP" 'Administrator procedure' 'bootstrap documents the root-owned checkout procedure'
require "$BOOTSTRAP" '${DEPLOY_USER} ALL=(root) NOPASSWD: ${ENTRYPOINT_DST}' 'bootstrap grants only the fixed entrypoint through sudoers'
forbid "$BOOTSTRAP" 'NOPASSWD: /usr/bin/bash' 'bootstrap never grants passwordless bash'

# --- Workflow: exactly one privileged call, no /tmp installer upload -------
require "$WORKFLOW" "github.ref == 'refs/heads/main'" 'workflow is main-only'
require "$WORKFLOW" 'cancel-in-progress: false' 'workflow serializes production deploys'
require "$WORKFLOW" 'StrictHostKeyChecking=yes' 'workflow pins SSH host identity'
require "$WORKFLOW" 'actions/upload-artifact@v4' 'workflow uploads release/deploy evidence'
forbid "$WORKFLOW" 'apt-get install' 'workflow performs no per-deploy apt install'
forbid "$WORKFLOW" 'install_mystery_public_bundle.sh' 'workflow no longer uploads the installer to /tmp'
require "$WORKFLOW" 'sudo -n /usr/local/sbin/cwscx-mystery-public-deploy' 'workflow invokes the fixed entrypoint non-interactively'
require "$WORKFLOW" 'python3 scripts/linux/check_mystery_deploy_sudo.py' 'workflow checks VM sudo privileges before transferring the bundle'
require "$WORKFLOW" "printf -v REMOTE_DEPLOY_CMD '%q '" 'workflow shell-quotes every remote entrypoint argument'
require "$WORKFLOW" 'ssh-keygen -Y sign' 'workflow signs the immutable bundle with the deployment key'
require "$WORKFLOW" '--signature-path' 'workflow passes the detached signature to the fixed entrypoint'
count_exactly "$WORKFLOW" 'sudo -n' 2 'workflow uses one read-only sudo listing and one fixed deployment command'
forbid "$WORKFLOW" 'deploy_mystery_public_backend.sh' 'workflow does not call the backend deploy script directly'
forbid "$WORKFLOW" 'deploy_mystery_public_nginx.sh' 'workflow does not call the NGINX deploy script directly'
forbid "$WORKFLOW" '/opt/cwscx-mystery-public/current/scripts/linux/verify_mystery_public.sh' 'workflow does not call the verifier directly'
require "$WORKFLOW" '/var/lib/cwscx-mystery-public/deploy-evidence/' 'workflow fetches evidence from the fixed root-owned path'

for file in "$BUILD" "$INSTALL" "$BACKEND" "$NGINX" "$VERIFY" "$ENTRYPOINT" "$BOOTSTRAP"; do
  bash -n "$file" || { printf '[FAIL] shell syntax: %s\n' "$file" >&2; failures=$((failures+1)); }
done

# GitHub has already parsed this workflow before starting this job. Keep
# dependency-free assertions here so the deployment gate does not require PyYAML.
require "${WORKFLOW}" "permissions:" "workflow declares permissions"
require "${WORKFLOW}" "contents: read" "workflow limits repository contents to read"
require "${WORKFLOW}" "timeout-minutes: 30" "workflow bounds job runtime"

(( failures == 0 )) || { printf '%d contract checks failed\n' "$failures" >&2; exit 1; }
python3 "${ROOT}/scripts/linux/tests/test_check_mystery_deploy_sudo.py"
echo 'All Mystery public release script contracts passed.'
