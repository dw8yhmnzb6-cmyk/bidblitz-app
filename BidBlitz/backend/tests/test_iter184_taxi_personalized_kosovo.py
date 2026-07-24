"""Iteration 184 - Taxi Kosovo city pricing profiles and operator status regression."""

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


@pytest.fixture
def admin_session(base_url: str) -> requests.Session:
    # module: auth for operator status regression endpoint
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    login = session.post(
        f"{base_url}/api/auth/login",
        json={"email": "admin@bidblitz.com", "password": "BidBlitz2026!", "remember_me": True},
        timeout=25,
    )
    if login.status_code != 200:
        pytest.skip("Admin login failed; cannot verify /api/taxi/operator/status")
    return session


# module: city-specific Kosovo fare profile - Prishtina
def test_estimate_prishtina_region_profile(api_client, base_url):
    payload = {
        "pickup_lat": 42.6629,
        "pickup_lng": 21.1655,
        "dropoff_lat": 42.6486,
        "dropoff_lng": 21.1673,
    }
    response = api_client.post(f"{base_url}/api/taxi/estimate", json=payload, timeout=25)
    assert response.status_code == 200
    data = response.json()

    assert data.get("region") == "kosovo_prishtina"
    assert "Prishtina-Tarif" in (data.get("region_label") or "")
    estimates = data.get("estimates") or []
    assert len(estimates) >= 1
    for item in estimates:
        breakdown = item.get("fare_breakdown") or {}
        assert breakdown.get("base_fare") == 2.0


# module: city-specific Kosovo fare profile - Prizren
def test_estimate_prizren_region_profile(api_client, base_url):
    payload = {
        "pickup_lat": 42.2139,
        "pickup_lng": 20.7397,
        "dropoff_lat": 42.2098,
        "dropoff_lng": 20.7420,
    }
    response = api_client.post(f"{base_url}/api/taxi/estimate", json=payload, timeout=25)
    assert response.status_code == 200
    data = response.json()

    assert data.get("region") == "kosovo_prizren"
    assert "Prizren-Tarif" in (data.get("region_label") or "")
    estimates = data.get("estimates") or []
    assert len(estimates) >= 1
    for item in estimates:
        breakdown = item.get("fare_breakdown") or {}
        assert breakdown.get("base_fare") == 2.0


# module: city-specific Kosovo fare profile - Peja
def test_estimate_peja_region_profile(api_client, base_url):
    payload = {
        "pickup_lat": 42.6590,
        "pickup_lng": 20.2890,
        "dropoff_lat": 42.6558,
        "dropoff_lng": 20.2946,
    }
    response = api_client.post(f"{base_url}/api/taxi/estimate", json=payload, timeout=25)
    assert response.status_code == 200
    data = response.json()

    assert data.get("region") == "kosovo_peja"
    assert "Peja-Tarif" in (data.get("region_label") or "")
    estimates = data.get("estimates") or []
    assert len(estimates) >= 1
    for item in estimates:
        breakdown = item.get("fare_breakdown") or {}
        assert breakdown.get("base_fare") == 2.0


# module: regression - /operator/status must not return favorite-locations payload
def test_operator_status_returns_operator_contract(admin_session, base_url):
    response = admin_session.get(f"{base_url}/api/taxi/operator/status", timeout=25)
    assert response.status_code == 200
    data = response.json()

    assert "favorites" not in data
    assert "count" not in data
    assert "is_operator" in data
