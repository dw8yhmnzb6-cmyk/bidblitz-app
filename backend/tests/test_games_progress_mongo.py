"""Mongo integration tests for account-backed Match progress."""
import asyncio
import os
import unittest

from motor.motor_asyncio import AsyncIOMotorClient

from routes import games_progress as progress


def payload(completed: int, score_base: int):
    best = [0] * 30
    stars = [0] * 30
    for index in range(completed):
        best[index] = score_base + index
        stars[index] = 2 if index % 2 == 0 else 3
    unlocked = 1 if completed == 0 else min(30, completed + 1)
    return progress.MatchProgressInput(version=1, unlocked=unlocked, best=best, stars=stars)


class GamesProgressMongoTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        url = os.getenv("GAME_STUDIO_TEST_MONGO_URL")
        if not url:
            self.skipTest("GAME_STUDIO_TEST_MONGO_URL is not configured")
        self.client = AsyncIOMotorClient(url)
        self.database = self.client["bidblitz_games_progress_test"]
        await self.database.games_match_progress.delete_many({})
        await self.database.games_match_progress.create_index("owner_id", unique=True)
        self.old_db = progress.db
        self.old_owner = progress._owner
        progress.db = self.database

        async def owner(_request):
            return "alice"
        progress._owner = owner

    async def asyncTearDown(self):
        if hasattr(self, "old_db"):
            progress.db = self.old_db
            progress._owner = self.old_owner
            await self.client.drop_database("bidblitz_games_progress_test")
            self.client.close()

    async def test_parallel_devices_merge_progress_monotonically(self):
        one = payload(4, 1200)
        two = payload(7, 900)
        results = await asyncio.gather(*[
            progress.save_match_progress(None, one),
            progress.save_match_progress(None, two),
            progress.save_match_progress(None, one),
            progress.save_match_progress(None, two),
        ])
        self.assertTrue(results)
        saved = await progress.get_match_progress(None)
        self.assertEqual(saved["unlocked"], 8)
        self.assertEqual(saved["best"][0], 1200)
        self.assertEqual(saved["best"][4], 904)
        self.assertEqual(saved["stars"][1], 3)

    async def test_lower_device_snapshot_never_reduces_server_progress(self):
        await progress.save_match_progress(None, payload(6, 2000))
        before = await progress.get_match_progress(None)
        await progress.save_match_progress(None, payload(2, 500))
        after = await progress.get_match_progress(None)
        self.assertEqual(after["unlocked"], before["unlocked"])
        self.assertEqual(after["best"], before["best"])
        self.assertEqual(after["stars"], before["stars"])

    async def test_accounts_are_isolated(self):
        await progress.save_match_progress(None, payload(3, 1000))

        async def bob(_request):
            return "bob"
        progress._owner = bob
        self.assertEqual((await progress.get_match_progress(None))["unlocked"], 1)
        await progress.save_match_progress(None, payload(1, 3000))

        async def alice(_request):
            return "alice"
        progress._owner = alice
        self.assertEqual((await progress.get_match_progress(None))["unlocked"], 4)


if __name__ == "__main__":
    unittest.main()
