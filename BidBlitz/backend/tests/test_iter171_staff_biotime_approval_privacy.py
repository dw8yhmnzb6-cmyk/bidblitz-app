"""
Iteration 171 regression tests
- Staff BioTime auth/status/enroll/clock API checks
- POS Security approval execution + privacy checks
- Auth hardening checks (cookies, CORS credentials, brute-force lockout)
"""

import os
import secrets
from pathlib import Path

import pytest
import requests


def _load_base_url() -> str:
    from_env = (os.environ.get("REACT_APP_BACKEND_URL") or "").strip()
    if from_env:
        return from_env.rstrip("/")
    env_file = Path("/app/frontend/.env")
    if env_file.exists():
        for line in env_file.read_text(encoding="utf-8").splitlines():
            if line.startswith("REACT_APP_BACKEND_URL="):
                return line.split("=", 1)[1].strip().strip('"').rstrip("/")
    return ""


BASE_URL = _load_base_url()

STAFF_IDENTIFIER = "mitarbeiter@bidblitz.ae"
STAFF_PIN = "1234"

MERCHANT_EMAIL = "haendler@bidblitz.ae"
MERCHANT_PASSWORD = "Haendler2026!"
STORE_ID = "69d23d461f01d08a8214f6a0"
REGISTER_ID = "DEV-A1DAE025"
CUSTOMER_NUMBER = "BE79059"


@pytest.fixture(scope="module")
def base_url():
    if not BASE_URL:
        pytest.skip("REACT_APP_BACKEND_URL not set")
    return BASE_URL


@pytest.fixture(scope="module")
def staff_session(base_url):
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    resp = session.post(
        f"{base_url}/api/staff/auth/terminal-pin",
        json={"identifier": STAFF_IDENTIFIER, "pin": STAFF_PIN},
    )
    if resp.status_code != 200:
        pytest.skip(f"Staff terminal PIN login failed: {resp.status_code} - {resp.text}")
    return session


@pytest.fixture(scope="module")
def merchant_session(base_url):
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    resp = session.post(
        f"{base_url}/api/auth/login",
        json={"email": MERCHANT_EMAIL, "password": MERCHANT_PASSWORD},
    )
    if resp.status_code != 200:
        pytest.skip(f"Merchant login failed: {resp.status_code} - {resp.text}")
    return session


def _resolve_customer(merchant_session, base_url):
    resp = merchant_session.post(
        f"{base_url}/api/pos/customer/resolve",
        json={
            "store_id": STORE_ID,
            "register_id": REGISTER_ID,
            "lookup_type": "customer_number",
            "value": CUSTOMER_NUMBER,
        },
    )
    assert resp.status_code == 200, f"Customer resolve failed: {resp.status_code} - {resp.text}"
    data = resp.json()
    assert data.get("resolution_id")
    return data


class TestAuthHardeningSmoke:
    # Auth playbook: login cookie flags, CORS credentials, lockout behavior

    def test_login_sets_httponly_cookies(self, base_url):
        session = requests.Session()
        resp = session.post(
            f"{base_url}/api/auth/login",
            json={"email": MERCHANT_EMAIL, "password": MERCHANT_PASSWORD},
            headers={"Content-Type": "application/json"},
        )
        assert resp.status_code == 200, f"Login failed: {resp.status_code} - {resp.text}"
        set_cookie = resp.headers.get("set-cookie", "").lower()
        assert "httponly" in set_cookie, "Expected HttpOnly flag in auth cookies"
        assert "access_token=" in set_cookie or "refresh_token=" in set_cookie, "Expected auth cookies in response"

    def test_cors_explicit_origin_with_credentials(self, base_url):
        origin = base_url
        resp = requests.options(
            f"{base_url}/api/auth/login",
            headers={
                "Origin": origin,
                "Access-Control-Request-Method": "POST",
            },
        )
        assert resp.status_code in (200, 204)
        assert resp.headers.get("access-control-allow-origin") == origin
        assert resp.headers.get("access-control-allow-credentials") == "true"

    def test_bruteforce_lockout_after_five_failures(self, base_url):
        # Use a unique email to avoid contaminating existing users
        target = f"lockout.{secrets.token_hex(4)}@example.com"
        payload = {"email": target, "password": "WrongPass123!"}

        statuses = []
        for _ in range(6):
            resp = requests.post(f"{base_url}/api/auth/login", json=payload)
            statuses.append(resp.status_code)

        assert statuses[:5].count(401) >= 4, f"Expected mostly 401 in first five attempts, got {statuses}"
        assert statuses[5] == 429, f"Expected lockout (429) on 6th attempt, got {statuses[5]}"


