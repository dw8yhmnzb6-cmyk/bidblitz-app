"""
Manager Approval & Time Correction
===================================
Managers can correct/approve staff working hours
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
from uuid import uuid4
import os

router = APIRouter(prefix="/api/staff/manager", tags=["staff-manager"])

from motor.motor_asyncio import AsyncIOMotorClient
MONGO_URL = os.getenv("MONGO_URL")
client = AsyncIOMotorClient(MONGO_URL)
db = client[os.getenv("DB_NAME", "bidblitz")]

class TimeCorrection(BaseModel):
    event_id: str
    new_timestamp: str
    reason: str

class ManualClockEntry(BaseModel):
    staff_id: str
    action: str
    timestamp: str
    reason: str
    lat: Optional[float] = None
    lng: Optional[float] = None

@router.post("/correct-time")
async def correct_work_time(
    data: TimeCorrection,
    manager_id: str = "test-merchant"
):
    """Manager korrigiert Arbeitszeit"""
    # Get original event
    event = await db.staff_clock_events.find_one({"id": data.event_id})
    
    if not event:
        raise HTTPException(404, "Event nicht gefunden")
    
    # Create audit log
    audit = {
        "id": str(uuid4()),
        "merchant_id": event["merchant_id"],
        "staff_id": event["staff_id"],
        "event_id": data.event_id,
        "action": "time_correction",
        "who_changed": manager_id,
        "old_value": event["timestamp"],
        "new_value": data.new_timestamp,
        "reason": data.reason,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    await db.staff_audit_log.insert_one(audit)
    
    # Update event
    await db.staff_clock_events.update_one(
        {"id": data.event_id},
        {"$set": {
            "timestamp": data.new_timestamp,
            "corrected_by": manager_id,
            "correction_reason": data.reason,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    audit.pop("_id", None)
    
    return {
        "success": True,
        "message": "Arbeitszeit korrigiert",
        "audit": audit
    }

@router.post("/manual-entry")
async def create_manual_clock_entry(
    data: ManualClockEntry,
    manager_id: str = "test-merchant"
):
    """Manager erstellt manuelle Zeitbuchung"""
    # Verify staff belongs to merchant
    staff = await db.staff_members.find_one({
        "id": data.staff_id,
        "merchant_id": manager_id
    })
    
    if not staff:
        raise HTTPException(404, "Mitarbeiter nicht gefunden")
    
    # Create event
    event = {
        "id": str(uuid4()),
        "merchant_id": manager_id,
        "staff_id": data.staff_id,
        "action": data.action,
        "timestamp": data.timestamp,
        "lat": data.lat,
        "lng": data.lng,
        "note": f"Manuell erstellt: {data.reason}",
        "source": "manual_manager",
        "created_by": manager_id,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.staff_clock_events.insert_one(event)
    
    # Audit log
    audit = {
        "id": str(uuid4()),
        "merchant_id": manager_id,
        "staff_id": data.staff_id,
        "action": "manual_entry",
        "who_changed": manager_id,
        "new_value": data.timestamp,
        "reason": data.reason,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    await db.staff_audit_log.insert_one(audit)
    
    event.pop("_id", None)
    
    return {
        "success": True,
        "message": "Manuelle Buchung erstellt",
        "event": event
    }

@router.get("/audit-log/{staff_id}")
async def get_audit_log(
    staff_id: str,
    limit: int = 50,
    merchant_id: str = "test-merchant"
):
    """Get audit log for staff member"""
    logs = await db.staff_audit_log.find(
        {"merchant_id": merchant_id, "staff_id": staff_id},
        {"_id": 0}
    ).sort("timestamp", -1).limit(limit).to_list(limit)
    
    return {
        "success": True,
        "logs": logs,
        "count": len(logs)
    }

@router.delete("/event/{event_id}")
async def delete_clock_event(
    event_id: str,
    reason: str,
    manager_id: str = "test-merchant"
):
    """Manager löscht Zeitbuchung"""
    event = await db.staff_clock_events.find_one({"id": event_id})
    
    if not event:
        raise HTTPException(404, "Event nicht gefunden")
    
    # Audit log
    audit = {
        "id": str(uuid4()),
        "merchant_id": event["merchant_id"],
        "staff_id": event["staff_id"],
        "event_id": event_id,
        "action": "delete_entry",
        "who_changed": manager_id,
        "old_value": event["timestamp"],
        "reason": reason,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    await db.staff_audit_log.insert_one(audit)
    
    # Soft delete
    await db.staff_clock_events.update_one(
        {"id": event_id},
        {"$set": {
            "deleted": True,
            "deleted_by": manager_id,
            "deleted_reason": reason,
            "deleted_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {
        "success": True,
        "message": "Eintrag gelöscht"
    }
