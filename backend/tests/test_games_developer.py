"""Tests for Games developer publication entitlements."""
import asyncio
import types
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock

from fastapi import HTTPException

from routes import games_developer as developer


def matches(doc, query):
    return all(doc.get(key) == value for key, value in query.items())


class Collection:
    def __init__(self, docs=None):
        self.docs = [dict(row) for row in (docs or [])]

    async def find_one(self, query, projection=None):
        row = next((doc for doc in self.docs if matches(doc, query)), None)
        return dict(row) if row else None

    async def count_documents(self, query):
        return sum(1 for doc in self.docs if matches(doc, query))

    async def update_one(self, query, update, upsert=False):
        row = next((doc for doc in self.docs if matches(doc, query)), None)
        if row is None and upsert:
            row = dict(query)
            self.docs.append(row)
        if row is None:
            return types.SimpleNamespace(matched_count=0)
        for key, value in update.get("$set", {}).items():
            row[key] = value
        for key, value in update.get("$setOnInsert", {}).items():
            row.setdefault(key, value)
        return types.SimpleNamespace(matched_count=1)

    async def insert_one(self, doc):
        self.docs.append(dict(doc))
        return types.SimpleNamespace(inserted_id=len(self.docs))


class DuplicateKeyError(Exception):
    code = 11000


class SlotCollection(Collection):
    async def insert_one(self, doc):
        if any(
            row.get("_id") == doc.get("_id")
            or (row.get("owner_id") == doc.get("owner_id") and row.get("draft_id") == doc.get("draft_id"))
            for row in self.docs
        ):
            raise DuplicateKeyError()
        self.docs.append(dict(doc))
        return types.SimpleNamespace(inserted_id=doc.get("_id"))

    async def delete_one(self, query):
        for index, row in enumerate(self.docs):
            if matches(row, query):
                self.docs.pop(index)
                return types.SimpleNamespace(deleted_count=1)
        return types.SimpleNamespace(deleted_count=0)


