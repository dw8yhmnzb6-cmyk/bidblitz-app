"""Run with python -m unittest discover -s backend/tests -p test_game_studio.py."""
import asyncio
import importlib.util
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

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
fastapi.Query = lambda *args, **kwargs: None
fastapi.Header = lambda *args, **kwargs: None
database = types.ModuleType("core.database")
database.db = types.SimpleNamespace()
security = types.ModuleType("core.security")
security.get_current_user = AsyncMock(return_value={"_id": "alice"})
source = Path(__file__).resolve().parents[1] / "routes" / "game_studio.py"
spec = importlib.util.spec_from_file_location("game_studio_under_test", source)
studio = importlib.util.module_from_spec(spec)
with patch.dict(sys.modules, {"fastapi": fastapi, "core": types.ModuleType("core"),
                              "core.database": database, "core.security": security}):
    spec.loader.exec_module(studio)


def matches(doc, query):
    for key, value in query.items():
        if key == "$or":
            if not any(matches(doc, branch) for branch in value):
                return False
        elif isinstance(value, dict) and "$exists" in value:
            if (key in doc) != value["$exists"]:
                return False
        elif doc.get(key) != value:
            return False
    return True


class DuplicateKeyError(Exception):
    code = 11000


class Collection:
    def __init__(self):
        self.docs = []

    async def count_documents(self, query, **kwargs):
        return sum(matches(d, query) for d in self.docs)

    async def insert_one(self, doc):
        if "_id" in doc and any(d.get("_id") == doc["_id"] for d in self.docs):
            raise DuplicateKeyError()
        self.docs.append(dict(doc))

    async def find_one(self, query, projection=None):
        result = next((d for d in self.docs if matches(d, query)), None)
        return {k: v for k, v in result.items() if k not in {"_id", "owner_id"}} if result else None

    async def update_one(self, query, update):
        target = next((d for d in self.docs if matches(d, query)), None)
        if target:
            target.update(update["$set"])
            for key, value in update.get("$inc", {}).items():
                target[key] = target.get(key, 0) + value
        return types.SimpleNamespace(matched_count=int(target is not None))

    async def delete_one(self, query):
        old = len(self.docs)
        self.docs[:] = [d for d in self.docs if not matches(d, query)]
        return types.SimpleNamespace(deleted_count=old-len(self.docs))


