"""
Iter 85 — Staff Tasks API + Smoke regression for staff endpoints.
"""
import os
import pytest
import requests
from pathlib import Path

# Load from frontend/.env if not in process env
if "REACT_APP_BACKEND_URL" not in os.environ:
    p = Path("/app/frontend/.env")
    if p.exists():
        for line in p.read_text().splitlines():
            if line.startswith("REACT_APP_BACKEND_URL="):
                os.environ["REACT_APP_BACKEND_URL"] = line.split("=", 1)[1].strip()
                break
BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
MERCHANT = ("haendler@bidblitz.com", "Haendler2026!")
STAFF_EMAIL = "TEST_magic_1778611082@example.com"
STAFF_PASS = "test123"


def _merchant_session():
    s = requests.Session()
    r = s.post(f"{BASE}/api/auth/login",
               json={"email": MERCHANT[0], "password": MERCHANT[1]}, timeout=20)
    assert r.status_code == 200, r.text
    return s


def _staff_session(merch_session):
    # locate staff_id via merchant list
    r = merch_session.get(f"{BASE}/api/staff/members", timeout=20)
    assert r.status_code == 200, r.text
    members = r.json().get("members") or r.json().get("data") or []
    staff = next((m for m in members if m.get("email") == STAFF_EMAIL), None)
    assert staff, f"Staff member {STAFF_EMAIL} not found in {members[:1]}"
    sid = staff["id"]

    s = requests.Session()
    r = s.post(f"{BASE}/api/staff/auth/pin-login",
               json={"email": STAFF_EMAIL, "password": STAFF_PASS}, timeout=20)
    # fallback to alternate endpoints if needed
    if r.status_code != 200:
        r = s.post(f"{BASE}/api/staff/auth/login",
                   json={"email": STAFF_EMAIL, "password": STAFF_PASS}, timeout=20)
    assert r.status_code == 200, f"staff login failed: {r.status_code} {r.text[:200]}"
    return s, sid


@pytest.fixture(scope="module")
def merch():
    return _merchant_session()


@pytest.fixture(scope="module")
def staff(merch):
    return _staff_session(merch)


# ---------- Tasks ----------
class TestStaffTasks:
    def test_create_task_merchant(self, merch, staff):
        _, sid = staff
        r = merch.post(f"{BASE}/api/staff/tasks/create", json={
            "staff_id": sid,
            "title": "TEST_iter85 task",
            "description": "Created by automated test",
            "due_date": "2026-02-01",
        }, timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["success"] is True
        task = body["task"]
        assert task["status"] == "open"
        assert task["title"] == "TEST_iter85 task"
        assert task["staff_id"] == sid
        pytest.created_task_id = task["id"]

    def test_my_tasks_open_contains_created(self, staff):
        ss, _ = staff
        r = ss.get(f"{BASE}/api/staff/tasks/me?status=open", timeout=20)
        assert r.status_code == 200, r.text
        ids = [t["id"] for t in r.json().get("tasks", [])]
        assert pytest.created_task_id in ids

    def test_list_team_tasks(self, merch):
        r = merch.get(f"{BASE}/api/staff/tasks/list?status=all", timeout=20)
        assert r.status_code == 200, r.text
        assert r.json().get("success") is True
        assert isinstance(r.json().get("tasks"), list)

    def test_complete_task(self, staff):
        ss, _ = staff
        r = ss.post(f"{BASE}/api/staff/tasks/{pytest.created_task_id}/complete", timeout=20)
        assert r.status_code == 200, r.text
        # verify open list no longer contains it
        r2 = ss.get(f"{BASE}/api/staff/tasks/me?status=open", timeout=20)
        ids = [t["id"] for t in r2.json().get("tasks", [])]
        assert pytest.created_task_id not in ids
        # verify done list contains it
        r3 = ss.get(f"{BASE}/api/staff/tasks/me?status=done", timeout=20)
        ids_done = [t["id"] for t in r3.json().get("tasks", [])]
        assert pytest.created_task_id in ids_done

    def test_create_task_invalid_staff(self, merch):
        r = merch.post(f"{BASE}/api/staff/tasks/create", json={
            "staff_id": "not-a-real-id-zzz",
            "title": "x",
        }, timeout=20)
        assert r.status_code == 404

    def test_complete_task_unauth(self):
        # No staff cookie
        r = requests.post(f"{BASE}/api/staff/tasks/{pytest.created_task_id}/complete", timeout=20)
        assert r.status_code == 401


# ---------- Smoke regression ----------
class TestStaffSmoke:
    def test_profile_me(self, staff):
        ss, _ = staff
        r = ss.get(f"{BASE}/api/staff/me/profile", timeout=20)
        assert r.status_code == 200
        body = r.json()
        # ensure secrets not leaked
        s = str(body).lower()
        assert "pin_hash" not in s and "password_hash" not in s

    def test_wallet_balance(self, staff):
        ss, _ = staff
        r = ss.get(f"{BASE}/api/staff/wallet/me/balance", timeout=20)
        assert r.status_code == 200
        assert "balance" in r.json() or "total" in r.json() or r.json().get("success") is True

    def test_timesheet_weekly(self, staff):
        ss, _ = staff
        r = ss.get(f"{BASE}/api/staff/timesheet/me/weekly", timeout=20)
        assert r.status_code == 200

    def test_team_overview(self, merch):
        r = merch.get(f"{BASE}/api/staff/timesheet/team-overview", timeout=20)
        assert r.status_code == 200

    def test_clock_self_json(self, staff):
        ss, _ = staff
        # toggle clock state (uses `action` field per backend schema)
        r = ss.post(f"{BASE}/api/staff/clock/self",
                    json={"action": "clock_in", "customer": "TEST_iter85",
                          "project": "TEST_iter85", "note": "regression"},
                    timeout=20)
        # 200 ok OR 400 if already clocked-in — both prove endpoint reachable
        assert r.status_code in (200, 400), f"{r.status_code} {r.text[:200]}"
