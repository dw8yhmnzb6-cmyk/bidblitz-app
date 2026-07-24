"""
BidBlitz Staff Phase 2 - Backend tests
Covers: Industry Templates, Roles, GPS Locations + Geofence, Warnings,
Reports + Exports (CSV/DATEV), Magic Link, Invite Flow, Profile/Mobile/PIN,
Admin SaaS Metrics.
"""
import os
import time
import pytest
import requests
from datetime import datetime, timedelta, timezone

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
MERCHANT = {"email": "haendler@bidblitz.com", "password": "Haendler2026!"}
ADMIN = {"email": "admin@bidblitz.com", "password": "BidBlitz2026!"}


def _login(creds):
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=20)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    return s, r.json()


# Shared mutable state across the suite
STATE: dict = {}


@pytest.fixture(scope="module")
def merchant_session():
    s, _ = _login(MERCHANT)
    me = s.get(f"{BASE_URL}/api/auth/me", timeout=10).json()
    user = me.get("user") or me
    mid = user.get("id") or user.get("user_id") or user.get("_id")
    return s, mid


@pytest.fixture(scope="module")
def admin_session():
    s, _ = _login(ADMIN)
    return s


# -------------------- Subscription / Trial bootstrap --------------------
def test_00_ensure_trial(merchant_session, admin_session):
    s, mid = merchant_session
    a = admin_session
    # try start trial; if already used, force trialing via admin override
    s.post(f"{BASE_URL}/api/staff/subscription/start-trial", timeout=10)
    a.post(f"{BASE_URL}/api/staff/subscription/admin/override",
           json={"merchant_id": mid, "plan": "pro", "status": "trialing",
                 "extend_trial_days": 30, "max_staff_override": 50}, timeout=10)
    r = s.get(f"{BASE_URL}/api/staff/subscription/status", timeout=10)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("status") in ("trialing", "active"), data


# -------------------- 1. Industry Templates --------------------
def test_01_templates_list():
    r = requests.get(f"{BASE_URL}/api/staff/templates/list", timeout=10)
    assert r.status_code == 200
    ids = {t["id"] for t in r.json()["templates"]}
    expected = {"gastronomy", "ice_cafe", "retail", "hairdresser", "construction", "cleaning", "delivery"}
    assert expected <= ids, f"Missing templates: {expected - ids}"


def test_02_templates_apply(merchant_session):
    s, _ = merchant_session
    r = s.post(f"{BASE_URL}/api/staff/templates/apply", json={"template_id": "gastronomy"}, timeout=10)
    assert r.status_code == 200, r.text
    assert r.json()["applied"] == "gastronomy"


def test_03_templates_active(merchant_session):
    s, _ = merchant_session
    r = s.get(f"{BASE_URL}/api/staff/templates/active", timeout=10)
    assert r.status_code == 200, r.text
    assert r.json()["active_template"] == "gastronomy"


# -------------------- 2. Roles & Permissions --------------------
def test_04_roles_list():
    r = requests.get(f"{BASE_URL}/api/staff/roles/list", timeout=10)
    assert r.status_code == 200
    ids = {x["id"] for x in r.json()["roles"]}
    assert {"owner", "manager", "shift_lead", "employee", "helper"} <= ids


# -------------------- 3. Locations + Geofence --------------------
def test_05_locations_create_list_patch(merchant_session):
    s, _ = merchant_session
    r = s.post(f"{BASE_URL}/api/staff/locations/create",
               json={"name": "TEST_HQ", "lat": 52.5200, "lng": 13.4050, "radius_m": 80}, timeout=10)
    assert r.status_code == 200, r.text
    loc = r.json()["location"]
    STATE["location_id"] = loc["id"]
    # list
    r2 = s.get(f"{BASE_URL}/api/staff/locations/list", timeout=10)
    assert r2.status_code == 200
    assert any(l["id"] == loc["id"] for l in r2.json()["locations"])
    # patch radius
    r3 = s.patch(f"{BASE_URL}/api/staff/locations/{loc['id']}", json={"radius_m": 150}, timeout=10)
    assert r3.status_code == 200
    assert r3.json()["location"]["radius_m"] == 150


