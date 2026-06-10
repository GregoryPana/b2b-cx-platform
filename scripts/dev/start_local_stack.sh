#!/usr/bin/env bash
# Start the full local dev stack inside WSL:
#   8011 mystery-public backend, 8000 main backend, 5177 mystery frontend, 5173 main frontend.
# Logs go to /tmp/opencode/*.log. Postgres is expected in docker (cx-b2b-postgres-local, port 5432).
set -e
ROOT=/mnt/c/Users/gpanagary/.gemini/antigravity/scratch/cx-b2b-platform
mkdir -p /tmp/opencode

# DATABASE_URL must be in the process env: app/core/database/__init__.py reads it
# at import time (before main.py loads the .env files) and otherwise falls back
# to a bogus cwscx default.
DB_URL='postgresql://b2b:b2b@localhost:5432/b2b'

cd "$ROOT/backend"
DATABASE_URL="$DB_URL" AUTH_MODE=mystery_public MYSTERY_PUBLIC_BASE_URL='http://localhost:5177' ENVIRONMENT=development \
  nohup python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8011 > /tmp/opencode/mystery_backend.log 2>&1 &
echo "mystery backend (8011) pid $!"

DATABASE_URL="$DB_URL" nohup python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 > /tmp/opencode/main_backend.log 2>&1 &
echo "main backend (8000) pid $!"

cd "$ROOT/frontend/mystery-shopper"
nohup npm run dev -- --host 0.0.0.0 > /tmp/opencode/mystery_frontend.log 2>&1 &
echo "mystery frontend (5177) pid $!"

cd "$ROOT/frontend"
nohup npm run dev -- --host 0.0.0.0 > /tmp/opencode/main_frontend.log 2>&1 &
echo "main frontend (5173) pid $!"

echo "ALL_STARTED"
