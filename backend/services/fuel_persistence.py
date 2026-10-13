"""Durable Fuel session persistence contract (DEV preparation only).

Defines the canonical Mongo document shape and required indexes for the
existing BidBlitz database. No new database or collection is created here.
"""
from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

from services.fuel_core import FuelSession, SessionState


COLLECTION = "fuel_sessions"
REQUIRED_INDEXES = (
    {"keys": (("session_id", 1),), "unique": True, "name": "fuel_session_id_unique"},
    {"keys": (("idempotency_key", 1),), "unique": True, "name": "fuel_idempotency_unique"},
    {"keys": (("station_id", 1), ("created_at", -1)), "unique": False, "name": "fuel_station_created"},
    {"keys": (("state", 1), ("updated_at", -1)), "unique": False, "name": "fuel_state_updated"},
)


@dataclass(frozen=True)
class PersistedFuelSession:
    session: FuelSession
    operator_id: str
    provider: str
    idempotency_key: str
    created_at: str
    updated_at: str
    version: int = 1

    def __post_init__(self) -> None:
        required = (
            self.operator_id, self.provider, self.idempotency_key,
            self.created_at, self.updated_at,
        )
        if any(not str(v).strip() for v in required):
            raise ValueError("persistent fuel metadata required")
        if self.version < 1:
            raise ValueError("version must be >= 1")

    def to_document(self) -> dict:
        return {
            "session_id": self.session.session_id,
            "station_id": self.session.station_id,
            "operator_id": self.operator_id,
            "provider": self.provider,
            "pump_id": self.session.pump_id,
            "payment_reference": self.session.payment_reference,
            "state": self.session.state.value,
            "history": [item.value for item in self.session.history],
            "gross_amount": str(self.session.gross_amount) if self.session.gross_amount is not None else None,
            "liters": str(self.session.liters) if self.session.liters is not None else None,
            "idempotency_key": self.idempotency_key,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "version": self.version,
        }

    @classmethod
    def from_document(cls, doc: dict) -> "PersistedFuelSession":
        state = SessionState(doc["state"])
        history = [SessionState(item) for item in doc.get("history") or [SessionState.CREATED.value]]
        session = FuelSession(
            session_id=doc["session_id"],
            station_id=doc["station_id"],
            state=state,
            pump_id=doc.get("pump_id"),
            payment_reference=doc.get("payment_reference"),
            gross_amount=Decimal(doc["gross_amount"]) if doc.get("gross_amount") is not None else None,
            liters=Decimal(doc["liters"]) if doc.get("liters") is not None else None,
            history=history,
        )
        return cls(
            session=session,
            operator_id=doc["operator_id"],
            provider=doc["provider"],
            idempotency_key=doc["idempotency_key"],
            created_at=doc["created_at"],
            updated_at=doc["updated_at"],
            version=int(doc.get("version") or 1),
        )


def optimistic_update_filter(session_id: str, version: int) -> dict:
    if not session_id.strip() or version < 1:
        raise ValueError("valid session/version required")
    return {"session_id": session_id, "version": version}


def optimistic_update_document(persisted: PersistedFuelSession) -> dict:
    doc = persisted.to_document()
    new_version = persisted.version + 1
    doc["version"] = new_version
    return {"$set": doc}
