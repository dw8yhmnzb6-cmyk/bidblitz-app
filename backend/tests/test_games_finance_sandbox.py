"""Tests for the fail-closed BidBlitz Games finance sandbox."""
import asyncio
import types
import unittest
from unittest.mock import AsyncMock

from fastapi import HTTPException

from routes import games_finance_sandbox as finance


def matches(doc, query):
    for key, value in query.items():
        if doc.get(key) != value:
            return False
    return True


class Cursor:
    def __init__(self, rows):
        self.rows = [dict(row) for row in rows]

    def sort(self, key, direction):
        self.rows.sort(key=lambda row: row.get(key) or "", reverse=direction < 0)
        return self

    def limit(self, value):
        self.rows = self.rows[:value]
        return self

    async def to_list(self, value):
        return self.rows[:value]


class DuplicateKeyError(Exception):
    code = 11000


class Collection:
    def __init__(self, docs=None, unique=False):
        self.docs = [dict(row) for row in (docs or [])]
        self.unique = unique

    async def find_one(self, query, projection=None):
        row = next((doc for doc in self.docs if matches(doc, query)), None)
        return dict(row) if row else None

    def find(self, query, projection=None):
        return Cursor([doc for doc in self.docs if matches(doc, query)])

    async def insert_one(self, doc):
        if self.unique and any(
            row.get("id") == doc.get("id")
            or row.get("idempotency_key") == doc.get("idempotency_key")
            for row in self.docs
        ):
            raise DuplicateKeyError()
        self.docs.append(dict(doc))
        return types.SimpleNamespace(inserted_id=doc.get("id"))

    async def update_one(self, query, update):
        row = next((doc for doc in self.docs if matches(doc, query)), None)
        if row is None:
            return types.SimpleNamespace(matched_count=0)
        for key, value in update.get("$inc", {}).items():
            row[key] = int(row.get(key) or 0) + int(value)
        for key, value in update.get("$set", {}).items():
            row[key] = value
        return types.SimpleNamespace(matched_count=1)

    async def delete_one(self, query):
        for index, row in enumerate(self.docs):
            if matches(row, query):
                self.docs.pop(index)
                return types.SimpleNamespace(deleted_count=1)
        return types.SimpleNamespace(deleted_count=0)

    async def find_one_and_update(
        self,
        query,
        update,
        projection=None,
        return_document=None,
    ):
        base_query = {key: value for key, value in query.items() if key != "$expr"}
        row = next((doc for doc in self.docs if matches(doc, base_query)), None)
        if row is None:
            return None

        refund_delta = int(update.get("$inc", {}).get("refunded_eur_cents") or 0)
        if "$expr" in query:
            current = int(row.get("refunded_eur_cents") or 0)
            gross = int(row.get("gross_eur_cents") or 0)
            if current + refund_delta > gross:
                return None

        before = dict(row)
        for key, value in update.get("$inc", {}).items():
            row[key] = int(row.get(key) or 0) + int(value)
        for key, value in update.get("$set", {}).items():
            row[key] = value
        return before


