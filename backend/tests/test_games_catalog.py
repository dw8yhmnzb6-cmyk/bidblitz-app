"""Tests for publishing reviewed third-party games into the public catalog."""
import asyncio
import json
import tempfile
import types
import unittest
from pathlib import Path
from unittest.mock import AsyncMock

from fastapi import HTTPException

from routes import games_catalog as catalog


class Cursor:
    def __init__(self, rows):
        self.rows = [dict(row) for row in rows]
    def sort(self, *_args, **_kwargs):
        return self
    def limit(self, n):
        self.rows = self.rows[:n]
        return self
    async def to_list(self, n):
        return self.rows[:n]


def match(doc, query):
    for key, value in query.items():
        current = doc.get(key)
        if isinstance(value, dict):
            if "$ne" in value and current == value["$ne"]:
                return False
            if "$in" in value and current not in value["$in"]:
                return False
            continue
        if current != value:
            return False
    return True


class DuplicateKeyError(Exception):
    code = 11000


class Collection:
    def __init__(self, docs=None):
        self.docs = [dict(row) for row in (docs or [])]

    async def find_one(self, query, projection=None):
        row = next((doc for doc in self.docs if match(doc, query)), None)
        return dict(row) if row else None

    def find(self, query, projection=None):
        return Cursor([doc for doc in self.docs if match(doc, query)])

    async def count_documents(self, query):
        return sum(1 for doc in self.docs if match(doc, query))

    async def insert_one(self, doc):
        if "_id" in doc and any(row.get("_id") == doc["_id"] for row in self.docs):
            raise DuplicateKeyError("duplicate _id")
        self.docs.append(dict(doc))
        return types.SimpleNamespace(inserted_id=doc.get("_id") or doc.get("id"))

    async def delete_one(self, query):
        for index, row in enumerate(self.docs):
            if match(row, query):
                self.docs.pop(index)
                return types.SimpleNamespace(deleted_count=1)
        return types.SimpleNamespace(deleted_count=0)

    async def update_one(self, query, update, upsert=False):
        row = next((doc for doc in self.docs if match(doc, query)), None)
        if row is None and upsert:
            row = dict(query)
            self.docs.append(row)
        if row is None:
            return types.SimpleNamespace(matched_count=0)
        for key, value in update.get("$set", {}).items():
            row[key] = value
        for key, value in update.get("$setOnInsert", {}).items():
            row.setdefault(key, value)
        return types.SimpleNamespace(matched_count=1)


class RequestStub:
    def __init__(self, host="", cookies=None):
        self.headers = {"host": host}
        self.cookies = cookies or {}


class GamesCatalogTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.old_root = catalog.PREVIEW_ROOT
        self.old_release_root = catalog.RELEASE_ROOT
        self.old_host = catalog.PUBLIC_HOST
        self.old_base = catalog.PUBLIC_BASE_URL
        self.old_preview_host = catalog.PREVIEW_HOST
        self.old_preview_base = catalog.PREVIEW_BASE_URL
        self.old_upload_root = catalog.UPLOAD_ROOT
        self.old_billing_ready = catalog.BILLING_READY
        root = Path(self.tmp.name)
        catalog.PREVIEW_ROOT = root
        catalog.RELEASE_ROOT = root / "releases"
        catalog.UPLOAD_ROOT = root / "quarantine"
        catalog.PUBLIC_HOST = "play.games.example.test"
        catalog.PUBLIC_BASE_URL = "https://play.games.example.test"
        catalog.PREVIEW_HOST = "preview.games.example.test"
        catalog.PREVIEW_BASE_URL = "https://preview.games.example.test"
        catalog.BILLING_READY = False

        preview = root / "version-v1"
        preview.mkdir()
        (preview / "index.html").write_text("<!doctype html><title>Game</title>")

        draft = {
            "id": "draft-1",
            "owner_id": "developer-1",
            "status": "draft",
            "title": "Island Quest",
            "description": "A polished puzzle adventure with many levels and islands.",
            "category": "Puzzle",
            "languages": ["en", "de"],
        }
        v1 = {
            "id": "v1",
            "draft_id": "draft-1",
            "owner_id": "developer-1",
            "status": "quarantined",
            "review_status": "preview_approved",
            "preview_status": "prepared",
            "execution_status": "isolated_preview_only",
            "preview_path": str(preview),
            "version_number": 1,
        }
        self.db = types.SimpleNamespace(
            game_studio_versions=Collection([v1]),
            game_studio_drafts=Collection([draft]),
            games_catalog=Collection(),
            game_studio_publication_events=Collection(),
            games_publication_locks=Collection(),
        )
        catalog.db = self.db
        catalog.get_current_user = AsyncMock(return_value={"_id": "admin-1", "role": "admin"})
        catalog.assert_publication_entitlement = AsyncMock(return_value={"plan": "starter", "status": "active"})
        catalog.reserve_publication_slot = AsyncMock(return_value=True)
        catalog.release_publication_slot = AsyncMock(return_value=None)

    def tearDown(self):
        catalog.PREVIEW_ROOT = self.old_root
        catalog.RELEASE_ROOT = self.old_release_root
        catalog.PUBLIC_HOST = self.old_host
        catalog.PUBLIC_BASE_URL = self.old_base
        catalog.PREVIEW_HOST = self.old_preview_host
        catalog.PREVIEW_BASE_URL = self.old_preview_base
        catalog.UPLOAD_ROOT = self.old_upload_root
        catalog.BILLING_READY = self.old_billing_ready
        self.tmp.cleanup()

    def test_diagnostics_reports_operational_counts_without_private_records(self):
        result = asyncio.run(catalog.games_diagnostics(None))
        self.assertEqual(result["status"], "ok")
        self.assertTrue(result["preflight_ready"])
        self.assertTrue(result["billing_fail_closed"])
        self.assertEqual(result["counts"]["drafts"], 1)
        self.assertEqual(result["counts"]["versions"], 1)
        self.assertEqual(result["counts"]["preview_approved"], 1)
        self.assertEqual(result["counts"]["published"], 0)
        self.assertEqual(result["counts"]["publication_locks"], 0)
        self.assertNotIn("owner_id", result)
        self.assertNotIn("release_path", result)
        self.assertNotIn("preview_path", result)

    def test_preflight_reports_safe_non_monetary_configuration_without_private_paths(self):
        result = asyncio.run(catalog.games_preflight(None))
        self.assertTrue(result["ready"])
        self.assertEqual(result["scope"], "games_non_monetary_preflight")
        self.assertEqual(result["side_effects"], "none")
        self.assertTrue(result["checks"]["origins_isolated"])
        self.assertTrue(result["checks"]["storage_roots_distinct"])
        self.assertTrue(result["billing"]["fail_closed"])
        self.assertFalse(result["billing"]["enabled"])
        self.assertEqual(result["public_origin"]["host"], "play.games.example.test")
        self.assertEqual(result["preview_origin"]["host"], "preview.games.example.test")
        serialized = json.dumps(result)
        self.assertNotIn(str(Path(self.tmp.name)), serialized)
        self.assertNotIn("storage_path", serialized)
        self.assertNotIn("release_path", serialized)

    def test_preflight_fails_when_public_and_preview_origins_are_not_isolated(self):
        catalog.PREVIEW_HOST = catalog.PUBLIC_HOST
        catalog.PREVIEW_BASE_URL = catalog.PUBLIC_BASE_URL
        result = asyncio.run(catalog.games_preflight(None))
        self.assertFalse(result["ready"])
        self.assertFalse(result["checks"]["origins_isolated"])

    def test_preflight_fails_closed_when_games_billing_is_enabled(self):
        catalog.BILLING_READY = True
        result = asyncio.run(catalog.games_preflight(None))
        self.assertFalse(result["ready"])
        self.assertTrue(result["billing"]["enabled"])
        self.assertFalse(result["checks"]["billing_fail_closed"])

    def test_super_admin_can_read_games_preflight(self):
        catalog.get_current_user.return_value = {"_id": "root-1", "role": "super_admin"}
        result = asyncio.run(catalog.games_preflight(None))
        self.assertEqual(result["scope"], "games_non_monetary_preflight")

    def test_non_admin_cannot_read_games_preflight(self):
        catalog.get_current_user.return_value = {"_id": "user-1", "role": "user"}
        with self.assertRaises(HTTPException) as context:
            asyncio.run(catalog.games_preflight(None))
        self.assertEqual(context.exception.status_code, 403)

    def test_slug_and_public_url_are_stable_and_safe(self):
        slug = catalog._slugify("Island Quest! 2027", "draft-1")
        self.assertRegex(slug, r"^island-quest-2027-[a-f0-9]{10}$")
        self.assertEqual(
            catalog._configured_public_url(slug),
            f"https://play.games.example.test/game/{slug}/index.html",
        )

    def test_publish_creates_catalog_and_marks_version_active(self):
        result = asyncio.run(catalog.publish_version("v1", None))
        self.assertEqual(result["id"], "draft-1")
        self.assertEqual(result["title"], "Island Quest")
        self.assertEqual(result["active_version_id"], "v1")
        self.assertTrue(result["public_url"].startswith("https://play.games.example.test/game/"))
        self.assertNotIn("owner_id", result)
        self.assertNotIn("preview_path", result)
        saved = self.db.games_catalog.docs[0]
        self.assertEqual(saved["status"], "published")
        version = self.db.game_studio_versions.docs[0]
        self.assertEqual(version["publication_status"], "published")
        self.assertEqual(self.db.game_studio_publication_events.docs[0]["action"], "publish")
        self.assertEqual(self.db.games_publication_locks.docs, [])


    def test_repeat_publish_of_active_version_is_idempotent(self):
        first = asyncio.run(catalog.publish_version("v1", None))
        second = asyncio.run(catalog.publish_version("v1", None))
        self.assertEqual(second["active_version_id"], first["active_version_id"])
        self.assertEqual(len(self.db.game_studio_publication_events.docs), 1)
        self.assertEqual(catalog.reserve_publication_slot.await_count, 1)
        self.assertEqual(self.db.games_publication_locks.docs, [])


    def test_publication_lock_blocks_overlapping_admin_action(self):
        token = asyncio.run(catalog._acquire_publication_lock("draft-1"))
        with self.assertRaises(HTTPException) as context:
            asyncio.run(catalog._acquire_publication_lock("draft-1"))
        self.assertEqual(context.exception.status_code, 409)
        self.assertTrue(asyncio.run(catalog._release_publication_lock("draft-1", token)))
        replacement = asyncio.run(catalog._acquire_publication_lock("draft-1"))
        self.assertNotEqual(replacement, token)
        self.assertTrue(asyncio.run(catalog._release_publication_lock("draft-1", replacement)))


    def test_published_release_is_frozen_separately_from_preview(self):
        asyncio.run(catalog.publish_version("v1", None))
        version = self.db.game_studio_versions.docs[0]
        release = Path(version["release_path"])
        self.assertTrue((release / "index.html").is_file())
        self.assertEqual(version["release_status"], "frozen")
        original = (release / "index.html").read_text()

        preview = Path(version["preview_path"])
        (preview / "index.html").chmod(0o600)
        (preview / "index.html").write_text("<!doctype html><title>Changed preview</title>")
        self.assertEqual((release / "index.html").read_text(), original)
        self.assertNotEqual((preview / "index.html").read_text(), original)


    def test_publish_rejects_non_preview_approved_version(self):
        self.db.game_studio_versions.docs[0]["review_status"] = "archive_approved"
        with self.assertRaises(HTTPException) as context:
            asyncio.run(catalog.publish_version("v1", None))
        self.assertEqual(context.exception.status_code, 409)

    def test_rollback_switches_active_version_and_keeps_slug(self):
        first = asyncio.run(catalog.publish_version("v1", None))
        root = Path(self.tmp.name)
        v2_dir = root / "version-v2"
        v2_dir.mkdir()
        (v2_dir / "index.html").write_text("<!doctype html><title>V2</title>")
        self.db.game_studio_versions.docs.append({
            "id": "v2", "draft_id": "draft-1", "owner_id": "developer-1",
            "status": "quarantined", "review_status": "preview_approved",
            "preview_status": "prepared", "execution_status": "isolated_preview_only",
            "preview_path": str(v2_dir), "version_number": 2,
        })
        second = asyncio.run(catalog.publish_version("v2", None))
        self.assertEqual(second["slug"], first["slug"])
        self.assertEqual(second["active_version_id"], "v2")
        rolled = asyncio.run(catalog.rollback_game("draft-1", "v1", None))
        self.assertEqual(rolled["slug"], first["slug"])
        self.assertEqual(rolled["active_version_id"], "v1")
        versions = {row["id"]: row for row in self.db.game_studio_versions.docs}
        self.assertEqual(versions["v1"]["publication_status"], "published")
        self.assertEqual(versions["v2"]["publication_status"], "inactive")
        self.assertEqual(self.db.game_studio_publication_events.docs[-1]["action"], "rollback")

    def test_unpublish_removes_game_from_public_catalog(self):
        asyncio.run(catalog.publish_version("v1", None))
        result = asyncio.run(catalog.unpublish_game("draft-1", None))
        self.assertTrue(result["unpublished"])
        public = asyncio.run(catalog.public_catalog())
        self.assertEqual(public["games"], [])
        self.assertEqual(self.db.game_studio_versions.docs[0]["publication_status"], "inactive")

    def test_non_admin_cannot_publish(self):
        catalog.get_current_user.return_value = {"_id": "user-1", "role": "user"}
        with self.assertRaises(HTTPException) as context:
            asyncio.run(catalog.publish_version("v1", None))
        self.assertEqual(context.exception.status_code, 403)

    def test_public_host_rejects_wrong_host_and_auth_cookies(self):
        catalog._require_public_host(RequestStub("play.games.example.test"))
        with self.assertRaises(HTTPException) as host_error:
            catalog._require_public_host(RequestStub("games.example.test"))
        self.assertEqual(host_error.exception.status_code, 404)
        with self.assertRaises(HTTPException) as cookie_error:
            catalog._require_public_host(RequestStub(
                "play.games.example.test",
                {"access_token": "must-never-arrive"},
            ))
        self.assertEqual(cookie_error.exception.status_code, 400)

    def test_public_headers_keep_third_party_code_sandboxed(self):
        headers = catalog._public_headers()
        csp = headers["Content-Security-Policy"]
        self.assertIn("sandbox allow-scripts", csp)
        self.assertNotIn("allow-same-origin", csp)
        self.assertIn("connect-src 'none'", csp)
        self.assertIn("payment=()", headers["Permissions-Policy"])


if __name__ == "__main__":
    unittest.main()
