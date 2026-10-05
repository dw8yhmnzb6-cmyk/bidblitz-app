"""Tests for account-backed non-monetary Games recent history."""
import asyncio
import types
import unittest
from unittest.mock import AsyncMock

from fastapi import HTTPException

from routes import games_recent as recent


def matches(doc, query):
    return all(doc.get(key) == value for key, value in query.items())


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


class Collection:
    def __init__(self, docs=None):
        self.docs = [dict(row) for row in (docs or [])]

    async def find_one(self, query, projection=None):
        row = next((row for row in self.docs if matches(row, query)), None)
        return dict(row) if row else None

    def find(self, query, projection=None):
        return Cursor([row for row in self.docs if matches(row, query)])

    async def update_one(self, query, update, upsert=False):
        row = next((row for row in self.docs if matches(row, query)), None)
        if row is None and upsert:
            row = dict(query)
            for key, value in update.get("$setOnInsert", {}).items():
                row[key] = value
            self.docs.append(row)
        if row is None:
            return types.SimpleNamespace(matched_count=0)
        for key, value in update.get("$set", {}).items():
            row[key] = value
        for key, value in update.get("$inc", {}).items():
            row[key] = int(row.get(key) or 0) + value
        return types.SimpleNamespace(matched_count=1)

    async def delete_many(self, query):
        before = len(self.docs)
        self.docs = [row for row in self.docs if not matches(row, query)]
        return types.SimpleNamespace(deleted_count=before - len(self.docs))


class GamesRecentTest(unittest.TestCase):
    def setUp(self):
        self.recent = Collection()
        self.catalog = Collection([
            {"id": "community-one", "status": "published"},
            {"id": "offline-one", "status": "unpublished"},
        ])
        recent.db = types.SimpleNamespace(
            games_recent_plays=self.recent,
            games_catalog=self.catalog,
        )
        recent.get_current_user = AsyncMock(return_value={"_id": "alice", "role": "user"})

    def test_first_party_and_published_game_can_be_recorded_without_owner_leak(self):
        match = asyncio.run(recent.record_recent_game("match", None))
        bubble = asyncio.run(recent.record_recent_game("bubble", None))
        community = asyncio.run(recent.record_recent_game("community-one", None))
        self.assertEqual(match["game_id"], "match")
        self.assertEqual(bubble["game_id"], "bubble")
        self.assertEqual(community["game_id"], "community-one")

        result = asyncio.run(recent.list_recent_games(None))
        self.assertEqual({row["game_id"] for row in result["games"]}, {"match", "bubble", "community-one"})
        self.assertTrue(all("owner_id" not in row for row in result["games"]))
        self.assertTrue(all("launch_count" not in row for row in result["games"]))

    def test_unpublished_or_invalid_game_is_rejected(self):
        with self.assertRaises(HTTPException) as unpublished:
            asyncio.run(recent.record_recent_game("offline-one", None))
        self.assertEqual(unpublished.exception.status_code, 404)

        with self.assertRaises(HTTPException) as invalid:
            asyncio.run(recent.record_recent_game("../bad", None))
        self.assertEqual(invalid.exception.status_code, 400)

    def test_repeated_launch_updates_one_row_and_increments_internal_count(self):
        asyncio.run(recent.record_recent_game("match", None))
        asyncio.run(recent.record_recent_game("match", None))
        self.assertEqual(len(self.recent.docs), 1)
        self.assertEqual(self.recent.docs[0]["launch_count"], 2)

    def test_history_is_account_scoped(self):
        asyncio.run(recent.record_recent_game("match", None))
        recent.get_current_user.return_value = {"_id": "bob", "role": "user"}
        self.assertEqual(asyncio.run(recent.list_recent_games(None))["games"], [])
        asyncio.run(recent.record_recent_game("community-one", None))

        recent.get_current_user.return_value = {"_id": "alice", "role": "user"}
        result = asyncio.run(recent.list_recent_games(None))
        self.assertEqual([row["game_id"] for row in result["games"]], ["match"])

    def test_list_is_capped_at_twenty_most_recent_rows(self):
        self.recent.docs = [
            {
                "owner_id": "alice",
                "game_id": f"game-{index}",
                "last_played_at": f"2026-10-04T20:{index:02d}:00+00:00",
            }
            for index in range(25)
        ]
        result = asyncio.run(recent.list_recent_games(None))
        self.assertEqual(len(result["games"]), recent._MAX_RECENT)
        self.assertEqual(result["games"][0]["game_id"], "game-24")
        self.assertEqual(result["games"][-1]["game_id"], "game-5")

    def test_clear_only_removes_current_accounts_history(self):
        asyncio.run(recent.record_recent_game("match", None))
        self.recent.docs.append({
            "owner_id": "bob",
            "game_id": "community-one",
            "last_played_at": "2026-10-04T20:00:00+00:00",
        })
        result = asyncio.run(recent.clear_recent_games(None))
        self.assertEqual(result["cleared"], 1)
        self.assertEqual(len(self.recent.docs), 1)
        self.assertEqual(self.recent.docs[0]["owner_id"], "bob")


if __name__ == "__main__":
    unittest.main()
