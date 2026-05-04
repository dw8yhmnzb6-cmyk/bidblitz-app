"""
Iteration 48 — Backend tests for P2 cleanup + new features:
- Wallet GET side-effect-free (wallet_exists flag, no auto-create)
- POS hardware JSON-body migration (cash-drawer/open, scanner/register, scanner/test)
- Age-verify birth_year range validation (1850, 2099 → 400; 2000+id_checked → allowed)
- Regressions: landing-chatbot, livekit rooms/token, pos receipts/void
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ADMIN_EMAIL = "admin@bidblitz.com"
ADMIN_PASS = "BidBlitz2026!"


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/login",
               json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=20)
    if r.status_code != 200:
        pytest.skip(f"Admin login failed ({r.status_code}): {r.text[:200]}")
    data = r.json()
    token = data.get("token") or data.get("access_token")
    if token:
        s.headers.update({"Authorization": f"Bearer {token}"})
    return s


# ════════════════ Wallet GET side-effect-free ════════════════
class TestWalletReadOnly:
    def test_wallet_balance_returns_wallet_exists_flag(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/super-app/wallet/balance", timeout=20)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:300]}"
        data = r.json()
        assert "balance" in data
        assert "wallet_exists" in data, "wallet_exists flag missing"
        assert data["currency"] == "EUR"
        assert isinstance(data["wallet_exists"], bool)
        assert isinstance(data.get("recent_transactions"), list)

    def test_wallet_balance_idempotent_read(self, admin_session):
        # Two reads in a row must not change state
        r1 = admin_session.get(f"{BASE_URL}/api/super-app/wallet/balance", timeout=20)
        r2 = admin_session.get(f"{BASE_URL}/api/super-app/wallet/balance", timeout=20)
        assert r1.status_code == 200 and r2.status_code == 200
        d1, d2 = r1.json(), r2.json()
        assert d1["wallet_exists"] == d2["wallet_exists"], (
            "wallet_exists changed between two reads → side-effect on GET"
        )
        assert d1["balance"] == d2["balance"]


# ════════════════ POS Hardware JSON-body migration ════════════════
class TestPOSHardwareJSONBody:
    def test_cash_drawer_open_json_body(self, admin_session):
        r = admin_session.post(
            f"{BASE_URL}/api/pos/hardware/cash-drawer/open",
            json={"register_id": "TEST-REG-1", "reason": "pytest"}, timeout=20)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:300]}"
        data = r.json()
        assert data.get("ok") is True
        assert data.get("drawer_opened") is True
        assert data.get("register_id") == "TEST-REG-1"

    def test_cash_drawer_open_empty_body(self, admin_session):
        # All fields optional → should default to register_id="default"
        r = admin_session.post(
            f"{BASE_URL}/api/pos/hardware/cash-drawer/open",
            json={}, timeout=20)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:300]}"
        assert r.json().get("drawer_opened") is True

    def test_cash_drawer_open_requires_auth(self):
        r = requests.post(
            f"{BASE_URL}/api/pos/hardware/cash-drawer/open",
            json={"register_id": "X"}, timeout=20)
        assert r.status_code in (401, 403)

    def test_scanner_register_json_body(self, admin_session):
        sid = f"TEST-SC-{uuid.uuid4().hex[:6]}"
        r = admin_session.post(
            f"{BASE_URL}/api/pos/hardware/scanner/register",
            json={"scanner_id": sid, "type": "usb"}, timeout=20)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:300]}"
        data = r.json()
        assert data.get("ok") is True
        assert data.get("scanner_id") == sid

    def test_scanner_test_heartbeat_no_barcode(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/pos/hardware/scanner/test", timeout=20)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:300]}"
        data = r.json()
        assert data.get("ok") is True
        assert "scanner_status" in data or "message" in data

    def test_scanner_test_with_unknown_barcode(self, admin_session):
        r = admin_session.get(
            f"{BASE_URL}/api/pos/hardware/scanner/test",
            params={"barcode": "TEST-UNKNOWN-9999"}, timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert data.get("ok") is False
        assert data.get("barcode") == "TEST-UNKNOWN-9999"


# ════════════════ Age-Verify range validation ════════════════
class TestAgeVerifyRangeValidation:
    def test_birth_year_too_low_rejected(self, admin_session):
        r = admin_session.post(
            f"{BASE_URL}/api/pos/age-verify",
            json={"birth_year": 1850, "id_checked": True,
                  "required_age": 18}, timeout=20)
        assert r.status_code == 400, f"{r.status_code}: {r.text[:300]}"
        detail = r.json().get("detail", "")
        assert "Geburtsjahr" in detail or "gültig" in detail.lower() or "bereich" in detail.lower()

    def test_birth_year_future_rejected(self, admin_session):
        r = admin_session.post(
            f"{BASE_URL}/api/pos/age-verify",
            json={"birth_year": 2099, "id_checked": True,
                  "required_age": 18}, timeout=20)
        assert r.status_code == 400, f"{r.status_code}: {r.text[:300]}"

    def test_birth_year_valid_allowed(self, admin_session):
        r = admin_session.post(
            f"{BASE_URL}/api/pos/age-verify",
            json={"birth_year": 2000, "id_checked": True,
                  "required_age": 18}, timeout=20)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:300]}"
        data = r.json()
        assert data.get("ok") is True
        assert data.get("allowed") is True


# ════════════════ Regression: existing endpoints still work ════════════════
class TestRegressions:
    def test_landing_chatbot_chat(self):
        sid = f"sess-{uuid.uuid4().hex[:8]}"
        r = requests.post(f"{BASE_URL}/api/landing-chatbot/chat",
                          json={"session_id": sid, "message": "Hallo"},
                          timeout=30)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:300]}"
        data = r.json()
        assert data["session_id"] == sid
        assert len(data["message"]) > 5

    def test_livekit_create_room(self, admin_session):
        name = f"test-room-iter48-{uuid.uuid4().hex[:6]}"
        r = admin_session.post(f"{BASE_URL}/api/livekit/rooms",
                               json={"room_name": name, "max_participants": 5}, timeout=20)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:300]}"
        assert r.json()["room_name"] == name

    def test_livekit_list_rooms(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/livekit/rooms", timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert "rooms" in data
        assert isinstance(data["rooms"], list)

    def test_livekit_token(self, admin_session):
        r = admin_session.post(f"{BASE_URL}/api/livekit/token",
                               json={"room_name": "some-room",
                                     "identity": "tester",
                                     "is_publisher": True}, timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert "token" in data and len(data["token"]) > 20

    def test_pos_receipts_void_not_found(self, admin_session):
        r = admin_session.post(f"{BASE_URL}/api/pos/receipts/void",
                               json={"receipt_id": "TEST-NOBON-ITER48",
                                     "reason": "pytest",
                                     "voided_by": "staff-1"}, timeout=20)
        assert r.status_code in (404, 400)
