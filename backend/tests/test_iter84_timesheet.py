"""
Iter 84: Staff Timesheet (Connecteam-Style) + Check-in Attachments
Tests:
  - POST /api/staff/clock/self with JSON body + attachments
  - GET /api/staff/timesheet/me/weekly
  - GET /api/staff/timesheet/me/day
  - GET /api/staff/timesheet/me/month
  - GET /api/staff/timesheet/team-overview
  - GET /api/staff/timesheet/team-overview.csv
  - GET /api/staff/timesheet/manager/day-detail
Security: password_hash MUST NOT leak.
"""
import os
import pytest
import requests
from datetime import datetime, timezone

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://blitz-dispatch.preview.emergentagent.com").rstrip("/")

MERCHANT_EMAIL = "haendler@bidblitz.com"
MERCHANT_PW = "Haendler2026!"
STAFF_EMAIL = "TEST_magic_1778611082@example.com"
STAFF_PW = "test123"


@pytest.fixture(scope="module")
def merchant_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": MERCHANT_EMAIL, "password": MERCHANT_PW}, timeout=15)
    assert r.status_code == 200, f"Merchant login failed: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="module")
def staff_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/staff/auth/login", json={"email": STAFF_EMAIL, "password": STAFF_PW}, timeout=15)
    assert r.status_code == 200, f"Staff login failed: {r.status_code} {r.text}"
    assert "staff_session" in s.cookies, "staff_session cookie missing"
    return s


# ─── Self Clock with Attachments ──────────────────────────────────────────
class TestClockSelfAttachments:
    def test_clock_in_with_attachments(self, staff_session):
        payload = {
            "action": "clock_in",
            "customer": "TEST_Kunde_A",
            "project": "TEST_Projekt_X",
            "equipment": "Bagger 123",
            "kilometers": 12.5,
            "note": "iter84 test",
            "lat": 52.52,
            "lng": 13.40,
        }
        r = staff_session.post(f"{BASE_URL}/api/staff/clock/self", json=payload, timeout=15)
        assert r.status_code == 200, f"clock_in failed: {r.status_code} {r.text}"
        data = r.json()
        assert data.get("success") is True
        ev = data.get("event") or {}
        assert ev.get("action") == "clock_in"
        assert ev.get("customer") == "TEST_Kunde_A"
        assert ev.get("project") == "TEST_Projekt_X"
        assert ev.get("equipment") == "Bagger 123"
        assert ev.get("kilometers") == 12.5
        assert ev.get("note") == "iter84 test"
        assert "id" in ev

    def test_clock_out_minimal(self, staff_session):
        r = staff_session.post(f"{BASE_URL}/api/staff/clock/self", json={"action": "clock_out"}, timeout=15)
        assert r.status_code == 200, f"clock_out failed: {r.text}"
        assert r.json().get("event", {}).get("action") == "clock_out"

    def test_clock_self_requires_action(self, staff_session):
        r = staff_session.post(f"{BASE_URL}/api/staff/clock/self", json={}, timeout=15)
        assert r.status_code in (400, 422), f"missing action should fail, got {r.status_code}"