class TestStaffBioTime:
    # Staff BioTime: session-required status, enrollment privacy, clocking + session creation

    def test_status_requires_staff_session(self, base_url):
        resp = requests.get(f"{base_url}/api/biopay/staff/biotime/status")
        assert resp.status_code == 401, f"Expected 401 without staff_session, got {resp.status_code}"

    def test_status_public_payload_no_objectid(self, staff_session, base_url):
        resp = staff_session.get(f"{base_url}/api/biopay/staff/biotime/status")
        assert resp.status_code == 200, f"BioTime status failed: {resp.status_code} - {resp.text}"
        data = resp.json()

        assert data.get("ok") is True
        assert isinstance(data.get("profiles", []), list)
        assert isinstance(data.get("recent_events", []), list)
        assert isinstance(data.get("recent_sessions", []), list)

        for collection in ("profiles", "recent_events", "recent_sessions", "terminals"):
            for item in data.get(collection, []):
                assert "_id" not in item, f"_id leaked in {collection}"

    def test_staff_enroll_returns_public_profile_only(self, staff_session, base_url):
        token = f"PALM-STAFF-ITER171-{secrets.token_hex(4).upper()}"
        resp = staff_session.post(
            f"{base_url}/api/biopay/staff/biotime/enroll",
            json={"template_token": token, "modality": "palm", "nickname": "QA Palm"},
        )
        assert resp.status_code == 200, f"Enroll failed: {resp.status_code} - {resp.text}"
        profile = resp.json().get("profile", {})

        assert profile.get("profile_id")
        assert profile.get("modality") == "palm"
        assert "token_preview" in profile
        assert "template_token_encrypted" not in profile
        assert "token_fingerprint" not in profile
        assert "_id" not in profile

        status_resp = staff_session.get(f"{base_url}/api/biopay/staff/biotime/status")
        assert status_resp.status_code == 200
        profiles = status_resp.json().get("profiles", [])
        for item in profiles:
            assert "template_token_encrypted" not in item
            assert "token_fingerprint" not in item
            assert "_id" not in item

        # Store token for clock test
        self._clock_token = token

    def test_staff_clock_records_event_and_session(self, staff_session, base_url):
        token = getattr(self, "_clock_token", f"PALM-STAFF-ITER171-{secrets.token_hex(4).upper()}")
        # Ensure profile exists for token
        staff_session.post(
            f"{base_url}/api/biopay/staff/biotime/enroll",
            json={"template_token": token, "modality": "palm", "nickname": "Clock Palm"},
        )

        clock_resp = staff_session.post(
            f"{base_url}/api/biopay/staff/biotime/clock",
            json={
                "template_token": token,
                "event_type": "check_in",
                "modality": "palm",
                "store_id": STORE_ID,
                "register_id": REGISTER_ID,
            },
        )
        assert clock_resp.status_code == 200, f"Clock failed: {clock_resp.status_code} - {clock_resp.text}"
        payload = clock_resp.json()
        assert payload.get("ok") is True
        assert payload.get("status") == "recorded"
        assert payload.get("event", {}).get("id")
        assert payload.get("session", {}).get("session_id")

        event_id = payload["event"]["id"]
        session_id = payload["session"]["session_id"]

        status_resp = staff_session.get(f"{base_url}/api/biopay/staff/biotime/status")
        assert status_resp.status_code == 200
        status_data = status_resp.json()
        recent_event_ids = {e.get("id") or e.get("event_id") for e in status_data.get("recent_events", [])}
        recent_session_ids = {s.get("session_id") for s in status_data.get("recent_sessions", [])}
        assert event_id in recent_event_ids, "Clock event not found in staff recent_events"
        assert session_id in recent_session_ids, "BioPay session not found in staff recent_sessions"


