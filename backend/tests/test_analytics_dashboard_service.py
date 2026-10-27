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

@pytest.mark.parametrize("projects", [None, "trade", ["trade", ""], [123], ["trade", "trade"]])
def test_invalid_scope_is_rejected(projects):
    with pytest.raises(ValueError):
        build_portfolio_dashboard(EVENTS, LEDGER, projects, "today", NOW)

def test_business_activity_is_filtered_by_project():
    actions = [
        dict(project="trade", action="payment_confirmed", verified=True, occurred_at=NOW,
             customer_email="must-not-appear"),
        dict(project="eyes", action="subscription_activated", verified=True, occurred_at=NOW),
    ]
    report = build_portfolio_dashboard(EVENTS, LEDGER, ["trade"], "today",
                                       NOW+timedelta(seconds=1), actions)
    feed = report["projects"][0]["recent_business_actions"]
    assert len(feed) == 1
    assert feed[0]["project"] == "trade"
    assert "customer_email" not in feed[0]


def test_portfolio_reuses_one_shot_inputs_for_every_authorized_project():
    actions = [
        dict(project="trade", action="payment_confirmed", verified=True, occurred_at=NOW),
        dict(project="eyes", action="subscription_activated", verified=True, occurred_at=NOW),
        dict(project="fuel", action="payment_confirmed", verified=True, occurred_at=NOW),
    ]
    expected = build_portfolio_dashboard(
        EVENTS, LEDGER, ["trade", "eyes"], "today", NOW + timedelta(seconds=1), actions)
    actual = build_portfolio_dashboard(
        iter(EVENTS), iter(LEDGER), ["trade", "eyes"], "today",
        NOW + timedelta(seconds=1), iter(actions))
    assert actual == expected
    assert [p["traffic"]["page_views"] for p in actual["projects"]] == [1, 1]
    assert [p["revenue"][0]["gross_minor"] for p in actual["projects"]] == [1000, 3000]
    assert [p["recent_business_actions"][0]["project"]
            for p in actual["projects"]] == ["trade", "eyes"]


def test_invalid_scope_does_not_consume_inputs():
    def unavailable():
        raise AssertionError("Input consumed before scope validation")
        yield
    with pytest.raises(ValueError):
        build_portfolio_dashboard(unavailable(), unavailable(), ["trade", "trade"],
                                  "today", NOW, unavailable())


def test_empty_scope_does_not_consume_inputs():
    def unavailable():
        raise AssertionError("Empty portfolio must not read input streams")
        yield
    assert build_portfolio_dashboard(unavailable(), unavailable(), [], "today",
                                     NOW, unavailable()) == {"period": "today", "projects": []}


def test_default_clock_is_shared_by_all_project_sections(monkeypatch):
    import core.analytics_dashboard_service as service
    class Clock:
        calls = 0
        @classmethod
        def now(cls, tz):
            cls.calls += 1
            return NOW + timedelta(seconds=1)
    monkeypatch.setattr(service, "datetime", Clock, raising=False)
    actual = service.build_portfolio_dashboard(
        EVENTS, LEDGER, ["trade", "eyes"], "today")
    expected = service.build_portfolio_dashboard(
        EVENTS, LEDGER, ["trade", "eyes"], "today", NOW + timedelta(seconds=1))
    assert actual == expected
    assert Clock.calls == 1


def test_dashboard_activity_matches_yesterday_filter():
    yesterday = NOW - timedelta(days=1)
    actions = [
        dict(project="trade", action="payment_confirmed", verified=True, occurred_at=NOW),
        dict(project="trade", action="subscription_activated", verified=True, occurred_at=yesterday),
    ]
    report = build_portfolio_dashboard(EVENTS, LEDGER, ["trade"], "yesterday",
                                       NOW + timedelta(seconds=1), actions)
    feed = report["projects"][0]["recent_business_actions"]
    assert len(feed) == 1
    assert feed[0]["action"] == "subscription_activated"
    assert feed[0]["occurred_at"] == yesterday.isoformat()
