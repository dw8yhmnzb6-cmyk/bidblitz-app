"""Iter193 regression: canonical admin auth/profile + admin wallet consistency contracts."""

import os
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
EXPECTED_REGISTERED_AT = "2026-04-19T20:02:00+00:00"
EXPECTED_LAST_LOGIN_AT = "2026-06-27T22:51:00+00:00"
EXPECTED_LOGIN_COUNT = 14


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


def _find_row(users_payload: dict, email: str) -> dict | None:
    target = email.lower().strip()
    for row in users_payload.get("users", []):
        if (row.get("email") or "").lower().strip() == target:
            return row
    return None


# Auth and profile contracts for canonical admin fields
def test_admin_login_sets_http_only_cookie_and_rejects_removed_admin():
    ok = _login(ADMIN_AE_EMAIL, ADMIN_PASSWORD)
    assert ok.status_code == 200, f"{ok.status_code} {ok.text}"
    ok_data = ok.json()
    assert ok_data.get("email") == ADMIN_AE_EMAIL
    assert ok_data.get("role") == "admin"

    set_cookie = ok.headers.get("set-cookie", "")
    assert "access_token=" in set_cookie
    assert "refresh_token=" in set_cookie
    assert "HttpOnly" in set_cookie

    removed = _login(ADMIN_COM_EMAIL, ADMIN_PASSWORD)
    assert removed.status_code == 401, f"expected 401, got {removed.status_code} {removed.text}"


def test_auth_me_returns_exact_canonical_admin_snapshot():
    session = _admin_session()
    me = session.get(f"{_base_url()}/api/auth/me", timeout=30)
    assert me.status_code == 200, f"{me.status_code} {me.text}"
    data = me.json()

    assert data.get("email") == ADMIN_AE_EMAIL
    assert data.get("role") == "admin"
    assert pytest.approx(float(data.get("balance", 0)), abs=0.01) == EXPECTED_BALANCE_EUR
    assert pytest.approx(float(data.get("balance_blz", 0)), abs=0.01) == EXPECTED_BALANCE_BLZ
    assert data.get("registered_at") == EXPECTED_REGISTERED_AT
    assert data.get("last_login_at") == EXPECTED_LAST_LOGIN_AT
    assert int(data.get("login_count", 0)) == EXPECTED_LOGIN_COUNT


def test_repeated_admin_login_does_not_change_last_login_or_login_count():
    before_session = _admin_session()
    before_me = before_session.get(f"{_base_url()}/api/auth/me", timeout=30)
    assert before_me.status_code == 200
    before = before_me.json()

    second = _login(ADMIN_AE_EMAIL, ADMIN_PASSWORD)
    assert second.status_code == 200

    after_session = _admin_session()
    after_me = after_session.get(f"{_base_url()}/api/auth/me", timeout=30)
    assert after_me.status_code == 200
    after = after_me.json()

    assert before.get("last_login_at") == EXPECTED_LAST_LOGIN_AT
    assert after.get("last_login_at") == EXPECTED_LAST_LOGIN_AT
    assert int(before.get("login_count", 0)) == EXPECTED_LOGIN_COUNT
    assert int(after.get("login_count", 0)) == EXPECTED_LOGIN_COUNT


# Admin wallet search consistency and stale/conflicting-admin guardrail
def test_admin_wallet_search_matches_exact_canonical_values():
    session = _admin_session()
    r = session.get(
        f"{_base_url()}/api/admin/wallet/users",
        params={"q": ADMIN_AE_EMAIL},
        timeout=30,
    )
    assert r.status_code == 200, f"{r.status_code} {r.text}"
    payload = r.json()

    row = _find_row(payload, ADMIN_AE_EMAIL)
    assert row is not None, f"canonical admin row missing from payload: {payload}"
    assert row.get("role") == "admin"
    assert pytest.approx(float(row.get("balance_eur", 0)), abs=0.01) == EXPECTED_BALANCE_EUR
    assert pytest.approx(float(row.get("balance_blz", 0)), abs=0.01) == EXPECTED_BALANCE_BLZ
    assert row.get("registered_at") == EXPECTED_REGISTERED_AT
    assert row.get("last_login_at") == EXPECTED_LAST_LOGIN_AT
    assert int(row.get("login_count", 0)) == EXPECTED_LOGIN_COUNT


def test_no_second_active_admin_in_admin_bidblitz_search_results():
    session = _admin_session()
    r = session.get(
        f"{_base_url()}/api/admin/wallet/users",
        params={"q": "admin@bidblitz"},
        timeout=30,
    )
    assert r.status_code == 200, f"{r.status_code} {r.text}"
    payload = r.json()
    users = payload.get("users") or []

    active_admins = [u for u in users if (u.get("role") or "").lower() == "admin"]
    assert len(active_admins) == 1, f"expected one active admin, got: {active_admins}"
    assert (active_admins[0].get("email") or "").lower() == ADMIN_AE_EMAIL


# Auth playbook hardening checks: bcrypt/cookies/CORS/lockout/seed behavior
def test_bcrypt_hash_format_starts_with_2b_prefix():
    hashed = bcrypt.hashpw(b"TestPass2026!", bcrypt.gensalt()).decode("utf-8")
    assert hashed.startswith("$2b$"), f"unexpected bcrypt prefix: {hashed[:4]}"


def test_auth_login_bruteforce_lockout_after_five_fails_then_429():
    unique_email = f"iter193.lockout.{os.getpid()}@test.com"
    statuses = []
    for _ in range(6):
        r = requests.post(
            f"{_base_url()}/api/auth/login",
            json={"email": unique_email, "password": "WrongPass!"},
            timeout=30,
        )
        statuses.append(r.status_code)

    assert statuses[:5] == [401, 401, 401, 401, 401], f"unexpected first 5 statuses: {statuses}"
    assert statuses[5] == 429, f"expected 429 on sixth attempt, got {statuses[5]}"


def test_auth_preflight_cors_credentials_explicit_origin_or_skip_preview_edge_behavior():
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


def test_seed_admin_code_path_refreshes_password_hash_when_changed():
    server_source = Path("/app/backend/server.py").read_text(encoding="utf-8")
    assert "async def seed_admin" in server_source
    assert "verify_password(ADMIN_PASSWORD, password_hash)" in server_source
    assert "updates[\"password_hash\"] = hash_password(ADMIN_PASSWORD)" in server_source
