"""Tests for server-replayed Blitz Runner integrity verification."""
import asyncio
import json
import types
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import AsyncMock

from fastapi import HTTPException

from routes import games_integrity as integrity


def matches(doc, query):
    for key, value in query.items():
        current = doc.get(key)
        if isinstance(value, dict) and "$gt" in value:
            if current is None or not current > value["$gt"]:
                return False
            continue
        if current != value:
            return False
    return True


class Collection:
    def __init__(self, docs=None):
        self.docs = [dict(row) for row in (docs or [])]

    async def find_one(self, query, projection=None):
        row = next((doc for doc in self.docs if matches(doc, query)), None)
        return dict(row) if row else None

    async def insert_one(self, doc):
        self.docs.append(dict(doc))
        return types.SimpleNamespace(inserted_id=doc.get("_id"))

    async def update_one(self, query, update, upsert=False):
        row = next((doc for doc in self.docs if matches(doc, query)), None)
        if row is None and upsert:
            row = dict(query)
            self.docs.append(row)
        if row is None:
            return types.SimpleNamespace(matched_count=0)

        for key, value in update.get("$setOnInsert", {}).items():
            if key not in row:
                row[key] = value.copy() if isinstance(value, list) else value

        for key, value in update.get("$set", {}).items():
            row[key] = value

        for key, value in update.get("$max", {}).items():
            if "." in key:
                field, index = key.split(".", 1)
                index = int(index)
                row.setdefault(field, [])
                while len(row[field]) <= index:
                    row[field].append(0)
                row[field][index] = max(int(row[field][index]), int(value))
            else:
                row[key] = max(int(row.get(key) or 0), int(value))

        return types.SimpleNamespace(matched_count=1)


class GamesIntegrityTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        vector_path = Path(__file__).resolve().parents[1] / "data" / "runner_integrity_vectors.json"
        cls.vectors = json.loads(vector_path.read_text())

    def setUp(self):
        self.old_db = integrity.db
        self.old_auth = integrity.get_current_user
        integrity.get_current_user = AsyncMock(return_value={"_id": "alice", "role": "user"})

        self.sessions = Collection()
        self.progress = Collection([
            {"owner_id": "alice", "unlocked": 3},
            {"owner_id": "bob", "unlocked": 1},
        ])
        self.verified = Collection()
        integrity.db = types.SimpleNamespace(
            games_integrity_sessions=self.sessions,
            games_runner_progress=self.progress,
            games_runner_verified_progress=self.verified,
        )

    def tearDown(self):
        integrity.db = self.old_db
        integrity.get_current_user = self.old_auth

    def add_session(self, *, owner="alice", level=1, seed=123456, session_id=None, expires=None):
        session_id = session_id or ("a" * 32)
        self.sessions.docs.append({
            "_id": session_id,
            "owner_id": owner,
            "game_id": "runner",
            "level": level,
            "seed": seed,
            "used": False,
            "created_at": datetime.now(timezone.utc),
            "expires_at": expires or (datetime.now(timezone.utc) + timedelta(minutes=10)),
        })
        return session_id

    def test_backend_replay_matches_shared_browser_vectors(self):
        for vector in self.vectors:
            result = integrity.replay_runner(
                vector["level"],
                vector["seed"],
                vector["actions"],
            )
            self.assertEqual(result["status"], "won")
            self.assertEqual(result["score"], vector["score"])
            self.assertEqual(result["shards"], vector["shards"])
            self.assertEqual(result["stars"], vector["stars"])
            self.assertEqual(result["turns"], len(vector["actions"]))

    def test_session_creation_respects_account_unlocks(self):
        created = asyncio.run(
            integrity.create_runner_integrity_session(
                integrity.RunnerSessionInput(level=3),
                None,
            )
        )
        self.assertEqual(created["level"], 3)
        self.assertEqual(created["game_id"], "runner")
        self.assertEqual(created["score_verification"], "server_replay_required")
        self.assertEqual(len(created["session_id"]), 32)
        self.assertGreater(created["seed"], 0)

        with self.assertRaises(HTTPException) as context:
            asyncio.run(
                integrity.create_runner_integrity_session(
                    integrity.RunnerSessionInput(level=4),
                    None,
                )
            )
        self.assertEqual(context.exception.status_code, 409)

    def test_verified_win_consumes_session_once_and_updates_progress(self):
        vector = self.vectors[0]
        session_id = self.add_session(level=vector["level"], seed=vector["seed"])
        body = integrity.RunnerVerifyInput(
            session_id=session_id,
            actions=vector["actions"],
        )
        result = asyncio.run(integrity.verify_runner_integrity(body, None))

        self.assertTrue(result["verified"])
        self.assertEqual(result["score"], vector["score"])
        self.assertEqual(result["stars"], vector["stars"])
        self.assertFalse(result["public_trusted_leaderboard_enabled"])
        self.assertEqual(result["integrity"], "server_replayed_not_full_anti_cheat")

        session = self.sessions.docs[0]
        self.assertTrue(session["used"])

        progress = asyncio.run(integrity.get_runner_verified_progress(None))
        self.assertEqual(progress["best"][0], vector["score"])
        self.assertEqual(progress["stars"][0], vector["stars"])
        self.assertEqual(progress["verified_levels"], 1)
        self.assertNotIn("owner_id", progress)

        with self.assertRaises(HTTPException) as context:
            asyncio.run(integrity.verify_runner_integrity(body, None))
        self.assertEqual(context.exception.status_code, 404)

    def test_losing_replay_is_rejected_and_does_not_consume_session(self):
        session_id = self.add_session(level=1, seed=123456)
        body = integrity.RunnerVerifyInput(
            session_id=session_id,
            actions=[0] * 24,
        )
        with self.assertRaises(HTTPException) as context:
            asyncio.run(integrity.verify_runner_integrity(body, None))
        self.assertEqual(context.exception.status_code, 422)
        self.assertFalse(self.sessions.docs[0]["used"])
        self.assertEqual(self.verified.docs, [])

    def test_incomplete_replay_is_rejected(self):
        session_id = self.add_session(level=1, seed=123456)
        body = integrity.RunnerVerifyInput(
            session_id=session_id,
            actions=[0],
        )
        with self.assertRaises(HTTPException) as context:
            asyncio.run(integrity.verify_runner_integrity(body, None))
        self.assertEqual(context.exception.status_code, 400)
        self.assertFalse(self.sessions.docs[0]["used"])

    def test_expired_session_is_rejected(self):
        vector = self.vectors[0]
        session_id = self.add_session(
            level=1,
            seed=vector["seed"],
            expires=datetime.now(timezone.utc) - timedelta(seconds=1),
        )
        body = integrity.RunnerVerifyInput(
            session_id=session_id,
            actions=vector["actions"],
        )
        with self.assertRaises(HTTPException) as context:
            asyncio.run(integrity.verify_runner_integrity(body, None))
        self.assertEqual(context.exception.status_code, 410)

    def test_session_is_owner_bound(self):
        vector = self.vectors[0]
        session_id = self.add_session(owner="alice", seed=vector["seed"])
        integrity.get_current_user.return_value = {"_id": "bob", "role": "user"}
        body = integrity.RunnerVerifyInput(
            session_id=session_id,
            actions=vector["actions"],
        )
        with self.assertRaises(HTTPException) as context:
            asyncio.run(integrity.verify_runner_integrity(body, None))
        self.assertEqual(context.exception.status_code, 404)

    def test_verified_progress_is_owner_scoped(self):
        self.verified.docs.extend([
            {
                "owner_id": "alice",
                "version": 1,
                "best": [1700] + [0] * 14,
                "stars": [3] + [0] * 14,
                "updated_at": "2026-10-05T08:00:00+00:00",
            },
            {
                "owner_id": "bob",
                "version": 1,
                "best": [999999] + [0] * 14,
                "stars": [3] + [0] * 14,
                "updated_at": "2026-10-05T08:00:00+00:00",
            },
        ])
        result = asyncio.run(integrity.get_runner_verified_progress(None))
        self.assertEqual(result["best"][0], 1700)
        self.assertNotIn("999999", str(result))
        self.assertNotIn("bob", str(result))


if __name__ == "__main__":
    unittest.main()
