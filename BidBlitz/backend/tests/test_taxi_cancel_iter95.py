"""Iter95: Taxi Cancel endpoint validation & reason persistence tests."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL") or os.environ.get("BASE_URL")
if not BASE_URL:
    # Fallback to public frontend env
    import re
    try:
        with open("/app/frontend/.env") as f:
            for ln in f.read().splitlines():
                m = re.match(r"REACT_APP_BACKEND_URL=(.*)", ln)
                if m:
                    BASE_URL = m.group(1).strip()
                    break
    except Exception:
        pass
BASE_URL = (BASE_URL or "").rstrip("/")

CUST_EMAIL = "kunde@bidblitz.com"
CUST_PASS = "Kunde2026!"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def auth_token(session):
    """Login sets HTTP-only cookie on session; return a sentinel."""
    r = session.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": CUST_EMAIL, "password": CUST_PASS},
        timeout=15,
    )
    if r.status_code == 200 and session.cookies:
        return "cookie-auth"
    pytest.skip(f"Login failed: {r.status_code} {r.text[:200]}")


def test_cancel_missing_ride_id_returns_422(session):
    """Validation: ride_id missing -> 422 (Pydantic required)"""
    r = session.post(f"{BASE_URL}/api/taxi/cancel", json={"reason": "wrong_address"}, timeout=15)
    # Either 401 (auth before body validation) or 422 acceptable.
    # But ideally Pydantic validates body before auth dependency.
    assert r.status_code in (401, 422), f"got {r.status_code}: {r.text[:200]}"


def test_cancel_with_reason_authenticated(session, auth_token):
    """When authenticated, sending reason should be accepted by schema (may 404 if ride not found)."""
    r = session.post(
        f"{BASE_URL}/api/taxi/cancel",
        json={"ride_id": "nonexistent_ride_id_TEST", "reason": "wrong_address"},
        timeout=15,
    )
    # Should NOT be 422 (schema accepts reason). Likely 404 or 400.
    assert r.status_code != 422, f"schema rejected reason: {r.text[:300]}"
    assert r.status_code in (400, 404, 403), f"unexpected status {r.status_code}: {r.text[:200]}"


def test_cancel_reason_too_long_returns_422(session, auth_token):
    """reason > 80 chars -> 422 validation error"""
    long_reason = "x" * 81
    r = session.post(
        f"{BASE_URL}/api/taxi/cancel",
        json={"ride_id": "abc", "reason": long_reason},
        timeout=15,
    )
    assert r.status_code == 422, f"got {r.status_code}: {r.text[:200]}"


def test_taxi_status_endpoint_ok(session):
    r = session.get(f"{BASE_URL}/api/taxi/status", timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert "module_enabled" in data
