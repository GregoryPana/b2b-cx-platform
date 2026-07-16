#!/usr/bin/env bash
# Runs on cwscx-tst01 (staging) ONLY, invoked as a forced SSH command by the
# dedicated staging_sync_key (see authorized_keys on this host). Reads a
# "SHA256:<hex>\n" line followed by a pg_dump custom-format stream on stdin,
# verifies it, and restores it into the local cwscx-postgres container.
#
# Deliberately fails loud: any failure prints "FAIL: <reason>" and exits
# non-zero WITHOUT touching the running database. Only prints "OK" on a
# verified, completed restore.
set -euo pipefail

LOCK_FILE="/var/lock/cwscx-staging-restore.lock"
exec 9>"$LOCK_FILE"
flock -n 9 || { echo "FAIL: another restore is already in progress"; exit 1; }

WORK_DIR="/opt/cwscx/staging-sync"
LOG_FILE="$WORK_DIR/sync.log"
INCOMING_FILE="$WORK_DIR/incoming.dump.tmp"
CONTAINER="cwscx-postgres"
DB_NAME="cwscx-postgres"
DB_USER="cxadmin"
CONTAINER_TMP="/tmp/staging-restore-incoming.dump"

mkdir -p "$WORK_DIR"

log() {
  echo "[$(date -Is)] $*" >> "$LOG_FILE"
}

fail() {
  log "FAIL: $*"
  echo "FAIL: $*"
  exit 1
}

cleanup() {
  rm -f "$INCOMING_FILE"
  docker exec "$CONTAINER" rm -f "$CONTAINER_TMP" >/dev/null 2>&1 || true
}
trap cleanup EXIT

log "restore started"

read -r header || fail "did not receive checksum header"
case "$header" in
  SHA256:*) EXPECTED_HASH="${header#SHA256:}" ;;
  *) fail "malformed header: $header" ;;
esac

cat > "$INCOMING_FILE"

ACTUAL_HASH="$(sha256sum "$INCOMING_FILE" | cut -d' ' -f1)"
if [[ "$ACTUAL_HASH" != "$EXPECTED_HASH" ]]; then
  fail "checksum mismatch expected=$EXPECTED_HASH actual=$ACTUAL_HASH"
fi
log "checksum verified: $ACTUAL_HASH"

docker cp "$INCOMING_FILE" "$CONTAINER:$CONTAINER_TMP"

docker exec "$CONTAINER" pg_restore --list "$CONTAINER_TMP" >/dev/null \
  || fail "received file is not a valid pg_dump archive"
log "dump validity check passed"

docker exec "$CONTAINER" psql -U "$DB_USER" -d postgres -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${DB_NAME}' AND pid <> pg_backend_pid();" \
  >/dev/null \
  || fail "could not terminate existing connections"
log "existing connections terminated"

if ! docker exec "$CONTAINER" pg_restore \
    -U "$DB_USER" -d "$DB_NAME" \
    --clean --if-exists --single-transaction \
    "$CONTAINER_TMP"; then
  fail "pg_restore failed - single-transaction means the database was NOT left half-restored"
fi

log "restore completed successfully"
echo "OK"
