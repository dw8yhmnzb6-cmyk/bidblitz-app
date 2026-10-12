import pytest
from pydantic import ValidationError
from core.analytics_event_schema import AnalyticsEventV1

BASE = dict(project="bidblitz_main", event="page_view", path="/pricing", timestamp="2026-10-12T13:00:00Z")

def test_valid():
    assert AnalyticsEventV1(**BASE).path == "/pricing"

@pytest.mark.parametrize("field,value", [
    ("project", "unknown"),
    ("event", "invalid"),
    ("path", "/checkout?private=1"),
    ("path", "//host"),
    ("label", "invalid.label"),
])
def test_invalid(field, value):
    with pytest.raises(ValidationError):
        AnalyticsEventV1(**dict(BASE, **{field: value}))

def test_extra_fields_rejected():
    with pytest.raises(ValidationError):
        AnalyticsEventV1(**dict(BASE, unexpected="value"))

def test_timezone_is_required():
    with pytest.raises(ValidationError):
        AnalyticsEventV1(**dict(BASE, timestamp="2026-10-12T13:00:00"))

def test_client_cannot_confirm_payment():
    with pytest.raises(ValidationError):
        AnalyticsEventV1(**dict(BASE, event="checkout_completed"))

def test_project_binding():
    from core.analytics_event_schema import validated_project
    event = AnalyticsEventV1(**BASE)
    assert validated_project(event, "bidblitz_main") == "bidblitz_main"
    with pytest.raises(ValueError):
        validated_project(event, "trade")
