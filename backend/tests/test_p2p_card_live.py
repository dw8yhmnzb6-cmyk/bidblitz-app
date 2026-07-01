"""
Iteration 32 regression tests: P2P payments, Debit Card waitlist, Live Shopping streams.
Auth is cookie-based (access_token cookie set by /api/auth/login), so we use requests.Session.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://biometric-checkout-7.preview.emergentagent.com").rstrip("/")

ADMIN_EMAIL = "admin@bidblitz.com"
ADMIN_PW = "BidBlitz2026!"
KUNDE_EMAIL = "kunde@bidblitz.com"
KUNDE_PW = "Kunde2026!"


def _login(email: str, pw: str) -> requests.Session:
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/login",
               json={"email": email, "password": pw}, timeout=15)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    assert "access_token" in s.cookies
    return s


@pytest.fixture(scope="module")
def admin():
    return _login(ADMIN_EMAIL, ADMIN_PW)


@pytest.fixture(scope="module")
def kunde():
    return _login(KUNDE_EMAIL, KUNDE_PW)


# ---------- P2P: handles ----------
class TestP2PHandle:
    def test_handle_me_admin(self, admin):
        r = admin.get(f"{BASE_URL}/api/p2p/handle/me", timeout=15)
        assert r.status_code == 200
        data = r.json()
        for k in ("handle", "name", "received_count", "sent_count"):
            assert k in data

    def test_handle_me_kunde(self, kunde):
        r = kunde.get(f"{BASE_URL}/api/p2p/handle/me", timeout=15)
        assert r.status_code == 200
        assert r.json().get("handle") == "ahmet"

    def test_handle_claim_no_auth(self):
        r = requests.post(f"{BASE_URL}/api/p2p/handle/claim",
                          json={"handle": "someone"}, timeout=15)
        assert r.status_code in (401, 403)

    def test_handle_claim_invalid_chars(self, kunde):
        r = kunde.post(f"{BASE_URL}/api/p2p/handle/claim",
                       json={"handle": "BAD@@@"}, timeout=15)
        assert r.status_code in (400, 422)

    def test_handle_claim_reserved(self, kunde):
        r = kunde.post(f"{BASE_URL}/api/p2p/handle/claim",
                       json={"handle": "admin"}, timeout=15)
        assert r.status_code == 400

    def test_handle_claim_taken(self, admin):
        r = admin.post(f"{BASE_URL}/api/p2p/handle/claim",
                       json={"handle": "ahmet"}, timeout=15)
        assert r.status_code == 409

    def test_handle_lookup_valid(self, admin):
        r = admin.get(f"{BASE_URL}/api/p2p/handle/lookup/ahmet", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["handle"] == "ahmet" and "user_id" in d and "name" in d

    def test_handle_lookup_unknown(self, admin):
        r = admin.get(f"{BASE_URL}/api/p2p/handle/lookup/nosuch_zz", timeout=15)
        assert r.status_code == 404


# ---------- P2P: send + history ----------
class TestP2PSend:
    def test_send_self(self, kunde):
        r = kunde.post(f"{BASE_URL}/api/p2p/send",
                       json={"recipient_handle": "ahmet", "amount": 1.0, "note": "self"},
                       timeout=15)
        assert r.status_code == 400

    def test_send_unknown_handle(self, kunde):
        r = kunde.post(f"{BASE_URL}/api/p2p/send",
                       json={"recipient_handle": "nosuch_z", "amount": 1.0}, timeout=15)
        assert r.status_code == 404

    def test_send_amount_too_high(self, kunde):
        r = kunde.post(f"{BASE_URL}/api/p2p/send",
                       json={"recipient_handle": "bidblitz.admin", "amount": 9999.0},
                       timeout=15)
        assert r.status_code == 422

    def test_send_amount_zero(self, kunde):
        r = kunde.post(f"{BASE_URL}/api/p2p/send",
                       json={"recipient_handle": "bidblitz.admin", "amount": 0},
                       timeout=15)
        assert r.status_code == 422

    def test_send_valid(self, kunde):
        r = kunde.post(f"{BASE_URL}/api/p2p/send",
                       json={"recipient_handle": "bidblitz.admin", "amount": 1.50, "note": "test32"},
                       timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["ok"] is True and d["amount"] == 1.50 and "new_balance" in d

    def test_history(self, kunde):
        r = kunde.get(f"{BASE_URL}/api/p2p/history", timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json().get("items", []), list)


# ---------- Card ----------
class TestCard:
    def test_tiers_public(self):
        r = requests.get(f"{BASE_URL}/api/card/tiers", timeout=15)
        assert r.status_code == 200
        tiers = r.json()["tiers"]
        assert {t["id"] for t in tiers} == {"virtual_free", "physical_standard", "metal_premium"}

    def test_status_admin(self, admin):
        r = admin.get(f"{BASE_URL}/api/card/status", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert "applications" in d and "has_virtual" in d and "total_waitlist" in d

    def test_apply_without_consent(self, admin):
        r = admin.post(f"{BASE_URL}/api/card/apply",
                       json={"tier": "virtual_free", "consent_terms": False}, timeout=15)
        assert r.status_code == 400

    def test_apply_physical_missing_shipping(self, admin):
        r = admin.post(f"{BASE_URL}/api/card/apply",
                       json={"tier": "physical_standard", "consent_terms": True}, timeout=15)
        assert r.status_code == 400

    def test_apply_virtual_admin(self, admin):
        r = admin.post(f"{BASE_URL}/api/card/apply",
                       json={"tier": "virtual_free", "consent_terms": True}, timeout=15)
        assert r.status_code in (200, 409), r.text
        if r.status_code == 200:
            d = r.json()
            assert d["status"] == "issued"
            assert d["masked_pan"] and "••••" in d["masked_pan"]

    def test_apply_duplicate_virtual_kunde(self, kunde):
        r = kunde.post(f"{BASE_URL}/api/card/apply",
                       json={"tier": "virtual_free", "consent_terms": True}, timeout=15)
        assert r.status_code == 409


# ---------- Live ----------
class TestLive:
    stream_id = None

    def test_active_public_shape(self):
        r = requests.get(f"{BASE_URL}/api/live/active", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert "streams" in d and isinstance(d["streams"], list) and "count" in d

    def test_create_stream(self, kunde):
        r = kunde.post(f"{BASE_URL}/api/live/create",
                       json={"title": "Regression Stream 32", "category": "marketplace",
                             "product_ids": ["prod_a", "prod_b"]}, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "idle"
        assert "stream_id" in d and "room_key" in d
        TestLive.stream_id = d["stream_id"]

    def test_start_wrong_host(self, admin):
        r = admin.post(f"{BASE_URL}/api/live/start/{TestLive.stream_id}", timeout=15)
        assert r.status_code == 403

    def test_start_by_host(self, kunde):
        r = kunde.post(f"{BASE_URL}/api/live/start/{TestLive.stream_id}", timeout=15)
        assert r.status_code == 200
        assert r.json()["status"] == "live"

    def test_join(self, admin):
        r = admin.post(f"{BASE_URL}/api/live/join/{TestLive.stream_id}", timeout=15)
        assert r.status_code == 200
        assert r.json().get("viewer_count", 0) >= 1

    def test_active_contains_stream(self):
        r = requests.get(f"{BASE_URL}/api/live/active", timeout=15)
        ids = [s["stream_id"] for s in r.json()["streams"]]
        assert TestLive.stream_id in ids

    def test_pin_product(self, kunde):
        r = kunde.post(f"{BASE_URL}/api/live/{TestLive.stream_id}/pin",
                       json={"product_id": "prod_b"}, timeout=15)
        assert r.status_code == 200
        assert r.json()["featured_product_id"] == "prod_b"

    def test_pin_invalid_product(self, kunde):
        r = kunde.post(f"{BASE_URL}/api/live/{TestLive.stream_id}/pin",
                       json={"product_id": "not_listed"}, timeout=15)
        assert r.status_code == 400

    def test_react(self, admin):
        r = admin.post(f"{BASE_URL}/api/live/{TestLive.stream_id}/react", timeout=15)
        assert r.status_code == 200

    def test_get_stream_non_host_no_roomkey(self, admin):
        r = admin.get(f"{BASE_URL}/api/live/{TestLive.stream_id}", timeout=15)
        assert r.status_code == 200
        assert "room_key" not in r.json()

    def test_get_stream_host_has_roomkey(self, kunde):
        r = kunde.get(f"{BASE_URL}/api/live/{TestLive.stream_id}", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d.get("is_host") is True and "room_key" in d

    def test_leave(self, admin):
        r = admin.post(f"{BASE_URL}/api/live/leave/{TestLive.stream_id}", timeout=15)
        assert r.status_code == 200

    def test_end(self, kunde):
        r = kunde.post(f"{BASE_URL}/api/live/end/{TestLive.stream_id}", timeout=15)
        assert r.status_code == 200
        assert r.json()["status"] == "ended"


# ---------- Regression ----------
class TestRegression:
    def test_login_sets_cookie(self):
        s = requests.Session()
        r = s.post(f"{BASE_URL}/api/auth/login",
                   json={"email": ADMIN_EMAIL, "password": ADMIN_PW}, timeout=15)
        assert r.status_code == 200
        assert "access_token" in s.cookies

    def test_auctions_list(self):
        r = requests.get(f"{BASE_URL}/api/auctions", timeout=15)
        assert r.status_code == 200

    def test_food_restaurants(self):
        r = requests.get(f"{BASE_URL}/api/food/restaurants", timeout=15)
        assert r.status_code == 200

    def test_payments_requires_auth(self):
        r = requests.post(f"{BASE_URL}/api/payments/create-payment-intent",
                          json={"amount": 10}, timeout=15)
        assert r.status_code in (401, 403, 422)
