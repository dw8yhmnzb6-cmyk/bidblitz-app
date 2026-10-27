from datetime import datetime, timezone, timedelta
import pytest
from pydantic import ValidationError
from core.analytics_ingestion import prepare_event, aggregate_counter_key

NOW = datetime(2026, 10, 12, 15, tzinfo=timezone.utc)
BASE = {
    "project": "trade", "event": "cta_click", "path": "/pricing",
    "label": "get_started", "timestamp": NOW.isoformat(),
}

def test_minimal_persisted_dimensions():
    result = prepare_event(BASE, "trade", NOW)
    assert set(result) == {"schema_version", "project", "event", "path", "label", "received_at"}
    assert aggregate_counter_key(result) == {"day": "2026-10-12", "project": "trade", "event": "cta_click"}

def test_project_spoof_rejected():
    with pytest.raises(ValueError):
        prepare_event(BASE, "eyes", NOW)

def test_old_event_rejected():
    with pytest.raises(ValidationError):
        prepare_event({**BASE, "event": "untrusted"}, "trade", NOW)

def test_future_and_old_event_rejected():
    for offset in [-11, 11]:
        with pytest.raises(ValueError):
            prepare_event({**BASE, "timestamp": (NOW + timedelta(minutes=offset)).isoformat()}, "trade", NOW)

def test_extra_fields_rejected():
    with pytest.raises(ValidationError):
        prepare_event({**BASE, "session_id": "secret"}, "trade", NOW)
