"""Unit tests for account-backed Match progress."""
import asyncio
import importlib.util
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

from pydantic import ValidationError


class Router:
    def __init__(self, **kwargs):
        pass
    def __getattr__(self, _name):
        return lambda *args, **kwargs: lambda function: function


fastapi = types.ModuleType("fastapi")
fastapi.APIRouter = Router
fastapi.Request = object
database = types.ModuleType("core.database")
database.db = types.SimpleNamespace()
security = types.ModuleType("core.security")
security.get_current_user = AsyncMock(return_value={"_id": "alice"})

source = Path(__file__).resolve().parents[1] / "routes" / "games_progress.py"
spec = importlib.util.spec_from_file_location("games_progress_under_test", source)
progress = importlib.util.module_from_spec(spec)
with patch.dict(sys.modules, {
    "fastapi": fastapi,
    "core": types.ModuleType("core"),
    "core.database": database,
    "core.security": security,
}):
    spec.loader.exec_module(progress)


class Collection:
    def __init__(self):
        self.docs = []

    async def find_one(self, query, projection=None):
        row = next((doc for doc in self.docs if all(doc.get(k) == v for k, v in query.items())), None)
        return dict(row) if row else None

    async def update_one(self, query, update, upsert=False):
        row = next((doc for doc in self.docs if all(doc.get(k) == v for k, v in query.items())), None)
        if row is None and upsert:
            row = dict(query)
            for key, value in update.get("$setOnInsert", {}).items():
                row.setdefault(key, value.copy() if isinstance(value, list) else value)
            self.docs.append(row)
        if row is None:
            return types.SimpleNamespace(matched_count=0)
        for key, value in update.get("$set", {}).items():
            row[key] = value
        for key, value in update.get("$max", {}).items():
            if "." in key:
                field, index = key.split(".", 1)
                index = int(index)
                row[field][index] = max(row[field][index], value)
            else:
                row[key] = max(row.get(key, value), value)
        return types.SimpleNamespace(matched_count=1)


def payload(completed=0, score_base=1000):
    best = [0] * 30
    stars = [0] * 30
    for index in range(completed):
        best[index] = score_base + index
        stars[index] = 2
    unlocked = 1 if completed == 0 else min(30, completed + 1)
    return progress.MatchProgressInput(version=1, unlocked=unlocked, best=best, stars=stars)


def bubble_payload(completed=0, score_base=700):
    best = [0] * 20
    stars = [0] * 20
    for index in range(completed):
        best[index] = score_base + index
        stars[index] = 2
    unlocked = 1 if completed == 0 else min(20, completed + 1)
    return progress.BubbleProgressInput(version=1, unlocked=unlocked, best=best, stars=stars)


def runner_payload(completed=0, score_base=500):
    best = [0] * 15
    stars = [0] * 15
    for index in range(completed):
        best[index] = score_base + index
        stars[index] = 2
    unlocked = 1 if completed == 0 else min(15, completed + 1)
    return progress.RunnerProgressInput(version=1, unlocked=unlocked, best=best, stars=stars)


