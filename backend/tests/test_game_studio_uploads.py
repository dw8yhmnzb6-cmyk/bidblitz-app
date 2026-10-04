"""Security tests for third-party HTML5 game upload quarantine."""
import stat
import tempfile
import unittest
import zipfile
from pathlib import Path

from fastapi import HTTPException

from routes import game_studio_uploads as uploads


def make_zip(entries, *, symlink=None):
    handle = tempfile.NamedTemporaryFile(suffix=".zip", delete=False)
    handle.close()
    path = Path(handle.name)
    with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for name, data in entries.items():
            archive.writestr(name, data)
        if symlink:
            info = zipfile.ZipInfo(symlink)
            info.create_system = 3
            info.external_attr = (stat.S_IFLNK | 0o777) << 16
            archive.writestr(info, "target")
    return path


class GameStudioUploadSecurityTest(unittest.TestCase):
    def tearDown(self):
        for path in getattr(self, "_paths", []):
            Path(path).unlink(missing_ok=True)

    def track(self, path):
        self._paths = getattr(self, "_paths", [])
        self._paths.append(path)
        return path

    def test_valid_html5_archive_is_accepted_without_execution(self):
        path = self.track(make_zip({
            "index.html": "<!doctype html><script src='game.js'></script>",
            "game.js": "console.log('game')",
            "styles/main.css": "body{margin:0}",
            "assets/logo.png": b"not-decoded-here",
        }))
        info = uploads._inspect_zip(path)
        self.assertEqual(info["entrypoint"], "index.html")
        self.assertEqual(info["file_count"], 4)
        self.assertGreater(info["unpacked_bytes"], 0)

    def test_zip_slip_and_backslash_paths_are_rejected(self):
        for name in ("../index.html", "/index.html", "folder\\index.html"):
            path = self.track(make_zip({name: "bad", "index.html": "ok"}))
            with self.assertRaises(HTTPException) as context:
                uploads._inspect_zip(path)
            self.assertEqual(context.exception.status_code, 400)

    def test_symlink_is_rejected(self):
        path = self.track(make_zip({"index.html": "ok"}, symlink="assets/link.js"))
        with self.assertRaises(HTTPException) as context:
            uploads._inspect_zip(path)
        self.assertEqual(context.exception.status_code, 400)

    def test_nested_archives_and_server_files_are_rejected(self):
        for name in ("payload.zip", "server.php", "run.sh", "service-worker.js"):
            path = self.track(make_zip({"index.html": "ok", name: "blocked"}))
            with self.assertRaises(HTTPException) as context:
                uploads._inspect_zip(path)
            self.assertEqual(context.exception.status_code, 400)

    def test_root_index_is_required(self):
        path = self.track(make_zip({"public/index.html": "nested", "game.js": "ok"}))
        with self.assertRaises(HTTPException) as context:
            uploads._inspect_zip(path)
        self.assertEqual(context.exception.status_code, 400)
        self.assertIn("index.html", str(context.exception.detail))

    def test_high_compression_ratio_is_rejected(self):
        path = self.track(make_zip({
            "index.html": "ok",
            "data.bin": b"A" * (2 * 1024 * 1024),
        }))
        with self.assertRaises(HTTPException) as context:
            uploads._inspect_zip(path)
        self.assertEqual(context.exception.status_code, 400)
        self.assertIn("Kompressionsverhältnis", str(context.exception.detail))

    def test_public_version_never_exposes_private_storage_path(self):
        public = uploads._public_version({
            "_id": "mongo",
            "owner_id": "alice",
            "storage_path": "/private/secret.zip",
            "preview_path": "/private/preview/v1",
            "id": "v1",
            "status": "quarantined",
        })
        self.assertEqual(public, {"id": "v1", "status": "quarantined"})

    def test_owner_storage_directory_does_not_embed_account_identifier(self):
        token = uploads._owner_dir("sensitive-user-id")
        self.assertNotIn("sensitive-user-id", token)
        self.assertEqual(len(token), 24)


if __name__ == "__main__":
    unittest.main()
