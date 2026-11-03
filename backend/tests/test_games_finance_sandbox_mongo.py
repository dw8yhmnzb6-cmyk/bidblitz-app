"""Real Mongo concurrency checks for the Games finance sandbox."""
import asyncio
import os
import unittest
from unittest.mock import AsyncMock

from fastapi import HTTPException
from motor.motor_asyncio import AsyncIOMotorClient

from routes import games_finance_sandbox as finance


class GamesFinanceSandboxMongoTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        url = os.getenv("GAME_STUDIO_TEST_MONGO_URL")
        if not url:
            self.skipTest("GAME_STUDIO_TEST_MONGO_URL is not configured")

        self.client = AsyncIOMotorClient(url)
        self.database = self.client["bidblitz_games_finance_sandbox_test"]
        await self.client.drop_database("bidblitz_games_finance_sandbox_test")

        await self.database.games_finance_sandbox_transactions.create_index(
            "id", unique=True
        )
        await self.database.games_finance_sandbox_transactions.create_index(
            "idempotency_key", unique=True
        )
        await self.database.games_finance_sandbox_transactions.create_index(
            [("purchase_id", 1), ("kind", 1), ("created_at", 1)]
        )
        await self.database.games_catalog.insert_many([
            {
                "id": "community-a",
                "owner_id": "developer-a",
                "title": "Community A",
                "status": "published",
            },
            {
                "id": "community-b",
                "owner_id": "developer-b",
                "title": "Community B",
                "status": "published",
            },
        ])

        self.old_db = finance.db
        self.old_auth = finance.get_current_user
        self.old_enabled = finance.FINANCE_SANDBOX_ENABLED
        self.old_share = finance.DEVELOPER_SHARE_BPS

        finance.db = self.database
        finance.get_current_user = AsyncMock(
            return_value={"_id": "admin-1", "role": "admin"}
        )
        finance.FINANCE_SANDBOX_ENABLED = True
        finance.DEVELOPER_SHARE_BPS = 7000

    async def asyncTearDown(self):
        finance.db = self.old_db
        finance.get_current_user = self.old_auth
        finance.FINANCE_SANDBOX_ENABLED = self.old_enabled
        finance.DEVELOPER_SHARE_BPS = self.old_share
        await self.client.drop_database("bidblitz_games_finance_sandbox_test")
        self.client.close()

    @staticmethod
    def purchase(*, amount=1000, key="purchase:parallel", game_id="community-a"):
        return finance.SandboxPurchaseInput(
            game_id=game_id,
            gross_eur_cents=amount,
            idempotency_key=key,
            note="Mongo concurrency test",
        )

    @staticmethod
    def refund(*, amount, key):
        return finance.SandboxRefundInput(
            amount_eur_cents=amount,
            idempotency_key=key,
            reason="Mongo concurrency refund",
        )

    async def test_parallel_purchase_retries_create_one_transaction(self):
        body = self.purchase()
        results = await asyncio.gather(*[
            finance.create_sandbox_purchase(body, None)
            for _ in range(12)
        ], return_exceptions=True)

        errors = [item for item in results if isinstance(item, Exception)]
        self.assertEqual(errors, [])
        ids = {item["id"] for item in results}
        self.assertEqual(len(ids), 1)

        count = await self.database.games_finance_sandbox_transactions.count_documents({
            "kind": "purchase",
            "idempotency_key": "purchase:parallel",
        })
        self.assertEqual(count, 1)

    async def test_parallel_distinct_refunds_never_over_refund_purchase(self):
        purchase = await finance.create_sandbox_purchase(
            self.purchase(amount=100, key="purchase:refund-cap"),
            None,
        )

        results = await asyncio.gather(
            finance.create_sandbox_refund(
                purchase["id"],
                self.refund(amount=60, key="refund:parallel:a"),
                None,
            ),
            finance.create_sandbox_refund(
                purchase["id"],
                self.refund(amount=60, key="refund:parallel:b"),
                None,
            ),
            return_exceptions=True,
        )

        successes = [item for item in results if isinstance(item, dict)]
        conflicts = [
            item for item in results
            if isinstance(item, HTTPException) and item.status_code == 409
        ]
        self.assertEqual(len(successes), 1)
        self.assertEqual(len(conflicts), 1)

        purchase_doc = await self.database.games_finance_sandbox_transactions.find_one({
            "id": purchase["id"],
            "kind": "purchase",
        })
        self.assertEqual(purchase_doc["refunded_eur_cents"], 60)

        completed = await self.database.games_finance_sandbox_transactions.count_documents({
            "purchase_id": purchase["id"],
            "kind": "refund",
            "status": "completed",
        })
        pending = await self.database.games_finance_sandbox_transactions.count_documents({
            "purchase_id": purchase["id"],
            "kind": "refund",
            "status": "pending",
        })
        self.assertEqual(completed, 1)
        self.assertEqual(pending, 0)

    async def test_parallel_same_refund_key_reserves_amount_once(self):
        purchase = await finance.create_sandbox_purchase(
            self.purchase(amount=100, key="purchase:same-refund"),
            None,
        )
        body = self.refund(amount=40, key="refund:same-key")

        results = await asyncio.gather(
            finance.create_sandbox_refund(purchase["id"], body, None),
            finance.create_sandbox_refund(purchase["id"], body, None),
            return_exceptions=True,
        )

        unexpected = [
            item for item in results
            if isinstance(item, Exception)
            and not (isinstance(item, HTTPException) and item.status_code == 409)
        ]
        self.assertEqual(unexpected, [])

        purchase_doc = await self.database.games_finance_sandbox_transactions.find_one({
            "id": purchase["id"],
            "kind": "purchase",
        })
        self.assertEqual(purchase_doc["refunded_eur_cents"], 40)

        refunds = await self.database.games_finance_sandbox_transactions.find({
            "purchase_id": purchase["id"],
            "kind": "refund",
        }).to_list(10)
        self.assertEqual(len(refunds), 1)
        self.assertEqual(refunds[0]["status"], "completed")
        self.assertEqual(refunds[0]["gross_eur_cents"], 40)

    async def test_multiple_refunds_reconcile_exactly_to_zero(self):
        purchase = await finance.create_sandbox_purchase(
            self.purchase(amount=101, key="purchase:full-refund"),
            None,
        )
        await finance.create_sandbox_refund(
            purchase["id"],
            self.refund(amount=33, key="refund:full:1"),
            None,
        )
        await finance.create_sandbox_refund(
            purchase["id"],
            self.refund(amount=68, key="refund:full:2"),
            None,
        )

        summary = await finance.admin_finance_sandbox_summary(None)
        self.assertEqual(summary["net_gross_eur_cents"], 0)
        self.assertEqual(summary["net_developer_eur_cents"], 0)
        self.assertEqual(summary["net_platform_eur_cents"], 0)


if __name__ == "__main__":
    unittest.main()
