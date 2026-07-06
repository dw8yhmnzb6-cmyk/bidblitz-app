"""Admin alias auth regression: canonicalization, admin KYC mapping, cookies, lockout, and bcrypt format."""

import os
import time
import uuid

import pytest
import requests
from pymongo import MongoClient
from pymongo.errors import InvalidURI


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


BASE_URL = (
    os.environ.get("REACT_APP_BACKEND_URL", "")
    or _read_env_file_value("/app/frontend/.env", "REACT_APP_BACKEND_URL")
).rstrip("/")
MONGO_URL = os.environ.get("MONGO_URL", "") or _read_env_file_value("/app/backend/.env", "MONGO_URL")
DB_NAME = os.environ.get("DB_NAME", "") or _read_env_file_value("/app/backend/.env", "DB_NAME")


ADMIN_PASSWORD = "BidBlitz2026!"
ADMIN_EMAILS = [
    "admin@bidblitz.com",
    "admin@bidblitz.ae",
    "admin@bid-blitz.ae",
]

NON_ADMIN_CANDIDATES = [
    ("haendler@bidblitz.com", "Haendler2026!"),
    ("agimk@me.com", "Aldink56600"),
]


@pytest.fixture(scope="session")
def base_url():
    if not BASE_URL:
        pytest.skip("REACT_APP_BACKEND_URL is not set")
    return BASE_URL


@pytest.fixture
def session_client():
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


def _login(session_client: requests.Session, base_url: str, email: str, password: str):
    return session_client.post(
        f"{base_url}/api/auth/login",
        json={"email": email, "password": password, "remember_me": True},
        timeout=20,
    )


# module: canonical admin auth aliases
@pytest.mark.parametrize("email", ADMIN_EMAILS)
def test_admin_aliases_login_to_canonical_account(session_client, base_url, email):
    response = _login(session_client, base_url, email, ADMIN_PASSWORD)
    assert response.status_code == 200

    data = response.json()
    assert data["email"] == "admin@bidblitz.com"
    assert data["role"] == "admin"
    assert data["kyc_status"] == "approved"
    assert data["kyc_verified"] is True


# module: auth cookie hardening
def test_login_sets_http_only_auth_cookies(session_client, base_url):
    response = _login(session_client, base_url, "admin@bidblitz.ae", ADMIN_PASSWORD)
    assert response.status_code == 200

    set_cookie_header = response.headers.get("set-cookie", "")
    assert "access_token=" in set_cookie_header
    assert "refresh_token=" in set_cookie_header
    assert "HttpOnly" in set_cookie_header


# module: auth me + refresh contract for admin kyc
def test_auth_me_and_refresh_preserve_admin_kyc_contract(session_client, base_url):
    login_response = _login(session_client, base_url, "admin@bidblitz.ae", ADMIN_PASSWORD)
    assert login_response.status_code == 200

    me_response = session_client.get(f"{base_url}/api/auth/me", timeout=20)
    assert me_response.status_code == 200
    me_data = me_response.json()
    assert me_data["email"] == "admin@bidblitz.com"
    assert me_data["role"] == "admin"
    assert me_data["kyc_status"] == "approved"
    assert me_data["kyc_verified"] is True
    assert "_id" not in me_data

    refresh_response = session_client.post(f"{base_url}/api/auth/refresh", timeout=20)
    assert refresh_response.status_code == 200
    refresh_data = refresh_response.json()
    assert refresh_data["email"] == "admin@bidblitz.com"
    assert refresh_data["role"] == "admin"
    assert refresh_data["kyc_status"] == "approved"
    assert refresh_data["kyc_verified"] is True
    assert "_id" not in refresh_data


# module: brute-force lockout threshold
def test_bruteforce_lockout_after_five_failures(base_url):
    unique_email = f"lockout.{uuid.uuid4().hex[:8]}@example.com"
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})

    statuses = []
    for _ in range(6):
        r = s.post(
            f"{base_url}/api/auth/login",
            json={"email": unique_email, "password": "wrong-password"},
            timeout=20,
        )
        statuses.append(r.status_code)
        time.sleep(0.1)

    assert statuses[:5] == [401, 401, 401, 401, 401]
    assert statuses[5] == 429


# module: bcrypt seed/hash format verification
def test_admin_password_hash_uses_bcrypt_2b_prefix():
    if not MONGO_URL or not DB_NAME:
        pytest.skip("MONGO_URL or DB_NAME is not set")
    if not (MONGO_URL.startswith("mongodb://") or MONGO_URL.startswith("mongodb+srv://")):
        pytest.skip("MONGO_URL is not a direct Mongo URI in this environment")

    try:
        client = MongoClient(MONGO_URL)
    except InvalidURI:
        pytest.skip("MONGO_URL is invalid for direct PyMongo connection")
    db = client[DB_NAME]
    admin = db.users.find_one({"email": "admin@bidblitz.com"}, {"password_hash": 1})
    assert admin is not None
    password_hash = (admin.get("password_hash") or "").strip()
    assert password_hash.startswith("$2b$")


# module: non-admin kyc behavior remains unchanged
@pytest.mark.parametrize("email,password", NON_ADMIN_CANDIDATES)
def test_non_admin_kyc_contract_is_not_admin_overridden(session_client, base_url, email, password):
    response = _login(session_client, base_url, email, password)
    if response.status_code != 200:
        pytest.skip(f"Test account unavailable: {email}")

    data = response.json()
    assert data["role"] != "admin"
    assert data["email"] != "admin@bidblitz.com"
    assert isinstance(data.get("kyc_verified"), bool)
    assert isinstance(data.get("kyc_status"), str)


# module: CORS credentialed preflight contract
def test_auth_login_preflight_cors_credentials_header(base_url):
    origin = "https://preview.emergentagent.com"
    response = requests.options(
        f"{base_url}/api/auth/login",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
        timeout=20,
    )
    assert response.status_code in [200, 204]
    assert response.headers.get("access-control-allow-credentials", "").lower() == "true"
    assert response.headers.get("access-control-allow-origin", "") in [origin, "https://kyc-approval-hub.preview.emergentagent.com"]
