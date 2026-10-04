"""Tests for moderated non-monetary BidBlitz Games reviews."""
import asyncio
import types
import unittest
from unittest.mock import AsyncMock

from fastapi import HTTPException
from pydantic import ValidationError

from routes import games_reviews as reviews


def matches(doc, query):
    for key, value in query.items():
        current = doc.get(key)
        if isinstance(value, dict):
            if "$in" in value and current not in value["$in"]:
                return False
            continue
        if current != value:
            return False
    return True


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


class AggregateCursor:
    def __init__(self, rows, pipeline):
        self.rows = [dict(row) for row in rows]
        self.pipeline = pipeline

    async def to_list(self, _limit):
        match_query = self.pipeline[0]["$match"]
        rows = [row for row in self.rows if matches(row, match_query)]
        if not rows:
            return []
        group = self.pipeline[1]["$group"]
        if group.get("_id") == "$game_id":
            grouped = {}
            for row in rows:
                grouped.setdefault(row["game_id"], []).append(row)
            return [{
                "_id": game_id,
                "count": len(items),
                "average": sum(int(item["rating"]) for item in items) / len(items),
            } for game_id, items in grouped.items()]
        return [{
            "_id": None,
            "count": len(rows),
            "average": sum(int(row["rating"]) for row in rows) / len(rows),
        }]


class Collection:
    def __init__(self, docs=None):
        self.docs = [dict(row) for row in (docs or [])]

    async def find_one(self, query, projection=None):
        row = next((row for row in self.docs if matches(row, query)), None)
        return dict(row) if row else None

    def find(self, query, projection=None):
        return Cursor([row for row in self.docs if matches(row, query)])

    def aggregate(self, pipeline):
        return AggregateCursor(self.docs, pipeline)

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
        return types.SimpleNamespace(matched_count=1)

    async def delete_one(self, query):
        for index, row in enumerate(self.docs):
            if matches(row, query):
                self.docs.pop(index)
                return types.SimpleNamespace(deleted_count=1)
        return types.SimpleNamespace(deleted_count=0)

    async def insert_one(self, doc):
        self.docs.append(dict(doc))
        return types.SimpleNamespace(inserted_id=doc.get("review_id"))


