"""Run with python -m unittest discover -s backend/tests -p test_game_studio.py."""
import asyncio
import importlib.util
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import AsyncMock

from pydantic import ValidationError


class HTTPException(Exception):
    def __init__(self, status_code, detail):
        self.status_code = status_code
        self.detail = detail


class Router:
    def __init__(self, **kwargs):
        pass

    def __getattr__(self, name):
        return lambda *args, **kwargs: lambda function: function


fastapi = types.ModuleType("fastapi")
fastapi.APIRouter = Router
fastapi.HTTPException = HTTPException
fastapi.Request = object
database = types.ModuleType("core.database")
database.db = types.SimpleNamespace()
security = types.ModuleType("core.security")
security.get_current_user = AsyncMock(return_value={"_id": "alice"})
sys.modules.update({"fastapi": fastapi, "core": types.ModuleType("core"),
                    "core.database": database, "core.security": security})

source = Path(__file__).resolve().parents[1] / "routes" / "game_studio.py"
spec = importlib.util.spec_from_file_location("game_studio_under_test", source)
studio = importlib.util.module_from_spec(spec)
spec.loader.exec_module(studio)


class Collection:
    def __init__(self):
        self.docs = []

    async def count_documents(self, query, **kwargs):
        return sum(d["owner_id"] == query["owner_id"] for d in self.docs)

    async def insert_one(self, doc):
        self.docs.append(dict(doc))

    async def find_one(self, query, projection=None):
        result = next((d for d in self.docs if all(d.get(k) == v for k, v in query.items())), None)
        return {k: v for k, v in result.items() if k not in {"_id", "owner_id"}} if result else None

    async def update_one(self, query, update):
        target = next((d for d in self.docs if all(d.get(k) == v for k, v in query.items())), None)
        if target:
            target.update(update["$set"])
        return types.SimpleNamespace(matched_count=int(target is not None))

    async def delete_one(self, query):
        old = len(self.docs)
        self.docs[:] = [d for d in self.docs if not all(d.get(k) == v for k, v in query.items())]
        return types.SimpleNamespace(deleted_count=old-len(self.docs))


class StudioTest(unittest.TestCase):
    def setUp(self):
        self.collection = Collection()
        database.db.game_studio_drafts = self.collection
        security.get_current_user.reset_mock()
        security.get_current_user.return_value = {"_id": "alice"}
        self.draft = studio.GameDraftInput(title="  Island Quest  ", description="A puzzle adventure on floating islands with thirty levels.", category="Puzzle", languages=["de", "en"], rights_confirmed=True)

    def test_draft_is_account_bound_and_cannot_be_changed_by_another_user(self):
        created = asyncio.run(studio.create_draft(None, self.draft))
        self.assertEqual(created["title"], "Island Quest")
        self.assertNotIn("owner_id", created)
        security.get_current_user.return_value = {"_id": "bob"}
        with self.assertRaises(HTTPException) as context:
            asyncio.run(studio.update_draft(created["id"], None, self.draft))
        self.assertEqual(context.exception.status_code, 404)
        with self.assertRaises(HTTPException):
            asyncio.run(studio.delete_draft(created["id"], None))
        self.assertEqual(len(self.collection.docs), 1)

    def test_unconfirmed_rights_and_duplicate_language_rejected(self):
        for changes in ({"rights_confirmed": False}, {"languages": ["de", "de"]}):
            with self.assertRaises(ValidationError):
                studio.GameDraftInput(**{**self.draft.model_dump(), **changes})

    def test_draft_never_enters_published_status(self):
        created = asyncio.run(studio.create_draft(None, self.draft))
        self.assertEqual(created["status"], "draft")
        self.collection.docs[0]["status"] = "published"
        with self.assertRaises(HTTPException):
            asyncio.run(studio.update_draft(created["id"], None, self.draft))


if __name__ == "__main__":
    unittest.main()
