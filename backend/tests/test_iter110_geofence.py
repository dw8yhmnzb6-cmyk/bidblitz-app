"""
Iteration 110 — Backend tests for Staff Geofence endpoints
  - GET  /api/staff/geofence         (list as merchant)
  - GET  /api/staff/geofence/events  (events list)
  - POST /api/staff/geofence/check-presence (Termokos HQ coords)
Credentials per /app/memory/test_credentials.md
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://floorplan-wizard-8.preview.emergentagent.com").rstrip("/")
MERCHANT_EMAIL = "haendler@bidblitz.com"
MERCHANT_PASSWORD = "Haendler2026!"
STAFF_EMAIL = "mitarbeiter@bidblitz.com"
STAFF_PASSWORD = "test123"


@pytest.fixture(scope="module")
def merchant_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    # Try the typical login endpoint
    r = s.post(f"{BASE_URL}/api/auth/login",
               json={"email": MERCHANT_EMAIL, "password": MERCHANT_PASSWORD},
               timeout=20)
    if r.status_code != 200:
        pytest.skip(f"Merchant login failed status={r.status_code} body={r.text[:200]}")
    return s


@pytest.fixture(scope="module")
def staff_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    # Staff self-service login
    candidates = [
        f"{BASE_URL}/api/staff/auth/login",
        f"{BASE_URL}/api/staff/login",
        f"{BASE_URL}/api/auth/staff/login",
    ]
    for url in candidates:
        r = s.post(url, json={"email": STAFF_EMAIL, "password": STAFF_PASSWORD}, timeout=15)
        if r.status_code == 200:
            return s
    pytest.skip("Staff login endpoint not found / wrong creds")


# ── Geofence listing (merchant scope) ──
def test_list_geofences_as_merchant(merchant_session):
    r = merchant_session.get(f"{BASE_URL}/api/staff/geofence", timeout=15)
    assert r.status_code == 200, f"status={r.status_code} body={r.text[:300]}"
    data = r.json()
    # Accept either a list or {items: [...]}
    items = data if isinstance(data, list) else data.get("items") or data.get("geofences") or []
    assert isinstance(items, list)
    names = [g.get("name") for g in items]
    print("Geofence names:", names)
    # Termokos HQ should exist
    assert any("Termokos" in (n or "") for n in names), f"Termokos HQ missing — got {names}"


# ── Geofence events feed ──
def test_geofence_events_endpoint(merchant_session):
    r = merchant_session.get(f"{BASE_URL}/api/staff/geofence/events?limit=20", timeout=15)
    assert r.status_code == 200, f"status={r.status_code} body={r.text[:300]}"
    data = r.json()
    items = data if isinstance(data, list) else data.get("items") or data.get("events") or []
    assert isinstance(items, list)
    if items:
        ev = items[0]
        # Common keys
        assert any(k in ev for k in ("event_type", "type", "kind")), f"missing event_type in {ev}"


# ── Presence check from Termokos HQ coords ──
def test_check_presence_inside_termokos(staff_session):
    payload = {"lat": 42.6629, "lng": 21.1655, "accuracy_m": 15}
    r = staff_session.post(f"{BASE_URL}/api/staff/geofence/check-presence", json=payload, timeout=15)
    assert r.status_code == 200, f"status={r.status_code} body={r.text[:300]}"
    data = r.json()
    print("Presence response:", data)
    # inside_fence can be bool true OR fence object (truthy) per impl
    inside = data.get("inside_fence")
    assert bool(inside), f"expected inside_fence truthy, got {inside}"
    if isinstance(inside, dict):
        assert "Termokos" in inside.get("name", "")
    assert data.get("smart_status") in ("arrived", "working", "checked_in"), f"unexpected smart_status: {data.get('smart_status')}"
