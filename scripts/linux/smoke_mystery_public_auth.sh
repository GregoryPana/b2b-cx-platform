#!/usr/bin/env bash
# ============================================================================
# Mystery Public Auth Lifecycle Smoke Test
# 
# Validates the full Password+TOTP auth flow against a running deployment:
#   1. Health endpoint (no auth)
#   2. Admin creates a user
#   3. Enrollment start
#   4. Enrollment confirm (password + TOTP)
#   5. Login with password → MFA challenge
#   6. MFA verification with TOTP → session cookie
#   7. Authenticated endpoint access (/auth/session)
#   8. Logout
#   9. Recovery with recovery code
#
# Requires:
#   - curl, python3 with base64, hashlib, hmac, struct
#   - BASE_URL pointing to the mystery public deployment
#   - A running backend with AUTH_MODE=mystery_public
#
# Usage:
#   BASE_URL=https://mystery.example.com bash smoke_mystery_public_auth.sh
# ============================================================================
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:8011}"
errors=0

pass() { echo "[PASS] $1"; }
fail() { echo "[FAIL] $1"; errors=$((errors+1)); }

# ------------------------------------------------------------------
# Helper: generate a TOTP code at a given step offset
# ------------------------------------------------------------------
totp_code() {
  python3 -c "
import base64, hashlib, hmac, struct, sys, time

secret = sys.argv[1]
offset = int(sys.argv[2]) if len(sys.argv) > 2 else 0

step = int(time.time()) // 30 + offset
key = base64.b32decode(secret + '=' * ((8 - len(secret) % 8) % 8), casefold=True)
msg = struct.pack('>Q', step)
digest = hmac.new(key, msg, hashlib.sha1).digest()
o = digest[-1] & 0x0F
code = struct.unpack('>I', digest[o:o+4])[0] & 0x7FFFFFFF
print(str(code % 10**6).zfill(6))
" "${secret}" "${2:-0}"
}

# ------------------------------------------------------------------
# Helper: make a JSON API call
# ------------------------------------------------------------------
api() {
  local method="${1:-GET}"; shift
  local path="$1"; shift
  local data="${1:-}"  # optional JSON body

  local args=(-sk -w "\n%{http_code}")
  if [[ -n "${data}" ]]; then
    args+=(-X "${method}" -H "Content-Type: application/json" -d "${data}")
  else
    args+=(-X "${method}")
  fi
  args+=("${BASE_URL}${path}")

  # Capture cookie jar
  local tmp_cookie
  tmp_cookie=$(mktemp /tmp/ms-cookie.XXXXXX)
  # shellcheck disable=SC2064
  trap "rm -f ${tmp_cookie}" EXIT

  local output
  output=$(curl "${args[@]}" -c "${tmp_cookie}" -b "${tmp_cookie}" 2>/dev/null || true)
  local http_code
  http_code=$(echo "${output}" | tail -n1)
  local body
  body=$(echo "${output}" | sed '$d')

  echo "${body}" | python3 -c "import json,sys; d=json.load(sys.stdin) if sys.stdin.read(1) else {}" 2>/dev/null || true
  echo "HTTP:${http_code}"
  echo "COOKIE:${tmp_cookie}"
}

echo "=== Mystery Public Auth Lifecycle Smoke Test ==="
echo "Target: ${BASE_URL}"
echo ""

# ------------------------------------------------------------------
# 1. Health check
# ------------------------------------------------------------------
echo "--- Step 1: Health Check ---"
HEALTH_OUTPUT=$(curl -sk "${BASE_URL}/health" 2>/dev/null || echo "")
HEALTH_CODE=$(curl -sk -o /dev/null -w "%{http_code}" "${BASE_URL}/health" 2>/dev/null || echo "000")
if [[ "${HEALTH_CODE}" == "200" || "${HEALTH_CODE}" == "503" ]]; then
  pass "Health endpoint (HTTP ${HEALTH_CODE})"
else
  fail "Health endpoint returned HTTP ${HEALTH_CODE}"
fi

