"""
Iter190 admin wallet consistency regression:
- canonical admin login/auth contract
- /api/auth/me and /api/admin/wallet/users consistency
- BLZ self-topup persistence + restore
"""

import os
import pytest
import requests


BASE_URL = os.environ.get("REACT_APP_BACKEND_URL")
ADMIN_AE_EMAIL = "admin@bidblitz.ae"
ADMIN_COM_EMAIL = "admin@bidblitz.com"
ADMIN_PASSWORD = "BidBlitz2026!"


@pytest.fixture(scope="module")
def base_url():
    if not BASE_URL:
        pytest.skip("REACT_APP_BACKEND_URL is not set")
    return BASE_URL.rstrip("/")


@pytest.fixture(scope="module")
def admin_session(base_url):
    session = requests.Session()
    response = session.post(
        f"{base_url}/api/auth/login",
        json={"email": ADMIN_AE_EMAIL, "password": ADMIN_PASSWORD},
        timeout=30,
    )
    assert response.status_code == 200, f"admin@bidblitz.ae login failed: {response.status_code} {response.text}"
    return session


def _find_admin_row(users_payload):
    users = users_payload.get("users") or []
    for row in users:
        if (row.get("email") or "").lower() == ADMIN_AE_EMAIL:
            return row
    return None


def test_admin_ae_login_sets_http_only_cookie(base_url):
    session = requests.Session()
    response = session.post(
        f"{base_url}/api/auth/login",
        json={"email": ADMIN_AE_EMAIL, "password": ADMIN_PASSWORD},
        timeout=30,
    )
    assert response.status_code == 200, f"{response.status_code} {response.text}"
    set_cookie = response.headers.get("set-cookie", "")
    assert "access_token=" in set_cookie
    assert "HttpOnly" in set_cookie


def test_removed_admin_com_login_rejected(base_url):
    session = requests.Session()
    response = session.post(
        f"{base_url}/api/auth/login",
        json={"email": ADMIN_COM_EMAIL, "password": ADMIN_PASSWORD},
        timeout=30,
    )
    assert response.status_code in (401, 403), f"expected 401/403, got {response.status_code} {response.text}"
    data = response.json()
    assert "detail" in data


def test_auth_me_returns_canonical_admin_and_balance(admin_session, base_url):
    response = admin_session.get(f"{base_url}/api/auth/me", timeout=30)
    assert response.status_code == 200, f"{response.status_code} {response.text}"
    data = response.json()
    assert (data.get("email") or "").lower() == ADMIN_AE_EMAIL
    assert isinstance(data.get("balance"), (int, float))
    assert data.get("balance") > 0


def test_wallet_users_matches_auth_me_balance_and_blz(admin_session, base_url):
    me_res = admin_session.get(f"{base_url}/api/auth/me", timeout=30)
    assert me_res.status_code == 200, f"{me_res.status_code} {me_res.text}"
    me = me_res.json()

    users_res = admin_session.get(
        f"{base_url}/api/admin/wallet/users",
        params={"q": ADMIN_AE_EMAIL},
        timeout=30,
    )
    assert users_res.status_code == 200, f"{users_res.status_code} {users_res.text}"
    users_payload = users_res.json()
    admin_row = _find_admin_row(users_payload)
    assert admin_row is not None, f"admin row not found in payload: {users_payload}"

    assert pytest.approx(float(me.get("balance", 0)), abs=0.01) == float(admin_row.get("balance_eur", 0))
    assert pytest.approx(float(me.get("balance_blz", 0)), abs=0.01) == float(admin_row.get("balance_blz", 0))


def test_admin_wallet_users_not_returning_huge_stale_balance(admin_session, base_url):
    users_res = admin_session.get(
        f"{base_url}/api/admin/wallet/users",
        params={"q": ADMIN_AE_EMAIL},
        timeout=30,
    )
    assert users_res.status_code == 200, f"{users_res.status_code} {users_res.text}"
    users_payload = users_res.json()
    admin_row = _find_admin_row(users_payload)
    assert admin_row is not None, f"admin row not found in payload: {users_payload}"
    assert float(admin_row.get("balance_eur", 0)) < 1_000_000


def test_self_topup_blz_updates_and_restores_consistently(admin_session, base_url):
    users_before = admin_session.get(
        f"{base_url}/api/admin/wallet/users",
        params={"q": ADMIN_AE_EMAIL},
        timeout=30,
    )
    assert users_before.status_code == 200, f"{users_before.status_code} {users_before.text}"
    admin_before = _find_admin_row(users_before.json())
    assert admin_before is not None
    admin_id = admin_before.get("user_id")
    blz_before = float(admin_before.get("balance_blz", 0) or 0)

    topup_res = admin_session.post(
        f"{base_url}/api/admin/wallet/self-topup",
        json={"amount_blz": 1, "amount_eur": 0, "reason": "TEST_iter190_topup"},
        timeout=30,
    )
    assert topup_res.status_code == 200, f"{topup_res.status_code} {topup_res.text}"
    topup_data = topup_res.json()
    assert topup_data.get("ok") is True
    assert pytest.approx(blz_before + 1, abs=0.01) == float(topup_data.get("balance_blz", 0))

    users_after_topup = admin_session.get(
        f"{base_url}/api/admin/wallet/users",
        params={"q": ADMIN_AE_EMAIL},
        timeout=30,
    )
    assert users_after_topup.status_code == 200, f"{users_after_topup.status_code} {users_after_topup.text}"
    admin_after_topup = _find_admin_row(users_after_topup.json())
    assert admin_after_topup is not None
    assert pytest.approx(blz_before + 1, abs=0.01) == float(admin_after_topup.get("balance_blz", 0))

    debit_res = admin_session.post(
        f"{base_url}/api/admin/wallet/debit",
        json={"user_id": admin_id, "amount_blz": 1, "amount_eur": 0, "reason": "TEST_iter190_restore"},
        timeout=30,
    )
    assert debit_res.status_code == 200, f"restore debit failed: {debit_res.status_code} {debit_res.text}"
    debit_data = debit_res.json()
    assert debit_data.get("ok") is True

    users_after_restore = admin_session.get(
        f"{base_url}/api/admin/wallet/users",
        params={"q": ADMIN_AE_EMAIL},
        timeout=30,
    )
    assert users_after_restore.status_code == 200, f"{users_after_restore.status_code} {users_after_restore.text}"
    admin_after_restore = _find_admin_row(users_after_restore.json())
    assert admin_after_restore is not None
    assert pytest.approx(blz_before, abs=0.01) == float(admin_after_restore.get("balance_blz", 0))


def test_auth_login_bruteforce_lockout_contract(base_url):
    session = requests.Session()
    status_codes = []
    for _ in range(6):
        response = session.post(
            f"{base_url}/api/auth/login",
            json={"email": ADMIN_AE_EMAIL, "password": "WrongPassword!123"},
            timeout=30,
        )
        status_codes.append(response.status_code)
    assert status_codes[:5] == [401, 401, 401, 401, 401], f"unexpected first 5 statuses: {status_codes}"
    assert status_codes[5] == 429, f"expected lockout 429 on 6th attempt, got {status_codes[5]}"
