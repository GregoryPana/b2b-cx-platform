#!/usr/bin/env bash
set -euo pipefail

echo "=== CWSCX Staging Verification ==="
errors=0

# Backend health
if curl -sf http://127.0.0.1:8000/health > /dev/null; then
  echo "[PASS] Backend health endpoint reachable"
else
  echo "[FAIL] Backend health endpoint not reachable"
  errors=$((errors+1))
fi

# Nginx config test
if sudo nginx -t > /dev/null 2>&1; then
  echo "[PASS] Nginx configuration syntax OK"
else
  echo "[FAIL] Nginx configuration syntax error"
  errors=$((errors+1))
fi

# Frontend artifacts
check_art() {
  local path="$1"
  local name="$2"
  if [[ -f "$path/index.html" ]]; then
    echo "[PASS] $name artifact exists"
  else
    echo "[FAIL] $name artifact missing: $path/index.html"
    errors=$((errors+1))
  fi
}

check_art /opt/cwscx/frontends-src/public/mystery-shopper/dist "Mystery Shopper"
check_art /opt/cwscx/frontends-src/dashboard/dist "Dashboard"
check_art /opt/cwscx/frontends-src/internal-surveys/b2b/dist "B2B Survey"
check_art /opt/cwscx/frontends-src/internal-surveys/installation/dist "Installation Survey"

echo "=== Summary ==="
if [[ $errors -eq 0 ]]; then
  echo "All checks passed."
  exit 0
else
  echo "$errors check(s) failed."
  exit 1
fi
