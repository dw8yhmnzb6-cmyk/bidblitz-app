import os
import time
from typing import Any

import pytest
import requests


# Admin Customer Intelligence Radar Rule Center API contracts
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


def _admin_overview(session: requests.Session, base_url: str) -> dict[str, Any]:
    response = session.get(f"{base_url}/api/admin/customer-intelligence/overview?days=365", timeout=30)
    assert response.status_code == 200
    payload = response.json()
    assert payload.get("ok") is True
    return payload


def _create_rule_payload(overview: dict[str, Any], suffix: str = "") -> dict[str, Any]:
    templates = overview.get("campaign_templates") or []
    assert isinstance(templates, list)
    assert len(templates) > 0
    template_id = templates[0].get("template_id", "")
    assert template_id
    now = int(time.time())
    return {
        "name": f"QA Rule {suffix or now}",
        "template_id": template_id,
        "segment": "all",
        "trigger_type": "customer_near_shop",
        "min_total_revenue": 0,
        "max_distance_km": 50,
        "cooldown_hours": 24,
        "daily_cap": 1,
        "active": True,
    }


def test_overview_includes_automation_rules_and_existing_panels(base_url: str, api_client: requests.Session):
    login = _login(api_client, base_url, ADMIN_EMAIL, ADMIN_PASSWORD)
    assert login.status_code == 200
    payload = _admin_overview(api_client, base_url)

    for key in ["automation_rules", "campaign_templates", "campaign_metrics", "radar_history"]:
        assert key in payload
    assert isinstance(payload["automation_rules"], list)
    assert isinstance(payload["campaign_templates"], list)
    assert isinstance(payload["campaign_metrics"], dict)
    assert isinstance(payload["radar_history"], list)
    assert _contains_forbidden_serialization(payload) is False


def test_rules_endpoints_reject_unauthenticated(base_url: str, api_client: requests.Session):
    list_res = api_client.get(f"{base_url}/api/admin/customer-intelligence/radar/rules", timeout=25)
    assert list_res.status_code in (401, 403)

    create_res = api_client.post(
        f"{base_url}/api/admin/customer-intelligence/radar/rules",
        json={
            "name": "QA Unauth Rule",
            "template_id": "tpl-vip-near-shop",
            "segment": "all",
            "trigger_type": "customer_near_shop",
            "min_total_revenue": 0,
            "max_distance_km": 1,
            "cooldown_hours": 24,
            "daily_cap": 1,
            "active": True,
        },
        timeout=25,
    )
    assert create_res.status_code in (401, 403)

    run_res = api_client.post(
        f"{base_url}/api/admin/customer-intelligence/radar/rules/run",
        json={"rule_id": "rule-nonexistent", "dry_run": True, "days": 365},
        timeout=25,
    )
    assert run_res.status_code in (401, 403)


def test_rules_endpoints_reject_non_admin(base_url: str, api_client: requests.Session):
    login = _login(api_client, base_url, NON_ADMIN_EMAIL, NON_ADMIN_PASSWORD)
    assert login.status_code == 200

    list_res = api_client.get(f"{base_url}/api/admin/customer-intelligence/radar/rules", timeout=25)
    assert list_res.status_code == 403

    create_res = api_client.post(
        f"{base_url}/api/admin/customer-intelligence/radar/rules",
        json={
            "name": "QA NonAdmin Rule",
            "template_id": "tpl-vip-near-shop",
            "segment": "all",
            "trigger_type": "customer_near_shop",
            "min_total_revenue": 0,
            "max_distance_km": 1,
            "cooldown_hours": 24,
            "daily_cap": 1,
            "active": True,
        },
        timeout=25,
    )
    assert create_res.status_code == 403

    run_res = api_client.post(
        f"{base_url}/api/admin/customer-intelligence/radar/rules/run",
        json={"rule_id": "rule-nonexistent", "dry_run": True, "days": 365},
        timeout=25,
    )
    assert run_res.status_code == 403


def test_admin_can_create_rule_and_list_contains_it(base_url: str, api_client: requests.Session):
    login = _login(api_client, base_url, ADMIN_EMAIL, ADMIN_PASSWORD)
    assert login.status_code == 200
    overview = _admin_overview(api_client, base_url)
    payload = _create_rule_payload(overview)

    create_res = api_client.post(
        f"{base_url}/api/admin/customer-intelligence/radar/rules",
        json=payload,
        timeout=30,
    )
    assert create_res.status_code == 200
    create_data = create_res.json()
    assert create_data.get("ok") is True
    rule = create_data.get("rule") or {}
    assert rule.get("rule_id", "").startswith("rule-")
    assert rule.get("template_id") == payload["template_id"]
    assert rule.get("segment") == payload["segment"]
    assert rule.get("min_total_revenue") == payload["min_total_revenue"]
    assert rule.get("max_distance_km") == payload["max_distance_km"]
    assert rule.get("cooldown_hours") == payload["cooldown_hours"]
    assert rule.get("daily_cap") == payload["daily_cap"]
    assert _contains_forbidden_serialization(create_data) is False

    list_res = api_client.get(f"{base_url}/api/admin/customer-intelligence/radar/rules", timeout=30)
    assert list_res.status_code == 200
    list_data = list_res.json()
    assert list_data.get("ok") is True
    rules = list_data.get("rules") or []
    assert any(item.get("rule_id") == rule["rule_id"] for item in rules)
    assert _contains_forbidden_serialization(list_data) is False


