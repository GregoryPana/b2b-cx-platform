#!/usr/bin/env bash
# Fixed, root-owned Mystery Public deployment entrypoint.
#
# This is the ONLY command sudoers may grant cxadmin NOPASSWD access to
# (see scripts/linux/bootstrap_mystery_public_deploy_entrypoint.sh). The
# sudoers rule names this absolute path only — it never grants bash, a
# shell, or any interpreter directly, so cxadmin can invoke exactly this
# fixed program and nothing else as root.
#
# It is installed once at /usr/local/sbin/cwscx-mystery-public-deploy,
# root:root, 0700, non-writable by anyone else. It never sources, evals, or
# executes any file the caller controls, and every path it touches is
# either a fixed constant, a value derived from the authenticated release
# manifest after bundle signature/checksum verification, or a strictly validated argument
# confined to /tmp.
#
# Deployment evidence is written under a fixed, root-owned directory
# (EVIDENCE_ROOT below), not /tmp. Because that directory is 0755 and
# root-owned, no other principal can create or replace a file inside it
# before this script (running as root) does, which removes the
# check-then-use race that a shared, world-writable /tmp would allow.
set -euo pipefail
umask 0027

die() { echo "cwscx-mystery-public-deploy: $*" >&2; exit 1; }

# --- Fixed, non-overridable locations -------------------------------------
readonly TARGET_ROOT="/opt/cwscx-mystery-public"
readonly ENV_FILE="${TARGET_ROOT}/.env"
readonly RELEASES_ROOT="${TARGET_ROOT}/releases"
readonly INSTALLER="/usr/local/libexec/cwscx-mystery-public/install_mystery_public_bundle.sh"
readonly BACKEND_SCRIPT="${TARGET_ROOT}/current/scripts/linux/deploy_mystery_public_backend.sh"
readonly NGINX_SCRIPT="${TARGET_ROOT}/current/scripts/linux/deploy_mystery_public_nginx.sh"
readonly VERIFY_SCRIPT="${TARGET_ROOT}/current/scripts/linux/verify_mystery_public.sh"
readonly ENABLE_HSTS="0"
readonly STATE_ROOT="/var/lib/cwscx-mystery-public"
readonly EVIDENCE_ROOT="${STATE_ROOT}/deploy-evidence"
readonly INCOMING_ROOT="${STATE_ROOT}/incoming"
readonly EVIDENCE_RETAIN_COUNT=20
readonly BASH_BIN="/usr/bin/bash"
readonly SSH_KEYGEN_BIN="/usr/bin/ssh-keygen"
readonly ALLOWED_SIGNERS="/etc/cwscx-mystery-public/deploy-allowed-signers"
readonly SIGNER_IDENTITY="github-actions"
readonly SIGNATURE_NAMESPACE="cwscx-mystery-public"

# --- Caller identity --------------------------------------------------------
[[ "${EUID}" -eq 0 ]] || die "must run as root (invoke via sudo)"
[[ -n "${SUDO_USER:-}" ]] || die "SUDO_USER is required; refusing a direct root login deploy"
[[ "${SUDO_USER}" != "root" ]] || die "SUDO_USER must be a real deployment user, not root"
id -u "${SUDO_USER}" >/dev/null 2>&1 || die "SUDO_USER ${SUDO_USER} does not resolve to a real account"

# --- Strict, explicit argument parsing --------------------------------------
declare -A SEEN=()
BUNDLE_PATH_RAW=""
BUNDLE_SHA256=""
SIGNATURE_PATH_RAW=""
BASE_URL=""
TLS_MODE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --bundle-path|--bundle-sha256|--signature-path|--base-url|--tls-mode)
      flag="$1"
      [[ -n "${SEEN[$flag]:-}" ]] && die "duplicate argument: ${flag}"
      SEEN["$flag"]=1
      [[ $# -ge 2 ]] || die "missing value for ${flag}"
      case "$flag" in
        --bundle-path) BUNDLE_PATH_RAW="$2" ;;
        --bundle-sha256) BUNDLE_SHA256="$2" ;;
        --signature-path) SIGNATURE_PATH_RAW="$2" ;;
        --base-url) BASE_URL="$2" ;;
        --tls-mode) TLS_MODE="$2" ;;
      esac
      shift 2
      ;;
    *)
      die "unknown argument: $1"
      ;;
  esac
