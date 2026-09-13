import asyncio
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from routes import bidblitz_pay as pay


ROUTE_PATH = Path(__file__).resolve().parents[1] / "routes" / "bidblitz_pay.py"


def _run(coro):
    return asyncio.run(coro)


def _request(**overrides):
    data = {
        "amount": 25.0,
        "currency": "EUR",
        "order_id": "ORDER-25",
        "description": "Test payment",
        "customer_email": "buyer@example.com",
        "metadata": {"source": "ci"},
    }
    data.update(overrides)
    return pay.BidBlitzPayCreateRequest(**data)


def test_payment_idempotency_is_scoped_per_authenticated_actor():
    req = _request()
    raw_key = "same-client-key"

    scope_a = pay._idempotency_scope(req, {"_id": "user-a", "email": "a@example.com"})
    scope_b = pay._idempotency_scope(req, {"_id": "user-b", "email": "b@example.com"})

    assert scope_a != scope_b
    assert pay._scoped_idempotency_key(scope_a, raw_key) != pay._scoped_idempotency_key(scope_b, raw_key)


def test_payment_idempotency_is_scoped_per_guest_email():
    raw_key = "same-guest-key"
    req_a = _request(customer_email="guest-a@example.com")
    req_b = _request(customer_email="guest-b@example.com")

    scope_a = pay._idempotency_scope(req_a, None)
    scope_b = pay._idempotency_scope(req_b, None)

    assert scope_a != scope_b
    assert pay._scoped_idempotency_key(scope_a, raw_key) != pay._scoped_idempotency_key(scope_b, raw_key)


def test_legacy_idempotency_never_crosses_authenticated_owners():
    req = _request(customer_email="owner@example.com")
    existing = {
        "amount": 25.0,
        "currency": "EUR",
        "order_id": "ORDER-25",
        "customer_email": "owner@example.com",
        "created_by_user_id": "owner-user",
        "created_by_email": "owner@example.com",
    }

    assert pay._legacy_idempotency_owner_matches(
        existing,
        {"_id": "owner-user", "email": "owner@example.com", "role": "user"},
        req,
    ) is True
    assert pay._legacy_idempotency_owner_matches(
        existing,
        {"_id": "other-user", "email": "other@example.com", "role": "user"},
        req,
    ) is False


def test_source_scopes_payment_and_refund_idempotency():
    source = ROUTE_PATH.read_text(encoding="utf-8")

    assert 'find_one({"scoped_idempotency_key": scoped_key})' in source
    assert '"scoped_idempotency_key": scoped_key' in source
    assert '"Idempotency-Key": scoped_key' in source
    assert '{"payment_id": payment_id, "idempotency_key": refund_key}' in source
    assert 'name="uniq_bbp_scoped_idempotency"' in source
    assert 'name="uniq_bbp_refund_idempotency"' in source


def test_bidblitz_pay_indexes_are_unique(monkeypatch):
    class FakeCollection:
        def __init__(self):
            self.calls = []

        async def create_index(self, keys, **kwargs):
            self.calls.append((keys, dict(kwargs)))
            return kwargs.get("name")

    fake_db = SimpleNamespace(
        bidblitz_pay_payments=FakeCollection(),
        bidblitz_pay_refunds=FakeCollection(),
    )
    monkeypatch.setattr(pay, "db", fake_db)
    monkeypatch.setattr(pay, "_bidblitz_pay_indexes_ready", False)

    _run(pay._ensure_bidblitz_pay_idempotency_indexes())

    payment_call = fake_db.bidblitz_pay_payments.calls[0]
    refund_call = fake_db.bidblitz_pay_refunds.calls[0]
    assert payment_call[0] == "scoped_idempotency_key"
    assert payment_call[1]["unique"] is True
    assert payment_call[1]["sparse"] is True
    assert refund_call[0] == [("payment_id", 1), ("idempotency_key", 1)]
    assert refund_call[1]["unique"] is True


def test_provider_webhook_fails_closed_when_secret_missing(monkeypatch):
    class FakeRequest:
        async def json(self):
            return {"event": "payment.paid", "payment_id": "bbp-test"}

    audits = []

    async def fake_audit(action, payment_id="", details=None):
        audits.append((action, payment_id, details or {}))

    monkeypatch.setattr(
        pay,
        "_cfg",
        lambda: {"api_url": "", "api_key": "", "merchant_id": "", "webhook_secret": ""},
    )
    monkeypatch.setattr(pay, "_write_gateway_audit", fake_audit)

    forged_signature = pay._signature(
        "mock-webhook-secret",
        {"event": "payment.paid", "payment_id": "bbp-test"},
    )
    with pytest.raises(HTTPException) as exc_info:
        _run(pay.bidblitz_pay_webhook(FakeRequest(), forged_signature))

    assert exc_info.value.status_code == 503
    assert audits[0][0] == "provider_webhook_rejected_missing_secret"


def test_hardcoded_webhook_secret_is_not_used_by_route():
    source = ROUTE_PATH.read_text(encoding="utf-8")
    assert 'or "mock-webhook-secret"' not in source
