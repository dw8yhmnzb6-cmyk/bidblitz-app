"""Iter194 regression: admin live analytics canonical email/balance display and auth guardrails."""

import os
import time
from pathlib import Path
from urllib.parse import urlparse

import bcrypt
import pytest
import requests


BASE_URL = os.environ.get("REACT_APP_BACKEND_URL")
ADMIN_AE_EMAIL = "admin@bidblitz.ae"
ADMIN_COM_EMAIL = "admin@bidblitz.com"
ADMIN_PASSWORD = "BidBlitz2026!"

EXPECTED_BALANCE_EUR = 63366525.91
EXPECTED_BALANCE_BLZ = 91.0
EXPECTED_LOGIN_COUNT = 14
EXPECTED_LAST_LOGIN_AT = "2026-06-27T22:51:00+00:00"


def _base_url() -> str:
    if not BASE_URL:
        pytest.skip("REACT_APP_BACKEND_URL is required for public endpoint tests")
    return BASE_URL.rstrip("/")


def _login(email: str, password: str) -> requests.Response:
    return requests.post(
        f"{_base_url()}/api/auth/login",
        json={"email": email, "password": password, "remember_me": True},
        timeout=30,
    )


def _admin_session() -> requests.Session:
    session = requests.Session()
    res = session.post(
        f"{_base_url()}/api/auth/login",
        json={"email": ADMIN_AE_EMAIL, "password": ADMIN_PASSWORD, "remember_me": True},
        timeout=30,
    )
    assert res.status_code == 200, f"admin login failed: {res.status_code} {res.text}"
    return session


# Requested bug regressions: canonical admin snapshot and disabled old admin login
def test_auth_login_canonical_admin_and_removed_admin_rejected():
    ok = _login(ADMIN_AE_EMAIL, ADMIN_PASSWORD)
    assert ok.status_code == 200, f"{ok.status_code} {ok.text}"
    payload = ok.json()
    assert payload.get("email") == ADMIN_AE_EMAIL
    assert payload.get("role") == "admin"

    set_cookie = ok.headers.get("set-cookie", "")
    assert "access_token=" in set_cookie
    assert "refresh_token=" in set_cookie
    assert "HttpOnly" in set_cookie

    removed = _login(ADMIN_COM_EMAIL, ADMIN_PASSWORD)
    assert removed.status_code == 401, f"expected 401, got {removed.status_code} {removed.text}"


def test_auth_me_exact_admin_snapshot_contract():
    session = _admin_session()
    me = session.get(f"{_base_url()}/api/auth/me", timeout=30)
    assert me.status_code == 200, f"{me.status_code} {me.text}"
    data = me.json()

    assert data.get("email") == ADMIN_AE_EMAIL
    assert pytest.approx(float(data.get("balance", 0)), abs=0.01) == EXPECTED_BALANCE_EUR
    assert pytest.approx(float(data.get("balance_blz", 0)), abs=0.01) == EXPECTED_BALANCE_BLZ
    assert int(data.get("login_count", 0)) == EXPECTED_LOGIN_COUNT
    assert data.get("last_login_at") == EXPECTED_LAST_LOGIN_AT


# Requested bug regressions: analytics online + last-seen must canonicalize admin
def test_admin_analytics_online_canonicalizes_admin_identity_and_wallet():
    session = _admin_session()
    # Touch /me so last_seen updates and admin appears in /analytics/online
    session.get(f"{_base_url()}/api/auth/me", timeout=30)
    time.sleep(1.2)

    r = session.get(f"{_base_url()}/api/admin/analytics/online", params={"minutes": 5}, timeout=30)
    assert r.status_code == 200, f"{r.status_code} {r.text}"
    payload = r.json()
    users = payload.get("online_users") or []

    assert not any((u.get("email") or "").lower() == ADMIN_COM_EMAIL for u in users)
    canonical_admins = [u for u in users if (u.get("role") == "admin" and (u.get("email") or "").lower() == ADMIN_AE_EMAIL)]
    assert canonical_admins, f"canonical admin missing in online_users: {users}"

    admin_row = canonical_admins[0]
    assert pytest.approx(float(admin_row.get("balance_eur", 0)), abs=0.01) == EXPECTED_BALANCE_EUR
    assert pytest.approx(float(admin_row.get("balance_blz", 0)), abs=0.01) == EXPECTED_BALANCE_BLZ
    assert not (
        pytest.approx(float(admin_row.get("balance_eur", 0)), abs=0.01) == 1453.50
        and pytest.approx(float(admin_row.get("balance_blz", 0)), abs=0.01) == 81.0
    )


def test_admin_analytics_last_seen_shows_canonical_admin_email_only():
    session = _admin_session()
    session.get(f"{_base_url()}/api/auth/me", timeout=30)
    time.sleep(1.2)

    r = session.get(f"{_base_url()}/api/admin/analytics/last-seen", params={"limit": 5}, timeout=30)
    assert r.status_code == 200, f"{r.status_code} {r.text}"
    payload = r.json()
    users = payload.get("users") or []

    assert not any((u.get("email") or "").lower() == ADMIN_COM_EMAIL for u in users)
    assert any((u.get("email") or "").lower() == ADMIN_AE_EMAIL for u in users), users


# Playbook checks requested in auth testing notes
def test_playbook_bcrypt_hash_prefix_2b():
    hashed = bcrypt.hashpw(b"TestPass2026!", bcrypt.gensalt()).decode("utf-8")
    assert hashed.startswith("$2b$"), f"unexpected bcrypt prefix: {hashed[:4]}"


def test_playbook_auth_bruteforce_lockout_after_five_fails_then_429():
    unique_email = f"iter194.lockout.{os.getpid()}@test.com"
    statuses = []
    for _ in range(6):
        resp = requests.post(
            f"{_base_url()}/api/auth/login",
            json={"email": unique_email, "password": "WrongPass!"},
            timeout=30,
        )
        statuses.append(resp.status_code)

    assert statuses[:5] == [401, 401, 401, 401, 401], f"unexpected first 5 statuses: {statuses}"
    assert statuses[5] == 429, f"expected 429 on sixth attempt, got {statuses[5]}"


def test_playbook_auth_preflight_cors_explicit_origin_or_skip_preview_ingress_behavior():
    parsed = urlparse(_base_url())
    origin = f"{parsed.scheme}://{parsed.netloc}"

    r = requests.options(
        f"{_base_url()}/api/auth/login",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
        timeout=30,
    )
    assert r.status_code in (200, 204), f"unexpected preflight status: {r.status_code}"
    allow_origin = r.headers.get("access-control-allow-origin")
    if allow_origin == "*":
        pytest.skip("preview ingress wildcard preflight behavior observed")
    assert allow_origin == origin
    assert r.headers.get("access-control-allow-credentials") == "true"


def test_playbook_seed_admin_code_path_refreshes_password_hash_when_changed():
    server_source = Path("/app/backend/server.py").read_text(encoding="utf-8")
    assert "async def seed_admin" in server_source
    assert "verify_password(ADMIN_PASSWORD, password_hash)" in server_source
    assert "updates[\"password_hash\"] = hash_password(ADMIN_PASSWORD)" in server_source
