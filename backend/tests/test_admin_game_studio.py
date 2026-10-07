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
from routes import games_finance_sandbox as finance


class Cursor:
    def __init__(self, docs):
        self.docs = [dict(item) for item in docs]

    def sort(self, key, direction):
        self.docs.sort(key=lambda item: item.get(key) or "", reverse=direction < 0)
        return self

    def limit(self, limit):
        self.docs = self.docs[:limit]
        return self

    async def to_list(self, limit):
        return self.docs[:limit]


class Collection:
    def __init__(self, docs=None):
        self.docs = [dict(item) for item in (docs or [])]

    async def find_one(self, query, projection=None):
        for doc in self.docs:
            if self._matches(doc, query):
                return dict(doc)
        return None

    async def update_one(self, query, update, upsert=False):
        for doc in self.docs:
            if self._matches(doc, query):
                doc.update(update.get("$set", {}))
                return types.SimpleNamespace(matched_count=1)
        if upsert:
            doc = {
                key: value for key, value in query.items()
                if not isinstance(value, dict)
            }
            doc.update(update.get("$set", {}))
            self.docs.append(doc)
            return types.SimpleNamespace(matched_count=0, upserted_id=doc.get("_id") or doc.get("code"))
        return types.SimpleNamespace(matched_count=0)

    async def find_one_and_update(self, query, update, projection=None, return_document=None):
        for doc in self.docs:
            if doc.get("id") != query.get("id") or doc.get("kind") != query.get("kind") or doc.get("status") != query.get("status"):
                continue
            amount = int(update.get("$inc", {}).get("refunded_eur_cents", 0))
            current = int(doc.get("refunded_eur_cents") or 0)
            gross = int(doc.get("gross_eur_cents") or 0)
            if current + amount > gross:
                continue
            before = dict(doc)
            doc["refunded_eur_cents"] = current + amount
            doc.update(update.get("$set", {}))
            return before
        return None

    async def delete_one(self, query):
        for index, doc in enumerate(self.docs):
            if self._matches(doc, query):
                self.docs.pop(index)
                return types.SimpleNamespace(deleted_count=1)
        return types.SimpleNamespace(deleted_count=0)

    def find(self, query=None, projection=None):
        query = query or {}
        rows = [doc for doc in self.docs if self._matches(doc, query)]
        if projection:
            rows = [
                {
                    key: value for key, value in doc.items()
                    if projection.get(key, 1) and key != "_id"
                }
                for doc in rows
            ]
        return Cursor(rows)

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
                if "$in" in value and current not in value["$in"]:
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
            games_translation_reviews=Collection(),
            games_translation_review_events=Collection(),
        )
        review.get_current_user = AsyncMock(return_value={"_id": "admin1", "role": "admin"})

    def test_super_admin_can_review(self):
        review.get_current_user.return_value = {"_id": "root1", "role": "super_admin"}
        user = asyncio.run(review._admin(None))
        self.assertEqual(user["role"], "super_admin")

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

    def test_conflicting_second_review_is_rejected_after_preview_approval(self):
        asyncio.run(review.review_version(
            "v1",
            review.VersionReviewInput(action="approve_archive"),
            None,
        ))
        review.db.game_studio_versions.docs[0]["preview_status"] = "prepared"
        asyncio.run(review.review_version(
            "v1",
            review.VersionReviewInput(action="approve_preview"),
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

    def test_translation_review_is_explicit_private_and_audited(self):
        result = asyncio.run(review.set_translation_review(
            "de",
            review.TranslationReviewInput(reviewed=True, note="Native review completed."),
            None,
        ))
        self.assertEqual(result["code"], "de")
        self.assertTrue(result["reviewed"])
        self.assertNotIn("reviewer_id", result)

        stored = review.db.games_translation_reviews.docs[0]
        self.assertEqual(stored["reviewer_id"], "admin1")
        events = review.db.games_translation_review_events.docs
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]["code"], "de")
        self.assertTrue(events[0]["reviewed"])

        summary = asyncio.run(review.translation_reviews(None))
        self.assertEqual(summary["localized_count"], len(review.SUPPORTED_LANGUAGES) - 1)
        self.assertEqual(summary["human_reviewed_count"], 1)
        self.assertIn("de", summary["human_reviewed_codes"])
        self.assertNotIn("en", [item["code"] for item in summary["items"]])

    def test_translation_review_can_be_revoked_and_source_is_never_counted(self):
        asyncio.run(review.set_translation_review(
            "sq",
            review.TranslationReviewInput(reviewed=True),
            None,
        ))
        revoked = asyncio.run(review.set_translation_review(
            "sq",
            review.TranslationReviewInput(reviewed=False, note="Needs another pass."),
            None,
        ))
        self.assertFalse(revoked["reviewed"])
        self.assertIsNone(revoked["reviewed_at"])
        self.assertEqual(len(review.db.games_translation_review_events.docs), 2)

        with self.assertRaises(HTTPException) as context:
            asyncio.run(review.set_translation_review(
                "en",
                review.TranslationReviewInput(reviewed=True),
                None,
            ))
        self.assertEqual(context.exception.status_code, 400)


