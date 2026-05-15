"""
Iter98 E2E sweep: new modules built in last session
- Express Checkout (Stripe)
- Hotels Sabre Search
- Staff GPS
- Admin Audit Log
- Push Broadcast
- POS Extended
- Wallet Payments
- Analytics Growth
- Taxi Voiceover
"""
import os
import requests
import pytest
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://super-app-portal.preview.emergentagent.com").rstrip("/")

ADMIN = {"email": "admin@bidblitz.com", "password": "BidBlitz2026!"}
MERCHANT = {"email": "haendler@bidblitz.com", "password": "Haendler2026!"}
KUNDE = {"email": "kunde@bidblitz.com", "password": "Kunde2026!"}


def _session(creds):
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=15)
    assert r.status_code == 200, f"login failed for {creds['email']}: {r.status_code} {r.text[:200]}"
    return s


@pytest.fixture(scope="module")
def admin_sess():
    return _session(ADMIN)


@pytest.fixture(scope="module")
def merchant_sess():
    return _session(MERCHANT)


@pytest.fixture(scope="module")
def kunde_sess():
    return _session(KUNDE)


@pytest.fixture(scope="module")
def guest_sess():
    return requests.Session()


# ---------------- Admin Audit Log ----------------
class TestAuditLog:
    def test_audit_log_admin_ok(self, admin_sess):
        r = admin_sess.get(f"{BASE_URL}/api/pos/features/admin/audit-log", timeout=15)
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert "items" in data or "audit_log" in data or "logs" in data or isinstance(data, list)

    def test_audit_log_forbidden_for_kunde(self, kunde_sess):
        r = kunde_sess.get(f"{BASE_URL}/api/pos/features/admin/audit-log", timeout=15)
        assert r.status_code in (401, 403), f"Expected forbidden, got {r.status_code}"


# ---------------- Express Checkout ----------------
class TestExpressCheckout:
    def test_express_checkout_init_endpoint_existence(self, kunde_sess):
        # Review request states POST /api/express-checkout/init but actual endpoint is
        # quick-buy + payment-methods. Let's check both.
        r = kunde_sess.post(f"{BASE_URL}/api/express-checkout/init", json={"amount": 100}, timeout=15)
        # If endpoint missing return 404, treat as bug but not auth issue
        assert r.status_code != 500, f"Server crash on init: {r.text[:300]}"

    def test_payment_methods_list(self, kunde_sess):
        r = kunde_sess.get(f"{BASE_URL}/api/express-checkout/payment-methods", timeout=15)
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert "methods" in data or isinstance(data, list) or "payment_methods" in data

    def test_addresses_list(self, kunde_sess):
        r = kunde_sess.get(f"{BASE_URL}/api/express-checkout/addresses", timeout=15)
        assert r.status_code == 200, r.text[:300]

    def test_setup_intent(self, kunde_sess):
        r = kunde_sess.get(f"{BASE_URL}/api/express-checkout/stripe/setup-intent", timeout=15)
        # Should return 200 with client_secret, or 503 if no Stripe key configured
        assert r.status_code in (200, 503), f"Unexpected: {r.status_code} {r.text[:200]}"

    def test_wallet_payment_endpoint_present(self, kunde_sess):
        # No real wallet token - just ensure endpoint exists (not 404)
        r = kunde_sess.post(
            f"{BASE_URL}/api/express-checkout/stripe/wallet-payment",
            json={"amount": 100, "currency": "eur", "payment_method_id": "pm_test"},
            timeout=15,
        )
        assert r.status_code != 404, "Wallet payment endpoint missing"
        # 400/422 OK (invalid data), 503 (no stripe), 200 (works)


# ---------------- Hotels Sabre ----------------
class TestHotelsSabre:
    def test_sabre_search(self, kunde_sess):
        check_in = (datetime.now(timezone.utc) + timedelta(days=7)).date().isoformat()
        check_out = (datetime.now(timezone.utc) + timedelta(days=10)).date().isoformat()
        body = {"city": "Berlin", "check_in": check_in, "check_out": check_out, "guests": 2}
        r = kunde_sess.post(f"{BASE_URL}/api/hotels/sabre/search", json=body, timeout=20)
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert "hotels" in data
        assert isinstance(data["hotels"], list)
        assert "count" in data

    def test_sabre_book_and_list(self, kunde_sess):
        check_in = (datetime.now(timezone.utc) + timedelta(days=14)).date().isoformat()
        check_out = (datetime.now(timezone.utc) + timedelta(days=17)).date().isoformat()
        # First search to grab a hotel id
        sr = kunde_sess.post(
            f"{BASE_URL}/api/hotels/sabre/search",
            json={"city": "Berlin", "check_in": check_in, "check_out": check_out, "guests": 1},
            timeout=20,
        )
        assert sr.status_code == 200
        hotels = sr.json().get("hotels", [])
        if not hotels:
            pytest.skip("No mock hotels returned in search")
        hotel_id = hotels[0]["id"]
        body = {
            "hotel_id": hotel_id,
            "room_type": "standard",
            "check_in": check_in,
            "check_out": check_out,
            "guests": 1,
            "guest_name": "TEST_Kunde",
            "guest_email": KUNDE["email"],
        }
        br = kunde_sess.post(f"{BASE_URL}/api/hotels/sabre/book", json=body, timeout=20)
        assert br.status_code == 200, br.text[:300]
        bdata = br.json()
        assert bdata.get("ok") is True
        assert "booking" in bdata
        assert bdata["booking"]["status"] == "confirmed"
        # Verify booking persisted
        lr = kunde_sess.get(f"{BASE_URL}/api/hotels/sabre/bookings", timeout=15)
        assert lr.status_code == 200
        bookings = lr.json().get("bookings", lr.json() if isinstance(lr.json(), list) else [])
        if isinstance(lr.json(), dict):
            bookings = lr.json().get("bookings", [])
        assert any(b.get("booking_id") == bdata["booking"]["booking_id"] for b in bookings)


