#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
failures=0
require() { grep -Fq -- "$2" "$1" && printf '[PASS] %s\n' "$3" || { printf '[FAIL] %s\n' "$3" >&2; failures=$((failures+1)); }; }
forbid() { ! grep -Fq -- "$2" "$1" && printf '[PASS] %s\n' "$3" || { printf '[FAIL] %s\n' "$3" >&2; failures=$((failures+1)); }; }
count_exactly() { local n; n="$(grep -Fc -- "$2" "$1" || true)"; [[ "$n" -eq "$3" ]] || { echo "[FAIL] $4 (found $n, expected $3)" >&2; failures=$((failures+1)); }; }

BUILD="$ROOT/scripts/linux/build_mystery_public_bundle.sh"
INSTALL="$ROOT/scripts/linux/install_mystery_public_bundle.sh"
BACKEND="$ROOT/scripts/linux/deploy_mystery_public_backend.sh"
NGINX="$ROOT/scripts/linux/deploy_mystery_public_nginx.sh"
VERIFY="$ROOT/scripts/linux/verify_mystery_public.sh"
ENTRYPOINT="$ROOT/scripts/linux/cwscx_mystery_public_deploy_entrypoint.sh"
BOOTSTRAP="$ROOT/scripts/linux/bootstrap_mystery_public_deploy_entrypoint.sh"
GUARD="$ROOT/scripts/linux/mystery_public_release_guard.py"
TRANSACTION_HELPER="$ROOT/scripts/linux/mystery_public_bootstrap_transaction.py"
WORKFLOW="$ROOT/.github/workflows/deploy-mystery-public.yml"

# Execute behavioral signed-archive, tamper, installed-integrity and retention tests.
python3 "$ROOT/scripts/linux/tests/test_mystery_public_release_guard.py" || failures=$((failures+1))
python3 "$ROOT/scripts/linux/tests/test_check_mystery_deploy_sudo.py" || failures=$((failures+1))
python3 "$ROOT/scripts/linux/tests/test_mystery_public_workflow_evidence.py" || failures=$((failures+1))
python3 "$ROOT/scripts/linux/tests/test_mystery_public_preactivation_sigkill.py" || failures=$((failures+1))
python3 "$ROOT/scripts/linux/tests/test_mystery_public_python_isolation.py" || failures=$((failures+1))
python3 "$ROOT/scripts/linux/tests/test_mystery_public_runtime_gate.py" || failures=$((failures+1))
python3 "$ROOT/scripts/linux/tests/test_mystery_public_application_probe.py" || failures=$((failures+1))
python3 "$ROOT/scripts/linux/tests/test_mystery_public_bootstrap_safety.py" || failures=$((failures+1))
python3 "$ROOT/scripts/linux/tests/test_mystery_public_bundle_contract.py" || failures=$((failures+1))

# Existing immutable release and permission-recovery contracts.
require "$BUILD" 'expected_migration_heads' 'bundle records expected migration heads'
require "$BUILD" 'sys.version_info[:2] == (3, 12)' 'bundle targets VM Python 3.12'
require "$BUILD" 'SHA256SUMS' 'bundle records exact file hashes'
require "$BUILD" 'mystery_public_release_guard.py" "${RELEASE_ROOT}/scripts/linux/' 'bundle copies the runtime guard used by the backend deployer'
require "$INSTALL" 'EXPECTED_BUNDLE_SHA256' 'installer rechecks outer checksum'
require "$INSTALL" '--install-only' 'installer supports pre-activation archive restoration'
require "$INSTALL" 'FINALIZED=1' 'installer removes interrupted partial releases until preflight completes'
require "$INSTALL" 'check_readable_tree' 'installer behaviorally preflights service access before activation'
require "$INSTALL" 'mv -Tf' 'installer switches current atomically'
require "$BACKEND" 'Environment=PGSSLCERTMODE=disable' 'backend avoids optional client certificate lookup'
require "$BACKEND" '--host 127.0.0.1 --port 8011' 'backend remains loopback-only'
require "$BACKEND" 'check-production-environment "${ENV_FILE}"' 'live deploy uses the candidate probe environment parser and policy'
forbid "$BACKEND" 'alembic" upgrade' 'Mystery path never runs migrations'
require "$VERIFY" 'get_current_heads' 'verifier reads migration state without migration'

