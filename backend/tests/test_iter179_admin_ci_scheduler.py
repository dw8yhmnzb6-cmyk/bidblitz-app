import os
import time
from typing import Any

import pytest
import requests


# Iteration 179: Customer intelligence scheduler + performance API contracts
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
def non_admin_session(base_url: str) -> requests.Session:
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    login = session.post(
        f"{base_url}/api/auth/login",
        json={"email": NON_ADMIN_EMAIL, "password": NON_ADMIN_PASSWORD},
        timeout=25,
    )
    assert login.status_code == 200
    return session


# Auth hardening checks required by playbook
def test_auth_login_sets_http_only_cookies(base_url: str):
    session = requests.Session()
    response = session.post(
        f"{base_url}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=25,
    )
    assert response.status_code == 200
    cookie_header = response.headers.get("set-cookie", "")
    lowered = cookie_header.lower()
    assert "access_token=" in lowered or "refresh_token=" in lowered
    assert "httponly" in lowered


def test_auth_bruteforce_lockout_after_five_attempts(base_url: str):
    # Use synthetic identifier to avoid locking shared test accounts
    session = requests.Session()
    bad_email = f"qa-lockout-{int(time.time())}@example.com"
    statuses = []
    for _ in range(6):
        res = session.post(
            f"{base_url}/api/auth/login",
            json={"email": bad_email, "password": "WrongPass123!"},
            timeout=20,
        )
        statuses.append(res.status_code)
    assert all(code == 401 for code in statuses[:5])
    assert statuses[5] == 429


def test_auth_cors_preflight_allows_credentials_and_explicit_origin(base_url: str):
    origin = "https://example.com"
    res = requests.options(
        f"{base_url}/api/auth/login",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
        timeout=20,
    )
    assert res.status_code in (200, 204)
    assert res.headers.get("access-control-allow-credentials") == "true"
    assert res.headers.get("access-control-allow-origin") == origin


# Scheduler startup + contract checks
def test_backend_startup_log_contains_scheduler_started():
    log_path = "/var/log/supervisor/backend.err.log"
    if not os.path.exists(log_path):
        pytest.skip("backend.err.log not found")
    with open(log_path, "r", encoding="utf-8") as f:
        content = f.read()
    assert "Customer radar automation scheduler started" in content


def test_overview_has_scheduler_and_rule_performance_no_objectid(base_url: str, admin_session: requests.Session):
    response = admin_session.get(f"{base_url}/api/admin/customer-intelligence/overview?days=365", timeout=40)
    assert response.status_code == 200
    data = response.json()
    assert data.get("ok") is True
    assert "scheduler_config" in data
    assert "rule_performance" in data

    scheduler_config = data.get("scheduler_config") or {}
    for key in ["enabled", "interval_minutes", "dry_run", "max_rules_per_tick", "days"]:
        assert key in scheduler_config

    perf = data.get("rule_performance") or {}
    for key in ["total_runs", "total_rule_actions", "rules"]:
        assert key in perf
    assert isinstance(perf.get("rules"), list)
    assert _contains_forbidden_serialization(data) is False


def test_scheduler_endpoints_require_admin_auth(base_url: str, non_admin_session: requests.Session):
    unauth = requests.Session()

    unauth_tick = unauth.post(f"{base_url}/api/admin/customer-intelligence/radar/scheduler/tick", timeout=25)
    assert unauth_tick.status_code == 401

    non_admin_get = non_admin_session.get(f"{base_url}/api/admin/customer-intelligence/radar/scheduler", timeout=25)
    assert non_admin_get.status_code == 403

    non_admin_update = non_admin_session.post(
        f"{base_url}/api/admin/customer-intelligence/radar/scheduler",
        json={"enabled": False, "interval_minutes": 15, "dry_run": True, "max_rules_per_tick": 3, "days": 365},
        timeout=25,
    )
    assert non_admin_update.status_code == 403

    non_admin_tick = non_admin_session.post(
        f"{base_url}/api/admin/customer-intelligence/radar/scheduler/tick",
        timeout=25,
    )
    assert non_admin_tick.status_code == 403


