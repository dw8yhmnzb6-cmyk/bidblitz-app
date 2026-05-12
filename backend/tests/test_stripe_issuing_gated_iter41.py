"""
Iter41 tests:
- Stripe Issuing endpoints must be gated with STRIPE_ISSUING_ENABLED=false -> 503
- Webhook without valid signature -> 400 (or 500 if secret missing)
- Backwards-compat: admin login, admin stats, pay admin applications (auth), pay merchant apply
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://qr-checkout-20.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@bidblitz.com"
ADMIN_PASSWORD = "BidBlitz2026!"


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=20)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text[:200]}"
    # Access cookie should be set
    assert any(c.name == "access_token" for c in s.cookies), f"access_token cookie not set, got: {s.cookies}"
    return s


# ─── Stripe Issuing Gating (STRIPE_ISSUING_ENABLED=false) ──────────────

class TestStripeIssuingGated:
    def test_get_cards_gated_authed(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/issuing/cards", timeout=15)
        assert r.status_code == 503, f"expected 503, got {r.status_code}: {r.text[:300]}"
        detail = r.json().get("detail", "")
        assert "Stripe Issuing nicht aktiviert" in detail, f"unexpected detail: {detail}"

    def test_get_cards_gated_unauth(self):
        r = requests.get(f"{BASE_URL}/api/issuing/cards", timeout=15)
        assert r.status_code == 503, f"expected 503 (gate before auth), got {r.status_code}: {r.text[:300]}"
        assert "Stripe Issuing nicht aktiviert" in r.json().get("detail", "")

    def test_get_cardholders_me_gated_authed(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/issuing/cardholders/me", timeout=15)
        assert r.status_code == 503, f"expected 503, got {r.status_code}: {r.text[:300]}"
        assert "Stripe Issuing nicht aktiviert" in r.json().get("detail", "")

    def test_get_cardholders_me_gated_unauth(self):
        r = requests.get(f"{BASE_URL}/api/issuing/cardholders/me", timeout=15)
        assert r.status_code == 503, f"expected 503 (gate before auth), got {r.status_code}: {r.text[:300]}"
        assert "Stripe Issuing nicht aktiviert" in r.json().get("detail", "")

    def test_post_cardholders_gated(self, admin_session):
        body = {
            "name": "Test User",
            "email": "test@example.com",
            "billing": {"line1": "Teststr 1", "city": "Berlin", "postal_code": "10115", "country": "DE"},
        }
        r = admin_session.post(f"{BASE_URL}/api/issuing/cardholders", json=body, timeout=15)
        assert r.status_code == 503, f"expected 503, got {r.status_code}: {r.text[:300]}"
        assert "Stripe Issuing nicht aktiviert" in r.json().get("detail", "")

    def test_post_cards_gated(self, admin_session):
        r = admin_session.post(f"{BASE_URL}/api/issuing/cards", json={"currency": "eur", "card_type": "virtual"}, timeout=15)
        assert r.status_code == 503
        assert "Stripe Issuing nicht aktiviert" in r.json().get("detail", "")

    def test_post_card_ephemeral_key_gated(self, admin_session):
        r = admin_session.post(
            f"{BASE_URL}/api/issuing/cards/test_id/ephemeral-key",
            json={"nonce": "abc123"},
            timeout=15,
        )
        assert r.status_code == 503
        assert "Stripe Issuing nicht aktiviert" in r.json().get("detail", "")

    def test_post_card_status_gated(self, admin_session):
        r = admin_session.post(
            f"{BASE_URL}/api/issuing/cards/test_id/status",
            json={"status": "inactive"},
            timeout=15,
        )
        assert r.status_code == 503
        assert "Stripe Issuing nicht aktiviert" in r.json().get("detail", "")

    def test_webhook_without_signature(self):
        # Without signature header - either 400 (verification failed) or 500 (secret not configured)
        r = requests.post(
            f"{BASE_URL}/api/webhooks/stripe-issuing",
            data=b"{}",
            headers={"Content-Type": "application/json"},
            timeout=15,
        )
        assert r.status_code in (400, 500), f"expected 400/500, got {r.status_code}: {r.text[:200]}"


# ─── Backwards Compat ─────────────────────────────────────────────────

class TestBackwardsCompat:
    def test_auctions_active(self):
        r = requests.get(f"{BASE_URL}/api/auctions/active", timeout=15)
        assert r.status_code == 200, f"got {r.status_code}: {r.text[:200]}"

    def test_admin_stats_with_cookie(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/stats", timeout=15)
        assert r.status_code == 200, f"got {r.status_code}: {r.text[:200]}"
        data = r.json()
        assert isinstance(data, dict)

    def test_pay_admin_applications_unauth(self):
        r = requests.get(f"{BASE_URL}/api/pay/admin/applications", timeout=15)
        assert r.status_code == 401, f"expected 401 without auth, got {r.status_code}"

    def test_pay_admin_applications_authed(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/pay/admin/applications", timeout=15)
        assert r.status_code == 200, f"expected 200 with admin auth, got {r.status_code}: {r.text[:200]}"

    def test_pay_merchant_apply(self):
        import uuid
        unique_email = f"e2e-test-{uuid.uuid4().hex[:8]}@example.com"
        r = requests.post(
            f"{BASE_URL}/api/pay/merchant/apply",
            json={"business_name": "Test E2E", "email": unique_email},
            timeout=20,
        )
        assert r.status_code == 200, f"got {r.status_code}: {r.text[:200]}"
        data = r.json()
        assert data.get("ok") is True, f"expected ok:true, got {data}"
