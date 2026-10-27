from datetime import datetime, timezone, timedelta
import pytest
from core.analytics_reporting import summarize_project

NOW = datetime(2026, 10, 12, 12, tzinfo=timezone.utc)

def event(project="trade", name="page_view", at=None):
    return {
        "project": project,
        "event": name,
        "received_at": (at or NOW).isoformat(),
    }

def test_project_isolation_and_funnel_counts():
    rows = [
        event(), event(name="signup_started"),
        event(project="eyes"), event(project="eyes", name="checkout_completed"),
    ]
    report = summarize_project(rows, "trade", now=NOW)
    assert report["events"]["page_view"] == 1
    assert report["events"]["signup_started"] == 1
    assert report["events"]["checkout_completed"] == 0
    assert report["revenue_verified"] is False

def test_date_window_and_invalid_events():
    report = summarize_project([
        event(), event(at=NOW - timedelta(days=50)),
        event(name="unexpected"),
        {"project": "trade", "event": "page_view", "received_at": "bad"},
    ], "trade", days=30, now=NOW)
    assert report["events"]["page_view"] == 1
    assert list(report["daily"]) == ["2026-10-12"]

@pytest.mark.parametrize("days", [0, 91, -1, True, 2.5])
def test_rejects_invalid_windows(days):
    with pytest.raises(ValueError):
        summarize_project([], "trade", days=days, now=NOW)

def test_rejects_naive_reference_clock():
    with pytest.raises(ValueError):
        summarize_project([], "trade", now=datetime(2026, 10, 12))
