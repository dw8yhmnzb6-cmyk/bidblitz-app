"""
Backend regression tests — Insurance (Quote + Claims) & Telemedizin (Slots/Cancel/Prescription).
Iteration 34 — FAST MODE.
"""
import os
import time
import secrets
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://super-app-preview-3.preview.emergentagent.com").rstrip("/")
MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "test_database"

ADMIN_EMAIL = "admin@bidblitz.com"
ADMIN_PASSWORD = "BidBlitz2026!"

mongo = MongoClient(MONGO_URL)[DB_NAME]


# ─── Fixtures ────────────────────────────────────────────────────────────────
@pytest.fixture(scope="session")
def admin_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    body = r.json()
    assert body.get("role") == "admin", f"Expected admin role, got: {body}"
    return s


@pytest.fixture(scope="session")
def user_session():
    """Register a fresh user and login. Top up balance directly via MongoDB."""
    s = requests.Session()
    suffix = secrets.token_hex(4)
    email = f"TEST_user_{suffix}@bidblitz.com"
    pwd = "TestUser2026!"
    name = f"Test User {suffix}"
    r = s.post(f"{BASE_URL}/api/auth/register", json={"email": email, "password": pwd, "name": name})
    assert r.status_code in (200, 201), f"Register failed: {r.status_code} {r.text}"

    # Ensure session works (register may auto-login). Otherwise login explicitly.
    me = s.get(f"{BASE_URL}/api/auth/me")
    if me.status_code != 200:
        r = s.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": pwd})
        assert r.status_code == 200, f"User login failed: {r.status_code} {r.text}"

    # Top up wallet directly to enable purchase.
    res = mongo.users.update_one({"email": email.lower()}, {"$set": {"balance": 500.0}})
    assert res.matched_count == 1, "User not found in DB after register"

    s.test_email = email
    s.test_password = pwd
    return s


@pytest.fixture(scope="session")
def insurance_product(admin_session):
    """Ensure at least one active insurance product exists; create one if needed."""
    r = admin_session.get(f"{BASE_URL}/api/insurance/products")
    assert r.status_code == 200, f"List products failed: {r.text}"
    items = r.json().get("products", [])
    if items:
        return items[0]

    payload = {
        "title": "TEST_AutoBasis",
        "category": "auto",
        "provider": "TestVersicherer",
        "description": "Test Police für Backend Regression",
        "coverage": "Haftpflicht + Teilkasko",
        "monthly_price": 25.0,
        "deductible": 150.0,
        "features": ["24/7 Hotline", "Werkstattservice"],
    }
    r = admin_session.post(f"{BASE_URL}/api/insurance/products", json=payload)
    assert r.status_code == 200, f"Create product failed: {r.status_code} {r.text}"
    body = r.json()
    assert body.get("ok") is True
    return body["product"]


# ─── Smoke ──────────────────────────────────────────────────────────────────
class TestSmoke:
    def test_backend_healthy(self):
        # No /api/health, but categories returns 200 if backend is up.
        r = requests.get(f"{BASE_URL}/api/insurance/categories")
        assert r.status_code == 200
        assert "categories" in r.json()

    def test_telemedizin_specialties(self):
        r = requests.get(f"{BASE_URL}/api/telemedizin/specialties")
        assert r.status_code == 200
        assert len(r.json().get("specialties", [])) > 0


# ─── Insurance Quote ────────────────────────────────────────────────────────
class TestInsuranceQuote:
    def test_quote_auto(self):
        r = requests.post(f"{BASE_URL}/api/insurance/quote",
                          json={"category": "auto", "params": {"driver_age": 28, "vehicle_age": 3}})
        assert r.status_code == 200
        d = r.json()
        assert d["ok"] is True
        assert d["category"] == "auto"
        assert isinstance(d["monthly_price"], (int, float))
        assert d["monthly_price"] > 0
        assert d["yearly_price"] > 0
        assert d["currency"] == "EUR"

    @pytest.mark.parametrize("category,params", [
        ("travel", {"trip_days": 14}),
        ("phone", {"device_value": 800}),
        ("household", {"living_sqm": 80}),
        ("liability", {}),
        ("health", {"age": 35}),
        ("life", {"age": 35, "coverage_amount": 200000}),
        ("pet", {"pet_age": 4}),
    ])
    def test_quote_each_category(self, category, params):
        r = requests.post(f"{BASE_URL}/api/insurance/quote",
                          json={"category": category, "params": params})
        assert r.status_code == 200, f"{category}: {r.text}"
        d = r.json()
        assert d["ok"] is True
        assert d["category"] == category
        assert isinstance(d["monthly_price"], (int, float))
        assert d["monthly_price"] > 0

    def test_quote_invalid_category(self):
        r = requests.post(f"{BASE_URL}/api/insurance/quote",
                          json={"category": "spaceship", "params": {}})
        assert r.status_code == 400


