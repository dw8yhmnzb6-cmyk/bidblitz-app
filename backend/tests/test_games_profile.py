"""Unit tests for account-backed Games favorites."""
import asyncio
import importlib.util
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch


class HTTPException(Exception):
    def __init__(self, status_code, detail):
        self.status_code = status_code
        self.detail = detail


class Router:
    def __init__(self, **kwargs):
        pass
    def __getattr__(self, _name):
        return lambda *args, **kwargs: lambda function: function


fastapi = types.ModuleType("fastapi")
fastapi.APIRouter = Router
fastapi.HTTPException = HTTPException
fastapi.Request = object
database = types.ModuleType("core.database")
database.db = types.SimpleNamespace()
security = types.ModuleType("core.security")
security.get_current_user = AsyncMock(return_value={"_id": "alice"})

source = Path(__file__).resolve().parents[1] / "routes" / "games_profile.py"
spec = importlib.util.spec_from_file_location("games_profile_under_test", source)
profile = importlib.util.module_from_spec(spec)
with patch.dict(sys.modules, {
    "fastapi": fastapi,
    "core": types.ModuleType("core"),
    "core.database": database,
    "core.security": security,
}):
    spec.loader.exec_module(profile)


class Collection:
    def __init__(self):
        self.docs = []

    async def find_one(self, query, projection=None):
        row = next((item for item in self.docs if all(item.get(k) == v for k, v in query.items())), None)
        return dict(row) if row else None

    async def update_one(self, query, update, upsert=False):
        row = next((item for item in self.docs if all(item.get(k) == v for k, v in query.items())), None)
        if row is None and upsert:
            row = dict(query)
            for key, value in update.get("$setOnInsert", {}).items():
                row.setdefault(key, value)
            self.docs.append(row)
        if row is None:
            return types.SimpleNamespace(matched_count=0)
        for key, value in update.get("$set", {}).items():
            row[key] = value
        for key, value in update.get("$addToSet", {}).items():
            row.setdefault(key, [])
            if value not in row[key]:
                row[key].append(value)
        for key, value in update.get("$pull", {}).items():
            row[key] = [item for item in row.get(key, []) if item != value]
        return types.SimpleNamespace(matched_count=1)


class GamesProfileTest(unittest.TestCase):
    def setUp(self):
        self.collection = Collection()
        database.db.games_profiles = self.collection
        security.get_current_user.reset_mock()
        security.get_current_user.return_value = {"_id": "alice"}

    def test_empty_profile_then_add_and_remove_favorite(self):
        self.assertEqual(asyncio.run(profile.get_profile(None))["favorites"], [])
        added = asyncio.run(profile.add_favorite("match", None))
        self.assertEqual(added["favorites"], ["match"])
        added_again = asyncio.run(profile.add_favorite("match", None))
        self.assertEqual(added_again["favorites"], ["match"])
        removed = asyncio.run(profile.remove_favorite("match", None))
        self.assertEqual(removed["favorites"], [])

    def test_favorites_are_account_bound(self):
        asyncio.run(profile.add_favorite("match", None))
        security.get_current_user.return_value = {"_id": "bob"}
        self.assertEqual(asyncio.run(profile.get_profile(None))["favorites"], [])
        asyncio.run(profile.add_favorite("runner", None))
        security.get_current_user.return_value = {"_id": "alice"}
        self.assertEqual(asyncio.run(profile.get_profile(None))["favorites"], ["match"])

    def test_invalid_game_ids_are_rejected(self):
        for value in ("", "../match", "A Space", "<script>", "x" * 65):
            with self.assertRaises(HTTPException) as context:
                asyncio.run(profile.add_favorite(value, None))
            self.assertEqual(context.exception.status_code, 400)

    def test_limit_is_enforced_without_duplicate_penalty(self):
        self.collection.docs.append({"owner_id": "alice", "favorites": [f"game-{i}" for i in range(100)]})
        duplicate = asyncio.run(profile.add_favorite("game-1", None))
        self.assertEqual(len(duplicate["favorites"]), 100)
        with self.assertRaises(HTTPException) as context:
            asyncio.run(profile.add_favorite("overflow", None))
        self.assertEqual(context.exception.status_code, 409)

    def test_corrupt_saved_values_are_filtered_from_response(self):
        self.collection.docs.append({
            "owner_id": "alice",
            "favorites": ["match", "../bad", 123, "runner"],
            "updated_at": "now",
        })
        result = asyncio.run(profile.get_profile(None))
        self.assertEqual(result["favorites"], ["match", "runner"])
        self.assertEqual(result["updated_at"], "now")


if __name__ == "__main__":
    unittest.main()
