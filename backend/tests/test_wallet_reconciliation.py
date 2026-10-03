import asyncio
import copy
from pathlib import Path
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

    async def insert_many(self, docs):
        docs = list(docs)
        self.docs.extend(copy.deepcopy(docs))
        return SimpleNamespace(inserted_ids=[None] * len(docs))

    async def count_documents(self, query):
        return sum(1 for doc in self.docs if _matches(doc, query))

    def _apply_update(self, doc, update):
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

    async def update_one(self, query, update):
        for doc in self.docs:
            if not _matches(doc, query):
                continue
            before = copy.deepcopy(doc)
            self._apply_update(doc, update)
            return SimpleNamespace(modified_count=1 if doc != before else 0)
        return SimpleNamespace(modified_count=0)

    async def update_many(self, query, update):
        modified = 0
        for doc in self.docs:
            if not _matches(doc, query):
                continue
            before = copy.deepcopy(doc)
            self._apply_update(doc, update)
            if doc != before:
                modified += 1
        return SimpleNamespace(modified_count=modified)


class FailingLedgerCollection(FakeCollection):
    def __init__(self, mode):
        super().__init__([])
        self.mode = mode
        self.transfer_insert_count = 0

    async def insert_many(self, docs):
        docs = list(docs)
        if self.mode == "ok":
            return await super().insert_many(docs)
        if self.mode == "partial":
            self.docs.append(copy.deepcopy(docs[0]))
        raise RuntimeError("simulated ledger write failure")

    async def insert_one(self, doc):
        if self.mode == "ok":
            return await super().insert_one(doc)
        self.transfer_insert_count += 1
        if self.mode == "partial" and self.transfer_insert_count == 1:
            return await super().insert_one(doc)
        raise RuntimeError("simulated ledger write failure")


class FakeDB:
    def __init__(
        self,
        users,
        ledger_mode="before",
        *,
        idempotency=None,
        transactions=None,
        wallet_transactions=None,
        ledger_entries=None,
    ):
        self.users = FakeCollection(users)
        self.payment_idempotency = FakeCollection(idempotency or [])
        self.transactions = FakeCollection(transactions or [])
        self.wallet_transactions = FakeCollection(wallet_transactions or [])
        self.wallet_ledger_entries = FailingLedgerCollection(ledger_mode)
        if ledger_entries:
            self.wallet_ledger_entries.docs = copy.deepcopy(ledger_entries)
        self.audit_log = FakeCollection()


def _run(coro):
    return asyncio.run(coro)


def _balance(fake_db, user_id):
    return next(doc["balance"] for doc in fake_db.users.docs if doc["_id"] == user_id)


def _user(fake_db, user_id):
    return next(doc for doc in fake_db.users.docs if doc["_id"] == user_id)


def _idempotency(fake_db, key):
    return next(doc for doc in fake_db.payment_idempotency.docs if doc["idempotency_key"] == key)


def _pending_transfer_doc(*, key, transaction_id, sender, recipient, amount_minor, reference, sender_marker=False, recipient_marker=False):
    request_hash = wallet.request_hash_for(
        "transfer",
        {
            "from_user_id": sender,
            "to_user_id": recipient,
            "amount_minor": amount_minor,
            "type": "p2p_transfer",
            "reference": reference,
        },
    )
    recovery = {
        "transaction_id": transaction_id,
        "sender_tx_id": f"{transaction_id}-OUT",
        "recipient_tx_id": f"{transaction_id}-IN",
        "from_user_id": sender,
        "to_user_id": recipient,
        "amount_minor": amount_minor,
        "tx_type": "p2p_transfer",
        "description": "crash recovery transfer",
        "reference": reference,
        "metadata": {},
        "stage": "sender_debited" if sender_marker and not recipient_marker else "recipient_credited" if recipient_marker else "prepared",
        "created_at": "2020-01-01T00:00:00+00:00",
        "updated_at": "2020-01-01T00:00:00+00:00",
    }
    return {
        "idempotency_key": key,
        "operation": "transfer",
        "request_hash": request_hash,
        "user_id": sender,
        "status": "pending",
        "response": None,
        "transfer_recovery": recovery,
        "created_at": "2020-01-01T00:00:00+00:00",
        "updated_at": "2020-01-01T00:00:00+00:00",
    }


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


