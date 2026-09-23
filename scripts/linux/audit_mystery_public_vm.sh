#!/usr/bin/env bash
# Read-only, secret-safe baseline audit for the Mystery Public DMZ VM.
set -uo pipefail

TARGET_ROOT="${TARGET_ROOT:-/opt/cwscx-mystery-public}"
SERVICE_NAME="${SERVICE_NAME:-cwscx-mystery-public-backend}"
OUTPUT_FILE="${OUTPUT_FILE:-/tmp/mystery-public-vm-audit.json}"

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  cat <<'EOF'
Usage: sudo bash audit_mystery_public_vm.sh

Read-only audit of the Mystery Shopper DMZ VM. It never changes packages,
services, firewall rules, configuration, database data, or secret values.
Environment overrides: TARGET_ROOT, SERVICE_NAME, OUTPUT_FILE, SSL_CERTIFICATE.
EOF
  exit 0
fi

RESULTS="$(mktemp /tmp/mystery-public-audit.XXXXXX)"
trap 'rm -f "${RESULTS}"' EXIT

add() { local s="$1" n="$2" d="$3"; d="${d//$'\t'/ }"; d="${d//$'\n'/ }"; printf '%s\t%s\t%s\n' "$s" "$n" "$d" >>"${RESULTS}"; printf '[%s] %s - %s\n' "${s^^}" "$n" "$d"; }
pass() { add pass "$1" "$2"; }
fail() { add fail "$1" "$2"; }
warn() { add warn "$1" "$2"; }
command_ok() { command -v "$1" >/dev/null 2>&1; }
if [[ "${EUID}" -eq 0 ]]; then SUDO=(); else SUDO=(sudo -n); fi

[[ -r /etc/os-release ]] && pass os "OS release metadata readable" || fail os "OS release metadata missing"
for cmd in python3 nginx curl ss systemctl openssl sha256sum; do
  command_ok "$cmd" && pass "command_${cmd}" "${cmd} is installed" || fail "command_${cmd}" "${cmd} is missing"
done
for cmd in git node npm zip unzip rsync; do
  command_ok "$cmd" && warn "build_tool_${cmd}" "${cmd} is present but not required for immutable runtime installs" || pass "build_tool_${cmd}" "${cmd} absent/not required on immutable runtime"
done

[[ -d "${TARGET_ROOT}" ]] && pass target_root "Target root exists" || fail target_root "Target root missing"
[[ -d "${TARGET_ROOT}/releases" ]] && pass releases_dir "Releases directory exists" || fail releases_dir "Releases directory missing"
[[ -d "${TARGET_ROOT}/shared" ]] && pass shared_dir "Shared directory exists" || fail shared_dir "Shared directory missing"
if [[ -L "${TARGET_ROOT}/current" ]]; then
  CURRENT_REAL="$(realpath "${TARGET_ROOT}/current" 2>/dev/null || true)"
  case "${CURRENT_REAL}" in "${TARGET_ROOT}/releases/"*) pass current_symlink "Current resolves inside releases";; *) fail current_symlink "Current resolves outside releases or is broken";; esac
else fail current_symlink "Current symlink missing"; fi

ENV_FILE="${TARGET_ROOT}/.env"
if [[ -f "${ENV_FILE}" ]]; then
  ENV_MODE="$(stat -c '%a' "${ENV_FILE}" 2>/dev/null || true)"
  case "${ENV_MODE}" in 600|640) pass env_permissions "Environment file mode is ${ENV_MODE}";; *) fail env_permissions "Environment file mode should be 600 or 640 (observed ${ENV_MODE:-unknown})";; esac
  ENV_KEYS="$(python3 - "${ENV_FILE}" <<'PY' 2>/dev/null
import pathlib, sys
keys=[]
for raw in pathlib.Path(sys.argv[1]).read_text(encoding="utf-8-sig").splitlines():
    line=raw.strip()
    if line and not line.startswith("#") and "=" in line: keys.append(line.split("=",1)[0].strip())
required={"ENVIRONMENT","AUTH_MODE","DATABASE_URL","CORS_ALLOW_ORIGINS","MYSTERY_AUTH_SECRET_KEY"}
print(",".join(sorted(required-set(keys))))
PY
)"
  [[ -z "${ENV_KEYS}" ]] && pass env_keys "Required environment key names are present" || fail env_keys "Missing environment key names: ${ENV_KEYS}"
else fail env_permissions "Environment file missing"; fail env_keys "Environment file missing"; fi

if [[ -f "${TARGET_ROOT}/current/release-manifest.json" ]]; then
  MANIFEST_STATUS="$(python3 - "${TARGET_ROOT}/current/release-manifest.json" <<'PY' 2>/dev/null
