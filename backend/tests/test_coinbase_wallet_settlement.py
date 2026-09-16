import asyncio
from pathlib import Path
from types import SimpleNamespace

from routes import coinbase_commerce as coinbase


BACKEND_DIR = Path(__file__).resolve().parent.parent
ROUTE_PATH = BACKEND_DIR / "routes" / "coinbase_commerce.py"


class FakeCharges:
    def __init__(self):
        self.doc = {
            "charge_id": "charge-safe-1",
            "user_id": "user-1",
            "amount_eur": 42.50,
            "status": "created",
            "webhook_events": [],
        }

    async def find_one(self, query):
        return dict(self.doc) if query.get("charge_id") == self.doc["charge_id"] else None

    async def update_one(self, query, update):
        if "$push" in update:
            self.doc["webhook_events"].append(update["$push"]["webhook_events"])
        self.doc.update(update.get("$set", {}))
        return SimpleNamespace(modified_count=1)


class FakeDB:
    def __init__(self):
        self.crypto_charges = FakeCharges()


def test_confirmed_webhook_uses_canonical_idempotent_credit(monkeypatch):
    fake_db = FakeDB()
    calls = []

    async def fake_credit_wallet(**kwargs):
        calls.append(kwargs)
        return SimpleNamespace(
            success=True,
            status="completed",
            error=None,
            transaction_id="tx-canonical-1",
            reference=kwargs["reference"],
        )

    monkeypatch.setattr(coinbase, "db", fake_db)
    monkeypatch.setattr(coinbase, "credit_wallet", fake_credit_wallet)

    asyncio.run(coinbase._process_event("charge:confirmed", "charge-safe-1", {}))

    assert len(calls) == 1
    assert calls[0]["idempotency_key"] == "coinbase_charge:charge-safe-1"
    assert calls[0]["user_id"] == "user-1"
    assert calls[0]["amount"] == 42.50
    assert fake_db.crypto_charges.doc["status"] == "confirmed"
    assert fake_db.crypto_charges.doc["wallet_transaction_id"] == "tx-canonical-1"


def test_coinbase_route_has_no_direct_eur_balance_write():
    source = ROUTE_PATH.read_text(encoding="utf-8")
    confirmed = source.split('if event_type == "charge:confirmed"', 1)[1]
    confirmed = confirmed.split("await db.crypto_charges.update_one(\n        {\"charge_id\": charge_id}, {\"$set\": {\"status\": new_status}}", 1)[0]

    assert "credit_wallet(" in confirmed
    assert '"$inc": {"balance": amount}' not in confirmed
    assert 'idempotency_key=f"coinbase_charge:{charge_id}"' in confirmed
