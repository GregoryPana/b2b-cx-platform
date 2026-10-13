#!/usr/bin/env bash
# Fixed root-owned deploy/rollback entrypoint. This is the only NOPASSWD command.
set -euo pipefail
umask 0027
PATH=/usr/sbin:/usr/bin:/sbin:/bin
export PATH

die() { echo "cwscx-mystery-public-deploy: $*" >&2; exit 1; }

# Trusted execution boundary, before any interpreter runs. The installed path is
# resolved while the caller's directory is still current (a relative invocation
# stays valid; realpath is not an interpreter), then the privileged suite moves
# to the root-owned filesystem root. A candidate release is NOT a trusted cwd
# before signed validation. Every Python call below also uses -I, which ignores
# PYTHON* variables, the user site and the cwd/script directory; the variable
# scrub additionally covers pip configuration for the offline venv checks.
ENTRYPOINT_REALPATH="$(realpath -e -- "${BASH_SOURCE[0]}")" || die "cannot resolve the entrypoint path"
cd / || die "cannot enter the trusted working directory"
for _name in $(compgen -e); do
  case "${_name}" in PYTHON*|PIP_*) unset "${_name}" ;; esac
done
unset _name CDPATH

readonly TARGET_ROOT="/opt/cwscx-mystery-public"
readonly ENV_FILE="${TARGET_ROOT}/.env"
readonly RELEASES_ROOT="${TARGET_ROOT}/releases"
readonly STATE_ROOT="/var/lib/cwscx-mystery-public"
readonly EVIDENCE_ROOT="${STATE_ROOT}/deploy-evidence"
readonly INCOMING_ROOT="${STATE_ROOT}/incoming"
readonly ARCHIVE_ROOT="${STATE_ROOT}/application-archives"
readonly BASELINE_MARKER="${ARCHIVE_ROOT}/baseline-release-id"
readonly NONCE_ROOT="${STATE_ROOT}/operation-nonces"
readonly TRANSACTION_FILE="${STATE_ROOT}/active-operation.json"
readonly BASELINE_RECOVERY_ROOT="${STATE_ROOT}/baseline-origin-config"
readonly PREACTIVATION_MARKER="${STATE_ROOT}/preactivation-candidate.json"
readonly ENTRYPOINT_PATH="/usr/local/sbin/cwscx-mystery-public-deploy"
readonly INSTALLER="/usr/local/libexec/cwscx-mystery-public/install_mystery_public_bundle.sh"
readonly RELEASE_GUARD="/usr/local/libexec/cwscx-mystery-public/mystery_public_release_guard.py"
readonly PRIVILEGED_SUITE_VERSION_FILE="/usr/local/libexec/cwscx-mystery-public/privileged-suite-version"
readonly ALLOWED_SIGNERS="/etc/cwscx-mystery-public/release-allowed-signers"
readonly BASH_BIN="/usr/bin/bash"
readonly PYTHON_BIN="/usr/bin/python3"
readonly ARCHIVE_RETAIN_COUNT=3
readonly MIN_FREE_BYTES=10737418240
readonly EVIDENCE_RETAIN_COUNT=20
readonly HEALTH_PROBE_ATTEMPTS=30
readonly DEFAULT_ENABLE_HSTS="0"
readonly SERVICE_NAME="cwscx-mystery-public-backend"
readonly SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
readonly NGINX_SITE_FILE="/etc/nginx/sites-available/cwscx-mystery-public"
readonly NGINX_LINK_FILE="/etc/nginx/sites-enabled/cwscx-mystery-public"
readonly NGINX_LIMIT_FILE="/etc/nginx/conf.d/cwscx-mystery-public-limits.conf"
readonly NGINX_HEADERS_FILE="/etc/nginx/snippets/cwscx-mystery-public-security-headers.conf"
# Suppress libpq's absent optional client-certificate lookup, not server TLS.
export PGSSLCERTMODE=disable
export TARGET_ROOT

ACTION=""; STATUS_RELEASE_ID=""; BUNDLE_PATH_RAW=""; BUNDLE_SIGNATURE_PATH_RAW=""
OPERATION_PATH_RAW=""; OPERATION_SIGNATURE_PATH_RAW=""
declare -A SEEN=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --action|--release-id|--bundle-path|--bundle-signature-path|--operation-path|--operation-signature-path)
      flag="$1"; [[ -z "${SEEN[$flag]:-}" ]] || die "duplicate argument: ${flag}"
      SEEN["$flag"]=1; [[ $# -ge 2 ]] || die "missing value for ${flag}"
      case "$flag" in
        --action) ACTION="$2" ;;
        --bundle-path) BUNDLE_PATH_RAW="$2" ;;
        --release-id) STATUS_RELEASE_ID="$2" ;;
        --bundle-signature-path) BUNDLE_SIGNATURE_PATH_RAW="$2" ;;
        --operation-path) OPERATION_PATH_RAW="$2" ;;
        --operation-signature-path) OPERATION_SIGNATURE_PATH_RAW="$2" ;;
      esac
      shift 2 ;;
    *) die "unknown argument: $1" ;;
  esac
done
[[ -z "${ACTION}" || "${ACTION}" == "status" ]] || die "--action accepts status only; deploy and rollback require a signed operation"
[[ "${EUID}" -eq 0 ]] || die "must run as root (invoke via sudo)"
[[ -n "${SUDO_USER:-}" && "${SUDO_USER}" != "root" ]] || die "SUDO_USER must identify the deployment account"
id -u "${SUDO_USER}" >/dev/null 2>&1 || die "SUDO_USER does not resolve to an account"
valid_release_id() { [[ "$1" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$ ]]; }

