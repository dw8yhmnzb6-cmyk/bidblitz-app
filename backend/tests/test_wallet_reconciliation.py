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
            if "$ne" in expected and actual == expected["$ne"]:
                return False
            continue
        if actual != expected:
            return False
    return True


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

    async def insert_one(self, doc):
        self.docs.append(copy.deepcopy(doc))
        return SimpleNamespace(inserted_id=doc.get("_id"))

    async def insert_many(self, docs):
        self.docs.extend(copy.deepcopy(list(docs)))
        return SimpleNamespace(inserted_ids=[None] * len(docs))

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
            for key, value in update.get("$inc", {}).items():
                _set_path(doc, key, (_get_path(doc, key) or 0) + value)
            if doc != before:
                modified += 1
        return SimpleNamespace(modified_count=modified)


class FailingLedgerCollection(FakeCollection):
    def __init__(self, mode):
        super().__init__([])
        self.mode = mode

    async def insert_many(self, docs):
        docs = list(docs)
        if self.mode == "partial":
            self.docs.append(copy.deepcopy(docs[0]))
        raise RuntimeError("simulated ledger write failure")


class FakeDB:
    def __init__(self, users, ledger_mode="before"):
        self.users = FakeCollection(users)
        self.payment_idempotency = FakeCollection()
        self.transactions = FakeCollection()
        self.wallet_transactions = FakeCollection()
        self.wallet_ledger_entries = FailingLedgerCollection(ledger_mode)
        self.audit_log = FakeCollection()


def _run(coro):
    return asyncio.run(coro)


def _balance(fake_db, user_id):
    return next(doc["balance"] for doc in fake_db.users.docs if doc["_id"] == user_id)


def _idempotency(fake_db, key):
    return next(doc for doc in fake_db.payment_idempotency.docs if doc["idempotency_key"] == key)


def test_credit_ledger_failure_compensates_balance(monkeypatch):
    fake_db = FakeDB([{"_id": "user-credit", "balance": 20.0}], ledger_mode="before")
    monkeypatch.setattr(wallet, "db", fake_db)

    result = _run(wallet.credit_canonical_balance(
        user_id="user-credit",
        amount_major=10.0,
        tx_type="topup",
        description="test credit",
        reference="TEST-CREDIT",
        source="test",
        metadata={},
        idempotency_key="idem-credit-compensation",
    ))

    assert result.success is False
    assert result.status == "failed"
    assert _balance(fake_db, "user-credit") == 20.0
    assert _idempotency(fake_db, "idem-credit-compensation")["status"] == "failed"


def test_debit_ledger_failure_compensates_balance(monkeypatch):
    fake_db = FakeDB([{"_id": "user-debit", "balance": 50.0}], ledger_mode="before")
    monkeypatch.setattr(wallet, "db", fake_db)

    result = _run(wallet.debit_canonical_balance(
        user_id="user-debit",
        amount_major=15.0,
        tx_type="payment",
        description="test debit",
        reference="TEST-DEBIT",
        metadata={},
        idempotency_key="idem-debit-compensation",
    ))

    assert result.success is False
    assert result.status == "failed"
    assert _balance(fake_db, "user-debit") == 50.0
    assert _idempotency(fake_db, "idem-debit-compensation")["status"] == "failed"


def test_transfer_ledger_failure_restores_both_balances(monkeypatch):
    fake_db = FakeDB([
        {"_id": "sender", "balance": 100.0},
        {"_id": "recipient", "balance": 25.0},
    ], ledger_mode="before")
    monkeypatch.setattr(wallet, "db", fake_db)

    result = _run(wallet.transfer_canonical_balance(
        from_user_id="sender",
        to_user_id="recipient",
        amount_major=30.0,
        tx_type="p2p_transfer",
        description="test transfer",
        reference="TEST-TRANSFER",
        metadata={},
        idempotency_key="idem-transfer-compensation",
    ))

    assert result.success is False
    assert result.status == "failed"
    assert _balance(fake_db, "sender") == 100.0
    assert _balance(fake_db, "recipient") == 25.0
    assert _idempotency(fake_db, "idem-transfer-compensation")["status"] == "failed"


def test_partial_ledger_failure_requires_reconciliation_and_never_replays(monkeypatch):
    fake_db = FakeDB([{"_id": "user-partial", "balance": 40.0}], ledger_mode="partial")
    monkeypatch.setattr(wallet, "db", fake_db)

    first = _run(wallet.credit_canonical_balance(
        user_id="user-partial",
        amount_major=10.0,
        tx_type="topup",
        description="partial ledger test",
        reference="TEST-PARTIAL",
        source="test",
        metadata={},
        idempotency_key="idem-partial-ledger",
    ))
    second = _run(wallet.credit_canonical_balance(
        user_id="user-partial",
        amount_major=10.0,
        tx_type="topup",
        description="partial ledger test",
        reference="TEST-PARTIAL",
        source="test",
        metadata={},
        idempotency_key="idem-partial-ledger",
    ))

    assert first.success is False
    assert first.status == "reconciliation_required"
    assert second.success is False
    assert second.status == "reconciliation_required"
    assert second.idempotent_replay is True
    assert _balance(fake_db, "user-partial") == 50.0
    assert len(fake_db.wallet_ledger_entries.docs) == 1
    assert _idempotency(fake_db, "idem-partial-ledger")["status"] == "reconciliation_required"
