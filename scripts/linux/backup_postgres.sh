#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="/opt/cwscx/backups/postgres"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
DB_NAME="${POSTGRES_DB:-cwscx}"
DB_USER="${POSTGRES_USER:-cxadmin}"
DOCKER_CONTAINER="${POSTGRES_CONTAINER:-db}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_FILE="${BACKUP_DIR}/cwscx-${TIMESTAMP}.sql.gz"

mkdir -p "${BACKUP_DIR}"

# Auto-detect: Docker container or native pg_dump
if docker ps --format '{{.Names}}' 2>/dev/null | grep -qx "${DOCKER_CONTAINER}"; then
  echo "[backup] Docker container '${DOCKER_CONTAINER}' detected. Using docker exec pg_dump..."
  docker exec "${DOCKER_CONTAINER}" pg_dump -U "${DB_USER}" -d "${DB_NAME}" --no-owner --no-privileges | gzip > "${BACKUP_FILE}"
elif command -v pg_dump >/dev/null 2>&1; then
  echo "[backup] Native pg_dump detected. Using local pg_dump..."
  pg_dump -U "${DB_USER}" -d "${DB_NAME}" --no-owner --no-privileges | gzip > "${BACKUP_FILE}"
else
  echo "[backup] ERROR: Neither Docker container '${DOCKER_CONTAINER}' nor native pg_dump found."
  exit 1
fi

SIZE="$(du -h "${BACKUP_FILE}" | cut -f1)"
echo "[backup] Complete: ${BACKUP_FILE} (${SIZE})"

echo "[backup] Pruning backups older than ${RETENTION_DAYS} days..."
REMOVED="$(find "${BACKUP_DIR}" -name "cwscx-*.sql.gz" -mtime +${RETENTION_DAYS} -delete -print | wc -l)"
echo "[backup] Removed ${REMOVED} old backup(s)."

echo "[backup] Done."
