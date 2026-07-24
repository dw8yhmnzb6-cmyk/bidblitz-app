"""Iteration 181 auth regression: login_email visibility and token preservation."""

import os
from typing import Tuple

import pytest
import requests


def _read_env_file_value(path: str, key: str) -> str:
    if not os.path.exists(path):
        return ""
    with open(path, "r", encoding="utf-8") as f:
        for raw in f:
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            if k.strip() == key:
                return v.strip()
    return ""


BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or _read_env_file_value("/app/frontend/.env", "REACT_APP_BACKEND_URL") or "").rstrip("/")


@pytest.fixture(scope="session")
def base_url() -> str:
    if not BASE_URL:
        pytest.skip("REACT_APP_BACKEND_URL is not set")
    return BASE_URL


@pytest.fixture
def api_client() -> requests.Session:
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _login(session: requests.Session, base_url: str, email: str, password: str) -> requests.Response:
    return session.post(
        f"{base_url}/api/auth/login",
        json={"email": email, "password": password, "remember_me": True},
        timeout=25,
    )


def _assert_admin_shape(data: dict):
    assert data["email"] == "admin@bidblitz.com"
    assert data["canonical_email"] == "admin@bidblitz.com"
    assert data["role"] == "admin"
    assert data["kyc_status"] == "approved"
    assert data["kyc_verified"] is True
    assert "_id" not in data


# module: admin alias/canonical login response contract
@pytest.mark.parametrize(
    "login_email,expected_visible",
    [
        ("admin@bidblitz.ae", "admin@bidblitz.ae"),
        ("admin@bid-blitz.ae", "admin@bidblitz.ae"),
        ("admin@bidblitz.com", "admin@bidblitz.com"),
    ],
)
def test_login_response_contains_correct_login_email(api_client, base_url, login_email: str, expected_visible: str):
    response = _login(api_client, base_url, login_email, "BidBlitz2026!")
    assert response.status_code == 200

    data = response.json()
    _assert_admin_shape(data)
    assert data["login_email"] == expected_visible


# module: /auth/me + /auth/refresh preserve login_email from alias session
def test_alias_login_email_persists_through_me_and_refresh(api_client, base_url):
    login_response = _login(api_client, base_url, "admin@bidblitz.ae", "BidBlitz2026!")
    assert login_response.status_code == 200
    login_data = login_response.json()
    _assert_admin_shape(login_data)
    assert login_data["login_email"] == "admin@bidblitz.ae"

    me_response = api_client.get(f"{base_url}/api/auth/me", timeout=25)
    assert me_response.status_code == 200
    me_data = me_response.json()
    _assert_admin_shape(me_data)
    assert me_data["login_email"] == "admin@bidblitz.ae"

    refresh_response = api_client.post(f"{base_url}/api/auth/refresh", timeout=25)
    assert refresh_response.status_code == 200
    refresh_data = refresh_response.json()
    _assert_admin_shape(refresh_data)
    assert refresh_data["login_email"] == "admin@bidblitz.ae"

    me_after_refresh = api_client.get(f"{base_url}/api/auth/me", timeout=25)
    assert me_after_refresh.status_code == 200
    me_after_refresh_data = me_after_refresh.json()
    _assert_admin_shape(me_after_refresh_data)
    assert me_after_refresh_data["login_email"] == "admin@bidblitz.ae"


# module: non-admin KYC behavior unchanged
@pytest.mark.parametrize(
    "email,password",
    [
        ("agimk@me.com", "Aldink56600"),
        ("haendler@bidblitz.com", "Haendler2026!"),
    ],
)
def test_non_admin_kyc_behavior_unchanged(api_client, base_url, email: str, password: str):
    response = _login(api_client, base_url, email, password)
    if response.status_code != 200:
        pytest.skip(f"Test account unavailable: {email}")

    data = response.json()
    assert data["role"] != "admin"
    assert isinstance(data.get("kyc_status"), str)
    assert isinstance(data.get("kyc_verified"), bool)
    assert "_id" not in data