# ------------------------------------------------------------------
# 2. Admin creates a user
# ------------------------------------------------------------------
echo "--- Step 2: Create User ---"
EMAIL="smoke-$(date +%s)@example.com"
CREATE_OUTPUT=$(curl -sk -X POST "${BASE_URL}/mystery-admin/users" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL}\",\"full_name\":\"Smoke Tester\"}" 2>/dev/null || echo "")
CREATE_CODE=$(curl -sk -o /dev/null -w "%{http_code}" -X POST "${BASE_URL}/mystery-admin/users" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL}\",\"full_name\":\"Smoke Tester\"}" 2>/dev/null || echo "000")

if [[ "${CREATE_CODE}" == "200" ]]; then
  ENROLLMENT_TOKEN=$(echo "${CREATE_OUTPUT}" | python3 -c "import json,sys; print(json.load(sys.stdin).get('enrollment_token',''))" 2>/dev/null || true)
  USER_ID=$(echo "${CREATE_OUTPUT}" | python3 -c "import json,sys; print(json.load(sys.stdin).get('user_id',''))" 2>/dev/null || true)
  if [[ -n "${ENROLLMENT_TOKEN}" ]]; then
    pass "User created (email=${EMAIL}, token_len=${#ENROLLMENT_TOKEN})"
  else
    fail "User created but no enrollment_token in response"
  fi
else
  fail "Create user returned HTTP ${CREATE_CODE}"
  echo "  Response: ${CREATE_OUTPUT}"
fi

# ------------------------------------------------------------------
# 3. Start enrollment
# ------------------------------------------------------------------
echo "--- Step 3: Start Enrollment ---"
ENROLL_START_OUTPUT=$(curl -sk -X POST "${BASE_URL}/auth/enroll/start" \
  -H "Content-Type: application/json" \
  -d "{\"enrollment_token\":\"${ENROLLMENT_TOKEN}\"}" 2>/dev/null || echo "")
ENROLL_START_CODE=$(curl -sk -o /dev/null -w "%{http_code}" -X POST "${BASE_URL}/auth/enroll/start" \
  -H "Content-Type: application/json" \
  -d "{\"enrollment_token\":\"${ENROLLMENT_TOKEN}\"}" 2>/dev/null || echo "000")

if [[ "${ENROLL_START_CODE}" == "200" ]]; then
  TOTP_SECRET=$(echo "${ENROLL_START_OUTPUT}" | python3 -c "import json,sys; print(json.load(sys.stdin).get('manual_key',''))" 2>/dev/null || true)
  if [[ -n "${TOTP_SECRET}" ]]; then
    pass "Enrollment started, TOTP secret received (len=${#TOTP_SECRET})"
  else
    fail "Enrollment started but no manual_key in response"
  fi
else
  fail "Enrollment start returned HTTP ${ENROLL_START_CODE}"
fi

# ------------------------------------------------------------------
# 4. Confirm enrollment
# ------------------------------------------------------------------
echo "--- Step 4: Confirm Enrollment ---"
TOTP_CODE=$(totp_code "${TOTP_SECRET}")
PASSWORD="SmokeTest!2026"

CONFIRM_OUTPUT=$(curl -sk -X POST "${BASE_URL}/auth/enroll/confirm" \
  -H "Content-Type: application/json" \
  -d "{\"enrollment_token\":\"${ENROLLMENT_TOKEN}\",\"password\":\"${PASSWORD}\",\"code\":\"${TOTP_CODE}\"}" 2>/dev/null || echo "")
CONFIRM_CODE=$(curl -sk -o /dev/null -w "%{http_code}" -X POST "${BASE_URL}/auth/enroll/confirm" \
  -H "Content-Type: application/json" \
  -d "{\"enrollment_token\":\"${ENROLLMENT_TOKEN}\",\"password\":\"${PASSWORD}\",\"code\":\"${TOTP_CODE}\"}" 2>/dev/null || echo "000")

if [[ "${CONFIRM_CODE}" == "200" ]]; then
  RECOVERY_CODES=$(echo "${CONFIRM_OUTPUT}" | python3 -c "import json,sys; print(json.load(sys.stdin).get('recovery_codes',[]))" 2>/dev/null || true)
  pass "Enrollment confirmed, recovery codes received"
