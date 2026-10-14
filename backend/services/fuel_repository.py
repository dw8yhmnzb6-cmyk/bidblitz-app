"""Fuel repository implementation for the existing BidBlitz Mongo database.

No second database. The repository accepts a Motor-compatible database object
so it can be unit-tested without connecting to production.
"""
from __future__ import annotations

from dataclasses import replace

from services.fuel_persistence import PersistedFuelSession


class FuelRepositoryConflict(RuntimeError):
    pass


class FuelRepository:
    def __init__(self, database) -> None:
        self.db = database
        self.collection = database.fuel_sessions

    async def insert(self, persisted: PersistedFuelSession) -> PersistedFuelSession:
        existing = await self.collection.find_one({
            "$or": [
                {"session_id": persisted.session.session_id},
                {"idempotency_key": persisted.idempotency_key},
            ]
        })
        if existing:
            if existing.get("session_id") == persisted.session.session_id and existing.get("idempotency_key") == persisted.idempotency_key:
                return PersistedFuelSession.from_document(existing)
            raise FuelRepositoryConflict("fuel session/idempotency conflict")

        await self.collection.insert_one(persisted.to_document())
        return persisted

    async def get(self, session_id: str) -> PersistedFuelSession | None:
        doc = await self.collection.find_one({"session_id": session_id}, {"_id": 0})
        return PersistedFuelSession.from_document(doc) if doc else None

    async def save(self, persisted: PersistedFuelSession) -> PersistedFuelSession:
        next_version = persisted.version + 1
        doc = persisted.to_document()
        doc["version"] = next_version
        result = await self.collection.update_one(
            {"session_id": persisted.session.session_id, "version": persisted.version},
            {"$set": doc},
        )
        if getattr(result, "modified_count", 0) != 1:
            raise FuelRepositoryConflict("fuel session version conflict")
        return replace(persisted, version=next_version)

    async def list_by_station(self, station_id: str, *, limit: int = 100) -> list[PersistedFuelSession]:
        if not station_id.strip():
            raise ValueError("station_id required")
        if not 1 <= limit <= 500:
            raise ValueError("limit out of range")
        cursor = self.collection.find({"station_id": station_id}, {"_id": 0}).sort("created_at", -1).limit(limit)
        docs = await cursor.to_list(limit)
        return [PersistedFuelSession.from_document(doc) for doc in docs]
