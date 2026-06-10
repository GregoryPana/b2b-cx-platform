"""End-to-end smoke test of the mystery-public 2FA + survey flow against a live backend.

Run from backend/ with PYTHONPATH=. DATABASE_URL=... TESTING=true AUTH_MODE=mystery_public.
Creates a throwaway user, enrolls (password+TOTP), logs in, then exercises the
survey endpoints the frontend uses: questions, locations, purposes, drafts,
visit creation, response save, and submit.
"""
import base64
import datetime
import hashlib
import hmac
import json
import random
import struct
import time
import urllib.error
import urllib.request

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from tests.test_mystery_public_auth_lifecycle import create_invited_user_via_db

BASE = "http://127.0.0.1:8011"
URL = "postgresql://b2b:b2b@localhost:5432/b2b"

# The session cookie is Secure; browsers accept that on http://localhost but
# Python's CookieJar does not, so track cookies by hand.
cookies = {}


def _capture_cookies(headers):
    for value in headers.get_all("Set-Cookie") or []:
        first = value.split(";", 1)[0]
        if "=" in first:
            name, val = first.split("=", 1)
            cookies[name.strip()] = val.strip()


def call(method, path, payload=None):
    req = urllib.request.Request(BASE + path, method=method)
    req.add_header("Content-Type", "application/json")
    if cookies:
        req.add_header("Cookie", "; ".join(f"{k}={v}" for k, v in cookies.items()))
    body = json.dumps(payload).encode() if payload is not None else None
    try:
        with urllib.request.urlopen(req, body, timeout=15) as resp:
            _capture_cookies(resp.headers)
            return resp.status, json.loads(resp.read().decode() or "null")
    except urllib.error.HTTPError as e:
        _capture_cookies(e.headers)
        detail = e.read().decode(errors="replace")[:500]
        return e.code, detail


def totp_now(secret, offset=0):
    key = base64.b32decode(secret + "=" * ((8 - len(secret) % 8) % 8), casefold=True)
    counter = int(time.time()) // 30 + offset
    digest = hmac.new(key, struct.pack(">Q", counter), hashlib.sha1).digest()
    pos = digest[-1] & 0x0F
    value = (struct.unpack(">I", digest[pos:pos + 4])[0] & 0x7FFFFFFF) % 1_000_000
    return f"{value:06d}"


def main():
    engine = create_engine(URL)
    session = sessionmaker(bind=engine)()
    try:
        user = create_invited_user_via_db(session)
    finally:
        session.close()
    email, token = user["email"], user["enrollment_token"]
    print(f"user: {email}")

    status, data = call("POST", "/auth/enroll/start", {"enrollment_token": token})
    assert status == 200, f"enroll/start -> {status}: {data}"
    secret = data["manual_key"]
    print("enroll/start: OK")

    password = "E2e-Test-Passw0rd!"
    status, data = call("POST", "/auth/enroll/confirm", {
        "enrollment_token": token, "password": password, "code": totp_now(secret),
    })
    assert status == 200, f"enroll/confirm -> {status}: {data}"
    print(f"enroll/confirm: OK ({len(data['recovery_codes'])} recovery codes)")

    status, data = call("POST", "/auth/login", {"email": email, "password": password})
    assert status == 200, f"login -> {status}: {data}"
    challenge = data["challenge"]
    print("login: OK")

    # next TOTP step: the enroll step was just consumed, so use offset +1
    status, data = call("POST", "/auth/mfa", {"challenge": challenge, "code": totp_now(secret, offset=1)})
    assert status == 200, f"mfa -> {status}: {data}"
    print(f"mfa: OK (roles={data.get('roles')})")

    status, data = call("GET", "/auth/session")
    assert status == 200, f"session -> {status}: {data}"
    print("session: OK")

    status, questions = call("GET", "/questions?survey_type=Mystery%20Shopper")
    assert status == 200, f"questions -> {status}: {questions}"
    qlist = questions if isinstance(questions, list) else questions.get("questions", [])
    print(f"questions: OK ({len(qlist)})")

    status, locations = call("GET", "/mystery-shopper/locations")
    assert status == 200, f"locations -> {status}: {locations}"
    loc_list = locations if isinstance(locations, list) else locations.get("locations", [])
    assert loc_list, "no active locations"
    print(f"locations: OK ({len(loc_list)})")

    status, purposes = call("GET", "/mystery-shopper/purposes")
    assert status == 200, f"purposes -> {status}: {purposes}"
    purpose_list = purposes if isinstance(purposes, list) else purposes.get("purposes", [])
    print(f"purposes: OK ({len(purpose_list)})")

    status, drafts = call("GET", "/mystery-shopper/visits/drafts")
    assert status == 200, f"drafts -> {status}: {drafts}"
    print("drafts: OK")

    loc = loc_list[0]
    purpose = purpose_list[0] if purpose_list else "General visit"
    purpose_name = purpose.get("name") if isinstance(purpose, dict) else purpose
    status, visit = call("POST", "/mystery-shopper/visits", {
        "location_id": loc["id"] if isinstance(loc, dict) else loc,
        # random recent date: the backend blocks duplicate drafts per location+date
        "visit_date": (datetime.date.today() - datetime.timedelta(days=random.randint(1, 300))).isoformat(),
        "visit_type": "Planned",
        "visit_time": "10:30",
        "purpose_of_visit": purpose_name,
        "staff_on_duty": "E2E Staff",
        "shopper_name": "E2E Shopper",
    })
    assert status in (200, 201), f"create visit -> {status}: {visit}"
    visit_id = visit["visit_id"]
    print(f"create visit: OK ({visit_id})")

    saved = 0
    for q in qlist:
        if q.get("input_type") == "score":
            payload = {"question_id": q["id"], "score": q.get("score_max") or 5,
                       "answer_text": None, "verbatim": None, "actions": []}
        elif q.get("input_type") == "yes_no":
            payload = {"question_id": q["id"], "score": None, "answer_text": "Yes",
                       "verbatim": None, "actions": []}
        else:
            payload = {"question_id": q["id"], "score": None, "answer_text": "E2E answer",
                       "verbatim": None, "actions": []}
        status, resp = call("POST", f"/mystery-shopper/visits/{visit_id}/responses", payload)
        assert status in (200, 201), f"save response q{q['id']} -> {status}: {resp}"
        saved += 1
    print(f"responses saved: {saved}")

    status, detail = call("GET", f"/mystery-shopper/visits/{visit_id}")
    assert status == 200, f"visit detail -> {status}: {detail}"
    print("visit detail: OK")

    status, result = call("PUT", f"/mystery-shopper/visits/{visit_id}/submit")
    assert status == 200, f"submit -> {status}: {result}"
    print(f"submit: OK (report date {result.get('report_completed_date')})")

    print("\nE2E PASSED")


if __name__ == "__main__":
    main()
