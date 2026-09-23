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
TMP_SERVICE_FILE="$(mktemp /tmp/cwscx-mystery-public-backend.XXXXXX)"
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

read -r APP_VERSION RELEASE_ID < <("${VENV_DIR}/bin/python" - "${CURRENT_DIR}/release-manifest.json" <<'PY'
import json, re, sys
m=json.load(open(sys.argv[1],encoding="utf-8"))
sha=str(m.get("git_sha", "")); release=str(m.get("release_id", ""))
if not re.fullmatch(r"[0-9a-f]{40}", sha): raise SystemExit("Invalid manifest git_sha")
if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]{0,159}", release): raise SystemExit("Invalid manifest release_id")
print(sha, release)
PY
)

# Validate required configuration by key and policy without sourcing or printing values.
"${VENV_DIR}/bin/python" - "${ENV_FILE}" <<'PY'
import pathlib, sys, urllib.parse
path = pathlib.Path(sys.argv[1])
values = {}
for raw in path.read_text(encoding="utf-8-sig").splitlines():
    line = raw.strip()
    if not line or line.startswith("#") or "=" not in line: continue
    key, value = line.split("=", 1)
    value = value.strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'": value = value[1:-1]
    values[key.strip()] = value
required = ["ENVIRONMENT", "AUTH_MODE", "DATABASE_URL", "CORS_ALLOW_ORIGINS", "MYSTERY_AUTH_SECRET_KEY"]
missing = [key for key in required if not values.get(key)]
if missing: raise SystemExit("Missing required environment keys: " + ", ".join(missing))
if values["ENVIRONMENT"] != "production": raise SystemExit("ENVIRONMENT must be production")
if values["AUTH_MODE"] != "mystery_public": raise SystemExit("AUTH_MODE must be mystery_public")
url = urllib.parse.urlsplit(values["DATABASE_URL"].replace("postgresql+psycopg://", "postgresql://", 1))
mode = urllib.parse.parse_qs(url.query).get("sslmode", [""])[-1].lower()
if mode not in {"require", "verify-ca", "verify-full"}: raise SystemExit("DATABASE_URL must enforce PostgreSQL SSL")
print("Environment metadata validated: required keys present; production/public auth/DB SSL policies pass")
PY

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
