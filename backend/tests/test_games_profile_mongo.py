"""Mongo integration tests for account-backed Games favorites."""
import asyncio
import os
import unittest

from motor.motor_asyncio import AsyncIOMotorClient

from routes import games_profile as profile


class GamesProfileMongoTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        url = os.getenv("GAME_STUDIO_TEST_MONGO_URL")
        if not url:
            self.skipTest("GAME_STUDIO_TEST_MONGO_URL is not configured")
        self.client = AsyncIOMotorClient(url)
        self.database = self.client["bidblitz_games_profile_test"]
        await self.database.games_profiles.delete_many({})
        await self.database.games_profiles.create_index("owner_id", unique=True)
        self.old_db = profile.db
        self.old_owner = profile._owner
        profile.db = self.database

        async def owner(_request):
            return "alice"
        profile._owner = owner

    async def asyncTearDown(self):
        if hasattr(self, "old_db"):
            profile.db = self.old_db
            profile._owner = self.old_owner
            await self.client.drop_database("bidblitz_games_profile_test")
            self.client.close()

    async def test_parallel_unique_favorites_never_exceed_one_hundred(self):
        results = await asyncio.gather(*[
            profile.add_favorite(f"game-{index}", None)
            for index in range(120)
        ], return_exceptions=True)
        row = await self.database.games_profiles.find_one({"owner_id": "alice"})
        self.assertIsNotNone(row)
        self.assertEqual(len(row.get("favorites", [])), 100)
        rejected = [item for item in results if getattr(item, "status_code", None) == 409]
        self.assertGreaterEqual(len(rejected), 20)

    async def test_parallel_duplicate_favorite_is_stored_once(self):
        results = await asyncio.gather(*[
            profile.add_favorite("match", None)
            for _ in range(20)
        ], return_exceptions=True)
        self.assertFalse([item for item in results if isinstance(item, Exception)])
        row = await self.database.games_profiles.find_one({"owner_id": "alice"})
        self.assertEqual(row.get("favorites"), ["match"])

    async def test_accounts_are_isolated(self):
        await profile.add_favorite("match", None)

        async def bob(_request):
            return "bob"
        profile._owner = bob
        await profile.add_favorite("runner", None)

        alice = await self.database.games_profiles.find_one({"owner_id": "alice"})
        bob_row = await self.database.games_profiles.find_one({"owner_id": "bob"})
        self.assertEqual(alice.get("favorites"), ["match"])
        self.assertEqual(bob_row.get("favorites"), ["runner"])


if __name__ == "__main__":
    unittest.main()