def test_run_rule_dry_run_true_simulates_without_writing_actions(base_url: str, api_client: requests.Session):
    login = _login(api_client, base_url, ADMIN_EMAIL, ADMIN_PASSWORD)
    assert login.status_code == 200

    before_overview = _admin_overview(api_client, base_url)
    before_total_actions = (before_overview.get("campaign_metrics") or {}).get("total_actions", 0)

    payload = _create_rule_payload(before_overview, suffix="dry")
    create_res = api_client.post(f"{base_url}/api/admin/customer-intelligence/radar/rules", json=payload, timeout=30)
    assert create_res.status_code == 200
    rule_id = (create_res.json().get("rule") or {}).get("rule_id", "")
    assert rule_id

    run_res = api_client.post(
        f"{base_url}/api/admin/customer-intelligence/radar/rules/run",
        json={"rule_id": rule_id, "dry_run": True, "days": 365},
        timeout=40,
    )
    assert run_res.status_code == 200
    run_data = run_res.json()
    assert run_data.get("ok") is True
    run_payload = run_data.get("run") or {}
    assert run_payload.get("rule_id") == rule_id
    assert run_payload.get("dry_run") is True
    assert isinstance(run_payload.get("run_id"), str) and run_payload.get("run_id")
    for key in ["match_count", "executed_count", "skipped_count", "context_summary"]:
        assert key in run_payload
    for item in run_payload.get("executed", [])[:5]:
        assert item.get("status") == "would_execute"
    assert _contains_forbidden_serialization(run_data) is False

    after_overview = _admin_overview(api_client, base_url)
    after_total_actions = (after_overview.get("campaign_metrics") or {}).get("total_actions", 0)
    assert after_total_actions == before_total_actions


def test_run_rule_dry_run_false_executes_actions_and_respects_caps(base_url: str, api_client: requests.Session):
    login = _login(api_client, base_url, ADMIN_EMAIL, ADMIN_PASSWORD)
    assert login.status_code == 200

    overview = _admin_overview(api_client, base_url)
    payload = _create_rule_payload(overview, suffix="live")
    payload["daily_cap"] = 1
    payload["cooldown_hours"] = 24

    create_res = api_client.post(f"{base_url}/api/admin/customer-intelligence/radar/rules", json=payload, timeout=30)
    assert create_res.status_code == 200
    rule_id = (create_res.json().get("rule") or {}).get("rule_id", "")
    assert rule_id

    first_run = api_client.post(
        f"{base_url}/api/admin/customer-intelligence/radar/rules/run",
        json={"rule_id": rule_id, "dry_run": False, "days": 365},
        timeout=45,
    )
    assert first_run.status_code == 200
    first_data = first_run.json()
    assert first_data.get("ok") is True
    first_run_payload = first_data.get("run") or {}
    assert first_run_payload.get("dry_run") is False
    assert first_run_payload.get("rule_id") == rule_id
    assert isinstance(first_run_payload.get("run_id"), str) and first_run_payload.get("run_id")
    assert _contains_forbidden_serialization(first_data) is False

    if first_run_payload.get("executed_count", 0) > 0:
        history_res = api_client.get(f"{base_url}/api/admin/customer-intelligence/radar/history?limit=120", timeout=35)
        assert history_res.status_code == 200
        history_data = history_res.json()
        assert history_data.get("ok") is True
        history = history_data.get("history") or []
        automation_rows = [
            row
            for row in history
            if row.get("rule_id") == rule_id and row.get("source") == "automation_rule"
        ]
        assert len(automation_rows) >= 1
        assert _contains_forbidden_serialization(history_data) is False

        second_run = api_client.post(
            f"{base_url}/api/admin/customer-intelligence/radar/rules/run",
            json={"rule_id": rule_id, "dry_run": False, "days": 365},
            timeout=45,
        )
        assert second_run.status_code == 200
        second_data = second_run.json()
        second_payload = second_data.get("run") or {}
        assert second_payload.get("executed_count", 0) <= payload["daily_cap"]
        assert second_payload.get("skipped_count", 0) >= 0
        assert _contains_forbidden_serialization(second_data) is False
    else:
        pytest.skip("No executable matches in current dataset for live run; contract validated but persistence branch unavailable")
