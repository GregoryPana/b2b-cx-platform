#!/usr/bin/env bash
# Streams the latest production Postgres backup to the staging VM and triggers
# a restore there, so cwscx-tst01's cwscx-postgres becomes a nightly clone of
# production. Runs on cwscx-app01 (production) only, shortly after
# /opt/backups/postgres/backup.sh has produced the day's dump.
#
# Deliberately fails loud: if today's dump is missing, the SSH key is broken,
# or the checksum can't be computed, this exits non-zero with a clear log line
# rather than silently doing nothing.
set -euo pipefail

LOCK_FILE="/var/lock/cwscx-staging-sync.lock"
exec 9>"$LOCK_FILE"
flock -n 9 || {
  echo "[$(date -Is)] sync skipped: another run is already in progress"
  exit 1
}

DAILY_DIR="/opt/backups/postgres/daily"
STAGING_HOST="${STAGING_HOST:-172.17.1.213}"
STAGING_USER="${STAGING_USER:-cxadmin}"
SYNC_KEY="${SYNC_KEY:-$HOME/.ssh/staging_sync_key}"
TODAY="$(date +%Y-%m-%d)"

log() {
  echo "[$(date -Is)] $*"
}

DUMP_FILE="$(find "$DAILY_DIR" -maxdepth 1 -type f -name "cwscx-${TODAY}_*.dump" | sort | tail -n1)"

if [[ -z "$DUMP_FILE" || ! -s "$DUMP_FILE" ]]; then
  log "ERROR: no dump found for $TODAY in $DAILY_DIR - refusing to sync a stale backup"
  exit 1
fi

CHECKSUM_FILE="${DUMP_FILE}.sha256"
if [[ ! -f "$CHECKSUM_FILE" ]]; then
  log "ERROR: checksum file missing for $DUMP_FILE"
  exit 1
fi

# backup.sh writes "<hash>  <filename>" - take just the hash
EXPECTED_HASH="$(cut -d' ' -f1 "$CHECKSUM_FILE")"

log "sync started file=$DUMP_FILE hash=$EXPECTED_HASH"

set +e
STATUS_OUTPUT="$(
  { printf 'SHA256:%s\n' "$EXPECTED_HASH"; cat "$DUMP_FILE"; } \
    | ssh -i "$SYNC_KEY" \
        -o BatchMode=yes \
        -o StrictHostKeyChecking=accept-new \
        -o ConnectTimeout=15 \
        "${STAGING_USER}@${STAGING_HOST}" 2>&1
)"
SSH_EXIT=$?
set -e

log "remote output: ${STATUS_OUTPUT}"

if [[ $SSH_EXIT -ne 0 ]]; then
  log "ERROR: ssh transfer failed with exit code $SSH_EXIT"
  exit 1
fi

if ! grep -q '^OK' <<<"$STATUS_OUTPUT"; then
  log "ERROR: staging did not report OK - treating sync as failed"
  exit 1
fi

log "sync completed successfully"
