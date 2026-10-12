#!/usr/bin/env bash
set -euo pipefail

INSTALL_ONLY=0
if [[ "${1:-}" == "--install-only" ]]; then
  INSTALL_ONLY=1
  shift
fi
if [[ $# -ne 1 ]]; then
  echo "Usage: install_mystery_public_bundle.sh [--install-only] BUNDLE.zip" >&2
  exit 64
fi

BUNDLE_PATH="$(realpath "$1")"
TARGET_ROOT="${TARGET_ROOT:-/opt/cwscx-mystery-public}"
RELEASES_DIR="${TARGET_ROOT}/releases"
ENV_FILE="${TARGET_ROOT}/.env"
PYTHON_BIN="${PYTHON_BIN:-python3}"
EXTRACT_DIR="$(mktemp -d /tmp/cwscx-mystery-public-extract.XXXXXX)"
INCOMING_DIR=""
FINAL_DIR=""
FINALIZED=0

cleanup() {
  rm -rf "${EXTRACT_DIR}"
  if [[ -n "${INCOMING_DIR}" && -d "${INCOMING_DIR}" ]]; then rm -rf "${INCOMING_DIR}"; fi
  # A signal after the immutable directory rename but before the offline venv
  # and access checks finish must not leave a partial release behind.
  if [[ "${FINALIZED}" -eq 0 && -n "${FINAL_DIR}" && -d "${FINAL_DIR}" ]]; then rm -rf "${FINAL_DIR}"; fi
}
trap cleanup EXIT

[[ -f "${BUNDLE_PATH}" ]] || { echo "Bundle not found" >&2; exit 1; }
[[ -f "${ENV_FILE}" ]] || { echo "Required environment file is missing: ${ENV_FILE}" >&2; exit 1; }
if [[ -n "${EXPECTED_BUNDLE_SHA256:-}" ]]; then
  [[ "${EXPECTED_BUNDLE_SHA256}" =~ ^[0-9a-f]{64}$ ]] || { echo "Invalid EXPECTED_BUNDLE_SHA256" >&2; exit 1; }
  ACTUAL_BUNDLE_SHA256="$(sha256sum "${BUNDLE_PATH}" | cut -d' ' -f1)"
  [[ "${ACTUAL_BUNDLE_SHA256}" == "${EXPECTED_BUNDLE_SHA256}" ]] || { echo "Bundle checksum mismatch" >&2; exit 1; }
fi

"${PYTHON_BIN}" - "${BUNDLE_PATH}" "${EXTRACT_DIR}" <<'PY'
import pathlib
import sys
import zipfile
archive = pathlib.Path(sys.argv[1])
dest = pathlib.Path(sys.argv[2]).resolve()
with zipfile.ZipFile(archive) as zf:
    for item in zf.infolist():
        target = (dest / item.filename).resolve()
        if dest not in target.parents and target != dest:
            raise SystemExit("Unsafe archive path")
    zf.extractall(dest)
PY
BUNDLE_ROOT="${EXTRACT_DIR}/release"
[[ -f "${BUNDLE_ROOT}/release-manifest.json" && -f "${BUNDLE_ROOT}/SHA256SUMS" ]] || { echo "Bundle metadata missing" >&2; exit 1; }

pushd "${BUNDLE_ROOT}" >/dev/null
sha256sum --check --strict SHA256SUMS
popd >/dev/null

RELEASE_ID="$("${PYTHON_BIN}" - "${BUNDLE_ROOT}/release-manifest.json" <<'PY'
import json, re, sys
m = json.load(open(sys.argv[1], encoding="utf-8"))
required = {"schema_version", "release_id", "git_sha", "build_timestamp_utc", "frontend_auth_mode", "expected_migration_heads", "python_wheelhouse"}
missing = sorted(required - set(m))
if missing: raise SystemExit("Manifest missing fields: " + ", ".join(missing))
release_id = str(m["release_id"])
if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]{0,159}", release_id): raise SystemExit("Invalid release_id")
if not re.fullmatch(r"[0-9a-f]{40}", str(m["git_sha"])): raise SystemExit("Invalid git_sha")
if m["frontend_auth_mode"] != "mystery_public": raise SystemExit("Wrong frontend auth mode")
if not m["python_wheelhouse"] or not m["expected_migration_heads"]: raise SystemExit("Incomplete immutable-release metadata")
print(release_id)
PY
)"

mkdir -p "${RELEASES_DIR}" "${TARGET_ROOT}/shared"
CANDIDATE_DIR="${RELEASES_DIR}/${RELEASE_ID}"
[[ ! -e "${CANDIDATE_DIR}" ]] || { echo "Immutable release already exists: ${CANDIDATE_DIR}" >&2; exit 1; }
INCOMING_DIR="$(mktemp -d "${RELEASES_DIR}/.${RELEASE_ID}.incoming.XXXXXX")"
cp -a "${BUNDLE_ROOT}/." "${INCOMING_DIR}/"
FINAL_DIR="${CANDIDATE_DIR}"

find "${INCOMING_DIR}" -type d -exec chmod go-w {} +
find "${INCOMING_DIR}" -type f -exec chmod go-w {} +
mv "${INCOMING_DIR}" "${FINAL_DIR}"
INCOMING_DIR=""

# Create the virtualenv only after the release reaches its immutable final path;
# venv launcher shebangs embed absolute paths and would break if moved afterwards.
if ! "${PYTHON_BIN}" -m venv "${FINAL_DIR}/backend/venv"; then
  rm -rf "${FINAL_DIR}"
  exit 1
