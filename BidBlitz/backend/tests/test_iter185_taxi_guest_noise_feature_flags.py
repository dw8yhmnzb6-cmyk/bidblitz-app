"""Iteration 185 - Taxi guest noise reduction + feature flags + Kosovo fixed fare regression."""

import os

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
).rstrip("/")


@pytest.fixture(scope="session")
def base_url() -> str:
    if not BASE_URL:
        pytest.skip("REACT_APP_BACKEND_URL missing")
    return BASE_URL


@pytest.fixture
def api_client() -> requests.Session:
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture
def alias_admin_session(base_url: str) -> requests.Session:
    # module: auth regression for admin alias login and cookie session
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    login = session.post(
        f"{base_url}/api/auth/login",
        json={"email": "admin@bidblitz.ae", "password": "BidBlitz2026!", "remember_me": True},
        timeout=30,
    )
    if login.status_code != 200:
        pytest.skip("Admin alias login failed on preview")
    data = login.json()
    assert data.get("email") in {"admin@bidblitz.com", "admin@bidblitz.ae"}
    assert data.get("login_email") in {"admin@bidblitz.ae", "admin@bidblitz.com"}
    assert any(c.name == "access_token" for c in session.cookies), "access_token cookie missing"
    return session


# module: public route contract
def test_feature_flags_public_route_returns_flags_object(api_client, base_url):
    response = api_client.get(f"{base_url}/api/feature-flags", timeout=30)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, dict)
    assert isinstance(data.get("flags"), dict)


def _estimate(api_client: requests.Session, base_url: str, payload: dict):
    response = api_client.post(f"{base_url}/api/taxi/estimate", json=payload, timeout=30)
    assert response.status_code == 200
    return response.json()


def _assert_prn_fixed_fares(data: dict):
    estimates = data.get("estimates") or []
    assert len(estimates) >= 3
    by_type = {item.get("vehicle_type"): item for item in estimates}

    assert by_type["standard"]["fare"] == 15
    assert by_type["premium"]["fare"] == 20
    assert by_type["van"]["fare"] == 24

    for vtype in ["standard", "premium", "van"]:
        breakdown = by_type[vtype].get("fare_breakdown") or {}
        assert breakdown.get("fixed_fare") is True
        assert "Flughafen Kosovo ↔ Prishtina Festpreis" in (breakdown.get("fixed_fare_label") or "")


# module: fixed airport fare contract - city to PRN
def test_estimate_prishtina_to_prn_fixed_fares(api_client, base_url):
    payload = {
        "pickup_address": "Prishtina City Center",
        "pickup_lat": 42.6629,
        "pickup_lng": 21.1655,
        "dropoff_address": "Flughafen Kosovo PRN",
        "dropoff_lat": 42.5728,
        "dropoff_lng": 21.0358,
    }
    data = _estimate(api_client, base_url, payload)
    _assert_prn_fixed_fares(data)


# module: fixed airport fare contract - PRN to city
def test_estimate_prn_to_prishtina_fixed_fares(api_client, base_url):
    payload = {
        "pickup_address": "Flughafen Kosovo PRN",
        "pickup_lat": 42.5728,
        "pickup_lng": 21.0358,
        "dropoff_address": "Prishtina City Center",
        "dropoff_lat": 42.6629,
        "dropoff_lng": 21.1655,
    }
    data = _estimate(api_client, base_url, payload)
    _assert_prn_fixed_fares(data)


# module: auth regression - alias login still works and operator endpoint contract is stable
def test_alias_login_and_operator_status_payload(alias_admin_session, base_url):
    me = alias_admin_session.get(f"{base_url}/api/auth/me", timeout=30)
    assert me.status_code == 200
    me_data = me.json()
    assert me_data.get("email") in {"admin@bidblitz.ae", "admin@bidblitz.com"}

    operator = alias_admin_session.get(f"{base_url}/api/taxi/operator/status", timeout=30)
    assert operator.status_code == 200
    payload = operator.json()
    assert "is_operator" in payload
    assert "favorites" not in payload
    assert "count" not in payload
