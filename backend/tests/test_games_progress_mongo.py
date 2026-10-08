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


def bubble_payload(completed: int, score_base: int):
    best = [0] * 20
    stars = [0] * 20
    for index in range(completed):
        best[index] = score_base + index
        stars[index] = 2 if index % 2 == 0 else 3
    unlocked = 1 if completed == 0 else min(20, completed + 1)
    return progress.BubbleProgressInput(version=1, unlocked=unlocked, best=best, stars=stars)


def runner_payload(completed: int, score_base: int):
    best = [0] * 15
    stars = [0] * 15
    for index in range(completed):
        best[index] = score_base + index
        stars[index] = 2 if index % 2 == 0 else 3
    unlocked = 1 if completed == 0 else min(15, completed + 1)
    return progress.RunnerProgressInput(version=1, unlocked=unlocked, best=best, stars=stars)


class GamesProgressMongoTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        url = os.getenv("GAME_STUDIO_TEST_MONGO_URL")
        if not url:
            self.skipTest("GAME_STUDIO_TEST_MONGO_URL is not configured")
        self.client = AsyncIOMotorClient(url)
        self.database = self.client["bidblitz_games_progress_test"]
        await self.database.games_match_progress.delete_many({})
        await self.database.games_bubble_progress.delete_many({})
        await self.database.games_runner_progress.delete_many({})
        await self.database.games_match_progress.create_index("owner_id", unique=True)
        await self.database.games_bubble_progress.create_index("owner_id", unique=True)
        await self.database.games_runner_progress.create_index("owner_id", unique=True)
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


    async def test_parallel_bubble_devices_merge_monotonically(self):
        one = bubble_payload(4, 900)
        two = bubble_payload(7, 600)
        await asyncio.gather(*[
            progress.save_bubble_progress(None, one),
            progress.save_bubble_progress(None, two),
            progress.save_bubble_progress(None, one),
            progress.save_bubble_progress(None, two),
        ])
        saved = await progress.get_bubble_progress(None)
        self.assertEqual(saved["unlocked"], 8)
        self.assertEqual(saved["best"][0], 900)
        self.assertEqual(saved["best"][4], 604)
        self.assertEqual(saved["stars"][1], 3)


    async def test_bubble_and_runner_progress_remain_account_isolated(self):
        for save, read, data in (
            (progress.save_bubble_progress, progress.get_bubble_progress, bubble_payload),
            (progress.save_runner_progress, progress.get_runner_progress, runner_payload),
        ):
            await save(None, data(3, 800))

            async def bob(_request):
                return "bob"
            progress._owner = bob
            self.assertEqual((await read(None))["unlocked"], 1)
            await save(None, data(1, 2000))

            async def alice(_request):
                return "alice"
            progress._owner = alice
            saved = await read(None)
            self.assertEqual(saved["unlocked"], 4)
            self.assertEqual(saved["best"][0], 800)

    async def test_completed_levels_resume_after_reloading_all_three_games(self):
        for save, read, make in (
            (progress.save_match_progress, progress.get_match_progress, payload),
            (progress.save_bubble_progress, progress.get_bubble_progress, bubble_payload),
            (progress.save_runner_progress, progress.get_runner_progress, runner_payload),
        ):
            completed = make(3, 1100)
            await save(None, completed)
            # Simulate a new session reading its account state without device memory.
            resumed = await read(None)
            self.assertEqual(resumed["unlocked"], 4)
            self.assertEqual(resumed["best"][:3], completed.best[:3])
            self.assertEqual(resumed["stars"][:3], completed.stars[:3])
            # A stale second device must not reset the resumed levels.
            await save(None, make(1, 100))
            after_stale_upload = await read(None)
            self.assertEqual(after_stale_upload["unlocked"], 4)
            self.assertEqual(after_stale_upload["best"][:3], completed.best[:3])
            self.assertEqual(after_stale_upload["stars"][:3], completed.stars[:3])

    async def test_concurrent_scores_and_stars_keep_independent_maxima(self):
        for save, read, make in (
            (progress.save_match_progress, progress.get_match_progress, payload),
            (progress.save_bubble_progress, progress.get_bubble_progress, bubble_payload),
            (progress.save_runner_progress, progress.get_runner_progress, runner_payload),
        ):
            high_score = make(2, 2400)
            high_score.stars[0] = 1
            high_stars = make(2, 900)
            high_stars.stars[0] = 3
            await asyncio.gather(save(None, high_score), save(None, high_stars))
            merged = await read(None)
            self.assertEqual(merged["unlocked"], 3)
            self.assertEqual(merged["best"][0], 2400)
            self.assertEqual(merged["stars"][0], 3)

    async def test_stale_device_after_reconnect_cannot_erase_new_levels(self):
        for save, read, make in (
            (progress.save_match_progress, progress.get_match_progress, payload),
            (progress.save_bubble_progress, progress.get_bubble_progress, bubble_payload),
            (progress.save_runner_progress, progress.get_runner_progress, runner_payload),
        ):
            offline_snapshot = make(1, 450)
            await save(None, make(5, 1200))
            await save(None, offline_snapshot)
            resumed = await read(None)
            self.assertEqual(resumed["unlocked"], 6)
            self.assertGreaterEqual(resumed["best"][0], 1200)
            self.assertGreater(resumed["best"][4], 0)
            self.assertGreater(resumed["stars"][4], 0)

    async def test_parallel_runner_devices_merge_monotonically(self):
        one = runner_payload(4, 800)
        two = runner_payload(7, 500)
        await asyncio.gather(*[
            progress.save_runner_progress(None, one),
            progress.save_runner_progress(None, two),
            progress.save_runner_progress(None, one),
            progress.save_runner_progress(None, two),
        ])
        saved = await progress.get_runner_progress(None)
        self.assertEqual(saved["unlocked"], 8)
        self.assertEqual(saved["best"][0], 800)
        self.assertEqual(saved["best"][4], 504)
        self.assertEqual(saved["stars"][1], 3)


if __name__ == "__main__":
    unittest.main()
