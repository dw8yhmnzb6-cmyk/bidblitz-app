"""Iteration 188 - POS admin merchant controls + blocked merchant access regression."""

import os
import uuid

import pytest
import requests


def _read_env_file_value(path: str, key: str) -> str:
    if not os.path.exists(path):
        return ""
    with open(path, "r", encoding="utf-8") as f:
        for raw in f:
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            if k.strip() == key:
                return v.strip().strip('"')
    return ""


BASE_URL = (
    os.environ.get("REACT_APP_BACKEND_URL")
    or _read_env_file_value("/app/frontend/.env", "REACT_APP_BACKEND_URL")
).rstrip("/")


@pytest.fixture(scope="session")
def base_url() -> str:
    if not BASE_URL:
        pytest.skip("REACT_APP_BACKEND_URL missing")
    return BASE_URL


@pytest.fixture
def api_client() -> requests.Session:
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


def _login(session: requests.Session, base_url: str, email: str, password: str):
    return session.post(
        f"{base_url}/api/auth/login",
        json={"email": email, "password": password, "remember_me": True},
        timeout=30,
    )


@pytest.fixture
def admin_session(base_url: str):
    """module: admin auth for POS admin endpoints"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    response = _login(session, base_url, "admin@bidblitz.ae", "BidBlitz2026!")
    if response.status_code != 200:
        pytest.skip(f"Admin login failed: {response.status_code}")
    data = response.json()
    assert data.get("email") == "admin@bidblitz.ae"
    assert data.get("role") == "admin"
    assert "HttpOnly" in response.headers.get("set-cookie", "")
    return session


@pytest.fixture
def merchant_session(base_url: str):
    """module: merchant auth used for blocked/restore feature access checks"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    response = _login(session, base_url, "haendler@bidblitz.com", "Haendler2026!")
    if response.status_code != 200:
        pytest.skip(f"Merchant login failed: {response.status_code}")
    data = response.json()
    assert data.get("email") in {"haendler@bidblitz.com", "haendler@bidblitz.ae"}
    return session


@pytest.fixture
def merchant_under_test(base_url: str, admin_session: requests.Session, merchant_session: requests.Session):
    """module: identify merchant and restore original merchant status/fields after tests"""
    me = merchant_session.get(f"{base_url}/api/pos/merchants/me", timeout=30)
    if me.status_code != 200:
        pytest.skip("Merchant profile endpoint unavailable for test account")
    me_data = me.json().get("merchant") or {}
    merchant_id = me_data.get("merchant_id")
    if not merchant_id:
        pytest.skip("Merchant account has no POS merchant profile")

    admin_list = admin_session.get(f"{base_url}/api/pos/admin/merchants", timeout=30)
    assert admin_list.status_code == 200
    merchants = admin_list.json().get("merchants") or []
    target = next((m for m in merchants if m.get("merchant_id") == merchant_id), None)
    assert target is not None

    original = {
        "business_type": target.get("business_type"),
        "billing_status": target.get("billing_status"),
        "admin_note": target.get("admin_note"),
        "fee_rate": target.get("fee_rate"),
        "status": target.get("status"),
        "status_reason": target.get("status_reason"),
    }

    yield {"merchant_id": merchant_id, "original": original}

    # Best-effort restore (status + editable fields)
    _ = admin_session.post(
        f"{base_url}/api/pos/admin/merchants/{merchant_id}/status",
        json={
            "status": "approved" if original.get("status") in {None, "approved", "pending"} else original.get("status"),
            "reason": "pytest restore",
        },
        timeout=30,
    )
    _ = admin_session.patch(
        f"{base_url}/api/pos/admin/merchants/{merchant_id}",
        json={
            "business_type": original.get("business_type") or "kiosk",
            "billing_status": original.get("billing_status") or "paid",
            "admin_note": original.get("admin_note") or "",
            "fee_rate": float(original.get("fee_rate") if original.get("fee_rate") is not None else 0.015),
        },
        timeout=30,
    )


# module: admin list contract for merchant control KPIs
def test_admin_get_merchants_contains_contract_fields(base_url: str, admin_session: requests.Session):
    response = admin_session.get(f"{base_url}/api/pos/admin/merchants", timeout=30)
    assert response.status_code == 200
    data = response.json()
    merchants = data.get("merchants") or []
    assert isinstance(merchants, list)
    assert len(merchants) > 0

    sample = merchants[0]
    assert "enabled_features_count" in sample
    assert "feature_mrr" in sample
    assert "billing_status" in sample
    assert "is_blocked" in sample
    assert isinstance(sample["enabled_features_count"], int)
    assert isinstance(float(sample["feature_mrr"]), float)


