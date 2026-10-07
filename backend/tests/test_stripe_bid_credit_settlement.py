import asyncio
import copy
from pathlib import Path
from types import SimpleNamespace

import pytest

from core import stripe_bid_credit_settlement as settlement


BACKEND_DIR = Path(__file__).resolve().parent.parent
STRIPE_ROUTE_PATH = BACKEND_DIR / "routes" / "stripe.py"
AUCTION_ROUTE_PATH = BACKEND_DIR / "routes" / "auctions.py"


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
    def __init__(self, *, payments, users, transactions=None, pending=None):
        self.payment_transactions = FakeCollection(payments)
        self.users = FakeCollection(users)
        self.transactions = FakeCollection(transactions or [])
        self.pending_credit_purchases = FakeCollection(pending or [])


def _run(coro):
    return asyncio.run(coro)


def _payment(session_id, user_id, credits, *, status="paid", pending_id="pending-1"):
    return {
        "session_id": session_id,
        "user_id": user_id,
        "amount": 12.5,
        "payment_status": status,
        "metadata": {
            "type": "bid_credits",
            "credits": credits,
            "pending_id": pending_id,
        },
    }


def test_paid_bid_credit_purchase_is_credited_once_across_replay(monkeypatch):
    fake_db = FakeDB(
        payments=[_payment("cs_bid_once", "user-1", 10)],
        users=[{"_id": "user-1", "bid_credits": 5}],
        pending=[{"pending_id": "pending-1", "status": "pending"}],
    )
    monkeypatch.setattr(settlement, "db", fake_db)

    first = _run(settlement.settle_stripe_bid_credits("cs_bid_once"))
    second = _run(settlement.settle_stripe_bid_credits("cs_bid_once"))

    user = fake_db.users.docs[0]
    payment = fake_db.payment_transactions.docs[0]
    assert first["credited_now"] is True
    assert second["credited_now"] is False
    assert user["bid_credits"] == 15
    assert user["stripe_bid_credit_sessions"] == ["cs_bid_once"]
    assert payment["payment_status"] == "credited"
    assert payment["credit_settlement_status"] == "credited"
    assert len(fake_db.transactions.docs) == 1
    assert fake_db.transactions.docs[0]["stripe_session_id"] == "cs_bid_once"
    assert fake_db.pending_credit_purchases.docs[0]["status"] == "completed"


def test_existing_legacy_transaction_backfills_marker_without_recredit(monkeypatch):
    fake_db = FakeDB(
        payments=[_payment("cs_bid_legacy", "user-2", 20, status="paid")],
        users=[{"_id": "user-2", "bid_credits": 70}],
        transactions=[{
            "_id": "legacy-bid-txn",
            "id": "legacy-bid-id",
            "reference": "LEGACY-BIDS",
            "stripe_session_id": "cs_bid_legacy",
            "user_id": "user-2",
            "type": "bid_credits_purchase",
            "status": "completed",
            "credits": 20,
            "amount": 12.5,
        }],
        pending=[{"pending_id": "pending-1", "status": "pending"}],
    )
    monkeypatch.setattr(settlement, "db", fake_db)

    result = _run(settlement.settle_stripe_bid_credits("cs_bid_legacy"))

    user = fake_db.users.docs[0]
    assert result["credited"] is True
    assert result["credited_now"] is False
    assert result["transaction_id"] == "legacy-bid-id"
    assert result["reference"] == "LEGACY-BIDS"
    assert user["bid_credits"] == 70
    assert user["stripe_bid_credit_sessions"] == ["cs_bid_legacy"]
    assert len(fake_db.transactions.docs) == 1


def test_legacy_credited_without_proof_requires_manual_review(monkeypatch):
    fake_db = FakeDB(
        payments=[_payment("cs_bid_ambiguous", "user-3", 15, status="credited")],
        users=[{"_id": "user-3", "bid_credits": 30}],
    )
    monkeypatch.setattr(settlement, "db", fake_db)

    with pytest.raises(settlement.BidCreditSettlementNeedsReview):
        _run(settlement.settle_stripe_bid_credits("cs_bid_ambiguous"))

    assert fake_db.users.docs[0]["bid_credits"] == 30
    payment = fake_db.payment_transactions.docs[0]
    assert payment["credit_settlement_status"] == "manual_review_required"
    assert payment["settlement_error"] == "legacy_credited_without_credit_proof"
    assert fake_db.transactions.docs == []


def test_legacy_transaction_credit_mismatch_requires_review(monkeypatch):
    fake_db = FakeDB(
        payments=[_payment("cs_bid_mismatch", "user-4", 25)],
        users=[{"_id": "user-4", "bid_credits": 100}],
        transactions=[{
            "_id": "legacy-bid-mismatch",
            "id": "legacy-bid-mismatch-id",
            "reference": "LEGACY-MISMATCH",
            "stripe_session_id": "cs_bid_mismatch",
            "user_id": "user-4",
            "type": "bid_credits_purchase",
            "status": "completed",
            "credits": 10,
        }],
    )
    monkeypatch.setattr(settlement, "db", fake_db)

    with pytest.raises(settlement.BidCreditSettlementNeedsReview):
        _run(settlement.settle_stripe_bid_credits("cs_bid_mismatch"))

    assert fake_db.users.docs[0]["bid_credits"] == 100
    payment = fake_db.payment_transactions.docs[0]
    assert payment["credit_settlement_status"] == "manual_review_required"
    assert payment["settlement_error"] == "legacy_transaction_credit_mismatch"


def test_stripe_webhook_uses_shared_bid_credit_settlement_path():
    source = STRIPE_ROUTE_PATH.read_text(encoding="utf-8")
    webhook_block = source.split("async def stripe_webhook", 1)[1].split("# ── Get available packages ──", 1)[0]

    assert "settle_stripe_bid_credits(" in webhook_block
    assert '"$inc": {"bid_credits": credits_to_add}' not in webhook_block
    assert '"payment_status": "credited"' not in webhook_block
    assert "BidCreditSettlementNeedsReview" in webhook_block


def test_auto_bid_reuses_expired_processing_slot_after_crash():
    source = AUCTION_ROUTE_PATH.read_text(encoding="utf-8")
    block = source.split("async def process_auto_bids", 1)[1].split("# ── Set Auto-Bid ──", 1)[0]

    assert "processing_slot = ab.get(\"processing_slot\")" in block
    assert "resume_slot = candidate_slot" in block
    assert "if placed >= max_bids and resume_slot is None:" in block
    assert '"processing_slot": next_slot' in block
    assert '"processing_recovered_at": now_iso' in block
    assert 'next_slot = placed + 1' in block
