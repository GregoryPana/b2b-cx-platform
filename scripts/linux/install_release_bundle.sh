#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: bash scripts/linux/install_release_bundle.sh /tmp/cwscx-release.zip"
  exit 1
fi

BUNDLE_PATH="$1"
TARGET_ROOT="/opt/cwscx"
TMP_DIR="$(mktemp -d /tmp/cwscx-release.XXXXXX)"

cleanup() {
  rm -rf "${TMP_DIR}"
}
trap cleanup EXIT

if [[ ! -f "${BUNDLE_PATH}" ]]; then
  echo "Bundle not found: ${BUNDLE_PATH}"
  exit 1
fi

unzip -q "${BUNDLE_PATH}" -d "${TMP_DIR}"

if [[ -d "${TMP_DIR}/release" ]]; then
  BUNDLE_ROOT="${TMP_DIR}/release"
else
  BUNDLE_ROOT="${TMP_DIR}"
fi

if [[ ! -d "${BUNDLE_ROOT}/frontends" ]]; then
  echo "Invalid bundle layout. Expected frontends/ at bundle root."
  exit 1
fi

require_frontend_dist() {
  local src_dir="$1"
  local name="$2"
  if [[ ! -f "${src_dir}/index.html" ]]; then
    echo "Missing build artifact for ${name}: ${src_dir}/index.html"
    exit 1
  fi
}

optional_frontend_dist() {
  local src_dir="$1"
  local name="$2"
  if [[ ! -f "${src_dir}/index.html" ]]; then
    echo "Optional frontend dist not present (skipping): ${name} (${src_dir}/index.html)"
    return 1
  fi
  return 0
}

mkdir -p "${TARGET_ROOT}/backend"
mkdir -p "${TARGET_ROOT}/frontends-src/public/mystery-shopper"
mkdir -p "${TARGET_ROOT}/frontends-src/dashboard"
mkdir -p "${TARGET_ROOT}/frontends-src/internal-surveys/b2b"
mkdir -p "${TARGET_ROOT}/frontends-src/internal-surveys/installation"
mkdir -p "${TARGET_ROOT}/shared"

if [[ ! -d "${BUNDLE_ROOT}/backend" ]]; then
  echo "Backend directory missing in bundle. This is required."
  exit 1
fi

if [[ ! -f "${BUNDLE_ROOT}/backend/requirements.txt" ]]; then
  echo "Backend requirements.txt missing in bundle. Cannot install dependencies."
  exit 1
fi

rsync -a --delete \
  --exclude 'venv' \
  --exclude 'logs' \
  "${BUNDLE_ROOT}/backend/" \
  "${TARGET_ROOT}/backend/"

if optional_frontend_dist "${BUNDLE_ROOT}/frontends/public/mystery-shopper/dist" "public/mystery-shopper"; then
  rsync -a --delete "${BUNDLE_ROOT}/frontends/public/mystery-shopper/dist/" "${TARGET_ROOT}/frontends-src/public/mystery-shopper/dist/"
fi

if optional_frontend_dist "${BUNDLE_ROOT}/frontends/dashboard/dist" "dashboard"; then
  rsync -a --delete "${BUNDLE_ROOT}/frontends/dashboard/dist/" "${TARGET_ROOT}/frontends-src/dashboard/dist/"
fi

if optional_frontend_dist "${BUNDLE_ROOT}/frontends/internal-surveys/b2b/dist" "internal-surveys/b2b"; then
  rsync -a --delete "${BUNDLE_ROOT}/frontends/internal-surveys/b2b/dist/" "${TARGET_ROOT}/frontends-src/internal-surveys/b2b/dist/"
fi

if optional_frontend_dist "${BUNDLE_ROOT}/frontends/internal-surveys/installation/dist" "internal-surveys/installation"; then
  rsync -a --delete "${BUNDLE_ROOT}/frontends/internal-surveys/installation/dist/" "${TARGET_ROOT}/frontends-src/internal-surveys/installation/dist/"
fi

mkdir -p "${TARGET_ROOT}/scripts/linux"
rsync -a --delete "${BUNDLE_ROOT}/scripts/linux/" "${TARGET_ROOT}/scripts/linux/"
chmod +x "${TARGET_ROOT}/scripts/linux/"*.sh

if [[ ! -f "${TARGET_ROOT}/.env" && -f "${BUNDLE_ROOT}/.env.example" ]]; then
  cp "${BUNDLE_ROOT}/.env.example" "${TARGET_ROOT}/.env"
  echo "Created ${TARGET_ROOT}/.env from bundle .env.example. Update secrets before start."
fi

echo "Release bundle installed under ${TARGET_ROOT}."

echo "Installed components summary:"
echo " - backend: $([ -d "${TARGET_ROOT}/backend" ] && echo 'yes' || echo 'no')"
echo " - mystery-shopper: $([ -f "${TARGET_ROOT}/frontends-src/public/mystery-shopper/dist/index.html" ] && echo 'yes' || echo 'no')"
echo " - dashboard: $([ -f "${TARGET_ROOT}/frontends-src/dashboard/dist/index.html" ] && echo 'yes' || echo 'no')"
echo " - b2b survey: $([ -f "${TARGET_ROOT}/frontends-src/internal-surveys/b2b/dist/index.html" ] && echo 'yes' || echo 'no')"
echo " - installation survey: $([ -f "${TARGET_ROOT}/frontends-src/internal-surveys/installation/dist/index.html" ] && echo 'yes' || echo 'no')"
echo " - scripts/linux: $([ -f "${TARGET_ROOT}/scripts/linux/deploy_backend.sh" ] && echo 'yes' || echo 'no')"
