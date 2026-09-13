import asyncio
import copy
from types import SimpleNamespace

from core import canonical_wallet_service as wallet


def _get_path(doc, key):
    current = doc
    for part in key.split("."):
        if not isinstance(current, dict):
            return None
        current = current.get(part)
    return current


def _set_path(doc, key, value):
    parts = key.split(".")
    current = doc
    for part in parts[:-1]:
        current = current.setdefault(part, {})
    current[parts[-1]] = copy.deepcopy(value)


def _matches(doc, query):
    for key, expected in query.items():
        actual = _get_path(doc, key)
        if isinstance(expected, dict):
            if "$gte" in expected and not (actual is not None and actual >= expected["$gte"]):
                return False
            if "$ne" in expected:
                forbidden = expected["$ne"]
                if isinstance(actual, list):
                    if forbidden in actual:
                        return False
                elif actual == forbidden:
                    return False
            if "$in" in expected and actual not in expected["$in"]:
                return False
            continue
        if isinstance(actual, list):
            if expected not in actual:
                return False
        elif actual != expected:
            return False
    return True


class FakeCursor:
    def __init__(self, docs):
        self.docs = [copy.deepcopy(doc) for doc in docs]

    async def to_list(self, length):
        return copy.deepcopy(self.docs[:length])


class FakeCollection:
    def __init__(self, docs=None):
        self.docs = [copy.deepcopy(doc) for doc in (docs or [])]

    async def find_one(self, query, projection=None):
        for doc in self.docs:
            if _matches(doc, query):
                result = copy.deepcopy(doc)
                if projection and projection.get("_id") == 0:
                    result.pop("_id", None)
                return result
        return None

    def find(self, query, projection=None):
        rows = []
        for doc in self.docs:
            if _matches(doc, query):
                result = copy.deepcopy(doc)
                if projection and projection.get("_id") == 0:
                    result.pop("_id", None)
                rows.append(result)
        return FakeCursor(rows)

    async def insert_one(self, doc):
        self.docs.append(copy.deepcopy(doc))
        return SimpleNamespace(inserted_id=doc.get("_id"))

    async def count_documents(self, query):
        return sum(1 for doc in self.docs if _matches(doc, query))

    async def update_one(self, query, update):
        for doc in self.docs:
            if not _matches(doc, query):
                continue
            before = copy.deepcopy(doc)
            for key, value in update.get("$set", {}).items():
                _set_path(doc, key, value)
            for key, value in update.get("$inc", {}).items():
                _set_path(doc, key, (_get_path(doc, key) or 0) + value)
            for key, value in update.get("$addToSet", {}).items():
                current = _get_path(doc, key)
                if current is None:
                    _set_path(doc, key, [])
                    current = _get_path(doc, key)
                if value not in current:
                    current.append(copy.deepcopy(value))
            for key, value in update.get("$pull", {}).items():
                current = _get_path(doc, key)
                if isinstance(current, list):
                    _set_path(doc, key, [item for item in current if item != value])
            return SimpleNamespace(modified_count=1 if doc != before else 0)
        return SimpleNamespace(modified_count=0)

    async def update_many(self, query, update):
        modified = 0
        for doc in self.docs:
            if not _matches(doc, query):
                continue
            before = copy.deepcopy(doc)
            for key, value in update.get("$set", {}).items():
                _set_path(doc, key, value)
            if doc != before:
                modified += 1
        return SimpleNamespace(modified_count=modified)


class FakeDB:
    def __init__(self, users, idempotency):
        self.users = FakeCollection(users)
        self.payment_idempotency = FakeCollection(idempotency)
        self.transactions = FakeCollection()
        self.wallet_transactions = FakeCollection()
        self.wallet_ledger_entries = FakeCollection()
        self.audit_log = FakeCollection()


def _run(coro):
    return asyncio.run(coro)


def _balance(fake_db, user_id):
    return next(doc["balance"] for doc in fake_db.users.docs if doc["_id"] == user_id)


def _user(fake_db, user_id):
    return next(doc for doc in fake_db.users.docs if doc["_id"] == user_id)


def _idempotency(fake_db, key):
    return next(doc for doc in fake_db.payment_idempotency.docs if doc["idempotency_key"] == key)


def _pending_balance_doc(*, operation, key, transaction_id, user_id, amount_minor, reference, source="test"):
    tx_type = "topup" if operation == "credit" else "payment"
    payload = {
        "user_id": user_id,
        "amount_minor": amount_minor,
        "type": tx_type,
        "reference": reference,
        "source": source,
    }
    if operation == "debit":
        payload["merchant_id"] = ""
    return {
        "idempotency_key": key,
        "operation": operation,
        "request_hash": wallet.request_hash_for(operation, payload),
        "user_id": user_id,
        "status": "pending",
        "response": None,
        "balance_recovery": {
            "transaction_id": transaction_id,
            "user_id": user_id,
            "amount_minor": amount_minor,
            "operation": operation,
            "tx_type": tx_type,
            "description": f"crash recovery {operation}",
            "reference": reference,
            "source": source,
            "metadata": {},
            "merchant_id": "",
            "merchant_name": "",
            "stage": "balance_applied",
            "created_at": "2020-01-01T00:00:00+00:00",
            "updated_at": "2020-01-01T00:00:00+00:00",
        },
        "created_at": "2020-01-01T00:00:00+00:00",
        "updated_at": "2020-01-01T00:00:00+00:00",
    }


