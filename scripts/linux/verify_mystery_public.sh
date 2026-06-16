#!/usr/bin/env bash
# ============================================================================
# DMZ Preflight Verification — Mystery Public Deployment
# Run AFTER deploy to validate the DMZ VM is healthy.
# ============================================================================
set -euo pipefail

MYSTERY_PUBLIC_BASE_URL="${MYSTERY_PUBLIC_BASE_URL:-https://mystery.example.com}"
TARGET_ROOT="${TARGET_ROOT:-/opt/cwscx-mystery-public}"
errors=0

pass() { echo "[PASS] $1"; }
fail() { echo "[FAIL] $1"; errors=$((errors+1)); }

# ------------------------------------------------------------------
# 1. Core system checks
# ------------------------------------------------------------------
if [[ -d "${TARGET_ROOT}" ]]; then
  pass "Target root directory exists: ${TARGET_ROOT}"
else
  fail "Target root directory missing: ${TARGET_ROOT}"
fi

if [[ -f "${TARGET_ROOT}/.env" ]]; then
  pass "Environment file exists: ${TARGET_ROOT}/.env"
else
  fail "Environment file missing: ${TARGET_ROOT}/.env"
fi

# ------------------------------------------------------------------
# 2. Backend health (local)
# ------------------------------------------------------------------
if curl -fsS http://127.0.0.1:8011/health >/dev/null; then
  pass "Backend health endpoint reachable (local :8011)"
else
  fail "Backend health endpoint not reachable (local :8011)"
fi

# Check backend returns JSON with status
HEALTH_BODY=$(curl -fsS http://127.0.0.1:8011/health 2>/dev/null || echo "")
if echo "${HEALTH_BODY}" | python3 -c "import json,sys; d=json.load(sys.stdin); assert d.get('status') in ('ok','degraded'); assert 'version' in d" 2>/dev/null; then
  pass "Backend health response valid JSON"
else
  fail "Backend health response invalid or missing fields"
fi

# ------------------------------------------------------------------
# 3. Nginx
# ------------------------------------------------------------------
if command -v nginx &>/dev/null; then
  if nginx -t 2>&1 >/dev/null; then
    pass "Nginx configuration syntax OK"
  else
    fail "Nginx configuration syntax error"
  fi
else
  pass "Nginx not installed on this host (skip syntax check)"
fi

if systemctl is-active --quiet nginx 2>/dev/null; then
  pass "Nginx service is running"
else
  fail "Nginx service is NOT running"
fi

# ------------------------------------------------------------------
# 4. Frontend artifact
# ------------------------------------------------------------------
if [[ -f "${TARGET_ROOT}/frontends-src/public/mystery-shopper/dist/index.html" ]]; then
  pass "Mystery shopper frontend artifact exists"
else
  fail "Mystery shopper frontend artifact missing"
fi

# ------------------------------------------------------------------
# 5. Backend service
# ------------------------------------------------------------------
if systemctl is-active --quiet cwscx-mystery-public-backend 2>/dev/null; then
  pass "Mystery public backend service is running"
else
  fail "Mystery public backend service is NOT running"
fi

# ------------------------------------------------------------------
# 6. Public endpoint health (via nginx)
# ------------------------------------------------------------------
if curl -kfsS "${MYSTERY_PUBLIC_BASE_URL}/api/health" >/dev/null 2>&1; then
  pass "Public API health reachable via nginx"
else
  fail "Public API health unreachable via nginx"
fi

if curl -kfsS "${MYSTERY_PUBLIC_BASE_URL}/" >/dev/null 2>&1; then
  pass "Public mystery frontend route reachable"
else
  fail "Public mystery frontend route unreachable"
fi

# ------------------------------------------------------------------
# 7. Auth endpoints smoke test (public)
# ------------------------------------------------------------------
# Health should return 200 without auth
HEALTH_CODE=$(curl -sk -o /dev/null -w "%{http_code}" "${MYSTERY_PUBLIC_BASE_URL}/api/health" 2>/dev/null || echo "000")
if [[ "${HEALTH_CODE}" == "200" || "${HEALTH_CODE}" == "503" ]]; then
  pass "Health endpoint HTTP ${HEALTH_CODE}"
else
  fail "Health endpoint unexpected HTTP ${HEALTH_CODE}"
fi

# Session endpoint should return 401 without cookies
SESSION_CODE=$(curl -sk -o /dev/null -w "%{http_code}" "${MYSTERY_PUBLIC_BASE_URL}/api/auth/session" 2>/dev/null || echo "000")
if [[ "${SESSION_CODE}" == "401" ]]; then
  pass "Session endpoint correctly returns 401 without auth"
else
  fail "Session endpoint expected 401 but got ${SESSION_CODE}"
fi

# ------------------------------------------------------------------
# 8. Database connectivity (if psql available)
# ------------------------------------------------------------------
if command -v psql &>/dev/null; then
  DB_URL=$(grep -E '^DATABASE_URL=' "${TARGET_ROOT}/.env" 2>/dev/null | tail -n1 | cut -d'=' -f2- | sed 's/\r$//' || true)
  if [[ -n "${DB_URL}" ]]; then
    if PGPASSWORD="${DB_URL}" psql "${DB_URL}" -c "SELECT 1" &>/dev/null; then
      pass "Database connection OK"
    else
      fail "Database connection FAILED"
    fi
  else
    pass "DATABASE_URL not found in .env (skip DB check)"
  fi
else
  pass "psql not available (skip DB connectivity check)"
fi

# ------------------------------------------------------------------
# Summary
# ------------------------------------------------------------------
echo ""
if [[ $errors -eq 0 ]]; then
  echo "=== All ${errors} preflight checks passed. ==="
  exit 0
else
  echo "=== ${errors} preflight check(s) FAILED. ==="
  exit 1
fi
