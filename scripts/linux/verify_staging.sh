#!/usr/bin/env bash
set -euo pipefail

echo "=== CWSCX Staging Verification ==="

STAGING_BASE_URL="${STAGING_BASE_URL:-https://cwscx-tst01.cwsey.com}"
STRICT_MYSTERY="${STRICT_MYSTERY:-false}"
errors=0
warnings=0

pass() { echo "[PASS] $1"; }
fail() { echo "[FAIL] $1"; errors=$((errors+1)); }
warn() { echo "[WARN] $1"; warnings=$((warnings+1)); }

require_artifact() {
  local path="$1"
  local name="$2"
  if [[ -f "$path/index.html" ]]; then
    pass "$name artifact exists"
  else
    fail "$name artifact missing: $path/index.html"
  fi
}

optional_artifact() {
  local path="$1"
  local name="$2"
  if [[ -f "$path/index.html" ]]; then
    pass "$name artifact exists"
    return 0
  fi
  warn "$name artifact missing (optional for staging): $path/index.html"
  return 1
}

require_url() {
  local url="$1"
  local name="$2"
  if curl -kfsS "$url" >/dev/null; then
    pass "$name reachable ($url)"
  else
    fail "$name unreachable ($url)"
  fi
}

check_asset_mime_not_html() {
  local asset_dir="$1"
  local asset_url_prefix="$2"
  local name="$3"

  local js_file
  js_file="$(ls -1 "$asset_dir"/*.js 2>/dev/null | head -n1 || true)"
  if [[ -z "$js_file" ]]; then
    fail "$name has no JS assets in $asset_dir"
    return
  fi

  local asset_name
  asset_name="$(basename "$js_file")"
  local headers
  headers="$(curl -kfsSI "${STAGING_BASE_URL}${asset_url_prefix}/${asset_name}" || true)"

  if [[ -z "$headers" ]]; then
    fail "$name JS asset not reachable: ${STAGING_BASE_URL}${asset_url_prefix}/${asset_name}"
    return
  fi

  if echo "$headers" | grep -qi "content-type: text/html"; then
    fail "$name JS asset is returning text/html (bad MIME): ${asset_name}"
  else
    pass "$name JS asset MIME is not text/html"
  fi
}

# Backend health
if curl -fsS http://127.0.0.1:8000/health >/dev/null; then
  pass "Backend health endpoint reachable (local)"
else
  fail "Backend health endpoint not reachable (local)"
fi

# Nginx config test
if sudo nginx -t >/dev/null 2>&1; then
  pass "Nginx configuration syntax OK"
else
  fail "Nginx configuration syntax error"
fi

# Frontend artifacts
require_artifact /opt/cwscx/frontends-src/dashboard/dist "Dashboard"
require_artifact /opt/cwscx/frontends-src/internal-surveys/b2b/dist "B2B Survey"
require_artifact /opt/cwscx/frontends-src/internal-surveys/installation/dist "Installation Survey"

if optional_artifact /opt/cwscx/frontends-src/public/mystery-shopper/dist "Mystery Shopper"; then
  require_url "${STAGING_BASE_URL}/" "Mystery Shopper route"
elif [[ "$STRICT_MYSTERY" == "true" ]]; then
  fail "Mystery Shopper is required (STRICT_MYSTERY=true), but artifact is missing"
fi

# Public route checks
require_url "${STAGING_BASE_URL}/api/health" "API health route"
require_url "${STAGING_BASE_URL}/dashboard/" "Dashboard route"
require_url "${STAGING_BASE_URL}/surveys/b2b/" "B2B survey route"
require_url "${STAGING_BASE_URL}/surveys/installation/" "Installation survey route"

# Static MIME checks for SPA assets
check_asset_mime_not_html "/opt/cwscx/frontends-src/dashboard/dist/assets" "/dashboard/assets" "Dashboard"
check_asset_mime_not_html "/opt/cwscx/frontends-src/internal-surveys/b2b/dist/assets" "/surveys/b2b/assets" "B2B survey"
check_asset_mime_not_html "/opt/cwscx/frontends-src/internal-surveys/installation/dist/assets" "/surveys/installation/assets" "Installation survey"

echo "=== Summary ==="
if [[ $errors -eq 0 ]]; then
  echo "All required checks passed."
  if [[ $warnings -gt 0 ]]; then
    echo "$warnings warning(s) reported."
  fi
  exit 0
fi

echo "$errors required check(s) failed."
exit 1
