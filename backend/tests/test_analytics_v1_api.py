"""HTTP contract tests with fake auth/DB; no production connections or data."""
from datetime import datetime, timedelta
import importlib.util
import sys
from pathlib import Path
from types import ModuleType, SimpleNamespace
from typing import get_args

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from core.analytics_event_schema import ProjectName


@pytest.fixture
def api(monkeypatch):
    state = SimpleNamespace(user={"role": "admin"}, auth_error=None,
                            rows=[], pipelines=[], limits=[])
    class Cursor:
        async def to_list(self, length):
            state.limits.append(length)
            return state.rows[:length]
    class Events:
        def aggregate(self, pipeline):
            state.pipelines.append(pipeline)
            return Cursor()
    async def current_user(request):
        if state.auth_error:
            raise state.auth_error
        return state.user
    database = ModuleType("core.database")
    database.db = SimpleNamespace(conversion_events=Events())
    security = ModuleType("core.security")
    security.get_current_user = current_user
    monkeypatch.setitem(sys.modules, "core.database", database)
    monkeypatch.setitem(sys.modules, "core.security", security)
    spec = importlib.util.spec_from_file_location(
        "analytics_v1_api_under_test", Path(__file__).parents[1] / "routes" / "analytics.py")
    routes = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(routes)
    app = FastAPI()
    app.include_router(routes.router)
    with TestClient(app) as client:
        yield client, state


def bucket(project, event="page_view", day="2026-10-27", count=1):
    return {"_id": {"project": project, "event": event, "day": day}, "count": count}


@pytest.mark.parametrize("path", ["/v1/portfolio", "/v1/projects/trade/overview"])
@pytest.mark.parametrize("role", ["customer", "project_admin", "merchant", None])
def test_non_admin_is_denied_before_database_read(api, path, role):
    client, state = api
    state.user = {"role": role, "analytics_projects": ["trade"], "is_admin": True}
    response = client.get("/api/analytics" + path)
    assert response.status_code == 403
    assert state.pipelines == []


@pytest.mark.parametrize("path", ["/v1/portfolio", "/v1/projects/trade/overview"])
def test_unauthenticated_request_has_no_database_read(api, path):
    client, state = api
    state.auth_error = HTTPException(401, "Not authenticated")
    assert client.get("/api/analytics" + path).status_code == 401
    assert state.pipelines == []


@pytest.mark.parametrize("days", [0, -1, 91, "abc"])
@pytest.mark.parametrize("path", ["/v1/portfolio", "/v1/projects/trade/overview"])
def test_invalid_period_rejected(api, days, path):
    client, state = api
    assert client.get("/api/analytics" + path, params={"days": days}).status_code == 422
    assert state.pipelines == []


def test_unknown_project_rejected_before_read(api):
    client, state = api
    assert client.get("/api/analytics/v1/projects/foreign-tenant/overview").status_code == 404
    assert state.pipelines == []


def test_portfolio_is_grouped_once_and_never_trusts_client_scope(api):
    client, state = api
    state.rows = [bucket("trade", count=4), bucket("eyes", count=7),
                  bucket("trade", "cta_click", count=2)]
    response = client.get("/api/analytics/v1/portfolio",
                          params={"days": 7, "projects": "foreign-tenant"},
                          headers={"X-Analytics-Projects": "foreign-tenant"})
    assert response.status_code == 200
    body = response.json()
    reports = {p["project"]: p for p in body["projects"]}
    assert set(reports) == set(get_args(ProjectName))
    assert reports["trade"]["totals"] == {"page_view": 4, "cta_click": 2}
    assert reports["eyes"]["totals"] == {"page_view": 7}
    assert reports["fuel"]["totals"] == {}
    assert body["timezone"] == "UTC"
    assert body["verified_revenue_included"] is False
    assert len(state.pipelines) == 1
    match = state.pipelines[0][0]["$match"]
    assert match["schema_version"] == 1
    assert match["project"] == {"$in": list(get_args(ProjectName))}
    assert set(match["received_at"]) == {"$gte", "$lte"}
    assert match["received_at"]["$lte"] == body["as_of"]
    assert (datetime.fromisoformat(body["as_of"]) -
            datetime.fromisoformat(match["received_at"]["$gte"])) == timedelta(days=7)
    assert "checkout_completed" in match["event"]["$in"]
    assert "first_payment" not in match["event"]["$in"]
    group = state.pipelines[0][1]["$group"]
    assert set(group) == {"_id", "count"}
    assert group["_id"]["project"] == "$project"
    assert state.limits == [len(get_args(ProjectName)) * 8 * 7]


