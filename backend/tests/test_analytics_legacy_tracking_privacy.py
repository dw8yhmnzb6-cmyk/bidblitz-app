"""Legacy analytics endpoint privacy tests with an isolated fake database."""
import importlib.util
import sys
from pathlib import Path
from types import ModuleType, SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient


@pytest.fixture
def api(monkeypatch):
    state = SimpleNamespace(inserts=[], metric_updates=[], user_reads=0)

    class Events:
        async def insert_one(self, document):
            state.inserts.append(dict(document))

    class Metrics:
        async def update_one(self, query, update, upsert=False):
            state.metric_updates.append((query, update, upsert))

    async def current_user(_request):
        state.user_reads += 1
        return {"_id": "private-user-id", "role": "customer"}

    database = ModuleType("core.database")
    database.db = SimpleNamespace(
        conversion_events=Events(),
        conversion_metrics=Metrics(),
    )
    security = ModuleType("core.security")
    security.get_current_user = current_user
    monkeypatch.setitem(sys.modules, "core.database", database)
    monkeypatch.setitem(sys.modules, "core.security", security)

    spec = importlib.util.spec_from_file_location(
        "analytics_legacy_privacy_under_test",
        Path(__file__).parents[1] / "routes" / "analytics.py",
    )
    routes = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(routes)
    app = FastAPI()
    app.include_router(routes.router)
    with TestClient(app) as client:
        yield client, state


def test_legacy_track_accepts_old_session_field_but_persists_no_identifiers(api):
    client, state = api
    response = client.post("/api/analytics/track", json={
        "event": "feature_click",
        "session_id": "private-session-id",
        "meta": {
            "feature": "wallet",
            "page": "merchant_pos_home",
            "email": "private@example.invalid",
            "customer_id": "customer-123",
        },
    })

    assert response.status_code == 200
    assert len(state.inserts) == 1
    document = state.inserts[0]
    assert set(document) == {"event", "meta", "day", "ts"}
    assert document["event"] == "feature_click"
    assert document["meta"] == {"feature": "wallet"}
    assert "private-session-id" not in repr(document)
    assert "private@example.invalid" not in repr(document)
    assert "customer-123" not in repr(document)
    assert state.user_reads == 0
    assert len(state.metric_updates) == 1


def test_legacy_track_keeps_only_event_specific_safe_dimensions(api):
    client, state = api
    response = client.post("/api/analytics/track", json={
        "event": "cta_click",
        "meta": {
            "cta": "checkout_started",
            "page": "merchant_pos_home",
            "feature": "wallet",
            "path": "/checkout?token=secret",
            "amount": "3000",
        },
    })

    assert response.status_code == 200
    assert state.inserts[0]["meta"] == {
        "cta": "checkout_started",
        "page": "merchant_pos_home",
    }


def test_first_payment_never_persists_amount_or_currency_from_browser(api):
    client, state = api
    response = client.post("/api/analytics/track", json={
        "event": "first_payment",
        "meta": {"type": "card", "amount": "3000", "currency": "EUR"},
    })

    assert response.status_code == 200
    assert state.inserts[0]["meta"] == {"type": "card"}
    assert "3000" not in repr(state.inserts[0])
    assert "EUR" not in repr(state.inserts[0])


def test_unknown_event_is_rejected_without_writes_or_identity_lookup(api):
    client, state = api
    response = client.post("/api/analytics/track", json={
        "event": "untrusted_event",
        "session_id": "private-session-id",
        "meta": {"email": "private@example.invalid"},
    })

    assert response.status_code == 400
    assert state.inserts == []
    assert state.metric_updates == []
    assert state.user_reads == 0


def test_unknown_top_level_fields_are_rejected_before_database_write(api):
    client, state = api
    response = client.post("/api/analytics/track", json={
        "event": "page_view",
        "ip": "203.0.113.10",
        "meta": {"page": "home"},
    })

    assert response.status_code == 422
    assert state.inserts == []
    assert state.metric_updates == []
    assert state.user_reads == 0


def test_malformed_meta_is_rejected_before_database_write(api):
    client, state = api
    response = client.post("/api/analytics/track", json={
        "event": "page_view",
        "meta": ["email@example.invalid"],
    })

    assert response.status_code == 422
    assert state.inserts == []
    assert state.metric_updates == []
    assert state.user_reads == 0


def test_oversized_legacy_session_id_is_rejected_without_persistence(api):
    client, state = api
    response = client.post("/api/analytics/track", json={
        "event": "page_view",
        "session_id": "x" * 129,
        "meta": {"page": "home"},
    })

    assert response.status_code == 422
    assert state.inserts == []
    assert state.metric_updates == []


def test_meta_payload_with_too_many_keys_is_rejected(api):
    client, state = api
    response = client.post("/api/analytics/track", json={
        "event": "page_view",
        "meta": {
            "page": "home",
            "cta": "open",
            "source": "banner",
            "role": "customer",
            "type": "card",
            "feature": "wallet",
            "extra": "ignored",
        },
    })

    assert response.status_code == 422
    assert state.inserts == []
    assert state.metric_updates == []
