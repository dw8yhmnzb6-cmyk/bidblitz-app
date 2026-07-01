"""
Backend-Tests fuer NEUE Stripe-Checkout Endpunkte in pos_features.py
Iteration 22 — getest werden:
 - POST /api/pos/features/checkout/create (1/3/6/12 Monate, Mengenrabatt, Validierung, Auth)
 - GET  /api/pos/features/checkout/status/{session_id} (pending + 404)
 - GET  /api/pos/features/purchases/me (Liste der Kaeufe)
 - REGRESSION: /api/pos/features/me, /api/pos/features/admin/toggle, /api/pos/features/catalog
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://biometric-checkout-7.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@bidblitz.com"
ADMIN_PASSWORD = "BidBlitz2026!"
ORIGIN_URL = "https://biometric-checkout-7.preview.emergentagent.com"

# globals to share across tests (small suite, ok)
SESSION_IDS = {}


@pytest.fixture(scope="module")
def admin_session():
    """Cookie-basiertes Login als Admin (auch Merchant Owner)."""
    s = requests.Session()
    r = s.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=20,
    )
    if r.status_code != 200:
        pytest.skip(f"Admin-Login fehlgeschlagen ({r.status_code}): {r.text[:200]}")
    return s


@pytest.fixture(scope="module")
def merchant_id(admin_session):
    """Admin hat Merchant-Profil. ID aus /api/pos/features/me holen."""
    r = admin_session.get(f"{BASE_URL}/api/pos/features/me", timeout=20)
    if r.status_code != 200:
        pytest.skip(f"Konnte Merchant nicht ermitteln: {r.status_code}")
    return r.json().get("merchant_id")


# ─────────────────────────────────────────────────────────────
# REGRESSION
# ─────────────────────────────────────────────────────────────
class TestRegression:
    def test_catalog_public(self):
        r = requests.get(f"{BASE_URL}/api/pos/features/catalog", timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert "features" in data
        keys = [f["key"] for f in data["features"]]
        assert "table_qr_orders" in keys
        # Preis fuer table_qr_orders muss 14.90 sein
        f = next(x for x in data["features"] if x["key"] == "table_qr_orders")
        assert f["monthly_price"] == 14.90

    def test_features_me(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/pos/features/me", timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert "merchant_id" in data
        assert isinstance(data["features"], list)
        assert len(data["features"]) >= 18

    def test_admin_toggle(self, admin_session, merchant_id):
        # toggle vouchers (default true) auf true (idempotent)
        r = admin_session.post(
            f"{BASE_URL}/api/pos/features/admin/toggle",
            json={"merchant_id": merchant_id, "feature_key": "vouchers", "enabled": True},
            timeout=20,
        )
        assert r.status_code == 200
        data = r.json()
        assert data["ok"] is True
        assert data["feature"]["feature_key"] == "vouchers"
        assert data["feature"]["enabled"] is True


# ─────────────────────────────────────────────────────────────
# CHECKOUT/CREATE — Pricing & Discounts
# ─────────────────────────────────────────────────────────────
class TestCheckoutCreate:
    def test_no_auth_returns_401(self):
        r = requests.post(
            f"{BASE_URL}/api/pos/features/checkout/create",
            json={"feature_key": "table_qr_orders", "months": 1, "origin_url": ORIGIN_URL},
            timeout=20,
        )
        assert r.status_code == 401, f"Expected 401, got {r.status_code}: {r.text[:200]}"

    def test_unknown_feature_returns_400(self, admin_session):
        r = admin_session.post(
            f"{BASE_URL}/api/pos/features/checkout/create",
            json={"feature_key": "unknown_feature", "months": 1, "origin_url": ORIGIN_URL},
            timeout=20,
        )
        assert r.status_code == 400, f"Got {r.status_code}: {r.text[:200]}"

    def test_invalid_months_2_returns_400(self, admin_session):
        r = admin_session.post(
            f"{BASE_URL}/api/pos/features/checkout/create",
            json={"feature_key": "table_qr_orders", "months": 2, "origin_url": ORIGIN_URL},
            timeout=20,
        )
        assert r.status_code == 400, f"Got {r.status_code}: {r.text[:200]}"

    def test_create_1_month(self, admin_session):
        r = admin_session.post(
            f"{BASE_URL}/api/pos/features/checkout/create",
            json={"feature_key": "table_qr_orders", "months": 1, "origin_url": ORIGIN_URL},
            timeout=30,
        )
        assert r.status_code == 200, f"Got {r.status_code}: {r.text[:300]}"
        data = r.json()
        assert "checkout_url" in data
        assert data["checkout_url"].startswith("https://checkout.stripe.com/")
        assert "session_id" in data
        assert data["session_id"].startswith("cs_test_")
        assert data["amount"] == 14.90
        assert data["months"] == 1
        assert data["discount_pct"] == 0
        SESSION_IDS["m1"] = data["session_id"]

    def test_create_3_months_5pct(self, admin_session):
        r = admin_session.post(
            f"{BASE_URL}/api/pos/features/checkout/create",
            json={"feature_key": "table_qr_orders", "months": 3, "origin_url": ORIGIN_URL},
            timeout=30,
        )
        assert r.status_code == 200, f"Got {r.status_code}: {r.text[:300]}"
        data = r.json()
        # 14.90 * 3 = 44.70 ; -5% = 42.465 → 42.47
        assert data["amount"] == 42.47, f"Expected 42.47, got {data['amount']}"
        assert data["months"] == 3
        assert data["discount_pct"] == 5
        SESSION_IDS["m3"] = data["session_id"]

    def test_create_6_months_10pct(self, admin_session):
        r = admin_session.post(
            f"{BASE_URL}/api/pos/features/checkout/create",
            json={"feature_key": "table_qr_orders", "months": 6, "origin_url": ORIGIN_URL},
            timeout=30,
        )
        assert r.status_code == 200, f"Got {r.status_code}: {r.text[:300]}"
        data = r.json()
        # 14.90 * 6 = 89.40 ; -10% = 80.46
        assert data["amount"] == 80.46, f"Expected 80.46, got {data['amount']}"
        assert data["months"] == 6
        assert data["discount_pct"] == 10
        SESSION_IDS["m6"] = data["session_id"]

    def test_create_12_months_20pct(self, admin_session):
        r = admin_session.post(
            f"{BASE_URL}/api/pos/features/checkout/create",
            json={"feature_key": "table_qr_orders", "months": 12, "origin_url": ORIGIN_URL},
            timeout=30,
        )
        assert r.status_code == 200, f"Got {r.status_code}: {r.text[:300]}"
        data = r.json()
        # 14.90 * 12 = 178.80 ; -20% = 143.04
        assert data["amount"] == 143.04, f"Expected 143.04, got {data['amount']}"
        assert data["months"] == 12
        assert data["discount_pct"] == 20
        SESSION_IDS["m12"] = data["session_id"]


# ─────────────────────────────────────────────────────────────
# CHECKOUT/STATUS
# ─────────────────────────────────────────────────────────────
class TestCheckoutStatus:
    def test_status_invalid_id_returns_404(self, admin_session):
        r = admin_session.get(
            f"{BASE_URL}/api/pos/features/checkout/status/INVALID_ID",
            timeout=20,
        )
        assert r.status_code == 404

    def test_status_pending_for_real_session(self, admin_session):
        sid = SESSION_IDS.get("m1")
        if not sid:
            pytest.skip("Kein session_id aus 1-Monat Test verfuegbar")
        r = admin_session.get(
            f"{BASE_URL}/api/pos/features/checkout/status/{sid}",
            timeout=30,
        )
        assert r.status_code == 200, f"Got {r.status_code}: {r.text[:300]}"
        data = r.json()
        assert "purchase" in data
        p = data["purchase"]
        assert p is not None
        assert p["session_id"] == sid
        # Stripe Webhook noch nicht durch — sollte pending sein
        assert p["status"] in ("pending", "completed", "expired"), f"Unerwarteter Status: {p['status']}"
        # Erwartungs-felder
        assert p["feature_key"] == "table_qr_orders"
        assert p["months"] == 1
        assert p["amount"] == 14.90


# ─────────────────────────────────────────────────────────────
# PURCHASES/ME
# ─────────────────────────────────────────────────────────────
class TestPurchasesList:
    def test_purchases_me_contains_at_least_4(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/pos/features/purchases/me", timeout=20)
        assert r.status_code == 200, f"Got {r.status_code}: {r.text[:300]}"
        data = r.json()
        assert "purchases" in data
        # In dieser Test-Session haben wir 4 Pending-Eintraege erzeugt
        # (1, 3, 6, 12 Monate). Falls vorhandene Eintraege existieren,
        # ist die Liste laenger.
        assert len(data["purchases"]) >= 4, f"Erwartet >=4, gefunden {len(data['purchases'])}"
        # Alle aktuellen Session-IDs muessen drin sein
        session_ids_in_db = {p["session_id"] for p in data["purchases"]}
        for key in ("m1", "m3", "m6", "m12"):
            sid = SESSION_IDS.get(key)
            if sid:
                assert sid in session_ids_in_db, f"{key} session_id {sid} nicht in purchases/me"

    def test_purchases_me_no_auth(self):
        r = requests.get(f"{BASE_URL}/api/pos/features/purchases/me", timeout=20)
        assert r.status_code == 401
