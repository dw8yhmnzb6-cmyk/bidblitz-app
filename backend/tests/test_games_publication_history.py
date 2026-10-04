"""Tests for Games publication history APIs."""
import asyncio
import types
import unittest
from unittest.mock import AsyncMock

from fastapi import HTTPException

from routes import games_publication_history as history


class Cursor:
    def __init__(self, rows):
        self.rows = [dict(row) for row in rows]
    def sort(self, *_args, **_kwargs):
        self.rows.sort(key=lambda row: row.get("created_at") or "", reverse=True)
        return self
    def limit(self, n):
        self.rows = self.rows[:n]
        return self
    async def to_list(self, n):
        return self.rows[:n]


class Collection:
    def __init__(self, docs=None):
        self.docs = [dict(row) for row in (docs or [])]
    async def find_one(self, query, projection=None):
        return next((dict(row) for row in self.docs if all(row.get(k) == v for k, v in query.items())), None)
    def find(self, query, projection=None):
        rows = [row for row in self.docs if all(row.get(k) == v for k, v in query.items())]
        return Cursor(rows)


class GamesPublicationHistoryTest(unittest.TestCase):
    def setUp(self):
        history.get_current_user = AsyncMock(return_value={"_id": "alice", "role": "user"})
        history.db = types.SimpleNamespace(
            game_studio_drafts=Collection([
                {"id": "d1", "owner_id": "alice", "status": "draft", "title": "Game One"},
                {"id": "d2", "owner_id": "bob", "status": "draft", "title": "Game Two"},
            ]),
            game_studio_publication_events=Collection([
                {"draft_id": "d1", "action": "publish", "version_id": "v1", "admin_id": "admin", "created_at": "2026-01-01T00:00:00+00:00"},
                {"draft_id": "d1", "action": "rollback", "version_id": "v0", "previous_version_id": "v1", "admin_id": "admin", "created_at": "2026-01-02T00:00:00+00:00"},
                {"draft_id": "d2", "action": "publish", "version_id": "x1", "admin_id": "admin", "created_at": "2026-01-03T00:00:00+00:00"},
            ]),
        )

    def test_developer_only_sees_own_draft_history_without_admin_identity(self):
        result = asyncio.run(history.developer_publication_history("d1", None))
        self.assertEqual([event["action"] for event in result["events"]], ["rollback", "publish"])
        self.assertNotIn("admin_id", result["events"][0])
        with self.assertRaises(HTTPException) as context:
            asyncio.run(history.developer_publication_history("d2", None))
        self.assertEqual(context.exception.status_code, 404)

    def test_admin_can_read_any_draft_history(self):
        history.get_current_user.return_value = {"_id": "admin", "role": "admin"}
        result = asyncio.run(history.admin_publication_history("d2", None))
        self.assertEqual(len(result["events"]), 1)
        self.assertEqual(result["events"][0]["version_id"], "x1")

    def test_super_admin_can_read_any_draft_history(self):
        history.get_current_user.return_value = {"_id": "root", "role": "super_admin"}
        result = asyncio.run(history.admin_publication_history("d2", None))
        self.assertEqual(len(result["events"]), 1)
        self.assertEqual(result["events"][0]["version_id"], "x1")

    def test_non_admin_cannot_read_admin_history(self):
        with self.assertRaises(HTTPException) as context:
            asyncio.run(history.admin_publication_history("d1", None))
        self.assertEqual(context.exception.status_code, 403)

    def test_unknown_draft_is_not_exposed(self):
        with self.assertRaises(HTTPException) as context:
            asyncio.run(history.developer_publication_history("missing", None))
        self.assertEqual(context.exception.status_code, 404)


if __name__ == "__main__":
    unittest.main()
