"""DEV Fuel persistence bridge to the existing BidBlitz Mongo database.

Persistence is opt-in via FUEL_DEV_PERSISTENCE=true. This never creates a
second database and never enables payments/providers. It only stores simulator
session state in the existing db.fuel_sessions collection.
"""
from __future__ import annotations

import os
from dataclasses import replace
from datetime import datetime, timezone

from services.fuel_payment_bridge import build_idempotency_key
from services.fuel_persistence import PersistedFuelSession
from services.fuel_repository import FuelRepository
from services.fuel_simulator_sessions import SimulatedFuelSession


def persistence_enabled() -> bool:
    return (os.environ.get("FUEL_DEV_PERSISTENCE") or "").strip().lower() in {"1", "true", "yes", "on"}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _repo() -> FuelRepository:
    # Lazy import keeps pure domain tests independent from Motor/FastAPI runtime.
    from core.database import db
    return FuelRepository(db)


async def persist_simulator_session(item: SimulatedFuelSession) -> dict:
    if not persistence_enabled():
        return {"enabled": False, "persisted": False, "reason": "FUEL_DEV_PERSISTENCE disabled"}

    repo = _repo()
    existing = await repo.get(item.session.session_id)
    now = _now()

    if existing is None:
        persisted = PersistedFuelSession(
            session=item.session,
            operator_id="op-simulator",
            provider="simulator",
            idempotency_key=build_idempotency_key(
                fuel_session_id=item.session.session_id,
                station_id=item.session.station_id,
                operator_id="op-simulator",
            ),
            created_at=now,
            updated_at=now,
            version=1,
        )
        saved = await repo.insert(persisted)
        return {"enabled": True, "persisted": True, "version": saved.version, "created": True}

    updated = replace(
        existing,
        session=item.session,
        updated_at=now,
    )
    saved = await repo.save(updated)
    return {"enabled": True, "persisted": True, "version": saved.version, "created": False}


async def get_persisted_session(session_id: str) -> PersistedFuelSession | None:
    if not persistence_enabled():
        return None
    return await _repo().get(session_id)
