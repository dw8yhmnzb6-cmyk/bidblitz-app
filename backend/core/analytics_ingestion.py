"""Pure validation and deduplication helpers for first-party V1 analytics.

No live endpoint or persistence activation. Caller must bind project to a trusted
server configuration, enforce rate limits, consent and retention policies.
"""
import hashlib
from datetime import datetime, timezone, timedelta
from core.analytics_event_schema import AnalyticsEventV1, validated_project

def prepare_event(payload: dict, trusted_project: str, now=None):
    event = AnalyticsEventV1.model_validate(payload)
    validated_project(event, trusted_project)
    received = now or datetime.now(timezone.utc)
    if received.tzinfo is None:
        raise ValueError("Server clock needs timezone")
    received = received.astimezone(timezone.utc)
    delta = abs(received - event.timestamp)
    if delta > timedelta(minutes=10):
        raise ValueError("Timestamp outside accepted window")
    # Aggregate dimensions only; no session, IP, user ID, raw URL or secrets.
    return {
        "schema_version": 1,
        "project": trusted_project,
        "event": event.event,
        "path": event.path,
        "label": event.label,
        "received_at": received.isoformat(),
    }

def aggregate_counter_key(record):
    return {
        "day": record["received_at"][:10],
        "project": record["project"],
        "event": record["event"],
    }
