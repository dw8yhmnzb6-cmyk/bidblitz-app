import os
import time
from typing import Any

import pytest
import requests


# Iteration 178: Admin Customer Intelligence VIP rule contracts
ADMIN_EMAIL = "admin@bidblitz.com"
ADMIN_PASSWORD = "BidBlitz2026!"


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


@pytest.fixture(scope="module")
def admin_session(base_url: str) -> requests.Session:
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    login = session.post(
        f"{base_url}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=25,
    )
    assert login.status_code == 200
    return session


@pytest.fixture(scope="module")
def vip_rule_id(base_url: str, admin_session: requests.Session) -> str:
    overview = admin_session.get(f"{base_url}/api/admin/customer-intelligence/overview?days=365", timeout=40)
    assert overview.status_code == 200
    overview_data = overview.json()
    templates = overview_data.get("campaign_templates") or []
    assert len(templates) > 0
    template_id = templates[0].get("template_id")
    assert template_id

    payload = {
        "name": f"QA VIP Rule Iter178 {int(time.time())}",
        "template_id": template_id,
        "segment": "all",
        "trigger_type": "vip_seconds_buyer",
        "min_total_revenue": 0,
        "max_distance_km": 1,
        "cooldown_hours": 24,
        "daily_cap": 1,
        "active": True,
    }
    response = admin_session.post(
        f"{base_url}/api/admin/customer-intelligence/radar/rules",
        json=payload,
        timeout=35,
    )
    assert response.status_code == 200
    data = response.json()
    assert data.get("ok") is True
    rule = data.get("rule") or {}
    assert rule.get("trigger_type") == "vip_seconds_buyer"
    assert rule.get("segment") == "all"
    assert rule.get("min_total_revenue") == 0
    assert rule.get("daily_cap") == 1
    assert _contains_forbidden_serialization(data) is False
    return rule["rule_id"]


def test_create_rule_vip_contract_and_list(base_url: str, admin_session: requests.Session, vip_rule_id: str):
    list_res = admin_session.get(f"{base_url}/api/admin/customer-intelligence/radar/rules", timeout=35)
    assert list_res.status_code == 200
    list_data = list_res.json()
    assert list_data.get("ok") is True
    rules = list_data.get("rules") or []
    created = next((r for r in rules if r.get("rule_id") == vip_rule_id), None)
    assert created is not None
    assert created.get("trigger_type") == "vip_seconds_buyer"
    assert created.get("segment") == "all"
    assert created.get("daily_cap") == 1
    assert _contains_forbidden_serialization(list_data) is False


def test_run_rule_dry_run_match_and_daily_cap(base_url: str, admin_session: requests.Session, vip_rule_id: str):
    run_res = admin_session.post(
        f"{base_url}/api/admin/customer-intelligence/radar/rules/run",
        json={"rule_id": vip_rule_id, "dry_run": True, "days": 365},
        timeout=45,
    )
    assert run_res.status_code == 200
    run_data = run_res.json()
    assert run_data.get("ok") is True
    run = run_data.get("run") or {}
    assert run.get("rule_id") == vip_rule_id
    assert run.get("dry_run") is True
    assert run.get("match_count", 0) > 0
    assert run.get("executed_count", 0) <= 1
    assert _contains_forbidden_serialization(run_data) is False


def test_run_rule_live_persists_actions_and_cooldown_skip(base_url: str, admin_session: requests.Session, vip_rule_id: str):
    first_live = admin_session.post(
        f"{base_url}/api/admin/customer-intelligence/radar/rules/run",
        json={"rule_id": vip_rule_id, "dry_run": False, "days": 365},
        timeout=45,
    )
    assert first_live.status_code == 200
    first_data = first_live.json()
    assert first_data.get("ok") is True
    first_run = first_data.get("run") or {}
    assert first_run.get("rule_id") == vip_rule_id
    assert first_run.get("dry_run") is False
    assert first_run.get("match_count", 0) > 0
    assert first_run.get("executed_count", 0) >= 1
    assert first_run.get("executed_count", 0) <= 1

    executed = first_run.get("executed") or []
    assert len(executed) >= 1
    assert executed[0].get("rule_id") == vip_rule_id
    assert executed[0].get("source") == "automation_rule"

    history_res = admin_session.get(f"{base_url}/api/admin/customer-intelligence/radar/history?limit=200", timeout=35)
    assert history_res.status_code == 200
    history_data = history_res.json()
    assert history_data.get("ok") is True
    history_rows = history_data.get("history") or []
    persisted = [
        row
        for row in history_rows
        if row.get("rule_id") == vip_rule_id and row.get("source") == "automation_rule"
    ]
    assert len(persisted) >= 1

    second_live = admin_session.post(
        f"{base_url}/api/admin/customer-intelligence/radar/rules/run",
        json={"rule_id": vip_rule_id, "dry_run": False, "days": 365},
        timeout=45,
    )
    assert second_live.status_code == 200
    second_data = second_live.json()
    second_run = second_data.get("run") or {}
    assert second_run.get("rule_id") == vip_rule_id
    assert second_run.get("skipped_count", 0) >= 1
    assert _contains_forbidden_serialization(first_data) is False
    assert _contains_forbidden_serialization(history_data) is False
    assert _contains_forbidden_serialization(second_data) is False