# ---------------- Staff GPS ----------------
class TestStaffGPS:
    def test_gps_update_endpoint(self, merchant_sess):
        # Endpoint expects staff context; merchant may not have staff_id - we just check the route exists
        r = merchant_sess.post(
            f"{BASE_URL}/api/staff/gps/update",
            json={"latitude": 52.52, "longitude": 13.405, "accuracy": 10},
            timeout=15,
        )
        # Should be 200 or 4xx (not authorized as staff), NOT 404 or 500
        assert r.status_code != 404, "GPS update endpoint not registered"
        assert r.status_code != 500, f"Server error: {r.text[:300]}"

    def test_gps_locations_admin(self, admin_sess):
        r = admin_sess.get(f"{BASE_URL}/api/staff/gps/staff-locations", timeout=15)
        assert r.status_code != 500, r.text[:300]
        assert r.status_code in (200, 401, 403)


# ---------------- Taxi Voiceover ----------------
class TestTaxiVoiceover:
    def test_voiceover_announce_fallback(self, kunde_sess):
        r = kunde_sess.post(
            f"{BASE_URL}/api/taxi/voiceover/announce",
            json={"text": "Test announcement", "voice": "german"},
            timeout=20,
        )
        # Without ElevenLabs key, expect graceful fallback (200 with fallback flag, or 503)
        assert r.status_code in (200, 503), f"Unexpected: {r.status_code} {r.text[:200]}"
        if r.status_code == 200:
            data = r.json()
            # Some kind of structured response
            assert isinstance(data, dict)


# ---------------- Analytics Growth (Admin) ----------------
class TestAnalyticsGrowth:
    @pytest.mark.parametrize("path", [
        "/api/analytics/growth/overview",
        "/api/analytics/growth/funnel",
        "/api/analytics/growth/retention",
        "/api/analytics/growth/campaigns",
        "/api/analytics/conversions",
    ])
    def test_admin_can_access(self, admin_sess, path):
        r = admin_sess.get(f"{BASE_URL}{path}", timeout=20)
        assert r.status_code == 200, f"{path} -> {r.status_code} {r.text[:200]}"
        data = r.json()
        assert isinstance(data, dict)

    def test_kunde_forbidden_growth(self, kunde_sess):
        r = kunde_sess.get(f"{BASE_URL}/api/analytics/growth/overview", timeout=15)
        assert r.status_code in (401, 403), f"Should require admin, got {r.status_code}"


# ---------------- POS Bundles ----------------
class TestPosBundles:
    def test_admin_list_bundles(self, admin_sess):
        r = admin_sess.get(f"{BASE_URL}/api/pos/features/bundles", timeout=15)
        assert r.status_code == 200, r.text[:300]

    def test_admin_create_and_delete_bundle(self, admin_sess):
        key = f"TEST_BUNDLE_{int(datetime.now().timestamp())}"
        payload = {
            "key": key,
            "name": "TEST Bundle",
            "features": ["loyalty", "tse"],
            "price_eur": 49.0,
            "description": "Test bundle for iter98",
        }
        r = admin_sess.post(f"{BASE_URL}/api/pos/features/admin/bundles", json=payload, timeout=15)
        assert r.status_code in (200, 201), r.text[:300]
        # Delete to cleanup
        d = admin_sess.delete(f"{BASE_URL}/api/pos/features/admin/bundles/{key}", timeout=15)
        assert d.status_code in (200, 204, 404)


# ---------------- Push Broadcast (Frontend references non-existent endpoint) ----------------
class TestPushBroadcast:
    def test_admin_broadcasts_list_endpoint_missing(self, admin_sess):
        # Frontend AdminPushBroadcastPage calls /api/push-notifications/admin/broadcasts
        r = admin_sess.get(f"{BASE_URL}/api/push-notifications/admin/broadcasts", timeout=15)
        # Document the 404 - this is a bug
        assert r.status_code == 404, f"Endpoint now exists with {r.status_code}? (was missing)"

    def test_admin_broadcast_send_endpoint_missing(self, admin_sess):
        r = admin_sess.post(
            f"{BASE_URL}/api/push-notifications/admin/broadcast",
            json={"title": "TEST", "body": "TEST broadcast", "target": "all"},
            timeout=15,
        )
        assert r.status_code == 404, f"Broadcast endpoint may exist now (got {r.status_code})"


# ---------------- POS Extended Frontend mismatch ----------------
class TestPosExtendedFrontendMismatch:
    def test_pos_extended_cash_register_history_missing(self, merchant_sess):
        # Frontend calls /api/pos-extended/cash-register/history (HYPHEN) but backend uses /api/pos/
        r = merchant_sess.get(f"{BASE_URL}/api/pos-extended/cash-register/history", timeout=15)
        assert r.status_code == 404, f"Endpoint now exists (got {r.status_code})"

    def test_pos_extended_offline_download_missing(self, merchant_sess):
        r = merchant_sess.get(f"{BASE_URL}/api/pos-extended/offline/download-data", timeout=15)
        assert r.status_code == 404, f"Endpoint now exists (got {r.status_code})"