# Privileged surface, signed archives and fail-closed recovery contracts.
require "$ENTRYPOINT" 'ARCHIVE_ROOT="${STATE_ROOT}/application-archives"' 'entrypoint uses only the approved root-owned archive subdirectory'
require "$ENTRYPOINT" 'MIN_FREE_BYTES=10737418240' 'entrypoint reserves at least 10 GiB free space'
require "$ENTRYPOINT" 'ARCHIVE_RETAIN_COUNT=3' 'entrypoint bounds normal archive retention to three'
require "$ENTRYPOINT" '.pinned' 'retention preserves VM-admin pinned archives'
require "$GUARD" 'operation current release is stale' 'operation validator binds authorization to the live current release'
require "$ENTRYPOINT" 'verify_archived_installed "${FALLBACK_RELEASE_ID}"' 'deploy authenticates fallback archive and installed files'
require "$ENTRYPOINT" 'check_runtime_usable "${FALLBACK_RELEASE_ID}"' 'deploy proves approved fallback runtime before relying on it'
require "$ENTRYPOINT" 'check_runtime_usable "${TARGET_RELEASE_ID}"' 'rollback proves target runtime before switching current'
require "$ENTRYPOINT" 'check_runtime_usable "${fallback_id}"' 'recovery proves fallback runtime before recovery switch'
require "$GUARD" 'for module in ("uvicorn", "fastapi", "alembic", "sqlalchemy")' 'runtime gate imports core installed modules'
require "$GUARD" 'required distribution is absent' 'runtime gate checks every direct requirement, not only pip metadata consistency'
require "$GUARD" '"pip", "--isolated", "check"' 'runtime gate runs pip consistency in isolated mode'
require "$GUARD" '"/usr/sbin/runuser", "-u", "cxadmin", "-g", "www-data", "--"' 'runtime imports execute as the service identity rather than root'
require "$GUARD" 'PGOPTIONS": "-c default_transaction_read_only=on"' 'candidate application probe forces PostgreSQL transactions read-only'
require "$GUARD" 'unsupported escape or continuation' 'environment parser rejects unsupported EnvironmentFile constructs explicitly'
require "$GUARD" 'production environment must disable LOCAL_DEVELOPMENT_AUTO_DDL' 'candidate and live production preflights reject automatic DDL opt-in'
require "$GUARD" '"app.main:app", "--uds"' 'candidate application probe serves only on a private Unix socket'
require "$ENTRYPOINT" 'check_candidate_app "${NEW_ID}"' 'fresh and reused candidates must pass the bounded application probe'
require "$ENTRYPOINT" 'switch_current_signed' 'signed current switches require a fresh release-bound candidate probe'
require "$VERIFY" 'check-serving-identity' 'post-activation verifier binds MainPID launch identity to signed current'
require "$VERIFY" 'payload.get("version") != sys.argv[2]' 'post-activation readiness body must carry the signed full SHA'
require "$ENTRYPOINT" '"${ACTION}" == "establish_baseline"' 'entrypoint exposes a distinct signed first-baseline operation'
require "$ENTRYPOINT" '"${INSTALLER}" --install-only "${ROOT_BUNDLE}"' 'first baseline installs and checks the signed release before activation'
require "$ENTRYPOINT" 'archive_root_is_empty || die' 'first baseline refuses old or partial local archives'
require "$ENTRYPOINT" 'store_baseline_marker "${NEW_ID}"' 'successful first baseline records its identity only after archive verification'
require "$ENTRYPOINT" 'restore_baseline_origin_fixed' 'post-switch baseline failure uses fixed root-owned recovery commands'
forbid "$ENTRYPOINT" 'restore_unverified_baseline_origin' 'entrypoint never runs unsigned pre-baseline release scripts as root'
require "$ENTRYPOINT" 'active-operation.json' 'entrypoint durably journals switch transactions'
require "$ENTRYPOINT" 'fsync_directory "${STATE_ROOT}"' 'entrypoint fsyncs journal publication and removal'
require "$ENTRYPOINT" 'fsync_directory "${TARGET_ROOT}"' 'entrypoint durably publishes every current symlink switch'
require "$INSTALL" 'os.walk(root, topdown=False)' 'installer durably syncs complete release files and directories before activation'
require "$ENTRYPOINT" 'fsync_file "${evidence_file}"' 'entrypoint syncs readiness evidence before journal removal'
require "$ENTRYPOINT" 'store_previous_release_id' 'entrypoint atomically syncs rollback bookkeeping before journal removal'
require "$ENTRYPOINT" 'preflight_baseline_origin "${CURRENT_ID}"' 'first baseline validates and restarts the legacy origin before switching'
require "$ENTRYPOINT" 'legacy backend ExecStart must resolve inside the pre-baseline release' 'first baseline fails closed on unsafe legacy launch paths'
require "$ENTRYPOINT" '"schema_version": 1, "present": presence' 'baseline snapshot records exact configuration presence and absence'
require "$ENTRYPOINT" 'os.O_RDONLY | os.O_NOFOLLOW' 'baseline snapshot and recovery reject configuration symlinks'
require "$ENTRYPOINT" 'os.unlink(name, dir_fd=parent_fd)' 'baseline recovery removes generated NGINX files that were originally absent'
require "$ENTRYPOINT" 'os.replace(temporary_name, name, src_dir_fd=parent_fd, dst_dir_fd=parent_fd)' 'baseline recovery atomically restores files that were originally present'
forbid "$ENTRYPOINT" 'if [[ "$(current_release_id 2>/dev/null || true)" == "${RECOVERY_ORIGINAL_ID}" ]]' 'recovery never clears a journal merely because current already names the origin'
require "$ENTRYPOINT" 'an interrupted operation requires an explicit signed recover action' 'pending crash recovery fails closed to signed recover only'
require "$ENTRYPOINT" '"recovery_required": pending is not None' 'read-only status exposes pending recovery without reconciling it'
require "$ENTRYPOINT" 'baseline_established' 'status exposes whether the first signed baseline exists'
require "$ENTRYPOINT" 'restore_archive_install_only "${TARGET_RELEASE_ID}" "${BUNDLE_SHA256}"' 'rollback restores a missing installed target from its authenticated archive'
require "$ENTRYPOINT" 'installed_release_present' 'status exposes whether an authenticated archive is already installed'
require "$ENTRYPOINT" 'arm_recovery signed-new "${FALLBACK_RELEASE_ID}" "${NEW_ID}" "${FALLBACK_ARCHIVE_SHA256}"' 'normal deploy durably arms recovery before installer activation'
require "$ENTRYPOINT" 'arm_recovery signed "${CURRENT_ID}" "${TARGET_RELEASE_ID}" "${CURRENT_ARCHIVE_SHA256}"' 'rollback durably arms recovery before switching current'
require "$ENTRYPOINT" 'chmod 0644 "${evidence_file}"' 'failed verification evidence is readable by the workflow before recovery'
require "$GUARD" 'os.replace(temp_dir, paths["root"])' 'archive publishes its complete file set with one atomic directory rename'
require "$ENTRYPOINT" 'check-db-heads' 'deploy and rollback enforce exact read-only migration compatibility'
require "$ENTRYPOINT" 'store-archive' 'only verified deployment stores exact signed bundle archive'
require "$GUARD" 'metadata["status"] != "deploy_verified"' 'archive verifier rejects failed/unapproved state'
forbid "$ENTRYPOINT" 'alembic upgrade' 'entrypoint never migrates or downgrades the database'
forbid "$ENTRYPOINT" 'source "${ENV_FILE}"' 'entrypoint never shell-sources secrets'

