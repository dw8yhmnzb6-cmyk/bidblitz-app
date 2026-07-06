"""Iteration 182: admin KYC-gate bypass + auth hardening regression checks."""

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
                return v.strip().strip('"')
    return ""


BASE_URL = (
    os.environ.get("REACT_APP_BACKEND_URL")
    or _read_env_file_value("/app/frontend/.env", "REACT_APP_BACKEND_URL")
    or ""
).rstrip("/")

MONGO_URL = os.environ.get("MONGO_URL") or _read_env_file_value("/app/backend/.env", "MONGO_URL")
DB_NAME = os.environ.get("DB_NAME") or _read_env_file_value("/app/backend/.env", "DB_NAME")


@pytest.fixture(scope="session")
def base_url() -> str:
    if not BASE_URL:
        pytest.skip("REACT_APP_BACKEND_URL is not set")
    return BASE_URL


@pytest.fixture
def api_client() -> requests.Session:
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


def _login(session: requests.Session, base_url: str, email: str, password: str) -> requests.Response:
    return session.post(
        f"{base_url}/api/auth/login",
        json={"email": email, "password": password, "remember_me": True},
        timeout=25,
    )


def _assert_no_object_id_leak(payload: dict):
    # module: Mongo ObjectId serialization safety in auth payloads
    assert "_id" not in payload
    payload_str = str(payload)
    assert "ObjectId(" not in payload_str


def _assert_admin_approved_contract(payload: dict):
    # module: admin auth contract values consumed by frontend context
    assert payload.get("role") == "admin"
    assert payload.get("kyc_status") == "approved"
    assert payload.get("kyc_verified") is True
    assert payload.get("email") == "admin@bidblitz.com"
    _assert_no_object_id_leak(payload)


# module: admin alias + canonical login_email contract
@pytest.mark.parametrize(
    "login_email, expected_login_email",
    [
        ("admin@bidblitz.ae", "admin@bidblitz.ae"),
        ("admin@bid-blitz.ae", "admin@bidblitz.ae"),
        ("admin@bidblitz.com", "admin@bidblitz.com"),
    ],
)
def test_admin_login_alias_mapping_and_kyc_contract(api_client, base_url, login_email: str, expected_login_email: str):
    response = _login(api_client, base_url, login_email, "BidBlitz2026!")
    assert response.status_code == 200
    data = response.json()
    _assert_admin_approved_contract(data)
    assert data.get("login_email") == expected_login_email
    assert data.get("canonical_email") == "admin@bidblitz.com"


# module: /auth/me + /auth/refresh persistence after alias login
def test_alias_login_persists_context_values_through_me_and_refresh(api_client, base_url):
    login_response = _login(api_client, base_url, "admin@bidblitz.ae", "BidBlitz2026!")
    assert login_response.status_code == 200
    login_data = login_response.json()
    _assert_admin_approved_contract(login_data)
    assert login_data.get("login_email") == "admin@bidblitz.ae"

    me_response = api_client.get(f"{base_url}/api/auth/me", timeout=25)
    assert me_response.status_code == 200
    me_data = me_response.json()
    _assert_admin_approved_contract(me_data)
    assert me_data.get("login_email") == "admin@bidblitz.ae"

    refresh_response = api_client.post(f"{base_url}/api/auth/refresh", timeout=25)
    assert refresh_response.status_code == 200
    refresh_data = refresh_response.json()
    _assert_admin_approved_contract(refresh_data)
    assert refresh_data.get("login_email") == "admin@bidblitz.ae"


# module: non-admin contract remains non-admin
@pytest.mark.parametrize(
    "email,password",
    [
        ("kycgate.1782580398@test.com", "TestPass2026!"),
        ("haendler@bidblitz.com", "Haendler2026!"),
    ],
)
def test_non_admin_accounts_not_forced_to_admin_kyc_contract(api_client, base_url, email: str, password: str):
    response = _login(api_client, base_url, email, password)
    if response.status_code != 200:
        pytest.skip(f"Account unavailable for test: {email}")

    data = response.json()
    assert data.get("role") != "admin"
    assert isinstance(data.get("kyc_status"), str)
    assert isinstance(data.get("kyc_verified"), bool)
    _assert_no_object_id_leak(data)


# module: login cookies are HttpOnly
def test_login_sets_http_only_cookies(api_client, base_url):
    response = _login(api_client, base_url, "admin@bidblitz.com", "BidBlitz2026!")
    assert response.status_code == 200
    set_cookie_header = response.headers.get("set-cookie", "")
    assert "access_token=" in set_cookie_header
    assert "refresh_token=" in set_cookie_header
    assert "HttpOnly" in set_cookie_header


# module: CORS credentialed preflight response
def test_auth_login_options_supports_credentials(base_url):
    origin = "https://kyc-approval-hub.preview.emergentagent.com"
    response = requests.options(
        f"{base_url}/api/auth/login",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
        timeout=25,
    )
    assert response.status_code in [200, 204]
    assert response.headers.get("access-control-allow-credentials", "").lower() == "true"
    assert response.headers.get("access-control-allow-origin", "") in [origin, "*"]


# module: brute-force lockout expected 5x401 then 429
def test_lockout_after_five_failed_attempts(base_url):
    email = f"iter182.lockout.{uuid.uuid4().hex[:8]}@example.com"
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})

    statuses = []
    for _ in range(6):
        r = s.post(
            f"{base_url}/api/auth/login",
            json={"email": email, "password": "wrong-password"},
            timeout=25,
        )
        statuses.append(r.status_code)
        time.sleep(0.1)

    assert statuses[:5] == [401, 401, 401, 401, 401]
    assert statuses[5] == 429


# module: bcrypt format validation from DB seed/admin account
def test_admin_password_hash_has_bcrypt_2b_prefix():
    if not MONGO_URL or not DB_NAME:
        pytest.skip("MONGO_URL or DB_NAME not available")
    if not (MONGO_URL.startswith("mongodb://") or MONGO_URL.startswith("mongodb+srv://")):
        pytest.skip("MONGO_URL is not a direct mongodb URI")

    try:
        client = MongoClient(MONGO_URL)
    except InvalidURI:
        pytest.skip("MONGO_URL is invalid")

    db = client[DB_NAME]
    admin_doc = db.users.find_one({"email": "admin@bidblitz.com"}, {"password_hash": 1})
    assert admin_doc is not None
    password_hash = (admin_doc.get("password_hash") or "").strip()
    assert password_hash.startswith("$2b$")