class GamesReviewsTest(unittest.TestCase):
    def setUp(self):
        self.db = types.SimpleNamespace(
            games_reviews=Collection(),
            games_catalog=Collection(),
            games_review_moderation_events=Collection(),
        )
        reviews.db = self.db
        reviews.get_current_user = AsyncMock(return_value={
            "_id": "alice",
            "role": "user",
        })

    def test_match_review_is_account_bound_and_public_response_hides_owner(self):
        result = asyncio.run(reviews.upsert_review(
            "match",
            reviews.ReviewInput(rating=5, text="Great puzzle."),
            None,
        ))
        self.assertEqual(result["review"]["rating"], 5)
        self.assertEqual(result["summary"], {"count": 1, "average": 5.0})
        self.assertNotIn("owner_id", result["review"])

        public = asyncio.run(reviews.list_public_reviews("match"))
        self.assertEqual(public["summary"]["count"], 1)
        self.assertEqual(public["reviews"][0]["text"], "Great puzzle.")
        self.assertNotIn("owner_id", public["reviews"][0])

        mine = asyncio.run(reviews.get_my_review("match", None))
        self.assertEqual(mine["review"]["status"], "visible")

    def test_upsert_keeps_one_review_per_account_and_game(self):
        asyncio.run(reviews.upsert_review(
            "match", reviews.ReviewInput(rating=3, text="First"), None
        ))
        first_id = self.db.games_reviews.docs[0]["id"]
        asyncio.run(reviews.upsert_review(
            "match", reviews.ReviewInput(rating=4, text="Updated"), None
        ))
        self.assertEqual(len(self.db.games_reviews.docs), 1)
        self.assertEqual(self.db.games_reviews.docs[0]["id"], first_id)
        self.assertEqual(self.db.games_reviews.docs[0]["rating"], 4)
        self.assertEqual(self.db.games_reviews.docs[0]["text"], "Updated")

    def test_public_summary_averages_visible_reviews_only(self):
        asyncio.run(reviews.upsert_review(
            "match", reviews.ReviewInput(rating=5, text="A"), None
        ))
        reviews.get_current_user.return_value = {"_id": "bob", "role": "user"}
        asyncio.run(reviews.upsert_review(
            "match", reviews.ReviewInput(rating=3, text="B"), None
        ))
        public = asyncio.run(reviews.list_public_reviews("match"))
        self.assertEqual(public["summary"], {"count": 2, "average": 4.0})

    def test_bulk_summaries_include_match_and_published_community_only(self):
        self.db.games_catalog.docs.extend([
            {"id": "community-game", "status": "published"},
            {"id": "offline-game", "status": "unpublished"},
        ])
        self.db.games_reviews.docs.extend([
            {"id": "a", "owner_id": "u1", "game_id": "match", "rating": 5, "text": "", "status": "visible"},
            {"id": "b", "owner_id": "u2", "game_id": "match", "rating": 3, "text": "", "status": "visible"},
            {"id": "c", "owner_id": "u3", "game_id": "match", "rating": 1, "text": "", "status": "hidden"},
            {"id": "d", "owner_id": "u4", "game_id": "community-game", "rating": 4, "text": "", "status": "visible"},
            {"id": "e", "owner_id": "u5", "game_id": "offline-game", "rating": 5, "text": "", "status": "visible"},
        ])

        result = asyncio.run(reviews.review_summaries("match,community-game,offline-game"))
        self.assertEqual(result["summaries"]["match"], {"count": 2, "average": 4.0})
        self.assertEqual(result["summaries"]["community-game"], {"count": 1, "average": 4.0})
        self.assertNotIn("offline-game", result["summaries"])

    def test_bulk_summaries_reject_invalid_or_excessive_ids(self):
        with self.assertRaises(HTTPException) as invalid:
            asyncio.run(reviews.review_summaries("match,../bad"))
        self.assertEqual(invalid.exception.status_code, 400)

        too_many = ",".join(f"game-{index}" for index in range(reviews._MAX_SUMMARY_GAMES + 1))
        with self.assertRaises(HTTPException) as excessive:
            asyncio.run(reviews.review_summaries(too_many))
        self.assertEqual(excessive.exception.status_code, 400)

    def test_admin_can_hide_and_super_admin_can_restore_with_audit(self):
        asyncio.run(reviews.upsert_review(
            "match", reviews.ReviewInput(rating=1, text="Needs moderation"), None
        ))
        review_id = self.db.games_reviews.docs[0]["id"]

        reviews.get_current_user.return_value = {"_id": "admin-1", "role": "admin"}
        hidden = asyncio.run(reviews.moderate_review(
            review_id,
            reviews.ModerationInput(action="hide", note="Policy review"),
            None,
        ))
        self.assertEqual(hidden["review"]["status"], "hidden")
        public = asyncio.run(reviews.list_public_reviews("match"))
        self.assertEqual(public["summary"]["count"], 0)
        self.assertEqual(public["reviews"], [])

        reviews.get_current_user.return_value = {"_id": "root-1", "role": "super_admin"}
        restored = asyncio.run(reviews.moderate_review(
            review_id,
            reviews.ModerationInput(action="restore", note="Resolved"),
            None,
        ))
        self.assertEqual(restored["review"]["status"], "visible")
        self.assertEqual(len(self.db.games_review_moderation_events.docs), 2)
        self.assertEqual(
            [row["action"] for row in self.db.games_review_moderation_events.docs],
            ["hide", "restore"],
        )

    def test_non_admin_cannot_moderate(self):
        asyncio.run(reviews.upsert_review(
            "match", reviews.ReviewInput(rating=5, text="Fine"), None
        ))
        review_id = self.db.games_reviews.docs[0]["id"]
        with self.assertRaises(HTTPException) as context:
            asyncio.run(reviews.moderate_review(
                review_id,
                reviews.ModerationInput(action="hide", note="No access"),
                None,
            ))
        self.assertEqual(context.exception.status_code, 403)

    def test_only_published_community_games_are_reviewable(self):
        with self.assertRaises(HTTPException) as missing:
            asyncio.run(reviews.list_public_reviews("community-game"))
        self.assertEqual(missing.exception.status_code, 404)

        self.db.games_catalog.docs.append({
            "id": "community-game",
            "status": "published",
        })
        result = asyncio.run(reviews.upsert_review(
            "community-game",
            reviews.ReviewInput(rating=4, text="Published game"),
            None,
        ))
        self.assertEqual(result["review"]["game_id"], "community-game")

        self.db.games_catalog.docs[0]["status"] = "unpublished"
        with self.assertRaises(HTTPException) as unpublished:
            asyncio.run(reviews.list_public_reviews("community-game"))
        self.assertEqual(unpublished.exception.status_code, 404)

    def test_delete_own_review_updates_summary(self):
        asyncio.run(reviews.upsert_review(
            "match", reviews.ReviewInput(rating=5, text="Temporary"), None
        ))
        deleted = asyncio.run(reviews.delete_my_review("match", None))
        self.assertTrue(deleted["deleted"])
        self.assertEqual(deleted["summary"], {"count": 0, "average": None})
        self.assertEqual(self.db.games_reviews.docs, [])

    def test_review_validation_is_strict(self):
        with self.assertRaises(ValidationError):
            reviews.ReviewInput(rating=0, text="bad")
        with self.assertRaises(ValidationError):
            reviews.ReviewInput(rating=6, text="bad")
        with self.assertRaises(ValidationError):
            reviews.ReviewInput(rating="5", text="bad")
        with self.assertRaises(ValidationError):
            reviews.ReviewInput(rating=5, text="x" * 1001)


if __name__ == "__main__":
    unittest.main()
