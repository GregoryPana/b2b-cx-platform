#!/usr/bin/env bash
set -euo pipefail

MYSTERY_PUBLIC_BASE_URL="${MYSTERY_PUBLIC_BASE_URL:-https://mystery.example.com}"
TARGET_ROOT="${TARGET_ROOT:-/opt/cwscx-mystery-public}"
errors=0

pass() { echo "[PASS] $1"; }
fail() { echo "[FAIL] $1"; errors=$((errors+1)); }

if curl -fsS http://127.0.0.1:8011/health >/dev/null; then
  pass "Backend health endpoint reachable (local)"
else
  fail "Backend health endpoint not reachable (local)"
fi

if sudo nginx -t >/dev/null 2>&1; then
  pass "Nginx configuration syntax OK"
else
  fail "Nginx configuration syntax error"
fi

if [[ -f "${TARGET_ROOT}/frontends-src/public/mystery-shopper/dist/index.html" ]]; then
  pass "Mystery shopper artifact exists"
else
  fail "Mystery shopper artifact missing"
fi

if curl -kfsS "${MYSTERY_PUBLIC_BASE_URL}/api/health" >/dev/null; then
  pass "Public API health reachable"
else
  fail "Public API health unreachable"
fi

if curl -kfsS "${MYSTERY_PUBLIC_BASE_URL}/" >/dev/null; then
  pass "Public mystery route reachable"
else
  fail "Public mystery route unreachable"
fi

if [[ $errors -eq 0 ]]; then
  echo "All required checks passed."
  exit 0
fi

echo "$errors required check(s) failed."
exit 1
