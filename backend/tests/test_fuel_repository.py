import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from services.fuel_core import FuelSession, SessionState
from services.fuel_persistence import PersistedFuelSession
from services.fuel_repository import FuelRepository, FuelRepositoryConflict


class Result:
    def __init__(self, modified_count=0):
        self.modified_count = modified_count


class Cursor:
    def __init__(self, docs):
        self.docs = list(docs)

    def sort(self, key, direction):
        self.docs.sort(key=lambda x: x.get(key) or "", reverse=direction < 0)
        return self

    def limit(self, n):
        self.docs = self.docs[:n]
        return self

    async def to_list(self, n):
        return self.docs[:n]


class Collection:
    def __init__(self):
        self.docs = []

    async def find_one(self, query, projection=None):
        if "$or" in query:
            for doc in self.docs:
                for cond in query["$or"]:
                    if all(doc.get(k) == v for k, v in cond.items()):
                        return dict(doc)
            return None
        for doc in self.docs:
            if all(doc.get(k) == v for k, v in query.items()):
                return dict(doc)
        return None

    async def insert_one(self, doc):
        self.docs.append(dict(doc))

    async def update_one(self, query, update):
        for idx, doc in enumerate(self.docs):
            if all(doc.get(k) == v for k, v in query.items()):
                new_doc = dict(doc)
                new_doc.update(update.get("$set") or {})
                self.docs[idx] = new_doc
                return Result(1)
        return Result(0)

    def find(self, query, projection=None):
        return Cursor([dict(d) for d in self.docs if all(d.get(k) == v for k, v in query.items())])


class DB:
    def __init__(self):
        self.fuel_sessions = Collection()


def persisted(session_id="s1", idem="idem1", version=1):
    s = FuelSession(session_id, "station-1")
    s.transition(SessionState.STATION_CONFIRMED)
    return PersistedFuelSession(
        session=s,
        operator_id="op1",
        provider="simulator",
        idempotency_key=idem,
        created_at="2026-10-13T10:00:00+00:00",
        updated_at="2026-10-13T10:00:00+00:00",
        version=version,
    )


class TestFuelRepository(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.repo = FuelRepository(DB())

    async def test_insert_and_get(self):
        p = persisted()
        await self.repo.insert(p)
        got = await self.repo.get("s1")
        self.assertEqual(got.session.session_id, "s1")
        self.assertEqual(got.idempotency_key, "idem1")

    async def test_idempotent_insert_returns_existing(self):
        p = persisted()
        await self.repo.insert(p)
        again = await self.repo.insert(p)
        self.assertEqual(again.session.session_id, "s1")

    async def test_conflict_on_same_idempotency_different_session(self):
        await self.repo.insert(persisted("s1", "idem1"))
        with self.assertRaises(FuelRepositoryConflict):
            await self.repo.insert(persisted("s2", "idem1"))

    async def test_optimistic_save(self):
        p = persisted()
        await self.repo.insert(p)
        saved = await self.repo.save(p)
        self.assertEqual(saved.version, 2)
        stale = p
        with self.assertRaises(FuelRepositoryConflict):
            await self.repo.save(stale)

    async def test_list_by_station(self):
        await self.repo.insert(persisted("s1", "i1"))
        await self.repo.insert(persisted("s2", "i2"))
        rows = await self.repo.list_by_station("station-1")
        self.assertEqual(len(rows), 2)


if __name__ == "__main__":
    unittest.main()
