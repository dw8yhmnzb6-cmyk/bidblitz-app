import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from services.fuel_provider_contract_repository import (
    FuelProviderContractRepository,
    contract_from_payload,
)


class Cursor:
    def __init__(self, docs):
        self.docs = docs
    def sort(self, key, direction):
        self.docs = sorted(self.docs, key=lambda d: d.get(key, ""), reverse=direction < 0)
        return self
    def limit(self, n):
        self.docs = self.docs[:n]
        return self
    async def to_list(self, n):
        return [dict(d) for d in self.docs[:n]]


class Collection:
    def __init__(self):
        self.docs = {}
    async def find_one(self, query, projection=None):
        doc = self.docs.get(query.get("provider"))
        if not doc:
            return None
        if projection and projection.get("created_at"):
            return {"created_at": doc.get("created_at")}
        return dict(doc)
    async def update_one(self, query, update, upsert=False):
        provider = query["provider"]
        doc = dict(self.docs.get(provider) or {})
        doc.update(update.get("$set") or {})
        self.docs[provider] = doc
    def find(self, query, projection=None):
        return Cursor([dict(d) for d in self.docs.values()])


class DB:
    def __init__(self):
        self.fuel_provider_contracts = Collection()


class TestFuelProviderContractRepository(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.repo = FuelProviderContractRepository(DB())

    async def test_save_and_get_draft(self):
        cfg = contract_from_payload("dkv", {
            "state": "draft",
            "rights": {"api": True},
            "commercial": {
                "revenue_model": "none",
                "payment_fee_owner": "operator",
                "merchant_of_record": "operator",
                "supplier_of_record": "operator",
                "currency": "EUR",
            },
        })
        saved = await self.repo.save(cfg, actor="admin@bidblitz.ae")
        self.assertEqual(saved["provider"], "dkv")
        self.assertEqual(saved["updated_by"], "admin@bidblitz.ae")
        got = await self.repo.get("dkv")
        self.assertTrue(got["rights"]["api"])

    async def test_list_is_sorted(self):
        for provider in ("pace", "dkv"):
            cfg = contract_from_payload(provider, {
                "state": "draft",
                "commercial": {
                    "revenue_model": "none",
                    "payment_fee_owner": "operator",
                    "merchant_of_record": "operator",
                    "supplier_of_record": "operator",
                    "currency": "EUR",
                },
            })
            await self.repo.save(cfg, actor="admin")
        rows = await self.repo.list()
        self.assertEqual([r["provider"] for r in rows], ["dkv", "pace"])


if __name__ == "__main__":
    unittest.main()