# module: admin merchant PATCH contract and ObjectId serialization safety
def test_admin_patch_merchant_updates_core_fields(base_url: str, admin_session: requests.Session, merchant_under_test: dict):
    merchant_id = merchant_under_test["merchant_id"]
    marker = f"pytest-iter188-{uuid.uuid4().hex[:8]}"
    payload = {
        "business_type": "gastro",
        "billing_status": "manual",
        "admin_note": marker,
        "fee_rate": 0.017,
    }
    response = admin_session.patch(
        f"{base_url}/api/pos/admin/merchants/{merchant_id}",
        json=payload,
        timeout=30,
    )
    assert response.status_code == 200
    data = response.json()
    assert data.get("ok") is True
    merchant = data.get("merchant") or {}
    assert merchant.get("merchant_id") == merchant_id
    assert merchant.get("business_type") == "gastro"
    assert merchant.get("billing_status") == "manual"
    assert merchant.get("admin_note") == marker
    assert abs(float(merchant.get("fee_rate")) - 0.017) < 0.000001
    assert "_id" not in merchant


# module: block/restore status endpoint and access_blocked response contract
def test_admin_status_toggle_blocked_and_approved(base_url: str, admin_session: requests.Session, merchant_under_test: dict):
    merchant_id = merchant_under_test["merchant_id"]
    reason = f"Nicht bezahlt - pytest {uuid.uuid4().hex[:6]}"

    blocked = admin_session.post(
        f"{base_url}/api/pos/admin/merchants/{merchant_id}/status",
        json={"status": "blocked", "reason": reason},
        timeout=30,
    )
    assert blocked.status_code == 200
    blocked_data = blocked.json()
    assert blocked_data.get("ok") is True
    blocked_merchant = blocked_data.get("merchant") or {}
    assert blocked_merchant.get("status") == "blocked"
    assert blocked_merchant.get("access_blocked") is True
    assert blocked_merchant.get("status_reason") == reason

    approved = admin_session.post(
        f"{base_url}/api/pos/admin/merchants/{merchant_id}/status",
        json={"status": "approved", "reason": "Freigabe pytest"},
        timeout=30,
    )
    assert approved.status_code == 200
    approved_data = approved.json()
    assert approved_data.get("ok") is True
    approved_merchant = approved_data.get("merchant") or {}
    assert approved_merchant.get("status") == "approved"
    assert approved_merchant.get("access_blocked") is False


# module: blocked merchant can login but features/me is forbidden until restore
def test_blocked_merchant_features_forbidden_then_restored(
    base_url: str,
    admin_session: requests.Session,
    merchant_session: requests.Session,
    merchant_under_test: dict,
):
    merchant_id = merchant_under_test["merchant_id"]
    reason = f"Block wegen offener Rechnung {uuid.uuid4().hex[:6]}"

    block = admin_session.post(
        f"{base_url}/api/pos/admin/merchants/{merchant_id}/status",
        json={"status": "blocked", "reason": reason},
        timeout=30,
    )
    assert block.status_code == 200

    relogin = _login(merchant_session, base_url, "haendler@bidblitz.com", "Haendler2026!")
    assert relogin.status_code == 200

    features_blocked = merchant_session.get(f"{base_url}/api/pos/features/me", timeout=30)
    assert features_blocked.status_code == 403
    blocked_body = features_blocked.json()
    assert reason in str(blocked_body.get("detail", ""))

    # Regression guard documented by main agent: merchant profile endpoint remains readable even if blocked
    merchant_profile = merchant_session.get(f"{base_url}/api/pos/merchants/me", timeout=30)
    assert merchant_profile.status_code == 200

    restore = admin_session.post(
        f"{base_url}/api/pos/admin/merchants/{merchant_id}/status",
        json={"status": "approved", "reason": "Wieder freigegeben pytest"},
        timeout=30,
    )
    assert restore.status_code == 200

    features_ok = merchant_session.get(f"{base_url}/api/pos/features/me", timeout=30)
    assert features_ok.status_code == 200
    features_body = features_ok.json()
    assert features_body.get("merchant_id") == merchant_id
    assert isinstance(features_body.get("features"), list)


# module: admin credential regression (.com disabled, .ae active)
def test_admin_email_regression_contract(base_url: str, api_client: requests.Session):
    removed = _login(api_client, base_url, "admin@bidblitz.com", "BidBlitz2026!")
    assert removed.status_code == 401
    removed_body = removed.json()
    assert "detail" in removed_body

    active = _login(api_client, base_url, "admin@bidblitz.ae", "BidBlitz2026!")
    assert active.status_code == 200
    active_body = active.json()
    assert active_body.get("email") == "admin@bidblitz.ae"
    assert active_body.get("role") == "admin"
