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
    assert '"$max": {"refunded_amount": historical_refunded_total}' in source
    assert '"$expr": {' in source
    assert '"$inc": {"refunded_amount": refund_amount}' in source


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


class _AsyncRows:
    def __init__(self, rows):
        self._rows = list(rows)
        self._index = 0

    def __aiter__(self):
        self._index = 0
        return self

    async def __anext__(self):
        if self._index >= len(self._rows):
            raise StopAsyncIteration
        row = self._rows[self._index]
        self._index += 1
        return dict(row)


class _RefundRows:
    def __init__(self, rows=None):
        self.rows = list(rows or [])

    def find(self, query, projection=None):
        return _AsyncRows(row for row in self.rows if row.get("payment_id") == query.get("payment_id"))


class _PaymentDoc:
    def __init__(self, doc):
        self.doc = dict(doc)

    async def find_one(self, query):
        if query.get("payment_id") != self.doc.get("payment_id"):
            return None
        return dict(self.doc)

    async def update_one(self, query, update):
        if query.get("payment_id") != self.doc.get("payment_id"):
            return SimpleNamespace(modified_count=0)

        before = repr(self.doc)
        if "$max" in update:
            for key, value in update["$max"].items():
                self.doc[key] = max(float(self.doc.get(key, 0) or 0), float(value))

        if "$expr" in query:
            refund_amount = round(float(update["$inc"]["refunded_amount"]), 2)
            total_amount = round(float(query["$expr"]["$lte"][1]), 2)
            reservation_field = next(
                key for key in query if key.startswith("mock_refund_reservations.")
            )
            reservation_hash = reservation_field.split(".", 1)[1]
            reservations = self.doc.setdefault("mock_refund_reservations", {})
            if reservation_hash in reservations:
                return SimpleNamespace(modified_count=0)
            current = round(float(self.doc.get("refunded_amount", 0) or 0), 2)
            if round(current + refund_amount, 2) > total_amount:
                return SimpleNamespace(modified_count=0)
            self.doc["refunded_amount"] = round(current + refund_amount, 2)

        for key, value in update.get("$set", {}).items():
            if key.startswith("mock_refund_reservations."):
                reservation_hash = key.split(".", 1)[1]
                self.doc.setdefault("mock_refund_reservations", {})[reservation_hash] = dict(value)
            else:
                self.doc[key] = value

        return SimpleNamespace(modified_count=1 if repr(self.doc) != before else 0)


def _refund_db(amount=100.0):
    payments = _PaymentDoc({
        "payment_id": "bbp-refund-test",
        "amount": amount,
        "status": "paid",
        "mode": "mock",
    })
    return SimpleNamespace(
        bidblitz_pay_payments=payments,
        bidblitz_pay_refunds=_RefundRows(),
    )


def test_mock_refund_reservation_prevents_over_refund(monkeypatch):
    fake_db = _refund_db(100.0)
    monkeypatch.setattr(pay, "db", fake_db)

    first = _run(pay._reserve_mock_refund("bbp-refund-test", "refund-a", 60.0))
    assert first["reused"] is False
    assert fake_db.bidblitz_pay_payments.doc["refunded_amount"] == 60.0

    with pytest.raises(HTTPException) as exc_info:
        _run(pay._reserve_mock_refund("bbp-refund-test", "refund-b", 60.0))
    assert exc_info.value.status_code == 400
    assert fake_db.bidblitz_pay_payments.doc["refunded_amount"] == 60.0

    replay = _run(pay._reserve_mock_refund("bbp-refund-test", "refund-a", 60.0))
    assert replay["reused"] is True
    assert replay["refund_id"] == first["refund_id"]
    assert fake_db.bidblitz_pay_payments.doc["refunded_amount"] == 60.0


def test_full_mock_refund_without_amount_replays_safely(monkeypatch):
    fake_db = _refund_db(100.0)
    monkeypatch.setattr(pay, "db", fake_db)

    first = _run(pay._reserve_mock_refund("bbp-refund-test", "refund-full", None))
    replay = _run(pay._reserve_mock_refund("bbp-refund-test", "refund-full", None))

    assert first["amount"] == 100.0
    assert replay["reused"] is True
    assert replay["amount"] == 100.0
    assert replay["refund_id"] == first["refund_id"]
    assert fake_db.bidblitz_pay_payments.doc["refunded_amount"] == 100.0
