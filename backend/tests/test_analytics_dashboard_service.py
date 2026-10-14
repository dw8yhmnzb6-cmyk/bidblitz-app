from datetime import datetime, timezone, timedelta
import pytest
from core.analytics_dashboard_service import build_project_dashboard, build_portfolio_dashboard

NOW = datetime(2026, 10, 14, 12, tzinfo=timezone.utc)
EVENTS = [
    dict(project="trade", event="page_view", received_at=NOW.isoformat()),
    dict(project="eyes", event="page_view", received_at=NOW.isoformat()),
]
LEDGER = [
    dict(project="trade", currency="EUR", verified=True, status="captured",
         amount_minor=1000, platform_fee_minor=200,
         transaction_event_id="payment-a", occurred_at=NOW),
    dict(project="eyes", currency="EUR", verified=True, status="captured",
         amount_minor=3000, platform_fee_minor=500,
         transaction_event_id="payment-b", occurred_at=NOW),
]

def test_project_dashboard_isolation():
    report = build_project_dashboard(EVENTS, LEDGER, "trade", "today", NOW+timedelta(seconds=1))
    assert report["traffic"]["page_views"] == 1
    assert len(report["revenue"]) == 1
    assert report["revenue"][0]["platform_fee_minor"] == 200

def test_portfolio_contains_only_authorized_projects():
    report = build_portfolio_dashboard(EVENTS, LEDGER, ["eyes"], "today", NOW+timedelta(seconds=1))
    assert len(report["projects"]) == 1
    assert report["projects"][0]["project"] == "eyes"

def test_duplicate_authorized_project_rejected():
    with pytest.raises(ValueError):
        build_portfolio_dashboard(EVENTS, LEDGER, ["trade", "trade"], "today", NOW)
