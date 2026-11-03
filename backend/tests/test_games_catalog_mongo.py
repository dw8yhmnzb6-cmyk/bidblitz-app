"""Mongo concurrency tests for Games publication operation locks."""
import asyncio
import os
import types
import unittest

from fastapi import HTTPException
from motor.motor_asyncio import AsyncIOMotorClient

from routes import games_catalog as catalog


class GamesCatalogMongoTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        url = os.getenv("GAME_STUDIO_TEST_MONGO_URL")
        if not url:
            self.skipTest("GAME_STUDIO_TEST_MONGO_URL is not configured")
        self.client = AsyncIOMotorClient(url)
        self.database = self.client["bidblitz_games_catalog_lock_test"]
        await self.database.games_publication_locks.delete_many({})
        await self.database.games_publication_locks.create_index(
            "expires_at",
            expireAfterSeconds=0,
        )
        self.old_db = catalog.db
        catalog.db = types.SimpleNamespace(
            games_publication_locks=self.database.games_publication_locks,
        )

    async def asyncTearDown(self):
        if hasattr(self, "old_db"):
            catalog.db = self.old_db
            await self.client.drop_database("bidblitz_games_catalog_lock_test")
            self.client.close()

    async def test_parallel_same_game_operations_allow_one_lock_holder(self):
        attempts = 12
        results = await asyncio.gather(*[
            catalog._acquire_publication_lock("draft-1")
            for _ in range(attempts)
        ], return_exceptions=True)

        tokens = [item for item in results if isinstance(item, str)]
        conflicts = [
            item for item in results
            if isinstance(item, HTTPException) and item.status_code == 409
        ]
        self.assertEqual(len(tokens), 1)
        self.assertEqual(len(conflicts), attempts - 1)

        saved = await self.database.games_publication_locks.find_one({"_id": "draft-1"})
        self.assertIsNotNone(saved)
        self.assertEqual(saved["token"], tokens[0])
        self.assertIn("expires_at", saved)

        released = await catalog._release_publication_lock("draft-1", tokens[0])
        self.assertTrue(released)
        self.assertIsNone(
            await self.database.games_publication_locks.find_one({"_id": "draft-1"})
        )

        replacement = await catalog._acquire_publication_lock("draft-1")
        self.assertIsInstance(replacement, str)
        await catalog._release_publication_lock("draft-1", replacement)


if __name__ == "__main__":
    unittest.main()