# Root-only bootstrap; workflow cannot install or replace privileged code.
require "$BOOTSTRAP" 'RELEASE_GUARD_SRC' 'bootstrap validates and installs release guard'
require "$BOOTSTRAP" 'TRANSACTION_HELPER_DST' 'bootstrap installs the transaction helper as the fourth canonical suite file'
require "$ENTRYPOINT" '"${TRANSACTION_HELPER}"' 'entrypoint hashes the installed transaction helper on every invocation'
require "$BOOTSTRAP" 'TRANSACTION_HELPER_EXEC' 'bootstrap executes only a root-only transaction-helper snapshot'
require "$BOOTSTRAP" 'source ancestor is not root-controlled' 'bootstrap rejects untrusted source ancestors'
require "$BOOTSTRAP" 'os.O_RDONLY | os.O_NOFOLLOW' 'bootstrap snapshots opened non-symlink source descriptors'
require "$BOOTSTRAP" 'ENTRYPOINT_SNAPSHOT' 'bootstrap installs all privileged files from one root-only snapshot'
require "$ENTRYPOINT" 'privileged_suite_version' 'status reports the installed privileged-suite identity'
require "$BOOTSTRAP" 'PREVIOUS_SIGNING_PUBLIC_KEY_SRC=' 'bootstrap supports explicit root-owned signer overlap'
require "$BOOTSTRAP" 'verify-archive "${ARCHIVE_ROOT}" "${release_id}" "${PROPOSED_SIGNERS}"' 'signer rotation preserves authenticated archives'
require "$ENTRYPOINT" 'installed privileged suite differs from bootstrap identity' 'status and mutations rehash the installed privileged suite'
require "$ENTRYPOINT" 'must be owned by the deployment account' 'caller-supplied root-owned temporary files are rejected'
require "$ENTRYPOINT" 'discard_pre_activation_candidate "${PREACTIVATION_ID}"' 'failed preactivation candidates are removed before retry'
require "$ENTRYPOINT" 'write_preactivation_marker deploy "${NEW_ID}"' 'deploy records a durable preactivation marker before the installer runs'
require "$ENTRYPOINT" 'write_preactivation_marker rollback "${release_id}"' 'archive restoration records a durable preactivation marker before the installer runs'
require "$ENTRYPOINT" 'an interrupted preactivation install requires an explicit signed recover action' 'preactivation recovery is signed-recover only'
require "$ENTRYPOINT" 'stat.S_IMODE(info.st_mode) != 0o600' 'preactivation marker requires root-owned mode 0600 non-symlink state'
forbid "$ENTRYPOINT" 'rm -rf --one-file-system -- "${RELEASES_ROOT}/${PREACT' 'recovery deletes only through the validated candidate helper'
require "$ENTRYPOINT" 'follow_symlinks=False' 'baseline enabled-site link is inspected without following it'
require "$ENTRYPOINT" 'os.readlink(link_name, dir_fd=link_parent_fd)' 'baseline recovery validates the exact enabled-site target'
require "$WORKFLOW" 'EXPECTED_PRIVILEGED_SUITE_VERSION' 'workflow rejects a stale or mixed installed privileged suite'
require "$BOOTSTRAP" '"${INCOMING_ROOT}" "${ARCHIVE_ROOT}" "${NONCE_ROOT}"' 'bootstrap creates root-only incoming, archive and replay directories'
require "$BOOTSTRAP" 'cwscx-mystery-public-release-signing-key.pub' 'bootstrap installs a release key distinct from SSH transport metadata'
require "$BOOTSTRAP" '${DEPLOY_USER} ALL=(root) NOPASSWD: ${ENTRYPOINT_DST}' 'sudoers grants one fixed entrypoint only'
forbid "$BOOTSTRAP" 'NOPASSWD: /usr/bin/bash' 'bootstrap never grants a shell'

