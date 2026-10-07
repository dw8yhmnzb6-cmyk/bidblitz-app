"""Tests for privacy-minimal Games integrity status."""
import asyncio
import types
import unittest
from unittest.mock import AsyncMock

from fastapi import HTTPException

from routes import games_integrity_status as status


class Collection:
    def __init__(self, docs=None):
        self.docs = [dict(row) for row in (docs or [])]

    async def count_documents(self, query):
        if not query:
            return len(self.docs)
        if "used" in query:
            return sum(1 for row in self.docs if row.get("used") == query["used"])
        if "best" in query:
            return sum(
                1 for row in self.docs
                if isinstance(row.get("best"), list)
                and any(type(value) is int and value > 0 for value in row["best"])
            )
        return 0


class GamesIntegrityStatusTest(unittest.TestCase):
    def setUp(self):
        status.get_current_user = AsyncMock(return_value={"_id": "admin", "role": "admin"})
        status.db = types.SimpleNamespace(
            games_match_verified_progress=Collection([
                {"owner_id": "a", "best": [100] + [0] * 29},
                {"owner_id": "empty", "best": [0] * 30},
            ]),
            games_bubble_verified_progress=Collection([
                {"owner_id": "b", "best": [200] + [0] * 19},
            ]),
            games_runner_verified_progress=Collection([
                {"owner_id": "c", "best": [300] + [0] * 14},
                {"owner_id": "d", "best": [400] + [0] * 14},
            ]),
            games_integrity_sessions=Collection([
                {"used": False},
                {"used": False},
                {"used": True},
            ]),
        )

    def test_admin_sees_only_aggregate_integrity_counts(self):
        result = asyncio.run(status.integrity_status(None))
        by_game = {row["game_id"]: row for row in result["games"]}
        self.assertEqual(by_game["match"]["verified_profiles"], 1)
        self.assertEqual(by_game["bubble"]["verified_profiles"], 1)
        self.assertEqual(by_game["runner"]["verified_profiles"], 2)
        self.assertEqual(by_game["farm"]["verified_profiles"], 0)
        self.assertEqual(result["verified_profiles_total"], 4)
        self.assertEqual(result["active_replay_sessions"], 2)
        self.assertFalse(result["public_trusted_leaderboards_enabled"])
        self.assertEqual(result["privacy"], "aggregate_counts_only")
        serialized = str(result)
        for secret in ("owner_id", "email", "total_score", "best"):
            self.assertNotIn(secret, serialized)

    def test_super_admin_is_allowed(self):
        status.get_current_user.return_value = {"_id": "root", "role": "super_admin"}
        result = asyncio.run(status.integrity_status(None))
        self.assertEqual(result["integrity"], "server_replay_not_full_anti_cheat")

    def test_regular_user_is_denied(self):
        status.get_current_user.return_value = {"_id": "user", "role": "user"}
        with self.assertRaises(HTTPException) as context:
            asyncio.run(status.integrity_status(None))
        self.assertEqual(context.exception.status_code, 403)


if __name__ == "__main__":
    unittest.main()
