#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

ACTION=${1:-up}

case "$ACTION" in
  up)
    docker compose -f docker-compose.dev.yml up -d
    ;;
  down)
    docker compose -f docker-compose.dev.yml down
    ;;
  reset)
    docker compose -f docker-compose.dev.yml down -v
    ;;
  *)
    echo "Usage: $0 [up|down|reset]"
    exit 1
    ;;
esac
