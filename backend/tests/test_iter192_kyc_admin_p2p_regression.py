"""Regression tests: KYC pending flow, admin manual KYC approval, P2P handle contracts, auth guardrails."""

import os
import uuid
from urllib.parse import urlparse

import pytest
import requests


BASE_URL = os.environ.get("REACT_APP_BACKEND_URL")


def _require_base_url() -> str:
    if not BASE_URL:
        pytest.skip("REACT_APP_BACKEND_URL is required for public endpoint testing")
    return BASE_URL.rstrip("/")


def _mk_png_bytes() -> bytes:
    # 1x1 PNG
    return (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
        b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\x0cIDATx\x9cc``\xf8\xcf\xc0\x00\x00"
        b"\x03\x01\x01\x00\x18\xdd\x8d\xb1\x00\x00\x00\x00IEND\xaeB`\x82"
    )


@pytest.fixture
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _register_user() -> tuple[requests.Session, dict, str]:
    base = _require_base_url()
    session = requests.Session()
    email = f"iter192.{uuid.uuid4().hex[:10]}@test.com"
    payload = {
        "name": "TEST Iter192 User",
        "email": email,
        "password": "TestPass2026!",
    }
    res = session.post(
        f"{base}/api/auth/register",
        json=payload,
        headers={"Content-Type": "application/json"},
        timeout=30,
    )
    assert res.status_code == 200, f"register failed: {res.status_code} {res.text}"
    data = res.json()
    assert data.get("id")
    assert data.get("email") == email
    return session, data, email


# Auth regression + contracts
def test_admin_login_success_http_only_cookie_and_admin_login_reject(api_client):
    base = _require_base_url()

    ok = api_client.post(
        f"{base}/api/auth/login",
        json={"email": "admin@bidblitz.ae", "password": "BidBlitz2026!", "remember_me": True},
        timeout=30,
    )
    assert ok.status_code == 200
    ok_data = ok.json()
    assert ok_data.get("role") == "admin"
    assert ok_data.get("email") == "admin@bidblitz.ae"
    set_cookie = ok.headers.get("set-cookie", "")
    assert "HttpOnly" in set_cookie

    removed = requests.post(
        f"{base}/api/auth/login",
        json={"email": "admin@bidblitz.com", "password": "BidBlitz2026!", "remember_me": True},
        timeout=30,
    )
    assert removed.status_code in (401, 403)


# Auth hardening: brute-force lockout contract
def test_bruteforce_lockout_after_five_failed_attempts():
    base = _require_base_url()
    identifier_email = f"lockout.{uuid.uuid4().hex[:8]}@test.com"

    for _ in range(5):
        r = requests.post(
            f"{base}/api/auth/login",
            json={"email": identifier_email, "password": "wrong-pass"},
            timeout=30,
        )
        assert r.status_code == 401

    sixth = requests.post(
        f"{base}/api/auth/login",
        json={"email": identifier_email, "password": "wrong-pass"},
        timeout=30,
    )
    assert sixth.status_code == 429


# Auth/CORS: credentials preflight behavior
def test_auth_preflight_returns_credentialed_origin_or_skip_preview_edge_behavior():
    base = _require_base_url()
    parsed = urlparse(base)
    origin = f"{parsed.scheme}://{parsed.netloc}"

    res = requests.options(
        f"{base}/api/auth/login",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
        timeout=30,
    )
    assert res.status_code in (200, 204)
    allow_origin = res.headers.get("access-control-allow-origin")
    if allow_origin == "*":
        pytest.skip("Preview ingress wildcard preflight behavior observed")
    assert allow_origin == origin
    assert res.headers.get("access-control-allow-credentials") == "true"


# KYC + admin manual approval integration
def test_kyc_submit_pending_then_admin_approve_reflected_in_me(api_client):
    base = _require_base_url()

    user_session, user_data, _ = _register_user()
    user_id = user_data["id"]

    file_bytes = _mk_png_bytes()
    files = {
        "id_front": ("front.png", file_bytes, "image/png"),
        "id_back": ("back.png", file_bytes, "image/png"),
        "selfie": ("selfie.png", file_bytes, "image/png"),
    }
    submit = user_session.post(
        f"{base}/api/kyc/submit",
        files=files,
        data={"document_type": "driver_license"},
        timeout=60,
    )
    assert submit.status_code == 200, submit.text
    submit_data = submit.json()
    assert submit_data.get("ok") is True
    assert submit_data.get("status") == "pending"

    admin_login = api_client.post(
        f"{base}/api/auth/login",
        json={"email": "admin@bidblitz.ae", "password": "BidBlitz2026!", "remember_me": True},
        timeout=30,
    )
    assert admin_login.status_code == 200

    decision = api_client.post(
        f"{base}/api/admin/customers/{user_id}/kyc",
        json={"decision": "approve", "reason": "TEST_Iter192 manual approval"},
        timeout=30,
    )
    assert decision.status_code == 200, decision.text
    decision_data = decision.json()
    assert decision_data.get("ok") is True
    assert decision_data.get("kyc_status") == "approved"
    assert decision_data.get("kyc_verified") is True

    me = user_session.get(f"{base}/api/auth/me", timeout=30)
    assert me.status_code == 200
    me_data = me.json()
    assert me_data.get("kyc_status") == "approved"
    assert me_data.get("kyc_verified") is True


# P2P handle behavior: auto assignment + claim reserved/custom
def test_registration_auto_handle_and_claim_rules():
    base = _require_base_url()

    user_session, _, _ = _register_user()

    handle_me = user_session.get(f"{base}/api/p2p/handle/me", timeout=30)
    assert handle_me.status_code == 200
    handle_data = handle_me.json()
    handle = handle_data.get("handle")
    assert isinstance(handle, str) and handle.strip() != ""
    assert handle.lower() != "bidblitz"
    assert not handle.startswith("@")

    reserved_claim = user_session.post(
        f"{base}/api/p2p/handle/claim",
        json={"handle": "bidblitz"},
        timeout=30,
    )
    assert reserved_claim.status_code == 400
    reserved_detail = str(reserved_claim.json().get("detail", ""))
    assert "reserviert" in reserved_detail.lower() or "persönlichen" in reserved_detail.lower()

    custom = f"egzon{uuid.uuid4().hex[:6]}"
    custom_claim = user_session.post(
        f"{base}/api/p2p/handle/claim",
        json={"handle": custom},
        timeout=30,
    )
    assert custom_claim.status_code == 200, custom_claim.text
    custom_data = custom_claim.json()
    assert custom_data.get("ok") is True
    assert custom_data.get("handle") == custom
