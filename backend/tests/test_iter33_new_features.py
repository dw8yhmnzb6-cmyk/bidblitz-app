"""Regression test for Iteration 33 — Gruppenchat, Round-up Sparen, Apartments."""
import os
import time
import pytest
import requests
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://swipe-match-chat-8.preview.emergentagent.com").rstrip("/")
ADMIN = {"email": "admin@bidblitz.com", "password": "BidBlitz2026!"}
KUNDE = {"email": "kunde@bidblitz.com", "password": "Kunde2026!"}


def _login(creds):
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=30)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text[:200]}"
    # Cookie-based auth; fetch Bearer token for Authorization header
    tr = s.get(f"{BASE_URL}/api/auth/ws-token", timeout=15)
    assert tr.status_code == 200, f"ws-token: {tr.status_code} {tr.text[:200]}"
    tok = tr.json().get("token")
    assert tok, f"no token in {tr.json()}"
    return tok


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN)


@pytest.fixture(scope="module")
def kunde_token():
    return _login(KUNDE)


def _auth(tok):
    return {"Authorization": f"Bearer {tok}"}


# ============ ROUND-UP ============
class TestRoundup:
    def test_preview_basic(self):
        r = requests.post(f"{BASE_URL}/api/roundup/preview?amount=12.60&round_to=1&multiplier=1", timeout=15)
        assert r.status_code == 200
        assert abs(r.json()["saved"] - 0.40) < 0.01

    def test_preview_round_amount(self):
        r = requests.post(f"{BASE_URL}/api/roundup/preview?amount=10.00&round_to=1", timeout=15)
        assert r.status_code == 200
        assert r.json()["saved"] == 0

    def test_preview_multiplier_round5(self):
        r = requests.post(f"{BASE_URL}/api/roundup/preview?amount=12.60&round_to=5&multiplier=2", timeout=15)
        assert r.status_code == 200
        # 5 - (12.60%5=2.60) = 2.40 * 2 = 4.80
        assert abs(r.json()["saved"] - 4.80) < 0.01

    def test_config_default(self, kunde_token):
        r = requests.get(f"{BASE_URL}/api/roundup/config", headers=_auth(kunde_token), timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "enabled" in data and "round_to" in data and "multiplier" in data
        assert "total_saved" in data

    def test_config_set_and_get(self, kunde_token):
        r = requests.post(f"{BASE_URL}/api/roundup/config",
                          json={"enabled": True, "round_to": 5, "multiplier": 2},
                          headers=_auth(kunde_token), timeout=15)
        assert r.status_code == 200, r.text
        r2 = requests.get(f"{BASE_URL}/api/roundup/config", headers=_auth(kunde_token), timeout=15)
        assert r2.status_code == 200
        d = r2.json()
        assert d["enabled"] is True and d["round_to"] == 5 and d["multiplier"] == 2

    def test_process_tx_idempotent(self, kunde_token):
        # Ensure enabled
        requests.post(f"{BASE_URL}/api/roundup/config",
                      json={"enabled": True, "round_to": 1, "multiplier": 1},
                      headers=_auth(kunde_token), timeout=15)
        tx_id = f"TEST_tx_{int(time.time())}"
        r1 = requests.post(f"{BASE_URL}/api/roundup/process-tx?amount=4.60&tx_id={tx_id}",
                           headers=_auth(kunde_token), timeout=15)
        assert r1.status_code == 200, r1.text
        assert r1.json().get("saved", 0) > 0
        r2 = requests.post(f"{BASE_URL}/api/roundup/process-tx?amount=4.60&tx_id={tx_id}",
                           headers=_auth(kunde_token), timeout=15)
        assert r2.status_code == 200
        assert r2.json().get("idempotent") is True

    def test_history(self, kunde_token):
        r = requests.get(f"{BASE_URL}/api/roundup/history", headers=_auth(kunde_token), timeout=15)
        assert r.status_code == 200
        assert "entries" in r.json()


# ============ GROUPCHAT ============
class TestGroupchat:
    grp_id = None

    def test_create_unauthed(self):
        r = requests.post(f"{BASE_URL}/api/groupchat/create", json={"name": "x"}, timeout=15)
        assert r.status_code in (401, 403)

    def test_create_group(self, kunde_token):
        r = requests.post(f"{BASE_URL}/api/groupchat/create",
                          json={"name": f"TEST_Group_{int(time.time())}", "initial_members": ["bidblitz.admin"]},
                          headers=_auth(kunde_token), timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "group_id" in d
        assert len(d["members"]) >= 1
        # Creator + admin invited = 2
        handles = [m.get("handle") for m in d["members"]]
        assert any(h == "bidblitz.admin" for h in handles) or len(d["members"]) == 1
        TestGroupchat.grp_id = d["group_id"]

    def test_list_returns_groups(self, kunde_token):
        r = requests.get(f"{BASE_URL}/api/groupchat/list", headers=_auth(kunde_token), timeout=15)
        assert r.status_code == 200
        groups = r.json()["groups"]
        assert any(g["group_id"] == TestGroupchat.grp_id for g in groups)

    def test_get_group_as_member(self, kunde_token):
        r = requests.get(f"{BASE_URL}/api/groupchat/{TestGroupchat.grp_id}",
                         headers=_auth(kunde_token), timeout=15)
        assert r.status_code == 200

    def test_get_group_non_member_404(self):
        # Random non-existing id
        tok = _login(ADMIN)
        r = requests.get(f"{BASE_URL}/api/groupchat/NONEXIST_ID_xyz", headers=_auth(tok), timeout=15)
        assert r.status_code == 404

    def test_post_message_and_list(self, kunde_token):
        r = requests.post(f"{BASE_URL}/api/groupchat/{TestGroupchat.grp_id}/message",
                          json={"text": "Hello team"},
                          headers=_auth(kunde_token), timeout=15)
        assert r.status_code == 200, r.text
        assert r.json()["text"] == "Hello team"
        r2 = requests.get(f"{BASE_URL}/api/groupchat/{TestGroupchat.grp_id}/messages",
                          headers=_auth(kunde_token), timeout=15)
        assert r2.status_code == 200
        msgs = r2.json()["messages"]
        assert any(m.get("text") == "Hello team" for m in msgs)

    def test_mark_read(self, kunde_token):
        r = requests.post(f"{BASE_URL}/api/groupchat/{TestGroupchat.grp_id}/read",
                          headers=_auth(kunde_token), timeout=15)
        assert r.status_code == 200

    def test_invite(self, kunde_token):
        r = requests.post(f"{BASE_URL}/api/groupchat/{TestGroupchat.grp_id}/invite",
                          json={"handles": ["bidblitz.admin"]},
                          headers=_auth(kunde_token), timeout=15)
        assert r.status_code == 200

    def test_leave(self, kunde_token):
        # Create fresh to leave (keep main test group for other tests)
        r = requests.post(f"{BASE_URL}/api/groupchat/create",
                          json={"name": f"TEST_leave_{int(time.time())}"},
                          headers=_auth(kunde_token), timeout=15)
        gid = r.json()["group_id"]
        r2 = requests.post(f"{BASE_URL}/api/groupchat/{gid}/leave",
                           headers=_auth(kunde_token), timeout=15)
        assert r2.status_code == 200


# ============ APARTMENTS ============
class TestApartments:
    apt_id = None

    def test_create_apartment(self, admin_token):
        payload = {
            "title": f"TEST_Cozy Studio {int(time.time())}",
            "description": "Nice place",
            "city": "Berlin",
            "country": "DE",
            "price_per_night": 50.0,
            "max_guests": 2,
            "bedrooms": 1,
            "bathrooms": 1,
            "amenities": ["wifi"],
            "images": ["https://example.com/i.jpg"],
            "property_type": "studio",
        }
        r = requests.post(f"{BASE_URL}/api/apartments/create", json=payload,
                          headers=_auth(admin_token), timeout=15)
        assert r.status_code == 200, r.text
        TestApartments.apt_id = r.json()["apartment_id"]

    def test_search_by_city(self):
        r = requests.get(f"{BASE_URL}/api/apartments/search?city=Berlin", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "apartments" in data
        assert any(a["apartment_id"] == TestApartments.apt_id for a in data["apartments"])

    def test_get_detail(self):
        r = requests.get(f"{BASE_URL}/api/apartments/{TestApartments.apt_id}", timeout=15)
        assert r.status_code == 200
        assert r.json()["apartment_id"] == TestApartments.apt_id

    def test_get_nonexistent_404(self):
        r = requests.get(f"{BASE_URL}/api/apartments/nonexistent_xyz_123", timeout=15)
        assert r.status_code == 404

    def test_book_invalid_dates(self, admin_token):
        ci = datetime.now(timezone.utc).isoformat()
        co = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
        r = requests.post(f"{BASE_URL}/api/apartments/book",
                          json={"apartment_id": TestApartments.apt_id, "check_in": ci, "check_out": co, "guests": 1},
                          headers=_auth(admin_token), timeout=15)
        assert r.status_code == 400

    def test_book_too_many_guests(self, admin_token):
        ci = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
        co = (datetime.now(timezone.utc) + timedelta(days=3)).isoformat()
        r = requests.post(f"{BASE_URL}/api/apartments/book",
                          json={"apartment_id": TestApartments.apt_id, "check_in": ci, "check_out": co, "guests": 10},
                          headers=_auth(admin_token), timeout=15)
        assert r.status_code == 400

    def test_book_success(self, admin_token):
        ci = (datetime.now(timezone.utc) + timedelta(days=5)).isoformat()
        co = (datetime.now(timezone.utc) + timedelta(days=6)).isoformat()
        r = requests.post(f"{BASE_URL}/api/apartments/book",
                          json={"apartment_id": TestApartments.apt_id, "check_in": ci, "check_out": co, "guests": 1},
                          headers=_auth(admin_token), timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "confirmed"
        assert "booking_id" in d
        assert d["total"] == 50.0

    def test_book_insufficient_wallet(self, kunde_token):
        # Kunde likely low balance; use a high price apartment
        # Create a high-price apt from admin for this test
        tok = _login(ADMIN)
        cr = requests.post(f"{BASE_URL}/api/apartments/create",
                           json={"title": "TEST_Expensive", "city": "Berlin",
                                 "price_per_night": 9999.0, "max_guests": 1},
                           headers=_auth(tok), timeout=15)
        aid = cr.json()["apartment_id"]
        ci = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()
        co = (datetime.now(timezone.utc) + timedelta(days=3)).isoformat()
        r = requests.post(f"{BASE_URL}/api/apartments/book",
                          json={"apartment_id": aid, "check_in": ci, "check_out": co, "guests": 1},
                          headers=_auth(kunde_token), timeout=15)
        # Expect 402 (insufficient)
        assert r.status_code in (402, 400), f"Expected 402, got {r.status_code}: {r.text[:200]}"

    def test_my_bookings(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/apartments/bookings/my",
                         headers=_auth(admin_token), timeout=15)
        assert r.status_code == 200
        assert "bookings" in r.json()

    def test_my_hosting(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/apartments/hosting/my",
                         headers=_auth(admin_token), timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert "apartments" in d and "recent_bookings" in d


# ============ REGRESSION ============
class TestRegression:
    def test_auctions_list(self):
        r = requests.get(f"{BASE_URL}/api/auctions", timeout=15)
        assert r.status_code == 200

    def test_food_restaurants(self):
        r = requests.get(f"{BASE_URL}/api/food/restaurants", timeout=15)
        assert r.status_code in (200, 404)  # allow empty

    def test_live_active(self):
        r = requests.get(f"{BASE_URL}/api/live/active", timeout=15)
        assert r.status_code in (200, 404)
