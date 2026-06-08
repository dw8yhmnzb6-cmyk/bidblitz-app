"""
iter123 - Taxi Pro Suite Backend Tests
Tests Pre-Booking, Recurring, Corporate, Driver Pro, Lost+Found, Tariffs, PDF.
"""
import os
import uuid
from datetime import datetime, timezone, timedelta

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://taxi-uber-style.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"email": "admin@bidblitz.com", "password": "BidBlitz2026!"}
MERCHANT = {"email": "haendler@bidblitz.com", "password": "Haendler2026!"}
CUSTOMER = {"email": "kunde@bidblitz.com", "password": "Kunde2026!"}


def _login(creds):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json=creds, timeout=30)
    assert r.status_code == 200, f"login failed for {creds['email']}: {r.status_code} {r.text[:200]}"
    return s


@pytest.fixture(scope="module")
def admin_sess():
    return _login(ADMIN)


@pytest.fixture(scope="module")
def merchant_sess():
    return _login(MERCHANT)


@pytest.fixture(scope="module")
def customer_sess():
    try:
        return _login(CUSTOMER)
    except AssertionError:
        return _login(ADMIN)  # fallback per agent note


# ─────────── Pre-Booking ───────────
class TestPreBooking:
    def test_create_future(self, customer_sess):
        sched = (datetime.now(timezone.utc) + timedelta(minutes=30)).isoformat()
        payload = {
            "pickup": {"lat": 52.52, "lng": 13.40, "address": "Berlin Mitte"},
            "dropoff": {"lat": 52.55, "lng": 13.50, "address": "BER Airport"},
            "vehicle_type": "standard",
            "scheduled_for": sched,
        }
        r = customer_sess.post(f"{API}/taxi/scheduled", json=payload, timeout=20)
        assert r.status_code in (200, 201), r.text
        data = r.json()
        assert data.get("success") is True
        assert data["scheduled_ride"]["status"] == "pending"
        assert "id" in data["scheduled_ride"]
        pytest._iter123_sched_id = data["scheduled_ride"]["id"]

    def test_create_past_rejected(self, customer_sess):
        past = (datetime.now(timezone.utc) - timedelta(minutes=10)).isoformat()
        r = customer_sess.post(f"{API}/taxi/scheduled", json={
            "pickup": {"lat": 52.5, "lng": 13.4, "address": "A"},
            "dropoff": {"lat": 52.6, "lng": 13.5, "address": "B"},
            "scheduled_for": past,
        }, timeout=20)
        assert r.status_code == 422, f"Expected 422 got {r.status_code}: {r.text[:200]}"

    def test_create_too_soon(self, customer_sess):
        soon = (datetime.now(timezone.utc) + timedelta(minutes=2)).isoformat()
        r = customer_sess.post(f"{API}/taxi/scheduled", json={
            "pickup": {"lat": 52.5, "lng": 13.4, "address": "A"},
            "dropoff": {"lat": 52.6, "lng": 13.5, "address": "B"},
            "scheduled_for": soon,
        }, timeout=20)
        assert r.status_code == 422

    def test_list_own_only(self, customer_sess):
        r = customer_sess.get(f"{API}/taxi/scheduled", timeout=20)
        assert r.status_code == 200
        items = r.json().get("items", [])
        assert isinstance(items, list)
        sid = getattr(pytest, "_iter123_sched_id", None)
        if sid:
            assert any(it.get("id") == sid for it in items), "created item not in list"

    def test_cancel_then_404(self, customer_sess):
        sid = getattr(pytest, "_iter123_sched_id", None)
        if not sid:
            pytest.skip("no sched id")
        r1 = customer_sess.delete(f"{API}/taxi/scheduled/{sid}", timeout=20)
        assert r1.status_code == 200
        assert r1.json().get("success") is True
        r2 = customer_sess.delete(f"{API}/taxi/scheduled/{sid}", timeout=20)
        assert r2.status_code == 404

    def test_watchdog_status_public(self):
        r = requests.get(f"{API}/taxi/scheduled/watchdog/status", timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert "running" in data
        assert "last_tick_at" in data
        assert "dispatched" in data
        assert "recurring_created" in data


# ─────────── Recurring ───────────
class TestRecurring:
    def test_create(self, customer_sess):
        r = customer_sess.post(f"{API}/taxi/recurring", json={
            "pickup": {"lat": 52.52, "lng": 13.40, "address": "Home"},
            "dropoff": {"lat": 52.55, "lng": 13.50, "address": "Work"},
            "weekdays": [0, 1, 2, 3, 4],
            "time_hhmm": "08:00",
        }, timeout=20)
        assert r.status_code in (200, 201), r.text
        data = r.json()
        assert data.get("success") is True
        rec = data["recurring"]
        assert rec.get("next_run_at"), "next_run_at must be set"
        assert rec.get("active") is True
        pytest._iter123_rec_id = rec["id"]

    def test_toggle_inactive(self, customer_sess):
        rid = getattr(pytest, "_iter123_rec_id", None)
        if not rid:
            pytest.skip("no rec id")
        r = customer_sess.patch(f"{API}/taxi/recurring/{rid}?active=false", timeout=20)
        assert r.status_code == 200

    def test_delete(self, customer_sess):
        rid = getattr(pytest, "_iter123_rec_id", None)
        if not rid:
            pytest.skip()
        r = customer_sess.delete(f"{API}/taxi/recurring/{rid}", timeout=20)
        assert r.status_code == 200


# ─────────── Corporate ───────────
class TestCorporate:
    def test_create_account(self, merchant_sess):
        # Clean up any pre-existing
        r = merchant_sess.post(f"{API}/taxi/corporate/accounts", json={
            "company_name": "TEST_Iter123 GmbH",
            "vat_id": "DE999999999",
            "billing_email": "billing@test123.de",
        }, timeout=20)
        # Either 200/201 or 409 if already exists
        assert r.status_code in (200, 201, 409), r.text
        if r.status_code in (200, 201):
            data = r.json()
            assert data["account"]["company_name"]

    def test_mine(self, merchant_sess):
        r = merchant_sess.get(f"{API}/taxi/corporate/accounts/mine", timeout=20)
        assert r.status_code == 200
        data = r.json()
        if data.get("account"):
            assert data["role"] == "owner"
            pytest._iter123_acc_id = data["account"]["id"]

    def test_duplicate_create_409(self, merchant_sess):
        r = merchant_sess.post(f"{API}/taxi/corporate/accounts", json={
            "company_name": "TEST_Duplicate",
            "billing_email": "dup@test.de",
        }, timeout=20)
        assert r.status_code == 409

    def test_invite(self, merchant_sess):
        aid = getattr(pytest, "_iter123_acc_id", None)
        if not aid:
            pytest.skip("no account id")
        r = merchant_sess.post(f"{API}/taxi/corporate/accounts/{aid}/invite",
                               json={"email": "invitee@test.de", "role": "employee"}, timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert data["invite"]["token"]

    def test_summary(self, merchant_sess):
        aid = getattr(pytest, "_iter123_acc_id", None)
        if not aid:
            pytest.skip("no account id")
        r = merchant_sess.get(f"{API}/taxi/corporate/accounts/{aid}/summary?year=2026&month=5",
                              timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert "total_eur" in data and "ride_count" in data
        assert "by_cost_center" in data and "by_user" in data


# ─────────── Driver Pro ───────────
class TestDriverPro:
    def test_heatmap_merchant_forbidden(self, merchant_sess):
        r = merchant_sess.get(f"{API}/taxi/driver/demand-heatmap", timeout=20)
        assert r.status_code == 403

    def test_heatmap_admin_ok(self, admin_sess):
        r = admin_sess.get(f"{API}/taxi/driver/demand-heatmap", timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert "cells" in data and isinstance(data["cells"], list)

    def test_document_add(self, admin_sess):
        r = admin_sess.post(f"{API}/taxi/driver/documents",
                             json={"type": "tuev", "expires_on": "2026-12-31"}, timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["document"]["type"] == "tuev"

    def test_documents_list_with_expiry(self, admin_sess):
        r = admin_sess.get(f"{API}/taxi/driver/documents", timeout=20)
        assert r.status_code == 200
        items = r.json().get("items", [])
        if items:
            # At least one should have days_until_expiry computed
            assert any("days_until_expiry" in d for d in items)

    def test_earnings_pro(self, admin_sess):
        r = admin_sess.get(f"{API}/taxi/driver/earnings/pro?days=30", timeout=20)
        assert r.status_code == 200
        data = r.json()
        for k in ("gross_eur", "tips_eur", "total_eur", "by_day"):
            assert k in data

    def test_earnings_csv(self, admin_sess):
        r = admin_sess.get(f"{API}/taxi/driver/earnings/export.csv?days=30", timeout=20)
        assert r.status_code == 200
        assert "text/csv" in r.headers.get("Content-Type", "")
        cd = r.headers.get("Content-Disposition", "")
        assert "attachment" in cd


# ─────────── Lost & Found ───────────
class TestLostFound:
    def test_open_case_invalid_ride_404(self, customer_sess):
        r = customer_sess.post(f"{API}/taxi/lostfound/cases",
                               json={"ride_id": "nonexistent-" + uuid.uuid4().hex,
                                     "item_description": "Black wallet"}, timeout=20)
        assert r.status_code == 404


# ─────────── Tariffs + Airport ───────────
class TestTariffsAirport:
    def test_zones_public(self):
        r = requests.get(f"{API}/taxi/tariff-zones", timeout=20)
        assert r.status_code == 200
        assert "items" in r.json()

    def test_zone_create_admin(self, admin_sess):
        r = admin_sess.post(f"{API}/taxi/admin/tariff-zones", json={
            "name": f"TEST_Zone_{uuid.uuid4().hex[:6]}",
            "center_lat": 52.52, "center_lng": 13.40,
            "radius_km": 15.0,
        }, timeout=20)
        assert r.status_code == 200, r.text
        assert r.json().get("success") is True

    def test_airport_join_admin(self, admin_sess):
        r = admin_sess.post(f"{API}/taxi/airport-queue/join",
                            json={"airport_code": "BER"}, timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["position"] is not None
        assert data["total"] >= 1

    def test_airport_status(self, admin_sess):
        r = admin_sess.get(f"{API}/taxi/airport-queue/BER", timeout=20)
        assert r.status_code == 200
        data = r.json()
        # API returns position+total+updated_at (drivers list not exposed in GET)
        assert "total" in data
        assert data.get("position") is not None

    def test_airport_leave(self, admin_sess):
        r = admin_sess.post(f"{API}/taxi/airport-queue/leave",
                            json={"airport_code": "BER"}, timeout=20)
        assert r.status_code == 200
        # Verify position cleared
        r2 = admin_sess.get(f"{API}/taxi/airport-queue/BER", timeout=20)
        assert r2.json().get("position") in (None, 0)

    def test_public_demand_map(self):
        r = requests.get(f"{API}/taxi/public/demand-marketing", timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert "cells" in data


# ─────────── PDF Receipt ───────────
class TestPDFReceipt:
    def test_pdf_for_completed(self, admin_sess):
        # Find a completed ride
        # Try common admin endpoints
        ride_id = None
        for url in [f"{API}/taxi/admin/rides?status=completed&limit=1",
                    f"{API}/taxi/rides/history",
                    f"{API}/taxi/history"]:
            try:
                r = admin_sess.get(url, timeout=20)
                if r.status_code == 200:
                    data = r.json()
                    items = data.get("items") or data.get("rides") or data
                    if isinstance(items, list):
                        for it in items:
                            if it.get("status") == "completed":
                                ride_id = it.get("ride_id") or it.get("id")
                                break
                    if ride_id:
                        break
            except Exception:
                pass
        if not ride_id:
            pytest.skip("No completed ride found to test PDF")
        r = admin_sess.get(f"{API}/taxi/rides/{ride_id}/receipt.pdf", timeout=30)
        assert r.status_code == 200, f"PDF status {r.status_code}: {r.text[:200]}"
        assert "application/pdf" in r.headers.get("Content-Type", "")
        assert r.content[:4] == b"%PDF"
