"""Tests for Games developer publication entitlements."""
import asyncio
import types
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock

from fastapi import HTTPException

from routes import games_developer as developer, games_analytics as analytics


def matches(doc, query):
    for key, value in query.items():
        current = doc.get(key)
        if isinstance(value, dict) and "$in" in value:
            if current not in value["$in"]:
                return False
            continue
        if current != value:
            return False
    return True


class Cursor:
    def __init__(self, rows):
        self.rows = [dict(row) for row in rows]

    def limit(self, value):
        self.rows = self.rows[:value]
        return self

    async def to_list(self, value):
        return self.rows[:value]


class Collection:
    def __init__(self, docs=None):
        self.docs = [dict(row) for row in (docs or [])]

    async def find_one(self, query, projection=None):
        row = next((doc for doc in self.docs if matches(doc, query)), None)
        return dict(row) if row else None

    async def count_documents(self, query):
        return sum(1 for doc in self.docs if matches(doc, query))

    def find(self, query, projection=None):
        return Cursor([doc for doc in self.docs if matches(doc, query)])

    async def update_one(self, query, update, upsert=False):
        row = next((doc for doc in self.docs if matches(doc, query)), None)
        if row is None and upsert:
            row = dict(query)
            self.docs.append(row)
        if row is None:
            return types.SimpleNamespace(matched_count=0)
        for key, value in update.get("$inc", {}).items():
            row[key] = int(row.get(key) or 0) + int(value)
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
            game_studio_drafts=Collection([
                {"id": "draft-1", "owner_id": "alice", "status": "draft"},
                {"id": "draft-bob", "owner_id": "bob", "status": "draft"},
            ]),
            game_studio_versions=Collection(),
            games_reviews=Collection(),
            games_launch_totals=Collection(),
            games_publication_slots=SlotCollection(),
        )

    def tearDown(self):
        developer.BILLING_READY = self.old_billing

    def test_super_admin_can_manage_developer_entitlements(self):
        developer.get_current_user.return_value = {"_id": "root1", "role": "super_admin"}
        user = asyncio.run(developer._admin(None))
        self.assertEqual(user["role"], "super_admin")

    def test_developer_analytics_are_owner_scoped_and_non_monetary(self):
        developer.db.game_studio_versions.docs.extend([
            {"id": "v1", "owner_id": "alice", "review_status": "submitted"},
            {"id": "v2", "owner_id": "alice", "review_status": "preview_approved"},
            {"id": "v3", "owner_id": "bob", "review_status": "preview_approved"},
        ])
        self.catalog.docs.extend([
            {"id": "draft-1", "owner_id": "alice", "status": "published"},
            {"id": "old-game", "owner_id": "alice", "status": "unpublished"},
            {"id": "draft-bob", "owner_id": "bob", "status": "published"},
        ])
        developer.db.games_reviews.docs.extend([
            {"game_id": "draft-1", "status": "visible"},
            {"game_id": "draft-1", "status": "hidden"},
            {"game_id": "draft-bob", "status": "visible"},
        ])
        developer.db.games_launch_totals.docs.extend([
            {"game_id": "draft-1", "launches": 17},
            {"game_id": "old-game", "launches": 3},
            {"game_id": "draft-bob", "launches": 999},
        ])

        result = asyncio.run(developer.developer_analytics(None))
        self.assertEqual(result["drafts"], 1)
        self.assertEqual(result["versions"], 2)
        self.assertEqual(result["submitted"], 1)
        self.assertEqual(result["preview_approved"], 1)
        self.assertEqual(result["published"], 1)
        self.assertEqual(result["unpublished"], 1)
        self.assertEqual(result["reviews_visible"], 1)
        self.assertEqual(result["reviews_hidden"], 1)
        self.assertEqual(result["approximate_launches"], 20)
        self.assertEqual(result["launch_measurement"], "approximate_non_monetary")
        self.assertFalse(result["billing_ready"])
        self.assertNotIn("owner_id", result)
        self.assertNotIn("revenue", result)
        self.assertNotIn("payout", result)
        self.assertNotIn("owner_id", str(result))
        self.assertNotIn("999", str(result))

    def test_per_game_analytics_are_owner_scoped_and_non_monetary(self):
        self.catalog.docs.extend([
            {"id": "game-a", "owner_id": "alice", "title": "Game A", "status": "published", "version_number": 2},
            {"id": "game-old", "owner_id": "alice", "title": "Old Game", "status": "unpublished", "version_number": 1},
            {"id": "game-bob", "owner_id": "bob", "title": "Bob Game", "status": "published", "version_number": 9},
        ])
        developer.db.games_reviews.docs.extend([
            {"game_id": "game-a", "status": "visible", "rating": 5},
            {"game_id": "game-a", "status": "visible", "rating": 4},
            {"game_id": "game-a", "status": "hidden", "rating": 1},
            {"game_id": "game-bob", "status": "visible", "rating": 5},
        ])
        developer.db.games_launch_totals.docs.extend([
            {"game_id": "game-a", "launches": 17},
            {"game_id": "game-old", "launches": 3},
            {"game_id": "game-bob", "launches": 999},
        ])

        result = asyncio.run(developer.developer_game_analytics(None))
        self.assertFalse(result["monetary"])
        self.assertEqual(result["count"], 2)
        by_id = {row["id"]: row for row in result["games"]}
        self.assertEqual(set(by_id), {"game-a", "game-old"})
        self.assertEqual(by_id["game-a"]["rating_average"], 4.5)
        self.assertEqual(by_id["game-a"]["reviews_visible"], 2)
        self.assertEqual(by_id["game-a"]["reviews_hidden"], 1)
        self.assertEqual(by_id["game-a"]["approximate_launches"], 17)
        self.assertEqual(by_id["game-a"]["launch_measurement"], "approximate_non_monetary")
        self.assertEqual(by_id["game-old"]["approximate_launches"], 3)
        serialized = str(result)
        self.assertNotIn("game-bob", serialized)
        self.assertNotIn("owner_id", serialized)
        self.assertNotIn("revenue", serialized)
        self.assertNotIn("payout", serialized)
        self.assertNotIn("999", serialized)

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