# ─── Staff Weekly / Day / Month ──────────────────────────────────────────
class TestStaffOwnTimesheet:
    def test_my_weekly(self, staff_session):
        r = staff_session.get(f"{BASE_URL}/api/staff/timesheet/me/weekly?weeks_back=0", timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("success") is True
        assert "week_start" in d and "week_end" in d
        days = d.get("days") or []
        assert len(days) == 7, f"expected 7 days, got {len(days)}"
        sample = days[0]
        for k in ("date", "weekday", "regular_hours", "overtime_hours", "break_hours", "total_hours", "absence"):
            assert k in sample, f"missing key {k}"
        totals = d.get("totals") or {}
        for k in ("regular_hours", "overtime_hours", "break_hours", "total_hours", "absence_days"):
            assert k in totals

    def test_my_day(self, staff_session):
        today = datetime.now(timezone.utc).date().isoformat()
        r = staff_session.get(f"{BASE_URL}/api/staff/timesheet/me/day?date={today}", timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("success") is True
        assert d.get("date") == today
        assert isinstance(d.get("events"), list)
        # we just inserted clock_in/out → should be ≥2
        assert len(d["events"]) >= 2
        # attachments visible
        any_with_customer = any(e.get("customer") == "TEST_Kunde_A" for e in d["events"])
        assert any_with_customer, "attachment customer not visible in day events"
        summary = d.get("summary") or {}
        for k in ("total_hours", "regular_hours", "overtime_hours", "break_hours"):
            assert k in summary

    def test_my_day_invalid_date(self, staff_session):
        r = staff_session.get(f"{BASE_URL}/api/staff/timesheet/me/day?date=not-a-date", timeout=15)
        assert r.status_code == 400

    def test_my_month(self, staff_session):
        month = datetime.now(timezone.utc).strftime("%Y-%m")
        r = staff_session.get(f"{BASE_URL}/api/staff/timesheet/me/month?month={month}", timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("success") is True
        assert d.get("month") == month
        days = d.get("days") or []
        assert 28 <= len(days) <= 31

    def test_my_weekly_requires_session(self):
        r = requests.get(f"{BASE_URL}/api/staff/timesheet/me/weekly", timeout=15)
        assert r.status_code == 401


# ─── Manager Team Overview ──────────────────────────────────────────────
class TestTeamOverview:
    def test_team_overview(self, merchant_session):
        r = merchant_session.get(f"{BASE_URL}/api/staff/timesheet/team-overview?days=7", timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("success") is True
        rows = d.get("rows") or []
        assert isinstance(rows, list)
        totals = d.get("totals") or {}
        for k in ("work_hours", "break_hours", "regular_hours", "overtime_hours", "absence_days", "active_staff"):
            assert k in totals
        # security check: no password_hash, no pin_hash
        body = r.text
        assert "password_hash" not in body, "password_hash leaked in team-overview!"
        assert "pin_hash" not in body, "pin_hash leaked in team-overview!"
        if rows:
            row = rows[0]
            for k in ("staff_id", "name", "regular_hours", "overtime_hours", "break_hours",
                     "total_hours", "absence_days", "cost_eur", "hourly_rate"):
                assert k in row, f"row missing {k}"

    def test_team_overview_csv(self, merchant_session):
        r = merchant_session.get(f"{BASE_URL}/api/staff/timesheet/team-overview.csv?days=7", timeout=20)
        assert r.status_code == 200, r.text
        ct = r.headers.get("content-type", "")
        assert "csv" in ct.lower(), f"expected csv content-type, got {ct}"
        # header line
        first_line = r.text.split("\n")[0]
        for h in ("Name", "Regulär", "Überstunden", "Gesamt", "Kosten"):
            assert h in first_line, f"CSV header missing {h}: {first_line}"
        assert "password_hash" not in r.text

    def test_team_overview_requires_merchant(self):
        r = requests.get(f"{BASE_URL}/api/staff/timesheet/team-overview", timeout=15)
        assert r.status_code in (401, 403)

    def test_team_overview_blocked_for_staff(self, staff_session):
        # staff_session cookie should NOT grant access to merchant endpoint
        r = staff_session.get(f"{BASE_URL}/api/staff/timesheet/team-overview", timeout=15)
        assert r.status_code in (401, 403), f"staff should not access team-overview, got {r.status_code}"


# ─── Manager Day-Detail ─────────────────────────────────────────────────
class TestManagerDayDetail:
    def test_manager_day_detail(self, merchant_session):
        # Find a staff member
        r = merchant_session.get(f"{BASE_URL}/api/staff/members", timeout=15)
        assert r.status_code == 200
        members = r.json().get("members") or []
        if not members:
            pytest.skip("no staff members for merchant")
        sid = members[0]["id"]
        today = datetime.now(timezone.utc).date().isoformat()
        r2 = merchant_session.get(
            f"{BASE_URL}/api/staff/timesheet/manager/day-detail",
            params={"staff_id": sid, "date": today}, timeout=15,
        )
        assert r2.status_code == 200, r2.text
        d = r2.json()
        assert d.get("success") is True
        assert d.get("date") == today
        assert isinstance(d.get("events"), list)
        member = d.get("member") or {}
        assert "password_hash" not in member, "password_hash leaked in manager/day-detail member!"
        assert "pin_hash" not in member
        assert "password_hash" not in r2.text

    def test_manager_day_detail_unknown_staff(self, merchant_session):
        today = datetime.now(timezone.utc).date().isoformat()
        r = merchant_session.get(
            f"{BASE_URL}/api/staff/timesheet/manager/day-detail",
            params={"staff_id": "does-not-exist", "date": today}, timeout=15,
        )
        assert r.status_code == 404
