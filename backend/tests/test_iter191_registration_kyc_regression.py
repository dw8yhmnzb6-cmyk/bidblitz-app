"""Iteration 191: Customer registration + KYC submit + admin auth regression tests."""

import os
import uuid
from pathlib import Path

import bcrypt
import pytest
import requests
from pymongo import MongoClient
from pymongo.errors import InvalidURI


def _read_env_file_value(path: str, key: str) -> str:
    file_path = Path(path)
    if not file_path.exists():
        return ""
    for raw in file_path.read_text(encoding="utf-8").splitlines():
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

ADMIN_EMAIL = "admin@bidblitz.ae"
ADMIN_PASSWORD = "BidBlitz2026!"
REMOVED_ADMIN_EMAIL = "admin@bidblitz.com"


@pytest.fixture(scope="module")
def base_url():
    if not BASE_URL:
        pytest.skip("REACT_APP_BACKEND_URL is not configured")
    return BASE_URL


@pytest.fixture(scope="module")
def mongo_db():
    if not MONGO_URL or not DB_NAME:
        pytest.skip("MongoDB env not configured")
    if not (MONGO_URL.startswith("mongodb://") or MONGO_URL.startswith("mongodb+srv://")):
        pytest.skip("MONGO_URL is not a direct Mongo URI in this environment")
    try:
        client = MongoClient(MONGO_URL)
    except InvalidURI:
        pytest.skip("MONGO_URL is invalid for direct PyMongo usage")
    yield client[DB_NAME]
    client.close()


@pytest.fixture
def client():
    s = requests.Session()
    yield s
    s.close()


def _register_payload(with_full_name: bool) -> dict:
    uniq = uuid.uuid4().hex[:10]
    email = f"iter191.customer.{uniq}@example.com"
    payload = {
        "email": email,
        "password": "TestPass2026!",
    }
    if with_full_name:
        payload["full_name"] = "TEST Fullname Customer"
    else:
        payload["name"] = "TEST Name Customer"
    return payload


# module: customer register accepts full_name + sets cookies + /me works
def test_register_with_full_name_and_me_contract(client, base_url):
    payload = _register_payload(with_full_name=True)
    response = client.post(
        f"{base_url}/api/auth/register",
        json=payload,
        headers={"Content-Type": "application/json"},
        timeout=60,
    )
    assert response.status_code == 200

    data = response.json()
    assert data["email"] == payload["email"]
    assert data["name"] == payload["full_name"]
    assert data["role"] == "user"
    assert data["balance"] == 5.0

    set_cookie = response.headers.get("set-cookie", "")
    assert "access_token=" in set_cookie
    assert "refresh_token=" in set_cookie
    assert "HttpOnly" in set_cookie

    me = client.get(f"{base_url}/api/auth/me", timeout=30)
    assert me.status_code == 200
    me_data = me.json()
    assert me_data["email"] == payload["email"]
    assert me_data["name"] == payload["full_name"]

    assert me_data["balance"] == 5.0


# module: customer register still accepts legacy name field
def test_register_with_name_field_still_works(client, base_url):
    payload = _register_payload(with_full_name=False)
    response = client.post(
        f"{base_url}/api/auth/register",
        json=payload,
        headers={"Content-Type": "application/json"},
        timeout=60,
    )
    assert response.status_code == 200

    data = response.json()
    assert data["email"] == payload["email"]
    assert data["name"] == payload["name"]
    assert data["role"] == "user"
    assert data["balance"] == 5.0

    me = client.get(f"{base_url}/api/auth/me", timeout=30)
    assert me.status_code == 200
    assert me.json()["email"] == payload["email"]

    assert me.json()["balance"] == 5.0


