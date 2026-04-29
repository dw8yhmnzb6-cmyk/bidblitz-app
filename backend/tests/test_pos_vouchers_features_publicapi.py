"""
Backend tests for POS Vouchers, Wallet Top-up, Feature-Flags, Public API v1,
Kassenmeldung, Z-Bon/DSFinV-K endpoints and regression for cart+payment.

Auth: cookie-based login as admin (admin@bidblitz.com).
The admin already owns merchant 'Eiscafe' MER-520D937E02F3 with store S1, register R1.
"""

import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ADMIN_EMAIL = "admin@bidblitz.com"
ADMIN_PASSWORD = "BidBlitz2026!"


# ─────────────────────────── Fixtures ───────────────────────────

@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/login",
               json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
               timeout=30)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="module")
def merchant_ctx(session):
    """Get/ensure merchant + a store_id + register_id for tests."""
    r = session.get(f"{BASE_URL}/api/pos/merchants/me", timeout=30)
    assert r.status_code == 200, r.text
    merchant = r.json().get("merchant") or r.json()
    merchant_id = merchant.get("merchant_id")

    # Get stores
    r = session.get(f"{BASE_URL}/api/pos/stores", timeout=30)
    assert r.status_code == 200, r.text
    stores = r.json().get("stores", [])
    if not stores:
        pytest.skip("Kein Store vorhanden")
    store_id = stores[0]["store_id"]

    # Get registers
    r = session.get(f"{BASE_URL}/api/pos/registers", params={"store_id": store_id}, timeout=30)
    assert r.status_code == 200, r.text
    regs = r.json().get("registers", [])
    if not regs:
        pytest.skip("Keine Kasse vorhanden")
    register_id = regs[0]["register_id"]

    # Open shift (idempotent)
    session.post(f"{BASE_URL}/api/pos/shift/open",
                 json={"register_id": register_id, "opening_cash": 100.0},
                 timeout=30)

    return {"merchant_id": merchant_id, "store_id": store_id, "register_id": register_id}


# ─────────────────────────── Vouchers ───────────────────────────