class GamesFinanceSandboxTest(unittest.TestCase):
    def setUp(self):
        self.previous_enabled = finance.FINANCE_SANDBOX_ENABLED
        self.previous_share = finance.DEVELOPER_SHARE_BPS
        finance.FINANCE_SANDBOX_ENABLED = False
        finance.DEVELOPER_SHARE_BPS = 2000
        finance.db = types.SimpleNamespace(
            games_catalog=Collection([{
                "id": "community-puzzle",
                "status": "published",
                "owner_id": "developer-1",
                "title": "Community Puzzle",
            }]),
            games_finance_sandbox_transactions=Collection(),
        )
        finance.get_current_user = AsyncMock(return_value={"_id": "admin1", "role": "admin"})

    def tearDown(self):
        finance.FINANCE_SANDBOX_ENABLED = self.previous_enabled
        finance.DEVELOPER_SHARE_BPS = self.previous_share

    def test_finance_sandbox_fails_closed_by_default(self):
        payload = finance.SandboxPurchaseInput(
            game_id="community-puzzle",
            gross_eur_cents=1000,
            idempotency_key="purchase-001",
        )
        with self.assertRaises(HTTPException) as context:
            asyncio.run(finance.create_sandbox_purchase(payload, None))
        self.assertEqual(context.exception.status_code, 503)
        self.assertEqual(finance.db.games_finance_sandbox_transactions.docs, [])

    def test_sandbox_models_purchase_refund_and_share_without_money_execution(self):
        finance.FINANCE_SANDBOX_ENABLED = True
        purchase_input = finance.SandboxPurchaseInput(
            game_id="community-puzzle",
            gross_eur_cents=1000,
            idempotency_key="purchase-001",
        )
        purchase = asyncio.run(finance.create_sandbox_purchase(purchase_input, None))
        repeated = asyncio.run(finance.create_sandbox_purchase(purchase_input, None))

        self.assertEqual(repeated["id"], purchase["id"])
        self.assertEqual(len(finance.db.games_finance_sandbox_transactions.docs), 1)
        self.assertEqual(purchase["developer_eur_cents"], 200)
        self.assertEqual(purchase["platform_eur_cents"], 800)
        self.assertFalse(purchase["monetary_execution"])

        refund = asyncio.run(finance.create_sandbox_refund(
            purchase["id"],
            finance.SandboxRefundInput(
                amount_eur_cents=500,
                reason="Sandbox partial refund",
                idempotency_key="refund-001",
            ),
            None,
        ))
        self.assertEqual(refund["developer_eur_cents"], 100)
        self.assertEqual(refund["platform_eur_cents"], 400)
        self.assertFalse(refund["monetary_execution"])

        summary = asyncio.run(finance.admin_finance_sandbox_summary(None))
        self.assertEqual(summary["purchase_count"], 1)
        self.assertEqual(summary["refund_count"], 1)
        self.assertEqual(summary["net_gross_eur_cents"], 500)
        self.assertEqual(summary["net_developer_eur_cents"], 100)
        self.assertEqual(summary["net_platform_eur_cents"], 400)
        self.assertFalse(summary["monetary_execution"])
        self.assertFalse(summary["payout_execution"])

    def test_sandbox_refund_cannot_exceed_remaining_amount(self):
        finance.FINANCE_SANDBOX_ENABLED = True
        purchase = asyncio.run(finance.create_sandbox_purchase(
            finance.SandboxPurchaseInput(
                game_id="community-puzzle",
                gross_eur_cents=1000,
                idempotency_key="purchase-002",
            ),
            None,
        ))
        with self.assertRaises(HTTPException) as context:
            asyncio.run(finance.create_sandbox_refund(
                purchase["id"],
                finance.SandboxRefundInput(
                    amount_eur_cents=1001,
                    reason="Too large refund",
                    idempotency_key="refund-002",
                ),
                None,
            ))
        self.assertEqual(context.exception.status_code, 409)


if __name__ == "__main__":
    unittest.main()
