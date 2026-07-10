"""Backend tests for BidBlitz Staff Subscription/Paywall."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://swipe-match-chat-8.preview.emergentagent.com").rstrip("/")

MERCHANT = {"email": "haendler@bidblitz.com", "password": "Haendler2026!"}
ADMIN = {"email": "admin@bidblitz.com", "password": "BidBlitz2026!"}


def login(creds):
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=20)
    assert r.status_code == 200, f"Login failed for {creds['email']}: {r.status_code} {r.text}"
    return s, r.json()


@pytest.fixture(scope="module")
def merchant_session():
    s, data = login(MERCHANT)
    me = s.get(f"{BASE_URL}/api/auth/me", timeout=10)
    user = me.json().get("user") or me.json()
    mid = user.get("id") or user.get("user_id") or user.get("_id") or data.get("user", {}).get("id")
    return s, mid


@pytest.fixture(scope="module")
def admin_session():
    s, _ = login(ADMIN)
    return s


@pytest.fixture(scope="module", autouse=True)
def cleanup(merchant_session, admin_session):
    """Reset merchant subscription and staff members before tests via admin override + cancel."""
    s, mid = merchant_session
    a = admin_session
    # Cancel any existing sub
    s.post(f"{BASE_URL}/api/staff/subscription/cancel", timeout=10)
    # Wipe trial_start via admin override is not enough, but DB reset isn't exposed.
    # Use admin override to set status=cancelled and reset plan; we accept "trial used" caveat.
    yield


def test_01_plans_public():
    r = requests.get(f"{BASE_URL}/api/staff/subscription/plans", timeout=10)
    assert r.status_code == 200
    data = r.json()
    ids = {p["id"] for p in data["plans"]}
    assert {"basic", "pro", "enterprise"} <= ids
    assert data["trial_days"] == 30
    # Validate prices
    plans = {p["id"]: p for p in data["plans"]}
    assert plans["basic"]["price_eur"] == 4.99
    assert plans["pro"]["price_eur"] == 9.99
    assert plans["basic"]["max_staff"] == 5
    assert plans["pro"]["max_staff"] == 20
    assert plans["enterprise"]["max_staff"] == 9999


def test_02_feature_flags():
    r = requests.get(f"{BASE_URL}/api/staff/subscription/feature-flags", timeout=10)
    assert r.status_code == 200
    flags = r.json()["flags"]
    assert "staff_module_enabled" in flags
    assert "staff_trial_enabled" in flags
    assert "staff_subscription_required" in flags


def test_03_status_requires_auth():
    r = requests.get(f"{BASE_URL}/api/staff/subscription/status", timeout=10)
    assert r.status_code == 401


def test_04_members_without_subscription_402(admin_session, merchant_session):
    s, mid = merchant_session
    a = admin_session
    # Force no subscription: admin override status=cancelled and set enabled=false? Simpler: delete via admin override is unavailable.
    # Instead: cancel sub. require_active_subscription returns 402 for status not in (trialing,active) OR if no sub.
    s.post(f"{BASE_URL}/api/staff/subscription/cancel", timeout=10)
    r = s.post(f"{BASE_URL}/api/staff/members", json={"name": "TEST_no_sub", "email": "test_nosub@example.com"}, timeout=10)
    assert r.status_code == 402, f"Expected 402, got {r.status_code}: {r.text}"
    detail = r.json().get("detail", {})
    code = detail.get("code") if isinstance(detail, dict) else None
    assert code in ("no_subscription", "subscription_inactive")


def test_05_status_no_sub_or_cancelled(merchant_session):
    s, _ = merchant_session
    r = s.get(f"{BASE_URL}/api/staff/subscription/status", timeout=10)
    assert r.status_code == 200
    data = r.json()
    # Either no sub or cancelled (not active)
    assert data["active"] is False


def test_06_admin_override_pro_trial(admin_session, merchant_session):
    """Use admin override to set trialing status (since trial may already be used)."""
    _, mid = merchant_session
    a = admin_session
    r = a.post(f"{BASE_URL}/api/staff/subscription/admin/override", json={
        "merchant_id": mid, "plan": "pro", "status": "trialing", "extend_trial_days": 30, "enabled": True
    }, timeout=10)
    assert r.status_code == 200, r.text
    sub = r.json()["subscription"]
    assert sub["plan"] == "pro"
    assert sub["status"] == "trialing"
    assert sub["max_staff"] == 20


def test_07_status_after_trial(merchant_session):
    s, _ = merchant_session
    r = s.get(f"{BASE_URL}/api/staff/subscription/status", timeout=10)
    assert r.status_code == 200
    data = r.json()
    assert data["active"] is True
    assert data["status"] == "trialing"
    assert data["plan"] == "pro"
    assert data["max_staff"] == 20
    # trial_days_left should be ~29-30
    assert data["trial_days_left"] is not None
    assert 25 <= data["trial_days_left"] <= 30


def test_08_create_member_after_trial(merchant_session):
    s, _ = merchant_session
    r = s.post(f"{BASE_URL}/api/staff/members", json={
        "name": "TEST_member_1", "email": "test_m1@example.com"
    }, timeout=10)
    assert r.status_code == 200, r.text
    assert r.json()["member"]["name"] == "TEST_member_1"


def test_09_admin_override_basic_limit(admin_session, merchant_session):
    _, mid = merchant_session
    a = admin_session
    r = a.post(f"{BASE_URL}/api/staff/subscription/admin/override", json={
        "merchant_id": mid, "plan": "basic", "status": "active", "enabled": True
    }, timeout=10)
    assert r.status_code == 200
    assert r.json()["subscription"]["max_staff"] == 5


def test_10_limit_reached_on_6th_member(merchant_session):
    s, _ = merchant_session
    # We already have 1 from test_08. Create 4 more = 5 total, then 6th must fail
    created = 0
    for i in range(2, 6):
        r = s.post(f"{BASE_URL}/api/staff/members", json={
            "name": f"TEST_member_{i}", "email": f"test_m{i}@example.com"
        }, timeout=10)
        if r.status_code == 200:
            created += 1
    # 6th should fail
    r = s.post(f"{BASE_URL}/api/staff/members", json={
        "name": "TEST_member_6", "email": "test_m6@example.com"
    }, timeout=10)
    assert r.status_code == 403, f"Expected 403, got {r.status_code}: {r.text}"
    detail = r.json().get("detail", {})
    assert detail.get("code") == "limit_reached"
    assert "Mitarbeiter-Limit" in detail.get("message", "")


def test_11_create_checkout_pro_placeholder(merchant_session):
    s, _ = merchant_session
    r = s.post(f"{BASE_URL}/api/staff/subscription/create-checkout", json={"plan": "pro"}, timeout=10)
    assert r.status_code == 200
    data = r.json()
    assert data.get("placeholder") is True
    # Verify status now active
    rs = s.get(f"{BASE_URL}/api/staff/subscription/status", timeout=10)
    assert rs.json()["status"] == "active"
    assert rs.json()["plan"] == "pro"


def test_12_admin_toggle_module(admin_session, merchant_session):
    _, mid = merchant_session
    a = admin_session
    r1 = a.post(f"{BASE_URL}/api/staff/subscription/admin/toggle-module", json={"merchant_id": mid, "enabled": False}, timeout=10)
    assert r1.status_code == 200
    assert r1.json()["enabled"] is False
    r2 = a.post(f"{BASE_URL}/api/staff/subscription/admin/toggle-module", json={"merchant_id": mid, "enabled": True}, timeout=10)
    assert r2.status_code == 200
    assert r2.json()["enabled"] is True


def test_13_cancel_subscription(merchant_session):
    s, _ = merchant_session
    r = s.post(f"{BASE_URL}/api/staff/subscription/cancel", timeout=10)
    assert r.status_code == 200
    rs = s.get(f"{BASE_URL}/api/staff/subscription/status", timeout=10)
    assert rs.json()["status"] == "cancelled"


def test_14_cleanup_members(merchant_session, admin_session):
    """Delete TEST_ members and re-cancel subscription."""
    s, mid = merchant_session
    a = admin_session
    # Reactivate so we can list/delete
    a.post(f"{BASE_URL}/api/staff/subscription/admin/override", json={
        "merchant_id": mid, "plan": "pro", "status": "active", "enabled": True
    }, timeout=10)
    r = s.get(f"{BASE_URL}/api/staff/members", timeout=10)
    if r.status_code == 200:
        for m in r.json().get("members", []):
            if m.get("name", "").startswith("TEST_"):
                s.delete(f"{BASE_URL}/api/staff/members/{m['id']}", timeout=10)
    # Cancel sub
    s.post(f"{BASE_URL}/api/staff/subscription/cancel", timeout=10)
