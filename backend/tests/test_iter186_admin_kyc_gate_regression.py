"""Iteration 186: Admin alias KYC-gate regression + auth hardening smoke tests."""

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
    with open(path, "r", encoding="utf-8") as file_obj:
        for raw in file_obj:
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            found_key, found_value = line.split("=", 1)
            if found_key.strip() == key:
                return found_value.strip().strip('"')
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
    # module: auth payload serialization safety
    assert "_id" not in payload
    assert "ObjectId(" not in str(payload)


def _assert_admin_contract(payload: dict):
    # module: canonical admin auth contract used by frontend gating
    assert payload.get("role") == "admin"
    assert payload.get("kyc_status") == "approved"
    assert payload.get("kyc_verified") is True
    assert payload.get("canonical_email") == "admin@bidblitz.com"
    assert payload.get("email") == "admin@bidblitz.com"
    _assert_no_object_id_leak(payload)


# module: admin alias + dashed alias + canonical auth mapping contract
@pytest.mark.parametrize(
    "login_email,expected_login_email",
    [
        ("admin@bidblitz.ae", "admin@bidblitz.ae"),
        ("admin@bid-blitz.ae", "admin@bidblitz.ae"),
        ("admin@bidblitz.com", "admin@bidblitz.com"),
    ],
)
def test_admin_login_variants_map_to_canonical_admin(api_client, base_url, login_email: str, expected_login_email: str):
    response = _login(api_client, base_url, login_email, "BidBlitz2026!")
    assert response.status_code == 200
    data = response.json()

    _assert_admin_contract(data)
    assert data.get("login_email") == expected_login_email


# module: alias session persistence through /auth/me and /auth/refresh
def test_admin_alias_persists_login_email_and_kyc_via_me_and_refresh(api_client, base_url):
    login_response = _login(api_client, base_url, "admin@bidblitz.ae", "BidBlitz2026!")
    assert login_response.status_code == 200
    login_data = login_response.json()
    _assert_admin_contract(login_data)
    assert login_data.get("login_email") == "admin@bidblitz.ae"

    me_response = api_client.get(f"{base_url}/api/auth/me", timeout=25)
    assert me_response.status_code == 200
    me_data = me_response.json()
    _assert_admin_contract(me_data)
    assert me_data.get("login_email") == "admin@bidblitz.ae"

    refresh_response = api_client.post(f"{base_url}/api/auth/refresh", timeout=25)
    assert refresh_response.status_code == 200
    refresh_data = refresh_response.json()
    _assert_admin_contract(refresh_data)
    assert refresh_data.get("login_email") == "admin@bidblitz.ae"


# module: unverified non-admin contract remains restricted
def test_unverified_non_admin_user_kyc_contract_unchanged(api_client, base_url):
    response = _login(api_client, base_url, "kycgate.1782580398@test.com", "TestPass2026!")
    assert response.status_code == 200
    data = response.json()

    assert data.get("role") != "admin"
    assert data.get("email") == "kycgate.1782580398@test.com"
    assert data.get("kyc_status") != "approved"
    assert data.get("kyc_verified") is False
    _assert_no_object_id_leak(data)


# module: login cookie contract (httpOnly)
def test_login_sets_http_only_auth_cookies(api_client, base_url):
    response = _login(api_client, base_url, "admin@bidblitz.ae", "BidBlitz2026!")
    assert response.status_code == 200

    set_cookie_header = response.headers.get("set-cookie", "")
    assert "access_token=" in set_cookie_header
    assert "refresh_token=" in set_cookie_header
    assert "HttpOnly" in set_cookie_header


# module: CORS preflight credential support (explicit origin expected)
def test_auth_preflight_cors_credentials_and_origin_header(base_url):
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


# module: brute-force lockout contract (5x 401 then 429)
def test_login_lockout_after_five_failures(base_url):
    unique_email = f"iter186.lockout.{uuid.uuid4().hex[:8]}@example.com"
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})

    statuses = []
    for _ in range(6):
        response = session.post(
            f"{base_url}/api/auth/login",
            json={"email": unique_email, "password": "wrong-password"},
            timeout=25,
        )
        statuses.append(response.status_code)
        time.sleep(0.1)

    assert statuses[:5] == [401, 401, 401, 401, 401]
    assert statuses[5] == 429


# module: bcrypt hash format check for seeded admin
def test_admin_password_hash_starts_with_bcrypt_2b_prefix():
    if not MONGO_URL or not DB_NAME:
        pytest.skip("MONGO_URL or DB_NAME not available")
    if not (MONGO_URL.startswith("mongodb://") or MONGO_URL.startswith("mongodb+srv://")):
        pytest.skip("MONGO_URL is not a direct mongodb URI")

    try:
        client = MongoClient(MONGO_URL)
    except InvalidURI:
        pytest.skip("MONGO_URL is invalid")

    database = client[DB_NAME]
    admin_doc = database.users.find_one({"email": "admin@bidblitz.com"}, {"password_hash": 1})
    assert admin_doc is not None
    password_hash = (admin_doc.get("password_hash") or "").strip()
    assert password_hash.startswith("$2b$")


# module: startup seed_admin idempotent password-refresh flow check
def test_seed_admin_update_logic_present_in_active_startup_file():
    with open("/app/backend/server.py", "r", encoding="utf-8") as file_obj:
        source = file_obj.read()

    assert "async def seed_admin" in source
    assert "await seed_admin()" in source
    assert "verify_password(ADMIN_PASSWORD" in source
    assert "updates[\"password_hash\"] = hash_password(ADMIN_PASSWORD)" in source