def test_transfer_ledger_failure_restores_both_balances_and_markers(monkeypatch):
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
    assert _user(fake_db, "sender").get(wallet.TRANSFER_DEBIT_MARKERS_FIELD, []) == []
    assert _user(fake_db, "recipient").get(wallet.TRANSFER_CREDIT_MARKERS_FIELD, []) == []
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


def test_stale_sender_debit_crash_recovers_recipient_exactly_once(monkeypatch):
    transaction_id = "TXN-CRASH-SENDER"
    key = "idem-crash-sender"
    reference = "TRF-CRASH1"
    pending = _pending_transfer_doc(
        key=key,
        transaction_id=transaction_id,
        sender="sender-crash",
        recipient="recipient-crash",
        amount_minor=3000,
        reference=reference,
        sender_marker=True,
    )
    fake_db = FakeDB(
        [
            {
                "_id": "sender-crash",
                "balance": 70.0,
                wallet.TRANSFER_DEBIT_MARKERS_FIELD: [transaction_id],
            },
            {"_id": "recipient-crash", "balance": 10.0},
        ],
        ledger_mode="ok",
        idempotency=[pending],
    )
    monkeypatch.setattr(wallet, "db", fake_db)

    result = _run(wallet.transfer_canonical_balance(
        from_user_id="sender-crash",
        to_user_id="recipient-crash",
        amount_major=30.0,
        tx_type="p2p_transfer",
        description="crash recovery transfer",
        reference=None,
        metadata={},
        idempotency_key=key,
    ))

    assert result.success is True
    assert result.idempotent_replay is True
    assert _balance(fake_db, "sender-crash") == 70.0
    assert _balance(fake_db, "recipient-crash") == 40.0
    assert _idempotency(fake_db, key)["status"] == "completed"
    assert len(fake_db.wallet_ledger_entries.docs) == 2
    assert _user(fake_db, "sender-crash").get(wallet.TRANSFER_DEBIT_MARKERS_FIELD, []) == []
    assert _user(fake_db, "recipient-crash").get(wallet.TRANSFER_CREDIT_MARKERS_FIELD, []) == []

    replay = _run(wallet.transfer_canonical_balance(
        from_user_id="sender-crash",
        to_user_id="recipient-crash",
        amount_major=30.0,
        tx_type="p2p_transfer",
        description="crash recovery transfer",
        reference=None,
        metadata={},
        idempotency_key=key,
    ))
    assert replay.success is True
    assert replay.idempotent_replay is True
    assert _balance(fake_db, "sender-crash") == 70.0
    assert _balance(fake_db, "recipient-crash") == 40.0
    assert len(fake_db.wallet_ledger_entries.docs) == 2


def test_crash_after_both_balance_writes_only_finalizes_accounting(monkeypatch):
    transaction_id = "TXN-CRASH-BOTH"
    key = "idem-crash-both"
    reference = "TRF-CRASH2"
    pending = _pending_transfer_doc(
        key=key,
        transaction_id=transaction_id,
        sender="sender-both",
        recipient="recipient-both",
        amount_minor=2000,
        reference=reference,
        sender_marker=True,
        recipient_marker=True,
    )
    fake_db = FakeDB(
        [
            {
                "_id": "sender-both",
                "balance": 80.0,
                wallet.TRANSFER_DEBIT_MARKERS_FIELD: [transaction_id],
            },
            {
                "_id": "recipient-both",
                "balance": 35.0,
                wallet.TRANSFER_CREDIT_MARKERS_FIELD: [transaction_id],
            },
        ],
        ledger_mode="ok",
        idempotency=[pending],
    )
    monkeypatch.setattr(wallet, "db", fake_db)

    result = _run(wallet.transfer_canonical_balance(
        from_user_id="sender-both",
        to_user_id="recipient-both",
        amount_major=20.0,
        tx_type="p2p_transfer",
        description="crash recovery transfer",
        reference=None,
        metadata={},
        idempotency_key=key,
    ))

    assert result.success is True
    assert _balance(fake_db, "sender-both") == 80.0
    assert _balance(fake_db, "recipient-both") == 35.0
    assert len(fake_db.wallet_ledger_entries.docs) == 2
    assert _idempotency(fake_db, key)["status"] == "completed"


