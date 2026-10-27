"""Pure comparison CSV tests. No database, credentials or payment services."""
import copy
import csv
from datetime import datetime, timezone
from io import StringIO
from typing import get_args

import pytest

from core.analytics_event_schema import EventName, ProjectName
from core.analytics_v1_period_comparison import compare_v1_recorded_periods
from core.analytics_v1_period_comparison_csv import (
    HEADER, render_v1_period_comparison_csv,
)


def _reports():
    return [
        {"project": project, "totals": {}, "daily": {},
         "verified_revenue_included": False, "data_scope": "v1_project_events_only"}
        for project in get_args(ProjectName)
    ]


def _comparison(days=7):
    current, previous = _reports(), _reports()
    current[0]["totals"] = {"page_view": 5, "checkout_completed": 2}
    current[0]["daily"] = {"2026-10-27": {"page_view": 5, "checkout_completed": 2}}
    previous[0]["totals"] = {"page_view": 9, "checkout_completed": 1}
    previous[0]["daily"] = {"2026-10-19": {"page_view": 9, "checkout_completed": 1}}
    current[1]["totals"] = {"signup_started": 3}
    current[1]["daily"] = {"2026-10-27": {"signup_started": 3}}
    return compare_v1_recorded_periods(
        current, previous, days, datetime(2026, 10, 27, 12, tzinfo=timezone.utc)
    )


def _rows(report):
    return list(csv.DictReader(StringIO(render_v1_period_comparison_csv(report))))


def test_csv_is_fixed_and_contains_only_registered_projects_and_events():
    output = render_v1_period_comparison_csv(_comparison())
    rows = _rows(_comparison())
    events, projects = get_args(EventName), get_args(ProjectName)
    assert output.startswith(",".join(HEADER) + "\r\n")
    assert output.endswith("\r\n")
    assert len(rows) == (len(projects) + 1) * len(events)
    assert [r["project"] for r in rows[:len(events)]] == [projects[0]] * len(events)
    assert {r["event"] for r in rows} == set(events)
    assert {r["project"] for r in rows} == {*projects, "all_registered_projects"}
    assert {r["row_scope"] for r in rows} == {"project", "portfolio"}
    assert {r["verified_revenue_included"] for r in rows} == {"false"}
    assert {r["collection_health_verified"] for r in rows} == {"false"}
    assert {r["data_scope"] for r in rows} == {"v1_project_events_only"}
    assert "unique_visitors" not in output
    assert "revenue_amount" not in ",".join(HEADER)
    assert "payment_amount" not in output


def test_csv_preserves_negative_deltas_and_summary_without_double_count():
    rows = _rows(_comparison())
    project = get_args(ProjectName)[0]
    page = next(r for r in rows if r["project"] == project and r["event"] == "page_view")
    total = next(r for r in rows if r["row_scope"] == "portfolio" and r["event"] == "page_view")
    assert (page["current_recorded_events"], page["previous_recorded_events"],
            page["recorded_event_change"]) == ("5", "9", "-4")
    assert (total["current_recorded_events"], total["previous_recorded_events"],
            total["recorded_event_change"]) == ("5", "9", "-4")
    assert (page["current_recorded_utc_days"], page["previous_recorded_utc_days"]) == ("1", "1")
    assert total["current_recorded_utc_days"] == ""
    assert total["previous_recorded_utc_days"] == ""
    assert page["period_boundary_utc"] == page["current_start_utc"]
    assert page["previous_start_utc"] == "2026-10-13T12:00:00+00:00"
    assert page["as_of_utc"] == "2026-10-27T12:00:00+00:00"
    assert not any(cell.startswith(("=", "+", "-", "@")) for row in rows for cell in
                   (row["project"], row["event"]))


def test_csv_does_not_turn_missing_events_into_unique_visitors_or_revenue():
    reports = _reports()
    blank = compare_v1_recorded_periods(
        reports, _reports(), 90, datetime(2026, 10, 27, tzinfo=timezone.utc)
    )
    rows = _rows(blank)
    assert len(rows) == (len(get_args(ProjectName)) + 1) * len(get_args(EventName))
    assert all(r["current_recorded_events"] == "0" for r in rows)
    assert all(r["previous_recorded_events"] == "0" for r in rows)
    assert "unique_visitors" not in "".join(rows[0])


@pytest.mark.parametrize("mutation", [
    "missing_project", "duplicate_project", "foreign_project",
    "foreign_event", "missing_event", "boolean_count", "negative_count",
    "unsafe_count", "wrong_delta", "bad_summary", "bad_coverage",
    "bad_recorded_day", "wrong_window", "invalid_timestamp",
    "unsafe_scope", "verified_revenue", "collection_health",
    "unique_visitors", "noninteger_days",
])
def test_corrupt_comparison_fails_closed(mutation):
    report = copy.deepcopy(_comparison())
    if mutation == "missing_project":
        report["projects"].pop()
    elif mutation == "duplicate_project":
        report["projects"][1]["project"] = report["projects"][0]["project"]
    elif mutation == "foreign_project":
        report["projects"][0]["project"] = "=HYPERLINK(1)"
    elif mutation == "foreign_event":
        report["projects"][0]["current_events"]["email"] = 1
    elif mutation == "missing_event":
        del report["projects"][0]["current_events"]["page_view"]
    elif mutation == "boolean_count":
        report["projects"][0]["current_events"]["page_view"] = True
    elif mutation == "negative_count":
        report["projects"][0]["current_events"]["page_view"] = -1
    elif mutation == "unsafe_count":
        report["projects"][0]["current_events"]["page_view"] = 2**53
    elif mutation == "wrong_delta":
        report["projects"][0]["recorded_event_change"]["page_view"] = 100
    elif mutation == "bad_summary":
        report["summary"]["current_events"]["page_view"] = 99
    elif mutation == "bad_coverage":
        report["summary"]["current_projects_with_events"] = 1
    elif mutation == "bad_recorded_day":
        report["projects"][0]["current_recorded_utc_days"] = 92
    elif mutation == "wrong_window":
        report["windows"]["previous"]["end_exclusive"] = "2026-10-21T12:00:00+00:00"
    elif mutation == "invalid_timestamp":
        report["as_of"] = "=HYPERLINK(1)"
    elif mutation == "unsafe_scope":
        report["data_scope"] = "customer_data"
    elif mutation == "verified_revenue":
        report["verified_revenue_included"] = True
    elif mutation == "collection_health":
        report["collection_health_verified"] = True
    elif mutation == "unique_visitors":
        report["unique_visitors"] = 1234
    elif mutation == "noninteger_days":
        report["period_days"] = True
    with pytest.raises(ValueError):
        render_v1_period_comparison_csv(report)
