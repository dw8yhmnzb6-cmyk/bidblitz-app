import os
import time
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


def _pick_radar_target(overview_payload: dict[str, Any]) -> dict[str, str]:
    alerts = overview_payload.get("radar_alerts") or []
    for alert in alerts:
        user_id = (alert.get("user") or {}).get("user_id")
        if user_id:
            store = alert.get("store") or {}
            return {
                "user_id": user_id,
                "alert_id": alert.get("alert_id", ""),
                "store_id": store.get("store_id", ""),
                "merchant_id": store.get("merchant_id", ""),
            }

    top_customers = overview_payload.get("top_customers") or []
    for row in top_customers:
        user_id = (row.get("user") or {}).get("user_id")
        if user_id:
            return {
                "user_id": user_id,
                "alert_id": "",
                "store_id": "",
                "merchant_id": "",
            }

    markers = ((overview_payload.get("map") or {}).get("customers") or [])
    for marker in markers:
        user_id = (marker.get("user") or {}).get("user_id")
        if user_id:
            return {
                "user_id": user_id,
                "alert_id": "",
                "store_id": "",
                "merchant_id": "",
            }

    return {}


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
        "radar_alerts",
        "segments",
        "heatmap",
        "privacy_policy",
        "campaign_templates",
        "campaign_metrics",
        "radar_history",
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
    assert isinstance(payload["campaign_templates"], list)
    assert isinstance(payload["campaign_metrics"], dict)
    assert isinstance(payload["radar_history"], list)

    # New Live Radar + Segments + Heatmap + Privacy contract assertions
    assert isinstance(payload["radar_alerts"], list)
    assert isinstance(payload["segments"], dict)
    assert isinstance(payload["heatmap"], list)
    assert isinstance(payload["privacy_policy"], dict)

    for segment_key in ["vip_seconds_buyers", "omnichannel_buyers", "pos_loyalists", "dormant_high_value"]:
        assert segment_key in payload["segments"]
        assert isinstance(payload["segments"][segment_key], list)
        for row in payload["segments"][segment_key][:3]:
            assert "user" in row
            assert "total_revenue" in row
            assert "seconds_revenue" in row
            assert "seconds_credits" in row
            assert "channels" in row
            assert "last_event_at" in row

    for cell in payload["heatmap"][:3]:
        for key in ["cell_id", "lat", "lng", "customers", "revenue", "intensity"]:
            assert key in cell

    for alert in payload["radar_alerts"][:3]:
        for key in ["severity", "title", "message", "recommended_action"]:
            assert key in alert

    for key in [
        "status",
        "precise_location_retention_hours",
        "aggregated_analytics_retention_days",
        "admin_access",
        "consent_mode",
        "recommended_next_step",
    ]:
        assert key in payload["privacy_policy"]

    for metric_key in [
        "total_actions",
        "coupons_issued",
        "coupons_redeemed",
        "redemption_rate",
        "coupon_value_issued",
        "by_type",
        "by_template",
        "daily",
    ]:
        assert metric_key in payload["campaign_metrics"]

    for template in payload["campaign_templates"][:5]:
        for template_key in ["template_id", "name", "action_type", "coupon_value", "message", "segment", "active"]:
            assert template_key in template

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
    email = f"bruteforce.qa.customer+{int(time.time() * 1000)}@example.com"
    statuses = []
    for _ in range(6):
        response = _login(api_client, base_url, email, "wrong-password")
        statuses.append(response.status_code)

    assert statuses[:5] == [401, 401, 401, 401, 401]
    assert statuses[5] == 429


# Radar action endpoint contracts and authorization checks
def test_radar_action_rejects_unauthenticated(base_url: str, api_client: requests.Session):
    response = api_client.post(
        f"{base_url}/api/admin/customer-intelligence/radar/action",
        json={"action_type": "coupon", "user_id": "non-existent"},
        timeout=25,
    )
    assert response.status_code in (401, 403)


def test_radar_action_rejects_non_admin(base_url: str, api_client: requests.Session):
    login = _login(api_client, base_url, NON_ADMIN_EMAIL, NON_ADMIN_PASSWORD)
    assert login.status_code == 200

    response = api_client.post(
        f"{base_url}/api/admin/customer-intelligence/radar/action",
        json={"action_type": "coupon", "user_id": "non-existent"},
        timeout=25,
    )
    assert response.status_code == 403


def test_radar_templates_reject_unauthenticated(base_url: str, api_client: requests.Session):
    response = api_client.post(
        f"{base_url}/api/admin/customer-intelligence/radar/templates",
        json={
            "name": "QA unauth template",
            "action_type": "coupon_push_alert",
            "coupon_value": 6,
            "message": "Template should be blocked",
            "segment": "all",
            "active": True,
        },
        timeout=25,
    )
    assert response.status_code in (401, 403)