# -------------------- 4. Create Member + Invite Flow --------------------
def test_06_invite_create_preview_accept(merchant_session):
    s, _ = merchant_session
    email = f"TEST_invite_{int(time.time())}@example.com"
    STATE["invite_email"] = email
    r = s.post(f"{BASE_URL}/api/staff/invites/create",
               json={"email": email, "name": "TEST Invitee", "role": "employee"}, timeout=10)
    assert r.status_code == 200, r.text
    inv = r.json()["invite"]
    assert inv["status"] == "pending"
    assert "token" in inv and "invite_url" in inv
    STATE["invite_token"] = inv["token"]
    STATE["invite_id"] = inv["id"]
    # preview - public, no auth
    r2 = requests.get(f"{BASE_URL}/api/staff/invites/preview/{inv['token']}", timeout=10)
    assert r2.status_code == 200, r2.text
    assert r2.json()["invite"]["email"] == email
    # accept
    r3 = requests.post(f"{BASE_URL}/api/staff/invites/accept",
                       json={"token": inv["token"], "name": "TEST Accepted", "pin": "1234"}, timeout=10)
    assert r3.status_code == 200, r3.text
    member = r3.json()["member"]
    STATE["staff_id"] = member["id"]
    # status should be accepted now
    r4 = s.get(f"{BASE_URL}/api/staff/invites/list?status=accepted", timeout=10)
    assert any(i["id"] == STATE["invite_id"] for i in r4.json().get("invites", []))


def test_07_roles_assign(merchant_session):
    s, _ = merchant_session
    sid = STATE["staff_id"]
    r = s.post(f"{BASE_URL}/api/staff/roles/assign", json={"staff_id": sid, "role": "shift_lead"}, timeout=10)
    assert r.status_code == 200, r.text
    assert r.json()["role"] == "shift_lead"


# -------------------- 5. Geofence Out-of-Range Warning via /clock --------------------
def test_08_clock_geofence_out_of_range(merchant_session):
    s, _ = merchant_session
    # Clock at far-away coordinates -> gps_out_of_range warning expected
    r = s.post(f"{BASE_URL}/api/staff/clock",
               json={"staff_id": STATE["staff_id"], "action": "clock_in",
                     "lat": 48.1351, "lng": 11.5820,  # Munich, far from Berlin
                     "device_type": "mobile", "browser": "test", "platform": "ios", "app_version": "1.0"},
               timeout=15)
    assert r.status_code in (200, 201), r.text
    # List warnings
    time.sleep(0.5)
    r2 = s.get(f"{BASE_URL}/api/staff/warnings/list?resolved=false", timeout=10)
    assert r2.status_code == 200
    types = {w["type"] for w in r2.json()["warnings"]}
    assert "gps_out_of_range" in types, f"Expected gps_out_of_range warning, got types: {types}"


# -------------------- 6. Warnings scan + resolve --------------------
def test_09_warnings_scan_and_resolve(merchant_session):
    s, _ = merchant_session
    # Trigger a duplicate clock_in within 5 minutes
    s.post(f"{BASE_URL}/api/staff/clock",
           json={"staff_id": STATE["staff_id"], "action": "clock_in",
                 "lat": 52.5200, "lng": 13.4050, "device_type": "mobile"}, timeout=10)
    s.post(f"{BASE_URL}/api/staff/clock",
           json={"staff_id": STATE["staff_id"], "action": "clock_in",
                 "lat": 52.5200, "lng": 13.4050, "device_type": "mobile"}, timeout=10)
    r = s.post(f"{BASE_URL}/api/staff/warnings/scan", timeout=15)
    assert r.status_code == 200, r.text
    # List
    r2 = s.get(f"{BASE_URL}/api/staff/warnings/list?resolved=false&limit=200", timeout=10)
    items = r2.json().get("warnings", [])
    assert len(items) >= 1
    # Resolve first
    wid = items[0]["id"]
    r3 = s.post(f"{BASE_URL}/api/staff/warnings/{wid}/resolve", timeout=10)
    assert r3.status_code == 200
    STATE["resolved_warning_id"] = wid


# -------------------- 7. Reports --------------------
def test_10_reports_daily_weekly_monthly(merchant_session):
    s, _ = merchant_session
    for period in ("daily", "weekly", "monthly"):
        r = s.get(f"{BASE_URL}/api/staff/reports/{period}", timeout=15)
        assert r.status_code == 200, f"{period}: {r.status_code} {r.text}"
        body = r.json()
        assert body.get("success") is True
        # Expect total_hours and total_cost (or similar) keys
        assert "total_hours" in body or "rows" in body or "items" in body or "data" in body, body


def test_11_reports_by_location_and_warnings(merchant_session):
    s, _ = merchant_session
    r = s.get(f"{BASE_URL}/api/staff/reports/by-location", timeout=10)
    assert r.status_code == 200
    r2 = s.get(f"{BASE_URL}/api/staff/reports/warnings", timeout=10)
    assert r2.status_code == 200


def test_12_reports_export_csv(merchant_session):
    s, _ = merchant_session
    r = s.get(f"{BASE_URL}/api/staff/reports/export/csv?period=monthly", timeout=15)
    assert r.status_code == 200, r.text
    assert "Content-Disposition" in r.headers
    assert "attachment" in r.headers["Content-Disposition"].lower()
    assert r.text.count(";") > 0 or r.text.count(",") > 0