import json,re,sys
m=json.load(open(sys.argv[1],encoding="utf-8"))
ok=(re.fullmatch(r"[0-9a-f]{40}",str(m.get("git_sha",""))) is not None and m.get("frontend_auth_mode")=="mystery_public" and bool(m.get("expected_migration_heads")) and bool(m.get("python_wheelhouse")))
print("ok" if ok else "bad")
PY
)"
  [[ "${MANIFEST_STATUS}" == ok ]] && pass manifest "Release identity, frontend mode, heads and wheelhouse metadata present" || fail manifest "Release manifest is incomplete"
else fail manifest "Release manifest missing"; fi

if command_ok systemctl; then
  systemctl is-enabled --quiet "${SERVICE_NAME}" 2>/dev/null && pass service_enabled "Backend service enabled" || fail service_enabled "Backend service not enabled"
  systemctl is-active --quiet "${SERVICE_NAME}" 2>/dev/null && pass service_active "Backend service active" || fail service_active "Backend service not active"
  HARDENING="$(systemctl show "${SERVICE_NAME}" -p NoNewPrivileges -p PrivateTmp -p ProtectSystem -p ProtectHome 2>/dev/null || true)"
  if [[ "${HARDENING}" == *"NoNewPrivileges=yes"* && "${HARDENING}" == *"PrivateTmp=yes"* && "${HARDENING}" == *"ProtectSystem=strict"* && "${HARDENING}" == *"ProtectHome=yes"* ]]; then pass systemd_hardening "Core systemd hardening active"; else fail systemd_hardening "Core systemd hardening incomplete"; fi
fi

if command_ok ss; then
  LISTEN="$(ss -H -ltn 'sport = :8011' 2>/dev/null || true)"
  COUNT="$(printf '%s\n' "${LISTEN}" | awk 'NF{n++} END{print n+0}')"
  BAD="$(printf '%s\n' "${LISTEN}" | awk '$4 !~ /^127\.0\.0\.1:8011$/ {n++} END{print n+0}')"
  [[ "${COUNT}" == 1 && "${BAD}" == 0 ]] && pass backend_listener "Exactly one loopback-only backend listener" || fail backend_listener "Backend listener is absent or not loopback-only"
fi

if command_ok nginx; then
  "${SUDO[@]}" nginx -t >/dev/null 2>&1 && pass nginx_syntax "NGINX syntax passes" || fail nginx_syntax "NGINX syntax fails"
  systemctl is-active --quiet nginx 2>/dev/null && pass nginx_active "NGINX is active" || fail nginx_active "NGINX is inactive"
fi

if command_ok ufw; then
  UFW_STATE="$("${SUDO[@]}" ufw status 2>/dev/null | awk 'NR==1{print $2}' || true)"
  [[ "${UFW_STATE}" == active ]] && pass host_firewall "UFW reports active" || warn host_firewall "UFW does not report active; confirm nftables/upstream firewall with IT"
elif command_ok nft; then
  "${SUDO[@]}" nft list ruleset >/dev/null 2>&1 && pass host_firewall "nftables ruleset is readable" || warn host_firewall "Unable to confirm nftables ruleset"
else warn host_firewall "No supported host-firewall inspection command found"; fi

CERT="${SSL_CERTIFICATE:-/etc/ssl/cwscx-mystery-public/cwscx-mystery-public.crt}"
if [[ -r "${CERT}" ]] && openssl x509 -in "${CERT}" -noout -checkend 1209600 >/dev/null 2>&1; then pass tls_certificate "Certificate is readable and valid for more than 14 days"; else warn tls_certificate "Certificate missing, unreadable, or expires within 14 days"; fi

python3 - "${RESULTS}" "${OUTPUT_FILE}" <<'PY'
import csv,datetime,json,pathlib,sys
rows=[]
with open(sys.argv[1],encoding="utf-8") as f:
    for status,name,detail in csv.reader(f,delimiter="\t"): rows.append({"status":status,"name":name,"detail":detail})
counts={key:sum(r["status"]==key for r in rows) for key in ("pass","warn","fail")}
payload={"schema_version":1,"generated_at_utc":datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00","Z"),"summary":{"total":len(rows),**counts},"checks":rows}
pathlib.Path(sys.argv[2]).write_text(json.dumps(payload,indent=2,sort_keys=True)+"\n",encoding="utf-8")
PY
FAILS="$(awk -F '\t' '$1=="fail"{n++} END{print n+0}' "${RESULTS}")"
echo "Audit evidence: ${OUTPUT_FILE}"
[[ "${FAILS}" == 0 ]]
