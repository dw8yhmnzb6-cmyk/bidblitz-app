"""Security tests for cookie-free third-party game preview delivery."""
import asyncio
import tempfile
import types
import unittest
from pathlib import Path
from unittest.mock import AsyncMock

from fastapi import HTTPException

from routes import game_preview as preview


class RequestStub:
    def __init__(self, host="", cookies=None):
        self.headers = {"host": host}
        self.cookies = cookies or {}


class TokenCollection:
    def __init__(self):
        self.docs = {}

    async def replace_one(self, query, doc, upsert=False):
        self.docs[query["_id"]] = dict(doc)
        return types.SimpleNamespace(matched_count=1, upserted_id=None)

    async def update_one(self, query, update):
        doc = self.docs.get(query.get("_id"))
        if not doc:
            return types.SimpleNamespace(modified_count=0)
        doc.update(update.get("$set", {}))
        return types.SimpleNamespace(modified_count=1)


class GamesPreviewSecurityTest(unittest.TestCase):
    def setUp(self):
        self.old_host = preview.PREVIEW_HOST
        self.old_base = preview.PREVIEW_BASE_URL
        self.old_ancestors = preview.FRAME_ANCESTORS
        self.old_get_current_user = preview.get_current_user
        preview.get_current_user = AsyncMock(return_value={"_id": "root1", "role": "super_admin"})

    def tearDown(self):
        preview.PREVIEW_HOST = self.old_host
        preview.PREVIEW_BASE_URL = self.old_base
        preview.FRAME_ANCESTORS = self.old_ancestors
        preview.get_current_user = self.old_get_current_user

    def test_super_admin_can_issue_admin_preview_actions(self):
        user = asyncio.run(preview._admin(None))
        self.assertEqual(user["role"], "super_admin")

    def test_preview_headers_sandbox_untrusted_code(self):
        headers = preview._preview_headers()
        csp = headers["Content-Security-Policy"]
        self.assertIn("sandbox allow-scripts", csp)
        self.assertNotIn("allow-same-origin", csp)
        self.assertIn("connect-src 'none'", csp)
        self.assertIn("worker-src 'none'", csp)
        self.assertIn("object-src 'none'", csp)
        self.assertEqual(headers["Referrer-Policy"], "no-referrer")
        self.assertEqual(headers["X-Content-Type-Options"], "nosniff")
        self.assertIn("payment=()", headers["Permissions-Policy"])

    def test_preview_host_is_mandatory_and_auth_cookies_are_rejected(self):
        preview.PREVIEW_HOST = "preview-games.example.test"
        preview._require_preview_host(RequestStub("preview-games.example.test"))
        with self.assertRaises(HTTPException) as wrong_host:
            preview._require_preview_host(RequestStub("games.example.test"))
        self.assertEqual(wrong_host.exception.status_code, 404)
        with self.assertRaises(HTTPException) as cookie:
            preview._require_preview_host(RequestStub(
                "preview-games.example.test",
                {"access_token": "must-not-be-here"},
            ))
        self.assertEqual(cookie.exception.status_code, 400)

    def test_preview_url_requires_matching_secure_host(self):
        preview.PREVIEW_HOST = "preview-games.example.test"
        preview.PREVIEW_BASE_URL = "https://preview-games.example.test"
        url = preview._configured_preview_url("a" * 43)
        self.assertEqual(url, "https://preview-games.example.test/game-preview/" + "a" * 43 + "/index.html")

        preview.PREVIEW_BASE_URL = "https://games.example.test"
        with self.assertRaises(HTTPException):
            preview._configured_preview_url("b" * 43)

        preview.PREVIEW_BASE_URL = "http://preview-games.example.test"
        with self.assertRaises(HTTPException):
            preview._configured_preview_url("c" * 43)

    def test_safe_asset_path_stays_inside_prepared_preview(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "index.html").write_text("ok")
            (root / "assets").mkdir()
            (root / "assets" / "game.js").write_text("ok")
            self.assertEqual(
                preview._safe_asset_path(root, "assets/game.js"),
                (root / "assets" / "game.js").resolve(),
            )
            for value in ("../secret", "/etc/passwd", "assets\\game.js", "a/../../b"):
                with self.assertRaises(HTTPException):
                    preview._safe_asset_path(root, value)

    def test_preview_token_hash_does_not_store_raw_token(self):
        token = "A" * 43
        hashed = preview._hash_token(token)
        self.assertNotEqual(hashed, token)
        self.assertEqual(len(hashed), 64)


    def test_preview_token_rotation_keeps_one_hashed_record_per_version(self):
        preview.PREVIEW_HOST = "preview-games.example.test"
        preview.PREVIEW_BASE_URL = "https://preview-games.example.test"
        collection = TokenCollection()
        old_db = preview.db
        preview.db = types.SimpleNamespace(game_studio_preview_tokens=collection)
        try:
            first = asyncio.run(preview._issue_preview_token("owner-1", "draft-1", "version-1"))
            second = asyncio.run(preview._issue_preview_token("owner-1", "draft-1", "version-1"))
        finally:
            preview.db = old_db
        self.assertEqual(len(collection.docs), 1)
        doc = collection.docs["owner-1:version-1"]
        self.assertEqual(doc["owner_id"], "owner-1")
        self.assertEqual(doc["version_id"], "version-1")
        self.assertEqual(len(doc["token_hash"]), 64)
        self.assertNotIn(doc["token_hash"], first["url"])
        self.assertNotEqual(first["url"], second["url"])


if __name__ == "__main__":
    unittest.main()
