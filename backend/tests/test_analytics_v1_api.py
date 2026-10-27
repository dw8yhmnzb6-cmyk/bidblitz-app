"""HTTP contract tests with fake auth/DB; no production connections or data."""
from datetime import datetime, timedelta, timezone
import csv
from io import StringIO
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
                            rows=[], rows_by_query=None, pipelines=[], limits=[])
    class Cursor:
        def __init__(self, rows):
            self.rows = rows

        async def to_list(self, length):
            state.limits.append(length)
            return self.rows[:length]
    class Events:
        def aggregate(self, pipeline):
            query_index = len(state.pipelines)
            selected = (state.rows if state.rows_by_query is None
                        else state.rows_by_query[query_index])
            state.pipelines.append(pipeline)
            return Cursor(selected)
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
    today = datetime.now(timezone.utc).date()
    state.rows = [
        bucket(p, event, (today - timedelta(days=day)).isoformat())
        for p in get_args(ProjectName)
        for day in range(91)
        for event in ["page_view", "cta_click", "signup_started", "signup_completed",
                      "checkout_started", "checkout_completed", "flow_abandoned"]
    ]
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


def _csv_rows(response):
    return list(csv.DictReader(StringIO(response.text)))


def test_portfolio_csv_is_admin_only_and_skips_database_reads_for_non_admins(api):
    client, state = api
    state.user = {"role": "customer", "analytics_projects": ["trade"], "is_admin": True}
    response = client.get("/api/analytics/v1/portfolio/export.csv?days=7")
    assert response.status_code == 403
    assert state.pipelines == []
    state.auth_error = HTTPException(status_code=401, detail="Not authenticated")
    assert client.get("/api/analytics/v1/portfolio/export.csv").status_code == 401
    assert state.pipelines == []


@pytest.mark.parametrize("days", [0, -1, 91, "all"])
def test_csv_export_rejects_invalid_period_before_aggregation(api, days):
    client, state = api
    assert client.get("/api/analytics/v1/portfolio/export.csv",
                      params={"days": days}).status_code == 422
    assert state.pipelines == []


def test_admin_csv_export_contains_only_registered_event_days_and_marks_unknown_coverage(api):
    client, state = api
    today = datetime.now(timezone.utc).date().isoformat()
    yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).date().isoformat()
    state.rows = [
        {**bucket("trade", "page_view", yesterday, 4),
         "customer_email": "private@example.invalid", "session_id": "secret"},
        bucket("trade", "signup_completed", today, 2),
        bucket("eyes", "page_view", today, 3),
        bucket("outside", "page_view", today, 999),
    ]
    response = client.get("/api/analytics/v1/portfolio/export.csv",
                          params={"days": 7, "projects": "outside"},
                          headers={"X-Analytics-Projects": "outside"})
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv; charset=utf-8")
    assert response.headers["cache-control"] == "private, no-store"
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["content-disposition"] == (
        'attachment; filename="bidblitz-v1-events.csv"')
    rows = _csv_rows(response)
    assert len(rows) == len(get_args(ProjectName)) + 1  # Trade has two UTC days.
    assert [(row["project"], row["utc_date"]) for row in rows if row["project"] == "trade"] == [
        ("trade", yesterday), ("trade", today)]
    assert [row for row in rows if row["project"] == "trade" and
            row["utc_date"] == today][0]["signup_completed"] == "2"
    assert [row for row in rows if row["project"] == "eyes"][0]["page_view"] == "3"
    empty = [row for row in rows if row["project"] == "fuel"][0]
    assert empty["utc_date"] == ""
    assert empty["page_view"] == ""
    assert empty["record_status"] == "no_recorded_events"
    assert all(row["verified_revenue_included"] == "false" and
               row["data_scope"] == "v1_project_events_only" for row in rows)
    assert "private@example.invalid" not in response.text
    assert "secret" not in response.text
    assert "outside" not in response.text
    assert len(state.pipelines) == 1
    assert state.pipelines[0][0]["$match"]["project"] == {
        "$in": list(get_args(ProjectName))}
    assert state.limits == [len(get_args(ProjectName)) * 8 * 7]