else
  fail "Enrollment confirmation returned HTTP ${CONFIRM_CODE}"
fi

# ------------------------------------------------------------------
# 5. Login → MFA challenge
# ------------------------------------------------------------------
echo "--- Step 5: Login (Password) ---"
LOGIN_OUTPUT=$(curl -sk -X POST "${BASE_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}" 2>/dev/null || echo "")
LOGIN_CODE=$(curl -sk -o /dev/null -w "%{http_code}" -X POST "${BASE_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}" 2>/dev/null || echo "000")

if [[ "${LOGIN_CODE}" == "200" ]]; then
  CHALLENGE=$(echo "${LOGIN_OUTPUT}" | python3 -c "import json,sys; print(json.load(sys.stdin).get('challenge',''))" 2>/dev/null || true)
  if [[ -n "${CHALLENGE}" ]]; then
    pass "Login successful, MFA challenge received"
  else
    fail "Login returned 200 but no challenge"
  fi
else
  fail "Login returned HTTP ${LOGIN_CODE}"
fi

# ------------------------------------------------------------------
# 6. MFA → Session cookie
# ------------------------------------------------------------------
echo "--- Step 6: MFA Verification ---"
MFA_CODE=$(totp_code "${TOTP_SECRET}")

MFA_OUTPUT=$(curl -sk -c /tmp/ms-smoke-cookie.txt -X POST "${BASE_URL}/auth/mfa" \
  -H "Content-Type: application/json" \
  -d "{\"challenge\":\"${CHALLENGE}\",\"code\":\"${MFA_CODE}\"}" 2>/dev/null || echo "")
MFA_CODE_HTTP=$(curl -sk -o /dev/null -w "%{http_code}" -c /tmp/ms-smoke-cookie.txt -X POST "${BASE_URL}/auth/mfa" \
  -H "Content-Type: application/json" \
  -d "{\"challenge\":\"${CHALLENGE}\",\"code\":\"${MFA_CODE}\"}" 2>/dev/null || echo "000")

if [[ "${MFA_CODE_HTTP}" == "200" ]]; then
  SESSION_COOKIE=$(grep "ms_session" /tmp/ms-smoke-cookie.txt 2>/dev/null | awk '{print $NF}' || true)
  if [[ -n "${SESSION_COOKIE}" ]]; then
    pass "MFA verified, session cookie set"
  else
    fail "MFA returned 200 but no ms_session cookie"
  fi
else
  fail "MFA returned HTTP ${MFA_CODE_HTTP}"
fi

# ------------------------------------------------------------------
# 7. Authenticated session check
# ------------------------------------------------------------------
echo "--- Step 7: Authenticated Session ---"
SESSION_OUTPUT=$(curl -sk -b /tmp/ms-smoke-cookie.txt "${BASE_URL}/auth/session" 2>/dev/null || echo "")
SESSION_CODE=$(curl -sk -o /dev/null -w "%{http_code}" -b /tmp/ms-smoke-cookie.txt "${BASE_URL}/auth/session" 2>/dev/null || echo "000")

if [[ "${SESSION_CODE}" == "200" ]]; then
  SESSION_EMAIL=$(echo "${SESSION_OUTPUT}" | python3 -c "import json,sys; print(json.load(sys.stdin).get('preferred_username',''))" 2>/dev/null || true)
  if [[ "${SESSION_EMAIL}" == "${EMAIL}" ]]; then
    pass "Session returns correct user (${SESSION_EMAIL})"
  else
    fail "Session email mismatch: expected ${EMAIL}, got ${SESSION_EMAIL}"
  fi
else
  fail "Session endpoint returned HTTP ${SESSION_CODE}"
fi

