"""Pure V1 adjacent-window report validation with no database or user records."""
from datetime import datetime, timedelta, timezone
from typing import get_args

import pytest

from core.analytics_event_schema import ProjectName
from core.analytics_v1_period_comparison import compare_v1_recorded_periods


def reports():
    return [
        {"project": project, "totals": {}, "daily": {},
         "verified_revenue_included": False,
         "data_scope": "v1_project_events_only"}
        for project in get_args(ProjectName)
    ]


@pytest.mark.parametrize("timestamp", [
    datetime(2026, 10, 27),
    datetime(2026, 10, 27, tzinfo=timezone(timedelta(hours=1))),
    "2026-10-27T10:00:00+00:00",
])
def test_rejects_non_utc_comparison_anchor(timestamp):
    with pytest.raises(ValueError, match="UTC"):
        compare_v1_recorded_periods(reports(), reports(), 7, timestamp)


@pytest.mark.parametrize("days", [0, 91, -1, True, 7.5])
def test_rejects_unsupported_comparison_duration(days):
    with pytest.raises(ValueError, match="period"):
        compare_v1_recorded_periods(reports(), reports(), days, datetime.now(timezone.utc))


@pytest.mark.parametrize("issue", ["missing", "duplicate", "wrong_scope", "unknown_event", "boolean_count"])
def test_fails_closed_on_broken_project_catalog_or_counts(issue):
    current = reports()
    if issue == "missing":
        current.pop()
    elif issue == "duplicate":
        current[1] = current[0].copy()
    elif issue == "wrong_scope":
        current[0]["verified_revenue_included"] = True
    elif issue == "unknown_event":
        current[0]["totals"] = {"customer_email": 1}
    elif issue == "boolean_count":
        current[0]["totals"] = {"page_view": True}
    with pytest.raises(ValueError):
        compare_v1_recorded_periods(current, reports(), 7, datetime.now(timezone.utc))


def test_rejects_sum_exceeding_browser_safe_integer():
    current = reports()
    current[0]["totals"] = {"page_view": 2**53 - 1}
    current[1]["totals"] = {"page_view": 1}
    with pytest.raises(ValueError, match="Unsafe cross-project total"):
        compare_v1_recorded_periods(current, reports(), 7, datetime.now(timezone.utc))


def test_all_event_keys_and_negative_changes_are_explicit_not_conversion_rates():
    current = reports()
    previous = reports()
    previous[0]["totals"] = {"checkout_completed": 4}
    current[0]["totals"] = {"checkout_completed": 1}
    result = compare_v1_recorded_periods(current, previous, 1, datetime.now(timezone.utc))
    assert result["summary"]["recorded_event_change"]["checkout_completed"] == -3
    assert result["projects"][0]["recorded_event_change"]["checkout_completed"] == -3
    assert result["projects"][0]["current_events"]["page_view"] == 0
    assert result["collection_health_verified"] is False
    assert result["verified_revenue_included"] is False
    assert result["unique_visitors"] is None
    assert "conversion_rate" not in result["summary"]
