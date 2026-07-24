"""
Iter43 — Virtual Cards dispatcher tests.

Covers:
- GET /api/virtual-cards (mock fallback path when STRIPE_ISSUING_ENABLED=false)
- POST /api/virtual-cards creates a local mock card
- GET→POST→GET count increments by 1
- Admin login + /api/auth/me
- Validation: limit=0 and limit=10000 → 400
- Direct /api/issuing/* endpoints still return 503 when gate is off
- Webhook /api/webhooks/stripe-issuing without signature → 400/500
- Regression: /api/admin/stats, /api/auctions/active, /api/wallet, /api/wallet/balance/total
"""
import os
import re
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ADMIN_EMAIL = "admin@bidblitz.com"
ADMIN_PASSWORD = "BidBlitz2026!"


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=20,
    )
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text[:200]}"
    assert any(c.name == "access_token" for c in s.cookies), (
        f"access_token cookie not set, got: {s.cookies}"
    )
    return s


# ─── Admin auth ─────────────────────────────────────────────────────────

class TestAdminAuth:
    def test_login(self, admin_session):
        # fixture itself asserts success; re-check /me
        r = admin_session.get(f"{BASE_URL}/api/auth/me", timeout=15)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:200]}"
        data = r.json()
        # role may be nested under user
        user = data.get("user", data)
        assert user.get("email") == ADMIN_EMAIL


# ─── Virtual Cards (mock fallback) ──────────────────────────────────────

class TestVirtualCardsMock:
    def test_get_returns_mock_shape(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/virtual-cards", timeout=15)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:300]}"
        data = r.json()
        assert "cards" in data and isinstance(data["cards"], list)
        assert data.get("is_stripe") is False, f"expected is_stripe:false, got {data.get('is_stripe')}"
        for c in data["cards"]:
            assert c.get("is_stripe") is False
            assert "last4" in c
            assert len(str(c.get("last4", ""))) in (0, 4)

    def test_post_creates_mock_card_and_count_increments(self, admin_session):
        before = admin_session.get(f"{BASE_URL}/api/virtual-cards", timeout=15).json()
        before_count = len(before.get("cards", []))

        r = admin_session.post(
            f"{BASE_URL}/api/virtual-cards",
            json={"label": "TestMock", "limit": 25},
            timeout=15,
        )
        assert r.status_code == 200, f"{r.status_code}: {r.text[:300]}"
        data = r.json()
        assert data.get("ok") is True
        assert data.get("is_stripe") is False
        card = data.get("card", {})
        assert card.get("card_id", "").startswith("VC-"), f"unexpected card_id: {card.get('card_id')}"
        assert card.get("label") == "TestMock"
        number = card.get("number", "")
        assert re.fullmatch(r"\d{16}", number), f"expected 16-digit PAN, got {number!r}"
        assert card.get("last4") == number[-4:]
        assert card.get("exp_month") == 12
        assert card.get("exp_year") == 2027
        assert card.get("status") == "active"
        assert card.get("is_stripe") is False

        after = admin_session.get(f"{BASE_URL}/api/virtual-cards", timeout=15).json()
        after_count = len(after.get("cards", []))
        assert after_count == before_count + 1, (
            f"count did not increment: before={before_count}, after={after_count}"
        )

    def test_validation_limit_too_low(self, admin_session):
        r = admin_session.post(
            f"{BASE_URL}/api/virtual-cards",
            json={"label": "BadLow", "limit": 0},
            timeout=15,
        )
        assert r.status_code == 400, f"{r.status_code}: {r.text[:200]}"
        detail = r.json().get("detail", "")
        assert "zwischen" in detail.lower() or "€1" in detail

    def test_validation_limit_too_high(self, admin_session):
        r = admin_session.post(
            f"{BASE_URL}/api/virtual-cards",
            json={"label": "BadHigh", "limit": 10000},
            timeout=15,
        )
        assert r.status_code == 400, f"{r.status_code}: {r.text[:200]}"


# ─── /api/issuing/* still gated ─────────────────────────────────────────

class TestIssuingStillGated:
    def test_get_issuing_cards_gated(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/issuing/cards", timeout=15)
        assert r.status_code == 503, f"{r.status_code}: {r.text[:200]}"
        assert "Stripe Issuing nicht aktiviert" in r.json().get("detail", "")

    def test_post_cardholders_gated(self, admin_session):
        body = {
            "name": "Test User",
            "email": "test@example.com",
            "billing": {"line1": "Teststr 1", "city": "Berlin", "postal_code": "10115", "country": "DE"},
        }
        r = admin_session.post(f"{BASE_URL}/api/issuing/cardholders", json=body, timeout=15)
        assert r.status_code == 503, f"{r.status_code}: {r.text[:200]}"

    def test_post_card_status_gated(self, admin_session):
        r = admin_session.post(
            f"{BASE_URL}/api/issuing/cards/x/status",
            json={"status": "inactive"},
            timeout=15,
        )
        assert r.status_code == 503, f"{r.status_code}: {r.text[:200]}"


# ─── Webhook signature gating ───────────────────────────────────────────

class TestWebhookSigGuard:
    def test_webhook_without_sig(self):
        r = requests.post(
            f"{BASE_URL}/api/webhooks/stripe-issuing",
            data=b"{}",
            headers={"Content-Type": "application/json"},
            timeout=15,
        )
        assert r.status_code in (400, 500), f"{r.status_code}: {r.text[:200]}"


# ─── Backwards-compat regression ────────────────────────────────────────

class TestRegression:
    def test_admin_stats(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/stats", timeout=15)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:200]}"
        assert isinstance(r.json(), dict)

    def test_auctions_active(self):
        r = requests.get(f"{BASE_URL}/api/auctions/active", timeout=15)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:200]}"

    def test_wallet(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/wallet", timeout=15)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:200]}"

    def test_wallet_balance_total(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/wallet/balance/total", timeout=15)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:200]}"