# ─── Insurance Products & Purchase ──────────────────────────────────────────
class TestInsuranceProducts:
    def test_admin_can_list_products(self, admin_session, insurance_product):
        r = admin_session.get(f"{BASE_URL}/api/insurance/products")
        assert r.status_code == 200
        assert isinstance(r.json().get("products"), list)

    def test_user_can_purchase_product(self, user_session, insurance_product):
        product_id = insurance_product["product_id"]
        r = user_session.post(f"{BASE_URL}/api/insurance/purchase",
                              json={"product_id": product_id, "billing": "monthly"})
        assert r.status_code == 200, f"Purchase failed: {r.status_code} {r.text}"
        body = r.json()
        assert body.get("ok") is True
        assert "policy" in body
        policy = body["policy"]
        assert policy["status"] == "active"
        assert policy["product_id"] == product_id
        assert policy["reference"].startswith("INS-")
        # Stash policy_id for later tests
        pytest.shared_policy_id = policy["policy_id"]


# ─── Insurance Claims ───────────────────────────────────────────────────────
class TestInsuranceClaims:
    def test_create_claim(self, user_session):
        policy_id = getattr(pytest, "shared_policy_id", None)
        assert policy_id, "No policy purchased — purchase test must run first"
        payload = {
            "policy_id": policy_id,
            "claim_type": "accident",
            "description": "Auffahrunfall an einer roten Ampel mit leichtem Heckschaden.",
            "incident_date": "2026-01-15",
            "amount_estimate": 1200.0,
        }
        r = user_session.post(f"{BASE_URL}/api/insurance/claim", json=payload)
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        body = r.json()
        assert body["ok"] is True
        claim = body["claim"]
        assert claim["reference"].startswith("CLM-")
        assert claim["status"] == "submitted"
        pytest.shared_claim_id = claim["claim_id"]
        pytest.shared_claim_ref = claim["reference"]

    def test_my_claims_lists_new_claim(self, user_session):
        r = user_session.get(f"{BASE_URL}/api/insurance/my-claims")
        assert r.status_code == 200
        ids = [c["claim_id"] for c in r.json().get("claims", [])]
        assert pytest.shared_claim_id in ids

    def test_claim_detail(self, user_session):
        r = user_session.get(f"{BASE_URL}/api/insurance/claim/{pytest.shared_claim_id}")
        assert r.status_code == 200
        c = r.json()
        assert c["claim_id"] == pytest.shared_claim_id
        assert c["description"].startswith("Auffahrunfall")

    def test_claim_detail_other_user_denied(self, admin_session):
        # Admin is a different user → /claim/{id} enforces ownership (returns 404).
        r = admin_session.get(f"{BASE_URL}/api/insurance/claim/{pytest.shared_claim_id}")
        assert r.status_code in (403, 404), f"Expected 403/404, got {r.status_code}"

    def test_admin_review_paid_credits_wallet(self, admin_session, user_session):
        # Snapshot user balance before payout
        email = user_session.test_email.lower()
        before = mongo.users.find_one({"email": email}, {"balance": 1})["balance"]

        payload = {"status": "paid", "payout_amount": 50.0, "notes": "Approved for partial payout"}
        r = admin_session.post(
            f"{BASE_URL}/api/insurance/admin/claim/{pytest.shared_claim_id}/review",
            json=payload,
        )
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        assert r.json().get("ok") is True

        # Verify wallet credited by 50
        after = mongo.users.find_one({"email": email}, {"balance": 1})["balance"]
        assert round(after - before, 2) == 50.0, f"Expected +50, got {after - before}"

        # Verify transaction created
        tx = mongo.transactions.find_one({"reference": pytest.shared_claim_ref, "type": "insurance_payout"})
        assert tx is not None
        assert tx["amount"] == 50.0

    def test_non_admin_cannot_review(self, user_session):
        r = user_session.post(
            f"{BASE_URL}/api/insurance/admin/claim/{pytest.shared_claim_id}/review",
            json={"status": "paid", "payout_amount": 10.0},
        )
        assert r.status_code == 403


