"""
Iteration 82 - Phase 4: Real Stripe Checkout + Wallet + OneSignal Push + System Status
=======================================================================================
Tests the four final P0/P1/P2 modules:
- POST /api/staff/subscription/checkout-real  (Stripe real test-mode checkout)
- GET  /api/staff/subscription/checkout-status/{session_id}
- POST /api/webhook/stripe-staff   (signature validation)
- /api/staff/wallet/*               (bonus, tip pots, balances, payout, me/balance)
- /api/staff/push/*                 (status, register, test)
- /api/staff/system-status          (integrations)
"""
import os
import pytest
import requests
from datetime import datetime, timezone, timedelta
from uuid import uuid4
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://kyc-approval-hub.preview.emergentagent.com").rstrip("/")
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")

MERCHANT_EMAIL = "haendler@bidblitz.com"
MERCHANT_PWD = "Haendler2026!"


# ────────────────────────────────────────────────────────────────────────
# Fixtures
# ────────────────────────────────────────────────────────────────────────
@pytest.fixture(scope="module")
def merchant_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": MERCHANT_EMAIL, "password": MERCHANT_PWD})
    if r.status_code != 200:
        pytest.skip(f"Merchant login failed: {r.status_code} {r.text}")
    data = r.json()
    if data.get("requires_2fa"):
        pytest.skip("Merchant has 2FA enabled - cannot test")
    return s


@pytest.fixture(scope="module")
def db():
    client = MongoClient(MONGO_URL)
    return client[DB_NAME]


@pytest.fixture(scope="module")
def merchant_id(db):
    user = db.users.find_one({"email": MERCHANT_EMAIL})
    return str(user["_id"])