class TestApprovalExecutionAndPrivacy:
    # Executable approval flow + privacy regression checks

    def test_manual_adjustment_approval_executes_and_repeat_rejected(self, merchant_session, base_url):
        resolved = _resolve_customer(merchant_session, base_url)
        resolution_id = resolved["resolution_id"]

        req_resp = merchant_session.post(
            f"{base_url}/api/pos/security/manual-wallet-adjustment/request",
            json={
                "store_id": STORE_ID,
                "register_id": REGISTER_ID,
                "resolution_id": resolution_id,
                "amount": 12.5,
                "reason": "Iter171 execution test",
            },
        )
        assert req_resp.status_code == 200, f"Manual adjustment request failed: {req_resp.status_code} - {req_resp.text}"
        req_data = req_resp.json()
        assert req_data.get("status") == "approval_required"

        # Privacy: customer object must remain masked-only
        customer = req_data.get("customer", {})
        assert "masked_name" in customer
        assert "customer_number" in customer
        assert "verification_status" in customer
        for forbidden in ("email", "full_name", "name", "balance", "wallet_balance"):
            assert forbidden not in customer, f"Privacy leak in customer response: {forbidden}"

        approval_id = req_data.get("approval", {}).get("approval_id")
        assert approval_id

        approve_resp = merchant_session.post(
            f"{base_url}/api/pos/security/approvals/{approval_id}/decision",
            json={"decision": "approved", "note": "Iter171 approve"},
        )
        assert approve_resp.status_code == 200, f"Approval decision failed: {approve_resp.status_code} - {approve_resp.text}"
        approve_data = approve_resp.json()
        assert approve_data.get("result", {}).get("status") == "executed"

        repeat_resp = merchant_session.post(
            f"{base_url}/api/pos/security/approvals/{approval_id}/decision",
            json={"decision": "approved", "note": "repeat"},
        )
        assert repeat_resp.status_code == 400, f"Repeat decision should fail with 400, got {repeat_resp.status_code}"

    def test_approval_list_privacy_no_plain_email_name_balance(self, merchant_session, base_url):
        resolved = _resolve_customer(merchant_session, base_url)
        resolution_id = resolved["resolution_id"]

        req_resp = merchant_session.post(
            f"{base_url}/api/pos/security/manual-wallet-adjustment/request",
            json={
                "store_id": STORE_ID,
                "register_id": REGISTER_ID,
                "resolution_id": resolution_id,
                "amount": 8.0,
                "reason": "Iter171 pending privacy check",
            },
        )
        assert req_resp.status_code == 200
        approval_id = req_resp.json().get("approval", {}).get("approval_id")
        assert approval_id

        queue_resp = merchant_session.get(f"{base_url}/api/pos/security/approvals?store_id={STORE_ID}")
        assert queue_resp.status_code == 200, f"Approval list failed: {queue_resp.status_code} - {queue_resp.text}"
        approvals = queue_resp.json().get("approvals", [])
        current = next((a for a in approvals if a.get("approval_id") == approval_id), None)
        assert current is not None, "Created approval not found in queue"

        # API privacy regression checks
        payload = current.get("payload", {})
        for forbidden in ("email", "plain_email", "recipient_email", "full_name", "name", "balance", "wallet_balance"):
            assert forbidden not in payload, f"Privacy leak in approval payload: {forbidden}"
