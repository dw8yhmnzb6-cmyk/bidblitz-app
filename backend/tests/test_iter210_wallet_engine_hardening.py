import os
import requests
from dotenv import dotenv_values


BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or dotenv_values("/app/frontend/.env").get("REACT_APP_BACKEND_URL") or "").rstrip("/")
ADMIN_EMAIL = "admin@bidblitz.ae"
ADMIN_PASSWORD = "BidBlitz2026!"
CUSTOMER_EMAIL = "agimk@me.com"


def _admin_session():
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    resp = session.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert resp.status_code == 200, f"Admin login failed: {resp.status_code} {resp.text}"
    return session


def test_admin_reconciliation_endpoint_exists_and_is_read_only():
    session = _admin_session()
    resp = session.get(f"{BASE_URL}/api/admin/wallet/reconciliation", params={"q": CUSTOMER_EMAIL, "limit": 5})
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data.get("canonical_visible_source") == "users.balance"
    assert "rows" in data
    assert "mismatch_count" in data
    assert "No balances were modified" in data.get("note", "")


def test_legacy_super_app_wallet_reads_canonical_users_balance():
    session = _admin_session()
    wallet_resp = session.get(f"{BASE_URL}/api/wallet")
    assert wallet_resp.status_code == 200, wallet_resp.text
    legacy_resp = session.get(f"{BASE_URL}/api/super-app/wallet/balance")
    assert legacy_resp.status_code == 200, legacy_resp.text

    wallet_data = wallet_resp.json()
    legacy_data = legacy_resp.json()
    assert round(float(wallet_data.get("balance", 0)), 2) == round(float(legacy_data.get("balance", 0)), 2)
    assert legacy_data.get("canonical_source") == "users.balance"
    assert legacy_data.get("deprecated") is True


def test_duplicate_topup_idempotency_is_single_booked():
    session = _admin_session()
    before = session.get(f"{BASE_URL}/api/wallet").json()
    key = "iter210-topup-admin-1"

    resp1 = session.post(f"{BASE_URL}/api/wallet/topup", json={"amount": 1.23, "payment_method": "bank_transfer", "idempotency_key": key})
    assert resp1.status_code == 200, resp1.text
    tx1 = resp1.json().get("transaction", {})

    resp2 = session.post(f"{BASE_URL}/api/wallet/topup", json={"amount": 1.23, "payment_method": "bank_transfer", "idempotency_key": key})
    assert resp2.status_code == 200, resp2.text
    tx2 = resp2.json().get("transaction", {})

    after = session.get(f"{BASE_URL}/api/wallet").json()
    delta = round(float(after.get("balance", 0)) - float(before.get("balance", 0)), 2)
    assert delta == 1.23
    assert tx1.get("id") == tx2.get("id")


def test_duplicate_send_idempotency_is_single_booked_or_rejected_consistently():
    session = _admin_session()
    key = "iter210-send-admin-1"

    resp1 = session.post(f"{BASE_URL}/api/payment/send", json={"amount": 0.5, "recipient_email": CUSTOMER_EMAIL, "description": "iter210", "idempotency_key": key})
    assert resp1.status_code == 200, resp1.text
    tx1 = resp1.json().get("transaction", {})

    resp2 = session.post(f"{BASE_URL}/api/payment/send", json={"amount": 0.5, "recipient_email": CUSTOMER_EMAIL, "description": "iter210", "idempotency_key": key})
    assert resp2.status_code == 200, resp2.text
    tx2 = resp2.json().get("transaction", {})
    assert tx1.get("id") == tx2.get("id")