require_root_dir() {
  local path="$1" label="$2" mode
  [[ -d "${path}" && ! -L "${path}" ]] || die "${label} must be a real directory"
  [[ "$(stat -c '%U' "${path}")" == "root" ]] || die "${label} must be root-owned"
  mode="$(stat -c '%a' "${path}")"; (( 8#${mode} & 8#022 )) && die "${label} must not be group/world writable"
  return 0
}
require_root_file() {
  local path="$1" label="$2" mode
  [[ -f "${path}" && ! -L "${path}" ]] || die "${label} must be a regular file"
  [[ "$(stat -c '%U' "${path}")" == "root" ]] || die "${label} must be root-owned"
  mode="$(stat -c '%a' "${path}")"; (( 8#${mode} & 8#022 )) && die "${label} must not be group/world writable"
  return 0
}
require_root_dir "${TARGET_ROOT}" "target root"
require_root_dir "${RELEASES_ROOT}" "releases root"
require_root_dir "${STATE_ROOT}" "state root"
require_root_dir "${EVIDENCE_ROOT}" "evidence root"
require_root_dir "${INCOMING_ROOT}" "incoming root"
require_root_dir "${ARCHIVE_ROOT}" "application archive root"
require_root_dir "${NONCE_ROOT}" "operation nonce root"
[[ "$(stat -c '%a' "${INCOMING_ROOT}")" == "700" ]] || die "incoming root must be mode 0700"
[[ "$(stat -c '%a' "${ARCHIVE_ROOT}")" == "700" ]] || die "application archive root must be mode 0700"
[[ "$(stat -c '%a' "${NONCE_ROOT}")" == "700" ]] || die "operation nonce root must be mode 0700"
require_root_file "${ENV_FILE}" "environment file"
[[ ! -L "${STATE_ROOT}/deploy.lock" ]] || die "deployment lock must not be a symlink"
exec 9>"${STATE_ROOT}/deploy.lock"
flock -n -x 9 || die "another deployment or rollback is in progress"
ENV_MODE="$(stat -c '%a' "${ENV_FILE}")"; [[ "${ENV_MODE}" == "600" || "${ENV_MODE}" == "640" ]] || die "environment file mode must be 600 or 640"
for item in "${ENTRYPOINT_PATH}" "${INSTALLER}" "${RELEASE_GUARD}" "${PRIVILEGED_SUITE_VERSION_FILE}" "${ALLOWED_SIGNERS}"; do require_root_file "${item}" "privileged support file"; done
[[ "${ENTRYPOINT_REALPATH}" == "${ENTRYPOINT_PATH}" ]] || die "entrypoint must be invoked from its fixed installed path"
PRIVILEGED_SUITE_VERSION="$(tr -d '\n' <"${PRIVILEGED_SUITE_VERSION_FILE}")"
[[ "${PRIVILEGED_SUITE_VERSION}" =~ ^[0-9a-f]{64}$ ]] || die "privileged suite version is invalid"
INSTALLED_SUITE_VERSION="$("${PYTHON_BIN}" -I "${RELEASE_GUARD}" suite-version "${ENTRYPOINT_PATH}" "${INSTALLER}" "${RELEASE_GUARD}")" \
  || die "installed privileged suite cannot be verified"
[[ "${INSTALLED_SUITE_VERSION}" == "${PRIVILEGED_SUITE_VERSION}" ]] || die "installed privileged suite differs from bootstrap identity"

current_release_id() {
  [[ -L "${TARGET_ROOT}/current" ]] || return 1
  local resolved id manifest_id
  resolved="$(realpath -e -- "${TARGET_ROOT}/current")" || return 1
  [[ "$(dirname "${resolved}")" == "${RELEASES_ROOT}" ]] || return 1
  id="$(basename "${resolved}")"; valid_release_id "${id}" || return 1
  manifest_id="$("${PYTHON_BIN}" -I -c 'import json,sys; print(json.load(open(sys.argv[1],encoding="utf-8"))["release_id"])' "${resolved}/release-manifest.json")" || return 1
  [[ "${id}" == "${manifest_id}" ]] || return 1
  printf '%s\n' "${id}"
}

verify_archived_installed() {
  local release_id="$1"
  valid_release_id "${release_id}" || die "invalid release ID"
  "${PYTHON_BIN}" -I "${RELEASE_GUARD}" verify-installed \
    "${RELEASES_ROOT}/${release_id}" "${ARCHIVE_ROOT}" "${release_id}" "${ALLOWED_SIGNERS}" >/dev/null
}

verify_archive() {
  local release_id="$1"
  valid_release_id "${release_id}" || die "invalid release ID"
  "${PYTHON_BIN}" -I "${RELEASE_GUARD}" verify-archive \
    "${ARCHIVE_ROOT}" "${release_id}" "${ALLOWED_SIGNERS}"
}

# Call only after the installed source has been authenticated against its signed
# bundle/archive. The root-owned guard validates the excluded local venv, then
# drops to cxadmin:www-data for imports and isolated pip consistency checks.
check_runtime_usable() {
  local release_id="$1"
  valid_release_id "${release_id}" || die "invalid release ID"
  "${PYTHON_BIN}" -I "${RELEASE_GUARD}" check-runtime "${RELEASES_ROOT}/${release_id}" >/dev/null
}

baseline_release_id() {
  [[ -e "${BASELINE_MARKER}" ]] || return 1
  require_root_file "${BASELINE_MARKER}" "baseline marker"
  local id lines
  id="$(sed -n '1p' "${BASELINE_MARKER}")"
  lines="$(wc -l <"${BASELINE_MARKER}")"
  valid_release_id "${id}" || die "baseline marker contains an invalid release ID"
  [[ "${lines}" -eq 1 ]] || die "baseline marker must contain exactly one release ID"
  printf '%s\n' "${id}"
}

archive_root_is_empty() {
  [[ -z "$(find "${ARCHIVE_ROOT}" -mindepth 1 -maxdepth 1 -print -quit)" ]]
}

store_baseline_marker() {
  local release_id="$1" temporary="${ARCHIVE_ROOT}/.baseline-release-id.$$"
  valid_release_id "${release_id}" || return 1
  [[ ! -e "${BASELINE_MARKER}" ]] || return 1
  printf '%s\n' "${release_id}" >"${temporary}" || return 1
  chmod 0600 "${temporary}" || return 1
  fsync_file "${temporary}" || return 1
  mv -T "${temporary}" "${BASELINE_MARKER}" || return 1
  fsync_directory "${ARCHIVE_ROOT}"
}

store_previous_release_id() {
  local release_id="$1" temporary="${ARCHIVE_ROOT}/.previous-release-id.$$"
  valid_release_id "${release_id}" || return 1
  printf '%s\n' "${release_id}" >"${temporary}" || return 1
  chmod 0600 "${temporary}" || return 1
  fsync_file "${temporary}" || return 1
  mv -Tf "${temporary}" "${ARCHIVE_ROOT}/previous-release-id" || return 1
  fsync_directory "${ARCHIVE_ROOT}"
}

restore_archive_install_only() {
  local release_id="$1" bundle_sha256="$2"
  valid_release_id "${release_id}" || die "invalid release ID"
  [[ "${bundle_sha256}" =~ ^[0-9a-f]{64}$ ]] || die "invalid archived bundle checksum"
  [[ ! -e "${RELEASES_ROOT}/${release_id}" ]] || die "archive restore target already exists but is not verified"
  # The marker must be durable BEFORE the installer publishes the final
  # directory: SIGKILL/power loss skips every EXIT trap and would otherwise
  # leave an unjournaled candidate that blocks this fixed rollback ID forever.
  write_preactivation_marker rollback "${release_id}" "${bundle_sha256}" "${CURRENT_ID}" \
    || die "could not record the preactivation marker"
  PREACTIVATION_ID="${release_id}"
  EXPECTED_BUNDLE_SHA256="${bundle_sha256}" "${BASH_BIN}" "${INSTALLER}" \
    --install-only "${ARCHIVE_ROOT}/${release_id}/bundle.zip"
  if ! verify_archived_installed "${release_id}"; then
    discard_pre_activation_candidate "${release_id}" || die "archive restore cleanup needs VM-admin review"
    die "restored archive failed installed-file verification before activation"
  fi
  if ! check_runtime_usable "${release_id}"; then
    discard_pre_activation_candidate "${release_id}" || die "archive runtime failure cleanup needs VM-admin review"
    die "restored archive virtualenv failed usability validation before activation"
  fi
  # A signed-archive-verified installed release is reproducible and complete;
  # it is no longer a preactivation candidate and must survive later failures.
  release_preactivation_candidate || die "could not clear the preactivation marker"
}

discard_pre_activation_candidate() {
  local release_id="$1" candidate cur
  valid_release_id "${release_id}" || return 1
  # Fail closed: a failed or empty current-release lookup is not proof that the
  # candidate is non-current (a command substitution inside `!=` swallows its
  # exit status), so capture it explicitly before anything is removed.
  cur="$(current_release_id)" || return 1
  [[ -n "${cur}" ]] || return 1
  [[ "${cur}" != "${release_id}" ]] || return 1
  candidate="${RELEASES_ROOT}/${release_id}"
  require_root_dir "${candidate}" "unactivated candidate" || return 1
  rm -rf --one-file-system -- "${candidate}" || return 1
  fsync_directory "${RELEASES_ROOT}"
}

check_db_compatible() {
  local release_id="$1"
  "${RELEASES_ROOT}/${release_id}/backend/venv/bin/python" -I "${RELEASE_GUARD}" check-db-heads \
    "${ENV_FILE}" "${RELEASES_ROOT}/${release_id}/release-manifest.json" \
    "${RELEASES_ROOT}/${release_id}/backend/alembic.ini" >/dev/null
}

switch_current() {
  local release_id="$1" link
  link="${TARGET_ROOT}/.current.${release_id}.$$"
  ln -s "releases/${release_id}" "${link}"
  mv -Tf "${link}" "${TARGET_ROOT}/current"
  fsync_directory "${TARGET_ROOT}"
}

fsync_file() {
  "${PYTHON_BIN}" -I - "$1" <<'PY'
import os, sys
fd = os.open(sys.argv[1], os.O_RDONLY | os.O_NOFOLLOW)
try: os.fsync(fd)
finally: os.close(fd)
PY
}

fsync_directory() {
  "${PYTHON_BIN}" -I - "$1" <<'PY'
import os, sys
fd = os.open(sys.argv[1], os.O_RDONLY | os.O_DIRECTORY)
try: os.fsync(fd)
finally: os.close(fd)
PY
}

write_transaction() {
  local mode="$1" original_id="$2" failed_id="$3" authorization_sha256="$4" temporary
  temporary="${STATE_ROOT}/.active-operation.$$"
  "${PYTHON_BIN}" -I - "${temporary}" "${mode}" "${original_id}" "${failed_id}" "${authorization_sha256}" <<'PY'
import json, os, sys
path, mode, original, failed, digest = sys.argv[1:]
data = {"schema_version": 1, "mode": mode, "original_release_id": original,
        "failed_release_id": failed, "recovery_authorization_sha256": digest}
fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
with os.fdopen(fd, "w", encoding="utf-8") as handle:
    handle.write(json.dumps(data, sort_keys=True, separators=(",", ":")) + "\n")
    handle.flush(); os.fsync(handle.fileno())
PY
  mv -T "${temporary}" "${TRANSACTION_FILE}"
  fsync_directory "${STATE_ROOT}"
}

read_transaction() {
  require_root_file "${TRANSACTION_FILE}" "active operation journal"
  "${PYTHON_BIN}" -I - "${TRANSACTION_FILE}" <<'PY'
import json, re, sys
d=json.load(open(sys.argv[1], encoding="utf-8"))
if set(d) != {"schema_version","mode","original_release_id","failed_release_id","recovery_authorization_sha256"} or d["schema_version"] != 1:
    raise SystemExit("invalid active operation journal schema")
rid=re.compile(r"[A-Za-z0-9][A-Za-z0-9._-]{0,159}")
if d["mode"] not in {"signed","signed-new","baseline-origin"} or not rid.fullmatch(d["original_release_id"]) or not rid.fullmatch(d["failed_release_id"]) or not re.fullmatch(r"[0-9a-f]{64}", d["recovery_authorization_sha256"]):
    raise SystemExit("invalid active operation journal values")
for key in ("mode","original_release_id","failed_release_id","recovery_authorization_sha256"):
    print(d[key])
PY
}

transaction_json() {
  if [[ ! -e "${TRANSACTION_FILE}" ]]; then preactivation_json; return; fi
  require_root_file "${TRANSACTION_FILE}" "active operation journal"
  "${PYTHON_BIN}" -I - "${TRANSACTION_FILE}" <<'PY'
import json, sys
d=json.load(open(sys.argv[1], encoding="utf-8"))
required={"schema_version","mode","original_release_id","failed_release_id","recovery_authorization_sha256"}
if set(d) != required or d["schema_version"] != 1: raise SystemExit("invalid active operation journal schema")
print(json.dumps(d, sort_keys=True))
PY
}

clear_transaction() {
  [[ -e "${TRANSACTION_FILE}" ]] || return 0
  require_root_file "${TRANSACTION_FILE}" "active operation journal"
  rm -f -- "${TRANSACTION_FILE}"
  fsync_directory "${STATE_ROOT}"
}

# Preactivation marker: a bounded root-only record written (and fsynced) before
# the installer publishes a candidate release directory. It exists only while an
# unjournaled candidate may exist, so SIGKILL/power loss during venv creation is
# recoverable by a signed `recover` without ever guessing which path to delete.
#
# Deploy and baseline markers also reference the root-owned signed bundle and
# signature staged under ${INCOMING_ROOT}, and later gain `install_verified`
# once install, file verification and the database-head gate all passed. The
# flag is only a claim: recovery re-proves the candidate from those artifacts
# (or the signed archive) before it will preserve anything, because an archive
# does not exist until activation and its absence is not evidence of a torn
# install.
emit_preactivation_marker_file() {
  "${PYTHON_BIN}" -I - "$@" <<'PY'
import json, os, sys
path, operation, release_id, digest, origin, bundle, signature, verified = sys.argv[1:]
data = {"schema_version": 1, "operation": operation, "release_id": release_id,
        "bundle_sha256": digest, "origin_release_id": origin}
if bundle:
    data["bundle_path"], data["signature_path"] = bundle, signature
if verified:
    data["install_verified"] = True
fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
with os.fdopen(fd, "w", encoding="utf-8") as handle:
    handle.write(json.dumps(data, sort_keys=True, separators=(",", ":")) + "\n")
    handle.flush(); os.fsync(handle.fileno())
PY
}

write_preactivation_marker() {
  local operation="$1" release_id="$2" bundle_sha256="$3" origin_id="$4" bundle_path="${5:-}" signature_path="${6:-}" temporary
  temporary="${STATE_ROOT}/.preactivation-candidate.$$"
  valid_release_id "${release_id}" && valid_release_id "${origin_id}" || return 1
  [[ "${bundle_sha256}" =~ ^[0-9a-f]{64}$ ]] || return 1
  [[ ! -e "${PREACTIVATION_MARKER}" && ! -L "${PREACTIVATION_MARKER}" ]] || return 1
  # Never claim a directory that already exists: it is not ours to delete.
  [[ ! -e "${RELEASES_ROOT}/${release_id}" && ! -L "${RELEASES_ROOT}/${release_id}" ]] || return 1
  emit_preactivation_marker_file "${temporary}" "${operation}" "${release_id}" "${bundle_sha256}" "${origin_id}" \
    "${bundle_path}" "${signature_path}" "" || return 1
  mv -T "${temporary}" "${PREACTIVATION_MARKER}" || return 1
  fsync_directory "${STATE_ROOT}"
}

# Atomically replace the marker with the same record plus install_verified. Call
# only after the installer, file verification and database-head gate succeeded.
mark_preactivation_install_verified() {
  local temporary="${STATE_ROOT}/.preactivation-candidate.$$"
  load_preactivation_marker || return 1
  [[ -n "${PREACTIVATION_ID}" && "${PREACT_RELEASE_ID}" == "${PREACTIVATION_ID}" ]] || return 1
  rm -f -- "${temporary}" || return 1
  emit_preactivation_marker_file "${temporary}" "${PREACT_OPERATION}" "${PREACT_RELEASE_ID}" "${PREACT_BUNDLE_SHA256}" \
    "${PREACT_ORIGIN_ID}" "${PREACT_BUNDLE_PATH}" "${PREACT_SIGNATURE_PATH}" 1 || return 1
  mv -T "${temporary}" "${PREACTIVATION_MARKER}" || return 1
  fsync_directory "${STATE_ROOT}"
}

# Prints operation, release_id, bundle_sha256, origin_release_id, bundle_path,
# signature_path and install_verified ("true" or empty), one per line, only for
# a regular, non-symlink, root-owned, mode-0600, schema-exact marker.
preactivation_marker_fields() {
  "${PYTHON_BIN}" -I - "${PREACTIVATION_MARKER}" "${EUID}" <<'PY'
import json, os, re, stat, sys
path, uid = sys.argv[1], int(sys.argv[2])
fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
try:
    info = os.fstat(fd)
    if not stat.S_ISREG(info.st_mode) or info.st_uid != uid or stat.S_IMODE(info.st_mode) != 0o600 or info.st_size > 2048:
        raise SystemExit("unsafe preactivation marker")
    with os.fdopen(os.dup(fd), encoding="utf-8") as handle:
        d = json.load(handle)
finally:
    os.close(fd)
base = {"schema_version", "operation", "release_id", "bundle_sha256", "origin_release_id"}
optional = {"bundle_path", "signature_path", "install_verified"}
rid = re.compile(r"[A-Za-z0-9][A-Za-z0-9._-]{0,159}")
artifact = re.compile(r"/[A-Za-z0-9._/-]{1,400}")
def bad(value):
    return not isinstance(value, str) or not artifact.fullmatch(value) or ".." in value.split("/")
if not isinstance(d, dict) or not base <= set(d) or not set(d) <= base | optional or d["schema_version"] != 1 \
        or d["operation"] not in {"deploy", "establish_baseline", "rollback"} \
        or not all(isinstance(d[k], str) for k in base - {"schema_version"}) \
        or not rid.fullmatch(d["release_id"]) or not rid.fullmatch(d["origin_release_id"]) \
        or not re.fullmatch(r"[0-9a-f]{64}", d["bundle_sha256"]) \
        or ("bundle_path" in d) != ("signature_path" in d) \
        or ("bundle_path" in d and (bad(d["bundle_path"]) or bad(d["signature_path"]))) \
        or ("install_verified" in d and d["install_verified"] is not True):
    raise SystemExit("invalid preactivation marker")
for key in ("operation", "release_id", "bundle_sha256", "origin_release_id"):
    print(d[key])
print(d.get("bundle_path", "")); print(d.get("signature_path", ""))
print("true" if d.get("install_verified") else "")
PY
}

load_preactivation_marker() {
  local values
  mapfile -t values < <(preactivation_marker_fields) || return 1
  [[ "${#values[@]}" -eq 7 ]] || return 1
  PREACT_OPERATION="${values[0]}"; PREACT_RELEASE_ID="${values[1]}"
  PREACT_BUNDLE_SHA256="${values[2]}"; PREACT_ORIGIN_ID="${values[3]}"
  PREACT_BUNDLE_PATH="${values[4]}"; PREACT_SIGNATURE_PATH="${values[5]}"
  PREACT_INSTALL_VERIFIED="${values[6]}"
}

preactivation_json() {
  if [[ ! -e "${PREACTIVATION_MARKER}" && ! -L "${PREACTIVATION_MARKER}" ]]; then printf 'null\n'; return 0; fi
  local values
  mapfile -t values < <(preactivation_marker_fields) || return 1
  [[ "${#values[@]}" -eq 7 ]] || return 1
  # Same shape as the journal so the existing signed recover workflow applies.
  "${PYTHON_BIN}" -I -c 'import json,sys; print(json.dumps({"schema_version":1,"mode":"preactivation","original_release_id":sys.argv[4],"failed_release_id":sys.argv[2],"recovery_authorization_sha256":sys.argv[3],"preactivation_operation":sys.argv[1]}, sort_keys=True))' "${values[@]:0:4}"
}

clear_preactivation_marker() {
  [[ -e "${PREACTIVATION_MARKER}" || -L "${PREACTIVATION_MARKER}" ]] || return 0
  require_root_file "${PREACTIVATION_MARKER}" "preactivation marker"
  rm -f -- "${PREACTIVATION_MARKER}"
  fsync_directory "${STATE_ROOT}"
}

# The candidate is now journaled, verified-archived or gone: stop tracking it.
release_preactivation_candidate() {
  clear_preactivation_marker || return 1
  PREACTIVATION_ID=""
}

# A staged signed-bundle path recorded in the marker is trusted only when it is
# a direct, root-owned, non-writable, regular bundle.XXXXXX.zip[.sig] child of
# the root-only incoming directory.
incoming_artifact_ok() {
  local path="$1" name
  [[ "${path}" == "${INCOMING_ROOT}/"* ]] || return 1
  name="${path#"${INCOMING_ROOT}/"}"
  [[ "${name}" =~ ^bundle\.[A-Za-z0-9]+\.zip(\.sig)?$ ]] || return 1
  [[ -f "${path}" && ! -L "${path}" ]] || return 1
  [[ "$(stat -c '%U' -- "${path}")" == "root" ]] || return 1
  if (( 8#$(stat -c '%a' -- "${path}") & 8#022 )); then return 1; fi
  return 0
}

# Clear the (already loaded) marker, then the staged signed artifacts it
# referenced; they are only needed while the marker exists.
drop_preactivation_marker_and_artifacts() {
  clear_preactivation_marker || return 1
  if [[ -n "${PREACT_BUNDLE_PATH}" ]] && incoming_artifact_ok "${PREACT_BUNDLE_PATH}"; then
    rm -f -- "${PREACT_BUNDLE_PATH}" || echo "Retained bundle cleanup needs administrator review" >&2
    if incoming_artifact_ok "${PREACT_SIGNATURE_PATH}"; then rm -f -- "${PREACT_SIGNATURE_PATH}" || true; fi
  fi
  return 0
}

# Directly re-prove, after a KILL, that the marker's candidate is a complete
# installation of the signed artifact. Requires the marker's install_verified
# claim AND an independent check: the retained signed bundle/signature (deploy,
# baseline) or the signed archive (rollback) must match the installed files, and
# the locally built venv must be present and consistent. Archive absence is never
# treated as evidence of an incomplete install: a new bundle is not archived
# until activation.
preactivation_install_proven() {
  local candidate="${RELEASES_ROOT}/${PREACT_RELEASE_ID}" venv manifest_json manifest_id
  [[ "${PREACT_INSTALL_VERIFIED}" == "true" ]] || return 1
  if [[ -n "${PREACT_BUNDLE_PATH}" ]]; then
    incoming_artifact_ok "${PREACT_BUNDLE_PATH}" && incoming_artifact_ok "${PREACT_SIGNATURE_PATH}" || return 1
    [[ "${PREACT_SIGNATURE_PATH}" == "${PREACT_BUNDLE_PATH}.sig" ]] || return 1
    manifest_json="$("${PYTHON_BIN}" -I "${RELEASE_GUARD}" verify-bundle "${PREACT_BUNDLE_PATH}" \
      "${PREACT_BUNDLE_SHA256}" "${PREACT_SIGNATURE_PATH}" "${ALLOWED_SIGNERS}" 2>/dev/null)" || return 1
    manifest_id="$("${PYTHON_BIN}" -I -c 'import json,sys; print(json.loads(sys.argv[1])["release_id"])' "${manifest_json}")" || return 1
    [[ "${manifest_id}" == "${PREACT_RELEASE_ID}" ]] || return 1
    "${PYTHON_BIN}" -I "${RELEASE_GUARD}" verify-installed-bundle "${candidate}" "${PREACT_BUNDLE_PATH}" \
      "${PREACT_RELEASE_ID}" >/dev/null 2>&1 || return 1
  else
    verify_archived_installed "${PREACT_RELEASE_ID}" 2>/dev/null || return 1
  fi
  # File checks exclude the locally built venv, so prove it separately through
  # the same service-identity runtime gate used by rollback and recovery.
  check_runtime_usable "${PREACT_RELEASE_ID}" >/dev/null 2>&1 || return 1
}

# Truthful evidence for the one preactivation outcome with an UNAUTHENTICATED
# origin (the pre-baseline release, no signed archive). No switch occurred and no
# configuration was restored, so this record claims neither a fixed-config
# restore nor an authenticated fallback. It only states that the origin was
# probed ready (read-only: no restart, reload or file change) after cleanup.
write_preactivation_cleanup_evidence() {
  local failed_id="$1" origin_id="$2" operation="$3" bundle_sha256="$4" disposition="$5" attempt
  local path="${EVIDENCE_ROOT}/recovery-${failed_id}.json"
  for (( attempt=1; attempt<=HEALTH_PROBE_ATTEMPTS; attempt++ )); do
    if systemctl is-active --quiet "${SERVICE_NAME}" && curl -fsS http://127.0.0.1:8011/health/ready >/dev/null 2>&1; then
      "${PYTHON_BIN}" -I - "${path}" "${failed_id}" "${origin_id}" "${operation}" "${bundle_sha256}" "${disposition}" <<'PY' || return 1
import datetime, json, os, sys
path, failed, origin, operation, digest, disposition = sys.argv[1:]
data = {
    "schema_version": 1,
    "recovery": "preactivation_cleanup_unauthenticated_origin",
    "preactivation_operation": operation,
    "failed_release_id": failed,
    "origin_release_id": origin,
    "authorization_sha256": digest,
    "candidate_disposition": disposition,
    "switch_occurred": False,
    "config_restored": False,
    "origin_authenticated": False,
    "approved_fallback": False,
    "origin_ready": True,
    "origin_health_probe": "systemd_active_and_loopback_ready",
    "generated_at_utc": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
}
temporary = f"{path}.{os.getpid()}.tmp"
try:
    os.unlink(temporary)
except FileNotFoundError:
    pass
fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
with os.fdopen(fd, "w", encoding="utf-8") as handle:
    handle.write(json.dumps(data, sort_keys=True) + "\n")
    handle.flush()
    os.fchmod(handle.fileno(), 0o644)
    os.fsync(handle.fileno())
os.replace(temporary, path)
PY
      fsync_directory "${EVIDENCE_ROOT}" || return 1
      return 0
    fi
    if (( attempt < HEALTH_PROBE_ATTEMPTS )); then sleep 1; fi
  done
  echo "Unauthenticated origin ${origin_id} did not report ready; preactivation marker kept" >&2
  return 1
}

# Reconcile a marker left by an interrupted install. The candidate is deleted
# only when it is the exact marker-named, root-owned, real, non-current
# directory AND there is no proof it is a complete installation. A candidate
# whose install_verified claim re-proves directly (retained signed bundle or
# signed archive) is preserved even though it is not archived yet; a claim that
# no longer re-proves is ambiguous and fails closed. Every other state is
# preserved too. health=1 additionally probes the origin and writes evidence:
# signed verifier health for a signed origin, or the explicit unauthenticated
# preactivation-cleanup record otherwise.
reconcile_preactivation_marker() {
  local health="$1" candidate current leftover manifest_id disposition="absent"
  load_preactivation_marker || return 1
  candidate="${RELEASES_ROOT}/${PREACT_RELEASE_ID}"
  current="$(current_release_id 2>/dev/null || true)"
  if [[ "${current}" == "${PREACT_RELEASE_ID}" ]]; then
    # The live release is never a discardable candidate; only drop the marker.
    drop_preactivation_marker_and_artifacts
    return
  fi
  [[ "${current}" == "${PREACT_ORIGIN_ID}" ]] || return 1
  if [[ -e "${candidate}" || -L "${candidate}" ]]; then
    [[ -d "${candidate}" && ! -L "${candidate}" ]] || return 1
    [[ "$(stat -c '%U' "${candidate}")" == "root" ]] || return 1
    if preactivation_install_proven; then
      disposition="preserved_complete"
    elif [[ "${PREACT_INSTALL_VERIFIED}" == "true" ]]; then
      # Claimed complete but not provable now: never delete on ambiguity.
      echo "Preactivation candidate ${PREACT_RELEASE_ID} claims a complete install that cannot be re-proven; preserved for VM-administrator review" >&2
      return 1
    elif [[ "${PREACT_OPERATION}" != "rollback" ]] && verify_archived_installed "${PREACT_RELEASE_ID}" 2>/dev/null; then
      # Already signed-archived (activation finished earlier): never discardable.
      disposition="preserved_complete"
    else
      # A rollback restore is always reproducible from its signed archive and
      # file verification cannot prove its locally built venv, so an unflagged
      # one is discarded and restored afresh.
      if [[ -e "${candidate}/release-manifest.json" ]]; then
        manifest_id="$("${PYTHON_BIN}" -I -c 'import json,sys; print(json.load(open(sys.argv[1],encoding="utf-8"))["release_id"])' "${candidate}/release-manifest.json")" || return 1
        [[ "${manifest_id}" == "${PREACT_RELEASE_ID}" ]] || return 1
      fi
      discard_pre_activation_candidate "${PREACT_RELEASE_ID}" || return 1
      disposition="removed"
    fi
  fi
  while IFS= read -r -d '' leftover; do
    rm -rf --one-file-system -- "${leftover}" || return 1
  done < <(find "${RELEASES_ROOT}" -mindepth 1 -maxdepth 1 -type d -uid "${EUID}" \
    -name ".${PREACT_RELEASE_ID}.incoming.*" -print0)
  fsync_directory "${RELEASES_ROOT}" || return 1
  if [[ "${health}" -eq 1 ]]; then
    if verify_archived_installed "${PREACT_ORIGIN_ID}" 2>/dev/null; then
      recover_release "${PREACT_RELEASE_ID}" "${PREACT_ORIGIN_ID}" || return 1
    else
      write_preactivation_cleanup_evidence "${PREACT_RELEASE_ID}" "${PREACT_ORIGIN_ID}" \
        "${PREACT_OPERATION}" "${PREACT_BUNDLE_SHA256}" "${disposition}" || return 1
    fi
  fi
  drop_preactivation_marker_and_artifacts
}

snapshot_baseline_origin_config() {
  local temporary="${STATE_ROOT}/.baseline-origin-config.$$" service_user service_group fragment_path
  [[ ! -e "${BASELINE_RECOVERY_ROOT}" ]] || die "baseline recovery snapshot already exists; administrator review required"
  service_user="$(systemctl show "${SERVICE_NAME}" --property=User --value)"
  service_group="$(systemctl show "${SERVICE_NAME}" --property=Group --value)"
  fragment_path="$(systemctl show "${SERVICE_NAME}" --property=FragmentPath --value)"
  [[ "${service_user}" == "cxadmin" && "${service_group}" == "www-data" ]] \
    || die "legacy backend unit must run as cxadmin:www-data before baseline"
  [[ "$(realpath -e -- "${fragment_path}")" == "$(realpath -e -- "${SERVICE_FILE}")" ]] \
    || die "legacy backend unit fragment is not the fixed service file"
  systemctl is-active --quiet "${SERVICE_NAME}" || die "legacy backend service must be active before baseline"
  nginx -t || die "legacy NGINX configuration must pass before baseline"
  mkdir -m 0700 "${temporary}"
  if ! "${PYTHON_BIN}" -I - "${EUID}" "${temporary}" \
    "${SERVICE_FILE}" "${NGINX_SITE_FILE}" "${NGINX_LIMIT_FILE}" "${NGINX_HEADERS_FILE}" \
    "${NGINX_LINK_FILE}" <<'PY'
import errno, json, os, shutil, stat, sys

required_uid, destination = int(sys.argv[1]), sys.argv[2]
entries = (
    ("service", sys.argv[3], True, "cwscx-mystery-public-backend.service"),
    ("site", sys.argv[4], True, "cwscx-mystery-public"),
    ("limits", sys.argv[5], False, "cwscx-mystery-public-limits.conf"),
    ("headers", sys.argv[6], False, "cwscx-mystery-public-security-headers.conf"),
)
destination_fd = os.open(destination, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
presence = {}
modes = {}
try:
    for key, source, required, snapshot_name in entries:
        parent_fd = os.open(os.path.dirname(source), os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
        try:
            try:
                source_fd = os.open(os.path.basename(source), os.O_RDONLY | os.O_NOFOLLOW, dir_fd=parent_fd)
            except OSError as exc:
                if exc.errno == errno.ENOENT and not required:
                    presence[key] = False
                    continue
                raise
            try:
                info = os.fstat(source_fd)
                if not stat.S_ISREG(info.st_mode) or info.st_uid != required_uid or info.st_mode & 0o022:
                    raise SystemExit(f"unsafe baseline origin configuration: {source}")
                snapshot_fd = os.open(
                    snapshot_name,
                    os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW,
                    0o600,
                    dir_fd=destination_fd,
                )
                with os.fdopen(snapshot_fd, "wb") as target, os.fdopen(os.dup(source_fd), "rb") as origin:
                    shutil.copyfileobj(origin, target)
                    target.flush()
                    os.fsync(target.fileno())
                presence[key] = True
                modes[key] = info.st_mode & 0o777
            finally:
                os.close(source_fd)
        finally:
            os.close(parent_fd)
    # Inspect the directory entry without following it. O_NOFOLLOW on an
    # ordinary enabled-site symlink returns ELOOP, even when it is correct.
    link_path, site_path = sys.argv[7], sys.argv[4]
    link_fd = os.open(os.path.dirname(link_path), os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        try:
            link_info = os.stat(os.path.basename(link_path), dir_fd=link_fd, follow_symlinks=False)
        except FileNotFoundError:
            presence["enabled_link"] = False
        else:
            if not stat.S_ISLNK(link_info.st_mode) or link_info.st_uid != required_uid:
                raise SystemExit("unsafe enabled-site entry")
            if os.readlink(os.path.basename(link_path), dir_fd=link_fd) != site_path:
                raise SystemExit("enabled-site link does not target the fixed site")
            presence["enabled_link"] = True
    finally:
        os.close(link_fd)
    metadata_fd = os.open(
        "metadata.json",
        os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW,
        0o600,
        dir_fd=destination_fd,
    )
    with os.fdopen(metadata_fd, "w", encoding="utf-8") as handle:
        payload = json.dumps({"schema_version": 1, "present": presence, "modes": modes}, sort_keys=True) + "\n"
        handle.write(payload)
        handle.flush()
        os.fsync(handle.fileno())
    os.fsync(destination_fd)
finally:
    os.close(destination_fd)
PY
  then
    rm -rf -- "${temporary}"
    die "could not securely snapshot baseline origin configuration"
  fi
  fsync_directory "${temporary}"
  mv -T "${temporary}" "${BASELINE_RECOVERY_ROOT}"
  fsync_directory "${STATE_ROOT}"
}

preflight_baseline_origin() {
  local original_id="$1" release_dir working_directory exec_start environment_files launcher
  valid_release_id "${original_id}" || die "invalid pre-baseline release ID"
  release_dir="$(realpath -e -- "${RELEASES_ROOT}/${original_id}")" \
    || die "pre-baseline release path cannot be resolved"
  [[ "${release_dir}" == "${RELEASES_ROOT}/${original_id}" ]] \
    || die "pre-baseline release path is indirect or escapes releases root"
  require_root_dir "${release_dir}" "pre-baseline release directory"
  "${PYTHON_BIN}" -I - "${EUID}" "${TARGET_ROOT}" "${RELEASES_ROOT}" "${release_dir}" <<'PY'
import pathlib, stat, sys
required_uid = int(sys.argv[1])
for raw in sys.argv[2:]:
    path = pathlib.Path(raw)
    info = path.lstat()
    if not stat.S_ISDIR(info.st_mode) or info.st_uid != required_uid or info.st_mode & 0o022:
        raise SystemExit(f"unsafe pre-baseline path ownership or mode: {path}")
PY
  working_directory="$(systemctl show "${SERVICE_NAME}" --property=WorkingDirectory --value)"
  exec_start="$(systemctl show "${SERVICE_NAME}" --property=ExecStart --value)"
  environment_files="$(systemctl show "${SERVICE_NAME}" --property=EnvironmentFiles --value)"
  [[ -n "${working_directory}" && "$(realpath -e -- "${working_directory}")" == "${release_dir}"/* ]] \
    || die "legacy backend WorkingDirectory must resolve inside the pre-baseline release"
  launcher="$("${PYTHON_BIN}" -I - "${exec_start}" <<'PY'
import re, sys
match = re.search(r'(?:^|[ {;])path=([^ ;}]+)', sys.argv[1])
if not match: raise SystemExit(1)
print(match.group(1))
PY
)" || die "legacy backend ExecStart path could not be validated"
  [[ "$(realpath -e -- "${launcher}")" == "${release_dir}"/* ]] \
    || die "legacy backend ExecStart must resolve inside the pre-baseline release"
  require_root_file "${launcher}" "legacy backend launcher"
  require_root_dir "${working_directory}" "legacy backend WorkingDirectory"
  "${PYTHON_BIN}" -I - "${EUID}" "${release_dir}" "${working_directory}" "$(dirname "${launcher}")" <<'PY'
import pathlib, stat, sys
uid, release = int(sys.argv[1]), pathlib.Path(sys.argv[2])
for raw in sys.argv[3:]:
    path = pathlib.Path(raw)
    while True:
        info = path.lstat()
        if not stat.S_ISDIR(info.st_mode) or info.st_uid != uid or info.st_mode & 0o022:
            raise SystemExit(f"unsafe pre-baseline traversal component: {path}")
        if path == release: break
        if release not in path.parents:
            raise SystemExit(f"pre-baseline path escapes release: {path}")
        path = path.parent
PY
  [[ "${environment_files}" == *"${ENV_FILE}"* ]] \
    || die "legacy backend unit does not declare the fixed environment file"
  runuser -u cxadmin -g www-data -- test -x "${launcher}" \
    || die "legacy backend launcher is not executable as cxadmin:www-data"
  runuser -u cxadmin -g www-data -- test -x "${working_directory}" \
    || die "legacy backend WorkingDirectory is not traversable as cxadmin:www-data"
  # Restarting before the switch is the only reliable proof that the VM-local
  # legacy unit, launcher and root-read EnvironmentFile remain restartable.
  systemctl restart "${SERVICE_NAME}" \
    || die "legacy backend restartability preflight failed before baseline activation"
  for _ in $(seq 1 30); do
    if systemctl is-active --quiet "${SERVICE_NAME}" && curl -fsS http://127.0.0.1:8011/health/ready >/dev/null 2>&1; then
      nginx -t || die "legacy NGINX configuration failed pre-baseline validation"
      return 0
    fi
    sleep 1
  done
  die "legacy backend did not become ready after the pre-baseline restartability check"
}

remove_baseline_origin_snapshot() {
  [[ ! -e "${BASELINE_RECOVERY_ROOT}" ]] && return 0
  require_root_dir "${BASELINE_RECOVERY_ROOT}" "baseline recovery snapshot"
  rm -rf -- "${BASELINE_RECOVERY_ROOT}"
  fsync_directory "${STATE_ROOT}"
}

restore_baseline_origin_fixed() {
  local failed_id="$1" original_id="$2"
  valid_release_id "${failed_id}" && valid_release_id "${original_id}" || return 1
  require_root_dir "${RELEASES_ROOT}/${original_id}" "pre-baseline release directory" || return 1
  require_root_dir "${BASELINE_RECOVERY_ROOT}" "baseline recovery snapshot" || return 1
  echo "Baseline failed; restoring the pre-baseline origin with fixed root-owned recovery commands (it remains unverified): ${original_id}" >&2
  "${PYTHON_BIN}" -I - "${EUID}" "${BASELINE_RECOVERY_ROOT}" \
    "${SERVICE_FILE}" "${NGINX_SITE_FILE}" "${NGINX_LIMIT_FILE}" "${NGINX_HEADERS_FILE}" \
    "${NGINX_LINK_FILE}" <<'PY' || return 1
import json, os, shutil, stat, sys

required_uid, snapshot = int(sys.argv[1]), sys.argv[2]
entries = (
    ("service", sys.argv[3], "cwscx-mystery-public-backend.service"),
    ("site", sys.argv[4], "cwscx-mystery-public"),
    ("limits", sys.argv[5], "cwscx-mystery-public-limits.conf"),
    ("headers", sys.argv[6], "cwscx-mystery-public-security-headers.conf"),
)
snapshot_fd = os.open(snapshot, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
try:
    metadata_fd = os.open("metadata.json", os.O_RDONLY | os.O_NOFOLLOW, dir_fd=snapshot_fd)
    try:
        info = os.fstat(metadata_fd)
        if not stat.S_ISREG(info.st_mode) or info.st_uid != required_uid or info.st_mode & 0o077:
            raise SystemExit("unsafe baseline recovery metadata")
        with os.fdopen(os.dup(metadata_fd), encoding="utf-8") as handle:
            metadata = json.load(handle)
    finally:
        os.close(metadata_fd)
    expected_keys = {key for key, _, _ in entries}
    if set(metadata) != {"schema_version", "present", "modes"} or metadata["schema_version"] != 1:
        raise SystemExit("invalid baseline recovery metadata schema")
    if set(metadata["present"]) != expected_keys | {"enabled_link"} or any(type(value) is not bool for value in metadata["present"].values()):
        raise SystemExit("invalid baseline recovery presence metadata")
    if not metadata["present"]["service"] or not metadata["present"]["site"]:
        raise SystemExit("required baseline configuration was not present")
    # Reject a substituted enabled-site entry before restoring files.
    link_path, site_path = sys.argv[7], sys.argv[4]
    link_parent_fd = os.open(os.path.dirname(link_path), os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    link_name = os.path.basename(link_path)
    try:
        try:
            link_info = os.stat(link_name, dir_fd=link_parent_fd, follow_symlinks=False)
        except FileNotFoundError:
            link_info = None
        if link_info is not None:
            if not stat.S_ISLNK(link_info.st_mode) or link_info.st_uid != required_uid:
                raise SystemExit("enabled-site entry is unsafe for recovery")
            if os.readlink(link_name, dir_fd=link_parent_fd) != site_path:
                raise SystemExit("enabled-site link does not target the fixed site")
    finally:
        os.close(link_parent_fd)

    for key, destination, snapshot_name in entries:
        parent_fd = os.open(os.path.dirname(destination), os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
        try:
            name = os.path.basename(destination)
            if not metadata["present"][key]:
                try:
                    os.unlink(name, dir_fd=parent_fd)
                except FileNotFoundError:
                    pass
                os.fsync(parent_fd)
                continue
            source_fd = os.open(snapshot_name, os.O_RDONLY | os.O_NOFOLLOW, dir_fd=snapshot_fd)
            temporary_name = f".{name}.baseline-recovery.{os.getpid()}"
            try:
                info = os.fstat(source_fd)
                if not stat.S_ISREG(info.st_mode) or info.st_uid != required_uid or info.st_mode & 0o077:
                    raise SystemExit(f"unsafe baseline recovery configuration: {snapshot_name}")
                # Restore with original mode
                dest_mode = metadata["modes"].get(key, 0o644)
                destination_fd = os.open(
                    temporary_name,
                    os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW,
                    dest_mode,
                    dir_fd=parent_fd,
                )
                with os.fdopen(destination_fd, "wb") as target, os.fdopen(os.dup(source_fd), "rb") as origin:
                    shutil.copyfileobj(origin, target)
                    target.flush()
                    os.fsync(target.fileno())
                os.replace(temporary_name, name, src_dir_fd=parent_fd, dst_dir_fd=parent_fd)
                os.fsync(parent_fd)
            finally:
                os.close(source_fd)
                try:
                    os.unlink(temporary_name, dir_fd=parent_fd)
                except FileNotFoundError:
                    pass
        finally:
            os.close(parent_fd)
    link_parent_fd = os.open(os.path.dirname(link_path), os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        if metadata["present"]["enabled_link"]:
            temporary_link = f".{link_name}.baseline-recovery.{os.getpid()}"
            os.symlink(site_path, temporary_link, dir_fd=link_parent_fd)
            try:
                os.replace(temporary_link, link_name, src_dir_fd=link_parent_fd, dst_dir_fd=link_parent_fd)
            finally:
                try: os.unlink(temporary_link, dir_fd=link_parent_fd)
                except FileNotFoundError: pass
        else:
            try: os.unlink(link_name, dir_fd=link_parent_fd)
            except FileNotFoundError: pass
        os.fsync(link_parent_fd)
    finally:
        os.close(link_parent_fd)
finally:
    os.close(snapshot_fd)
PY
  switch_current "${original_id}" || return 1
  systemctl daemon-reload || return 1
  systemctl restart "${SERVICE_NAME}" || return 1
  nginx -t || return 1
  systemctl reload nginx || return 1
  for _ in $(seq 1 30); do
    if systemctl is-active --quiet "${SERVICE_NAME}" && curl -fsS http://127.0.0.1:8011/health/ready >/dev/null 2>&1; then
      "${PYTHON_BIN}" -I - "${EVIDENCE_ROOT}/recovery-${failed_id}.json" "${failed_id}" "${original_id}" <<'PY'
import json, os, sys
path, failed, restored=sys.argv[1:]
with open(path, "w", encoding="utf-8") as f:
    json.dump({"failed_release_id":failed,"restored_release_id":restored,"recovery":"fixed_config_snapshot","approved_fallback":False},f,sort_keys=True); f.write("\n")
os.chmod(path, 0o644)
PY
      fsync_file "${EVIDENCE_ROOT}/recovery-${failed_id}.json" || return 1
      fsync_directory "${EVIDENCE_ROOT}" || return 1
      return 0
    fi
    sleep 1
  done
  return 1
}

activate_and_verify() {
  local release_id="$1" evidence_file="$2" verify_status=0
  [[ "$(current_release_id)" == "${release_id}" ]] || return 1
  [[ "${evidence_file}" == "${EVIDENCE_ROOT}/"*.json && ! -L "${evidence_file}" ]] || return 1
  rm -f -- "${evidence_file}" || return 1
  "${BASH_BIN}" "${TARGET_ROOT}/current/scripts/linux/deploy_mystery_public_backend.sh" || return 1
  SERVER_NAME="${SERVER_NAME}" TLS_MODE="${TLS_MODE}" ENABLE_HSTS="${DEFAULT_ENABLE_HSTS}" \
    "${BASH_BIN}" "${TARGET_ROOT}/current/scripts/linux/deploy_mystery_public_nginx.sh" || return 1
  MYSTERY_PUBLIC_BASE_URL="${BASE_URL}" VERIFY_TLS_MODE="${TLS_MODE}" EVIDENCE_FILE="${evidence_file}" \
    "${BASH_BIN}" "${TARGET_ROOT}/current/scripts/linux/verify_mystery_public.sh" || verify_status=$?
  # Failed verification is evidence too. Make it retrievable by the unprivileged
  # SSH account before returning the verifier's status to recovery handling.
  [[ -f "${evidence_file}" && ! -L "${evidence_file}" ]] || return 1
  chmod 0644 "${evidence_file}" || return 1
  for config in "${SERVICE_FILE}" "${NGINX_SITE_FILE}" "${NGINX_LIMIT_FILE}" "${NGINX_HEADERS_FILE}"; do
    require_root_file "${config}" "activated configuration" || return 1
    fsync_file "${config}" || return 1
    fsync_directory "$(dirname "${config}")" || return 1
  done
  fsync_directory "$(dirname "${NGINX_LINK_FILE}")" || return 1
  fsync_file "${evidence_file}" || return 1
  fsync_directory "${EVIDENCE_ROOT}" || return 1
  return "${verify_status}"
}

recover_release() {
  local failed_id="$1" fallback_id="$2" recovery_evidence
  recovery_evidence="${EVIDENCE_ROOT}/recovery-${failed_id}.json"
  echo "Activation failed; restoring authenticated fallback ${fallback_id}" >&2
  verify_archived_installed "${fallback_id}" || return 1
  check_runtime_usable "${fallback_id}" || return 1
  check_db_compatible "${fallback_id}" || return 1
  switch_current "${fallback_id}" || return 1
  activate_and_verify "${fallback_id}" "${recovery_evidence}" || return 1
}

prune_evidence() {
  local kept=0 f
  while IFS= read -r f; do
    kept=$((kept + 1)); (( kept <= EVIDENCE_RETAIN_COUNT )) && continue
    [[ -f "${f}" && ! -L "${f}" ]] && rm -f -- "${f}"
  done < <(find "${EVIDENCE_ROOT}" -maxdepth 1 -type f -name '*.json' -printf '%T@ %p\n' | sort -rn -k1,1 | cut -d' ' -f2-)
}

remove_archive() {
  local id="$1" archive_dir
  valid_release_id "${id}" || return 1
  [[ ! -e "${ARCHIVE_ROOT}/${id}.pinned" ]] || return 1
  archive_dir="${ARCHIVE_ROOT}/${id}"
  [[ -d "${archive_dir}" && ! -L "${archive_dir}" ]] || return 1
  verify_archive "${id}" >/dev/null || return 1
  rm -rf -- "${archive_dir}" || return 1
  fsync_directory "${ARCHIVE_ROOT}"
}

discard_uncommitted_archive() {
  local id="$1" archive_dir
  valid_release_id "${id}" || return 1
  archive_dir="${ARCHIVE_ROOT}/${id}"
  [[ ! -e "${archive_dir}" ]] && return 0
  [[ -d "${archive_dir}" && ! -L "${archive_dir}" ]] || return 1
  rm -rf -- "${archive_dir}" || return 1
  fsync_directory "${ARCHIVE_ROOT}"
}

prune_archives() {
  local current="$1" previous="$2" target_count="$3" count id
  mapfile -t ids < <(find "${ARCHIVE_ROOT}" -mindepth 2 -maxdepth 2 -type f -name metadata.json -printf '%T@ %h\n' \
    | sort -rn -k1,1 | cut -d' ' -f2- | xargs -r -n1 basename)
  count="${#ids[@]}"
  for (( idx=count-1; idx>=0 && count>target_count; idx-- )); do
    id="${ids[$idx]}"
    [[ "${id}" == "${current}" || "${id}" == "${previous}" || -e "${ARCHIVE_ROOT}/${id}.pinned" ]] && continue
    if remove_archive "${id}"; then count=$((count - 1)); fi
  done
}

ensure_archive_capacity() {
  local incoming_size="$1" available
  available="$(df -B1 --output=avail "${ARCHIVE_ROOT}" | awk 'NR==2{print $1}')"
  [[ "${available}" =~ ^[0-9]+$ ]] || die "could not determine archive free space"
  (( available - incoming_size >= MIN_FREE_BYTES )) || die "archive would breach the 10 GiB free-space reserve"
}

CURRENT_ID="$(current_release_id)" || die "current release is missing or unsafe"
if [[ "${ACTION}" == "status" ]]; then
  [[ -z "${BUNDLE_PATH_RAW}${BUNDLE_SIGNATURE_PATH_RAW}${OPERATION_PATH_RAW}${OPERATION_SIGNATURE_PATH_RAW}" ]] || die "status accepts no operation or bundle arguments"
  ARCHIVE_APPROVED=false
  if verify_archived_installed "${CURRENT_ID}" 2>/dev/null; then ARCHIVE_APPROVED=true; fi
  REQUESTED_JSON=null
  if [[ -n "${STATUS_RELEASE_ID}" ]]; then
    valid_release_id "${STATUS_RELEASE_ID}" || die "invalid status release ID"
    REQUESTED_ARCHIVE_JSON="$(verify_archive "${STATUS_RELEASE_ID}" 2>/dev/null)" \
      || die "requested release is not an authenticated archive"
    REQUESTED_INSTALLED=false
    if [[ -e "${RELEASES_ROOT}/${STATUS_RELEASE_ID}" ]]; then
      verify_archived_installed "${STATUS_RELEASE_ID}" 2>/dev/null \
        || die "requested installed release does not match its authenticated archive"
      REQUESTED_INSTALLED=true
    fi
    REQUESTED_JSON="$("${PYTHON_BIN}" -I - "${REQUESTED_ARCHIVE_JSON}" "${REQUESTED_INSTALLED}" <<'PY'
import json, sys
archive = json.loads(sys.argv[1])
print(json.dumps({
    "release_id": archive["release_id"],
    "git_sha": archive["git_sha"],
    "bundle_sha256": archive["bundle_sha256"],
    "archive_status": archive["archive_status"],
    "archive_verified_at_utc": archive["archive_verified_at_utc"],
    "signed_archive_verified": True,
    "installed_release_present": sys.argv[2] == "true",
}, sort_keys=True))
PY
)"
  fi
  BASELINE_ID=""
  if [[ -e "${BASELINE_MARKER}" ]]; then BASELINE_ID="$(baseline_release_id)"; fi
  PENDING_JSON="$(transaction_json)" || die "active operation journal is invalid"
  "${PYTHON_BIN}" -I - "${RELEASES_ROOT}/${CURRENT_ID}/release-manifest.json" "${ARCHIVE_APPROVED}" "${REQUESTED_JSON}" "${BASELINE_ID}" "${PRIVILEGED_SUITE_VERSION}" "${PENDING_JSON}" <<'PY'
import json, sys
manifest = json.load(open(sys.argv[1], encoding="utf-8"))
requested = json.loads(sys.argv[3])
baseline_id = sys.argv[4] or None
pending = json.loads(sys.argv[6])
print(json.dumps({"release_id": manifest["release_id"], "git_sha": manifest["git_sha"], "privileged_suite_version": sys.argv[5], "signed_archive_verified": sys.argv[2] == "true", "baseline_established": baseline_id is not None, "baseline_release_id": baseline_id, "recovery_required": pending is not None, "pending_operation": pending, "requested_release": requested}, sort_keys=True))
PY
  exit 0
fi
[[ -z "${ACTION}${STATUS_RELEASE_ID}" ]] || die "signed operations do not accept --action or --release-id"
for flag in OPERATION_PATH_RAW OPERATION_SIGNATURE_PATH_RAW; do [[ -n "${!flag}" ]] || die "signed operation is missing ${flag}"; done
validate_tmp_path() {
  local raw="$1" pattern="$2" label="$3" resolved mode owner
  [[ "${raw}" =~ ${pattern} ]] || die "${label} path is not approved"
  [[ -f "${raw}" && ! -L "${raw}" ]] || die "${label} must be a regular file"
  resolved="$(realpath -e -- "${raw}")"; [[ "${resolved}" == "${raw}" ]] || die "${label} path is indirect"
  owner="$(stat -c '%U' "${raw}")"; [[ "${owner}" == "${SUDO_USER}" ]] || die "${label} must be owned by the deployment account"
  mode="$(stat -c '%a' "${raw}")"; (( 8#${mode} & 8#022 )) && die "${label} is group/world writable"
  return 0
}
validate_tmp_path "${OPERATION_PATH_RAW}" '^/tmp/[A-Za-z0-9][A-Za-z0-9._-]{0,199}\.json$' 'operation document'
validate_tmp_path "${OPERATION_SIGNATURE_PATH_RAW}" '^/tmp/[A-Za-z0-9][A-Za-z0-9._-]{0,199}\.json\.sig$' 'operation signature'
ROOT_OPERATION="$(mktemp "${INCOMING_ROOT}/operation.XXXXXX.json")"
ROOT_OPERATION_SIGNATURE="${ROOT_OPERATION}.sig"
OPERATION_JSON="$(mktemp "${INCOMING_ROOT}/authorized.XXXXXX.json")"
ROOT_BUNDLE=""; ROOT_BUNDLE_SIGNATURE=""; MANIFEST_JSON=""
RECOVERY_ARMED=0; RECOVERY_MODE=""; RECOVERY_ORIGINAL_ID=""; RECOVERY_FAILED_ID=""; RECOVERY_AUTHORIZATION_SHA256=""
PREACTIVATION_ID=""
arm_recovery() {
  RECOVERY_MODE="$1"; RECOVERY_ORIGINAL_ID="$2"; RECOVERY_FAILED_ID="$3"; RECOVERY_AUTHORIZATION_SHA256="$4"
  write_transaction "${RECOVERY_MODE}" "${RECOVERY_ORIGINAL_ID}" "${RECOVERY_FAILED_ID}" "${RECOVERY_AUTHORIZATION_SHA256}"
  RECOVERY_ARMED=1
}
load_recovery() {
  local values
  mapfile -t values < <(read_transaction) || return 1
  [[ "${#values[@]}" -eq 4 ]] || return 1
  RECOVERY_MODE="${values[0]}"; RECOVERY_ORIGINAL_ID="${values[1]}"; RECOVERY_FAILED_ID="${values[2]}"; RECOVERY_AUTHORIZATION_SHA256="${values[3]}"
  RECOVERY_ARMED=1
}
recover_pending_operation() {
  [[ "${RECOVERY_ARMED}" -eq 1 ]] || return 0
  # baseline-release-id is the durable commit point. Re-authenticate the signed
  # archive and re-run activation/readiness before finalizing an interrupted
  # committed baseline; seeing the new symlink alone is never sufficient.
  if [[ "${RECOVERY_MODE}" == "baseline-origin" && -e "${BASELINE_MARKER}" ]]; then
    [[ "$(baseline_release_id)" == "${RECOVERY_FAILED_ID}" ]] || return 1
    [[ "$(current_release_id 2>/dev/null || true)" == "${RECOVERY_FAILED_ID}" ]] || return 1
    verify_archived_installed "${RECOVERY_FAILED_ID}" || return 1
    check_runtime_usable "${RECOVERY_FAILED_ID}" || return 1
    check_db_compatible "${RECOVERY_FAILED_ID}" || return 1
    activate_and_verify "${RECOVERY_FAILED_ID}" "${EVIDENCE_ROOT}/recovery-${RECOVERY_FAILED_ID}.json" || return 1
    clear_transaction || return 1
    RECOVERY_ARMED=0
    remove_baseline_origin_snapshot || echo "Committed baseline snapshot cleanup needs administrator review" >&2
    return 0
  fi
  if [[ "${RECOVERY_MODE}" == "signed-new" || "${RECOVERY_MODE}" == "baseline-origin" ]]; then
    discard_uncommitted_archive "${RECOVERY_FAILED_ID}" || return 1
  fi
  # Recovery is deliberately idempotent. Even when current already names the
  # origin (for example SIGKILL after the recovery switch), repeat archive/config
  # restoration, restart and readiness verification before clearing the journal.
  if [[ "${RECOVERY_MODE}" == "signed" || "${RECOVERY_MODE}" == "signed-new" ]]; then
    recover_release "${RECOVERY_FAILED_ID}" "${RECOVERY_ORIGINAL_ID}" || return 1
  elif [[ "${RECOVERY_MODE}" == "baseline-origin" ]]; then
    restore_baseline_origin_fixed "${RECOVERY_FAILED_ID}" "${RECOVERY_ORIGINAL_ID}" || return 1
  else
    return 1
  fi
  clear_transaction || return 1
  RECOVERY_ARMED=0
  if [[ "${RECOVERY_MODE}" == "baseline-origin" ]]; then
    remove_baseline_origin_snapshot || echo "Recovered baseline snapshot cleanup needs administrator review" >&2
  fi
}
remove_caller_file() {
  local raw="$1"
  [[ -n "${raw}" && -f "${raw}" && ! -L "${raw}" ]] || return 0
  [[ "$(stat -c '%U' -- "${raw}" 2>/dev/null)" == "${SUDO_USER}" ]] || return 0
  rm -f -- "${raw}"
}
cleanup() {
  local exit_status=$? keep_bundle=0
  set +e
  if ! recover_pending_operation; then
    echo "Interrupted operation could not restore its prior release; VM administrator action required" >&2
    exit_status=1
  fi
  if [[ -n "${PREACTIVATION_ID}" ]]; then
    if [[ -d "${RELEASES_ROOT}/${PREACTIVATION_ID}" ]] \
       && ! discard_pre_activation_candidate "${PREACTIVATION_ID}"; then
      echo "Unactivated candidate cleanup needs VM-administrator review" >&2
      exit_status=1; keep_bundle=1
    elif ! clear_preactivation_marker; then
      # Candidate is gone but the marker could not be cleared: a signed recover reconciles it.
      echo "Preactivation marker cleanup needs a signed recover" >&2
      exit_status=1; keep_bundle=1
    fi
  fi
  rm -f -- "${ROOT_OPERATION}" "${ROOT_OPERATION_SIGNATURE}" "${OPERATION_JSON}" "${MANIFEST_JSON}"
  # A surviving marker references the staged signed bundle for direct re-proof.
  if [[ "${keep_bundle}" -eq 0 ]]; then rm -f -- "${ROOT_BUNDLE}" "${ROOT_BUNDLE_SIGNATURE}"; fi
  remove_caller_file "${OPERATION_PATH_RAW}"
  remove_caller_file "${OPERATION_SIGNATURE_PATH_RAW}"
  remove_caller_file "${BUNDLE_PATH_RAW}"
  remove_caller_file "${BUNDLE_SIGNATURE_PATH_RAW}"
  exit "${exit_status}"
}
trap cleanup EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM
install -o root -g root -m 0600 -- "${OPERATION_PATH_RAW}" "${ROOT_OPERATION}"
install -o root -g root -m 0600 -- "${OPERATION_SIGNATURE_PATH_RAW}" "${ROOT_OPERATION_SIGNATURE}"
"${PYTHON_BIN}" -I "${RELEASE_GUARD}" authorize-operation "${ROOT_OPERATION}" "${ROOT_OPERATION_SIGNATURE}" \
  "${ALLOWED_SIGNERS}" "${NONCE_ROOT}" "${CURRENT_ID}" >"${OPERATION_JSON}"
readarray -t OPERATION_VALUES < <("${PYTHON_BIN}" -I - "${OPERATION_JSON}" <<'PY'
import json, sys
d=json.load(open(sys.argv[1], encoding="utf-8"))
for key in ("action", "target_release_id", "bundle_sha256", "current_release_id", "base_url", "tls_mode"):
    print(d[key])
PY
)
[[ "${#OPERATION_VALUES[@]}" -eq 6 ]] || die "authorized operation output is incomplete"
ACTION="${OPERATION_VALUES[0]}"; TARGET_RELEASE_ID="${OPERATION_VALUES[1]}"; BUNDLE_SHA256="${OPERATION_VALUES[2]}"
FALLBACK_RELEASE_ID="${OPERATION_VALUES[3]}"; BASE_URL="${OPERATION_VALUES[4]}"; TLS_MODE="${OPERATION_VALUES[5]}"
SERVER_NAME="${BASE_URL#https://}"

if [[ -e "${TRANSACTION_FILE}" ]]; then
  [[ "${ACTION}" == "recover" ]] || die "an interrupted operation requires an explicit signed recover action"
  [[ -z "${BUNDLE_PATH_RAW}${BUNDLE_SIGNATURE_PATH_RAW}" ]] || die "recover rejects deploy bundle arguments"
  mapfile -t PENDING_VALUES < <(read_transaction) || die "active operation journal is invalid"
  [[ "${#PENDING_VALUES[@]}" -eq 4 ]] || die "active operation journal is incomplete"
  [[ "${TARGET_RELEASE_ID}" == "${PENDING_VALUES[1]}" ]] || die "recover target does not match the journaled origin"
  [[ "${BUNDLE_SHA256}" == "${PENDING_VALUES[3]}" ]] || die "recover authorization checksum does not match the journal"
  load_recovery || die "could not load active operation journal"
  recover_pending_operation || die "GitHub-authorized crash recovery failed; VM administrator action required"
  # SIGKILL between journaling and marker removal can leave both; the journal
  # recovery above already restored the origin, so only reconcile the candidate.
  if [[ -e "${PREACTIVATION_MARKER}" || -L "${PREACTIVATION_MARKER}" ]]; then
    reconcile_preactivation_marker 0 || die "preactivation marker could not be reconciled; VM administrator action required"
  fi
  echo "GitHub-authorized interrupted operation recovery completed: ${RECOVERY_FAILED_ID} -> ${RECOVERY_ORIGINAL_ID}"
  exit 0
fi
if [[ -e "${PREACTIVATION_MARKER}" || -L "${PREACTIVATION_MARKER}" ]]; then
  [[ "${ACTION}" == "recover" ]] || die "an interrupted preactivation install requires an explicit signed recover action"
  [[ -z "${BUNDLE_PATH_RAW}${BUNDLE_SIGNATURE_PATH_RAW}" ]] || die "recover rejects deploy bundle arguments"
  load_preactivation_marker || die "preactivation marker is invalid; no release was deleted"
  [[ "${TARGET_RELEASE_ID}" == "${PREACT_ORIGIN_ID}" ]] || die "recover target does not match the marker origin"
  [[ "${BUNDLE_SHA256}" == "${PREACT_BUNDLE_SHA256}" ]] || die "recover authorization checksum does not match the marker"
  reconcile_preactivation_marker 1 || die "preactivation recovery failed; VM administrator action required"
  echo "GitHub-authorized interrupted preactivation recovery completed: ${PREACT_RELEASE_ID} -> ${PREACT_ORIGIN_ID}"
  exit 0
fi
[[ "${ACTION}" != "recover" ]] || die "no interrupted operation requires recovery"
prune_evidence

if [[ "${ACTION}" == "rollback" ]]; then
  [[ -z "${BUNDLE_PATH_RAW}${BUNDLE_SIGNATURE_PATH_RAW}" ]] || die "rollback rejects deploy bundle arguments"
  [[ "${TARGET_RELEASE_ID}" != "${CURRENT_ID}" ]] || die "rollback target is already current"
  # Recovery is possible only if both target and current are signed, verified archives.
  verify_archived_installed "${CURRENT_ID}"
  check_runtime_usable "${CURRENT_ID}"
  CURRENT_ARCHIVE_JSON="$(verify_archive "${CURRENT_ID}")"
  CURRENT_ARCHIVE_SHA256="$("${PYTHON_BIN}" -I -c 'import json,sys; print(json.loads(sys.argv[1])["bundle_sha256"])' "${CURRENT_ARCHIVE_JSON}")"
  TARGET_ARCHIVE_JSON="$(verify_archive "${TARGET_RELEASE_ID}")"
  [[ "$("${PYTHON_BIN}" -I -c 'import json,sys; print(json.loads(sys.argv[1])["bundle_sha256"])' "${TARGET_ARCHIVE_JSON}")" == "${BUNDLE_SHA256}" ]] \
    || die "authorized rollback bundle checksum does not match the target archive"
  if [[ -e "${RELEASES_ROOT}/${TARGET_RELEASE_ID}" ]]; then
    verify_archived_installed "${TARGET_RELEASE_ID}"
  else
    restore_archive_install_only "${TARGET_RELEASE_ID}" "${BUNDLE_SHA256}"
  fi
  check_runtime_usable "${TARGET_RELEASE_ID}"
  # Archive restoration builds the target's offline venv but does not activate;
  # use that venv for the read-only compatibility gate before changing current.
  check_db_compatible "${TARGET_RELEASE_ID}"
  arm_recovery signed "${CURRENT_ID}" "${TARGET_RELEASE_ID}" "${CURRENT_ARCHIVE_SHA256}"
  switch_current "${TARGET_RELEASE_ID}"
  EVIDENCE_FILE="${EVIDENCE_ROOT}/${TARGET_RELEASE_ID}.json"
  if ! activate_and_verify "${TARGET_RELEASE_ID}" "${EVIDENCE_FILE}"; then
    recover_pending_operation || die "rollback activation and automatic recovery both failed"
    die "rollback activation failed; previous release was restored"
  fi
  if ! chmod 0644 "${EVIDENCE_FILE}" || \
     ! store_previous_release_id "${CURRENT_ID}"; then
    recover_pending_operation || die "rollback bookkeeping failed and prior release recovery failed"
    die "rollback bookkeeping failed; prior release was restored"
  fi
  clear_transaction
  RECOVERY_ARMED=0
  prune_archives "${TARGET_RELEASE_ID}" "${CURRENT_ID}" "${ARCHIVE_RETAIN_COUNT}" || echo "Archive pruning needs administrator review" >&2
  echo "GitHub-authorized rollback verified: ${CURRENT_ID} -> ${TARGET_RELEASE_ID} (database unchanged)"
  exit 0
fi

# Bundle-bearing operations share signature, manifest, and collision checks.
[[ "${ACTION}" == "deploy" || "${ACTION}" == "establish_baseline" ]] || die "authorized operation action is invalid"
for flag in BUNDLE_PATH_RAW BUNDLE_SIGNATURE_PATH_RAW; do [[ -n "${!flag}" ]] || die "bundle operation is missing ${flag}"; done
validate_tmp_path "${BUNDLE_PATH_RAW}" '^/tmp/[A-Za-z0-9][A-Za-z0-9._-]{0,199}\.zip$' bundle
validate_tmp_path "${BUNDLE_SIGNATURE_PATH_RAW}" '^/tmp/[A-Za-z0-9][A-Za-z0-9._-]{0,199}\.zip\.sig$' 'bundle signature'
ROOT_BUNDLE="$(mktemp "${INCOMING_ROOT}/bundle.XXXXXX.zip")"; ROOT_BUNDLE_SIGNATURE="${ROOT_BUNDLE}.sig"
MANIFEST_JSON="$(mktemp "${INCOMING_ROOT}/manifest.XXXXXX.json")"
install -o root -g root -m 0600 -- "${BUNDLE_PATH_RAW}" "${ROOT_BUNDLE}"
install -o root -g root -m 0600 -- "${BUNDLE_SIGNATURE_PATH_RAW}" "${ROOT_BUNDLE_SIGNATURE}"
"${PYTHON_BIN}" -I "${RELEASE_GUARD}" verify-bundle "${ROOT_BUNDLE}" "${BUNDLE_SHA256}" "${ROOT_BUNDLE_SIGNATURE}" "${ALLOWED_SIGNERS}" >"${MANIFEST_JSON}"
NEW_ID="$("${PYTHON_BIN}" -I -c 'import json,sys; print(json.load(open(sys.argv[1]))["release_id"])' "${MANIFEST_JSON}")"
valid_release_id "${NEW_ID}" || die "signed manifest release ID is invalid"
[[ "${NEW_ID}" == "${TARGET_RELEASE_ID}" ]] || die "authorized target release differs from signed bundle"
[[ ! -e "${ARCHIVE_ROOT}/${NEW_ID}" ]] || die "archive already exists for this release; administrator review required"
ensure_archive_capacity "$(stat -c '%s' "${ROOT_BUNDLE}")"

if [[ "${ACTION}" == "establish_baseline" ]]; then
  # This one-time path deliberately does not trust or archive the existing
  # release. It is authorized against its exact live ID and may restore that
  # old release operationally after failure, but it never signs or archives it.
  [[ "${FALLBACK_RELEASE_ID}" == "${CURRENT_ID}" ]] || die "baseline authorization is stale"
  [[ ! -e "${BASELINE_MARKER}" ]] || die "a first baseline has already been established; use normal deploy"
  if verify_archived_installed "${CURRENT_ID}" 2>/dev/null; then
    die "current release is already an authenticated fallback; use normal deploy"
  fi
  archive_root_is_empty || die "application archive directory is not empty; VM administrator review required"
  # A prior completed recovery can be killed after journal removal but before
  # best-effort snapshot cleanup. With no journal and no baseline marker, that
  # snapshot is stale and must not block a fresh, fully preflighted attempt.
  remove_baseline_origin_snapshot
  preflight_baseline_origin "${CURRENT_ID}"
  write_preactivation_marker establish_baseline "${NEW_ID}" "${BUNDLE_SHA256}" "${CURRENT_ID}" \
    "${ROOT_BUNDLE}" "${ROOT_BUNDLE_SIGNATURE}" \
    || die "could not record the preactivation marker; the unverified existing release remains current"
  PREACTIVATION_ID="${NEW_ID}"
  if ! EXPECTED_BUNDLE_SHA256="${BUNDLE_SHA256}" "${BASH_BIN}" "${INSTALLER}" --install-only "${ROOT_BUNDLE}"; then
    die "baseline installation failed before activation; the unverified existing release remains current"
  fi
  if ! "${PYTHON_BIN}" -I "${RELEASE_GUARD}" verify-installed-bundle \
    "${RELEASES_ROOT}/${NEW_ID}" "${ROOT_BUNDLE}" "${NEW_ID}" >/dev/null; then
    discard_pre_activation_candidate "${NEW_ID}" || die "baseline integrity failed; candidate cleanup requires VM-admin review"
    die "baseline installed files differ from the signed bundle; the unverified existing release remains current"
  fi
  check_runtime_usable "${NEW_ID}" || die "baseline virtualenv is unusable before activation; the unverified existing release remains current"
  if ! check_db_compatible "${NEW_ID}"; then
    discard_pre_activation_candidate "${NEW_ID}" || die "baseline head check failed; candidate cleanup requires VM-admin review"
    die "baseline database compatibility check failed before activation; the unverified existing release remains current"
  fi
  mark_preactivation_install_verified || die "could not record the verified installation; the unverified existing release remains current"
  snapshot_baseline_origin_config
  arm_recovery baseline-origin "${CURRENT_ID}" "${NEW_ID}" "${BUNDLE_SHA256}"
  release_preactivation_candidate || die "could not clear the preactivation marker after journaling"
  switch_current "${NEW_ID}"
  EVIDENCE_FILE="${EVIDENCE_ROOT}/${NEW_ID}.json"
  if ! activate_and_verify "${NEW_ID}" "${EVIDENCE_FILE}"; then
    recover_pending_operation || die "baseline activation failed and the pre-baseline release could not be restored operationally; VM administrator recovery is required"
    die "baseline activation failed; the pre-baseline release was restored operationally but remains unverified and unarchived"
  fi
  VERIFIED_AT="$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
  if ! chmod 0644 "${EVIDENCE_FILE}" || \
     ! "${PYTHON_BIN}" -I "${RELEASE_GUARD}" store-archive "${ARCHIVE_ROOT}" "${ROOT_BUNDLE}" "${ROOT_BUNDLE_SIGNATURE}" "${MANIFEST_JSON}" "${VERIFIED_AT}" || \
     ! "${PYTHON_BIN}" -I "${RELEASE_GUARD}" verify-archive "${ARCHIVE_ROOT}" "${NEW_ID}" "${ALLOWED_SIGNERS}" >/dev/null || \
     ! store_baseline_marker "${NEW_ID}"; then
    discard_uncommitted_archive "${NEW_ID}" || die "baseline bookkeeping failed and its uncommitted archive could not be removed; VM administrator recovery is required"
    recover_pending_operation || die "baseline bookkeeping failed and the pre-baseline release could not be restored operationally; VM administrator recovery is required"
    die "baseline bookkeeping failed; the pre-baseline release was restored operationally but remains unverified and unarchived"
  fi
  clear_transaction
  RECOVERY_ARMED=0
  remove_baseline_origin_snapshot || echo "Baseline snapshot cleanup needs administrator review" >&2
  echo "First GitHub-controlled baseline verified and signed application archive stored: ${NEW_ID} (database unchanged)"
  exit 0
fi

# Every normal deploy requires an explicitly approved, signed, installed
# fallback. Only the separate one-time establish_baseline operation may proceed
# without one; failed normal releases are never auto-promoted or archived.
verify_archived_installed "${FALLBACK_RELEASE_ID}"
check_runtime_usable "${FALLBACK_RELEASE_ID}"
FALLBACK_ARCHIVE_JSON="$(verify_archive "${FALLBACK_RELEASE_ID}")"
FALLBACK_ARCHIVE_SHA256="$("${PYTHON_BIN}" -I -c 'import json,sys; print(json.loads(sys.argv[1])["bundle_sha256"])' "${FALLBACK_ARCHIVE_JSON}")"
check_db_compatible "${FALLBACK_RELEASE_ID}"
# Install and validate the new signed tree while the old release stays live.
# A manifest assertion against the old fallback's source graph is insufficient:
# the new release must prove its own exact source/manifest/database head first.
write_preactivation_marker deploy "${NEW_ID}" "${BUNDLE_SHA256}" "${CURRENT_ID}" \
  "${ROOT_BUNDLE}" "${ROOT_BUNDLE_SIGNATURE}" \
  || die "could not record the preactivation marker; approved fallback remains current"
PREACTIVATION_ID="${NEW_ID}"
if ! EXPECTED_BUNDLE_SHA256="${BUNDLE_SHA256}" "${BASH_BIN}" "${INSTALLER}" --install-only "${ROOT_BUNDLE}"; then
  die "release installation failed before activation; approved fallback remains current"
fi
if ! "${PYTHON_BIN}" -I "${RELEASE_GUARD}" verify-installed-bundle \
  "${RELEASES_ROOT}/${NEW_ID}" "${ROOT_BUNDLE}" "${NEW_ID}" >/dev/null; then
  die "installed release differs from signed bundle before activation; approved fallback remains current"
fi
check_runtime_usable "${NEW_ID}" || die "new release virtualenv is unusable before activation; approved fallback remains current"
check_db_compatible "${NEW_ID}" || die "new release migration head is incompatible before activation; approved fallback remains current"
mark_preactivation_install_verified || die "could not record the verified installation; approved fallback remains current"
arm_recovery signed-new "${FALLBACK_RELEASE_ID}" "${NEW_ID}" "${FALLBACK_ARCHIVE_SHA256}"
release_preactivation_candidate || die "could not clear the preactivation marker after journaling"
switch_current "${NEW_ID}"
EVIDENCE_FILE="${EVIDENCE_ROOT}/${NEW_ID}.json"
if ! activate_and_verify "${NEW_ID}" "${EVIDENCE_FILE}"; then
  recover_pending_operation || die "new activation and automatic recovery both failed"
  die "new release activation failed; approved fallback was restored"
fi
VERIFIED_AT="$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
if ! chmod 0644 "${EVIDENCE_FILE}" || \
   ! "${PYTHON_BIN}" -I "${RELEASE_GUARD}" store-archive "${ARCHIVE_ROOT}" "${ROOT_BUNDLE}" "${ROOT_BUNDLE_SIGNATURE}" "${MANIFEST_JSON}" "${VERIFIED_AT}" || \
   ! "${PYTHON_BIN}" -I "${RELEASE_GUARD}" verify-archive "${ARCHIVE_ROOT}" "${NEW_ID}" "${ALLOWED_SIGNERS}" >/dev/null || \
   ! store_previous_release_id "${CURRENT_ID}"; then
  discard_uncommitted_archive "${NEW_ID}" || die "post-activation bookkeeping failed and its uncommitted archive could not be removed; VM administrator recovery is required"
  recover_pending_operation || die "post-activation bookkeeping failed and fallback recovery failed"
  die "post-activation archive/evidence failed; fallback restored; inspect partial archive before retry"
fi
clear_transaction
RECOVERY_ARMED=0
# Retention is maintenance after a durable signed archive exists. A prune
# failure must not convert a healthy archived release into a failed deploy.
prune_archives "${NEW_ID}" "${CURRENT_ID}" "${ARCHIVE_RETAIN_COUNT}" || echo "Archive pruning needs administrator review" >&2
echo "Deployment verified and signed application archive stored: ${NEW_ID} (database unchanged)"
