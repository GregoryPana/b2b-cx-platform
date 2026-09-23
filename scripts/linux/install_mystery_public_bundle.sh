#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: install_mystery_public_bundle.sh BUNDLE.zip" >&2
  exit 64
fi

BUNDLE_PATH="$(realpath "$1")"
TARGET_ROOT="${TARGET_ROOT:-/opt/cwscx-mystery-public}"
RELEASES_DIR="${TARGET_ROOT}/releases"
ENV_FILE="${TARGET_ROOT}/.env"
PYTHON_BIN="${PYTHON_BIN:-python3}"
EXTRACT_DIR="$(mktemp -d /tmp/cwscx-mystery-public-extract.XXXXXX)"
INCOMING_DIR=""

cleanup() {
  rm -rf "${EXTRACT_DIR}"
  if [[ -n "${INCOMING_DIR}" && -d "${INCOMING_DIR}" ]]; then rm -rf "${INCOMING_DIR}"; fi
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
FINAL_DIR="${RELEASES_DIR}/${RELEASE_ID}"
[[ ! -e "${FINAL_DIR}" ]] || { echo "Immutable release already exists: ${FINAL_DIR}" >&2; exit 1; }
INCOMING_DIR="$(mktemp -d "${RELEASES_DIR}/.${RELEASE_ID}.incoming.XXXXXX")"
cp -a "${BUNDLE_ROOT}/." "${INCOMING_DIR}/"

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

NEW_LINK="${TARGET_ROOT}/.current.${RELEASE_ID}.$$"
ln -s "releases/${RELEASE_ID}" "${NEW_LINK}"
mv -Tf "${NEW_LINK}" "${TARGET_ROOT}/current"
printf '%s\n' "${RELEASE_ID}" > "${TARGET_ROOT}/shared/last-installed-release-id"
chmod 0644 "${TARGET_ROOT}/shared/last-installed-release-id"

echo "Installed immutable release: ${FINAL_DIR}"
echo "Activated symlink: ${TARGET_ROOT}/current"
echo "Existing environment, shared data, and prior releases were preserved."
