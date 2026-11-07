import contextlib
import importlib.util
import io
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

FILE = Path(__file__).resolve().parents[1] / "scripts/publish_ionos_box_admin_entry.py"
spec = importlib.util.spec_from_file_location("ionos_box_entry", FILE)
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

class ReleaseTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.front = self.root / "frontend"
        self.source = self.front / m.REL
        self.source.parent.mkdir(parents=True)
        self.before = ("const page = (\n" + m.ANCHOR + "    </div>\n);\n").encode()
        self.source.write_bytes(self.before)
        (self.front / "src/App.js").write_text('<Route path="/admin" element={<ProtectedRoute requireAdmin><AppAdminPanel /></ProtectedRoute>} />')
        self.live = self.front / "build"
        (self.live / "static/js").mkdir(parents=True)
        (self.live / "index.html").write_bytes(b"old index")
        (self.live / "static/js/old.hash.js").write_bytes(b"old bundle")
        self.settings = patch.multiple(m, FRONT=self.front, EXPECTED=m.digest(self.before))
        self.settings.start()
        self.addCleanup(self.settings.stop)

    def build(self, *args, **kwargs):
        p = Path(kwargs["env"]["BUILD_PATH"])
        (p / "static/js").mkdir(parents=True)
        (p / "index.html").write_bytes(b"new index")
        (p / "static/js/new.hash.js").write_bytes(b"BOX-Standortbewerbungen https://box.bidblitz.ae/admin/partner-applications")

    def run_release(self, build=None, public=None):
        with patch.object(m.os, "geteuid", return_value=0), patch.object(
                m.subprocess, "run", side_effect=build or self.build), patch.object(
                m, "public_index", side_effect=public or [b"old index", b"new index"]), contextlib.redirect_stdout(io.StringIO()):
            m.main(self.root)

    def test_wrong_active_route_stops_before_source_change(self):
        (self.front / "src/App.js").write_text('<Route path="/admin" element={<LegacyAdmin />} />')
        with self.assertRaises(RuntimeError):
            self.run_release()
        self.assertEqual(self.source.read_bytes(), self.before)

    def test_success_preserves_old_assets_and_backup(self):
        self.run_release()
        self.assertIn(m.MARKER.encode(), self.source.read_bytes())
        self.assertEqual((self.live / "index.html").read_bytes(), b"new index")
        self.assertEqual((self.live / "static/js/old.hash.js").read_bytes(), b"old bundle")
        backup = next(p for p in self.root.glob("box-admin-entry-*") if p.is_dir())
        self.assertEqual((backup / "AppAdminPanel.before.jsx").read_bytes(), self.before)
        self.assertEqual((backup / "old-build/index.html").read_bytes(), b"old index")

    def test_build_failure_restores_source_and_served_build(self):
        def fail(*args, **kwargs):
            raise subprocess.CalledProcessError(1, ["npm", "run", "build"])
        with self.assertRaises(subprocess.CalledProcessError):
            self.run_release(build=fail)
        self.assertEqual(self.source.read_bytes(), self.before)
        self.assertEqual((self.live / "index.html").read_bytes(), b"old index")

    def test_public_failure_rolls_back_source_and_bundle(self):
        with self.assertRaises(RuntimeError):
            self.run_release(public=[b"old index", b"unexpected index"])
        self.assertEqual(self.source.read_bytes(), self.before)
        self.assertEqual((self.live / "index.html").read_bytes(), b"old index")

    def test_wrong_source_stops_before_build(self):
        self.source.write_bytes(b"parallel change")
        with self.assertRaises(RuntimeError):
            self.run_release()
        self.assertEqual(self.source.read_bytes(), b"parallel change")
        self.assertEqual((self.live / "index.html").read_bytes(), b"old index")

    def test_wrong_public_baseline_stops_before_source_change(self):
        with self.assertRaises(RuntimeError):
            self.run_release(public=[b"different served app"])
        self.assertEqual(self.source.read_bytes(), self.before)

    def test_missing_box_in_bundle_stops_before_publication(self):
        def bad(*args, **kwargs):
            self.build(*args, **kwargs)
            (Path(kwargs["env"]["BUILD_PATH"]) / "static/js/new.hash.js").write_bytes(b"no box")
        with self.assertRaises(RuntimeError):
            self.run_release(build=bad)
        self.assertEqual(self.source.read_bytes(), self.before)
        self.assertEqual((self.live / "index.html").read_bytes(), b"old index")

if __name__ == "__main__":
    unittest.main()