def test_csv_export_has_one_unambiguous_unknown_coverage_row_per_empty_project(api):
    client, state = api
    response = client.get("/api/analytics/v1/portfolio/export.csv?days=1")
    assert response.status_code == 200
    rows = _csv_rows(response)
    assert [row["project"] for row in rows] == list(get_args(ProjectName))
    assert all(row["record_status"] == "no_recorded_events" and
               row["utc_date"] == "" for row in rows)
    assert all(row["page_view"] == "" for row in rows)
    assert "email" not in response.text.lower()
    assert len(state.pipelines) == 1


@pytest.mark.parametrize("day", ["=IMPORTXML(1)", "2026-02-30", "2020-01-01"])
def test_csv_export_rejects_invalid_or_out_of_window_dates_without_reflecting_them(api, day):
    client, state = api
    state.rows = [bucket("trade", "page_view", day, 1)]
    response = client.get("/api/analytics/v1/portfolio/export.csv?days=7")
    assert response.status_code == 503
    assert response.json()["detail"] == "Analytics export unavailable"
    assert day not in response.text
    assert len(state.pipelines) == 1


@pytest.mark.parametrize("count", [-1, 2**53, 1.5, True])
def test_csv_export_fails_closed_on_invalid_aggregate_counts(api, count):
    client, state = api
    today = datetime.now(timezone.utc).date().isoformat()
    state.rows = [bucket("trade", "page_view", today, count)]
    response = client.get("/api/analytics/v1/portfolio/export.csv?days=7")
    assert response.status_code == 503
    assert response.json()["detail"] == "Analytics export unavailable"


def test_csv_export_rejects_inconsistent_daily_totals_from_malformed_group_results(api):
    client, state = api
    today = datetime.now(timezone.utc).date().isoformat()
    # The real database groups identical dimensions; double rows signal a bad
    # upstream aggregate and must never be silently exported as clean numbers.
    state.rows = [bucket("trade", "page_view", today, 3),
                  bucket("trade", "page_view", today, 2)]
    response = client.get("/api/analytics/v1/portfolio/export.csv?days=7")
    assert response.status_code == 503
    assert response.json()["detail"] == "Analytics export unavailable"


@pytest.mark.parametrize("path,detail", [
    ("/v1/portfolio", "Analytics aggregate unavailable"),
    ("/v1/projects/trade/overview", "Analytics aggregate unavailable"),
    ("/v1/portfolio/export.csv", "Analytics export unavailable"),
])
@pytest.mark.parametrize("corruption", [
    "invalid_calendar_day", "expired_day", "future_day", "bad_day_type",
    "bad_event", "missing_event", "missing_day", "missing_group",
    "non_mapping_group", "bad_project_type", "bad_count_type",
])
def test_v1_report_fails_closed_on_corrupt_group_dimensions(api, path, detail, corruption):
    client, state = api
    today = datetime.now(timezone.utc).date()
    row = bucket("trade", "page_view", today.isoformat(), 1)
    if corruption == "invalid_calendar_day":
        row["_id"]["day"] = "2026-02-30"
    elif corruption == "expired_day":
        row["_id"]["day"] = (today - timedelta(days=91)).isoformat()
    elif corruption == "future_day":
        row["_id"]["day"] = (today + timedelta(days=1)).isoformat()
    elif corruption == "bad_day_type":
        row["_id"]["day"] = {"$ne": ""}
    elif corruption == "bad_event":
        row["_id"]["event"] = "customer_email"
    elif corruption == "missing_event":
        del row["_id"]["event"]
    elif corruption == "missing_day":
        del row["_id"]["day"]
    elif corruption == "missing_group":
        del row["_id"]
    elif corruption == "non_mapping_group":
        row["_id"] = "private@example.invalid"
    elif corruption == "bad_project_type":
        row["_id"]["project"] = ["trade"]
    elif corruption == "bad_count_type":
        row["count"] = True
    state.rows = [bucket("eyes", "page_view", today.isoformat(), 2), row]
    response = client.get("/api/analytics" + path + "?days=7")
    assert response.status_code == 503
    assert response.json() == {"detail": detail}
    assert "private@example.invalid" not in response.text
    assert "customer_email" not in response.text
    assert len(state.pipelines) == 1