def test_project_contract_preserves_isolation_and_does_not_expose_raw_fields(api):
    client, state = api
    state.rows = [{**bucket("trade", count=3), "ip": "sensitive", "user_id": "secret"},
                  bucket("eyes", count=999)]
    response = client.get("/api/analytics/v1/projects/trade/overview?days=1")
    assert response.status_code == 200
    assert response.json() == {
        "project": "trade", "period_days": 1, "totals": {"page_view": 3},
        "daily": {"2026-10-27": {"page_view": 3}},
        "verified_revenue_included": False, "data_scope": "v1_project_events_only",
    }
    assert state.pipelines[0][0]["$match"]["project"] == {"$in": ["trade"]}


def test_empty_collection_is_empty_recorded_data_not_invented_metrics(api):
    client, state = api
    body = client.get("/api/analytics/v1/portfolio").json()
    assert len(body["projects"]) == len(get_args(ProjectName))
    assert all(p["totals"] == {} and p["daily"] == {} for p in body["projects"])
    assert all(p["verified_revenue_included"] is False for p in body["projects"])


def test_max_window_has_room_for_every_calendar_bucket(api):
    client, state = api
    state.rows = [bucket(p, event, f"day-{day}") for p in get_args(ProjectName)
                  for day in range(91) for event in ["page_view", "cta_click", "signup_started",
                  "signup_completed", "checkout_started", "checkout_completed", "flow_abandoned"]]
    body = client.get("/api/analytics/v1/portfolio?days=90").json()
    assert sum(sum(p["totals"].values()) for p in body["projects"]) == len(state.rows)
    assert state.limits == [len(state.rows)]


def test_v1_portfolio_exposes_safe_summary_without_extra_database_reads(api):
    client, state = api
    state.rows = [bucket("trade", "page_view", count=4),
                  bucket("eyes", "page_view", count=7),
                  bucket("trade", "signup_completed", count=2),
                  {"_id": {"project": "unregistered", "event": "page_view",
                           "day": "2026-10-27"}, "count": 999,
                   "customer_email": "private@example.invalid"}]
    response = client.get("/api/analytics/v1/portfolio?days=7")
    assert response.status_code == 200
    assert response.json()["summary"] == {
        "project_count": len(get_args(ProjectName)),
        "totals": {"page_view": 11, "signup_completed": 2},
        "daily": {"2026-10-27": {"page_view": 11, "signup_completed": 2}},
        "projects_with_events": 2,
        "projects_without_events": len(get_args(ProjectName)) - 2,
        "verified_revenue_included": False,
        "unique_visitors": None,
        "net_profit_available": False,
        "data_scope": "v1_project_events_only",
    }
    assert "private@example.invalid" not in response.text
    assert len(state.pipelines) == 1

def test_portfolio_api_reports_cross_project_daily_trends_without_more_reads(api):
    client, state = api
    state.rows = [
        bucket("eyes", "page_view", "2026-10-27", 3),
        bucket("trade", "page_view", "2026-10-26", 2),
        bucket("trade", "page_view", "2026-10-27", 4),
        bucket("stack", "flow_abandoned", "2026-10-27", 1),
    ]
    response = client.get("/api/analytics/v1/portfolio?days=7")
    assert response.status_code == 200
    summary = response.json()["summary"]
    assert summary["daily"] == {
        "2026-10-26": {"page_view": 2},
        "2026-10-27": {"page_view": 7, "flow_abandoned": 1},
    }
    assert summary["projects_with_events"] == 3
    assert summary["projects_without_events"] == len(get_args(ProjectName)) - 3
    assert len(state.pipelines) == 1


def test_portfolio_api_empty_period_reports_no_recorded_daily_events(api):
    client, state = api
    response = client.get("/api/analytics/v1/portfolio?days=30")
    assert response.status_code == 200
    summary = response.json()["summary"]
    assert summary["daily"] == {}
    assert summary["projects_with_events"] == 0
    assert summary["projects_without_events"] == len(get_args(ProjectName))
    assert len(state.pipelines) == 1