fi
if ! "${FINAL_DIR}/backend/venv/bin/python" -m pip install \
  --disable-pip-version-check \
  --no-index \
  --find-links "${FINAL_DIR}/wheelhouse" \
  -r "${FINAL_DIR}/backend/requirements.txt"; then
  rm -rf "${FINAL_DIR}"
  exit 1
fi
if ! "${FINAL_DIR}/backend/venv/bin/python" -m pip check; then
  rm -rf "${FINAL_DIR}"
  exit 1
fi

# The privileged entrypoint runs with umask 0027. Archive directories and
# wheelhouse-installed files can therefore be root:root 0750/0640: neither
# the systemd cxadmin:www-data service nor the www-data NGINX worker can read
# them. Grant read/traverse ONLY to the service group on the immutable release
# and the two code/asset trees; never touch .env, shared data, or other roots.
SERVICE_GROUP="${SERVICE_GROUP:-www-data}"
SERVICE_USER="${SERVICE_USER:-cxadmin}"
[[ "${SERVICE_GROUP}" == "www-data" && "${SERVICE_USER}" == "cxadmin" ]] || {
  echo "Unexpected Mystery service identity" >&2; exit 1;
}
chgrp "${SERVICE_GROUP}" "${FINAL_DIR}"
chmod g+rx,go-w "${FINAL_DIR}"
chgrp -R "${SERVICE_GROUP}" "${FINAL_DIR}/backend" "${FINAL_DIR}/frontends"
find "${FINAL_DIR}/backend" "${FINAL_DIR}/frontends" -type d -exec chmod g+rx,go-w {} +
find "${FINAL_DIR}/backend" "${FINAL_DIR}/frontends" -type f -exec chmod g+r,go-w {} +

# Check effective access BEFORE changing current. runuser drops root's
# discretionary-access bypass; the service group matches the generated unit.
check_readable_tree() {
  local user="$1" group="$2" tree="$3" blocked
  blocked="$(runuser -u "${user}" -g "${group}" -- \
    find -L "${tree}" \( -type d ! -executable -o -type f ! -readable -o -type l \) \
    -print -quit)" || return 1
  [[ -z "${blocked}" ]]
}
if ! runuser -u "${SERVICE_USER}" -g "${SERVICE_GROUP}" -- \
  test -x "${FINAL_DIR}/backend/venv/bin/uvicorn" || \
   ! check_readable_tree "${SERVICE_USER}" "${SERVICE_GROUP}" "${FINAL_DIR}/backend" || \
   ! check_readable_tree "www-data" "www-data" "${FINAL_DIR}/frontends" || \
   ! runuser -u "www-data" -g "www-data" -- \
  test -r "${FINAL_DIR}/frontends/public/mystery-shopper/dist/index.html"; then
  echo "Release access preflight failed; current release was not changed" >&2
  rm -rf "${FINAL_DIR}"
  exit 1
fi

# The directory is now a complete, locally usable immutable release. Mark it
# durable (file data, directory entries, then releases parent) before the
# optional activation step so power loss cannot expose a torn release tree.
"${PYTHON_BIN}" - "${FINAL_DIR}" "${RELEASES_DIR}" <<'PY'
import os, pathlib, sys
root = pathlib.Path(sys.argv[1])
for directory, _, files in os.walk(root):
    for name in files:
        path = pathlib.Path(directory) / name
        if path.is_symlink():
            continue
        fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
        try: os.fsync(fd)
        finally: os.close(fd)
for directory, _, _ in os.walk(root, topdown=False):
    fd = os.open(directory, os.O_RDONLY | os.O_DIRECTORY)
    try: os.fsync(fd)
    finally: os.close(fd)
fd = os.open(sys.argv[2], os.O_RDONLY | os.O_DIRECTORY)
try: os.fsync(fd)
finally: os.close(fd)
PY
FINALIZED=1

if [[ "${INSTALL_ONLY}" -eq 1 ]]; then
  echo "Installed immutable release without activation: ${FINAL_DIR}"
  echo "Existing current release, environment, shared data, and database were preserved."
  exit 0
fi

NEW_LINK="${TARGET_ROOT}/.current.${RELEASE_ID}.$$"
ln -s "releases/${RELEASE_ID}" "${NEW_LINK}"
mv -Tf "${NEW_LINK}" "${TARGET_ROOT}/current"
LAST_INSTALLED_TMP="${TARGET_ROOT}/shared/.last-installed-release-id.$$"
printf '%s\n' "${RELEASE_ID}" >"${LAST_INSTALLED_TMP}"
chmod 0644 "${LAST_INSTALLED_TMP}"
"${PYTHON_BIN}" - "${LAST_INSTALLED_TMP}" "${TARGET_ROOT}" "${TARGET_ROOT}/shared" <<'PY'
import os, sys
fd = os.open(sys.argv[1], os.O_RDONLY | os.O_NOFOLLOW)
try: os.fsync(fd)
finally: os.close(fd)
for path in sys.argv[2:]:
    fd = os.open(path, os.O_RDONLY | os.O_DIRECTORY)
    try: os.fsync(fd)
    finally: os.close(fd)
PY
mv -Tf "${LAST_INSTALLED_TMP}" "${TARGET_ROOT}/shared/last-installed-release-id"
"${PYTHON_BIN}" - "${TARGET_ROOT}/shared" <<'PY'
import os, sys
fd = os.open(sys.argv[1], os.O_RDONLY | os.O_DIRECTORY)
try: os.fsync(fd)
finally: os.close(fd)
PY

echo "Installed immutable release: ${FINAL_DIR}"
echo "Activated symlink: ${TARGET_ROOT}/current"
echo "Existing environment, shared data, and prior releases were preserved."