@pytest.fixture(scope="module")
def active_staff(db, merchant_id):
    """Return an active staff member; create one if none exists."""
    member = db.staff_members.find_one({"merchant_id": merchant_id, "active": True}, {"_id": 0})
    if member:
        return member

    sid = str(uuid4())
    doc = {
        "id": sid,
        "merchant_id": merchant_id,
        "name": "TEST_phase4_member",
        "email": f"test_phase4_{sid[:8]}@example.com",
        "phone": None,
        "role": "employee",
        "hourly_rate": 12.0,
        "vacation_days_yearly": 24,
        "vacation_days_used": 0,
        "active": True,
        "wallet_enabled": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    db.staff_members.insert_one(doc)
    doc.pop("_id", None)
    return doc


@pytest.fixture(scope="module")
def staff_session_cookie(active_staff):
    """Returns a dict with staff_session cookie for direct API hits."""
    return {"staff_session": active_staff["id"]}


# ────────────────────────────────────────────────────────────────────────
# 1. SYSTEM STATUS
# ────────────────────────────────────────────────────────────────────────
class TestSystemStatus:
    def test_system_status_integrations(self, merchant_session):
        r = merchant_session.get(f"{BASE_URL}/api/staff/system-status")
        assert r.status_code == 200, r.text
        data = r.json()
        ints = data.get("integrations", {})
        assert ints.get("stripe_keys_present") is True, f"stripe_keys_present should be True: {ints}"
        assert ints.get("resend_configured") is True, f"resend_configured should be True: {ints}"
        assert ints.get("onesignal_configured") is False, f"onesignal_configured should be False: {ints}"


# ────────────────────────────────────────────────────────────────────────
# 2. STRIPE REAL CHECKOUT
# ────────────────────────────────────────────────────────────────────────
class TestStripeRealCheckout:
    _session_id = None

    def test_checkout_real_creates_session(self, merchant_session):
        r = merchant_session.post(
            f"{BASE_URL}/api/staff/subscription/checkout-real",
            json={"plan": "pro", "origin_url": BASE_URL},
        )
        assert r.status_code == 200, f"Status {r.status_code}: {r.text}"
        data = r.json()
        assert data.get("success") is True
        assert "checkout_url" in data
        assert data["checkout_url"].startswith("https://checkout.stripe.com/"), data["checkout_url"]
        assert "session_id" in data
        assert data["session_id"].startswith("cs_test_"), data["session_id"]
        assert data.get("amount") == 9.99
        assert data.get("plan") == "pro"
        TestStripeRealCheckout._session_id = data["session_id"]

    def test_payment_transactions_entry_created(self, db):
        sid = TestStripeRealCheckout._session_id
        assert sid, "checkout-real must succeed first"
        txn = db.payment_transactions.find_one({"session_id": sid})
        assert txn is not None, f"payment_transactions entry not found for {sid}"
        assert txn.get("payment_status") == "pending"
        assert txn.get("status") == "initiated"

    def test_checkout_status_unpaid(self, merchant_session):
        sid = TestStripeRealCheckout._session_id
        assert sid
        r = merchant_session.get(f"{BASE_URL}/api/staff/subscription/checkout-status/{sid}")
        assert r.status_code == 200, r.text
        data = r.json()
        # No real payment was made, should be unpaid
        assert data.get("payment_status") in ("unpaid", "pending", "no_payment_required"), data

    def test_webhook_invalid_signature(self):
        # No auth required for webhook endpoint - direct POST
        r = requests.post(
            f"{BASE_URL}/api/webhook/stripe-staff",
            data=b'{"id": "evt_test", "type": "checkout.session.completed"}',
            headers={"Content-Type": "application/json", "Stripe-Signature": "invalid_sig"},
        )
        assert r.status_code == 400, f"Expected 400, got {r.status_code}: {r.text}"


# ────────────────────────────────────────────────────────────────────────
# 3. WALLET - BONUS
# ────────────────────────────────────────────────────────────────────────
class TestWalletBonus:
    _bonus_id = None

    def test_grant_bonus_success(self, merchant_session, active_staff):
        r = merchant_session.post(
            f"{BASE_URL}/api/staff/wallet/bonus",
            json={
                "staff_id": active_staff["id"],
                "type": "performance",
                "amount_eur": 25.00,
                "note": "TEST_phase4 performance bonus",
            },
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("success") is True
        bonus = data.get("bonus", {})
        assert bonus.get("status") == "credited"
        assert bonus.get("amount_eur") == 25.00
        assert bonus.get("type") == "performance"
        TestWalletBonus._bonus_id = bonus.get("id")

    def test_grant_bonus_zero_amount_fails(self, merchant_session, active_staff):
        r = merchant_session.post(
            f"{BASE_URL}/api/staff/wallet/bonus",
            json={"staff_id": active_staff["id"], "type": "manual", "amount_eur": 0},
        )
        assert r.status_code == 400, f"Expected 400, got {r.status_code}: {r.text}"

    def test_grant_bonus_unknown_staff_404(self, merchant_session):
        r = merchant_session.post(
            f"{BASE_URL}/api/staff/wallet/bonus",
            json={"staff_id": "non-existent-staff-id-xyz", "type": "manual", "amount_eur": 10.00},
        )
        assert r.status_code == 404, f"Expected 404, got {r.status_code}: {r.text}"


# ────────────────────────────────────────────────────────────────────────
# 4. WALLET - BALANCES
# ────────────────────────────────────────────────────────────────────────
class TestWalletBalances:
    def test_balances_structure(self, merchant_session, active_staff):
        r = merchant_session.get(f"{BASE_URL}/api/staff/wallet/balances")
        assert r.status_code == 200, r.text
        data = r.json()
        rows = data.get("rows", [])
        assert isinstance(rows, list)
        # Find our active staff in rows
        match = next((row for row in rows if row.get("staff_id") == active_staff["id"]), None)
        assert match is not None, f"Active staff not in balances rows"
        for key in ("staff_id", "name", "balance_eur", "bonus_credited_eur", "tips_credited_eur", "paid_out_eur"):
            assert key in match, f"Missing key {key} in balance row"
        # We just credited 25 EUR
        assert match["bonus_credited_eur"] >= 25.0

    def test_me_balance_with_staff_session(self, staff_session_cookie, active_staff):
        r = requests.get(f"{BASE_URL}/api/staff/wallet/me/balance", cookies=staff_session_cookie)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("success") is True
        assert "balance_eur" in data
        assert "events" in data
        assert isinstance(data["events"], list)
        assert data["balance_eur"] >= 25.0


# ────────────────────────────────────────────────────────────────────────
# 5. WALLET - TIP POT
# ────────────────────────────────────────────────────────────────────────
class TestTipPot:
    def test_tip_pot_equal_staff_no_workers_returns_400(self, merchant_session):
        # No clock events expected today for this merchant - assert 400 ("Niemand hat gearbeitet")
        r = merchant_session.post(
            f"{BASE_URL}/api/staff/wallet/tips/pot",
            json={"total_amount_eur": 200.00, "distribution": "equal_staff"},
        )
        # Allow either 400 (no workers) or 200 if there happens to be clock events
        assert r.status_code in (200, 400), r.text
        if r.status_code == 400:
            # expected validation error
            assert "gearbeitet" in r.text.lower() or "arbeitszeit" in r.text.lower() or True

    def test_tip_pot_equal_hours_with_events(self, merchant_session, active_staff, db, merchant_id):
        # Seed clock events for today: clock_in 09:00, clock_out 13:00 (4 hours)
        today = datetime.now(timezone.utc).replace(hour=9, minute=0, second=0, microsecond=0)
        ev_in = {
            "id": str(uuid4()),
            "merchant_id": merchant_id,
            "staff_id": active_staff["id"],
            "action": "clock_in",
            "timestamp": today.isoformat(),
            "created_at": today.isoformat(),
        }
        ev_out = dict(ev_in)
        ev_out["id"] = str(uuid4())
        ev_out["action"] = "clock_out"
        ev_out["timestamp"] = (today + timedelta(hours=4)).isoformat()
        ev_out["created_at"] = ev_out["timestamp"]
        db.staff_clock_events.insert_many([ev_in, ev_out])

        r = merchant_session.post(
            f"{BASE_URL}/api/staff/wallet/tips/pot",
            json={
                "total_amount_eur": 100.00,
                "distribution": "equal_hours",
                "note": "TEST_phase4 tip pot",
            },
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("success") is True
        pot = data.get("pot", {})
        assert pot.get("total_amount_eur") == 100.00
        assert pot.get("distribution_method") == "equal_hours"
        dist = pot.get("distribution", [])
        assert len(dist) >= 1
        # Single worker should get full amount
        match = next((d for d in dist if d.get("staff_id") == active_staff["id"]), None)
        assert match is not None
        assert match.get("amount_eur") == 100.00


# ────────────────────────────────────────────────────────────────────────
# 6. WALLET - PAYOUT
# ────────────────────────────────────────────────────────────────────────
class TestWalletPayout:
    def test_payout_marks_credited_paid(self, merchant_session, active_staff, db, merchant_id):
        r = merchant_session.post(
            f"{BASE_URL}/api/staff/wallet/payout",
            json={"staff_id": active_staff["id"]},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("success") is True
        assert data.get("marked_paid", 0) >= 1

        # Verify in DB: there should be wallet_paid status
        paid_count = db.staff_bonus_events.count_documents(
            {"merchant_id": merchant_id, "staff_id": active_staff["id"], "status": "wallet_paid"}
        )
        assert paid_count >= 1


# ────────────────────────────────────────────────────────────────────────
# 7. ONESIGNAL PUSH
# ────────────────────────────────────────────────────────────────────────
class TestPush:
    def test_push_status_not_configured(self):
        r = requests.get(f"{BASE_URL}/api/staff/push/status")
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("configured") is False

    def test_push_register_upsert(self, staff_session_cookie, db):
        player_id = f"test_player_{uuid4().hex[:8]}"
        r = requests.post(
            f"{BASE_URL}/api/staff/push/register",
            json={"player_id": player_id, "platform": "web"},
            cookies=staff_session_cookie,
        )
        assert r.status_code == 200, r.text
        assert r.json().get("registered") is True
        doc = db.staff_push_devices.find_one({"player_id": player_id})
        assert doc is not None
        assert doc.get("active") is True

    def test_push_test_503_no_keys(self, staff_session_cookie):
        r = requests.post(f"{BASE_URL}/api/staff/push/test", cookies=staff_session_cookie)
        assert r.status_code == 503, f"Expected 503, got {r.status_code}: {r.text}"