def test_stale_credit_after_balance_write_finishes_without_second_credit(monkeypatch):
    transaction_id = "TXN-CREDIT-CRASH"
    key = "idem-credit-crash"
    pending = _pending_balance_doc(
        operation="credit",
        key=key,
        transaction_id=transaction_id,
        user_id="credit-user",
        amount_minor=1000,
        reference="CREDIT-CRASH",
    )
    fake_db = FakeDB(
        [{
            "_id": "credit-user",
            "balance": 30.0,
            wallet.BALANCE_OPERATION_MARKERS_FIELD: [transaction_id],
        }],
        [pending],
    )
    monkeypatch.setattr(wallet, "db", fake_db)

    recovered = _run(wallet.credit_canonical_balance(
        user_id="credit-user",
        amount_major=10.0,
        tx_type="topup",
        description="crash recovery credit",
        reference=None,
        source="test",
        metadata={},
        idempotency_key=key,
    ))

    assert recovered.success is True
    assert recovered.idempotent_replay is True
    assert _balance(fake_db, "credit-user") == 30.0
    assert len(fake_db.wallet_ledger_entries.docs) == 2
    assert _idempotency(fake_db, key)["status"] == "completed"
    assert _user(fake_db, "credit-user").get(wallet.BALANCE_OPERATION_MARKERS_FIELD, []) == []

    replay = _run(wallet.credit_canonical_balance(
        user_id="credit-user",
        amount_major=10.0,
        tx_type="topup",
        description="crash recovery credit",
        reference=None,
        source="test",
        metadata={},
        idempotency_key=key,
    ))
    assert replay.success is True
    assert replay.idempotent_replay is True
    assert _balance(fake_db, "credit-user") == 30.0
    assert len(fake_db.wallet_ledger_entries.docs) == 2


def test_stale_debit_after_balance_write_finishes_without_second_debit(monkeypatch):
    transaction_id = "TXN-DEBIT-CRASH"
    key = "idem-debit-crash"
    pending = _pending_balance_doc(
        operation="debit",
        key=key,
        transaction_id=transaction_id,
        user_id="debit-user",
        amount_minor=1500,
        reference="DEBIT-CRASH",
        source="payment_engine",
    )
    fake_db = FakeDB(
        [{
            "_id": "debit-user",
            "balance": 35.0,
            wallet.BALANCE_OPERATION_MARKERS_FIELD: [transaction_id],
        }],
        [pending],
    )
    monkeypatch.setattr(wallet, "db", fake_db)

    recovered = _run(wallet.debit_canonical_balance(
        user_id="debit-user",
        amount_major=15.0,
        tx_type="payment",
        description="crash recovery debit",
        reference=None,
        metadata={},
        idempotency_key=key,
    ))

    assert recovered.success is True
    assert recovered.idempotent_replay is True
    assert _balance(fake_db, "debit-user") == 35.0
    assert len(fake_db.wallet_ledger_entries.docs) == 2
    assert _idempotency(fake_db, key)["status"] == "completed"
    assert _user(fake_db, "debit-user").get(wallet.BALANCE_OPERATION_MARKERS_FIELD, []) == []

    replay = _run(wallet.debit_canonical_balance(
        user_id="debit-user",
        amount_major=15.0,
        tx_type="payment",
        description="crash recovery debit",
        reference=None,
        metadata={},
        idempotency_key=key,
    ))
    assert replay.success is True
    assert replay.idempotent_replay is True
    assert _balance(fake_db, "debit-user") == 35.0
    assert len(fake_db.wallet_ledger_entries.docs) == 2


def test_stale_legacy_pending_credit_without_recovery_requires_manual_review(monkeypatch):
    fake_db = FakeDB(
        [{"_id": "legacy-credit-user", "balance": 40.0}],
        [{
            "idempotency_key": "legacy-credit-no-recovery",
            "operation": "credit",
            "request_hash": "legacy-hash",
            "user_id": "legacy-credit-user",
            "status": "pending",
            "response": None,
            "created_at": "2020-01-01T00:00:00+00:00",
        }],
    )
    monkeypatch.setattr(wallet, "db", fake_db)

    stats = _run(wallet.reconcile_pending_wallet_transfers(stale_seconds=1))

    assert stats["checked"] == 1
    assert stats["manual_review"] == 1
    row = _idempotency(fake_db, "legacy-credit-no-recovery")
    assert row["status"] == "reconciliation_required"
    assert "no durable recovery state" in row["response"]["error"]
    assert _balance(fake_db, "legacy-credit-user") == 40.0
