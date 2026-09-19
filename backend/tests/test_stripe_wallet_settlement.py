import asyncio
import copy
from pathlib import Path
from types import SimpleNamespace

import pytest

from core import stripe_wallet_settlement as settlement


BACKEND_DIR = Path(__file__).resolve().parent.parent
STRIPE_ROUTE_PATH = BACKEND_DIR / "routes" / "stripe.py"


def _matches(doc, query):
    for key, expected in query.items():
        if key == "$or":
            if not any(_matches(doc, option) for option in expected):
                return False
            continue

        actual = doc.get(key)
        if isinstance(expected, dict) and "$ne" in expected:
            forbidden = expected["$ne"]
            if isinstance(actual, list):
                if forbidden in actual:
                    return False
            elif actual == forbidden:
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
                return copy.deepcopy(doc)
        return None

    async def update_one(self, query, update):
        for doc in self.docs:
            if not _matches(doc, query):
                continue

            before = copy.deepcopy(doc)
            for key, value in update.get("$set", {}).items():
                doc[key] = copy.deepcopy(value)
            for key in update.get("$unset", {}):
                doc.pop(key, None)
            for key, value in update.get("$inc", {}).items():
                doc[key] = doc.get(key, 0) + value
            for key, value in update.get("$addToSet", {}).items():
                current = doc.setdefault(key, [])
                if value not in current:
                    current.append(copy.deepcopy(value))

            return SimpleNamespace(modified_count=1 if doc != before else 0)
        return SimpleNamespace(modified_count=0)

    async def insert_one(self, doc):
        if "_id" in doc and any(existing.get("_id") == doc["_id"] for existing in self.docs):
            raise RuntimeError("duplicate key")
        self.docs.append(copy.deepcopy(doc))
        return SimpleNamespace(inserted_id=doc.get("_id"))


class FakeDB:
    def __init__(self, *, payments, users, transactions=None):
        self.payment_transactions = FakeCollection(payments)
        self.users = FakeCollection(users)
        self.transactions = FakeCollection(transactions or [])


def _run(coro):
    return asyncio.run(coro)


def test_paid_checkout_is_credited_once_across_replay(monkeypatch):
    fake_db = FakeDB(
        payments=[{
            "session_id": "cs_paid_once",
            "type": "wallet_topup",
            "user_id": "user-1",
            "amount": 50.0,
            "currency": "EUR",
            "payment_status": "paid",
            "status": "initiated",
        }],
        users=[{"_id": "user-1", "balance": 10.0}],
    )
    monkeypatch.setattr(settlement, "db", fake_db)

    first = _run(settlement.settle_stripe_wallet_topup("cs_paid_once", expected_user_id="user-1"))
    second = _run(settlement.settle_stripe_wallet_topup("cs_paid_once", expected_user_id="user-1"))

    user = fake_db.users.docs[0]
    payment = fake_db.payment_transactions.docs[0]
    assert first["credited_now"] is True
    assert second["credited_now"] is False
    assert user["balance"] == 60.0
    assert user["stripe_checkout_credited_sessions"] == ["cs_paid_once"]
    assert payment["status"] == "credited"
    assert len(fake_db.transactions.docs) == 1
    assert fake_db.transactions.docs[0]["stripe_session_id"] == "cs_paid_once"


def test_legacy_completed_transaction_backfills_marker_without_recredit(monkeypatch):
    fake_db = FakeDB(
        payments=[{
            "session_id": "cs_legacy_done",
            "type": "wallet_topup",
            "user_id": "user-2",
            "amount": 25.0,
            "currency": "EUR",
            "payment_status": "paid",
            "status": "completed",
        }],
        users=[{"_id": "user-2", "balance": 80.0}],
        transactions=[{
            "_id": "legacy-mongo-id",
            "id": "legacy-tx",
            "reference": "LEGACY-REFERENCE",
            "stripe_session_id": "cs_legacy_done",
            "user_id": "user-2",
            "type": "topup",
            "status": "completed",
            "amount": 25.0,
        }],
    )
    monkeypatch.setattr(settlement, "db", fake_db)

    result = _run(settlement.settle_stripe_wallet_topup("cs_legacy_done", expected_user_id="user-2"))

    user = fake_db.users.docs[0]
    payment = fake_db.payment_transactions.docs[0]
    assert result["credited"] is True
    assert result["credited_now"] is False
    assert result["transaction_id"] == "legacy-tx"
    assert result["reference"] == "LEGACY-REFERENCE"
    assert payment["transaction_id"] == "legacy-tx"
    assert payment["reference"] == "LEGACY-REFERENCE"
    assert user["balance"] == 80.0
    assert user["stripe_checkout_credited_sessions"] == ["cs_legacy_done"]
    assert len(fake_db.transactions.docs) == 1


