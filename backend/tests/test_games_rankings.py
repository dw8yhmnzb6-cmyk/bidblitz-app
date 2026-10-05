"""Tests for privacy-minimal personal Games rankings."""
import asyncio
import importlib.util
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch


class Router:
    def __init__(self, **kwargs):
        pass

    def __getattr__(self, _name):
        return lambda *args, **kwargs: lambda function: function


class HTTPException(Exception):
    def __init__(self, status_code, detail):
        self.status_code = status_code
        self.detail = detail
        super().__init__(detail)


fastapi = types.ModuleType("fastapi")
fastapi.APIRouter = Router
fastapi.Request = object
fastapi.HTTPException = HTTPException

database = types.ModuleType("core.database")
database.db = types.SimpleNamespace()
security = types.ModuleType("core.security")
security.get_current_user = AsyncMock(return_value={"_id": "alice"})

source = Path(__file__).resolve().parents[1] / "routes" / "games_rankings.py"
spec = importlib.util.spec_from_file_location("games_rankings_under_test", source)
rankings = importlib.util.module_from_spec(spec)
with patch.dict(sys.modules, {
    "fastapi": fastapi,
    "core": types.ModuleType("core"),
    "core.database": database,
    "core.security": security,
}):
    spec.loader.exec_module(rankings)


class Collection:
    def __init__(self, docs=None):
        self.docs = list(docs or [])

    async def find_one(self, query, projection=None):
        row = next(
            (doc for doc in self.docs if all(doc.get(k) == v for k, v in query.items())),
            None,
        )
        if not row:
            return None
        if not projection:
            return dict(row)
        return {key: row.get(key) for key, include in projection.items() if include and key in row}

    async def count_documents(self, query):
        def eligible(doc):
            best = doc.get("best")
            return isinstance(best, list) and any(type(value) is int and value > 0 for value in best)

        rows = [doc for doc in self.docs if eligible(doc)]
        expression = query.get("$expr")
        if expression:
            own_score = expression["$gt"][1]
            rows = [
                doc for doc in rows
                if sum(value for value in doc.get("best", []) if type(value) is int and value > 0) > own_score
            ]
        return len(rows)


def match_doc(owner_id, scores, stars=None):
    best = list(scores) + [0] * (30 - len(scores))
    star_values = list(stars or [2] * len(scores)) + [0] * (30 - len(scores))
    return {
        "owner_id": owner_id,
        "best": best,
        "stars": star_values,
        "unlocked": min(30, len(scores) + 1),
    }


class GamesRankingsTest(unittest.TestCase):
    def setUp(self):
        database.db.games_match_progress = Collection([
            match_doc("alice", [100, 200, 300], [3, 2, 1]),
            match_doc("bob", [500, 500, 500]),
            match_doc("carol", [200, 200, 200]),
            match_doc("empty", []),
        ])
        database.db.games_bubble_progress = Collection()
        database.db.games_runner_progress = Collection()
        security.get_current_user.reset_mock()
        security.get_current_user.return_value = {"_id": "alice"}

    def test_personal_rank_exposes_only_own_aggregates(self):
        result = asyncio.run(rankings.get_personal_ranking("match", None))
        self.assertEqual(result["rank"], 2)
        self.assertEqual(result["participants"], 3)
        self.assertEqual(result["total_score"], 600)
        self.assertEqual(result["total_stars"], 6)
        self.assertEqual(result["completed_levels"], 3)
        self.assertEqual(result["max_levels"], 30)
        self.assertFalse(result["verified"])
        self.assertFalse(result["public_leaderboard_enabled"])
        self.assertEqual(result["privacy"], "private_self_only")
        self.assertNotIn("owner_id", result)
        self.assertNotIn("players", result)

    def test_ties_share_the_same_competition_rank(self):
        security.get_current_user.return_value = {"_id": "carol"}
        result = asyncio.run(rankings.get_personal_ranking("match", None))
        self.assertEqual(result["total_score"], 600)
        self.assertEqual(result["rank"], 2)

    def test_account_without_score_is_not_ranked(self):
        security.get_current_user.return_value = {"_id": "nobody"}
        result = asyncio.run(rankings.get_personal_ranking("match", None))
        self.assertIsNone(result["rank"])
        self.assertEqual(result["participants"], 3)
        self.assertEqual(result["total_score"], 0)

    def test_unknown_game_is_rejected(self):
        with self.assertRaises(HTTPException) as raised:
            asyncio.run(rankings.get_personal_ranking("community-puzzle", None))
        self.assertEqual(raised.exception.status_code, 404)


if __name__ == "__main__":
    unittest.main()
