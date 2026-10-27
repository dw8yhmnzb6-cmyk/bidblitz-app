"""Contract tests for privacy-safe portfolio dashboard rollups."""
from datetime import datetime, timedelta, timezone

import pytest

from core.analytics_dashboard_service import build_portfolio_dashboard
from core.analytics_portfolio_summary import summarize_portfolio


NOW = datetime(2026, 10, 14, 12, tzinfo=timezone.utc)


def ledger(project, currency, status, amount, fee, identifier):
    return {
        "project": project,
        "currency": currency,
        "status": status,
        "amount_minor": amount,
        "platform_fee_minor": fee,
        "transaction_event_id": identifier,
        "occurred_at": NOW,
        "verified": True,
        "customer_email": "private@example.invalid",
    }


def event(project, action="page_view", session=None):
    return {
        "project": project,
        "event": action,
        "received_at": NOW.isoformat(),
        "anonymous_session": session,
        "customer_email": "private@example.invalid",
    }


def test_summary_counts_only_authorized_projects_and_separates_currencies():
    events = [event("trade"), event("eyes"), event("fuel"),
              event("trade", "signup_completed")]
    ledger_rows = [
        ledger("trade", "EUR", "captured", 1000, 200, "t1"),
        ledger("trade", "EUR", "refunded", 300, 60, "t2"),
        ledger("eyes", "EUR", "captured", 2000, 400, "e1"),
        ledger("eyes", "USD", "captured", 5000, 500, "e2"),
        ledger("fuel", "EUR", "captured", 990000, 100000, "f1"),
    ]
    result = build_portfolio_dashboard(
        events, ledger_rows, ["trade", "eyes"], "today",
        NOW + timedelta(seconds=1))
    summary = result["summary"]
    assert summary["project_count"] == 2
    assert summary["traffic_events"]["page_views"] == 2
    assert summary["traffic_events"]["registrations_completed"] == 1
    assert summary["revenue_by_currency"] == [
        {"currency": "EUR", "gross_minor": 3000, "refund_minor": 300,
         "net_volume_minor": 2700, "platform_fee_minor": 540,
         "payment_count": 2},
        {"currency": "USD", "gross_minor": 5000, "refund_minor": 0,
         "net_volume_minor": 5000, "platform_fee_minor": 500,
         "payment_count": 1},
    ]
    assert "private@example.invalid" not in repr(summary)


def test_cross_project_sessions_are_not_misrepresented_as_unique_users():
    shared_session = "same-opaque-session"
    report = build_portfolio_dashboard(
        [event("trade", session=shared_session),
         event("eyes", session=shared_session)],
        [], ["trade", "eyes"], "today", NOW + timedelta(seconds=1))
    assert [p["traffic"]["online_sessions_5m"] for p in report["projects"]] == [1, 1]
    summary = report["summary"]
    assert summary["online_sessions_5m"] is None
    assert summary["unique_visitors"] is None
    assert summary["net_profit_available"] is False


def test_summary_keeps_negative_adjustments_in_minor_units():
    report = build_portfolio_dashboard([], [
        ledger("power", "EUR", "captured", 100, 40, "p1"),
        ledger("power", "EUR", "refunded", 200, 70, "p2"),
    ], ["power"], "today", NOW + timedelta(seconds=1))
    assert report["summary"]["revenue_by_currency"][0] == {
        "currency": "EUR",
        "gross_minor": 100,
        "refund_minor": 200,
        "net_volume_minor": -100,
        "platform_fee_minor": -30,
        "payment_count": 1,
    }


def test_empty_scope_has_no_data_and_does_not_read_records():
    def never_read():
        raise AssertionError("Input stream consumed with empty scope")
        yield
    report = build_portfolio_dashboard(
        never_read(), never_read(), [], "today",
        NOW + timedelta(seconds=1), never_read())
    assert report["summary"] == summarize_portfolio(())
    assert report["summary"]["revenue_by_currency"] == []
    assert report["summary"]["project_count"] == 0


def test_invalid_period_rejected_even_without_projects():
    with pytest.raises(ValueError):
        build_portfolio_dashboard([], [], [], "tomorrow", NOW)