done

for flag in --bundle-path --bundle-sha256 --signature-path --base-url --tls-mode; do
  [[ -n "${SEEN[$flag]:-}" ]] || die "missing required argument: ${flag}"
done

require_root_controlled_dir() {
  local path="$1" label="$2" owner mode
  [[ -d "${path}" && ! -L "${path}" ]] || die "${label} must be a real directory"
  owner="$(stat -c '%U' "${path}")"
  [[ "${owner}" == "root" ]] || die "${label} must be owned by root"
  mode="$(stat -c '%a' "${path}")"
  (( 8#${mode} & 8#022 )) && die "${label} must not be group- or world-writable"
  return 0
}

require_root_controlled_dir "${TARGET_ROOT}" "target root"
require_root_controlled_dir "${RELEASES_ROOT}" "releases root"
[[ -f "${ENV_FILE}" && ! -L "${ENV_FILE}" ]] || die "environment file is missing or unsafe"
[[ "$(stat -c '%U' "${ENV_FILE}")" == "root" ]] || die "environment file must be root-owned"
ENV_MODE="$(stat -c '%a' "${ENV_FILE}")"
[[ "${ENV_MODE}" == "600" || "${ENV_MODE}" == "640" ]] || die "environment file mode must be 600 or 640"

# --- Value validation --------------------------------------------------------
[[ "${BUNDLE_SHA256}" =~ ^[0-9a-f]{64}$ ]] || die "--bundle-sha256 must be 64 lowercase hex characters"
[[ "${TLS_MODE}" == "prepublic" || "${TLS_MODE}" == "trusted" ]] || die "--tls-mode must be prepublic or trusted"
[[ "${BASE_URL}" =~ ^https://[A-Za-z0-9.-]+$ ]] || die "--base-url must be an explicit HTTPS origin with no path"
SERVER_NAME="${BASE_URL#https://}"
[[ "${SERVER_NAME}" =~ ^[A-Za-z0-9.-]+$ ]] || die "derived server name is invalid"

validate_tmp_path() {
  # $1=raw path  $2=suffix regex fragment (already anchored)  $3=label
  local raw="$1" pattern="$2" label="$3"
  [[ "${raw}" =~ ${pattern} ]] || die "${label} path is not an approved /tmp filename"
  [[ -L "${raw}" ]] && die "${label} path must not be a symlink"
  [[ -e "${raw}" ]] || die "${label} path does not exist"
  local resolved
  resolved="$(realpath -e -- "${raw}")" || die "${label} path could not be resolved"
  [[ "${resolved}" == "${raw}" ]] || die "${label} path resolves outside its expected location"
  [[ -f "${resolved}" && ! -L "${resolved}" ]] || die "${label} path is not a regular file"
  local owner mode
  owner="$(stat -c '%U' "${resolved}")"
  [[ "${owner}" == "${SUDO_USER}" || "${owner}" == "root" ]] || die "${label} path has an unexpected owner: ${owner}"
  mode="$(stat -c '%a' "${resolved}")"
  (( 8#${mode} & 8#022 )) && die "${label} path must not be group- or world-writable"
  # The safe case makes the arithmetic test above false. Return success
  # explicitly so `set -e` does not terminate after valid input.
  return 0
}

# Confine the bundle path to a flat filename directly under /tmp; the regex
# charset excludes '/', '..' traversal, and shell metacharacters by
# construction. The bundle's own checksum is re-verified below, so a
# caller-controlled path is copied into root-owned storage and verified below.
validate_tmp_path "${BUNDLE_PATH_RAW}" '^/tmp/[A-Za-z0-9][A-Za-z0-9._-]{0,199}\.zip$' "bundle"
validate_tmp_path "${SIGNATURE_PATH_RAW}" '^/tmp/[A-Za-z0-9][A-Za-z0-9._-]{0,199}\.zip\.sig$' "signature"

CALLER_BUNDLE="$(realpath -e -- "${BUNDLE_PATH_RAW}")"
CALLER_SIGNATURE="$(realpath -e -- "${SIGNATURE_PATH_RAW}")"

# --- Fixed, root-owned evidence directory (no evidence ever lives in /tmp) --
[[ -e "${EVIDENCE_ROOT}" ]] || die "evidence root does not exist; run the bootstrap script first"
[[ -L "${EVIDENCE_ROOT}" ]] && die "evidence root must not be a symlink"
[[ -d "${EVIDENCE_ROOT}" ]] || die "evidence root is not a directory"
EVIDENCE_ROOT_OWNER="$(stat -c '%U' "${EVIDENCE_ROOT}")"
[[ "${EVIDENCE_ROOT_OWNER}" == "root" ]] || die "evidence root must be owned by root"
EVIDENCE_ROOT_MODE="$(stat -c '%a' "${EVIDENCE_ROOT}")"
(( 8#${EVIDENCE_ROOT_MODE} & 8#022 )) && die "evidence root must not be group- or world-writable"

[[ -d "${INCOMING_ROOT}" && ! -L "${INCOMING_ROOT}" ]] || die "incoming root is missing or unsafe; run the bootstrap script first"
INCOMING_ROOT_OWNER="$(stat -c '%U' "${INCOMING_ROOT}")"
[[ "${INCOMING_ROOT_OWNER}" == "root" ]] || die "incoming root must be owned by root"
INCOMING_ROOT_MODE="$(stat -c '%a' "${INCOMING_ROOT}")"
(( 8#${INCOMING_ROOT_MODE} & 8#077 )) && die "incoming root must not be accessible by group or world"

# Bound evidence retention up front rather than deleting the file this run
# produces: the workflow fetches it over SCP after this script exits, so
# nothing here may remove the current run's evidence before that happens.
prune_evidence() {
  local kept=0 f
  while IFS= read -r f; do
    kept=$((kept + 1))
    if (( kept > EVIDENCE_RETAIN_COUNT )); then
      [[ -f "${f}" && ! -L "${f}" ]] && rm -f -- "${f}"
    fi
  done < <(find "${EVIDENCE_ROOT}" -maxdepth 1 -type f -name '*.json' -printf '%T@ %p\n' 2>/dev/null \
              | sort -rn -k1,1 | cut -d' ' -f2-)
}
prune_evidence

# --- Fixed installer location must itself be root-owned and immutable ------
[[ -e "${INSTALLER}" ]] || die "installer is not installed at the fixed libexec path"
[[ -L "${INSTALLER}" ]] && die "installer path must not be a symlink"
[[ -f "${INSTALLER}" ]] || die "installer path is not a regular file"
INSTALLER_OWNER="$(stat -c '%U' "${INSTALLER}")"
[[ "${INSTALLER_OWNER}" == "root" ]] || die "installer must be owned by root"
INSTALLER_MODE="$(stat -c '%a' "${INSTALLER}")"
(( 8#${INSTALLER_MODE} & 8#022 )) && die "installer must not be group- or world-writable"

[[ -f "${ALLOWED_SIGNERS}" && ! -L "${ALLOWED_SIGNERS}" ]] || die "root-owned deploy allowed-signers file is missing or unsafe"
[[ "$(stat -c '%U' "${ALLOWED_SIGNERS}")" == "root" ]] || die "deploy allowed-signers file must be root-owned"
ALLOWED_SIGNERS_MODE="$(stat -c '%a' "${ALLOWED_SIGNERS}")"
(( 8#${ALLOWED_SIGNERS_MODE} & 8#022 )) && die "deploy allowed-signers file must not be group- or world-writable"

# --- Take ownership of the input before checksum/extraction -----------------
# Copy into a root-only directory first. The caller can race its own /tmp
# file, but cannot alter this copy; the checksum is calculated only over the
# root-owned copy that the installer subsequently opens.
ROOT_BUNDLE="$(mktemp "${INCOMING_ROOT}/bundle.XXXXXX.zip")"
ROOT_SIGNATURE="${ROOT_BUNDLE}.sig"
cleanup() {
  rm -f -- "${ROOT_BUNDLE}" "${ROOT_SIGNATURE}" "${CALLER_BUNDLE}" "${CALLER_SIGNATURE}"
}
trap cleanup EXIT
install -o root -g root -m 0600 -- "${CALLER_BUNDLE}" "${ROOT_BUNDLE}"
install -o root -g root -m 0600 -- "${CALLER_SIGNATURE}" "${ROOT_SIGNATURE}"
ACTUAL_SHA256="$(sha256sum -- "${ROOT_BUNDLE}" | cut -d' ' -f1)"
[[ "${ACTUAL_SHA256}" == "${BUNDLE_SHA256}" ]] || die "bundle checksum does not match --bundle-sha256"
"${SSH_KEYGEN_BIN}" -Y verify \
  -f "${ALLOWED_SIGNERS}" \
  -I "${SIGNER_IDENTITY}" \
  -n "${SIGNATURE_NAMESPACE}" \
  -s "${ROOT_SIGNATURE}" <"${ROOT_BUNDLE}" \
  || die "bundle signature is not authorized"

# --- Install the immutable release using the fixed, root-owned installer ---
# Invoked via a fixed interpreter path rather than relying on the executable
# bit surviving bundle extraction; the sudoers rule still names only this
# entrypoint, never bash itself, so this does not widen what cxadmin can run.
EXPECTED_BUNDLE_SHA256="${BUNDLE_SHA256}" TARGET_ROOT="${TARGET_ROOT}" "${BASH_BIN}" "${INSTALLER}" "${ROOT_BUNDLE}"

# --- Derive the evidence filename from the authenticated, just-installed release
#     manifest rather than from any caller-supplied path. ------------------
[[ -L "${TARGET_ROOT}/current" ]] || die "current release symlink missing after install"
CURRENT_REAL="$(realpath -e -- "${TARGET_ROOT}/current")" || die "current release symlink is broken"
[[ "${CURRENT_REAL}" == "${TARGET_ROOT}/releases/"* ]] || die "current release resolves outside the immutable releases directory"
require_root_controlled_dir "${CURRENT_REAL}" "current release directory"
MANIFEST="${TARGET_ROOT}/current/release-manifest.json"
[[ -f "${MANIFEST}" && ! -L "${MANIFEST}" ]] || die "release manifest missing after install"
RELEASE_ID="$(python3 - "${MANIFEST}" <<'PY'
import json, re, sys
m = json.load(open(sys.argv[1], encoding="utf-8"))
release_id = str(m["release_id"])
if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]{0,159}", release_id):
    raise SystemExit("Invalid release_id")
print(release_id)
PY
)"
[[ -n "${RELEASE_ID}" ]] || die "could not derive release_id from installed manifest"
EVIDENCE_FILE="${EVIDENCE_ROOT}/${RELEASE_ID}.json"
[[ -L "${EVIDENCE_FILE}" ]] && die "evidence file path must not be a symlink"
rm -f -- "${EVIDENCE_FILE}"

# --- Deploy backend, NGINX, then verify — all from the newly installed
#     immutable release, with only validated values in the environment.
#     Fixed /usr/bin/bash + a path inside the newly installed, root-owned
#     immutable release is safe here even if extraction did not preserve
#     the executable bit.
[[ -f "${BACKEND_SCRIPT}" && ! -L "${BACKEND_SCRIPT}" ]] || die "backend deploy script missing from installed release"
TARGET_ROOT="${TARGET_ROOT}" "${BASH_BIN}" "${BACKEND_SCRIPT}"

[[ -f "${NGINX_SCRIPT}" && ! -L "${NGINX_SCRIPT}" ]] || die "NGINX deploy script missing from installed release"
TARGET_ROOT="${TARGET_ROOT}" SERVER_NAME="${SERVER_NAME}" TLS_MODE="${TLS_MODE}" ENABLE_HSTS="${ENABLE_HSTS}" "${BASH_BIN}" "${NGINX_SCRIPT}"

[[ -f "${VERIFY_SCRIPT}" && ! -L "${VERIFY_SCRIPT}" ]] || die "verification script missing from installed release"
VERIFY_STATUS=0
TARGET_ROOT="${TARGET_ROOT}" MYSTERY_PUBLIC_BASE_URL="${BASE_URL}" VERIFY_TLS_MODE="${TLS_MODE}" EVIDENCE_FILE="${EVIDENCE_FILE}" \
  "${BASH_BIN}" "${VERIFY_SCRIPT}" || VERIFY_STATUS=$?

# Evidence stays root-owned (never chowned to the deploy user) but world
# readable so cxadmin can fetch it over SCP from the fixed evidence root.
if [[ -e "${EVIDENCE_FILE}" && ! -L "${EVIDENCE_FILE}" ]]; then
  chmod 0644 -- "${EVIDENCE_FILE}"
else
  die "verification did not produce fresh evidence"
fi

exit "${VERIFY_STATUS}"