# Manual, main-only, protected Actions deploy and rollback.
require "$WORKFLOW" 'workflow_dispatch:' 'workflow is manual only'
require "$WORKFLOW" "github.ref == 'refs/heads/main'" 'workflow is main-only'
require "$WORKFLOW" 'environment: mystery-public' 'deploy and rollback use protected environment approvals'
require "$WORKFLOW" '--operation-path' 'workflow routes state changes through signed operation documents'
require "$WORKFLOW" "inputs.action == 'establish_baseline'" 'first baseline has a separate protected manual job'
require "$WORKFLOW" 'BASELINE_CURRENT_RELEASE_ID' 'first-baseline approval is bound to the explicitly named current release'
require "$WORKFLOW" 'no authenticated rollback is asserted' 'workflow failure does not fabricate a signed first-baseline rollback'
forbid "$WORKFLOW" '--action deploy' 'workflow cannot invoke an unsigned direct deploy action'
forbid "$WORKFLOW" '--action rollback' 'workflow cannot invoke an unsigned direct rollback action'
forbid "$ENTRYPOINT" '"${ACTION}" == "rollback" ||' 'entrypoint parser does not expose direct local rollback'
if DIRECT_ROLLBACK_OUTPUT="$(bash "$ENTRYPOINT" --action rollback 2>&1)"; then
  echo '[FAIL] direct local rollback invocation was accepted' >&2; failures=$((failures+1))
elif [[ "$DIRECT_ROLLBACK_OUTPUT" == *'--action accepts status only; deploy and rollback require a signed operation'* ]]; then
  echo '[PASS] direct local rollback invocation is behaviorally rejected'
else
  echo "[FAIL] direct local rollback failed for the wrong reason: ${DIRECT_ROLLBACK_OUTPUT}" >&2; failures=$((failures+1))