def test_recipient_marker_without_sender_marker_requires_reconciliation(monkeypatch):
    transaction_id = "TXN-IMPOSSIBLE"
    key = "idem-impossible-state"
    reference = "TRF-IMPOSSIBLE"
    pending = _pending_transfer_doc(
        key=key,
        transaction_id=transaction_id,
        sender="sender-impossible",
        recipient="recipient-impossible",
        amount_minor=1000,
        reference=reference,
        recipient_marker=True,
    )
    fake_db = FakeDB(
        [
            {"_id": "sender-impossible", "balance": 100.0},
            {
                "_id": "recipient-impossible",
                "balance": 30.0,
                wallet.TRANSFER_CREDIT_MARKERS_FIELD: [transaction_id],
            },
        ],
        ledger_mode="ok",
        idempotency=[pending],
    )
    monkeypatch.setattr(wallet, "db", fake_db)

    result = _run(wallet.transfer_canonical_balance(
        from_user_id="sender-impossible",
        to_user_id="recipient-impossible",
        amount_major=10.0,
        tx_type="p2p_transfer",
        description="crash recovery transfer",
        reference=None,
        metadata={},
        idempotency_key=key,
    ))

    assert result.success is False
    assert result.status == "reconciliation_required"
    assert _balance(fake_db, "sender-impossible") == 100.0
    assert _balance(fake_db, "recipient-impossible") == 30.0
    assert _idempotency(fake_db, key)["status"] == "reconciliation_required"


def test_stale_legacy_pending_transfer_without_recovery_is_escalated(monkeypatch):
    fake_db = FakeDB(
        [
            {"_id": "legacy-sender", "balance": 100.0},
            {"_id": "legacy-recipient", "balance": 20.0},
        ],
        ledger_mode="ok",
        idempotency=[{
            "idempotency_key": "legacy-pending-no-recovery",
            "operation": "transfer",
            "request_hash": "legacy-hash",
            "user_id": "legacy-sender",
            "status": "pending",
            "response": None,
            "created_at": "2020-01-01T00:00:00+00:00",
        }],
    )
    monkeypatch.setattr(wallet, "db", fake_db)

    stats = _run(wallet.reconcile_pending_wallet_transfers(stale_seconds=1))

    assert stats["checked"] == 1
    assert stats["manual_review"] == 1
    row = _idempotency(fake_db, "legacy-pending-no-recovery")
    assert row["status"] == "reconciliation_required"
    assert "no durable recovery state" in row["response"]["error"]
    assert _balance(fake_db, "legacy-sender") == 100.0
    assert _balance(fake_db, "legacy-recipient") == 20.0


def test_transfer_recovery_is_wired_into_runtime_startup():
    source = (Path(__file__).resolve().parents[1] / "server.py").read_text(encoding="utf-8")

    assert "async def _wallet_transfer_recovery_loop()" in source
    assert "recovery_stats = await reconcile_pending_wallet_transfers(limit=100)" in source
    assert "app.state.wallet_transfer_recovery_task = asyncio.create_task(_wallet_transfer_recovery_loop())" in source
    assert "wallet_recovery_task.cancel()" in source
