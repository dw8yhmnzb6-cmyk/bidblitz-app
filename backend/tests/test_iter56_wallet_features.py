"""
Iter56 backend tests:
- POST /api/wallet/send accepts recipient_number / recipient_email / recipient
- GET /api/wallet/lookup-recipient by user_number and by email
- GET /api/wallet/ returns user_number + user fields
- GET /api/wallet/saved-recipients (200 with auth, 401 without)
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://kyc-approval-hub.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@bidblitz.com"
ADMIN_PASSWORD = "BidBlitz2026!"
KUNDE_EMAIL = "kunde@bidblitz.com"
KUNDE_PASSWORD = "Kunde2026!"
KUNDE_USER_NUMBER = "BE92130"


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=30,
    )
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    return s


# kept name for minimal diff in tests
@pytest.fixture(scope="module")
def admin_headers(admin_session):
    return admin_session


# ────────────────────────────────────────────────────────────────
# /api/wallet/ — user_number + user fields
# ────────────────────────────────────────────────────────────────
def test_wallet_root_returns_user_number_and_user(admin_headers):
    r = admin_headers.get(f"{BASE_URL}/api/wallet/", timeout=15)
    assert r.status_code == 200, f"{r.status_code} {r.text}"
    data = r.json()
    assert "user_number" in data, f"missing user_number: {data.keys()}"
    assert "user" in data, f"missing user: {data.keys()}"
    assert data["user"].get("email") == ADMIN_EMAIL
    assert data["user"].get("user_number") is not None
    assert "balance" in data
    assert "transactions" in data


# ────────────────────────────────────────────────────────────────
# /api/wallet/lookup-recipient
# ────────────────────────────────────────────────────────────────
def test_lookup_recipient_by_user_number(admin_headers):
    r = admin_headers.get(
        f"{BASE_URL}/api/wallet/lookup-recipient",
        params={"q": KUNDE_USER_NUMBER},
        timeout=15,
    )
    assert r.status_code == 200, f"{r.status_code} {r.text}"
    data = r.json()
    assert "name" in data or "email" in data, f"missing name/email: {data}"
    # Should resolve to kunde
    assert data.get("email", "").lower() == KUNDE_EMAIL or KUNDE_USER_NUMBER in str(data.get("user_number", ""))


def test_lookup_recipient_by_email(admin_headers):
    r = admin_headers.get(
        f"{BASE_URL}/api/wallet/lookup-recipient",
        params={"q": KUNDE_EMAIL},
        timeout=15,
    )
    assert r.status_code == 200, f"{r.status_code} {r.text}"
    data = r.json()
    assert data.get("email", "").lower() == KUNDE_EMAIL


def test_lookup_recipient_unknown_returns_404(admin_headers):
    r = admin_headers.get(
        f"{BASE_URL}/api/wallet/lookup-recipient",
        params={"q": "BE00000"},
        timeout=15,
    )
    assert r.status_code in (404, 400), f"{r.status_code} {r.text}"


# ────────────────────────────────────────────────────────────────
# /api/wallet/send with recipient_number
# ────────────────────────────────────────────────────────────────
def test_wallet_send_with_recipient_number(admin_headers):
    payload = {"recipient_number": KUNDE_USER_NUMBER, "amount": 1.5, "description": "TEST_iter56"}
    r = admin_headers.post(
        f"{BASE_URL}/api/wallet/send",
        json=payload,
        timeout=20,
    )
    assert r.status_code == 200, f"{r.status_code} {r.text}"
    data = r.json()
    # Common shape: success/transaction
    assert any(k in data for k in ("success", "transaction", "reference", "new_balance", "transfer_id", "id"))


def test_wallet_send_with_recipient_email(admin_headers):
    payload = {"recipient_email": KUNDE_EMAIL, "amount": 0.5, "description": "TEST_iter56_email"}
    r = admin_headers.post(
        f"{BASE_URL}/api/wallet/send",
        json=payload,
        timeout=20,
    )
    assert r.status_code == 200, f"{r.status_code} {r.text}"


def test_wallet_send_with_generic_recipient_autodetect(admin_headers):
    payload = {"recipient": KUNDE_USER_NUMBER, "amount": 0.25, "description": "TEST_iter56_auto"}
    r = admin_headers.post(
        f"{BASE_URL}/api/wallet/send",
        json=payload,
        timeout=20,
    )
    assert r.status_code == 200, f"{r.status_code} {r.text}"


# ────────────────────────────────────────────────────────────────
# /api/wallet/saved-recipients
# ────────────────────────────────────────────────────────────────
def test_saved_recipients_with_auth(admin_headers):
    r = admin_headers.get(f"{BASE_URL}/api/wallet/saved-recipients", timeout=15)
    assert r.status_code == 200, f"{r.status_code} {r.text}"
    data = r.json()
    assert isinstance(data, (list, dict))


def test_saved_recipients_without_auth():
    r = requests.get(f"{BASE_URL}/api/wallet/saved-recipients", timeout=15)
    assert r.status_code in (401, 403), f"expected 401/403, got {r.status_code}"