def test_radar_history_reject_unauthenticated(base_url: str, api_client: requests.Session):
    response = api_client.get(
        f"{base_url}/api/admin/customer-intelligence/radar/history?limit=20",
        timeout=25,
    )
    assert response.status_code in (401, 403)


def test_radar_templates_reject_non_admin(base_url: str, api_client: requests.Session):
    login = _login(api_client, base_url, NON_ADMIN_EMAIL, NON_ADMIN_PASSWORD)
    assert login.status_code == 200

    response = api_client.post(
        f"{base_url}/api/admin/customer-intelligence/radar/templates",
        json={
            "name": "QA non-admin template",
            "action_type": "coupon_push_alert",
            "coupon_value": 6,
            "message": "Template should be blocked",
            "segment": "all",
            "active": True,
        },
        timeout=25,
    )
    assert response.status_code == 403


def test_radar_history_reject_non_admin(base_url: str, api_client: requests.Session):
    login = _login(api_client, base_url, NON_ADMIN_EMAIL, NON_ADMIN_PASSWORD)
    assert login.status_code == 200

    response = api_client.get(
        f"{base_url}/api/admin/customer-intelligence/radar/history?limit=20",
        timeout=25,
    )
    assert response.status_code == 403


def test_radar_template_create_and_apply_sets_template_id(
    base_url: str, api_client: requests.Session, admin_radar_target: dict[str, str]
):
    login = _login(api_client, base_url, ADMIN_EMAIL, ADMIN_PASSWORD)
    assert login.status_code == 200

    template_payload = {
        "name": f"QA Template {int(time.time())}",
        "action_type": "coupon_push_alert",
        "coupon_value": 9.0,
        "message": "QA template apply message",
        "segment": "all",
        "active": True,
    }
    create_response = api_client.post(
        f"{base_url}/api/admin/customer-intelligence/radar/templates",
        json=template_payload,
        timeout=30,
    )
    assert create_response.status_code == 200
    created = create_response.json()
    assert created.get("ok") is True
    created_template = created.get("template") or {}
    assert created_template.get("template_id", "").startswith("tpl-")
    assert created_template.get("name") == template_payload["name"]
    assert created_template.get("action_type") == template_payload["action_type"]
    assert created_template.get("message") == template_payload["message"]

    action_response = api_client.post(
        f"{base_url}/api/admin/customer-intelligence/radar/action",
        json={
            "action_type": "coupon",
            "user_id": admin_radar_target["user_id"],
            "alert_id": admin_radar_target.get("alert_id", ""),
            "store_id": admin_radar_target.get("store_id", ""),
            "merchant_id": admin_radar_target.get("merchant_id", ""),
            "template_id": created_template["template_id"],
            "message": "",
            "coupon_value": 1,
        },
        timeout=30,
    )
    assert action_response.status_code == 200
    action_data = action_response.json()
    assert action_data.get("ok") is True
    assert action_data.get("action", {}).get("template_id") == created_template["template_id"]
    assert action_data.get("action", {}).get("action_type") == "coupon_push_alert"
    assert action_data.get("coupon") and action_data["coupon"].get("code", "").startswith("RADAR-")
    assert action_data.get("notification") and action_data["notification"].get("notif_id")
    assert action_data.get("manager_alert") and action_data["manager_alert"].get("alert_id", "").startswith("MRA-")
    assert _contains_forbidden_serialization(action_data) is False

    history_response = api_client.get(
        f"{base_url}/api/admin/customer-intelligence/radar/history?limit=40",
        timeout=30,
    )
    assert history_response.status_code == 200
    history_data = history_response.json()
    assert history_data.get("ok") is True
    assert isinstance(history_data.get("history"), list)
    assert isinstance(history_data.get("metrics"), dict)
    matched = [
        item for item in (history_data.get("history") or [])
        if item.get("template_id") == created_template["template_id"]
    ]
    assert len(matched) >= 1
    assert _contains_forbidden_serialization(history_data) is False


@pytest.fixture()
def admin_radar_target(base_url: str) -> dict[str, str]:
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    login = _login(session, base_url, ADMIN_EMAIL, ADMIN_PASSWORD)
    if login.status_code != 200:
        pytest.skip("Admin login failed")

    overview = session.get(f"{base_url}/api/admin/customer-intelligence/overview?days=365", timeout=30)
    if overview.status_code != 200:
        pytest.skip("Overview endpoint unavailable")

    target = _pick_radar_target(overview.json())
    if not target.get("user_id"):
        pytest.skip("No user found for radar action test")
    return target


