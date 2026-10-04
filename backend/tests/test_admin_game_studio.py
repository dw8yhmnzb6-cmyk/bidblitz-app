"""Tests for operator review of quarantined game submissions."""
import asyncio
import types
import unittest
import tempfile
import zipfile
from pathlib import Path
from unittest.mock import AsyncMock

from fastapi import HTTPException

from routes import admin_game_studio as review


class Collection:
    def __init__(self, docs=None):
        self.docs = [dict(item) for item in (docs or [])]

    async def find_one(self, query, projection=None):
        for doc in self.docs:
            if self._matches(doc, query):
                return dict(doc)
        return None

    async def update_one(self, query, update):
        for doc in self.docs:
            if self._matches(doc, query):
                doc.update(update.get("$set", {}))
                return types.SimpleNamespace(matched_count=1)
        return types.SimpleNamespace(matched_count=0)

    async def insert_one(self, doc):
        self.docs.append(dict(doc))
        return types.SimpleNamespace(inserted_id=doc.get("id"))

    @staticmethod
    def _matches(doc, query):
        for key, value in query.items():
            current = doc.get(key)
            if isinstance(value, dict):
                if "$ne" in value and current == value["$ne"]:
                    return False
                continue
            if current != value:
                return False
        return True


class AdminGameStudioReviewTest(unittest.TestCase):
    def setUp(self):
        self.version = {
            "id": "v1",
            "draft_id": "d1",
            "owner_id": "owner",
            "status": "quarantined",
            "validation_status": "archive_validated",
            "review_status": "submitted",
            "execution_status": "blocked_pending_isolated_preview",
            "storage_path": "/private/game.zip",
        }
        review.db = types.SimpleNamespace(
            game_studio_versions=Collection([self.version]),
            game_studio_review_events=Collection(),
        )
        review.get_current_user = AsyncMock(return_value={"_id": "admin1", "role": "admin"})

    def test_non_admin_cannot_review(self):
        review.get_current_user.return_value = {"_id": "user1", "role": "user"}
        with self.assertRaises(HTTPException) as context:
            asyncio.run(review.review_version("v1", review.VersionReviewInput(action="approve_archive"), None))
        self.assertEqual(context.exception.status_code, 403)

    def test_request_changes_requires_explanation(self):
        with self.assertRaises(HTTPException) as context:
            asyncio.run(review.review_version(
                "v1",
                review.VersionReviewInput(action="request_changes", note="bad"),
                None,
            ))
        self.assertEqual(context.exception.status_code, 400)

    def test_archive_approval_never_enables_execution_or_exposes_path(self):
        result = asyncio.run(review.review_version(
            "v1",
            review.VersionReviewInput(action="approve_archive", note="Archive checks completed."),
            None,
        ))
        self.assertEqual(result["review_status"], "archive_approved")
        self.assertEqual(result["execution_status"], "blocked_pending_isolated_preview")
        self.assertNotIn("storage_path", result)
        self.assertNotIn("owner_id", result)
        events = review.db.game_studio_review_events.docs
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]["action"], "approve_archive")
        self.assertEqual(events[0]["reviewer_id"], "admin1")

    def test_same_completed_review_is_idempotent(self):
        first = asyncio.run(review.review_version(
            "v1",
            review.VersionReviewInput(action="reject", note="Contains unsupported content."),
            None,
        ))
        second = asyncio.run(review.review_version(
            "v1",
            review.VersionReviewInput(action="reject", note="Contains unsupported content."),
            None,
        ))
        self.assertEqual(first["review_status"], "rejected")
        self.assertEqual(second["review_status"], "rejected")
        self.assertEqual(len(review.db.game_studio_review_events.docs), 1)

    def test_conflicting_second_review_is_rejected(self):
        asyncio.run(review.review_version(
            "v1",
            review.VersionReviewInput(action="approve_archive"),
            None,
        ))
        with self.assertRaises(HTTPException) as context:
            asyncio.run(review.review_version(
                "v1",
                review.VersionReviewInput(action="reject", note="Changed decision."),
                None,
            ))
        self.assertEqual(context.exception.status_code, 409)


    def test_preview_approval_requires_prepared_preview(self):
        asyncio.run(review.review_version(
            "v1",
            review.VersionReviewInput(action="approve_archive"),
            None,
        ))
        with self.assertRaises(HTTPException) as context:
            asyncio.run(review.review_version(
                "v1",
                review.VersionReviewInput(action="approve_preview"),
                None,
            ))
        self.assertEqual(context.exception.status_code, 409)

        review.db.game_studio_versions.docs[0]["preview_status"] = "prepared"
        result = asyncio.run(review.review_version(
            "v1",
            review.VersionReviewInput(action="approve_preview"),
            None,
        ))
        self.assertEqual(result["review_status"], "preview_approved")
        self.assertEqual(result["execution_status"], "isolated_preview_only")
        self.assertEqual(review.db.game_studio_review_events.docs[-1]["action"], "approve_preview")


    def test_private_preview_extracts_validated_files_only(self):
        with tempfile.TemporaryDirectory() as tmp:
            archive = Path(tmp) / "game.zip"
            target = Path(tmp) / "preview"
            with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED) as bundle:
                bundle.writestr("index.html", "<!doctype html><script src='game.js'></script>")
                bundle.writestr("game.js", "console.log('ok')")
                bundle.writestr("assets/style.css", "body{margin:0}")
            result = review._safe_extract_preview(archive, target)
            self.assertEqual(result["entrypoint"], "index.html")
            self.assertEqual(result["extracted_files"], 3)
            self.assertTrue((target / "index.html").is_file())
            self.assertTrue((target / "assets" / "style.css").is_file())

    def test_private_server_paths_are_never_returned(self):
        public = review._public_version({
            "id": "v1",
            "owner_id": "owner",
            "storage_path": "/private/archive.zip",
            "preview_path": "/private/preview/v1",
            "create_key": "secret",
            "review_status": "archive_approved",
        })
        self.assertEqual(public, {"id": "v1", "review_status": "archive_approved"})


if __name__ == "__main__":
    unittest.main()
