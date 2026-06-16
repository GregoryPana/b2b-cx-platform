#!/usr/bin/env bash
set -euo pipefail

TARGET_ROOT="${TARGET_ROOT:-/opt/cwscx-mystery-public}"
BACKEND_DIR="${TARGET_ROOT}/backend"
VENV_DIR="${BACKEND_DIR}/venv"
ENV_FILE="${TARGET_ROOT}/.env"
SERVICE_NAME="${SERVICE_NAME:-cwscx-mystery-public-backend}"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
ALEMBIC_TARGET_REVISION="${ALEMBIC_TARGET_REVISION:-20260609_000024}"

run_as_root() {
  if [[ "${EUID}" -eq 0 ]]; then
    "$@"
    return
  fi
  sudo -n "$@"
}

cd "${BACKEND_DIR}"
python3 -m venv "${VENV_DIR}"
source "${VENV_DIR}/bin/activate"
pip install --upgrade pip
pip install -r requirements.txt

sed -i 's/\r$//' "${ENV_FILE}"
DATABASE_URL_VALUE="$(grep -E '^DATABASE_URL=' "${ENV_FILE}" | tail -n1 | cut -d'=' -f2- | sed 's/\r$//' || true)"
if [[ -z "${DATABASE_URL_VALUE}" ]]; then
  echo "DATABASE_URL is missing in ${ENV_FILE}"
  exit 1
fi
export DATABASE_URL="${DATABASE_URL_VALUE}"

AUTH_MODE_VALUE="$(grep -E '^AUTH_MODE=' "${ENV_FILE}" | tail -n1 | cut -d'=' -f2- | sed 's/\r$//' || true)"
MYSTERY_AUTH_SECRET_KEY_VALUE="$(grep -E '^MYSTERY_AUTH_SECRET_KEY=' "${ENV_FILE}" | tail -n1 | cut -d'=' -f2- | sed 's/\r$//' || true)"
if [[ "${AUTH_MODE_VALUE}" == "mystery_public" && -z "${MYSTERY_AUTH_SECRET_KEY_VALUE}" ]]; then
  echo "MYSTERY_AUTH_SECRET_KEY is required when AUTH_MODE=mystery_public in ${ENV_FILE}"
  exit 1
fi

"${VENV_DIR}/bin/alembic" upgrade "${ALEMBIC_TARGET_REVISION}"

TMP_SERVICE_FILE="$(mktemp /tmp/cwscx-mystery-public-backend.XXXXXX)"
cat >"${TMP_SERVICE_FILE}" <<EOF
[Unit]
Description=CWSCX Mystery Public FastAPI Backend
After=network.target

[Service]
User=cxadmin
Group=www-data
WorkingDirectory=${BACKEND_DIR}
EnvironmentFile=${ENV_FILE}
ExecStart=${VENV_DIR}/bin/uvicorn app.main:app --host 0.0.0.0 --port 8011
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

run_as_root cp "${TMP_SERVICE_FILE}" "${SERVICE_FILE}"
rm -f "${TMP_SERVICE_FILE}"
run_as_root systemctl daemon-reload
run_as_root systemctl enable "${SERVICE_NAME}"
run_as_root systemctl restart "${SERVICE_NAME}"
run_as_root systemctl --no-pager --full status "${SERVICE_NAME}"

for i in {1..30}; do
  if curl -fsS http://127.0.0.1:8011/health >/dev/null 2>&1; then
    echo "Mystery public backend health check passed."
    exit 0
  fi
  sleep 1
done

echo "Mystery public backend failed health check after restart."
exit 1