def test_existing_completed_transaction_blocks_recredit_even_if_payment_is_initiated(monkeypatch):
    fake_db = FakeDB(
        payments=[{
            "session_id": "cs_legacy_stale_status",
            "type": "wallet_topup",
            "user_id": "user-stale",
            "amount": 50.0,
            "currency": "EUR",
            "payment_status": "paid",
            "status": "initiated",
        }],
        users=[{"_id": "user-stale", "balance": 90.0}],
        transactions=[{
            "_id": "legacy-existing",
            "id": "legacy-existing-tx",
            "reference": "LEGACY-EXISTING",
            "stripe_session_id": "cs_legacy_stale_status",
            "user_id": "user-stale",
            "type": "topup",
            "status": "completed",
            "amount": 50.0,
        }],
    )
    monkeypatch.setattr(settlement, "db", fake_db)

    result = _run(settlement.settle_stripe_wallet_topup(
        "cs_legacy_stale_status",
        expected_user_id="user-stale",
    ))

    user = fake_db.users.docs[0]
    payment = fake_db.payment_transactions.docs[0]
    assert result["credited"] is True
    assert result["credited_now"] is False
    assert result["transaction_id"] == "legacy-existing-tx"
    assert result["reference"] == "LEGACY-EXISTING"
    assert user["balance"] == 90.0
    assert user["stripe_checkout_credited_sessions"] == ["cs_legacy_stale_status"]
    assert payment["status"] == "credited"
    assert len(fake_db.transactions.docs) == 1


def test_legacy_transaction_amount_mismatch_requires_review(monkeypatch):
    fake_db = FakeDB(
        payments=[{
            "session_id": "cs_legacy_amount_mismatch",
            "type": "wallet_topup",
            "user_id": "user-amount",
            "amount": 50.0,
            "currency": "EUR",
            "payment_status": "paid",
            "status": "completed",
        }],
        users=[{"_id": "user-amount", "balance": 125.0}],
        transactions=[{
            "_id": "legacy-wrong-amount",
            "id": "legacy-wrong-tx",
            "reference": "LEGACY-WRONG",
            "stripe_session_id": "cs_legacy_amount_mismatch",
            "user_id": "user-amount",
            "type": "topup",
            "status": "completed",
            "amount": 25.0,
        }],
    )
    monkeypatch.setattr(settlement, "db", fake_db)

    with pytest.raises(settlement.WalletSettlementNeedsReview):
        _run(settlement.settle_stripe_wallet_topup(
            "cs_legacy_amount_mismatch",
            expected_user_id="user-amount",
        ))

    assert fake_db.users.docs[0]["balance"] == 125.0
    payment = fake_db.payment_transactions.docs[0]
    assert payment["status"] == "manual_review_required"
    assert payment["settlement_error"] == "legacy_transaction_amount_mismatch"
    assert "stripe_checkout_credited_sessions" not in fake_db.users.docs[0]
    assert len(fake_db.transactions.docs) == 1


def test_ambiguous_legacy_terminal_state_never_auto_credits(monkeypatch):
    fake_db = FakeDB(
        payments=[{
            "session_id": "cs_legacy_ambiguous",
            "type": "wallet_topup",
            "user_id": "user-3",
            "amount": 100.0,
            "currency": "EUR",
            "payment_status": "paid",
            "status": "credited",
        }],
        users=[{"_id": "user-3", "balance": 20.0}],
    )
    monkeypatch.setattr(settlement, "db", fake_db)

    with pytest.raises(settlement.WalletSettlementNeedsReview):
        _run(settlement.settle_stripe_wallet_topup("cs_legacy_ambiguous", expected_user_id="user-3"))

    assert fake_db.users.docs[0]["balance"] == 20.0
    assert fake_db.payment_transactions.docs[0]["status"] == "manual_review_required"
    assert fake_db.transactions.docs == []


def test_polling_and_webhook_share_one_wallet_settlement_path():
    source = STRIPE_ROUTE_PATH.read_text(encoding="utf-8")
    checkout_block = source.split("async def checkout_status", 1)[1].split("# ── Webhook ──", 1)[0]
    webhook_block = source.split("async def stripe_webhook", 1)[1].split("# ── Get available packages ──", 1)[0]

    assert "settle_stripe_wallet_topup(" in checkout_block
    assert "settle_stripe_wallet_topup(" in webhook_block
    assert '"$inc": {"balance": payment["amount"]}' not in checkout_block
    assert '"$inc": {"balance": result["amount"]}' not in webhook_block
    assert "/api/stripe/webhook" in checkout_block
    assert "/api/stripe/webhook" in webhook_block
