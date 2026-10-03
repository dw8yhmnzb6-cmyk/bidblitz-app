"""Mongo integration tests for quota and idempotent game-draft creation."""
import asyncio
import os
import unittest

from motor.motor_asyncio import AsyncIOMotorClient

from routes import game_studio as studio


class GameStudioMongoTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        url = os.getenv("GAME_STUDIO_TEST_MONGO_URL")
        if not url:
            self.skipTest("GAME_STUDIO_TEST_MONGO_URL is not configured")
        self.client = AsyncIOMotorClient(url)
        self.database = self.client["bidblitz_game_studio_test"]
        await self.database.game_studio_drafts.delete_many({})
        await self.database.game_studio_draft_slots.delete_many({})
        await self.database.game_studio_draft_requests.delete_many({})
        self.old_db = studio.db
        self.old_owner = studio._owner
        studio.db = self.database

        async def owner(_request):
            return "alice"
        studio._owner = owner
        self.draft = studio.GameDraftInput(
            title="Island Quest",
            description="A puzzle adventure on floating islands with thirty levels.",
            category="Puzzle",
            languages=["de", "en"],
            rights_confirmed=True,
        )

    async def asyncTearDown(self):
        if hasattr(self, "old_db"):
            studio.db = self.old_db
            studio._owner = self.old_owner
            await self.client.drop_database("bidblitz_game_studio_test")
            self.client.close()

    async def test_same_request_key_returns_one_draft(self):
        results = await asyncio.gather(*[
            studio.create_draft(None, self.draft, "mongo-idempotency-key-0001")
            for _ in range(8)
        ], return_exceptions=True)
        successes = [item for item in results if isinstance(item, dict)]
        pending = [item for item in results if getattr(item, "status_code", None) == 425]
        self.assertTrue(successes)
        self.assertEqual(len(successes) + len(pending), len(results))
        ids = {item["id"] for item in successes}
        self.assertEqual(len(ids), 1)
        self.assertEqual(await self.database.game_studio_drafts.count_documents({}), 1)

    async def test_parallel_creates_never_exceed_one_hundred(self):
        results = await asyncio.gather(*[
            studio.create_draft(None, self.draft, f"parallel-create-key-{index:04d}")
            for index in range(120)
        ], return_exceptions=True)
        saved = await self.database.game_studio_drafts.count_documents({"owner_id": "alice"})
        slots = await self.database.game_studio_draft_slots.count_documents({"owner_id": "alice"})
        self.assertEqual(saved, 100)
        self.assertEqual(slots, 100)
        rejected = [item for item in results if getattr(item, "status_code", None) == 409]
        self.assertGreaterEqual(len(rejected), 20)

    async def test_deleted_request_key_does_not_recreate_draft(self):
        created = await studio.create_draft(None, self.draft, "mongo-delete-key-0001")
        await studio.delete_draft(created["id"], None, revision=1)
        with self.assertRaises(studio.HTTPException) as context:
            await studio.create_draft(None, self.draft, "mongo-delete-key-0001")
        self.assertEqual(context.exception.status_code, 410)
        self.assertEqual(await self.database.game_studio_drafts.count_documents({}), 0)


if __name__ == "__main__":
    unittest.main()