def test_13_reports_export_datev(merchant_session):
    s, _ = merchant_session
    r = s.get(f"{BASE_URL}/api/staff/reports/export/datev?period=monthly", timeout=15)
    assert r.status_code == 200, r.text
    assert "Content-Disposition" in r.headers


# -------------------- 8. Magic Link --------------------
def test_14_magic_link_unknown_user_anti_enum():
    r = requests.post(f"{BASE_URL}/api/staff/auth/magic-link",
                      json={"email": "nope_unknown_xyz@example.com"}, timeout=10)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("sent") is False


def test_15_magic_link_known_user_returns_url():
    # accepted invite created a member with the invite email
    email = STATE["invite_email"]
    r = requests.post(f"{BASE_URL}/api/staff/auth/magic-link", json={"email": email}, timeout=10)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("sent") is True
    assert "magic_url" in body
    # extract token
    token = body["magic_url"].split("token=")[-1]
    STATE["magic_token"] = token


def test_16_magic_verify_sets_cookie():
    sess = requests.Session()
    r = sess.get(f"{BASE_URL}/api/staff/auth/verify-token",
                 params={"token": STATE["magic_token"]}, timeout=10, allow_redirects=False)
    assert r.status_code == 200, r.text
    cookies = sess.cookies.get_dict()
    assert "staff_session" in cookies, f"No staff_session cookie set: {cookies}"
    STATE["staff_session_cookie"] = cookies["staff_session"]
    STATE["staff_session_obj"] = sess


def test_17_magic_token_reused_401():
    r = requests.get(f"{BASE_URL}/api/staff/auth/verify-token",
                     params={"token": STATE["magic_token"]}, timeout=10)
    assert r.status_code == 401, r.text


# -------------------- 9. Me / Profile / Dashboard / PIN --------------------
def test_18_me_profile_get_update():
    sess = STATE["staff_session_obj"]
    r = sess.get(f"{BASE_URL}/api/staff/me/profile", timeout=10)
    assert r.status_code == 200, r.text
    assert r.json()["profile"]["id"] == STATE["staff_id"]
    # update
    r2 = sess.patch(f"{BASE_URL}/api/staff/me/profile",
                    json={"language": "sq", "phone": "+49123456", "notifications_enabled": True}, timeout=10)
    assert r2.status_code == 200, r2.text
    assert r2.json()["profile"]["language"] == "sq"


def test_19_me_change_pin():
    sess = STATE["staff_session_obj"]
    # invite was accepted with pin=1234
    r = sess.post(f"{BASE_URL}/api/staff/me/change-pin",
                  json={"current_pin": "1234", "new_pin": "987654"}, timeout=10)
    assert r.status_code == 200, r.text
    # wrong current
    r2 = sess.post(f"{BASE_URL}/api/staff/me/change-pin",
                   json={"current_pin": "0000", "new_pin": "5555"}, timeout=10)
    assert r2.status_code == 401, r2.text
    # invalid format
    r3 = sess.post(f"{BASE_URL}/api/staff/me/change-pin",
                   json={"current_pin": "987654", "new_pin": "abc"}, timeout=10)
    assert r3.status_code == 400


def test_20_me_dashboard():
    sess = STATE["staff_session_obj"]
    r = sess.get(f"{BASE_URL}/api/staff/me/dashboard", timeout=10)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] in ("working", "break", "off")
    assert "today_hours" in body and "week_hours" in body
    assert "vacation_remaining" in body


# -------------------- 10. Admin SaaS metrics --------------------
def test_21_metrics_overview(admin_session):
    a = admin_session
    r = a.get(f"{BASE_URL}/api/staff/metrics/overview", timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    assert "subscriptions" in body
    assert "mrr_eur_placeholder" in body
    assert "churn_at_risk_count" in body


def test_22_metrics_by_plan(admin_session):
    a = admin_session
    r = a.get(f"{BASE_URL}/api/staff/metrics/by-plan", timeout=10)
    assert r.status_code == 200, r.text
    assert "rows" in r.json()


# -------------------- 11. Cleanup --------------------
def test_99_cleanup(merchant_session):
    s, _ = merchant_session
    if STATE.get("location_id"):
        r = s.delete(f"{BASE_URL}/api/staff/locations/{STATE['location_id']}", timeout=10)
        assert r.status_code in (200, 204, 404)
    if STATE.get("staff_id"):
        s.delete(f"{BASE_URL}/api/staff/members/{STATE['staff_id']}", timeout=10)
