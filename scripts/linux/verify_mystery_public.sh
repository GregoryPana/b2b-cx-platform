#!/usr/bin/env bash
# Fail-closed post-deploy verification. Emits secret-safe JSON evidence on every exit.
set -uo pipefail

TARGET_ROOT="${TARGET_ROOT:-/opt/cwscx-mystery-public}"
CURRENT_DIR="${TARGET_ROOT}/current"
ENV_FILE="${TARGET_ROOT}/.env"
SERVICE_NAME="${SERVICE_NAME:-cwscx-mystery-public-backend}"
MYSTERY_PUBLIC_BASE_URL="${MYSTERY_PUBLIC_BASE_URL:-}"
VERIFY_TLS_MODE="${VERIFY_TLS_MODE:-}"
EVIDENCE_FILE="${EVIDENCE_FILE:-${PWD}/mystery-public-verification.json}"
RESULTS_FILE="$(mktemp /tmp/mystery-public-verify-results.XXXXXX)"
DB_RESULT_FILE="$(mktemp /tmp/mystery-public-verify-db.XXXXXX)"
FINALIZED=0

record() {
  local status="$1" name="$2" detail="$3"
  detail="${detail//$'\t'/ }"; detail="${detail//$'\n'/ }"
  printf '%s\t%s\t%s\n' "${status}" "${name}" "${detail}" >>"${RESULTS_FILE}"
  printf '[%s] %s - %s\n' "${status^^}" "${name}" "${detail}"
}
pass() { record pass "$1" "$2"; }
fail() { record fail "$1" "$2"; }

finalize() {
  local original_rc=$?
  [[ "${FINALIZED}" == "1" ]] && return
  FINALIZED=1
  mkdir -p "$(dirname "${EVIDENCE_FILE}")" 2>/dev/null || true
  python3 - "${RESULTS_FILE}" "${EVIDENCE_FILE}" "${VERIFY_TLS_MODE}" "${SERVICE_NAME}" <<'PY' 2>/dev/null || true
import csv, datetime, json, pathlib, sys
rows = []
with open(sys.argv[1], encoding="utf-8") as fh:
    for status, name, detail in csv.reader(fh, delimiter="\t"):
        rows.append({"status": status, "name": name, "detail": detail})
passed = sum(r["status"] == "pass" for r in rows)
failed = sum(r["status"] == "fail" for r in rows)
payload = {
    "schema_version": 1,
    "generated_at_utc": datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
    "tls_verification_mode": sys.argv[3],
    "service_name": sys.argv[4],
    "summary": {"total": len(rows), "passed": passed, "failed": failed},
    "checks": rows,
}
pathlib.Path(sys.argv[2]).write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")
PY
  local failed_count=1
  if [[ -s "${RESULTS_FILE}" ]]; then failed_count="$(awk -F '\t' '$1=="fail"{n++} END{print n+0}' "${RESULTS_FILE}")"; fi
  rm -f "${RESULTS_FILE}" "${DB_RESULT_FILE}"
  echo "Evidence: ${EVIDENCE_FILE}"
  if [[ "${failed_count}" -gt 0 || "${original_rc}" -ne 0 ]]; then exit 1; fi
  exit 0
}
trap finalize EXIT

if [[ "${EUID}" -eq 0 ]]; then SUDO=(); else SUDO=(sudo -n); fi

# Mandatory inputs and immutable release identity.
if [[ "${VERIFY_TLS_MODE}" == "prepublic" || "${VERIFY_TLS_MODE}" == "trusted" ]]; then
  pass "tls_mode" "${VERIFY_TLS_MODE} mode selected"
else
  fail "tls_mode" "VERIFY_TLS_MODE must be prepublic or trusted"