def test_radar_action_coupon_creates_contract_no_objectid(
    base_url: str, api_client: requests.Session, admin_radar_target: dict[str, str]
):
    login = _login(api_client, base_url, ADMIN_EMAIL, ADMIN_PASSWORD)
    assert login.status_code == 200

    payload = {
        "action_type": "coupon",
        "user_id": admin_radar_target["user_id"],
        "alert_id": admin_radar_target.get("alert_id", ""),
        "store_id": admin_radar_target.get("store_id", ""),
        "merchant_id": admin_radar_target.get("merchant_id", ""),
        "coupon_value": 7.5,
        "message": "QA coupon action",
    }
    response = api_client.post(f"{base_url}/api/admin/customer-intelligence/radar/action", json=payload, timeout=30)
    assert response.status_code == 200
    data = response.json()

    assert data.get("ok") is True
    assert data.get("action", {}).get("action_type") == "coupon"
    assert data.get("coupon") and data["coupon"].get("code", "").startswith("RADAR-")
    assert data.get("notification") is None
    assert data.get("manager_alert") is None
    assert data.get("action", {}).get("coupon_code") == data["coupon"].get("code")
    assert _contains_forbidden_serialization(data) is False


def test_radar_action_push_best_effort_and_contract(
    base_url: str, api_client: requests.Session, admin_radar_target: dict[str, str]
):
    login = _login(api_client, base_url, ADMIN_EMAIL, ADMIN_PASSWORD)
    assert login.status_code == 200

    payload = {
        "action_type": "push",
        "user_id": admin_radar_target["user_id"],
        "alert_id": admin_radar_target.get("alert_id", ""),
        "store_id": admin_radar_target.get("store_id", ""),
        "merchant_id": admin_radar_target.get("merchant_id", ""),
        "message": "QA push action",
    }
    response = api_client.post(f"{base_url}/api/admin/customer-intelligence/radar/action", json=payload, timeout=30)
    assert response.status_code == 200
    data = response.json()

    assert data.get("ok") is True
    assert data.get("action", {}).get("action_type") == "push"
    assert data.get("coupon") is None
    assert data.get("notification") and data["notification"].get("notif_id")
    assert data.get("action", {}).get("notification_id") == data["notification"].get("notif_id")
    assert _contains_forbidden_serialization(data) is False


def test_radar_action_manager_alert_contract(
    base_url: str, api_client: requests.Session, admin_radar_target: dict[str, str]
):
    login = _login(api_client, base_url, ADMIN_EMAIL, ADMIN_PASSWORD)
    assert login.status_code == 200

    payload = {
        "action_type": "manager_alert",
        "user_id": admin_radar_target["user_id"],
        "alert_id": admin_radar_target.get("alert_id", ""),
        "store_id": admin_radar_target.get("store_id", ""),
        "merchant_id": admin_radar_target.get("merchant_id", ""),
        "message": "QA manager alert",
    }
    response = api_client.post(f"{base_url}/api/admin/customer-intelligence/radar/action", json=payload, timeout=30)
    assert response.status_code == 200
    data = response.json()

    assert data.get("ok") is True
    assert data.get("action", {}).get("action_type") == "manager_alert"
    assert data.get("coupon") is None
    assert data.get("notification") is None
    assert data.get("manager_alert") and data["manager_alert"].get("alert_id", "").startswith("MRA-")
    assert data.get("action", {}).get("manager_alert_id") == data["manager_alert"].get("alert_id")
    assert _contains_forbidden_serialization(data) is False


def test_radar_action_coupon_push_alert_returns_all_outputs(
    base_url: str, api_client: requests.Session, admin_radar_target: dict[str, str]
):
    login = _login(api_client, base_url, ADMIN_EMAIL, ADMIN_PASSWORD)
    assert login.status_code == 200

    payload = {
        "action_type": "coupon_push_alert",
        "user_id": admin_radar_target["user_id"],
        "alert_id": admin_radar_target.get("alert_id", ""),
        "store_id": admin_radar_target.get("store_id", ""),
        "merchant_id": admin_radar_target.get("merchant_id", ""),
        "coupon_value": 12,
        "message": "QA combined action",
    }
    response = api_client.post(f"{base_url}/api/admin/customer-intelligence/radar/action", json=payload, timeout=30)
    assert response.status_code == 200
    data = response.json()

    assert data.get("ok") is True
    assert data.get("action", {}).get("action_type") == "coupon_push_alert"
    assert data.get("coupon") and data["coupon"].get("code", "").startswith("RADAR-")
    assert data.get("notification") and data["notification"].get("notif_id")
    assert data.get("manager_alert") and data["manager_alert"].get("alert_id", "").startswith("MRA-")
    assert data.get("action", {}).get("coupon_code") == data["coupon"].get("code")
    assert data.get("action", {}).get("notification_id") == data["notification"].get("notif_id")
    assert data.get("action", {}).get("manager_alert_id") == data["manager_alert"].get("alert_id")
    assert _contains_forbidden_serialization(data) is False
