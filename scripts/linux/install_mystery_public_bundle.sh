#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: bash scripts/linux/install_mystery_public_bundle.sh /tmp/cwscx-mystery-public-release.zip"
  exit 1
fi

BUNDLE_PATH="$1"
TARGET_ROOT="${TARGET_ROOT:-/opt/cwscx-mystery-public}"
TMP_DIR="$(mktemp -d /tmp/cwscx-mystery-public.XXXXXX)"

cleanup() {
  rm -rf "${TMP_DIR}"
}
trap cleanup EXIT

unzip -q "${BUNDLE_PATH}" -d "${TMP_DIR}"
BUNDLE_ROOT="${TMP_DIR}/release"

mkdir -p "${TARGET_ROOT}/backend"
mkdir -p "${TARGET_ROOT}/frontends-src/public/mystery-shopper"
mkdir -p "${TARGET_ROOT}/scripts/linux"
mkdir -p "${TARGET_ROOT}/releases"
mkdir -p "${TARGET_ROOT}/shared"

rsync -a --delete --exclude 'venv' --exclude '__pycache__' --exclude '*.pyc' "${BUNDLE_ROOT}/backend/" "${TARGET_ROOT}/backend/"
rsync -a --delete "${BUNDLE_ROOT}/frontends/public/mystery-shopper/dist/" "${TARGET_ROOT}/frontends-src/public/mystery-shopper/dist/"
rsync -a --delete "${BUNDLE_ROOT}/scripts/linux/" "${TARGET_ROOT}/scripts/linux/"
chmod +x "${TARGET_ROOT}/scripts/linux/"*.sh

if [[ ! -f "${TARGET_ROOT}/.env" && -f "${BUNDLE_ROOT}/.env.example" ]]; then
  cp "${BUNDLE_ROOT}/.env.example" "${TARGET_ROOT}/.env"
  echo "Created ${TARGET_ROOT}/.env from .env.example"
fi

echo "Mystery public release installed under ${TARGET_ROOT}."
