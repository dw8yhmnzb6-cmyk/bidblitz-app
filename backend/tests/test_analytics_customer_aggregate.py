"""Strict validation for customer-scoped analytics aggregate projections."""
from datetime import datetime, timezone

import pytest

from core.analytics_customer_aggregate import build_customer_site_event_report


AS_OF = datetime(2026, 11, 17, 20, 0, tzinfo=timezone.utc)
MAX_SAFE = 2**53 - 1


def row(day="2026-11-17", event="page_view", count=1):
    return {"_id": {"day": day, "event": event}, "count": count}


def test_empty_aggregate_is_an_empty_recording_not_zero_activity():
    assert build_customer_site_event_report([], days=7, as_of=AS_OF) == {
        "totals": {}, "daily": {}, "has_recorded_events": False,
    }


def test_valid_rows_are_sorted_and_return_only_allowlisted_aggregates():
    records = [
        row("2026-11-17", "signup_completed", 2),
        row("2026-11-16", "page_view", 5),
        row("2026-11-17", "page_view", 3),
    ]
    result = build_customer_site_event_report(records, days=7, as_of=AS_OF)
    assert result == {
        "totals": {"page_view": 8, "signup_completed": 2},
        "daily": {
            "2026-11-16": {"page_view": 5},
            "2026-11-17": {"page_view": 3, "signup_completed": 2},
        },
        "has_recorded_events": True,
    }


@pytest.mark.parametrize("record", [
    None,
    [],
    {"count": 1},
    {"_id": {"day": "2026-11-17", "event": "page_view"}, "count": 1, "email": "private@example.test"},
    {"_id": None, "count": 1},
    {"_id": {"day": "2026-11-17", "event": "page_view", "tenant_id": "private"}, "count": 1},
    row(day="2026-02-30"),
    row(day="20261117"),
    row(day="2026-11-09"),
    row(day="2026-11-18"),
    row(event="checkout_completed"),
    row(count=True),
    row(count=False),
    row(count=1.5),
    row(count="1"),
    row(count=0),
    row(count=-1),
    row(count=MAX_SAFE + 1),
])
def test_malformed_aggregate_rows_fail_closed(record):
    with pytest.raises(ValueError):
        build_customer_site_event_report([record], days=7, as_of=AS_OF)


def test_duplicate_day_and_event_dimensions_are_rejected():
    with pytest.raises(ValueError):
        build_customer_site_event_report(
            [row(count=2), row(count=3)], days=7, as_of=AS_OF,
        )


def test_cross_day_totals_may_not_exceed_javascript_safe_integer():
    with pytest.raises(ValueError):
        build_customer_site_event_report(
            [row("2026-11-16", count=MAX_SAFE), row("2026-11-17", count=1)],
            days=7,
            as_of=AS_OF,
        )


def test_aggregate_row_count_is_bounded_by_days_and_event_allowlist():
    rows = [row(day="2026-11-17", event="page_view", count=1)] * 13
    with pytest.raises(ValueError):
        build_customer_site_event_report(rows, days=1, as_of=AS_OF)


@pytest.mark.parametrize("days", [True, False, 0, 91, 1.5, "7", None])
def test_invalid_period_is_rejected(days):
    with pytest.raises(ValueError):
        build_customer_site_event_report([], days=days, as_of=AS_OF)


def test_naive_report_timestamp_is_rejected():
    with pytest.raises(ValueError):
        build_customer_site_event_report(
            [], days=7, as_of=datetime(2026, 11, 17, 20, 0),
        )