def test_update_scheduler_and_roundtrip_get(base_url: str, admin_session: requests.Session):
    payload = {
        "enabled": False,
        "interval_minutes": 17,
        "dry_run": True,
        "max_rules_per_tick": 2,
        "days": 365,
    }
    update_res = admin_session.post(
        f"{base_url}/api/admin/customer-intelligence/radar/scheduler",
        json=payload,
        timeout=30,
    )
    assert update_res.status_code == 200
    update_data = update_res.json()
    assert update_data.get("ok") is True
    cfg = update_data.get("config") or {}
    assert cfg.get("enabled") is False
    assert cfg.get("interval_minutes") == 17
    assert cfg.get("dry_run") is True
    assert cfg.get("max_rules_per_tick") == 2
    assert cfg.get("days") == 365

    get_res = admin_session.get(f"{base_url}/api/admin/customer-intelligence/radar/scheduler", timeout=35)
    assert get_res.status_code == 200
    get_data = get_res.json()
    assert get_data.get("ok") is True
    get_cfg = get_data.get("config") or {}
    assert get_cfg.get("enabled") is False
    assert get_cfg.get("interval_minutes") == 17
    assert get_cfg.get("dry_run") is True
    assert get_cfg.get("max_rules_per_tick") == 2
    assert _contains_forbidden_serialization(get_data) is False


def test_manual_tick_respects_max_rules_per_tick_and_dry_run(base_url: str, admin_session: requests.Session):
    # Configure strict cap and dry-run before triggering manual tick
    config_payload = {
        "enabled": False,
        "interval_minutes": 15,
        "dry_run": True,
        "max_rules_per_tick": 1,
        "days": 365,
    }
    config_res = admin_session.post(
        f"{base_url}/api/admin/customer-intelligence/radar/scheduler",
        json=config_payload,
        timeout=30,
    )
    assert config_res.status_code == 200

    tick_res = admin_session.post(f"{base_url}/api/admin/customer-intelligence/radar/scheduler/tick", timeout=50)
    assert tick_res.status_code == 200
    tick_data = tick_res.json()
    assert tick_data.get("ok") is True
    tick = tick_data.get("tick") or {}
    runs = tick.get("runs") or []
    assert tick.get("dry_run") is True
    assert int(tick.get("rules_checked", 0)) <= 1
    assert len(runs) <= 1
    for run in runs:
        if run.get("error"):
            continue
        assert run.get("dry_run") is True
    assert _contains_forbidden_serialization(tick_data) is False


def test_scheduler_get_contains_config_performance_ticks(base_url: str, admin_session: requests.Session):
    res = admin_session.get(f"{base_url}/api/admin/customer-intelligence/radar/scheduler", timeout=35)
    assert res.status_code == 200
    data = res.json()
    assert data.get("ok") is True
    assert isinstance(data.get("config"), dict)
    assert isinstance(data.get("performance"), dict)
    assert isinstance(data.get("ticks"), list)
    if data.get("ticks"):
        latest = data["ticks"][0]
        for key in ["tick_id", "reason", "dry_run", "rules_checked", "runs", "created_at"]:
            assert key in latest
    assert _contains_forbidden_serialization(data) is False


def test_rule_performance_aggregate_shape(base_url: str, admin_session: requests.Session):
    res = admin_session.get(f"{base_url}/api/admin/customer-intelligence/radar/scheduler", timeout=35)
    assert res.status_code == 200
    perf = (res.json().get("performance") or {})
    assert isinstance(perf.get("total_runs"), int)
    assert isinstance(perf.get("total_rule_actions"), int)
    rules = perf.get("rules") or []
    assert isinstance(rules, list)
    if rules:
        first = rules[0]
        for key in ["rule_id", "runs", "matches", "executed", "skipped", "actions", "coupon_codes", "last_run_at"]:
            assert key in first