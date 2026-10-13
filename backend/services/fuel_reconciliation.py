"""Fuel reconciliation inbox for BidBlitz (DEV foundation).

Tracks amount mismatches between forecourt/POS, PSP and BidBlitz records.
This module does not move money and does not auto-correct discrepancies.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal
from enum import Enum

from services.fuel_finance import ReconciliationRecord


class ReconciliationStatus(str, Enum):
    OPEN = "open"
    REVIEWING = "reviewing"
    RESOLVED = "resolved"
    IGNORED = "ignored"


class ReconciliationSeverity(str, Enum):
    INFO = "info"
    MEDIUM = "medium"
    HIGH = "high"


@dataclass(frozen=True)
class FuelReconciliationCase:
    case_id: str
    record: ReconciliationRecord
    station_id: str
    operator_id: str
    provider: str
    status: ReconciliationStatus = ReconciliationStatus.OPEN
    severity: ReconciliationSeverity = ReconciliationSeverity.MEDIUM
    note: str = ""

    def __post_init__(self) -> None:
        required = (self.case_id, self.station_id, self.operator_id, self.provider)
        if any(not str(v).strip() for v in required):
            raise ValueError("reconciliation identifiers required")

    @property
    def balanced(self) -> bool:
        return self.record.balanced

    def payload(self) -> dict:
        return {
            "case_id": self.case_id,
            "transaction_id": self.record.transaction_id,
            "station_id": self.station_id,
            "operator_id": self.operator_id,
            "provider": self.provider,
            "pos_amount": str(self.record.pos_amount),
            "psp_amount": str(self.record.psp_amount),
            "bidblitz_amount": str(self.record.bidblitz_amount),
            "difference": str(self.record.difference),
            "balanced": self.record.balanced,
            "status": self.status.value,
            "severity": self.severity.value,
            "note": self.note,
        }


def build_case(
    *,
    case_id: str,
    transaction_id: str,
    station_id: str,
    operator_id: str,
    provider: str,
    pos_amount,
    psp_amount,
    bidblitz_amount,
) -> FuelReconciliationCase:
    record = ReconciliationRecord(
        transaction_id=transaction_id,
        pos_amount=Decimal(str(pos_amount)),
        psp_amount=Decimal(str(psp_amount)),
        bidblitz_amount=Decimal(str(bidblitz_amount)),
    )
    diff = record.difference
    severity = (
        ReconciliationSeverity.INFO if diff == 0
        else ReconciliationSeverity.HIGH if diff >= Decimal("5.00")
        else ReconciliationSeverity.MEDIUM
    )
    return FuelReconciliationCase(
        case_id=case_id,
        record=record,
        station_id=station_id,
        operator_id=operator_id,
        provider=provider,
        status=ReconciliationStatus.RESOLVED if record.balanced else ReconciliationStatus.OPEN,
        severity=severity,
    )


_STATUS_TRANSITIONS = {
    ReconciliationStatus.OPEN: {ReconciliationStatus.REVIEWING, ReconciliationStatus.RESOLVED, ReconciliationStatus.IGNORED},
    ReconciliationStatus.REVIEWING: {ReconciliationStatus.RESOLVED, ReconciliationStatus.IGNORED},
    ReconciliationStatus.RESOLVED: set(),
    ReconciliationStatus.IGNORED: set(),
}


def validate_status_transition(current: ReconciliationStatus, target: ReconciliationStatus) -> None:
    if target not in _STATUS_TRANSITIONS[current]:
        raise ValueError(f"invalid reconciliation transition {current.value}->{target.value}")


class FuelReconciliationRepository:
    def __init__(self, database) -> None:
        self.collection = database.fuel_reconciliation_cases

    async def upsert(self, case: FuelReconciliationCase, *, actor: str = "system") -> dict:
        if not actor.strip():
            raise ValueError("actor required")
        now = datetime.now(timezone.utc).isoformat()
        doc = {
            **case.payload(),
            "updated_at": now,
            "updated_by": actor,
        }
        existing = await self.collection.find_one({"case_id": case.case_id}, {"_id": 0, "created_at": 1})
        doc["created_at"] = (existing or {}).get("created_at") or now
        await self.collection.update_one({"case_id": case.case_id}, {"$set": doc}, upsert=True)
        return doc

    async def get(self, case_id: str) -> dict | None:
        if not case_id.strip():
            raise ValueError("case_id required")
        return await self.collection.find_one({"case_id": case_id}, {"_id": 0})

    async def list_open(self, *, limit: int = 100) -> list[dict]:
        if not 1 <= limit <= 500:
            raise ValueError("limit out of range")
        cursor = self.collection.find(
            {"status": {"$in": [ReconciliationStatus.OPEN.value, ReconciliationStatus.REVIEWING.value]}},
            {"_id": 0},
        ).sort("updated_at", -1).limit(limit)
        return await cursor.to_list(limit)

    async def transition(self, case_id: str, target: ReconciliationStatus, *, actor: str, note: str = "") -> dict:
        if not actor.strip():
            raise ValueError("actor required")
        current = await self.get(case_id)
        if not current:
            raise KeyError("reconciliation case not found")
        current_status = ReconciliationStatus(current.get("status") or "open")
        validate_status_transition(current_status, target)
        now = datetime.now(timezone.utc).isoformat()
        update = {
            "status": target.value,
            "note": note[:500],
            "updated_at": now,
            "updated_by": actor,
        }
        await self.collection.update_one({"case_id": case_id}, {"$set": update})
        current.update(update)
        return current
