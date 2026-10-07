"""Tests for fail-closed BidBlitz Games launch readiness."""
import asyncio
import types
import unittest
from unittest.mock import AsyncMock

from fastapi import HTTPException

from routes import games_launch_readiness as readiness


class Cursor:
    def __init__(self, rows):
        self.rows = [dict(row) for row in rows]
    async def to_list(self, limit):
        return self.rows[:limit]


class Collection:
    def __init__(self, rows=None):
        self.rows = [dict(row) for row in (rows or [])]
    def find(self, query, projection=None):
        allowed = set(query.get("code", {}).get("$in", []))
        rows = [
            row for row in self.rows
            if row.get("reviewed") is True and row.get("code") in allowed
        ]
        return Cursor(rows)


class LaunchReadinessTest(unittest.TestCase):
    def setUp(self):
        self.old_auth = readiness.get_current_user
        self.old_preflight = readiness.games_preflight
        self.old_device = readiness.PHYSICAL_DEVICE_ACCEPTED
        self.old_prod = readiness.PRODUCTION_APPROVED
        self.old_billing = readiness.BILLING_READY

        readiness.get_current_user = AsyncMock(return_value={"_id": "admin", "role": "admin"})

        async def preflight(_request):
            return {"ready": True, "scope": "games_non_monetary_preflight"}

        readiness.games_preflight = preflight
        readiness.db = types.SimpleNamespace(
            games_translation_reviews=Collection()
        )
        readiness.PHYSICAL_DEVICE_ACCEPTED = False
        readiness.PRODUCTION_APPROVED = False
        readiness.BILLING_READY = False

    def tearDown(self):
        readiness.get_current_user = self.old_auth
        readiness.games_preflight = self.old_preflight
        readiness.PHYSICAL_DEVICE_ACCEPTED = self.old_device
        readiness.PRODUCTION_APPROVED = self.old_prod
        readiness.BILLING_READY = self.old_billing

    def test_default_state_is_fail_closed_with_clear_blockers(self):
        result = asyncio.run(readiness.launch_readiness(None))
        self.assertFalse(result["non_monetary_launch_ready"])
        self.assertFalse(result["commercial_launch_ready"])
        self.assertIn("human_translation_review", result["blockers"])
        self.assertIn("physical_device_acceptance", result["blockers"])
        self.assertIn("production_approval", result["blockers"])
        self.assertIn("billing_provider", result["blockers"])
        self.assertTrue(result["integrity"]["ready"])
        self.assertFalse(result["integrity"]["public_trusted_leaderboards_enabled"])
        self.assertEqual(result["side_effects"], "none")

    def test_non_monetary_ready_can_be_true_while_commercial_stays_locked(self):
        localized = sorted(code for code in readiness.SUPPORTED_LANGUAGES if code != readiness.SOURCE_LANGUAGE)
        readiness.db.games_translation_reviews = Collection([
            {"code": code, "reviewed": True} for code in localized
        ])
        readiness.PHYSICAL_DEVICE_ACCEPTED = True
        readiness.PRODUCTION_APPROVED = True
        readiness.BILLING_READY = False

        result = asyncio.run(readiness.launch_readiness(None))
        self.assertTrue(result["translations"]["ready"])
        self.assertTrue(result["non_monetary_launch_ready"])
        self.assertFalse(result["commercial_launch_ready"])
        self.assertEqual(result["blockers"], ["billing_provider"])

    def test_commercial_ready_requires_every_gate(self):
        localized = sorted(code for code in readiness.SUPPORTED_LANGUAGES if code != readiness.SOURCE_LANGUAGE)
        readiness.db.games_translation_reviews = Collection([
            {"code": code, "reviewed": True} for code in localized
        ])
        readiness.PHYSICAL_DEVICE_ACCEPTED = True
        readiness.PRODUCTION_APPROVED = True
        readiness.BILLING_READY = True

        result = asyncio.run(readiness.launch_readiness(None))
        self.assertTrue(result["non_monetary_launch_ready"])
        self.assertTrue(result["commercial_launch_ready"])
        self.assertEqual(result["blockers"], [])

    def test_technical_preflight_failure_blocks_all_launches(self):
        async def preflight(_request):
            return {"ready": False, "scope": "games_non_monetary_preflight"}
        readiness.games_preflight = preflight
        readiness.PHYSICAL_DEVICE_ACCEPTED = True
        readiness.PRODUCTION_APPROVED = True
        readiness.BILLING_READY = True
        localized = sorted(code for code in readiness.SUPPORTED_LANGUAGES if code != readiness.SOURCE_LANGUAGE)
        readiness.db.games_translation_reviews = Collection([
            {"code": code, "reviewed": True} for code in localized
        ])

        result = asyncio.run(readiness.launch_readiness(None))
        self.assertFalse(result["non_monetary_launch_ready"])
        self.assertFalse(result["commercial_launch_ready"])
        self.assertIn("technical_preflight", result["blockers"])

    def test_regular_user_is_denied(self):
        readiness.get_current_user.return_value = {"_id": "user", "role": "user"}
        with self.assertRaises(HTTPException) as context:
            asyncio.run(readiness.launch_readiness(None))
        self.assertEqual(context.exception.status_code, 403)


if __name__ == "__main__":
    unittest.main()