class GamesProgressTest(unittest.TestCase):
    def setUp(self):
        self.collection = Collection()
        self.bubble_collection = Collection()
        self.runner_collection = Collection()
        database.db.games_match_progress = self.collection
        database.db.games_bubble_progress = self.bubble_collection
        database.db.games_runner_progress = self.runner_collection
        security.get_current_user.reset_mock()
        security.get_current_user.return_value = {"_id": "alice"}

    def test_empty_account_has_default_progress(self):
        result = asyncio.run(progress.get_match_progress(None))
        self.assertEqual(result["unlocked"], 1)
        self.assertEqual(result["best"], [0] * 30)
        self.assertEqual(result["stars"], [0] * 30)

    def test_progress_only_moves_forward(self):
        first = asyncio.run(progress.save_match_progress(None, payload(4, 1200)))
        self.assertEqual(first["unlocked"], 5)
        lower = asyncio.run(progress.save_match_progress(None, payload(2, 700)))
        self.assertEqual(lower["unlocked"], 5)
        self.assertEqual(lower["best"][:4], first["best"][:4])
        higher = asyncio.run(progress.save_match_progress(None, payload(5, 1500)))
        self.assertEqual(higher["unlocked"], 6)
        self.assertGreaterEqual(higher["best"][0], 1500)

    def test_progress_is_account_bound(self):
        asyncio.run(progress.save_match_progress(None, payload(3)))
        security.get_current_user.return_value = {"_id": "bob"}
        self.assertEqual(asyncio.run(progress.get_match_progress(None))["unlocked"], 1)
        asyncio.run(progress.save_match_progress(None, payload(1, 2000)))
        security.get_current_user.return_value = {"_id": "alice"}
        self.assertEqual(asyncio.run(progress.get_match_progress(None))["unlocked"], 4)

    def test_invalid_or_gapped_progress_is_rejected(self):
        valid = payload(2).model_dump()
        cases = [
            {**valid, "unlocked": 30},
            {**valid, "best": valid["best"][:29]},
            {**valid, "stars": [0, 2] + [0] * 28},
            {**valid, "best": [1000, 0, 1200] + [0] * 27, "stars": [2, 0, 2] + [0] * 27, "unlocked": 4},
            {**valid, "best": [True, 1001] + [0] * 28},
        ]
        for value in cases:
            with self.assertRaises(ValidationError):
                progress.MatchProgressInput(**value)

    def test_server_payload_has_no_coin_life_or_board_fields(self):
        result = asyncio.run(progress.save_match_progress(None, payload(1)))
        for forbidden in ("coins", "energy", "active", "purchases", "receipts", "board", "rng"):
            self.assertNotIn(forbidden, result)


    def test_bubble_progress_defaults_and_moves_forward_only(self):
        empty = asyncio.run(progress.get_bubble_progress(None))
        self.assertEqual(empty["unlocked"], 1)
        self.assertEqual(empty["best"], [0] * 20)
        first = asyncio.run(progress.save_bubble_progress(None, bubble_payload(4, 900)))
        self.assertEqual(first["unlocked"], 5)
        lower = asyncio.run(progress.save_bubble_progress(None, bubble_payload(2, 300)))
        self.assertEqual(lower["unlocked"], 5)
        self.assertEqual(lower["best"][:4], first["best"][:4])
        higher = asyncio.run(progress.save_bubble_progress(None, bubble_payload(5, 1200)))
        self.assertEqual(higher["unlocked"], 6)
        self.assertGreaterEqual(higher["best"][0], 1200)

    def test_bubble_progress_is_account_bound_and_payload_is_minimal(self):
        asyncio.run(progress.save_bubble_progress(None, bubble_payload(3)))
        security.get_current_user.return_value = {"_id": "bob"}
        self.assertEqual(asyncio.run(progress.get_bubble_progress(None))["unlocked"], 1)
        security.get_current_user.return_value = {"_id": "alice"}
        result = asyncio.run(progress.get_bubble_progress(None))
        self.assertEqual(result["unlocked"], 4)
        for forbidden in ("coins", "energy", "active", "purchases", "receipts", "board", "rng"):
            self.assertNotIn(forbidden, result)

    def test_invalid_bubble_progress_is_rejected(self):
        valid = bubble_payload(2).model_dump()
        cases = [
            {**valid, "unlocked": 20},
            {**valid, "best": valid["best"][:19]},
            {**valid, "stars": [0, 2] + [0] * 18},
            {**valid, "best": [700, 0, 900] + [0] * 17, "stars": [2, 0, 2] + [0] * 17, "unlocked": 4},
            {**valid, "best": [True, 701] + [0] * 18},
        ]
        for value in cases:
            with self.assertRaises(ValidationError):
                progress.BubbleProgressInput(**value)


    def test_runner_progress_defaults_and_moves_forward_only(self):
        empty = asyncio.run(progress.get_runner_progress(None))
        self.assertEqual(empty["unlocked"], 1)
        self.assertEqual(empty["best"], [0] * 15)
        self.assertEqual(empty["stars"], [0] * 15)

        first = asyncio.run(progress.save_runner_progress(None, runner_payload(4, 900)))
        self.assertEqual(first["unlocked"], 5)
        lower = asyncio.run(progress.save_runner_progress(None, runner_payload(2, 300)))
        self.assertEqual(lower["unlocked"], 5)
        self.assertEqual(lower["best"][:4], first["best"][:4])
        higher = asyncio.run(progress.save_runner_progress(None, runner_payload(5, 1200)))
        self.assertEqual(higher["unlocked"], 6)
        self.assertGreaterEqual(higher["best"][0], 1200)

    def test_runner_progress_is_account_bound_and_minimal(self):
        asyncio.run(progress.save_runner_progress(None, runner_payload(3)))
        security.get_current_user.return_value = {"_id": "bob"}
        self.assertEqual(asyncio.run(progress.get_runner_progress(None))["unlocked"], 1)
        security.get_current_user.return_value = {"_id": "alice"}
        result = asyncio.run(progress.get_runner_progress(None))
        self.assertEqual(result["unlocked"], 4)
        for forbidden in ("coins", "energy", "active", "purchases", "receipts", "course", "lane", "rng", "position"):
            self.assertNotIn(forbidden, result)

    def test_invalid_runner_progress_is_rejected(self):
        valid = runner_payload(2).model_dump()
        cases = [
            {**valid, "unlocked": 15},
            {**valid, "best": valid["best"][:14]},
            {**valid, "stars": [0, 2] + [0] * 13},
            {**valid, "best": [500, 0, 700] + [0] * 12, "stars": [2, 0, 2] + [0] * 12, "unlocked": 4},
            {**valid, "best": [True, 501] + [0] * 13},
        ]
        for value in cases:
            with self.assertRaises(ValidationError):
                progress.RunnerProgressInput(**value)


if __name__ == "__main__":
    unittest.main()
