import os
from typing import Any

import pytest
import requests


# Admin Customer Intelligence + auth contract tests
ADMIN_EMAIL = "admin@bidblitz.com"
ADMIN_PASSWORD = "BidBlitz2026!"
NON_ADMIN_EMAIL = "haendler@bidblitz.com"
NON_ADMIN_PASSWORD = "Haendler2026!"


def _contains_forbidden_serialization(value: Any) -> bool:
    if isinstance(value, dict):
        if "_id" in value:
            return True
        return any(_contains_forbidden_serialization(v) for v in value.values())
    if isinstance(value, list):
        return any(_contains_forbidden_serialization(v) for v in value)
    if isinstance(value, str) and "ObjectId(" in value:
        return True
    return False


@pytest.fixture(scope="module")
def base_url() -> str:
    raw = os.environ.get("REACT_APP_BACKEND_URL")
    if not raw:
        pytest.skip("REACT_APP_BACKEND_URL not set")
    return raw.rstrip("/")


@pytest.fixture()
def api_client() -> requests.Session:
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


def _login(session: requests.Session, base_url: str, email: str, password: str) -> requests.Response:
    return session.post(
        f"{base_url}/api/auth/login",
        json={"email": email, "password": password},
        timeout=25,
    )


def test_admin_login_sets_httponly_cookie(base_url: str, api_client: requests.Session):
    response = _login(api_client, base_url, ADMIN_EMAIL, ADMIN_PASSWORD)
    assert response.status_code == 200
    payload = response.json()
    assert payload.get("email") == ADMIN_EMAIL
    set_cookie = response.headers.get("set-cookie", "")
    assert "HttpOnly" in set_cookie


def test_customer_intelligence_overview_rejects_unauthenticated(base_url: str, api_client: requests.Session):
    response = api_client.get(f"{base_url}/api/admin/customer-intelligence/overview?days=365", timeout=25)
    assert response.status_code in (401, 403)


def test_customer_intelligence_overview_rejects_non_admin(base_url: str, api_client: requests.Session):
    login = _login(api_client, base_url, NON_ADMIN_EMAIL, NON_ADMIN_PASSWORD)
    assert login.status_code == 200
    response = api_client.get(f"{base_url}/api/admin/customer-intelligence/overview?days=365", timeout=25)
    assert response.status_code == 403


def test_customer_intelligence_overview_contract_and_no_objectid(base_url: str, api_client: requests.Session):
    login = _login(api_client, base_url, ADMIN_EMAIL, ADMIN_PASSWORD)
    assert login.status_code == 200

    response = api_client.get(f"{base_url}/api/admin/customer-intelligence/overview?days=365", timeout=30)
    assert response.status_code == 200
    payload = response.json()

    assert payload.get("ok") is True
    for key in [
        "summary",
        "top_customers",
        "recent_seconds_purchases",
        "recent_customer_events",
        "map",
        "timeline_monthly",
        "timeline_yearly",
    ]:
        assert key in payload

    assert "customers" in payload["map"]
    assert "stores" in payload["map"]
    assert isinstance(payload["top_customers"], list)
    assert isinstance(payload["recent_seconds_purchases"], list)
    assert isinstance(payload["recent_customer_events"], list)
    assert isinstance(payload["timeline_monthly"], list)
    assert isinstance(payload["timeline_yearly"], list)
    assert _contains_forbidden_serialization(payload) is False


def test_customer_intelligence_customer_contract_and_no_objectid(base_url: str, api_client: requests.Session):
    login = _login(api_client, base_url, ADMIN_EMAIL, ADMIN_PASSWORD)
    assert login.status_code == 200

    overview = api_client.get(f"{base_url}/api/admin/customer-intelligence/overview?days=365", timeout=30)
    assert overview.status_code == 200
    overview_data = overview.json()

    candidate_user_id = None
    for row in overview_data.get("top_customers", []):
        user_id = (row.get("user") or {}).get("user_id")
        if user_id:
            candidate_user_id = user_id
            break

    if not candidate_user_id:
        for marker in (overview_data.get("map") or {}).get("customers", []):
            user_id = (marker.get("user") or {}).get("user_id")
            if user_id:
                candidate_user_id = user_id
                break

    if not candidate_user_id:
        pytest.skip("No customer found in overview response to run detail endpoint test")

    detail = api_client.get(
        f"{base_url}/api/admin/customer-intelligence/customer/{candidate_user_id}?days=365",
        timeout=30,
    )
    assert detail.status_code == 200
    payload = detail.json()

    assert payload.get("ok") is True
    for key in [
        "customer",
        "summary",
        "seconds_purchases",
        "commerce_events",
        "pos_events",
        "locations",
        "store_visit_matches",
    ]:
        assert key in payload
    assert _contains_forbidden_serialization(payload) is False


def test_auth_preflight_has_credentials_and_explicit_origin(base_url: str, api_client: requests.Session):
    response = api_client.options(
        f"{base_url}/api/auth/login",
        headers={
            "Origin": "https://biometric-checkout-7.preview.emergentagent.com",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
        timeout=20,
    )
    assert response.status_code in (200, 204)
    allow_credentials = response.headers.get("access-control-allow-credentials", "")
    allow_origin = response.headers.get("access-control-allow-origin", "")
    assert allow_credentials.lower() == "true"
    assert allow_origin and allow_origin != "*"


def test_auth_bruteforce_lockout_after_five_failures(base_url: str, api_client: requests.Session):
    email = "bruteforce.qa.customer@example.com"
    statuses = []
    for _ in range(6):
        response = _login(api_client, base_url, email, "wrong-password")
        statuses.append(response.status_code)

    assert statuses[:5] == [401, 401, 401, 401, 401]
    assert statuses[5] == 429
