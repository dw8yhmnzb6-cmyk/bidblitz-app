"""Tests for privacy-minimal BidBlitz Games launch counters."""
import asyncio
import types
import unittest

from fastapi import HTTPException

from routes import games_analytics as analytics


def matches(doc, query):
    return all(doc.get(key) == value for key, value in query.items())


class Collection:
    def __init__(self, docs=None):
        self.docs = [dict(row) for row in (docs or [])]

    async def find_one(self, query, projection=None):
        row = next((row for row in self.docs if matches(row, query)), None)
        return dict(row) if row else None

    async def update_one(self, query, update, upsert=False):
        row = next((row for row in self.docs if matches(row, query)), None)
        if row is None and upsert:
            row = dict(query)
            for key, value in update.get("$setOnInsert", {}).items():
                row.setdefault(key, value)
            self.docs.append(row)
        if row is None:
            return types.SimpleNamespace(matched_count=0)
        for key, value in update.get("$inc", {}).items():
            row[key] = int(row.get(key) or 0) + int(value)
        for key, value in update.get("$set", {}).items():
            row[key] = value
        return types.SimpleNamespace(matched_count=1)


class GamesAnalyticsTest(unittest.TestCase):
    def setUp(self):
        self.catalog = Collection()
        self.launches = Collection()
        analytics.db = types.SimpleNamespace(
            games_catalog=self.catalog,
            games_launch_totals=self.launches,
        )

    def test_match_launch_counter_is_anonymous_and_non_monetary(self):
        first = asyncio.run(analytics.record_game_launch("match"))
        second = asyncio.run(analytics.record_game_launch("match"))

        self.assertTrue(first["recorded"])
        self.assertEqual(first["measurement"], "approximate_launches")
        self.assertFalse(first["monetary"])
        self.assertEqual(second["game_id"], "match")

        self.assertEqual(len(self.launches.docs), 1)
        saved = self.launches.docs[0]
        self.assertEqual(saved["game_id"], "match")
        self.assertEqual(saved["launches"], 2)
        self.assertNotIn("owner_id", saved)
        self.assertNotIn("user_id", saved)
        self.assertNotIn("ip", saved)
        self.assertNotIn("wallet", saved)

    def test_only_published_community_game_can_be_counted(self):
        with self.assertRaises(HTTPException) as missing:
            asyncio.run(analytics.record_game_launch("community-game"))
        self.assertEqual(missing.exception.status_code, 404)

        self.catalog.docs.append({"id": "community-game", "status": "published"})
        result = asyncio.run(analytics.record_game_launch("community-game"))
        self.assertTrue(result["recorded"])
        self.assertEqual(self.launches.docs[0]["game_id"], "community-game")

        self.catalog.docs[0]["status"] = "unpublished"
        with self.assertRaises(HTTPException) as offline:
            asyncio.run(analytics.record_game_launch("community-game"))
        self.assertEqual(offline.exception.status_code, 404)

    def test_invalid_game_id_is_rejected(self):
        for value in ("", "../bad", "UPPER CASE", "x" * 81):
            with self.assertRaises(HTTPException) as context:
                asyncio.run(analytics.record_game_launch(value))
            self.assertEqual(context.exception.status_code, 400)


if __name__ == "__main__":
    unittest.main()
