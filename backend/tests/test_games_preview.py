"""Security tests for cookie-free third-party game preview delivery."""
import tempfile
import types
import unittest
from pathlib import Path

from fastapi import HTTPException

from routes import game_preview as preview


class RequestStub:
    def __init__(self, host="", cookies=None):
        self.headers = {"host": host}
        self.cookies = cookies or {}


class GamesPreviewSecurityTest(unittest.TestCase):
    def setUp(self):
        self.old_host = preview.PREVIEW_HOST
        self.old_base = preview.PREVIEW_BASE_URL
        self.old_ancestors = preview.FRAME_ANCESTORS

    def tearDown(self):
        preview.PREVIEW_HOST = self.old_host
        preview.PREVIEW_BASE_URL = self.old_base
        preview.FRAME_ANCESTORS = self.old_ancestors

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


if __name__ == "__main__":
    unittest.main()
