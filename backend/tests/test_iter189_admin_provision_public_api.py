"""Iteration 189 - Admin merchant provisioning + POS public API flow regression."""

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

MERCHANT_ID = "MER-12DA5FAE925F"


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
    """module: admin session for provisioning/toggle/price endpoints"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    response = _login(session, base_url, "admin@bidblitz.ae", "BidBlitz2026!")
    if response.status_code != 200:
        pytest.skip(f"Admin login failed: {response.status_code}")
    assert "HttpOnly" in response.headers.get("set-cookie", "")
    body = response.json()
    assert body.get("email") == "admin@bidblitz.ae"
    assert body.get("role") == "admin"
    return session


@pytest.fixture
def provisioned_context(base_url: str, admin_session: requests.Session):
    """module: provision merchant with kiosk bundle and restore one regression feature after tests"""
    # Capture original feature state for a regression feature we mutate.
    before = admin_session.get(
        f"{base_url}/api/pos/features/admin/merchant/{MERCHANT_ID}",
        timeout=30,
    )
    assert before.status_code == 200
    before_features = {f["key"]: f for f in (before.json().get("features") or [])}
    loyalty_before = before_features.get("loyalty", {})

    provision = admin_session.post(
        f"{base_url}/api/pos/features/admin/provision-merchant",
        json={
            "merchant_id": MERCHANT_ID,
            "bundle_key": "kiosk",
            "mode": "merge",
            "billing_status": "paid",
            "note": f"pytest iter189 {uuid.uuid4().hex[:8]}",
            "create_api_key": True,
            "api_key_name": "pytest iter189 key",
            "scopes": ["read", "write"],
        },
        timeout=30,
    )
    assert provision.status_code == 200
    provision_data = provision.json()
    assert provision_data.get("ok") is True
    assert provision_data.get("merchant_id") == MERCHANT_ID

    yield {
        "provision": provision_data,
        "loyalty_before": loyalty_before,
    }

    # Best effort restore loyalty custom price/enable state used by regression test.
    if loyalty_before:
        _ = admin_session.post(
            f"{base_url}/api/pos/features/admin/toggle",
            json={
                "merchant_id": MERCHANT_ID,
                "feature_key": "loyalty",
                "enabled": bool(loyalty_before.get("enabled", False)),
                "valid_until": loyalty_before.get("valid_until"),
                "custom_price": loyalty_before.get("custom_price"),
            },
            timeout=30,
        )


# module: admin provisioning creates kiosk feature activation + optional API key
def test_admin_provision_merchant_kiosk_contract(
    base_url: str,
    admin_session: requests.Session,
    provisioned_context: dict,
):
    data = provisioned_context["provision"]

    assert data.get("bundle") == "Kiosk / Spätkauf"
    activated = data.get("activated") or []
    assert len(activated) == 6
    assert {"inventory_pro", "deposits", "vouchers", "tse_fiskaly", "loyalty", "scan_and_go"}.issubset(set(activated))

    api_key = data.get("api_key") or {}
    assert api_key.get("key_id", "").startswith("bbpub_")
    assert api_key.get("key_secret", "").startswith("bbsec_")
    assert set(api_key.get("scopes") or []) == {"read", "write"}

    merchant_features = admin_session.get(
        f"{base_url}/api/pos/features/admin/merchant/{MERCHANT_ID}",
        timeout=30,
    )
    assert merchant_features.status_code == 200
    feature_map = {f["key"]: f for f in (merchant_features.json().get("features") or [])}
    assert feature_map["inventory_pro"]["enabled"] is True
    assert feature_map["vouchers"]["enabled"] is True

    merchants = admin_session.get(f"{base_url}/api/pos/admin/merchants", timeout=30)
    assert merchants.status_code == 200
    target = next(
        (m for m in (merchants.json().get("merchants") or []) if m.get("merchant_id") == MERCHANT_ID),
        None,
    )
    assert target is not None
    assert target.get("status") == "approved"
    assert target.get("billing_status") == "paid"
    assert target.get("business_type") == "kiosk"


# module: newly returned API key authenticates and returns merchant/scopes/active_features
def test_public_api_key_me_contract(base_url: str, provisioned_context: dict):
    api_key = (provisioned_context["provision"].get("api_key") or {}).get("key_secret")
    assert api_key and api_key.startswith("bbsec_")

    response = requests.get(
        f"{base_url}/api/pos/public/v1/me",
        headers={"X-API-Key": api_key},
        timeout=30,
    )
    assert response.status_code == 200
    body = response.json()
    assert (body.get("merchant") or {}).get("merchant_id") == MERCHANT_ID
    assert set(body.get("scopes") or []) == {"read", "write"}
    active_features = set(body.get("active_features") or [])
    assert {"vouchers", "inventory_pro", "scan_and_go"}.issubset(active_features)


# module: public payment flow docs include BidBlitz cashier, vouchers, topup and admin control
def test_public_payment_flow_contract(base_url: str):
    response = requests.get(f"{base_url}/api/pos/public/v1/payment-flow", timeout=30)
    assert response.status_code == 200
    body = response.json()
    assert body.get("title") == "BidBlitz an der Kasse"

    steps = body.get("steps") or []
    assert len(steps) >= 5
    joined_steps = " ".join(str(s.get("text", "")) for s in steps)
    assert "Mit BidBlitz bezahlen" in joined_steps

    voucher_sale = body.get("voucher_sale") or []
    assert any("/api/pos/vouchers/sell" in item for item in voucher_sale)
    assert any("/api/pos/vouchers/redeem-payment" in item for item in voucher_sale)

    wallet_topup = body.get("wallet_topup") or []
    assert any("/api/pos/wallet/top-up" in item for item in wallet_topup)

    admin_control = body.get("admin_control", "")
    assert "/admin/merchant-features" in admin_control
    assert "/api/pos/features/admin/provision-merchant" in admin_control


# module: regression checks for existing toggle and set-price controls
def test_admin_toggle_and_price_override_regression(
    base_url: str,
    admin_session: requests.Session,
):
    disable = admin_session.post(
        f"{base_url}/api/pos/features/admin/toggle",
        json={
            "merchant_id": MERCHANT_ID,
            "feature_key": "loyalty",
            "enabled": False,
        },
        timeout=30,
    )
    assert disable.status_code == 200
    assert disable.json().get("feature", {}).get("enabled") is False

    custom_price = 1.23
    set_price = admin_session.post(
        f"{base_url}/api/pos/features/admin/set-price",
        json={
            "merchant_id": MERCHANT_ID,
            "feature_key": "loyalty",
            "custom_price": custom_price,
        },
        timeout=30,
    )
    assert set_price.status_code == 200
    assert abs(float(set_price.json().get("monthly_price")) - custom_price) < 0.000001

    enable = admin_session.post(
        f"{base_url}/api/pos/features/admin/toggle",
        json={
            "merchant_id": MERCHANT_ID,
            "feature_key": "loyalty",
            "enabled": True,
        },
        timeout=30,
    )
    assert enable.status_code == 200
    enabled_feature = enable.json().get("feature") or {}
    assert enabled_feature.get("enabled") is True
    assert abs(float(enabled_feature.get("monthly_price")) - custom_price) < 0.000001

    verify = admin_session.get(
        f"{base_url}/api/pos/features/admin/merchant/{MERCHANT_ID}",
        timeout=30,
    )
    assert verify.status_code == 200
    feature_map = {f["key"]: f for f in (verify.json().get("features") or [])}
    loyalty = feature_map.get("loyalty") or {}
    assert loyalty.get("enabled") is True
    assert abs(float(loyalty.get("custom_price")) - custom_price) < 0.000001
    assert abs(float(loyalty.get("effective_price")) - custom_price) < 0.000001


# module: admin login regression contract (.com rejected, .ae accepted)
def test_admin_login_regression_contract(base_url: str, api_client: requests.Session):
    removed = _login(api_client, base_url, "admin@bidblitz.com", "BidBlitz2026!")
    assert removed.status_code == 401
    assert "detail" in removed.json()

    active = _login(api_client, base_url, "admin@bidblitz.ae", "BidBlitz2026!")
    assert active.status_code == 200
    active_data = active.json()
    assert active_data.get("email") == "admin@bidblitz.ae"
    assert active_data.get("role") == "admin"
