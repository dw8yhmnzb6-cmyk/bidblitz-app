import asyncio
import copy
from types import SimpleNamespace

import pytest
from bson import ObjectId
from fastapi import HTTPException

from routes import admin_approvals as approvals


def _matches(doc, query):
    for key, expected in query.items():
        actual = doc.get(key)
        if isinstance(expected, dict) and "$in" in expected:
            if actual not in expected["$in"]:
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

    async def update_one(self, query, update, upsert=False):
        for doc in self.docs:
            if not _matches(doc, query):
                continue
            before = copy.deepcopy(doc)
            for key, value in update.get("$set", {}).items():
                doc[key] = copy.deepcopy(value)
            return SimpleNamespace(modified_count=1 if doc != before else 0)

        if upsert:
            new_doc = {}
            for key, value in query.items():
                if not isinstance(value, dict):
                    new_doc[key] = copy.deepcopy(value)
            for key, value in update.get("$setOnInsert", {}).items():
                new_doc[key] = copy.deepcopy(value)
            self.docs.append(new_doc)
            return SimpleNamespace(modified_count=0, upserted_id=new_doc.get("id"))

        return SimpleNamespace(modified_count=0)


class FakeDB:
    def __init__(self, txn):
        self.transactions = FakeCollection([txn])
        self.users = FakeCollection([{"_id": ObjectId(txn["user_id"]), "balance": 10.0}])
        self.notifications = FakeCollection()
        self.crypto_earn_deposits = FakeCollection()


def _run(coro):
    return asyncio.run(coro)


def _pending_txn():
    return {
        "id": "pending-topup-1",
        "user_id": "64b7f2aa1122334455667788",
        "type": "topup",
        "amount": 7500.0,
        "payment_method": "bank_transfer",
        "status": "pending_approval",
        "reference": "BLZ-APPROVAL-1",
        "needs_admin_approval": True,
    }


def test_wallet_topup_approval_settles_once_and_replays_without_recredit(monkeypatch):
    fake_db = FakeDB(_pending_txn())
    monkeypatch.setattr(approvals, "db", fake_db)

    async def fake_current_user(_request):
        return {"_id": ObjectId("64b7f2aa1122334455667799"), "role": "admin", "email": "admin@bidblitz.ae"}

    calls = []

    async def fake_credit_wallet(**kwargs):
        calls.append(kwargs)
        return SimpleNamespace(
            success=True,
            transaction_id="TXN-CANONICAL-1",
            new_balance=7510.0,
            status="completed",
            error=None,
            idempotent_replay=False,
        )

    monkeypatch.setattr(approvals, "get_current_user", fake_current_user)
    monkeypatch.setattr(approvals, "credit_wallet", fake_credit_wallet)

    decision = approvals.ApprovalDecision(item_id="pending-topup-1", decision="approve")
    first = _run(approvals.approve_wallet_topup(decision, object()))
    second = _run(approvals.approve_wallet_topup(decision, object()))

    assert first["settlement_transaction_id"] == "TXN-CANONICAL-1"
    assert second["idempotent_replay"] is True
    assert len(calls) == 1
    assert calls[0]["idempotency_key"] == "wallet_topup_approval:pending-topup-1"
    assert calls[0]["reference"] == "BLZ-APPROVAL-1"

    approval_record = fake_db.transactions.docs[0]
    assert approval_record["status"] == approvals.TOPUP_APPROVED_STATUS
    assert approval_record["settlement_transaction_id"] == "TXN-CANONICAL-1"
    assert approval_record["canonical_source"] == "users.balance"
    assert len(fake_db.notifications.docs) == 1


def test_processing_approval_can_resume_after_crash(monkeypatch):
    txn = _pending_txn()
    txn["status"] = "approval_processing"
    fake_db = FakeDB(txn)
    monkeypatch.setattr(approvals, "db", fake_db)

    async def fake_current_user(_request):
        return {"_id": ObjectId("64b7f2aa1122334455667799"), "role": "admin", "email": "admin@bidblitz.ae"}

    async def fake_credit_wallet(**kwargs):
        return SimpleNamespace(
            success=True,
            transaction_id="TXN-RECOVERED-1",
            new_balance=7510.0,
            status="completed",
            error=None,
            idempotent_replay=True,
        )

    monkeypatch.setattr(approvals, "get_current_user", fake_current_user)
    monkeypatch.setattr(approvals, "credit_wallet", fake_credit_wallet)

    result = _run(approvals.approve_wallet_topup(
        approvals.ApprovalDecision(item_id="pending-topup-1", decision="approve"),
        object(),
    ))

    assert result["settlement_transaction_id"] == "TXN-RECOVERED-1"
    assert fake_db.transactions.docs[0]["status"] == approvals.TOPUP_APPROVED_STATUS


def test_reject_cannot_race_an_approval_already_processing(monkeypatch):
    txn = _pending_txn()
    txn["status"] = "approval_processing"
    fake_db = FakeDB(txn)
    monkeypatch.setattr(approvals, "db", fake_db)

    async def fake_current_user(_request):
        return {"_id": ObjectId("64b7f2aa1122334455667799"), "role": "admin", "email": "admin@bidblitz.ae"}

    monkeypatch.setattr(approvals, "get_current_user", fake_current_user)

    with pytest.raises(HTTPException) as exc:
        _run(approvals.approve_wallet_topup(
            approvals.ApprovalDecision(item_id="pending-topup-1", decision="reject", reason="no"),
            object(),
        ))

    assert exc.value.status_code == 409
    assert fake_db.transactions.docs[0]["status"] == "approval_processing"
    assert fake_db.notifications.docs == []