class GamesDeveloperEntitlementTest(unittest.TestCase):
    def setUp(self):
        self.old_billing = developer.BILLING_READY
        developer.BILLING_READY = False
        developer.get_current_user = AsyncMock(return_value={"_id": "alice", "role": "user"})
        self.entitlements = Collection()
        self.catalog = Collection()
        developer.db = types.SimpleNamespace(
            games_developer_entitlements=self.entitlements,
            games_developer_entitlement_events=Collection(),
            games_catalog=self.catalog,
            game_studio_drafts=Collection([{"id": "draft-1", "owner_id": "alice", "status": "draft"}]),
            games_publication_slots=SlotCollection(),
        )

    def tearDown(self):
        developer.BILLING_READY = self.old_billing

    def test_checkout_fails_closed_until_billing_is_explicitly_ready(self):
        with self.assertRaises(HTTPException) as context:
            asyncio.run(developer.developer_checkout(None))
        self.assertEqual(context.exception.status_code, 503)

    def test_publication_requires_active_entitlement(self):
        with self.assertRaises(HTTPException) as context:
            asyncio.run(developer.assert_publication_entitlement("alice", "draft-1"))
        self.assertEqual(context.exception.status_code, 402)

        self.entitlements.docs.append({
            "owner_id": "alice", "plan": "starter", "status": "active",
            "payment_reference": "paid-123456",
        })
        result = asyncio.run(developer.assert_publication_entitlement("alice", "draft-1"))
        self.assertEqual(result["plan"], "starter")

    def test_expired_or_revoked_entitlement_is_not_active(self):
        expired = {
            "owner_id": "alice", "plan": "starter", "status": "active",
            "valid_until": datetime.now(timezone.utc) - timedelta(minutes=1),
        }
        self.assertFalse(developer._active_entitlement(expired))
        expired["status"] = "revoked"
        expired["valid_until"] = None
        self.assertFalse(developer._active_entitlement(expired))

    def test_starter_limit_blocks_second_publication_slot(self):
        entitlement = {
            "owner_id": "alice", "plan": "starter", "status": "active",
            "payment_reference": "paid-123456",
        }
        self.entitlements.docs.append(entitlement)
        first = asyncio.run(developer.reserve_publication_slot("alice", "draft-1", entitlement))
        self.assertTrue(first)
        if developer.PLANS["starter"]["max_published_games"] == 1:
            with self.assertRaises(HTTPException) as context:
                asyncio.run(developer.reserve_publication_slot("alice", "draft-2", entitlement))
            self.assertEqual(context.exception.status_code, 409)

    def test_same_game_reuses_existing_publication_slot(self):
        entitlement = {
            "owner_id": "alice", "plan": "starter", "status": "active",
            "payment_reference": "paid-123456",
        }
        self.entitlements.docs.append(entitlement)
        first = asyncio.run(developer.reserve_publication_slot("alice", "draft-1", entitlement))
        second = asyncio.run(developer.reserve_publication_slot("alice", "draft-1", entitlement))
        self.assertTrue(first)
        self.assertFalse(second)
        self.assertEqual(len(developer.db.games_publication_slots.docs), 1)

    def test_unpublish_releases_publication_slot(self):
        entitlement = {
            "owner_id": "alice", "plan": "starter", "status": "active",
            "payment_reference": "paid-123456",
        }
        asyncio.run(developer.reserve_publication_slot("alice", "draft-1", entitlement))
        asyncio.run(developer.release_publication_slot("alice", "draft-1"))
        self.assertEqual(developer.db.games_publication_slots.docs, [])

    def test_admin_grant_requires_real_reference_and_is_audited(self):
        developer.get_current_user.return_value = {"_id": "admin-1", "role": "admin"}
        grant = developer.EntitlementGrant(
            plan="studio",
            payment_reference="invoice-000123",
            note="Verified external contract",
        )
        result = asyncio.run(developer.grant_entitlement("alice", grant, None))
        self.assertEqual(result["entitlement"]["plan"], "studio")
        saved = self.entitlements.docs[0]
        self.assertEqual(saved["payment_reference"], "invoice-000123")
        event = developer.db.games_developer_entitlement_events.docs[0]
        self.assertEqual(event["action"], "grant")
        self.assertEqual(event["admin_id"], "admin-1")

    def test_non_admin_cannot_grant_entitlement(self):
        grant = developer.EntitlementGrant(
            plan="starter",
            payment_reference="invoice-000123",
        )
        with self.assertRaises(HTTPException) as context:
            asyncio.run(developer.grant_entitlement("alice", grant, None))
        self.assertEqual(context.exception.status_code, 403)


    def test_admin_can_grant_and_read_plan_by_draft_without_owner_id_response(self):
        developer.get_current_user.return_value = {"_id": "admin-1", "role": "admin"}
        grant = developer.EntitlementGrant(
            plan="starter",
            payment_reference="invoice-000321",
        )
        result = asyncio.run(developer.grant_entitlement_by_draft("draft-1", grant, None))
        self.assertEqual(result["entitlement"]["plan"], "starter")
        status = asyncio.run(developer.entitlement_by_draft("draft-1", None))
        self.assertTrue(status["active"])
        self.assertNotIn("owner_id", status)
        self.assertNotIn("payment_reference", status.get("entitlement") or {})

    def test_unknown_draft_cannot_be_used_to_grant_plan(self):
        developer.get_current_user.return_value = {"_id": "admin-1", "role": "admin"}
        grant = developer.EntitlementGrant(
            plan="starter",
            payment_reference="invoice-000321",
        )
        with self.assertRaises(HTTPException) as context:
            asyncio.run(developer.grant_entitlement_by_draft("missing", grant, None))
        self.assertEqual(context.exception.status_code, 404)


if __name__ == "__main__":
    unittest.main()
