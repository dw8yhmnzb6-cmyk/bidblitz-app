"""Iteration 187: admin canonical migration (.ae), auth contract, KYC gating dependencies."""

import os
import uuid
import time

import pytest
import requests
from pymongo import MongoClient


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
).rstrip("/")
MONGO_URL = os.environ.get("MONGO_URL") or _read_env_file_value("/app/backend/.env", "MONGO_URL")
DB_NAME = os.environ.get("DB_NAME") or _read_env_file_value("/app/backend/.env", "DB_NAME")


@pytest.fixture(scope="session")
def base_url() -> str:
    if not BASE_URL:
        pytest.skip("REACT_APP_BACKEND_URL is not set")
    return BASE_URL


@pytest.fixture(scope="session")
def mongo_db():
    if not MONGO_URL or not DB_NAME:
        pytest.skip("MONGO_URL or DB_NAME missing")
    client = MongoClient(MONGO_URL)
    yield client[DB_NAME]
    client.close()


@pytest.fixture
def api_client() -> requests.Session:
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


def _login(session: requests.Session, base_url: str, email: str, password: str):
    return session.post(
        f"{base_url}/api/auth/login",
        json={"email": email, "password": password, "remember_me": True},
        timeout=25,
    )


# module: DB/admin canonical migration contract
def test_db_has_only_ae_admin_active(mongo_db):
    admin_ae = mongo_db.users.find_one({"email": "admin@bidblitz.ae"})
    assert admin_ae is not None
    assert admin_ae.get("role") == "admin"
    assert admin_ae.get("kyc_status") == "approved"
    assert admin_ae.get("kyc_verified") is True

    legacy = mongo_db.users.find_one({"email": "admin@bidblitz.com"})
    if legacy is not None:
        assert legacy.get("role") != "admin"


# module: bcrypt + alias seed contract for canonical admin
def test_admin_bcrypt_and_aliases_contract(mongo_db):
    admin_ae = mongo_db.users.find_one(
        {"email": "admin@bidblitz.ae"},
        {"password_hash": 1, "email_aliases": 1},
    )
    assert admin_ae is not None
    assert (admin_ae.get("password_hash") or "").startswith("$2b$")
    assert "admin@bid-blitz.ae" in (admin_ae.get("email_aliases") or [])
    assert "admin@bidblitz.com" not in (admin_ae.get("email_aliases") or [])


# module: verified driver seed points to canonical admin email
def test_verified_driver_seed_uses_ae_admin_identity(mongo_db):
    admin_ae = mongo_db.users.find_one({"email": "admin@bidblitz.ae"}, {"_id": 1})
    assert admin_ae is not None
    admin_id = str(admin_ae["_id"])

    driver = mongo_db.drivers.find_one({"user_id": admin_id})
    assert driver is not None
    assert driver.get("user_email") == "admin@bidblitz.ae"
    assert driver.get("is_verified") is True


# module: login canonical admin contract
def test_login_admin_ae_contract(api_client, base_url):
    response = _login(api_client, base_url, "admin@bidblitz.ae", "BidBlitz2026!")
    assert response.status_code == 200
    data = response.json()
    assert data.get("email") == "admin@bidblitz.ae"
    assert data.get("canonical_email") == "admin@bidblitz.ae"
    assert data.get("login_email") == "admin@bidblitz.ae"
    assert data.get("role") == "admin"
    assert data.get("kyc_status") == "approved"
    assert data.get("kyc_verified") is True


# module: dashed alias normalization to canonical admin
def test_login_admin_dashed_alias_normalizes_to_canonical(api_client, base_url):
    response = _login(api_client, base_url, "admin@bid-blitz.ae", "BidBlitz2026!")
    assert response.status_code == 200
    data = response.json()
    assert data.get("email") == "admin@bidblitz.ae"
    assert data.get("canonical_email") == "admin@bidblitz.ae"
    assert data.get("login_email") == "admin@bidblitz.ae"
    assert data.get("role") == "admin"


# module: removed legacy admin login contract
def test_login_legacy_admin_com_is_rejected(api_client, base_url):
    response = _login(api_client, base_url, "admin@bidblitz.com", "BidBlitz2026!")
    assert response.status_code == 401
    body = response.json()
    assert "detail" in body


# module: cookie and CORS auth hardening smoke
def test_login_sets_http_only_cookie_and_options_allows_credentials(api_client, base_url):
    login_response = _login(api_client, base_url, "admin@bidblitz.ae", "BidBlitz2026!")
    assert login_response.status_code == 200
    set_cookie_header = login_response.headers.get("set-cookie", "")
    assert "HttpOnly" in set_cookie_header
    assert "access_token=" in set_cookie_header
    assert "refresh_token=" in set_cookie_header

    origin = "https://kyc-approval-hub.preview.emergentagent.com"
    preflight = requests.options(
        f"{base_url}/api/auth/login",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
        timeout=25,
    )
    assert preflight.status_code in [200, 204]
    assert preflight.headers.get("access-control-allow-credentials", "").lower() == "true"
    assert preflight.headers.get("access-control-allow-origin", "") in [origin, "*"]


# module: brute-force lockout contract (5 failures then lock)
def test_bruteforce_lockout_contract(base_url):
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    test_email = f"iter187.lockout.{uuid.uuid4().hex[:8]}@example.com"
    statuses = []
    for _ in range(6):
        response = session.post(
            f"{base_url}/api/auth/login",
            json={"email": test_email, "password": "wrong-password"},
            timeout=25,
        )
        statuses.append(response.status_code)
        time.sleep(0.1)

    assert statuses[:5] == [401, 401, 401, 401, 401]
    assert statuses[5] == 429


# module: startup seed_admin idempotence hooks present
def test_seed_admin_startup_logic_present():
    with open("/app/backend/server.py", "r", encoding="utf-8") as file_obj:
        source = file_obj.read()
    assert "async def seed_admin" in source
    assert "await seed_admin()" in source
    assert "verify_password(ADMIN_PASSWORD" in source
    assert "updates[\"password_hash\"] = hash_password(ADMIN_PASSWORD)" in source
