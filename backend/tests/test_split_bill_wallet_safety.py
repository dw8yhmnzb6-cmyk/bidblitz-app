import asyncio
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from routes import split_bill


BACKEND_DIR = Path(__file__).resolve().parent.parent
ROUTE_PATH = BACKEND_DIR / "routes" / "split_bill.py"
FRONTEND_PATH = BACKEND_DIR.parent / "frontend" / "src" / "pages" / "SplitBillPage.jsx"


class FakeSplitBills:
    def __init__(self):
        self.doc = {
            "split_id": "SPLIT-SAFE1",
            "creator_id": "creator-1",
            "title": "Dinner",
            "status": "active",
            "participants": [
                {"user_id": "creator-1", "amount_owed": 12.50, "paid": True},
                {"user_id": "payer-1", "amount_owed": 12.50, "paid": False},
            ],
        }

    async def find_one(self, query, *args, **kwargs):
        return self.doc if query.get("split_id") == self.doc["split_id"] else None

    async def update_one(self, query, update):
        values = update.get("$set", {})
        if "participants.$.paid" in values:
            for participant in self.doc["participants"]:
                if participant.get("user_id") == query.get("participants.user_id"):
                    participant["paid"] = values["participants.$.paid"]
                    participant["paid_at"] = values["participants.$.paid_at"]
                    participant["wallet_transaction_id"] = values["participants.$.wallet_transaction_id"]
        if "status" in values:
            self.doc["status"] = values["status"]
        return SimpleNamespace(modified_count=1)


class FakeDB:
    def __init__(self):
        self.split_bills = FakeSplitBills()


def test_split_payment_uses_canonical_idempotent_transfer(monkeypatch):
    fake_db = FakeDB()
    calls = []

    async def fake_current_user(_request):
        return {"_id": "payer-1", "name": "Payer"}

    async def fake_transfer(**kwargs):
        calls.append(kwargs)
        return SimpleNamespace(
            success=True,
            status="completed",
            error=None,
            transaction_id="tx-split-1",
            reference=kwargs["reference"],
            new_balance=87.50,
            idempotent_replay=False,
        )

    monkeypatch.setattr(split_bill, "db", fake_db)
    monkeypatch.setattr(split_bill, "get_current_user", fake_current_user)
    monkeypatch.setattr(split_bill, "transfer_between_wallets", fake_transfer)

    result = asyncio.run(split_bill.pay_split_bill(split_bill.SplitPayment(split_id="SPLIT-SAFE1"), object()))

    assert result["success"] is True
    assert result["transaction_id"] == "tx-split-1"
    assert len(calls) == 1
    assert calls[0]["from_user_id"] == "payer-1"
    assert calls[0]["to_user_id"] == "creator-1"
    assert calls[0]["amount"] == 12.50
    assert calls[0]["idempotency_key"] == "split_bill:SPLIT-SAFE1:payer-1"
    assert fake_db.split_bills.doc["participants"][1]["wallet_transaction_id"] == "tx-split-1"
    assert fake_db.split_bills.doc["status"] == "completed"


def test_split_payment_rejects_client_amount_override(monkeypatch):
    fake_db = FakeDB()
    calls = []

    async def fake_current_user(_request):
        return {"_id": "payer-1"}

    async def fake_transfer(**kwargs):
        calls.append(kwargs)

    monkeypatch.setattr(split_bill, "db", fake_db)
    monkeypatch.setattr(split_bill, "get_current_user", fake_current_user)
    monkeypatch.setattr(split_bill, "transfer_between_wallets", fake_transfer)

    with pytest.raises(HTTPException) as exc:
        asyncio.run(split_bill.pay_split_bill(split_bill.SplitPayment(split_id="SPLIT-SAFE1", amount=0.01), object()))

    assert exc.value.status_code == 400
    assert calls == []


def test_split_bill_money_path_has_no_direct_user_balance_write():
    source = ROUTE_PATH.read_text(encoding="utf-8")
    pay_source = source.split('@router.post("/pay")', 1)[1].split('@router.post("/{split_id}/remind")', 1)[0]
    assert "transfer_between_wallets(" in pay_source
    assert "db.users.update_one" not in pay_source
    assert 'idempotency_key=f"split_bill:{req.split_id}:{user_id}"' in pay_source


def test_split_bill_frontend_matches_backend_create_contract():
    source = FRONTEND_PATH.read_text(encoding="utf-8")
    assert "`${API}/api/split/create`" in source
    assert "total_amount: parseFloat(form.total)" in source
    assert "/api/split-bill/create" not in source