fi
if [[ "${MYSTERY_PUBLIC_BASE_URL}" =~ ^https://[A-Za-z0-9.-]+$ ]]; then
  pass "base_url" "Explicit HTTPS origin supplied"
  PUBLIC_HOST="${MYSTERY_PUBLIC_BASE_URL#https://}"
else
  fail "base_url" "MYSTERY_PUBLIC_BASE_URL must be an HTTPS origin with no path"
  PUBLIC_HOST="invalid.invalid"
fi
if [[ -L "${CURRENT_DIR}" && -f "${CURRENT_DIR}/release-manifest.json" ]]; then
  pass "current_release" "Current symlink and release manifest exist"
else
  fail "current_release" "Current symlink or release manifest missing"
fi

MANIFEST_RESULT="$(python3 - "${TARGET_ROOT}" 2>/dev/null <<'PY'
import json, pathlib, re, sys
root = pathlib.Path(sys.argv[1])
current = root / "current"
try:
    resolved = current.resolve(strict=True)
    releases = (root / "releases").resolve(strict=True)
    if resolved.parent != releases: raise ValueError("current does not resolve to releases/<id>")
    m = json.loads((resolved / "release-manifest.json").read_text(encoding="utf-8"))
    if resolved.name != m["release_id"]: raise ValueError("release ID does not match directory")
    if not re.fullmatch(r"[0-9a-f]{40}", m["git_sha"]): raise ValueError("full Git SHA missing")
    if m["frontend_auth_mode"] != "mystery_public": raise ValueError("frontend mode mismatch")
    if not m.get("expected_migration_heads"): raise ValueError("expected heads missing")
    print("PASS:" + m["release_id"] + ":" + m["git_sha"])
except Exception as exc:
    print("FAIL:" + str(exc))
PY
)"
if [[ "${MANIFEST_RESULT}" == PASS:* ]]; then
  IFS=: read -r _ RELEASE_ID RELEASE_SHA <<<"${MANIFEST_RESULT}"
  pass "release_identity" "release_id=${RELEASE_ID}; git_sha=${RELEASE_SHA}"
else
  fail "release_identity" "${MANIFEST_RESULT#FAIL:}"
fi

# Environment metadata and DB state: inspect names/policies only; never emit values.
if [[ -f "${ENV_FILE}" && -x "${CURRENT_DIR}/backend/venv/bin/python" ]]; then
  if "${CURRENT_DIR}/backend/venv/bin/python" - "${ENV_FILE}" "${CURRENT_DIR}" "${DB_RESULT_FILE}" <<'PY' >/dev/null 2>&1
import json, pathlib, sys, urllib.parse
from sqlalchemy import create_engine
from sqlalchemy.pool import NullPool
from alembic.runtime.migration import MigrationContext

env_path, current_dir, output = map(pathlib.Path, sys.argv[1:])
values = {}
for raw in env_path.read_text(encoding="utf-8-sig").splitlines():
    line = raw.strip()
    if not line or line.startswith("#") or "=" not in line: continue
    key, value = line.split("=", 1)
    value = value.strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'": value = value[1:-1]
    values[key.strip()] = value
required = ["ENVIRONMENT", "AUTH_MODE", "DATABASE_URL", "CORS_ALLOW_ORIGINS", "MYSTERY_AUTH_SECRET_KEY"]
missing = [key for key in required if not values.get(key)]
url = values.get("DATABASE_URL", "")
parsed = urllib.parse.urlsplit(url.replace("postgresql+psycopg://", "postgresql://", 1))
sslmode = urllib.parse.parse_qs(parsed.query).get("sslmode", [""])[-1].lower()
policy = {
    "required_keys_present": not missing,
    "missing_keys": missing,
    "production": values.get("ENVIRONMENT") == "production",
    "public_auth": values.get("AUTH_MODE") == "mystery_public",
    "db_ssl": sslmode in {"require", "verify-ca", "verify-full"},
}
manifest = json.loads((current_dir / "release-manifest.json").read_text(encoding="utf-8"))
policy["expected_heads"] = sorted(str(x) for x in manifest["expected_migration_heads"])
policy["current_heads"] = []
policy["db_error"] = False
if url:
    try:
        engine = create_engine(url, poolclass=NullPool, pool_pre_ping=True)
        with engine.connect() as connection:
            policy["current_heads"] = sorted(MigrationContext.configure(connection).get_current_heads())
        engine.dispose()
    except Exception:
        policy["db_error"] = True
output.write_text(json.dumps(policy), encoding="utf-8")
PY
  then
    REQUIRED_OK="$(python3 -c 'import json,sys; d=json.load(open(sys.argv[1])); print(int(d["required_keys_present"] and d["production"] and d["public_auth"]))' "${DB_RESULT_FILE}")"
    SSL_OK="$(python3 -c 'import json,sys; print(int(json.load(open(sys.argv[1]))["db_ssl"]))' "${DB_RESULT_FILE}")"
    HEADS_OK="$(python3 -c 'import json,sys; d=json.load(open(sys.argv[1])); print(int(not d["db_error"] and d["expected_heads"] == d["current_heads"]))' "${DB_RESULT_FILE}")"
    HEAD_COUNTS="$(python3 -c 'import json,sys; d=json.load(open(sys.argv[1])); print(f"expected={len(d[chr(101)+chr(120)+chr(112)+chr(101)+chr(99)+chr(116)+chr(101)+chr(100)+chr(95)+chr(104)+chr(101)+chr(97)+chr(100)+chr(115)])}; current={len(d[chr(99)+chr(117)+chr(114)+chr(114)+chr(101)+chr(110)+chr(116)+chr(95)+chr(104)+chr(101)+chr(97)+chr(100)+chr(115)])}")' "${DB_RESULT_FILE}")"
    [[ "${REQUIRED_OK}" == "1" ]] && pass "environment_metadata" "Required key names present; production and mystery_public policies pass" || fail "environment_metadata" "Required key names or fixed policy values are invalid"
    [[ "${SSL_OK}" == "1" ]] && pass "database_ssl" "DATABASE_URL enforces an approved sslmode" || fail "database_ssl" "DATABASE_URL does not enforce require/verify-ca/verify-full"
    [[ "${HEADS_OK}" == "1" ]] && pass "migration_heads" "Read-only head comparison matches (${HEAD_COUNTS})" || fail "migration_heads" "Read-only head comparison failed (${HEAD_COUNTS})"
  else
    fail "environment_metadata" "Unable to inspect environment metadata safely"
    fail "database_ssl" "Unable to validate database SSL policy"
    fail "migration_heads" "Unable to read current migration heads"
  fi
else
  fail "environment_metadata" "Environment file or release Python is missing"
  fail "database_ssl" "Environment file or release Python is missing"
  fail "migration_heads" "Environment file or release Python is missing"
fi

# Runtime binding, service state, and restart metadata.
if command -v ss >/dev/null 2>&1; then
  LISTENERS="$(ss -H -ltn 'sport = :8011' 2>/dev/null || true)"
  LISTENER_COUNT="$(printf '%s\n' "${LISTENERS}" | awk 'NF{n++} END{print n+0}')"
  NON_LOOPBACK="$(printf '%s\n' "${LISTENERS}" | awk '$4 !~ /^127\.0\.0\.1:8011$/ {n++} END{print n+0}')"
  if [[ "${LISTENER_COUNT}" == "1" && "${NON_LOOPBACK}" == "0" ]]; then pass "loopback_listener" "Exactly one 127.0.0.1:8011 listener"; else fail "loopback_listener" "Port 8011 is absent, duplicated, or non-loopback"; fi
else
  fail "loopback_listener" "ss is required"
fi
if "${SUDO[@]}" systemctl is-active --quiet "${SERVICE_NAME}" 2>/dev/null; then pass "service_active" "Backend service is active"; else fail "service_active" "Backend service is not active"; fi
RESTART_META="$("${SUDO[@]}" systemctl show "${SERVICE_NAME}" -p MainPID --value -p ActiveEnterTimestampMonotonic --value -p ExecMainStartTimestampMonotonic --value 2>/dev/null || true)"
NONZERO_META="$(printf '%s\n' "${RESTART_META}" | awk '$0 ~ /^[1-9][0-9]*$/{n++} END{print n+0}')"
if [[ "${NONZERO_META}" -ge 3 ]]; then pass "restart_metadata" "Main PID and active/start monotonic timestamps are non-zero"; else fail "restart_metadata" "Restart metadata is missing or zero"; fi

request_code() { curl "$@" -sS -o /dev/null -w '%{http_code}' 2>/dev/null || true; }
LOCAL_READY="$(request_code http://127.0.0.1:8011/health/ready)"
[[ "${LOCAL_READY}" == "200" ]] && pass "local_ready" "Loopback readiness returned 200" || fail "local_ready" "Loopback readiness returned ${LOCAL_READY:-no response}"
LOCAL_SESSION="$(request_code http://127.0.0.1:8011/auth/session)"
[[ "${LOCAL_SESSION}" == "401" ]] && pass "local_session" "Anonymous loopback session returned 401" || fail "local_session" "Anonymous loopback session returned ${LOCAL_SESSION:-no response}"

CURL_TLS_ARGS=()
if [[ "${VERIFY_TLS_MODE}" == "prepublic" ]]; then CURL_TLS_ARGS=(-k --resolve "${PUBLIC_HOST}:443:127.0.0.1"); fi
PUBLIC_READY="$(request_code "${CURL_TLS_ARGS[@]}" "${MYSTERY_PUBLIC_BASE_URL}/api/health/ready")"
[[ "${PUBLIC_READY}" == "200" ]] && pass "public_ready" "NGINX readiness returned 200" || fail "public_ready" "NGINX readiness returned ${PUBLIC_READY:-no response}"
PUBLIC_SESSION="$(request_code "${CURL_TLS_ARGS[@]}" "${MYSTERY_PUBLIC_BASE_URL}/api/auth/session")"
[[ "${PUBLIC_SESSION}" == "401" ]] && pass "public_session" "Anonymous NGINX session returned 401" || fail "public_session" "Anonymous NGINX session returned ${PUBLIC_SESSION:-no response}"
PUBLIC_ROOT="$(request_code "${CURL_TLS_ARGS[@]}" "${MYSTERY_PUBLIC_BASE_URL}/")"
[[ "${PUBLIC_ROOT}" == "200" ]] && pass "public_frontend" "Frontend root returned 200" || fail "public_frontend" "Frontend root returned ${PUBLIC_ROOT:-no response}"

if nginx -t >/dev/null 2>&1; then pass "nginx_config" "NGINX syntax passes"; else fail "nginx_config" "NGINX syntax fails"; fi

# Explicit summary line; JSON counts are generated directly from recorded checks.
TOTAL="$(awk 'END{print NR+0}' "${RESULTS_FILE}")"
FAILED="$(awk -F '\t' '$1=="fail"{n++} END{print n+0}' "${RESULTS_FILE}")"
PASSED=$((TOTAL - FAILED))
echo "Verification summary: total=${TOTAL} passed=${PASSED} failed=${FAILED}"
