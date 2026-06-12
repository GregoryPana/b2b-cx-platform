#!/usr/bin/env bash
# Local dev stack launcher — run from repo root inside WSL
# Usage: bash scripts/dev/start_local_stack.sh [--restart]
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BACKEND_DIR="${REPO_ROOT}/backend"

DATABASE_URL="postgresql://b2b:b2b@localhost:5432/b2b"

# Load MYSTERY_AUTH_SECRET_KEY from backend/.env if present
MYSTERY_AUTH_SECRET_KEY=""
if [[ -f "${BACKEND_DIR}/.env" ]]; then
  MYSTERY_AUTH_SECRET_KEY="$(grep '^MYSTERY_AUTH_SECRET_KEY=' "${BACKEND_DIR}/.env" | cut -d= -f2-)"
fi

stop_services() {
  echo "[stop] Stopping any existing uvicorn on ports 8000/8011..."
  pkill -f "uvicorn app.main:app" 2>/dev/null || true
  sleep 1
}

start_backends() {
  echo "[start] Starting mystery_public backend on :8011..."
  nohup env \
    DATABASE_URL="${DATABASE_URL}" \
    AUTH_MODE="mystery_public" \
    MYSTERY_PUBLIC_BASE_URL="http://localhost:5177" \
    ENVIRONMENT="development" \
    MYSTERY_AUTH_SECRET_KEY="${MYSTERY_AUTH_SECRET_KEY}" \
    python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8011 \
    > /tmp/backend_8011.log 2>&1 &
  echo "[start] mystery_public backend PID=$!"

  echo "[start] Starting entra backend on :8000..."
  nohup env \
    DATABASE_URL="${DATABASE_URL}" \
    AUTH_MODE="entra" \
    MYSTERY_PUBLIC_BASE_URL="http://localhost:5177" \
    ENVIRONMENT="development" \
    python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 \
    > /tmp/backend_8000.log 2>&1 &
  echo "[start] entra backend PID=$!"
}

start_frontends() {
  echo "[start] Starting mystery-shopper frontend on :5177..."
  cd "${REPO_ROOT}/frontend/mystery-shopper"
  nohup npx vite --host 0.0.0.0 --port 5177 > /tmp/frontend_5177.log 2>&1 &
  echo "[start] mystery-shopper frontend PID=$!"

  echo "[start] Starting dashboard-blueprint frontend on :5185..."
  cd "${REPO_ROOT}/frontend/dashboard-blueprint"
  VITE_API_PROXY_TARGET="http://127.0.0.1:8000" nohup npx vite --host 0.0.0.0 --port 5185 > /tmp/frontend_5185.log 2>&1 &
  echo "[start] dashboard frontend PID=$!"
}

check_pg() {
  echo "[check] Postgres docker container status..."
  docker ps --filter "name=cx-b2b-postgres-local" --format "  {{.Names}}: {{.Status}}" 2>/dev/null || echo "  (docker not available or container not found)"
}

# --- Main ---
if [[ "${1:-}" == "--restart" ]]; then
  stop_services
fi

check_pg

cd "${BACKEND_DIR}"
start_backends

sleep 3

echo "[check] Waiting for backends to be ready..."
for port in 8011 8000; do
  for i in 1 2 3 4 5; do
    STATUS=$(curl -s "http://localhost:${port}/health" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('status','unknown'))" 2>/dev/null || echo "not_ready")
    if [[ "${STATUS}" != "not_ready" ]]; then
      echo "  :${port} => ${STATUS}"
      break
    fi
    sleep 1
  done
done

start_frontends

echo ""
echo "=== Local Stack ==="
echo "  mystery_public backend: http://localhost:8011/health"
echo "  entra backend:          http://localhost:8000/health"
echo "  mystery-shopper frontend: http://localhost:5177"
echo "  dashboard:              http://localhost:5185"
echo ""
echo "  Logs: /tmp/backend_8011.log  /tmp/backend_8000.log"
echo "        /tmp/frontend_5177.log  /tmp/frontend_5185.log"
