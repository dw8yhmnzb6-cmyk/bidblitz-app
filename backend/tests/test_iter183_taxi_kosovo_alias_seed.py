"""Iteration 183 - Taxi Kosovo pricing, geocode single-letter, admin alias auth, and startup seed order checks."""

import os
from pathlib import Path

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
                return v.strip().strip('"')
    return ""


BASE_URL = (
    os.environ.get("REACT_APP_BACKEND_URL")
    or _read_env_file_value("/app/frontend/.env", "REACT_APP_BACKEND_URL")
    or ""
).rstrip("/")


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


# module: taxi fare engine Kosovo pricing contract
def test_taxi_estimate_kosovo_region_and_fare_breakdown(api_client, base_url):
    payload = {
        "pickup_lat": 42.6629,
        "pickup_lng": 21.1655,
        "dropoff_lat": 42.6486,
        "dropoff_lng": 21.1673,
    }
    response = api_client.post(f"{base_url}/api/taxi/estimate", json=payload, timeout=25)
    assert response.status_code == 200
    data = response.json()

    assert data.get("region") == "kosovo"
    estimates = data.get("estimates") or []
    assert len(estimates) >= 3

    by_type = {item.get("vehicle_type"): item for item in estimates}
    for vehicle_type in ["standard", "premium", "van"]:
        assert vehicle_type in by_type
        breakdown = by_type[vehicle_type].get("fare_breakdown") or {}
        assert breakdown.get("region") == "kosovo"
        assert breakdown.get("base_fare") == 2.0
        assert breakdown.get("time_cost") == 0.0
        assert float(breakdown.get("distance_cost", 0)) > 0


# module: taxi geocode single-letter query contract
def test_taxi_geocode_single_letter_returns_suggestions(api_client, base_url):
    response = api_client.get(
        f"{base_url}/api/taxi/geocode",
        params={
            "q": "P",
            "lat": 42.6629,
            "lng": 21.1655,
            "country": "xk,al,de",
        },
        timeout=25,
    )
    assert response.status_code == 200
    data = response.json()
    features = data.get("features") or []
    assert len(features) > 0
    first = features[0]
    assert isinstance(first.get("place_name"), str)
    assert isinstance(first.get("center"), list)


# module: admin alias auth canonical + login_email contract
def test_admin_alias_login_and_me_fields(api_client, base_url):
    login = _login(api_client, base_url, "admin@bidblitz.ae", "BidBlitz2026!")
    assert login.status_code == 200
    login_data = login.json()
    assert login_data.get("email") == "admin@bidblitz.com"
    assert login_data.get("canonical_email") == "admin@bidblitz.com"
    assert login_data.get("login_email") == "admin@bidblitz.ae"

    me = api_client.get(f"{base_url}/api/auth/me", timeout=25)
    assert me.status_code == 200
    me_data = me.json()
    assert me_data.get("canonical_email") == "admin@bidblitz.com"
    assert me_data.get("login_email") == "admin@bidblitz.ae"


# module: admin canonical login contract remains canonical
def test_admin_canonical_login_keeps_canonical_identity(api_client, base_url):
    login = _login(api_client, base_url, "admin@bidblitz.com", "BidBlitz2026!")
    assert login.status_code == 200
    login_data = login.json()
    assert login_data.get("email") == "admin@bidblitz.com"
    assert login_data.get("canonical_email") == "admin@bidblitz.com"
    assert login_data.get("login_email") == "admin@bidblitz.com"


# module: auth cookie + brute-force + bcrypt + startup seed logic checks
def test_auth_hardening_and_seed_admin_startup_contract(api_client, base_url):
    login = _login(api_client, base_url, "admin@bidblitz.com", "BidBlitz2026!")
    assert login.status_code == 200
    set_cookie_header = login.headers.get("set-cookie", "")
    assert "access_token=" in set_cookie_header
    assert "refresh_token=" in set_cookie_header
    assert "HttpOnly" in set_cookie_header

    # brute force lockout expected contract: 5x401 then 429
    brute = requests.Session()
    brute.headers.update({"Content-Type": "application/json"})
    email = "iter183.lockout@example.com"
    statuses = []
    for _ in range(6):
        r = brute.post(
            f"{base_url}/api/auth/login",
            json={"email": email, "password": "wrong-password"},
            timeout=25,
        )
        statuses.append(r.status_code)
    assert statuses[:5] == [401, 401, 401, 401, 401]
    assert statuses[5] == 429

    # source-level startup/seed contract checks requested in scope
    server_py = Path("/app/backend/server.py").read_text(encoding="utf-8")
    assert "async def seed_admin" in server_py
    assert "await create_indexes()" in server_py
    assert "await seed_admin()" in server_py
    assert "await ensure_admin_driver_account()" in server_py
    assert server_py.index("await create_indexes()") < server_py.index("await seed_admin()")
    assert server_py.index("await seed_admin()") < server_py.index("await ensure_admin_driver_account()")
    assert "verify_password(ADMIN_PASSWORD, password_hash)" in server_py
    assert "updates[\"password_hash\"] = hash_password(ADMIN_PASSWORD)" in server_py
