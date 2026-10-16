#!/usr/bin/env bash
set -euo pipefail

TARGET_ROOT="${TARGET_ROOT:-/opt/cwscx-mystery-public}"
CURRENT_DIR="${TARGET_ROOT}/current"
BACKEND_DIR="${CURRENT_DIR}/backend"
VENV_DIR="${BACKEND_DIR}/venv"
ENV_FILE="${TARGET_ROOT}/.env"
SERVICE_NAME="${SERVICE_NAME:-cwscx-mystery-public-backend}"
SERVICE_USER="${SERVICE_USER:-cxadmin}"
SERVICE_GROUP="${SERVICE_GROUP:-www-data}"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
TMP_SERVICE_FILE="$(mktemp /tmp/cwscx-mystery-public-backend.XXXXXX.service)"
trap 'rm -f "${TMP_SERVICE_FILE}"' EXIT

run_as_root() {
  if [[ "${EUID}" -eq 0 ]]; then "$@"; else sudo -n "$@"; fi
}

[[ -L "${CURRENT_DIR}" ]] || { echo "Current release symlink is missing" >&2; exit 1; }
[[ -x "${VENV_DIR}/bin/uvicorn" ]] || { echo "Offline-installed release virtualenv is missing" >&2; exit 1; }
[[ -f "${CURRENT_DIR}/release-manifest.json" ]] || { echo "Release manifest is missing" >&2; exit 1; }
[[ -f "${ENV_FILE}" ]] || { echo "Environment file is missing" >&2; exit 1; }
ENV_MODE="$(stat -c '%a' "${ENV_FILE}")"
[[ "${ENV_MODE}" == "600" || "${ENV_MODE}" == "640" ]] || { echo "Environment file mode must be 600 or 640" >&2; exit 1; }

read -r APP_VERSION RELEASE_ID < <("${VENV_DIR}/bin/python" -I - "${CURRENT_DIR}/release-manifest.json" <<'PY'
import json, re, sys
m=json.load(open(sys.argv[1],encoding="utf-8"))
sha=str(m.get("git_sha", "")); release=str(m.get("release_id", ""))
if not re.fullmatch(r"[0-9a-f]{40}", sha): raise SystemExit("Invalid manifest git_sha")
if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]{0,159}", release): raise SystemExit("Invalid manifest release_id")
print(sha, release)
PY
)

# Use the same restricted, non-disclosing EnvironmentFile parser and policy as
# the preactivation candidate probe. Unsupported escapes, continuations or mixed
# quoting fail before the live service is restarted.
"${VENV_DIR}/bin/python" -I "${CURRENT_DIR}/scripts/linux/mystery_public_release_guard.py" \
  check-production-environment "${ENV_FILE}"

cat >"${TMP_SERVICE_FILE}" <<EOF
[Unit]
Description=CWSCX Mystery Public FastAPI Backend
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${SERVICE_USER}
Group=${SERVICE_GROUP}
WorkingDirectory=${BACKEND_DIR}
EnvironmentFile=${ENV_FILE}
Environment=PYTHONDONTWRITEBYTECODE=1
# Do not probe an absent optional client certificate under ProtectHome=yes.
# This does not relax DATABASE_URL sslmode=require/verify-ca/verify-full.
Environment=PGSSLCERTMODE=disable
Environment=APP_VERSION=${APP_VERSION}
Environment=RELEASE_ID=${RELEASE_ID}
ExecStart=${VENV_DIR}/bin/uvicorn app.main:app --host 127.0.0.1 --port 8011 --proxy-headers --forwarded-allow-ips=127.0.0.1
Restart=always
RestartSec=3
TimeoutStartSec=60
TimeoutStopSec=30
UMask=0027
NoNewPrivileges=true
PrivateTmp=true
PrivateDevices=true
ProtectSystem=strict
ProtectHome=true
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true
RestrictSUIDSGID=true
LockPersonality=true
CapabilityBoundingSet=
AmbientCapabilities=
RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6
SystemCallArchitectures=native

[Install]
WantedBy=multi-user.target
EOF

if command -v systemd-analyze >/dev/null 2>&1; then
  systemd-analyze verify "${TMP_SERVICE_FILE}"
fi
run_as_root install -o root -g root -m 0644 "${TMP_SERVICE_FILE}" "${SERVICE_FILE}"
run_as_root systemctl daemon-reload
run_as_root systemctl enable "${SERVICE_NAME}"
run_as_root systemctl restart "${SERVICE_NAME}"

for _ in $(seq 1 30); do
  READY_CODE="$(curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:8011/health/ready 2>/dev/null || true)"
  if [[ "${READY_CODE}" == "200" ]]; then
    run_as_root systemctl is-active --quiet "${SERVICE_NAME}"
    echo "Backend restarted and readiness returned HTTP 200 on loopback."
    run_as_root systemctl show "${SERVICE_NAME}" -p ActiveState -p MainPID -p ActiveEnterTimestamp --no-pager
    exit 0
  fi
  sleep 1
done

echo "Backend failed loopback readiness after restart" >&2
run_as_root systemctl --no-pager --full status "${SERVICE_NAME}" || true
exit 1