# ─── Telemedizin: Slots / Booking / Cancel ──────────────────────────────────
class TestTelemedizin:
    DOC = "doc_001"
    DATE = "2026-02-20"

    def test_slots_returns_array(self):
        r = requests.get(f"{BASE_URL}/api/telemedizin/slots/{self.DOC}", params={"date": self.DATE})
        assert r.status_code == 200
        body = r.json()
        assert body["date"] == self.DATE
        slots = body["slots"]
        assert isinstance(slots, list) and len(slots) > 0
        first = slots[0]
        assert "time" in first and "available" in first

    def test_book_then_slot_unavailable(self, user_session):
        # Pick a random free slot to avoid collision with prior test runs
        r = requests.get(f"{BASE_URL}/api/telemedizin/slots/{self.DOC}", params={"date": self.DATE})
        free = [s["time"] for s in r.json()["slots"] if s["available"]]
        assert free, "No free slots available — cleanup needed"
        target_time = free[-1]  # last available slot

        r = user_session.post(f"{BASE_URL}/api/telemedizin/appointment", json={
            "doctor_id": self.DOC, "date": self.DATE, "time": target_time, "reason": "TEST_routinecheck"
        })
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        body = r.json()
        assert body["ok"] is True
        appt = body["appointment"]
        assert appt["status"] == "confirmed"
        pytest.shared_appt_id = appt["appointment_id"]
        pytest.shared_appt_time = target_time

        # Slot should now be unavailable
        r2 = requests.get(f"{BASE_URL}/api/telemedizin/slots/{self.DOC}", params={"date": self.DATE})
        slot_map = {s["time"]: s["available"] for s in r2.json()["slots"]}
        assert slot_map.get(target_time) is False, f"Slot {target_time} still available after booking"

    def test_cancel_owner_only(self, admin_session):
        # Admin (different user) cannot cancel
        r = admin_session.post(f"{BASE_URL}/api/telemedizin/cancel/{pytest.shared_appt_id}")
        assert r.status_code == 403

    def test_cancel_owner_succeeds(self, user_session):
        r = user_session.post(f"{BASE_URL}/api/telemedizin/cancel/{pytest.shared_appt_id}")
        assert r.status_code == 200
        assert r.json().get("ok") is True

    def test_double_cancel_fails(self, user_session):
        r = user_session.post(f"{BASE_URL}/api/telemedizin/cancel/{pytest.shared_appt_id}")
        assert r.status_code == 400


# ─── Telemedizin: Prescription ──────────────────────────────────────────────
class TestPrescription:
    DOC = "doc_001"
    DATE = "2026-02-21"

    def test_prescription_flow(self, admin_session, user_session):
        # 1. User books a fresh appointment (so prescription has a valid target)
        r = requests.get(f"{BASE_URL}/api/telemedizin/slots/{self.DOC}", params={"date": self.DATE})
        free = [s["time"] for s in r.json()["slots"] if s["available"]]
        assert free, "No free slots"
        t = free[0]
        r = user_session.post(f"{BASE_URL}/api/telemedizin/appointment", json={
            "doctor_id": self.DOC, "date": self.DATE, "time": t, "reason": "Husten"
        })
        assert r.status_code == 200, r.text
        appt_id = r.json()["appointment"]["appointment_id"]

        # 2. Admin (allowed) creates prescription
        rx_payload = {
            "appointment_id": appt_id,
            "medications": [{"name": "Ibuprofen 400", "dosage": "1 Tab", "frequency": "3x täglich"}],
            "diagnosis": "Akute Bronchitis",
            "notes": "5 Tage einnehmen",
        }
        r = admin_session.post(f"{BASE_URL}/api/telemedizin/prescription", json=rx_payload)
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        body = r.json()
        assert body["ok"] is True
        rx = body["prescription"]
        assert rx["code"].startswith("RX-")
        assert rx["patient_email"] == user_session.test_email.lower()

        # 3. User can fetch their prescriptions
        r = user_session.get(f"{BASE_URL}/api/telemedizin/my-prescriptions")
        assert r.status_code == 200
        codes = [p["code"] for p in r.json().get("prescriptions", [])]
        assert rx["code"] in codes

    def test_prescription_user_role_denied(self, user_session):
        r = user_session.post(f"{BASE_URL}/api/telemedizin/prescription", json={
            "appointment_id": "fake", "medications": [], "diagnosis": "x"
        })
        assert r.status_code == 403


# ─── Server startup / removed module check ─────────────────────────────────
class TestServerCleanup:
    def test_reservation_system_not_imported(self):
        with open("/app/backend/server.py") as f:
            content = f.read()
        assert "reservation_system" not in content, "reservation_system still referenced in server.py"

    def test_reservation_system_file_removed(self):
        assert not os.path.exists("/app/backend/routes/reservation_system.py"), \
            "reservation_system.py was supposed to be deleted"
