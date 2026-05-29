#!/usr/bin/env bash
set -euo pipefail

OUTPUT_ZIP="${1:-/tmp/cwscx-mystery-public-release.zip}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
STAGE_ROOT="$(mktemp -d /tmp/cwscx-mystery-public-stage.XXXXXX)"
RELEASE_ROOT="${STAGE_ROOT}/release"

cleanup() {
  rm -rf "${STAGE_ROOT}"
}
trap cleanup EXIT

pushd "${REPO_ROOT}/frontend/mystery-shopper" >/dev/null
npm ci --no-audit --no-fund
VITE_API_URL="/api" VITE_BASE_PATH="/" VITE_APP_VERSION="$(git -C "${REPO_ROOT}" rev-parse --short HEAD)" npm run build
if [[ ! -f "dist/index.html" ]]; then
  echo "Missing mystery shopper build output"
  exit 1
fi
popd >/dev/null

mkdir -p "${RELEASE_ROOT}/backend"
mkdir -p "${RELEASE_ROOT}/frontends/public/mystery-shopper"
mkdir -p "${RELEASE_ROOT}/scripts/linux"

cp -r "${REPO_ROOT}/frontend/mystery-shopper/dist" "${RELEASE_ROOT}/frontends/public/mystery-shopper/dist"
cp -r "${REPO_ROOT}/backend/app" "${RELEASE_ROOT}/backend/app"
cp -r "${REPO_ROOT}/backend/alembic" "${RELEASE_ROOT}/backend/alembic"
cp -r "${REPO_ROOT}/backend/scripts" "${RELEASE_ROOT}/backend/scripts"
cp "${REPO_ROOT}/backend/requirements.txt" "${RELEASE_ROOT}/backend/requirements.txt"
cp "${REPO_ROOT}/backend/alembic.ini" "${RELEASE_ROOT}/backend/alembic.ini"
cp "${REPO_ROOT}/.env.example" "${RELEASE_ROOT}/.env.example"

cp "${REPO_ROOT}/scripts/linux/install_mystery_public_bundle.sh" "${RELEASE_ROOT}/scripts/linux/"
cp "${REPO_ROOT}/scripts/linux/deploy_mystery_public_backend.sh" "${RELEASE_ROOT}/scripts/linux/"
cp "${REPO_ROOT}/scripts/linux/deploy_mystery_public_nginx.sh" "${RELEASE_ROOT}/scripts/linux/"
cp "${REPO_ROOT}/scripts/linux/verify_mystery_public.sh" "${RELEASE_ROOT}/scripts/linux/"

if [[ -f "${OUTPUT_ZIP}" ]]; then
  rm -f "${OUTPUT_ZIP}"
fi

mkdir -p "$(dirname "${OUTPUT_ZIP}")"
pushd "${STAGE_ROOT}" >/dev/null
zip -qr "${OUTPUT_ZIP}" release
popd >/dev/null

echo "Release bundle created: ${OUTPUT_ZIP}"
