"""
Iter120 — Staff Offline Sync Queue backend tests
Validates: /api/staff/clock/sync (idempotent batch sync) + /api/staff/clock/sync/status + auth guard.
"""
import os
import uuid
import pytest
import requests
from datetime import datetime, timezone

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://super-app-portal.preview.emergentagent.com").rstrip("/")

STAFF_EMAIL = "TEST_magic_1778611082@example.com"
STAFF_PASSWORD = "test123"


@pytest.fixture(scope="module")
def staff_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/staff/auth/login", json={"email": STAFF_EMAIL, "password": STAFF_PASSWORD}, timeout=20)
    if r.status_code != 200:
        # try alt account
        r = s.post(f"{BASE_URL}/api/staff/auth/login", json={"email": "mitarbeiter@bidblitz.com", "password": "test123"}, timeout=20)
    assert r.status_code == 200, f"Staff login failed: {r.status_code} {r.text}"
    data = r.json()
    assert data.get("success") is True
    assert "staff" in data
    return s


def _make_event(action="clock_in"):
    return {
        "client_event_id": str(uuid.uuid4()),
        "action": action,
        "captured_at": datetime.now(timezone.utc).isoformat(),
        "lat": 42.6629,
        "lng": 21.1655,
        "accuracy_m": 12.4,
        "source": "offline_sync",
        "device_type": "pytest",
        "platform": "linux",
        "app_version": "iter120",
    }


# ─── Auth guard ─────────────────────────────────────────────────────────
def test_sync_requires_auth():
    """POST /api/staff/clock/sync without session must return 401/403"""
    r = requests.post(f"{BASE_URL}/api/staff/clock/sync", json={"events": [_make_event()]}, timeout=15)
    assert r.status_code in (401, 403), f"Expected 401/403, got {r.status_code} {r.text[:200]}"


def test_status_requires_auth():
    r = requests.get(f"{BASE_URL}/api/staff/clock/sync/status", timeout=15)
    assert r.status_code in (401, 403)


# ─── Happy path ─────────────────────────────────────────────────────────
@pytest.fixture(scope="module")
def batch_events():
    return [_make_event("clock_in"), _make_event("break_start"), _make_event("clock_out")]


def test_sync_batch_three_unique_events(staff_session, batch_events):
    """3 unique events → synced=3, duplicates=0"""
    r = staff_session.post(f"{BASE_URL}/api/staff/clock/sync", json={"events": batch_events}, timeout=20)
    assert r.status_code == 200, f"Sync failed: {r.status_code} {r.text[:300]}"
    data = r.json()
    assert data["success"] is True
    assert data["synced"] == 3, f"synced expected 3, got {data['synced']}"
    assert data["duplicates"] == 0
    assert data["total"] == 3
    # results array shape check
    assert len(data["results"]) == 3
    for entry in data["results"]:
        assert entry["status"] == "synced"
        assert "id" in entry
        assert "client_event_id" in entry


def test_sync_idempotent_resync_same_batch(staff_session, batch_events):
    """Resync same batch → synced=0, duplicates=3"""
    r = staff_session.post(f"{BASE_URL}/api/staff/clock/sync", json={"events": batch_events}, timeout=20)
    assert r.status_code == 200
    data = r.json()
    assert data["synced"] == 0, f"Re-sync should yield synced=0, got {data}"
    assert data["duplicates"] == 3
    assert data["total"] == 3
    for entry in data["results"]:
        assert entry["status"] == "duplicate"


def test_sync_status_endpoint(staff_session):
    """GET status returns last_sync_at + total_synced + offline_events_persisted"""
    r = staff_session.get(f"{BASE_URL}/api/staff/clock/sync/status", timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert "last_sync_at" in data
    assert "total_synced" in data
    assert "offline_events_persisted" in data
    assert "server_time" in data
    assert data["total_synced"] >= 3, f"Expected >=3 total_synced, got {data['total_synced']}"
    assert data["offline_events_persisted"] >= 3
    # last_sync_at must be ISO-parseable
    last = data["last_sync_at"]
    assert last and "T" in last


def test_sync_partial_dedup_mixed_batch(staff_session, batch_events):
    """Mix of 2 already-synced + 1 new → synced=1, duplicates=2"""
    new_ev = _make_event("clock_in")
    mixed = [batch_events[0], batch_events[1], new_ev]
    r = staff_session.post(f"{BASE_URL}/api/staff/clock/sync", json={"events": mixed}, timeout=20)
    assert r.status_code == 200
    data = r.json()
    assert data["synced"] == 1
    assert data["duplicates"] == 2
    assert data["total"] == 3


def test_sync_validation_rejects_empty(staff_session):
    """Empty events array → 422 (Pydantic min_items=1)"""
    r = staff_session.post(f"{BASE_URL}/api/staff/clock/sync", json={"events": []}, timeout=15)
    assert r.status_code in (400, 422)


def test_sync_validation_rejects_bad_action(staff_session):
    """Invalid action → 422 (Literal restriction)"""
    bad = _make_event("clock_in")
    bad["action"] = "teleport"
    r = staff_session.post(f"{BASE_URL}/api/staff/clock/sync", json={"events": [bad]}, timeout=15)
    assert r.status_code in (400, 422)
