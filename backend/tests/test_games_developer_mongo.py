"""Mongo concurrency tests for developer publication slots."""
import asyncio
import os
import unittest

from motor.motor_asyncio import AsyncIOMotorClient

from routes import games_developer as developer


class GamesDeveloperMongoTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        url = os.getenv("GAME_STUDIO_TEST_MONGO_URL")
        if not url:
            self.skipTest("GAME_STUDIO_TEST_MONGO_URL is not configured")
        self.client = AsyncIOMotorClient(url)
        self.database = self.client["bidblitz_games_developer_test"]
        await self.database.games_publication_slots.delete_many({})
        await self.database.games_publication_slots.create_index(
            [("owner_id", 1), ("draft_id", 1)], unique=True
        )
        await self.database.games_publication_slots.create_index(
            [("owner_id", 1), ("slot", 1)], unique=True
        )
        self.old_db = developer.db
        developer.db = self.database

    async def asyncTearDown(self):
        if hasattr(self, "old_db"):
            developer.db = self.old_db
            await self.client.drop_database("bidblitz_games_developer_test")
            self.client.close()

    async def test_starter_parallel_publications_never_exceed_limit(self):
        entitlement = {"plan": "starter", "status": "active"}
        attempts = max(8, developer.PLANS["starter"]["max_published_games"] + 6)
        results = await asyncio.gather(*[
            developer.reserve_publication_slot("alice", f"draft-{index}", entitlement)
            for index in range(attempts)
        ], return_exceptions=True)
        saved = await self.database.games_publication_slots.count_documents({"owner_id": "alice"})
        self.assertEqual(saved, developer.PLANS["starter"]["max_published_games"])
        rejected = [item for item in results if getattr(item, "status_code", None) == 409]
        self.assertGreaterEqual(len(rejected), attempts - saved)

    async def test_same_game_parallel_retries_reserve_one_slot(self):
        entitlement = {"plan": "starter", "status": "active"}
        results = await asyncio.gather(*[
            developer.reserve_publication_slot("alice", "draft-1", entitlement)
            for _ in range(12)
        ], return_exceptions=True)
        errors = [item for item in results if isinstance(item, Exception)]
        self.assertEqual(errors, [])
        saved = await self.database.games_publication_slots.count_documents({
            "owner_id": "alice", "draft_id": "draft-1"
        })
        self.assertEqual(saved, 1)
        self.assertEqual(sum(item is True for item in results), 1)

    async def test_released_slot_can_be_reused(self):
        entitlement = {"plan": "starter", "status": "active"}
        await developer.reserve_publication_slot("alice", "draft-1", entitlement)
        await developer.release_publication_slot("alice", "draft-1")
        reserved = await developer.reserve_publication_slot("alice", "draft-2", entitlement)
        self.assertTrue(reserved)
        rows = await self.database.games_publication_slots.find({"owner_id": "alice"}).to_list(10)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["draft_id"], "draft-2")


if __name__ == "__main__":
    unittest.main()
