#!/usr/bin/env bash
set -euo pipefail

OUTPUT_ZIP="${1:-/tmp/cwscx-release.zip}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
STAGE_ROOT="$(mktemp -d /tmp/cwscx-release-stage.XXXXXX)"
RELEASE_ROOT="${STAGE_ROOT}/release"

cleanup() {
  rm -rf "${STAGE_ROOT}"
}
trap cleanup EXIT

build_frontend() {
  local app_path="$1"
  local base_path="$2"
  local survey_type="${3:-B2B}"

  pushd "${app_path}" >/dev/null
  npm ci --no-audit --no-fund
  VITE_API_URL="/api" VITE_BASE_PATH="${base_path}" VITE_SURVEY_TYPE="${survey_type}" npm run build
  if [[ ! -f "dist/index.html" ]]; then
    echo "Missing build output: ${app_path}/dist/index.html"
    exit 1
  fi
  popd >/dev/null
}

mkdir -p "${RELEASE_ROOT}"
mkdir -p "${RELEASE_ROOT}/backend"
mkdir -p "${RELEASE_ROOT}/scripts"
mkdir -p "${RELEASE_ROOT}/frontends/internal-surveys/b2b"
mkdir -p "${RELEASE_ROOT}/frontends/internal-surveys/installation"
mkdir -p "${RELEASE_ROOT}/frontends/dashboard"

echo "Building dashboard frontend..."
build_frontend "${REPO_ROOT}/frontend/dashboard-blueprint" "/dashboard/"

echo "Building B2B survey frontend..."
build_frontend "${REPO_ROOT}/frontend/survey" "/surveys/b2b/" "B2B"
cp -r "${REPO_ROOT}/frontend/survey/dist" "${RELEASE_ROOT}/frontends/internal-surveys/b2b/dist"

echo "Building installation survey frontend..."
build_frontend "${REPO_ROOT}/frontend/survey" "/surveys/installation/" "Installation Assessment"
cp -r "${REPO_ROOT}/frontend/survey/dist" "${RELEASE_ROOT}/frontends/internal-surveys/installation/dist"

cp -r "${REPO_ROOT}/frontend/dashboard-blueprint/dist" "${RELEASE_ROOT}/frontends/dashboard/dist"

echo "Collecting backend and scripts..."
cp -r "${REPO_ROOT}/backend/app" "${RELEASE_ROOT}/backend/app"
cp -r "${REPO_ROOT}/backend/alembic" "${RELEASE_ROOT}/backend/alembic"
cp -r "${REPO_ROOT}/backend/scripts" "${RELEASE_ROOT}/backend/scripts"
cp "${REPO_ROOT}/backend/requirements.txt" "${RELEASE_ROOT}/backend/requirements.txt"
cp "${REPO_ROOT}/backend/alembic.ini" "${RELEASE_ROOT}/backend/alembic.ini"
cp -r "${REPO_ROOT}/scripts/linux" "${RELEASE_ROOT}/scripts/linux"
cp "${REPO_ROOT}/.env.example" "${RELEASE_ROOT}/.env.example"

# Copy brand assets
mkdir -p "${RELEASE_ROOT}/assets"
cp "${REPO_ROOT}/Cable-and-Wireless-Seychelles.png" "${RELEASE_ROOT}/assets/" 2>/dev/null || true
cp "${REPO_ROOT}/cable and wireless banner.png" "${RELEASE_ROOT}/assets/" 2>/dev/null || true

if [[ -f "${OUTPUT_ZIP}" ]]; then
  rm -f "${OUTPUT_ZIP}"
fi

mkdir -p "$(dirname "${OUTPUT_ZIP}")"
pushd "${STAGE_ROOT}" >/dev/null
zip -qr "${OUTPUT_ZIP}" release
popd >/dev/null

echo "Release bundle created: ${OUTPUT_ZIP}"
