"""
BidBlitz Iter88 Tests
- Staff Demo Seed (30-day data)
- Staff Wallet Real-Payout (Bank save, SEPA manual, Stripe Connect fallback)
- Staff Push Preferences
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://super-app-staging-2.preview.emergentagent.com").rstrip("/")

MERCHANT_EMAIL = "haendler@bidblitz.com"
MERCHANT_PASSWORD = "Haendler2026!"
STAFF_EMAIL = "TEST_magic_1778611082@example.com"
STAFF_PASSWORD = "test123"


@pytest.fixture(scope="module")
def merchant_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    # Try common login endpoints
    for path in ["/api/auth/login", "/api/login"]:
        r = s.post(f"{BASE_URL}{path}", json={"email": MERCHANT_EMAIL, "password": MERCHANT_PASSWORD})
        if r.status_code == 200:
            data = r.json()
            tok = data.get("access_token") or data.get("token")
            if tok:
                s.headers.update({"Authorization": f"Bearer {tok}"})
            return s
    pytest.skip(f"Merchant login failed at {path}: {r.status_code} {r.text[:200]}")


@pytest.fixture(scope="module")
def staff_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/staff/auth/login", json={"email": STAFF_EMAIL, "password": STAFF_PASSWORD})
    if r.status_code != 200:
        pytest.skip(f"Staff login failed: {r.status_code} {r.text[:200]}")
    return s


# ─────────────────────────────────────────────────────────────────────
# PACKAGE 1: DEMO SEED
# ─────────────────────────────────────────────────────────────────────
class TestDemoSeed:
    def test_seed_demo(self, merchant_session):
        r = merchant_session.post(f"{BASE_URL}/api/staff/demo/seed")
        assert r.status_code == 200, f"Got {r.status_code}: {r.text[:200]}"
        d = r.json()
        assert d.get("success") is True
        assert d.get("members", 0) >= 10, f"members={d.get('members')}"
        assert d.get("events", 0) >= 400, f"events={d.get('events')}"
        assert d.get("tasks", 0) == 50, f"tasks={d.get('tasks')}"
        assert d.get("bonus_events", 0) == 50, f"bonus_events={d.get('bonus_events')}"
        assert d.get("notifications", 0) == 10
        assert d.get("warnings", 0) >= 3
        assert "locations" in d

    def test_seed_idempotent(self, merchant_session):
        # Run twice; should not crash and should reset cleanly
        r = merchant_session.post(f"{BASE_URL}/api/staff/demo/seed")
        assert r.status_code == 200
        d = r.json()
        assert d.get("members", 0) >= 10

    def test_demo_dashboard_public(self):
        r = requests.get(f"{BASE_URL}/api/staff/demo/dashboard")
        assert r.status_code == 200
        d = r.json()
        assert d.get("success") is True
        assert d.get("is_demo") is True
        assert "kpis" in d
        kpis = d["kpis"]
        assert kpis.get("active_staff", 0) >= 10
        assert "members_preview" in d and isinstance(d["members_preview"], list)
        assert "next_shifts" in d
        assert "warnings" in d
        # Ensure no sensitive fields leak
        for m in d["members_preview"]:
            assert "pin_hash" not in m
            assert "password_hash" not in m


# ─────────────────────────────────────────────────────────────────────
# PACKAGE 3: WALLET REAL-PAYOUT
# ─────────────────────────────────────────────────────────────────────
@pytest.fixture(scope="module")
def merchant_staff_id(merchant_session):
    """Return the staff_id of TEST_magic_1778611082 to test bank save/payout flow."""
    # Find the test staff member under merchant
    r = merchant_session.get(f"{BASE_URL}/api/staff/members")
    if r.status_code != 200:
        pytest.skip(f"Cannot list members: {r.status_code}")
    rows = r.json()
    if isinstance(rows, dict):
        rows = rows.get("members") or rows.get("rows") or []
    for m in rows:
        if m.get("email") == STAFF_EMAIL:
            return m["id"]
    pytest.skip("Test staff member not found under merchant")


class TestWalletPayout:
    def test_bank_save_invalid_iban(self, merchant_session, merchant_staff_id):
        r = merchant_session.post(
            f"{BASE_URL}/api/staff/wallet/bank/save?staff_id={merchant_staff_id}",
            json={"iban": "DE89", "account_holder": "Test"},
        )
        assert r.status_code == 400, f"Got {r.status_code}: {r.text[:200]}"

    def test_bank_save_success(self, merchant_session, merchant_staff_id):
        r = merchant_session.post(
            f"{BASE_URL}/api/staff/wallet/bank/save?staff_id={merchant_staff_id}",
            json={"iban": "DE89370400440532013000", "account_holder": "Test Mitarbeiter", "bic": "COBADEFFXXX"},
        )
        assert r.status_code == 200, f"Got {r.status_code}: {r.text[:200]}"
        d = r.json()
        assert d.get("success") is True
        masked = d.get("iban_masked", "")
        assert "••••" in masked
        assert "DE89" in masked
        assert "3000" in masked
        # CRITICAL: full IBAN must NOT leak
        assert "DE89370400440532013000" not in str(d)

    def test_bank_me_no_iban_full_leak(self, staff_session):
        r = staff_session.get(f"{BASE_URL}/api/staff/wallet/bank/me")
        assert r.status_code == 200
        d = r.json()
        # Either bank=None (if test staff != merchant_staff_id) or masked only
        bank = d.get("bank")
        if bank:
            assert "iban_full" not in bank, f"iban_full leaked: {bank}"
            assert "iban_masked" in bank

    def test_payout_requires_bonus(self, merchant_session, merchant_staff_id):
        """If staff has no credited bonuses, payout should 400."""
        # Find a merchant staff without bonuses — we expect typical case has none
        r = merchant_session.post(
            f"{BASE_URL}/api/staff/wallet/payout",
            json={"staff_id": merchant_staff_id, "method": "sepa_manual"},
        )
        # Either 400 (no credit) or 200 (had credit) — both are acceptable behavior; just must not 500
        assert r.status_code in (200, 400), f"Got {r.status_code}: {r.text[:200]}"
        if r.status_code == 200:
            d = r.json()
            assert d["payout"]["status"] == "pending"
            assert d["payout"]["reference"].startswith("BB-")
            assert "••••" in d["payout"]["iban_masked"]
            # confirm flow
            pid = d["payout"]["id"]
            r2 = merchant_session.post(f"{BASE_URL}/api/staff/wallet/payouts/{pid}/confirm")
            assert r2.status_code == 200

    def test_payouts_list(self, merchant_session):
        r = merchant_session.get(f"{BASE_URL}/api/staff/wallet/payouts")
        assert r.status_code == 200
        d = r.json()
        assert "payouts" in d

    def test_payouts_me(self, staff_session):
        r = staff_session.get(f"{BASE_URL}/api/staff/wallet/payouts/me")
        assert r.status_code == 200
        d = r.json()
        assert "payouts" in d

    def test_stripe_connect_no_account_graceful(self, merchant_session, merchant_staff_id):
        """Grant a bonus then test stripe_connect without account → should not crash."""
        # Grant a small bonus first so payout has something
        gr = merchant_session.post(
            f"{BASE_URL}/api/staff/wallet/bonus",
            json={"staff_id": merchant_staff_id, "type": "manual", "amount_eur": 5.00, "note": "TEST"},
        )
        if gr.status_code != 200:
            pytest.skip(f"Could not grant bonus: {gr.status_code}")
        r = merchant_session.post(
            f"{BASE_URL}/api/staff/wallet/payout",
            json={"staff_id": merchant_staff_id, "method": "stripe_connect"},
        )
        # Should be 200 with status=needs_stripe_onboarding (graceful)
        assert r.status_code in (200, 400)
        if r.status_code == 200:
            status = r.json()["payout"]["status"]
            assert status in ("needs_stripe_onboarding", "failed", "processing", "pending"), f"unexpected status={status}"


# ─────────────────────────────────────────────────────────────────────
# PACKAGE 4: PUSH PREFERENCES
# ─────────────────────────────────────────────────────────────────────
class TestPushPrefs:
    def test_get_preferences_default(self, staff_session):
        r = staff_session.get(f"{BASE_URL}/api/staff/push/preferences")
        assert r.status_code == 200, f"Got {r.status_code}: {r.text[:200]}"
        d = r.json()
        assert d.get("success") is True
        p = d.get("preferences", {})
        # Defaults: all True if no doc
        # After possible prior partial update they may differ — we just check keys
        for k in ("shift_reminders", "task_assigned", "bonus_received", "warnings"):
            assert k in p, f"Missing pref key {k}"

    def test_partial_update(self, staff_session):
        r = staff_session.post(
            f"{BASE_URL}/api/staff/push/preferences",
            json={"shift_reminders": False},
        )
        assert r.status_code == 200, f"Got {r.status_code}: {r.text[:200]}"
        # Verify persisted
        r2 = staff_session.get(f"{BASE_URL}/api/staff/push/preferences")
        assert r2.status_code == 200
        p = r2.json()["preferences"]
        assert p.get("shift_reminders") is False

    def test_partial_restore(self, staff_session):
        # restore so test isolation
        r = staff_session.post(
            f"{BASE_URL}/api/staff/push/preferences",
            json={"shift_reminders": True},
        )
        assert r.status_code == 200

    def test_devices_me(self, staff_session):
        r = staff_session.get(f"{BASE_URL}/api/staff/push/devices/me")
        assert r.status_code == 200
        d = r.json()
        assert "devices" in d
        assert isinstance(d["devices"], list)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
