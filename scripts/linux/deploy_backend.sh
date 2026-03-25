#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="${REPO_DIR:-/opt/cwscx}"
BACKEND_DIR="${REPO_DIR}/backend/backend"
if [[ ! -d "${BACKEND_DIR}" ]]; then
  BACKEND_DIR="${REPO_DIR}/backend"
fi
VENV_DIR="${BACKEND_DIR}/venv"
ENV_FILE="${BACKEND_DIR}/.env"
SERVICE_FILE="/etc/systemd/system/cwscx-backend.service"

if [[ ! -d "${BACKEND_DIR}" ]]; then
  echo "Backend directory not found: ${BACKEND_DIR}"
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

# Load environment variables for alembic
set -a
source "${ENV_FILE}"
set +a

# Use virtual environment's alembic
"${VENV_DIR}/bin/alembic" upgrade head

sudo tee "${SERVICE_FILE}" >/dev/null <<EOF
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

sudo systemctl daemon-reload
sudo systemctl enable cwscx-backend
sudo systemctl restart cwscx-backend
sudo systemctl --no-pager --full status cwscx-backend

curl -fsS http://127.0.0.1:8000/health || true

echo "Backend deployment complete."