class StudioTest(unittest.TestCase):
    def setUp(self):
        self.collection = Collection()
        database.db.game_studio_drafts = self.collection
        database.db.game_studio_draft_requests = Collection()
        database.db.game_studio_draft_slots = Collection()
        security.get_current_user.reset_mock()
        security.get_current_user.return_value = {"_id": "alice"}
        self.draft = studio.GameDraftInput(title="  Island Quest  ", description="A puzzle adventure on floating islands with thirty levels.", category="Puzzle", languages=["de", "en"], rights_confirmed=True)
        self.update = studio.GameDraftUpdate(**self.draft.model_dump(), revision=1)

    def test_draft_is_account_bound_and_cannot_be_changed_by_another_user(self):
        created = asyncio.run(studio.create_draft(None, self.draft, "create-alice-0001"))
        self.assertEqual(created["title"], "Island Quest")
        self.assertNotIn("owner_id", created)
        security.get_current_user.return_value = {"_id": "bob"}
        with self.assertRaises(HTTPException) as context:
            asyncio.run(studio.update_draft(created["id"], None, self.update))
        self.assertEqual(context.exception.status_code, 404)
        with self.assertRaises(HTTPException):
            asyncio.run(studio.delete_draft(created["id"], None, revision=1))
        self.assertEqual(len(self.collection.docs), 1)

    def test_unconfirmed_rights_and_duplicate_language_rejected(self):
        for changes in ({"rights_confirmed": False}, {"languages": ["de", "de"]},
                        {"languages": ["invalid"]}, {"title": " a "}):
            with self.assertRaises(ValidationError):
                studio.GameDraftInput(**{**self.draft.model_dump(), **changes})
        accepted = studio.GameDraftInput(**{**self.draft.model_dump(), "languages": ["zh-Hans", "zh-Hant"]})
        self.assertEqual(accepted.languages, ["zh-Hans", "zh-Hant"])

    def test_all_fifty_languages_and_fifty_one_options_are_accepted(self):
        codes = sorted(studio.SUPPORTED_LANGUAGES)
        self.assertEqual(len(codes), 51)
        self.assertEqual(len({code.split("-")[0] for code in codes}), 50)
        accepted = studio.GameDraftInput(**{**self.draft.model_dump(), "languages": codes})
        created = asyncio.run(studio.create_draft(None, accepted, "create-all-languages-0001"))
        self.assertEqual(created["languages"], codes)
        self.assertEqual(asyncio.run(studio.get_draft(created["id"], None))["languages"], codes)

    def test_language_boundaries_reject_empty_duplicates_and_unknown_codes(self):
        for languages in ([], ["et", "et"], ["zh"], ["zh-Hans", "unknown"],
                          sorted(studio.SUPPORTED_LANGUAGES) + ["de"]):
            with self.assertRaises(ValidationError):
                studio.GameDraftInput(**{**self.draft.model_dump(), "languages": languages})

    def test_draft_never_enters_published_status(self):
        created = asyncio.run(studio.create_draft(None, self.draft, "create-alice-0001"))
        self.assertEqual(created["status"], "draft")
        self.collection.docs[0]["status"] = "published"
        with self.assertRaises(HTTPException):
            asyncio.run(studio.update_draft(created["id"], None, self.update))

    def test_stale_edit_and_delete_preserve_newer_version(self):
        created = asyncio.run(studio.create_draft(None, self.draft, "create-alice-0001"))
        first = self.update.model_copy(update={"title": "New island title"})
        result = asyncio.run(studio.update_draft(created["id"], None, first))
        self.assertEqual(result["revision"], 2)
        for call in (studio.update_draft(created["id"], None, self.update),
                     studio.delete_draft(created["id"], None, revision=1)):
            with self.assertRaises(HTTPException) as context:
                asyncio.run(call)
            self.assertEqual(context.exception.status_code, 409)
        self.assertEqual(self.collection.docs[0]["title"], "New island title")
        self.assertEqual(self.collection.docs[0]["revision"], 2)

    def test_legacy_draft_is_upgraded_once_and_current_delete_works(self):
        created = asyncio.run(studio.create_draft(None, self.draft, "create-alice-0001"))
        del self.collection.docs[0]["revision"]
        self.assertEqual(asyncio.run(studio.get_draft(created["id"], None))["revision"], 0)
        legacy = self.update.model_copy(update={"revision": 0})
        asyncio.run(studio.update_draft(created["id"], None, legacy))
        with self.assertRaises(HTTPException):
            asyncio.run(studio.update_draft(created["id"], None, legacy))
        asyncio.run(studio.delete_draft(created["id"], None, revision=1))
        self.assertEqual(self.collection.docs, [])

    def test_update_requires_nonnegative_integer_revision(self):
        for revision in (None, -1, True, 1.5, "1"):
            with self.assertRaises(ValidationError):
                studio.GameDraftUpdate(**self.draft.model_dump(), revision=revision)


    def test_repeated_create_key_returns_the_same_draft(self):
        first = asyncio.run(studio.create_draft(None, self.draft, "same-create-key-0001"))
        second = asyncio.run(studio.create_draft(None, self.draft, "same-create-key-0001"))
        self.assertEqual(first["id"], second["id"])
        self.assertEqual(len(self.collection.docs), 1)
        self.assertEqual(len(database.db.game_studio_draft_slots.docs), 1)

    def test_quota_slots_stop_parallel_style_overflow(self):
        for index in range(100):
            created = asyncio.run(studio.create_draft(None, self.draft, f"quota-create-key-{index:04d}"))
            self.assertEqual(created["slot"], index)
        with self.assertRaises(HTTPException) as context:
            asyncio.run(studio.create_draft(None, self.draft, "quota-create-key-overflow"))
        self.assertEqual(context.exception.status_code, 409)
        self.assertEqual(len(self.collection.docs), 100)
        self.assertEqual(len(database.db.game_studio_draft_slots.docs), 100)

    def test_deleted_create_key_cannot_resurrect_draft(self):
        created = asyncio.run(studio.create_draft(None, self.draft, "deleted-create-key-0001"))
        asyncio.run(studio.delete_draft(created["id"], None, revision=1))
        with self.assertRaises(HTTPException) as context:
            asyncio.run(studio.create_draft(None, self.draft, "deleted-create-key-0001"))
        self.assertEqual(context.exception.status_code, 410)
        self.assertEqual(self.collection.docs, [])


if __name__ == "__main__":
    unittest.main()

