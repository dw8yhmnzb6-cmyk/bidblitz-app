"""Mongo concurrency tests for BidBlitz Farm account progress."""
import asyncio
import os
import unittest

from motor.motor_asyncio import AsyncIOMotorClient

from routes import games_farm_progress as farm


def state(day=1, seed=123456, xp=0, coins=60, harvests=0):
    season = farm._season_for_day(day)
    return farm.FarmStateInput(
        version=1,
        seed=seed,
        day=day,
        season=season,
        weather=farm._weather_for(seed, day, season),
        coins=coins,
        xp=xp,
        level=farm._level_from_xp(xp),
        harvests=harvests,
        plots=[
            farm.FarmPlotInput(
                id=index,
                crop=None,
                plantedDay=None,
                growth=0,
                watered=False,
                health=100,
                ready=False,
            )
            for index in range(1, 7)
        ],
        lastEvent="Farm bereit.",
    )


class GamesFarmProgressMongoTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        url = os.getenv("GAME_STUDIO_TEST_MONGO_URL")
        if not url:
            self.skipTest("GAME_STUDIO_TEST_MONGO_URL is not configured")
        self.client = AsyncIOMotorClient(url)
        self.database = self.client["bidblitz_games_farm_progress_test"]
        await self.database.games_farm_progress.delete_many({})
        await self.database.games_farm_progress.create_index("owner_id", unique=True)
        self.old_db = farm.db
        self.old_owner = farm._owner
        farm.db = self.database

        async def owner(_request):
            return "alice"
        farm._owner = owner

    async def asyncTearDown(self):
        if hasattr(self, "old_db"):
            farm.db = self.old_db
            farm._owner = self.old_owner
            await self.client.drop_database("bidblitz_games_farm_progress_test")
            self.client.close()

    async def test_parallel_same_revision_allows_exactly_one_update(self):
        first = await farm.save_farm_progress(
            farm.FarmSaveInput(revision=0, state=state()),
            None,
        )
        self.assertEqual(first["revision"], 1)

        attempts = await asyncio.gather(
            farm.save_farm_progress(
                farm.FarmSaveInput(revision=1, state=state(day=2, xp=40, coins=70, harvests=1)),
                None,
            ),
            farm.save_farm_progress(
                farm.FarmSaveInput(revision=1, state=state(day=3, xp=80, coins=85, harvests=2)),
                None,
            ),
            return_exceptions=True,
        )
        successes = [item for item in attempts if isinstance(item, dict)]
        conflicts = [item for item in attempts if getattr(item, "status_code", None) == 409]
        self.assertEqual(len(successes), 1)
        self.assertEqual(len(conflicts), 1)

        saved = await farm.get_farm_progress(None)
        self.assertEqual(saved["revision"], 2)
        self.assertIn(saved["state"]["day"], {2, 3})

    async def test_first_save_race_creates_one_snapshot(self):
        attempts = await asyncio.gather(*[
            farm.save_farm_progress(
                farm.FarmSaveInput(revision=0, state=state(day=index + 1, xp=index * 40)),
                None,
            )
            for index in range(4)
        ], return_exceptions=True)
        successes = [item for item in attempts if isinstance(item, dict)]
        conflicts = [item for item in attempts if getattr(item, "status_code", None) == 409]
        self.assertEqual(len(successes), 1)
        self.assertEqual(len(conflicts), 3)
        self.assertEqual(await self.database.games_farm_progress.count_documents({"owner_id": "alice"}), 1)


if __name__ == "__main__":
    unittest.main()