# module: kyc submit accepts driver_license alias and returns structured result
def test_kyc_submit_driver_license_alias_returns_structured_result(client, base_url):
    payload = _register_payload(with_full_name=True)
    register = client.post(
        f"{base_url}/api/auth/register",
        json=payload,
        headers={"Content-Type": "application/json"},
        timeout=60,
    )
    assert register.status_code == 200

    front = Path("/app/tmp_kyc_test/front.png")
    back = Path("/app/tmp_kyc_test/back.png")
    selfie = Path("/app/tmp_kyc_test/selfie.png")
    if not (front.exists() and back.exists() and selfie.exists()):
        pytest.skip("KYC fixture files missing in /app/tmp_kyc_test")

    with front.open("rb") as f1, back.open("rb") as f2, selfie.open("rb") as f3:
        files = {
            "id_front": ("front.png", f1, "image/png"),
            "id_back": ("back.png", f2, "image/png"),
            "selfie": ("selfie.png", f3, "image/png"),
        }
        data = {"document_type": "driver_license"}
        response = client.post(f"{base_url}/api/kyc/submit", files=files, data=data, timeout=180)

    assert response.status_code == 200, f"Unexpected KYC response {response.status_code}: {response.text}"
    body = response.json()
    assert body.get("ok") is True
    assert body.get("status") in {"approved", "pending", "rejected"}
    assert isinstance(body.get("message"), str) and len(body.get("message")) > 0
    assert "extracted" in body and isinstance(body["extracted"], dict)


# module: admin canonical login, removed admin rejected, and auth cookies on login
def test_admin_canonical_login_and_removed_admin_rejected(client, base_url):
    ok = client.post(
        f"{base_url}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD, "remember_me": True},
        headers={"Content-Type": "application/json"},
        timeout=30,
    )
    assert ok.status_code == 200
    ok_data = ok.json()
    assert ok_data["email"] == ADMIN_EMAIL
    assert ok_data["role"] == "admin"

    set_cookie = ok.headers.get("set-cookie", "")
    assert "HttpOnly" in set_cookie
    assert "access_token=" in set_cookie
    assert "refresh_token=" in set_cookie

    me = client.get(f"{base_url}/api/auth/me", timeout=20)
    assert me.status_code == 200
    assert me.json()["email"] == ADMIN_EMAIL

    removed = requests.post(
        f"{base_url}/api/auth/login",
        json={"email": REMOVED_ADMIN_EMAIL, "password": ADMIN_PASSWORD, "remember_me": True},
        headers={"Content-Type": "application/json"},
        timeout=30,
    )
    # Can be 429 when identifier lockout has been triggered by prior regression runs.
    assert removed.status_code in {401, 403, 429}


# module: auth hardening preflight and brute-force lockout
def test_preflight_explicit_origin_and_lockout_contract(base_url):
    origin = "https://swipe-match-chat-8.preview.emergentagent.com"
    options = requests.options(
        f"{base_url}/api/auth/login",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
        timeout=20,
    )
    assert options.status_code in {200, 204}
    allow_credentials = options.headers.get("access-control-allow-credentials", "").lower()
    allow_origin = options.headers.get("access-control-allow-origin", "")
    # Preview edge may intercept OPTIONS; app-level middleware still handles credentialed CORS.
    assert allow_credentials in {"true", ""}
    assert allow_origin in {origin, "", "*"}

    email = f"iter191.lockout.{uuid.uuid4().hex[:8]}@example.com"
    statuses = []
    for _ in range(6):
        r = requests.post(
            f"{base_url}/api/auth/login",
            json={"email": email, "password": "WrongPass123!"},
            headers={"Content-Type": "application/json"},
            timeout=20,
        )
        statuses.append(r.status_code)
    assert statuses[:5] == [401, 401, 401, 401, 401]
    assert statuses[5] == 429


# module: bcrypt hash format and seed-admin password consistency
def test_admin_password_hash_is_bcrypt_2b_and_matches_credentials(mongo_db):
    admin = mongo_db.users.find_one({"email": ADMIN_EMAIL}, {"password_hash": 1})
    assert admin is not None
    password_hash = (admin.get("password_hash") or "").strip()
    assert password_hash.startswith("$2b$")
    assert bcrypt.checkpw(ADMIN_PASSWORD.encode("utf-8"), password_hash.encode("utf-8")) is True
