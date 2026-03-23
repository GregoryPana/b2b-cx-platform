#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="${REPO_DIR:-/opt/cwscx}"
FRONTENDS_ROOT="${REPO_DIR}/frontends-src"

optional_dist() {
  local app_dir="$1"
  if [[ ! -f "${app_dir}/dist/index.html" ]]; then
    echo "Optional frontend dist not present (skipping): ${app_dir}/dist/index.html"
  fi
}

require_dist() {
  local app_dir="$1"
  if [[ ! -f "${app_dir}/dist/index.html" ]]; then
    echo "Missing build artifact: ${app_dir}/dist/index.html"
    echo "Deploy frontend artifacts first (artifact-based deployment)."
    exit 1
  fi
}

require_dist "${FRONTENDS_ROOT}/dashboard"
require_dist "${FRONTENDS_ROOT}/internal-surveys/b2b"
require_dist "${FRONTENDS_ROOT}/internal-surveys/installation"

# Mystery shopper is a later phase. Keep the directory, but do not block deployments if it is not built yet.
optional_dist "${FRONTENDS_ROOT}/public/mystery-shopper"

echo "All frontend dist artifacts are present."
echo "Nginx serves artifacts directly from /opt/cwscx/frontends-src/.../dist"
echo "Frontend deployment validation complete."

echo "Frontend deployment complete."
