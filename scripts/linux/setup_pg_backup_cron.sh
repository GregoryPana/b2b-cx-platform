#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_SCRIPT="${SCRIPT_DIR}/backup_postgres.sh"
CRON_SCHEDULE="${BACKUP_CRON_SCHEDULE:-0 2 * * *}"

if [[ ! -f "${BACKUP_SCRIPT}" ]]; then
  echo "Backup script not found: ${BACKUP_SCRIPT}"
  exit 1
fi

chmod +x "${BACKUP_SCRIPT}"

CRON_ENTRY="${CRON_SCHEDULE} ${BACKUP_SCRIPT} >> /var/log/cwscx-pg-backup.log 2>&1"

if crontab -l 2>/dev/null | grep -qF "${BACKUP_SCRIPT}"; then
  echo "Cron entry already exists. Updating..."
  (crontab -l 2>/dev/null | grep -vF "${BACKUP_SCRIPT}"; echo "${CRON_ENTRY}") | crontab -
else
  (crontab -l 2>/dev/null; echo "${CRON_ENTRY}") | crontab -
fi

echo "Cron job installed: ${CRON_SCHEDULE}"
echo "Backup script: ${BACKUP_SCRIPT}"
echo "Log file: /var/log/cwscx-pg-backup.log"
echo ""
echo "To verify: crontab -l"
echo "To run manually: sudo bash ${BACKUP_SCRIPT}"