class GamesAnalyticsCounterTest(unittest.TestCase):
    def setUp(self):
        self.catalog = Collection()
        self.launches = Collection()
        analytics.db = types.SimpleNamespace(
            games_catalog=self.catalog,
            games_launch_totals=self.launches,
        )

    def test_anonymous_first_party_launch_counters_are_non_monetary(self):
        first = asyncio.run(analytics.record_game_launch("match"))
        asyncio.run(analytics.record_game_launch("match"))
        bubble = asyncio.run(analytics.record_game_launch("bubble"))
        self.assertTrue(first["recorded"])
        self.assertTrue(bubble["recorded"])
        self.assertFalse(first["monetary"])
        self.assertFalse(bubble["monetary"])
        self.assertEqual(first["measurement"], "approximate_launches")
        by_game = {row["game_id"]: row for row in self.launches.docs}
        self.assertEqual(by_game["match"]["launches"], 2)
        self.assertEqual(by_game["bubble"]["launches"], 1)
        serialized = str(self.launches.docs)
        self.assertNotIn("owner_id", serialized)
        self.assertNotIn("user_id", serialized)
        self.assertNotIn("wallet", serialized)

    def test_launch_counter_requires_published_community_game(self):
        with self.assertRaises(HTTPException) as missing:
            asyncio.run(analytics.record_game_launch("community-game"))
        self.assertEqual(missing.exception.status_code, 404)

        self.catalog.docs.append({"id": "community-game", "status": "published"})
        result = asyncio.run(analytics.record_game_launch("community-game"))
        self.assertTrue(result["recorded"])

        self.catalog.docs[0]["status"] = "unpublished"
        with self.assertRaises(HTTPException) as offline:
            asyncio.run(analytics.record_game_launch("community-game"))
        self.assertEqual(offline.exception.status_code, 404)

    def test_launch_counter_rejects_invalid_game_id(self):
        with self.assertRaises(HTTPException) as invalid:
            asyncio.run(analytics.record_game_launch("../bad"))
        self.assertEqual(invalid.exception.status_code, 400)


if __name__ == "__main__":
    unittest.main()