def test_v1_report_keeps_valid_day_buckets_and_admin_scoping_after_validation(api):
    client, state = api
    today = datetime.now(timezone.utc).date()
    earliest = (today - timedelta(days=7)).isoformat()
    state.rows = [
        bucket("trade", "page_view", earliest, 2),
        bucket("trade", "signup_completed", today.isoformat(), 1),
        bucket("foreign", "page_view", today.isoformat(), 5000),
    ]
    response = client.get("/api/analytics/v1/portfolio?days=7")
    assert response.status_code == 200
    trade = next(row for row in response.json()["projects"] if row["project"] == "trade")
    assert trade["totals"] == {"page_view": 2, "signup_completed": 1}
    assert trade["daily"] == {
        earliest: {"page_view": 2},
        today.isoformat(): {"signup_completed": 1},
    }
    assert response.json()["summary"]["projects_with_events"] == 1
    assert len(state.pipelines) == 1


# V1 adjacent-period comparison: read-only server-catalog event counts.
COMPARE_PATH = "/api/analytics/v1/portfolio/period-compare"


@pytest.mark.parametrize("role", ["customer", "project_admin", "merchant", None])
def test_period_comparison_denies_non_admin_before_any_read(api, role):
    client, state = api
    state.user = {"role": role, "analytics_projects": ["trade"], "is_admin": True}
    response = client.get(COMPARE_PATH)
    assert response.status_code == 403
    assert state.pipelines == []


def test_period_comparison_denies_unauthenticated_before_any_read(api):
    client, state = api
    state.auth_error = HTTPException(401, "Not authenticated")
    assert client.get(COMPARE_PATH).status_code == 401
    assert state.pipelines == []


@pytest.mark.parametrize("days", [0, -1, 91, "abc"])
def test_period_comparison_rejects_invalid_window_without_database_read(api, days):
    client, state = api
    assert client.get(COMPARE_PATH, params={"days": days}).status_code == 422
    assert state.pipelines == []


def test_period_comparison_has_exact_disjoint_utc_windows_and_safe_project_deltas(api):
    client, state = api
    today = datetime.now(timezone.utc).date().isoformat()
    previous_day = (datetime.now(timezone.utc) - timedelta(days=8)).date().isoformat()
    state.rows_by_query = [
        [bucket("trade", "page_view", today, 7),
         bucket("eyes", "signup_started", today, 2),
         {**bucket("outside", "page_view", today, 999),
          "email": "person@example.invalid"}],
        [bucket("trade", "page_view", previous_day, 3),
         bucket("eyes", "checkout_completed", previous_day, 1)],
    ]
    response = client.get(
        COMPARE_PATH, params={"days": 7, "projects": "outside"},
        headers={"X-Analytics-Projects": "outside"},
    )
    assert response.status_code == 200
    result = response.json()
    assert result["period_days"] == 7
    assert result["timezone"] == "UTC"
    assert result["data_scope"] == "v1_project_events_only"
    assert result["verified_revenue_included"] is False
    assert result["unique_visitors"] is None
    assert result["net_profit_available"] is False
    assert result["collection_health_verified"] is False
    assert response.headers["cache-control"] == "private, no-store"
    assert response.headers["x-content-type-options"] == "nosniff"
    assert "person@example.invalid" not in response.text
    assert "outside" not in response.text
    assert len(result["projects"]) == len(get_args(ProjectName))
    by_project = {report["project"]: report for report in result["projects"]}
    assert by_project["trade"]["current_events"]["page_view"] == 7
    assert by_project["trade"]["previous_events"]["page_view"] == 3
    assert by_project["trade"]["recorded_event_change"]["page_view"] == 4
    assert by_project["trade"]["current_recorded_utc_days"] == 1
    assert by_project["trade"]["previous_recorded_utc_days"] == 1
    assert by_project["eyes"]["recorded_event_change"]["checkout_completed"] == -1
    assert by_project["fuel"]["current_recorded_utc_days"] == 0
    assert result["summary"]["current_events"]["page_view"] == 7
    assert result["summary"]["previous_events"]["page_view"] == 3
    assert result["summary"]["recorded_event_change"]["page_view"] == 4
    assert result["summary"]["current_projects_with_events"] == 2
    assert result["summary"]["previous_projects_with_events"] == 2

    assert len(state.pipelines) == 2
    expected_projects = {"$in": list(get_args(ProjectName))}
    current_match = state.pipelines[0][0]["$match"]
    previous_match = state.pipelines[1][0]["$match"]
    assert current_match["project"] == previous_match["project"] == expected_projects
    assert set(current_match["received_at"]) == {"$gte", "$lte"}
    assert set(previous_match["received_at"]) == {"$gte", "$lt"}
    assert previous_match["received_at"]["$lt"] == current_match["received_at"]["$gte"]
    assert current_match["received_at"]["$lte"] == result["as_of"]
    assert (datetime.fromisoformat(previous_match["received_at"]["$gte"]) -
            datetime.fromisoformat(current_match["received_at"]["$gte"])) == timedelta(days=-7)
    assert result["windows"]["current"]["start_inclusive"] == current_match["received_at"]["$gte"]
    assert result["windows"]["previous"]["end_exclusive"] == current_match["received_at"]["$gte"]
    assert state.limits == [len(get_args(ProjectName)) * 8 * 7] * 2


