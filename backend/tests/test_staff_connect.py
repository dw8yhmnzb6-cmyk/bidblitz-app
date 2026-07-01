"""Backend tests for Stripe Connect staff onboarding endpoints (Sprint B)."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://biometric-checkout-7.preview.emergentagent.com").rstrip("/")
MERCHANT_EMAIL = "haendler@bidblitz.com"
MERCHANT_PASSWORD = "Haendler2026!"


@pytest.fixture(scope="module")
def merchant_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    # Try common login endpoints
    paths = [
        "/api/auth/login",
        "/api/login",
        "/api/users/login",
    ]
    for p in paths:
        try:
            r = s.post(f"{BASE_URL}{p}", json={"email": MERCHANT_EMAIL, "password": MERCHANT_PASSWORD}, timeout=15)
            if r.status_code == 200:
                data = r.json()
                token = data.get("token") or data.get("access_token") or (data.get("user") or {}).get("token")
                if token:
                    s.headers.update({"Authorization": f"Bearer {token}"})
                return s
        except Exception:
            continue
    pytest.skip("Could not login merchant via any known endpoint")


@pytest.fixture(scope="module")
def staff_id(merchant_session):
    # find any staff member for this merchant
    for p in ["/api/staff/members", "/api/staff/members/list", "/api/staff/list"]:
        r = merchant_session.get(f"{BASE_URL}{p}", timeout=15)
        if r.status_code == 200:
            data = r.json()
            arr = data.get("members") or data.get("rows") or data.get("items") or data
            if isinstance(arr, list) and arr:
                return arr[0].get("id")
    pytest.skip("No staff member found")


class TestStaffConnect:

    def test_onboard_requires_auth(self):
        r = requests.post(f"{BASE_URL}/api/staff/wallet/connect/onboard",
                          json={"staff_id": "xxx", "return_url": "https://x"},
                          timeout=15)
        # Expect 401 or 403 (no auth)
        assert r.status_code in (401, 403), f"Expected 401/403, got {r.status_code}: {r.text[:200]}"

    def test_onboard_invalid_staff_returns_404(self, merchant_session):
        r = merchant_session.post(
            f"{BASE_URL}/api/staff/wallet/connect/onboard",
            json={"staff_id": "non-existent-uuid-xxx", "return_url": "https://example.com/return"},
            timeout=20,
        )
        assert r.status_code == 404, f"Expected 404, got {r.status_code}: {r.text[:200]}"

    def test_onboard_real_staff_returns_account_link(self, merchant_session, staff_id):
        r = merchant_session.post(
            f"{BASE_URL}/api/staff/wallet/connect/onboard",
            json={"staff_id": staff_id, "return_url": "https://example.com/return"},
            timeout=30,
        )
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text[:300]}"
        d = r.json()
        assert d.get("success") is True
        assert d.get("stripe_account_id", "").startswith("acct_"), f"Bad acct id: {d}"
        assert "connect.stripe.com" in d.get("onboarding_url", "")
        assert isinstance(d.get("expires_at"), int)

    def test_status_cached(self, merchant_session, staff_id):
        r = merchant_session.get(
            f"{BASE_URL}/api/staff/wallet/connect/status/{staff_id}?live=false",
            timeout=15,
        )
        assert r.status_code == 200, r.text[:200]
        d = r.json()
        assert d.get("connected") is True
        assert "payouts_enabled" in d
        assert "details_submitted" in d

    def test_status_live(self, merchant_session, staff_id):
        r = merchant_session.get(
            f"{BASE_URL}/api/staff/wallet/connect/status/{staff_id}?live=true",
            timeout=30,
        )
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        assert d.get("connected") is True
        assert isinstance(d.get("requirements_currently_due"), list)

    def test_payout_with_stripe_connect_needs_onboarding_when_not_enabled(self, merchant_session, staff_id):
        # Grant a small bonus first so there is something to payout
        merchant_session.post(
            f"{BASE_URL}/api/staff/wallet/bonus",
            json={"staff_id": staff_id, "type": "manual", "amount_eur": 1.50, "note": "TEST_connect_payout"},
            timeout=15,
        )
        # Ensure bank record exists (save dummy IBAN)
        merchant_session.post(
            f"{BASE_URL}/api/staff/wallet/bank/save?staff_id={staff_id}",
            json={"iban": "DE89370400440532013000", "account_holder": "Test User"},
            timeout=15,
        )
        r = merchant_session.post(
            f"{BASE_URL}/api/staff/wallet/payout",
            json={"staff_id": staff_id, "method": "stripe_connect"},
            timeout=30,
        )
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        p = d.get("payout") or {}
        # Since the account is not fully onboarded (payouts_enabled=False), status should be needs_stripe_onboarding
        # OR if happen to be enabled, status should be processing.
        assert p.get("status") in ("needs_stripe_onboarding", "processing", "failed"), p
        if p.get("status") == "needs_stripe_onboarding":
            assert "onboarding" in (p.get("error") or "").lower() or "stripe" in (p.get("error") or "").lower()

    def test_disconnect(self, merchant_session, staff_id):
        r = merchant_session.delete(
            f"{BASE_URL}/api/staff/wallet/connect/{staff_id}",
            timeout=30,
        )
        # 200 if account existed, 404 if no connect account (after possibly already removed)
        assert r.status_code in (200, 404), r.text[:200]
