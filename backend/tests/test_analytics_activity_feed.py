from datetime import datetime, timezone, timedelta
import pytest
from core.analytics_activity_feed import recent_business_activity

NOW = datetime(2026, 10, 14, 10, tzinfo=timezone.utc)

def item(project="trade", action="payment_confirmed", verified=True, when=NOW):
    return dict(project=project, action=action, verified=verified, occurred_at=when,
                email="private", customer_id="private", amount=500)

def test_feed_drops_customer_fields_and_other_projects():
    data = [item(), item(project="eyes"), item(verified=False)]
    result = recent_business_activity(data, {"trade"}, NOW)
    assert result == [{"project": "trade", "action": "payment_confirmed",
                       "occurred_at": NOW.isoformat()}]

def test_old_and_unrecognized_events_excluded():
    data = [item(when=NOW-timedelta(days=31)), item(action="unknown")]
    assert recent_business_activity(data, {"trade"}, NOW) == []

def test_rejects_untrusted_project_filter():
    with pytest.raises(ValueError):
        recent_business_activity([], ["trade"], NOW)

def test_requires_bounded_limit():
    with pytest.raises(ValueError):
        recent_business_activity([], {"trade"}, NOW, limit=10000)