def test_period_comparison_empty_stores_are_only_empty_recorded_events(api):
    client, state = api
    response = client.get(COMPARE_PATH + "?days=90")
    assert response.status_code == 200
    result = response.json()
    assert set(result["summary"]["current_events"].values()) == {0}
    assert set(result["summary"]["previous_events"].values()) == {0}
    assert set(result["summary"]["recorded_event_change"].values()) == {0}
    assert result["summary"]["current_projects_with_events"] == 0
    assert result["summary"]["previous_projects_with_events"] == 0
    assert result["collection_health_verified"] is False
    assert result["unique_visitors"] is None
    assert len(result["projects"]) == len(get_args(ProjectName))
    assert state.limits == [len(get_args(ProjectName)) * 91 * 7] * 2


@pytest.mark.parametrize("corrupt", ["bad_date", "invalid_count", "duplicate"])
def test_period_comparison_fails_closed_on_corrupt_previous_window(api, corrupt):
    client, state = api
    day = (datetime.now(timezone.utc) - timedelta(days=8)).date().isoformat()
    row = bucket("trade", "page_view", day, 3)
    if corrupt == "bad_date":
        row["_id"]["day"] = "=HYPERLINK(1)"
    if corrupt == "invalid_count":
        row["count"] = True
    rows = [row, bucket("trade", "page_view", day, 2)] if corrupt == "duplicate" else [row]
    state.rows_by_query = [[], rows]
    response = client.get(COMPARE_PATH + "?days=7")
    assert response.status_code == 503
    assert response.json()["detail"] == "Analytics aggregate unavailable"
    assert "HYPERLINK" not in response.text
    assert len(state.pipelines) == 2


def test_period_comparison_rejects_unsafe_cross_project_event_totals(api):
    client, state = api
    today = datetime.now(timezone.utc).date().isoformat()
    state.rows_by_query = [
        [bucket("trade", "page_view", today, 2**53 - 1),
         bucket("eyes", "page_view", today, 1)],
        [],
    ]
    response = client.get(COMPARE_PATH)
    assert response.status_code == 503
    assert response.json() == {"detail": "Analytics comparison unavailable"}
    assert len(state.pipelines) == 2


# Admin-only CSV export of recorded adjacent-period event changes.
COMPARE_CSV_PATH = "/api/analytics/v1/portfolio/period-compare/export.csv"


@pytest.mark.parametrize("role", ["customer", "project_admin", "merchant", None])
def test_period_csv_denies_non_admin_before_database_access(api, role):
    client, state = api
    state.user = {"role": role, "is_admin": True, "analytics_projects": ["trade"]}
    response = client.get(COMPARE_CSV_PATH)
    assert response.status_code == 403
    assert state.pipelines == []


def test_period_csv_denies_unauthenticated_before_database_access(api):
    client, state = api
    state.auth_error = HTTPException(401, "Not authenticated")
    assert client.get(COMPARE_CSV_PATH).status_code == 401
    assert state.pipelines == []


