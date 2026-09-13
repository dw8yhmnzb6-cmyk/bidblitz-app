import asyncio

import pytest

from core import database


class FakeCollection:
    def __init__(self, name, *, fail_payment_idempotency=False):
        self.name = name
        self.fail_payment_idempotency = fail_payment_idempotency
        self.create_calls = []
        self.drop_calls = []

    async def create_index(self, keys, **kwargs):
        self.create_calls.append((keys, dict(kwargs)))
        if self.name == "payment_idempotency" and self.fail_payment_idempotency and keys == "idempotency_key":
            raise RuntimeError("E11000 duplicate key error collection: payment_idempotency")
        return kwargs.get("name") or str(keys)

    async def drop_index(self, name):
        self.drop_calls.append(name)


class FakeDB:
    def __init__(self, *, fail_payment_idempotency=False):
        self.fail_payment_idempotency = fail_payment_idempotency
        self.collections = {}

    def __getattr__(self, name):
        if name.startswith("_"):
            raise AttributeError(name)
        if name not in self.collections:
            self.collections[name] = FakeCollection(
                name,
                fail_payment_idempotency=self.fail_payment_idempotency,
            )
        return self.collections[name]


def _run(coro):
    return asyncio.run(coro)


def test_payment_idempotency_index_is_requested_as_unique(monkeypatch):
    fake_db = FakeDB()
    monkeypatch.setattr(database, "db", fake_db)

    _run(database.create_indexes())

    calls = fake_db.payment_idempotency.create_calls
    assert ("idempotency_key", {"unique": True}) in calls


def test_duplicate_payment_idempotency_keys_fail_index_initialization(monkeypatch):
    fake_db = FakeDB(fail_payment_idempotency=True)
    monkeypatch.setattr(database, "db", fake_db)

    with pytest.raises(RuntimeError, match="Critical database index could not be created"):
        _run(database.create_indexes())
