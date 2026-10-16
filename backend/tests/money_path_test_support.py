"""Run money-path regressions against an isolated local CI MongoDB database."""
import asyncio
from uuid import uuid4

from motor.motor_asyncio import AsyncIOMotorClient

from core import canonical_wallet_service as canonical, payment_engine as engine


def run_money_scenario(monkeypatch, scenario, *modules):
    async def run():
        # Never use application Mongo credentials or DB_NAME for these tests.
        client = AsyncIOMotorClient("mongodb://127.0.0.1:27017", serverSelectionTimeoutMS=5000)
        name = "bidblitz_ci_money_paths_" + uuid4().hex
        db = client[name]
        try:
            await client.admin.command("ping")
            await db.payment_idempotency.create_index("idempotency_key", unique=True)
            await db.wallet_ledger_entries.create_index("entry_id", unique=True)
            for module in (canonical, engine, *modules):
                monkeypatch.setattr(module, "db", db)
            await scenario(db)
        finally:
            try:
                await client.drop_database(name)
            finally:
                client.close()

    asyncio.run(run())


class FailOnceCollection:
    """Lose one persistence operation after the preceding money step."""
    def __init__(self, collection, method="update_one"):
        self.collection = collection
        self.method = method
        self.failed = False

    def __getattr__(self, name):
        method = getattr(self.collection, name)
        if name != self.method:
            return method

        async def call(*args, **kwargs):
            if not self.failed:
                self.failed = True
                raise RuntimeError("injected persistence outage")
            return await method(*args, **kwargs)
        return call


class OverrideDB:
    def __init__(self, db, **collections):
        self.db = db
        self.collections = collections

    def __getattr__(self, name):
        return self.collections.get(name, getattr(self.db, name))