class GamesFinanceSandboxTest(unittest.TestCase):
    def setUp(self):
        self.old_enabled = finance.FINANCE_SANDBOX_ENABLED
        self.old_share = finance.DEVELOPER_SHARE_BPS
        self.old_db = finance.db
        self.old_auth = finance.get_current_user

        finance.FINANCE_SANDBOX_ENABLED = True
        finance.DEVELOPER_SHARE_BPS = 7000
        finance.get_current_user = AsyncMock(
            return_value={"_id": "admin-1", "role": "admin"}
        )

        self.transactions = Collection(unique=True)
        self.catalog = Collection([
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
            {
                "id": "offline-game",
                "owner_id": "developer-a",
                "title": "Offline",
                "status": "unpublished",
            },
        ])
        finance.db = types.SimpleNamespace(
            games_catalog=self.catalog,
            games_finance_sandbox_transactions=self.transactions,
        )

    def tearDown(self):
        finance.FINANCE_SANDBOX_ENABLED = self.old_enabled
        finance.DEVELOPER_SHARE_BPS = self.old_share
        finance.db = self.old_db
        finance.get_current_user = self.old_auth

    def purchase(self, *, game_id="community-a", amount=1000, key="purchase:0001"):
        return finance.SandboxPurchaseInput(
            game_id=game_id,
            gross_eur_cents=amount,
            idempotency_key=key,
            note="Sandbox test only",
        )

    def refund(self, *, amount, key, reason="Sandbox refund"):
        return finance.SandboxRefundInput(
            amount_eur_cents=amount,
            idempotency_key=key,
            reason=reason,
        )

    def test_readiness_never_claims_real_money_execution(self):
        result = asyncio.run(finance.finance_readiness())
        self.assertTrue(result["sandbox_enabled"])
        self.assertTrue(result["configured"])
        self.assertEqual(result["developer_share_bps"], 7000)
        self.assertFalse(result["payments_enabled"])
        self.assertFalse(result["wallet_debits_enabled"])
        self.assertFalse(result["payouts_enabled"])

    def test_mutation_fails_closed_when_sandbox_disabled(self):
        finance.FINANCE_SANDBOX_ENABLED = False
        with self.assertRaises(HTTPException) as context:
            asyncio.run(finance.create_sandbox_purchase(self.purchase(), None))
        self.assertEqual(context.exception.status_code, 503)
        self.assertEqual(self.transactions.docs, [])

    def test_mutation_fails_closed_without_revenue_share_configuration(self):
        finance.DEVELOPER_SHARE_BPS = 0
        with self.assertRaises(HTTPException) as context:
            asyncio.run(finance.create_sandbox_purchase(self.purchase(), None))
        self.assertEqual(context.exception.status_code, 503)
        self.assertEqual(self.transactions.docs, [])

    def test_non_admin_cannot_create_sandbox_purchase(self):
        finance.get_current_user.return_value = {"_id": "user-1", "role": "user"}
        with self.assertRaises(HTTPException) as context:
            asyncio.run(finance.create_sandbox_purchase(self.purchase(), None))
        self.assertEqual(context.exception.status_code, 403)

    def test_purchase_split_is_integer_safe_and_idempotent(self):
        body = self.purchase(amount=1001)
        first = asyncio.run(finance.create_sandbox_purchase(body, None))
        second = asyncio.run(finance.create_sandbox_purchase(body, None))

        self.assertEqual(first["id"], second["id"])
        self.assertEqual(first["gross_eur_cents"], 1001)
        self.assertEqual(first["developer_eur_cents"], 700)
        self.assertEqual(first["platform_eur_cents"], 301)
        self.assertEqual(
            first["developer_eur_cents"] + first["platform_eur_cents"],
            first["gross_eur_cents"],
        )
        self.assertFalse(first["monetary_execution"])
        self.assertEqual(len(self.transactions.docs), 1)

    def test_idempotency_key_cannot_be_reused_for_different_purchase(self):
        asyncio.run(finance.create_sandbox_purchase(self.purchase(amount=1000), None))
        with self.assertRaises(HTTPException) as context:
            asyncio.run(
                finance.create_sandbox_purchase(
                    self.purchase(amount=999, key="purchase:0001"),
                    None,
                )
            )
        self.assertEqual(context.exception.status_code, 409)

    def test_only_published_developer_games_can_be_simulated(self):
        with self.assertRaises(HTTPException) as context:
            asyncio.run(
                finance.create_sandbox_purchase(
                    self.purchase(game_id="offline-game", key="purchase:offline"),
                    None,
                )
            )
        self.assertEqual(context.exception.status_code, 404)

    def test_partial_refunds_cannot_exceed_purchase_and_full_refund_reconciles(self):
        purchase = asyncio.run(
            finance.create_sandbox_purchase(
                self.purchase(amount=101, key="purchase:rounding"),
                None,
            )
        )
        first = asyncio.run(
            finance.create_sandbox_refund(
                purchase["id"],
                self.refund(amount=50, key="refund:rounding:1"),
                None,
            )
        )
        second = asyncio.run(
            finance.create_sandbox_refund(
                purchase["id"],
                self.refund(amount=51, key="refund:rounding:2"),
                None,
            )
        )

        self.assertEqual(first["developer_eur_cents"], 35)
        self.assertEqual(first["platform_eur_cents"], 15)
        self.assertEqual(second["developer_eur_cents"], 35)
        self.assertEqual(second["platform_eur_cents"], 16)

        summary = asyncio.run(finance.admin_finance_sandbox_summary(None))
        self.assertEqual(summary["net_gross_eur_cents"], 0)
        self.assertEqual(summary["net_developer_eur_cents"], 0)
        self.assertEqual(summary["net_platform_eur_cents"], 0)
        self.assertFalse(summary["payout_execution"])

        with self.assertRaises(HTTPException) as context:
            asyncio.run(
                finance.create_sandbox_refund(
                    purchase["id"],
                    self.refund(amount=1, key="refund:rounding:3"),
                    None,
                )
            )
        self.assertEqual(context.exception.status_code, 409)

    def test_refund_is_idempotent(self):
        purchase = asyncio.run(finance.create_sandbox_purchase(self.purchase(), None))
        body = self.refund(amount=250, key="refund:0001")
        first = asyncio.run(finance.create_sandbox_refund(purchase["id"], body, None))
        second = asyncio.run(finance.create_sandbox_refund(purchase["id"], body, None))
        self.assertEqual(first["id"], second["id"])
        self.assertEqual(len(self.transactions.docs), 2)

    def test_developer_summary_is_owner_scoped(self):
        asyncio.run(
            finance.create_sandbox_purchase(
                self.purchase(game_id="community-a", amount=1000, key="purchase:dev-a"),
                None,
            )
        )
        asyncio.run(
            finance.create_sandbox_purchase(
                self.purchase(game_id="community-b", amount=5000, key="purchase:dev-b"),
                None,
            )
        )

        finance.get_current_user.return_value = {"_id": "developer-a", "role": "user"}
        result = asyncio.run(finance.developer_finance_sandbox_summary(None))
        self.assertEqual(result["purchase_count"], 1)
        self.assertEqual(result["gross_purchase_eur_cents"], 1000)
        self.assertEqual(result["net_developer_eur_cents"], 700)
        self.assertFalse(result["monetary_execution"])

    def test_admin_transaction_list_redacts_internal_identity_and_keys(self):
        asyncio.run(finance.create_sandbox_purchase(self.purchase(), None))
        result = asyncio.run(finance.list_sandbox_transactions(None, 100))
        serialized = str(result)
        self.assertNotIn("developer_owner_id", serialized)
        self.assertNotIn("created_by", serialized)
        self.assertNotIn("idempotency_key", serialized)
        self.assertNotIn("admin-1", serialized)
        self.assertTrue(result["sandbox"])
        self.assertFalse(result["monetary_execution"])


if __name__ == "__main__":
    unittest.main()