class TestVouchers:
    """POS Vouchers — sell, check, redeem-as-payment, topup, today's stats"""

    def test_sell_voucher_50(self, session, merchant_ctx):
        r = session.post(f"{BASE_URL}/api/pos/vouchers/sell", json={
            "store_id": merchant_ctx["store_id"],
            "register_id": merchant_ctx["register_id"],
            "amount": 50.0,
            "payment_method": "cash",
        }, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("ok") is True
        v = data["voucher"]
        assert v["amount"] == 50.0
        assert v["code"].startswith("GS-")
        assert v["qr_code"].startswith("BIDBLITZ-VOUCHER:")
        pytest.voucher_code = v["code"]

    def test_sell_voucher_invalid_amount(self, session, merchant_ctx):
        r = session.post(f"{BASE_URL}/api/pos/vouchers/sell", json={
            "store_id": merchant_ctx["store_id"],
            "register_id": merchant_ctx["register_id"],
            "amount": 5000.0, "payment_method": "cash",
        }, timeout=30)
        assert r.status_code == 400

    def test_check_voucher_valid(self, session):
        code = getattr(pytest, "voucher_code", None)
        assert code, "voucher created in previous test"
        r = session.get(f"{BASE_URL}/api/pos/vouchers/check/{code}", timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["valid"] is True
        assert data["balance"] == 50.0
        assert data["redeemed"] is False

    def test_check_voucher_unknown(self, session):
        r = session.get(f"{BASE_URL}/api/pos/vouchers/check/GS-DOESNTEXIST", timeout=30)
        assert r.status_code == 404

    def test_topup_wallet_admin_email(self, session, merchant_ctx):
        # Top-up admin's own email (always exists)
        r = session.post(f"{BASE_URL}/api/pos/vouchers/topup", json={
            "store_id": merchant_ctx["store_id"],
            "register_id": merchant_ctx["register_id"],
            "customer_email": ADMIN_EMAIL,
            "amount": 25.0,
            "payment_method": "cash",
        }, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["ok"] is True
        c = data["customer"]
        assert c["topped_up"] == 25.0
        assert c["new_balance"] >= c["old_balance"] + 25.0 - 0.01

    def test_topup_unknown_customer(self, session, merchant_ctx):
        r = session.post(f"{BASE_URL}/api/pos/vouchers/topup", json={
            "store_id": merchant_ctx["store_id"],
            "register_id": merchant_ctx["register_id"],
            "customer_email": "unknown_xyz@nope.de",
            "amount": 10.0,
        }, timeout=30)
        assert r.status_code == 404

    def test_topup_over_limit(self, session, merchant_ctx):
        r = session.post(f"{BASE_URL}/api/pos/vouchers/topup", json={
            "store_id": merchant_ctx["store_id"],
            "register_id": merchant_ctx["register_id"],
            "customer_email": ADMIN_EMAIL,
            "amount": 600.0,
        }, timeout=30)
        assert r.status_code == 400

    def test_sales_today(self, session, merchant_ctx):
        r = session.get(f"{BASE_URL}/api/pos/vouchers/sales/today",
                        params={"store_id": merchant_ctx["store_id"]}, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "vouchers" in data and "topups" in data
        assert data["vouchers"]["count"] >= 1
        assert data["topups"]["count"] >= 1

    def test_redeem_as_payment_against_cart(self, session, merchant_ctx):
        """Create a free-form cart with €30 then redeem the €50 voucher."""
        cart_payload = {
            "register_id": merchant_ctx["register_id"],
            "items": [{"name": "Test Eis", "price": 30.0, "quantity": 1, "tax_rate": 19.0}],
        }
        r = session.post(f"{BASE_URL}/api/pos/cart/create", json=cart_payload, timeout=30)
        if r.status_code != 200:
            pytest.skip(f"Cart create not possible: {r.status_code} {r.text}")
        cart = r.json()["cart"]
        cart_id = cart["cart_id"]
        cart_total = cart["total"]

        code = getattr(pytest, "voucher_code", None)
        assert code
        r = session.post(f"{BASE_URL}/api/pos/vouchers/redeem-as-payment", json={
            "voucher_code": code, "cart_id": cart_id,
        }, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["ok"] is True
        assert data["applied"] == round(min(cart_total, 50.0), 2)


# ─────────────────────────── Features ───────────────────────────

class TestFeatures:
    def test_catalog(self, session):
        r = session.get(f"{BASE_URL}/api/pos/features/catalog", timeout=30)
        assert r.status_code == 200, r.text
        feats = r.json()["features"]
        assert len(feats) >= 18
        keys = {f["key"] for f in feats}
        for k in ("table_reservations", "table_qr_orders", "loyalty", "vouchers"):
            assert k in keys

    def test_me_default_enabled(self, session):
        r = session.get(f"{BASE_URL}/api/pos/features/me", timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "merchant_id" in data
        by_key = {f["key"]: f for f in data["features"]}
        assert by_key["loyalty"]["enabled"] is True
        assert by_key["vouchers"]["enabled"] is True
        # Note: table_reservations may have been toggled on in earlier runs; we only
        # verify default-enabled features here. Toggle gating is covered by 402 test.

    def test_admin_toggle_table_reservations_on(self, session, merchant_ctx):
        r = session.post(f"{BASE_URL}/api/pos/features/admin/toggle", json={
            "merchant_id": merchant_ctx["merchant_id"],
            "feature_key": "table_reservations",
            "enabled": True,
        }, timeout=30)
        assert r.status_code == 200, r.text
        assert r.json()["feature"]["enabled"] is True

    def test_admin_bulk_toggle(self, session, merchant_ctx):
        r = session.post(f"{BASE_URL}/api/pos/features/admin/bulk-toggle", json={
            "merchant_id": merchant_ctx["merchant_id"],
            "features": ["table_qr_orders", "kds"],
            "enabled": True,
        }, timeout=30)
        assert r.status_code == 200, r.text
        assert r.json()["updated"] == 2

    def test_admin_list_for_merchant(self, session, merchant_ctx):
        r = session.get(f"{BASE_URL}/api/pos/features/admin/merchant/{merchant_ctx['merchant_id']}",
                        timeout=30)
        assert r.status_code == 200, r.text
        feats = {f["key"]: f for f in r.json()["features"]}
        assert feats["table_reservations"]["enabled"] is True
        assert feats["table_qr_orders"]["enabled"] is True

    def test_check_feature(self, session):
        r = session.get(f"{BASE_URL}/api/pos/features/check/table_reservations", timeout=30)
        assert r.status_code == 200, r.text
        assert r.json()["enabled"] is True

    def test_trial_start_new_feature(self, session, merchant_ctx):
        # First disable & wipe trial flag for ai_assistant to test trial
        session.post(f"{BASE_URL}/api/pos/features/admin/toggle", json={
            "merchant_id": merchant_ctx["merchant_id"],
            "feature_key": "ai_assistant", "enabled": False,
        }, timeout=30)
        r = session.post(f"{BASE_URL}/api/pos/features/trial",
                         json={"feature_key": "ai_assistant", "days": 14}, timeout=30)
        # Trial may already be used in earlier sessions → allow 200 or 400
        assert r.status_code in (200, 400), r.text


# ─────────────────────────── API-Keys + Public API v1 ───────────────────────────

class TestPublicAPI:
    """Public API v1 — X-API-Key auth, scope, feature gating."""

    def test_create_api_key(self, session):
        r = session.post(f"{BASE_URL}/api/pos/api-keys/create",
                         params={"name": "TEST_KEY", "scopes": "read,write"},
                         timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["ok"] is True
        assert data["key_secret"].startswith("bbsec_")
        pytest.api_key = data["key_secret"]

    def test_public_me(self):
        key = getattr(pytest, "api_key", None)
        assert key
        r = requests.get(f"{BASE_URL}/api/pos/public/v1/me",
                         headers={"X-API-Key": key}, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "merchant" in data
        assert "scopes" in data
        assert "active_features" in data

    def test_public_me_invalid_key(self):
        r = requests.get(f"{BASE_URL}/api/pos/public/v1/me",
                         headers={"X-API-Key": "bbsec_invalidkey"}, timeout=30)
        assert r.status_code == 401

    def test_public_products_read(self, merchant_ctx):
        key = getattr(pytest, "api_key", None)
        assert key
        r = requests.get(f"{BASE_URL}/api/pos/public/v1/products",
                         params={"store_id": merchant_ctx["store_id"]},
                         headers={"X-API-Key": key}, timeout=30)
        assert r.status_code == 200, r.text
        assert "products" in r.json()

    def test_public_reservations_create_when_enabled(self, merchant_ctx):
        """Feature table_reservations was enabled in TestFeatures; expect 200."""
        key = getattr(pytest, "api_key", None)
        assert key
        r = requests.post(f"{BASE_URL}/api/pos/public/v1/reservations",
                          headers={"X-API-Key": key},
                          json={"store_id": merchant_ctx["store_id"],
                                "guest_name": "TEST_Guest", "party_size": 2,
                                "when": "2026-02-01T19:00:00+00:00"},
                          timeout=30)
        assert r.status_code == 200, r.text
        assert r.json()["ok"] is True

    def test_public_table_orders_create_when_enabled(self, merchant_ctx):
        """Feature table_qr_orders was enabled. We don't have products,
        so we expect either 200 (if products) or 400 'Produkt nicht gefunden'."""
        key = getattr(pytest, "api_key", None)
        # Use a fake product_id to assert feature gating passed (HTTP 400 != 402)
        r = requests.post(f"{BASE_URL}/api/pos/public/v1/table-orders",
                          headers={"X-API-Key": key},
                          json={"store_id": merchant_ctx["store_id"],
                                "table_id": "T1",
                                "items": [{"product_id": "FAKE_PROD", "quantity": 1}]},
                          timeout=30)
        # If gating works, status 400 (not 402)
        assert r.status_code in (200, 400), r.text
        assert r.status_code != 402

    def test_public_reservations_402_when_disabled(self, session, merchant_ctx):
        """Disable feature, expect 402 Payment Required."""
        # Create new key (existing one)
        key = getattr(pytest, "api_key", None)
        # Disable feature
        session.post(f"{BASE_URL}/api/pos/features/admin/toggle", json={
            "merchant_id": merchant_ctx["merchant_id"],
            "feature_key": "table_reservations", "enabled": False,
        }, timeout=30)
        r = requests.post(f"{BASE_URL}/api/pos/public/v1/reservations",
                          headers={"X-API-Key": key},
                          json={"store_id": merchant_ctx["store_id"],
                                "guest_name": "TEST_Guest", "party_size": 2,
                                "when": "2026-02-01T19:00:00+00:00"},
                          timeout=30)
        assert r.status_code == 402, r.text
        # Re-enable for following tests
        session.post(f"{BASE_URL}/api/pos/features/admin/toggle", json={
            "merchant_id": merchant_ctx["merchant_id"],
            "feature_key": "table_reservations", "enabled": True,
        }, timeout=30)


# ─────────────────────────── Kassenmeldung ───────────────────────────

class TestKassenmeldung:
    def test_save_meldung(self, session, merchant_ctx):
        r = session.post(f"{BASE_URL}/api/pos/kassenmeldung/save", json={
            "store_id": merchant_ctx["store_id"],
            "business_name": "TEST_Eiscafe",
            "tax_id": "DE123456789",
            "address": "Teststr. 1, 10115 Berlin",
            "contact_email": ADMIN_EMAIL,
            "register_serial": "REG-TEST-001",
            "tse_serial": "TSE-TEST-001",
        }, timeout=30)
        assert r.status_code == 200, r.text
        m = r.json()["meldung"]
        assert m["business_name"] == "TEST_Eiscafe"

    def test_get_meldung(self, session, merchant_ctx):
        r = session.get(f"{BASE_URL}/api/pos/kassenmeldung/get",
                        params={"store_id": merchant_ctx["store_id"]}, timeout=30)
        assert r.status_code == 200, r.text
        assert r.json()["meldung"]["tax_id"] == "DE123456789"


# ─────────────────────────── Z-Bon / DSFinV-K ───────────────────────────

class TestZBonCompliance:
    def test_zbon_preview(self, session, merchant_ctx):
        r = session.get(f"{BASE_URL}/api/pos/zbon/preview",
                        params={"store_id": merchant_ctx["store_id"]}, timeout=30)
        assert r.status_code == 200, r.text

    def test_zbon_list(self, session, merchant_ctx):
        r = session.get(f"{BASE_URL}/api/pos/zbon/list",
                        params={"store_id": merchant_ctx["store_id"]}, timeout=30)
        assert r.status_code == 200, r.text

    def test_dsfinv_k_export(self, session, merchant_ctx):
        r = session.get(f"{BASE_URL}/api/pos/zbon/dsfinv-k/export",
                        params={"store_id": merchant_ctx["store_id"], "year": 2026},
                        timeout=30)
        assert r.status_code == 200, r.text


# ─────────────────────────── Regression — cart + payment cash ───────────────────────────

class TestRegressionCartPayment:
    def test_cart_create_and_cash_payment(self, session, merchant_ctx):
        r = session.post(f"{BASE_URL}/api/pos/cart/create", json={
            "register_id": merchant_ctx["register_id"],
            "items": [{"name": "TEST Eiskugel", "price": 1.5, "quantity": 2, "tax_rate": 7.0}],
        }, timeout=30)
        assert r.status_code == 200, r.text
        cart = r.json()["cart"]
        cart_id = cart["cart_id"]
        total = cart["total"]

        r = session.post(f"{BASE_URL}/api/pos/payment/create", json={
            "cart_id": cart_id, "method": "cash", "cash_received": total + 5.0,
        }, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["ok"] is True
        assert data["payment"]["status"] in ("paid", "PAID")