fi
require "$WORKFLOW" '--action status' 'workflow reads live release identity before and after each operation'
require "$ENTRYPOINT" 'flock -n -x 9' 'entrypoint serializes local operations independently of GitHub concurrency'
require "$ENTRYPOINT" 'status accepts no operation or bundle arguments' 'status is read-only and narrowly scoped'
require "$WORKFLOW" 'github.run_attempt' 'rollback artifact remains distinct across reruns'
require "$WORKFLOW" '--release-id' 'workflow passes validated rollback release ID'
require "$WORKFLOW" 'StrictHostKeyChecking=yes' 'workflow pins SSH host identity'
require "$WORKFLOW" 'MYSTERY_PUBLIC_RELEASE_SIGNING_KEY' 'workflow uses a dedicated release signing secret'
require "$WORKFLOW" 'Release signing key must differ from SSH key' 'workflow rejects release and SSH key reuse'
require "$WORKFLOW" 'cwscx-mystery-public-release' 'workflow signs exact release zip in the release namespace'
require "$WORKFLOW" 'cwscx-mystery-public-operation' 'workflow signs canonical operations in a separate namespace'
require "$GUARD" 'operation nonce has already been used' 'operation authorization rejects replayed nonces'
require "$GUARD" 'operation current release is stale' 'operation authorization rejects stale current-release state'
require "$WORKFLOW" 'python3 scripts/linux/check_mystery_deploy_sudo.py' 'both operations preflight narrow sudo grant'
require "$WORKFLOW" "inputs.action == 'recover'" 'crash recovery has a separate protected manual job'
require "$WORKFLOW" 'recovery_required' 'recovery workflow reads the durable journal through status'
require "$WORKFLOW" 'ACTION=recover' 'recovery workflow signs an explicit recover operation'
require "$WORKFLOW" 'EXPECTED_RECOVERY_RELEASE_ID' 'recovery accepts an authenticated committed baseline as the verified end state'
require "$WORKFLOW" 'recovery-${FAILED_RELEASE_ID}.json' 'recovery workflow fetches exact recovery readiness evidence'
count_exactly "$WORKFLOW" 'sudo -n /usr/local/sbin/cwscx-mystery-public-deploy' 9 'baseline, deploy, rollback and recovery use read-only status plus fixed privileged operations'
forbid "$WORKFLOW" 'apt-get install' 'workflow does not mutate VM prerequisites'
forbid "$WORKFLOW" '/tmp/install_mystery_public_bundle.sh' 'workflow cannot upload an installer to the VM'

# Trusted working directory and isolated Python for every root-run interpreter.
require "$ENTRYPOINT" 'cd / || die "cannot enter the trusted working directory"' 'entrypoint leaves the caller directory before any interpreter'
require "$ENTRYPOINT" 'ENTRYPOINT_REALPATH="$(realpath -e -- "${BASH_SOURCE[0]}")"' 'entrypoint resolves its installed path before the trusted cd'
require "$INSTALL" 'cd / || {' 'installer enters a trusted working directory'
require "$BOOTSTRAP" 'cd / || die "cannot enter the trusted working directory"' 'bootstrap enters a trusted working directory after locating its source'
forbid "$ENTRYPOINT" '"${PYTHON_BIN}" -c' 'entrypoint never runs an unisolated interpreter'
forbid "$ENTRYPOINT" '"${PYTHON_BIN}" "${RELEASE_GUARD}"' 'entrypoint never runs the guard unisolated'
forbid "$ENTRYPOINT" '"${PYTHON_BIN}" - ' 'entrypoint never feeds a heredoc to an unisolated interpreter'
forbid "$INSTALL" '-m pip install' 'installer pip ignores PIP_* variables and user configuration'
forbid "$INSTALL" '-m pip check' 'installer pip check is isolated'
forbid "$ENTRYPOINT" '"${venv}/python" -m pip' 'recovery venv re-proof is isolated'
require "$ENTRYPOINT" 'cur="$(current_release_id)" || return 1' 'candidate deletion requires an explicit successful current lookup'
forbid "$ENTRYPOINT" '[[ "$(current_release_id)" != "${release_id}" ]] || return 1' 'candidate deletion never fails open on a swallowed lookup failure'

for file in "$BUILD" "$INSTALL" "$BACKEND" "$NGINX" "$VERIFY" "$ENTRYPOINT" "$BOOTSTRAP"; do
  bash -n "$file" || { echo "[FAIL] shell syntax: $file" >&2; failures=$((failures+1)); }
done
python3 -I - "$GUARD" "$TRANSACTION_HELPER" \
  "$ROOT/scripts/linux/validate_mystery_public_bundle.py" \
  "$ROOT/scripts/linux/tests/test_mystery_public_release_guard.py" \
  "$ROOT/scripts/linux/tests/test_mystery_public_bundle_contract.py" <<'PY' || failures=$((failures+1))
import pathlib, sys
for raw in sys.argv[1:]:
    source = pathlib.Path(raw)
    compile(source.read_bytes(), str(source), "exec")
PY

(( failures == 0 )) || { printf '%d release safety checks failed\n' "$failures" >&2; exit 1; }
echo 'All Mystery Public deploy/rollback behavior and contracts passed.'
