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

ranking_source = Path(__file__).resolve().parents[1] / "routes" / "games_rankings.py"
ranking_spec = importlib.util.spec_from_file_location("games_rankings_under_test", ranking_source)
rankings = importlib.util.module_from_spec(ranking_spec)
with patch.dict(sys.modules, {
    "fastapi": fastapi,
    "core": types.ModuleType("core"),
    "core.database": database,
    "core.security": security,
}):
    ranking_spec.loader.exec_module(rankings)

integrity_source = Path(__file__).resolve().parents[1] / "routes" / "games_integrity.py"
integrity_spec = importlib.util.spec_from_file_location("games_integrity_under_test", integrity_source)
integrity = importlib.util.module_from_spec(integrity_spec)
with patch.dict(sys.modules, {
    "fastapi": fastapi,
    "core": types.ModuleType("core"),
    "core.database": database,
    "core.security": security,
}):
    integrity_spec.loader.exec_module(integrity)


class Collection:
    def __init__(self):
        self.docs = []

    @staticmethod
    def _matches(doc, query):
        for key, expected in query.items():
            current = doc.get(key)
            if isinstance(expected, dict):
                if "$gt" in expected and not (current is not None and current > expected["$gt"]):
                    return False
                if "$ne" in expected and current == expected["$ne"]:
                    return False
                continue
            if current != expected:
                return False
        return True

    async def find_one(self, query, projection=None):
        row = next((doc for doc in self.docs if self._matches(doc, query)), None)
        return dict(row) if row else None

    async def insert_one(self, doc):
        self.docs.append(dict(doc))
        return types.SimpleNamespace(inserted_id=doc.get("_id") or doc.get("id"))

    async def update_one(self, query, update, upsert=False):
        row = next((doc for doc in self.docs if self._matches(doc, query)), None)
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

    async def count_documents(self, query):
        rows = [
            doc for doc in self.docs
            if isinstance(doc.get("best"), list)
            and any(type(value) is int and value > 0 for value in doc["best"])
        ]
        expression = query.get("$expr")
        if expression:
            threshold = expression["$gt"][1]
            rows = [
                doc for doc in rows
                if sum(
                    value for value in doc.get("best", [])
                    if type(value) is int and value > 0
                ) > threshold
            ]
        return len(rows)


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


def runner_safe_actions(level, seed):
    lane = 1
    actions = []
    for segment in integrity._runner_course(level, seed):
        choices = []
        for direction in (-1, 0, 1):
            next_lane = max(0, min(2, lane + direction))
            if next_lane != segment["obstacle"]:
                choices.append((direction, next_lane))
        preferred = next(
            ((direction, next_lane) for direction, next_lane in choices if next_lane == segment["shard"]),
            choices[0],
        )
        direction, lane = preferred
        actions.append(direction)
    return actions


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
        database.db.games_integrity_sessions = Collection()
        database.db.games_runner_verified_progress = Collection()
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

    def test_runner_server_replay_verifies_only_reproducible_win(self):
        session = asyncio.run(integrity.create_runner_integrity_session(
            integrity.RunnerSessionInput(level=1),
            None,
        ))
        actions = runner_safe_actions(session["level"], session["seed"])
        result = asyncio.run(integrity.verify_runner_integrity(
            integrity.RunnerVerifyInput(
                session_id=session["session_id"],
                actions=actions,
            ),
            None,
        ))

        self.assertTrue(result["verified"])
        self.assertEqual(result["status"], "won")
        self.assertGreater(result["score"], 0)
        self.assertFalse(result["public_trusted_leaderboard_enabled"])
        self.assertEqual(result["integrity"], "server_replayed_not_full_anti_cheat")

        verified = asyncio.run(integrity.get_runner_verified_progress(None))
        self.assertEqual(verified["best"][0], result["score"])
        self.assertEqual(verified["stars"][0], result["stars"])
        self.assertEqual(verified["verified_levels"], 1)

        with self.assertRaises(HTTPException) as reused:
            asyncio.run(integrity.verify_runner_integrity(
                integrity.RunnerVerifyInput(
                    session_id=session["session_id"],
                    actions=actions,
                ),
                None,
            ))
        self.assertEqual(reused.exception.status_code, 404)

    def test_runner_integrity_session_respects_account_unlocks(self):
        with self.assertRaises(HTTPException) as locked:
            asyncio.run(integrity.create_runner_integrity_session(
                integrity.RunnerSessionInput(level=2),
                None,
            ))
        self.assertEqual(locked.exception.status_code, 409)

    def test_runner_replay_rejects_incomplete_action_sequence(self):
        with self.assertRaises(ValueError):
            integrity.replay_runner(1, 123456, [0, 0, 0])

    def test_runner_personal_rank_prefers_server_replayed_scores(self):
        session = asyncio.run(integrity.create_runner_integrity_session(
            integrity.RunnerSessionInput(level=1),
            None,
        ))
        actions = runner_safe_actions(session["level"], session["seed"])
        verified = asyncio.run(integrity.verify_runner_integrity(
            integrity.RunnerVerifyInput(
                session_id=session["session_id"],
                actions=actions,
            ),
            None,
        ))

        database.db.games_runner_verified_progress.docs.append({
            "owner_id": "bob",
            "version": 1,
            "best": [999999] + [0] * 14,
            "stars": [3] + [0] * 14,
        })

        ranking = asyncio.run(rankings.get_personal_ranking("runner", None))
        self.assertTrue(ranking["verified"])
        self.assertEqual(ranking["mode"], "server_replayed")
        self.assertEqual(ranking["integrity"], "server_replayed_not_full_anti_cheat")
        self.assertEqual(ranking["total_score"], verified["score"])
        self.assertEqual(ranking["participants"], 2)
        self.assertEqual(ranking["rank"], 2)
        self.assertFalse(ranking["public_leaderboard_enabled"])

    def test_personal_practice_ranking_is_private_and_unverified(self):
        asyncio.run(progress.save_match_progress(None, payload(3, 1000)))
        security.get_current_user.return_value = {"_id": "bob"}
        asyncio.run(progress.save_match_progress(None, payload(3, 2000)))
        security.get_current_user.return_value = {"_id": "alice"}

        result = asyncio.run(rankings.get_personal_ranking("match", None))

        self.assertEqual(result["rank"], 2)
        self.assertEqual(result["participants"], 2)
        self.assertEqual(result["completed_levels"], 3)
        self.assertFalse(result["verified"])
        self.assertFalse(result["public_leaderboard_enabled"])
        self.assertEqual(result["privacy"], "private_self_only")
        self.assertNotIn("owner_id", result)
        self.assertNotIn("players", result)

    def test_personal_ranking_rejects_unsupported_games(self):
        with self.assertRaises(HTTPException) as raised:
            asyncio.run(rankings.get_personal_ranking("community-puzzle", None))
        self.assertEqual(raised.exception.status_code, 404)


if __name__ == "__main__":
    unittest.main()