@pytest.mark.parametrize("days", [-1, 0, 91, "abc"])
def test_period_csv_rejects_invalid_period_before_database_access(api, days):
    client, state = api
    assert client.get(COMPARE_CSV_PATH, params={"days": days}).status_code == 422
    assert state.pipelines == []


def test_period_csv_uses_two_disjoint_reads_and_never_exports_identity_or_revenue(api):
    client, state = api
    now = datetime.now(timezone.utc)
    current_day = now.date().isoformat()
    previous_day = (now - timedelta(days=8)).date().isoformat()
    state.rows_by_query = [
        [bucket("trade", "page_view", current_day, 4),
         bucket("eyes", "signup_completed", current_day, 2),
         {**bucket("outside", "page_view", current_day, 999),
          "user_id": "private-id", "email": "private@example.invalid"}],
        [bucket("trade", "page_view", previous_day, 9)],
    ]
    response = client.get(
        COMPARE_CSV_PATH,
        params={"days": 7, "projects": "outside"},
        headers={"X-Analytics-Projects": "outside"},
    )
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    assert response.headers["cache-control"] == "private, no-store"
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["content-disposition"] == (
        'attachment; filename="bidblitz-v1-period-comparison.csv"'
    )
    assert "private@example.invalid" not in response.text
    assert "private-id" not in response.text
    assert "outside" not in response.text
    assert "unique_visitors" not in response.text
    assert "payment_amount" not in response.text
    rows = list(csv.DictReader(StringIO(response.text)))
    assert len(rows) == (len(get_args(ProjectName)) + 1) * 7
    trade = next(row for row in rows if row["project"] == "trade" and row["event"] == "page_view")
    assert (trade["current_recorded_events"], trade["previous_recorded_events"],
            trade["recorded_event_change"]) == ("4", "9", "-5")
    assert trade["verified_revenue_included"] == "false"
    assert trade["collection_health_verified"] == "false"
    assert all(row["data_scope"] == "v1_project_events_only" for row in rows)
    assert len(state.pipelines) == 2
    matching = [pipeline[0]["$match"] for pipeline in state.pipelines]
    assert matching[0]["project"] == matching[1]["project"] == {
        "$in": list(get_args(ProjectName))
    }
    assert matching[1]["received_at"]["$lt"] == matching[0]["received_at"]["$gte"]
    assert "$lte" in matching[0]["received_at"]
    assert state.limits == [len(get_args(ProjectName)) * 8 * 7] * 2


def test_period_csv_empty_store_is_count_only_not_claim_of_zero_visitors(api):
    client, state = api
    response = client.get(COMPARE_CSV_PATH, params={"days": 90})
    assert response.status_code == 200
    rows = list(csv.DictReader(StringIO(response.text)))
    assert rows
    assert all(row["current_recorded_events"] == "0" for row in rows)
    assert all(row["previous_recorded_events"] == "0" for row in rows)
    assert all(row["recorded_event_change"] == "0" for row in rows)
    assert state.limits == [len(get_args(ProjectName)) * 91 * 7] * 2


@pytest.mark.parametrize("corrupt", ["invalid_previous_day", "duplicate", "overflow"])
def test_period_csv_fails_closed_without_revealing_bad_aggregates(api, corrupt):
    client, state = api
    day = (datetime.now(timezone.utc) - timedelta(days=8)).date().isoformat()
    row = bucket("trade", "page_view", day, 3)
    if corrupt == "invalid_previous_day":
        row["_id"]["day"] = "=HYPERLINK(1)"
    if corrupt == "overflow":
        state.rows_by_query = [
            [bucket("trade", "page_view", datetime.now(timezone.utc).date().isoformat(), 2**53-1),
             bucket("eyes", "page_view", datetime.now(timezone.utc).date().isoformat(), 1)],
            [],
        ]
    else:
        state.rows_by_query = [[], [row, bucket("trade", "page_view", day, 2)]
                               if corrupt == "duplicate" else [row]]
    response = client.get(COMPARE_CSV_PATH, params={"days": 7})
    assert response.status_code == 503
    assert response.json() == {"detail": "Analytics comparison export unavailable"}
    assert "HYPERLINK" not in response.text
    assert len(state.pipelines) == 2
