"""
iter121 — Live-Map + Anomaly Detection + Shift Watchdog tests
"""
import os
import time
import uuid
import math
import asyncio
import pytest
import requests
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://swipe-match-chat-8.preview.emergentagent.com").rstrip("/")
MERCHANT_EMAIL = "haendler@bidblitz.com"
MERCHANT_PASSWORD = "Haendler2026!"


@pytest.fixture(scope="module")
def merchant_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login",
               json={"email": MERCHANT_EMAIL, "password": MERCHANT_PASSWORD},
               timeout=20)
    assert r.status_code == 200, f"Merchant login failed: {r.status_code} {r.text[:200]}"
    # Cookie-based auth; also expose Bearer-style header if needed
    token = s.cookies.get("access_token")
    if token:
        s.headers["Authorization"] = f"Bearer {token}"
    return s


# Backwards-compat alias for header-only callers
@pytest.fixture(scope="module")
def merchant_headers(merchant_session):
    return dict(merchant_session.headers)


# ------- Live-Map -------
class TestLiveMapAuth:
    def test_positions_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/staff/live-map/positions", timeout=15)
        assert r.status_code in (401, 403), f"Expected 401/403 without auth, got {r.status_code}"

    def test_anomalies_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/staff/live-map/anomalies?limit=5", timeout=15)
        assert r.status_code in (401, 403)


class TestLiveMapMerchant:
    def test_positions_as_merchant(self, merchant_headers):
        r = requests.get(f"{BASE_URL}/api/staff/live-map/positions",
                         headers=merchant_headers, timeout=20)
        assert r.status_code == 200, f"{r.status_code} {r.text[:200]}"
        d = r.json()
        for k in ("merchant_id", "total", "active_count", "anomaly_count", "positions", "geofences"):
            assert k in d, f"Missing key {k}"
        assert isinstance(d["positions"], list)
        if d["positions"]:
            p = d["positions"][0]
            for k in ("staff_id", "name", "state", "geofence_status", "stale", "has_anomaly_today"):
                assert k in p, f"Missing position field {k}"

    def test_anomalies_list(self, merchant_headers):
        r = requests.get(f"{BASE_URL}/api/staff/live-map/anomalies?limit=5",
                         headers=merchant_headers, timeout=15)
        assert r.status_code == 200, f"{r.status_code} {r.text[:200]}"
        d = r.json()
        assert "total" in d and "items" in d
        assert isinstance(d["items"], list)

    def test_anomaly_review_404(self, merchant_headers):
        fake = f"nonexistent-{uuid.uuid4()}"
        r = requests.post(f"{BASE_URL}/api/staff/live-map/anomalies/{fake}/review",
                          headers=merchant_headers, timeout=15)
        assert r.status_code == 404, f"Expected 404 got {r.status_code}: {r.text[:200]}"


# ------- Watchdog -------
class TestWatchdog:
    def test_status_public(self):
        r = requests.get(f"{BASE_URL}/api/staff/watchdog/status", timeout=15)
        assert r.status_code == 200, f"{r.status_code} {r.text[:200]}"
        d = r.json()
        for k in ("running", "last_tick_at", "last_tick_count",
                  "total_break_reminders", "total_checkout_reminders"):
            assert k in d, f"Missing {k}"
        assert d["running"] is True, f"Watchdog not running: {d}"

    def test_tick_requires_auth(self):
        r = requests.post(f"{BASE_URL}/api/staff/watchdog/tick", timeout=20)
        assert r.status_code in (401, 403)

    def test_tick_with_merchant_auth(self, merchant_headers):
        r = requests.post(f"{BASE_URL}/api/staff/watchdog/tick",
                          headers=merchant_headers, timeout=30)
        assert r.status_code == 200, f"{r.status_code} {r.text[:200]}"
        d = r.json()
        assert d.get("success") is True
        for k in ("checked", "break_sent", "checkout_sent"):
            assert k in d

    def test_tick_idempotent_no_duplicates(self, merchant_headers):
        # Run two ticks in a row; second tick should yield no new reminders
        r1 = requests.post(f"{BASE_URL}/api/staff/watchdog/tick",
                           headers=merchant_headers, timeout=30)
        assert r1.status_code == 200
        d1 = r1.json()
        r2 = requests.post(f"{BASE_URL}/api/staff/watchdog/tick",
                           headers=merchant_headers, timeout=30)
        assert r2.status_code == 200
        d2 = r2.json()
        # Second tick must not send MORE than first (idempotency).
        assert d2["break_sent"] == 0, f"Second tick sent {d2['break_sent']} break reminders (expected 0)"
        assert d2["checkout_sent"] == 0, f"Second tick sent {d2['checkout_sent']} checkout reminders"


# ------- Anomaly check via direct util call -------
class TestAnomalyDetection:
    def test_check_anomaly_impossible_jump(self):
        """
        Insert two clock-events via direct DB access (using motor through backend mongo).
        Simulate ~11 km jump in 30s → impossible_jump.
        """
        import sys
        sys.path.insert(0, "/app/backend")
        from core.database import db
        from utils.clock_anomaly import check_anomaly

        staff_id = f"TEST_anomaly_staff_{uuid.uuid4().hex[:8]}"
        merchant_id = "TEST_merchant_anomaly"
        now = datetime.now(timezone.utc)
        ts1 = (now - timedelta(seconds=30)).isoformat()
        ts2 = now.isoformat()
        ev1_id = f"TEST_ev1_{uuid.uuid4().hex[:8]}"
        ev2_id = f"TEST_ev2_{uuid.uuid4().hex[:8]}"

        async def run():
            # Cleanup pre-existing
            await db.staff_clock_events.delete_many({"staff_id": staff_id})
            await db.staff_anomalies.delete_many({"staff_id": staff_id})
            await db.staff_clock_events.insert_one({
                "id": ev1_id, "staff_id": staff_id, "merchant_id": merchant_id,
                "action": "clock_in", "lat": 52.52, "lng": 13.405, "timestamp": ts1,
            })
            await db.staff_clock_events.insert_one({
                "id": ev2_id, "staff_id": staff_id, "merchant_id": merchant_id,
                "action": "ping", "lat": 52.62, "lng": 13.405, "timestamp": ts2,
            })
            result = await check_anomaly(staff_id, merchant_id, ev2_id,
                                         52.62, 13.405, ts2)
            ev = await db.staff_clock_events.find_one({"id": ev2_id}, {"_id": 0})
            anom = await db.staff_anomalies.find_one({"event_id": ev2_id}, {"_id": 0})
            # Cleanup
            await db.staff_clock_events.delete_many({"staff_id": staff_id})
            await db.staff_anomalies.delete_many({"staff_id": staff_id})
            return result, ev, anom

        result, ev, anom = asyncio.run(run())
        assert result is not None, "Expected anomaly to be detected"
        assert result["reason"] in ("impossible_jump", "speed_exceeded"), f"Unexpected reason {result}"
        assert ev.get("is_mock_suspected") is True
        assert ev.get("mock_reason") in ("impossible_jump", "speed_exceeded")
        assert anom is not None, "staff_anomalies entry missing"
        assert anom["staff_id"] == staff_id
        assert anom["reviewed"] is False
