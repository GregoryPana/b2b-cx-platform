#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="${REPO_DIR:-/opt/cwscx}"
BACKEND_DIR="${REPO_DIR}/backend/backend"
if [[ ! -d "${BACKEND_DIR}" ]]; then
  BACKEND_DIR="${REPO_DIR}/backend"
fi
VENV_DIR="${BACKEND_DIR}/venv"
ENV_FILE="${REPO_DIR}/.env"
SERVICE_FILE="/etc/systemd/system/cwscx-backend.service"

run_as_root() {
  if [[ "${EUID}" -eq 0 ]]; then
    "$@"
    return
  fi

  if command -v sudo >/dev/null 2>&1 && sudo -n "$@" >/dev/null 2>&1; then
    sudo -n "$@"
    return
  fi

  echo "This step requires root privileges: $*"
  echo "Configure passwordless sudo for the runner user or run the script as root."
  exit 1
}

if [[ ! -d "${BACKEND_DIR}" ]]; then
  echo "Backend directory not found: ${BACKEND_DIR}"
  exit 1
fi

if [[ "${RESET_DATABASE:-false}" == "true" || "${DB_RESET:-false}" == "true" ]]; then
  echo "Refusing deploy: database reset flags are not allowed in staging deploy flow."
  exit 1
fi

cd "${BACKEND_DIR}"

python3 -m venv "${VENV_DIR}"
source "${VENV_DIR}/bin/activate"
pip install --upgrade pip
pip install -r requirements.txt

if [[ ! -f "${ENV_FILE}" ]]; then
  cp "${REPO_DIR}/.env.example" "${ENV_FILE}"
  echo "Created ${ENV_FILE} from .env.example. Update real secrets before restart."
fi

# Normalize potential CRLF line endings to avoid shell/systemd env parse issues
sed -i 's/\r$//' "${ENV_FILE}"

# Load DATABASE_URL for Alembic without sourcing full .env shell content
DATABASE_URL_VALUE="$(grep -E '^DATABASE_URL=' "${ENV_FILE}" | tail -n1 | cut -d'=' -f2- | sed 's/\r$//' || true)"
if [[ -z "${DATABASE_URL_VALUE}" ]]; then
  echo "DATABASE_URL is missing in ${ENV_FILE}"
  exit 1
fi
export DATABASE_URL="${DATABASE_URL_VALUE}"

# Use upgrade-only migrations; never clear/reset data
ALEMBIC_LOG="$(mktemp /tmp/cwscx-alembic.XXXXXX.log)"
if ! "${VENV_DIR}/bin/alembic" upgrade head 2>&1 | tee "${ALEMBIC_LOG}"; then
  if grep -q 'relation "programs" already exists' "${ALEMBIC_LOG}"; then
    echo "Detected pre-existing schema without matching Alembic revision; stamping baseline and retrying migrations."
    "${VENV_DIR}/bin/alembic" stamp d01c3a366199
    "${VENV_DIR}/bin/alembic" upgrade head
  else
    exit 1
  fi
fi
rm -f "${ALEMBIC_LOG}"

TMP_SERVICE_FILE="$(mktemp /tmp/cwscx-backend-service.XXXXXX)"
cat >"${TMP_SERVICE_FILE}" <<EOF
[Unit]
Description=CWSCX FastAPI Backend
After=network.target

[Service]
User=cxadmin
Group=www-data
WorkingDirectory=${BACKEND_DIR}
EnvironmentFile=${ENV_FILE}
ExecStart=${VENV_DIR}/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

run_as_root cp "${TMP_SERVICE_FILE}" "${SERVICE_FILE}"
rm -f "${TMP_SERVICE_FILE}"

run_as_root systemctl daemon-reload
run_as_root systemctl enable cwscx-backend
run_as_root systemctl restart cwscx-backend
run_as_root systemctl --no-pager --full status cwscx-backend

curl -fsS http://127.0.0.1:8000/health || true

echo "Backend deployment complete."
