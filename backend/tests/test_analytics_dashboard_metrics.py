from datetime import datetime, timedelta, timezone
from core.analytics_dashboard_metrics import dashboard_metrics

NOW = datetime(2026, 10, 14, 12, tzinfo=timezone.utc)

def sample(project="trade", event="page_view", when=NOW, session=None):
    return dict(project=project, event=event, received_at=when.isoformat(),
                anonymous_session=session)

def test_project_isolation():
    result = dashboard_metrics([sample(), sample(project="eyes")], "trade", "today",
                               NOW + timedelta(seconds=1))
    assert result["page_views"] == 1
    assert result["unique_visitors"] is None

def test_active_session_deduplication():
    result = dashboard_metrics([sample(session="a"), sample(session="a")],
                               "trade", "today", NOW + timedelta(seconds=1))
    assert result["online_sessions_5m"] == 1

def test_old_sessions_excluded():
    result = dashboard_metrics([sample(when=NOW-timedelta(minutes=6), session="old")],
                               "trade", "today", NOW)
    assert result["online_sessions_5m"] == 0

def test_yesterday():
    result = dashboard_metrics([sample(), sample(when=NOW-timedelta(days=1))],
                               "trade", "yesterday", NOW)
    assert result["page_views"] == 1
