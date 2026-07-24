"""
Iteration 46 — Backend tests for:
- LiveKit: POST /api/livekit/rooms, POST /api/livekit/token, GET /api/livekit/rooms
- POS Hardware: printer/print, scanner/test, cash-drawer/open, scale/weight
- POS Age Verify + Receipts Void (regression)
- Landing Chatbot: POST /api/landing-chatbot/chat
- Super App: GET /marketplace/categories (public), GET /wallet/balance (auth)
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


# ══════════════════════════════ LiveKit ══════════════════════════════
class TestLiveKit:
    room_name = None

    def test_create_room(self, admin_session):
        name = f"test-room-{uuid.uuid4().hex[:8]}"
        r = admin_session.post(f"{BASE_URL}/api/livekit/rooms",
                               json={"room_name": name, "max_participants": 10,
                                     "is_live_shopping": True}, timeout=20)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:300]}"
        data = r.json()
        assert data["room_name"] == name
        assert data["max_participants"] == 10
        TestLiveKit.room_name = name

    def test_list_rooms(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/livekit/rooms", timeout=20)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:300]}"
        data = r.json()
        assert "rooms" in data and "total" in data
        assert isinstance(data["rooms"], list)
        if TestLiveKit.room_name:
            names = [room.get("room_name") for room in data["rooms"]]
            assert TestLiveKit.room_name in names, f"Created room not in list: {names[:5]}"

    def test_generate_token_publisher(self, admin_session):
        name = TestLiveKit.room_name or f"room-{uuid.uuid4().hex[:8]}"
        r = admin_session.post(f"{BASE_URL}/api/livekit/token",
                               json={"room_name": name, "identity": "tester-1",
                                     "is_publisher": True}, timeout=20)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:300]}"
        data = r.json()
        # Check both legacy and new field names
        for field in ["server_url", "url", "participant_token", "token",
                      "room_name", "is_publisher"]:
            assert field in data, f"Missing field: {field}"
        assert data["room_name"] == name
        assert data["is_publisher"] is True
        assert len(data["token"]) > 20 and data["token"] == data["participant_token"]

    def test_generate_token_viewer(self, admin_session):
        name = TestLiveKit.room_name or f"room-{uuid.uuid4().hex[:8]}"
        r = admin_session.post(f"{BASE_URL}/api/livekit/token",
                               json={"room_name": name, "is_publisher": False}, timeout=20)
        assert r.status_code == 200
        assert r.json()["is_publisher"] is False

    def test_token_no_auth(self):
        r = requests.post(f"{BASE_URL}/api/livekit/token",
                          json={"room_name": "x"}, timeout=20)
        assert r.status_code in (401, 403)


# ══════════════════════════════ POS Hardware ══════════════════════════════
class TestPOSHardware:
    def test_scanner_test_unknown_barcode(self, admin_session):
        # Endpoint uses query param `barcode`
        r = admin_session.get(f"{BASE_URL}/api/pos/hardware/scanner/test",
                              params={"barcode": "TEST-UNKNOWN-BARCODE-9999"}, timeout=20)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:300]}"
        data = r.json()
        assert data.get("ok") is False
        assert "barcode" in data

    def test_cash_drawer_open(self, admin_session):
        # JSON body since iter48 (was query param)
        r = admin_session.post(f"{BASE_URL}/api/pos/hardware/cash-drawer/open",
                               json={"register_id": "TEST-REG-1", "reason": "test"}, timeout=20)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:300]}"
        data = r.json()
        assert data.get("ok") is True
        assert data.get("drawer_opened") is True

    def test_printer_print_receipt_not_found(self, admin_session):
        # No such receipt -> 404 expected
        r = admin_session.post(f"{BASE_URL}/api/pos/hardware/printer/print",
                               json={"receipt_id": "TEST-NOPE-9999"}, timeout=20)
        assert r.status_code == 404, f"{r.status_code}: {r.text[:300]}"

    def test_scale_weight_no_config(self, admin_session):
        # No scale configured -> 404
        r = admin_session.get(f"{BASE_URL}/api/pos/hardware/scale/weight",
                              params={"scale_id": "default"}, timeout=20)
        assert r.status_code == 404, f"{r.status_code}: {r.text[:300]}"


# ══════════════════════════════ POS Retail ══════════════════════════════
class TestPOSRetail:
    def test_age_verify_cart_not_found(self, admin_session):
        # actual schema: cart_id + verified_by  (NOT birth_year/id_checked)
        r = admin_session.post(f"{BASE_URL}/api/pos/age-verify",
                               json={"cart_id": "TEST-NOCART-123",
                                     "verified_by": "staff-1"}, timeout=20)
        assert r.status_code == 404, f"{r.status_code}: {r.text[:300]}"

    def test_age_verify_birth_year_allowed(self, admin_session):
        # Mode 2: Ad-hoc — adult (born 2000, required 18) → allowed:true
        r = admin_session.post(f"{BASE_URL}/api/pos/age-verify",
                               json={"birth_year": 2000, "id_checked": True,
                                     "required_age": 18}, timeout=20)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:300]}"
        data = r.json()
        assert data.get("ok") is True
        assert data.get("allowed") is True
        assert data.get("age") in (25, 26)
        assert data.get("required_age") == 18

    def test_age_verify_birth_year_underage(self, admin_session):
        # Mode 2: born 2015 → age ~10/11 → not allowed
        r = admin_session.post(f"{BASE_URL}/api/pos/age-verify",
                               json={"birth_year": 2015, "id_checked": True,
                                     "required_age": 18}, timeout=20)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:300]}"
        data = r.json()
        assert data.get("ok") is True
        assert data.get("allowed") is False

    def test_age_verify_birth_year_id_not_checked(self, admin_session):
        r = admin_session.post(f"{BASE_URL}/api/pos/age-verify",
                               json={"birth_year": 2000, "id_checked": False,
                                     "required_age": 18}, timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert data.get("allowed") is False
        assert data.get("reason") == "id_not_checked"

    def test_receipts_void_not_found(self, admin_session):
        r = admin_session.post(f"{BASE_URL}/api/pos/receipts/void",
                               json={"receipt_id": "TEST-NOBON-123",
                                     "reason": "pytest regression",
                                     "voided_by": "staff-1"}, timeout=20)
        # expected 404 — regression still reachable
        assert r.status_code in (404, 400), f"{r.status_code}: {r.text[:300]}"


# ══════════════════════════════ Landing Chatbot ══════════════════════════════
class TestLandingChatbot:
    def test_chat_what_is_bidblitz(self):
        sid = f"sess-{uuid.uuid4().hex[:8]}"
        r = requests.post(f"{BASE_URL}/api/landing-chatbot/chat",
                          json={"session_id": sid, "message": "Was ist BidBlitz?"},
                          timeout=30)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:300]}"
        data = r.json()
        assert data["session_id"] == sid
        assert len(data["message"]) > 10
        assert "BidBlitz" in data["message"]

    def test_chat_demo_requires_email(self):
        sid = f"sess-{uuid.uuid4().hex[:8]}"
        r = requests.post(f"{BASE_URL}/api/landing-chatbot/chat",
                          json={"session_id": sid, "message": "Ich möchte eine Demo testen"},
                          timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert data.get("requires_email") is True
        assert any("mail" in a.lower() for a in data.get("suggested_actions", []))


# ══════════════════════════════ Super App ══════════════════════════════
class TestSuperApp:
    def test_marketplace_categories_public(self):
        r = requests.get(f"{BASE_URL}/api/super-app/marketplace/categories", timeout=20)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:300]}"
        data = r.json()
        cats = data.get("categories", [])
        assert len(cats) >= 10
        ids = {c["id"] for c in cats}
        for expected in ["flights", "hotels", "taxi", "food", "real_estate",
                         "car_rental", "event_tickets"]:
            assert expected in ids, f"missing category {expected}"
        for c in cats:
            assert "count" in c

    def test_wallet_balance_auth(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/super-app/wallet/balance", timeout=20)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:300]}"
        data = r.json()
        assert "balance" in data and data["currency"] == "EUR"
        assert isinstance(data.get("recent_transactions"), list)

    def test_wallet_balance_no_auth(self):
        r = requests.get(f"{BASE_URL}/api/super-app/wallet/balance", timeout=20)
        assert r.status_code in (401, 403)