# ------------------------------------------------------------------
# 8. Survey endpoints access
# ------------------------------------------------------------------
echo "--- Step 8: Survey Endpoints ---"
QUESTIONS_CODE=$(curl -sk -o /dev/null -w "%{http_code}" -b /tmp/ms-smoke-cookie.txt "${BASE_URL}/questions?survey_type=Mystery%20Shopper" 2>/dev/null || echo "000")
if [[ "${QUESTIONS_CODE}" == "200" ]]; then
  pass "Survey questions endpoint accessible (HTTP ${QUESTIONS_CODE})"
else
  fail "Survey questions endpoint returned HTTP ${QUESTIONS_CODE}"
fi

LOCATIONS_CODE=$(curl -sk -o /dev/null -w "%{http_code}" -b /tmp/ms-smoke-cookie.txt "${BASE_URL}/mystery-shopper/locations" 2>/dev/null || echo "000")
if [[ "${LOCATIONS_CODE}" == "200" ]]; then
  pass "Mystery shopper locations accessible (HTTP ${LOCATIONS_CODE})"
else
  fail "Mystery shopper locations returned HTTP ${LOCATIONS_CODE}"
fi

# ------------------------------------------------------------------
# 9. Logout
# ------------------------------------------------------------------
echo "--- Step 9: Logout ---"
LOGOUT_CODE=$(curl -sk -o /dev/null -w "%{http_code}" -X POST -b /tmp/ms-smoke-cookie.txt "${BASE_URL}/auth/logout" 2>/dev/null || echo "000")
if [[ "${LOGOUT_CODE}" == "204" ]]; then
  pass "Logout successful (HTTP 204)"
else
  fail "Logout returned HTTP ${LOGOUT_CODE}"
fi

# Verify session is no longer valid
POST_LOGOUT_CODE=$(curl -sk -o /dev/null -w "%{http_code}" -b /tmp/ms-smoke-cookie.txt "${BASE_URL}/auth/session" 2>/dev/null || echo "000")
if [[ "${POST_LOGOUT_CODE}" == "401" ]]; then
  pass "Session correctly invalidated after logout"
else
  fail "Session still valid after logout (HTTP ${POST_LOGOUT_CODE})"
fi

# ------------------------------------------------------------------
# 10. Recovery flow (re-enrollment)
# ------------------------------------------------------------------
echo "--- Step 10: Recovery ---"
# Extract first recovery code
FIRST_RECOVERY=$(echo "${RECOVERY_CODES}" | python3 -c "import json,sys; codes=eval(sys.stdin.read()); print(codes[0] if codes else '')" 2>/dev/null || true)

if [[ -n "${FIRST_RECOVERY}" ]]; then
  RECOVERY_OUTPUT=$(curl -sk -X POST "${BASE_URL}/auth/recovery" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"${EMAIL}\",\"recovery_code\":\"${FIRST_RECOVERY}\"}" 2>/dev/null || echo "")
  RECOVERY_CODE=$(curl -sk -o /dev/null -w "%{http_code}" -X POST "${BASE_URL}/auth/recovery" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"${EMAIL}\",\"recovery_code\":\"${FIRST_RECOVERY}\"}" 2>/dev/null || echo "000")
  
  if [[ "${RECOVERY_CODE}" == "200" ]]; then
    NEW_TOKEN=$(echo "${RECOVERY_OUTPUT}" | python3 -c "import json,sys; print(json.load(sys.stdin).get('enrollment_token',''))" 2>/dev/null || true)
    if [[ -n "${NEW_TOKEN}" ]]; then
      pass "Recovery successful, new enrollment token issued"
    else
      fail "Recovery returned 200 but no enrollment_token"
    fi
  else
    fail "Recovery returned HTTP ${RECOVERY_CODE}"
  fi
else
  fail "Could not extract recovery code from enrollment response"
fi

# ------------------------------------------------------------------
# Cleanup
# ------------------------------------------------------------------
rm -f /tmp/ms-smoke-cookie.txt /tmp/ms-cookie.*

echo ""
if [[ $errors -eq 0 ]]; then
  echo "=== ALL AUTH LIFECYCLE SMOKE TESTS PASSED ==="
  exit 0
else
  echo "=== ${errors} SMOKE TEST(S) FAILED ==="
  exit 1
fi
