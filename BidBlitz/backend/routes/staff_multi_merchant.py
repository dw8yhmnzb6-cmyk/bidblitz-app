"""
Multi-Merchant Support für Staff Management
============================================
Mitarbeiter können bei mehreren Merchants gleichzeitig arbeiten
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
from uuid import uuid4
import os

router = APIRouter(prefix="/api/staff/multi", tags=["staff-multi-merchant"])

# Database
from motor.motor_asyncio import AsyncIOMotorClient
MONGO_URL = os.getenv("MONGO_URL")
client = AsyncIOMotorClient(MONGO_URL)
db = client[os.getenv("DB_NAME", "bidblitz")]

class MultiMerchantAssignment(BaseModel):
    staff_email: str
    merchant_id: str
    role: str = "employee"
    hourly_rate: float = 12.0

@router.post("/assign")
async def assign_staff_to_merchant(
    data: MultiMerchantAssignment,
    admin_merchant_id: str = "admin"  # Replace with actual auth
):
    """Mitarbeiter zu weiterem Merchant zuweisen"""
    # Check if staff exists
    staff = await db.staff_members.find_one({"email": data.staff_email}, {"_id": 0})
    
    if not staff:
        # Create new staff member
        staff = {
            "id": str(uuid4()),
            "email": data.staff_email,
            "name": data.staff_email.split("@")[0],
            "phone": None,
            "active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
    
    staff_id = staff["id"]
    
    # Check if already assigned
    existing = await db.staff_merchant_assignments.find_one({
        "staff_id": staff_id,
        "merchant_id": data.merchant_id
    })
    
    if existing:
        raise HTTPException(400, "Mitarbeiter bereits diesem Merchant zugewiesen")
    
    # Create assignment
    assignment = {
        "id": str(uuid4()),
        "staff_id": staff_id,
        "staff_email": data.staff_email,
        "merchant_id": data.merchant_id,
        "role": data.role,
        "hourly_rate": data.hourly_rate,
        "active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.staff_merchant_assignments.insert_one(assignment)
    assignment.pop("_id", None)
    
    return {"success": True, "assignment": assignment}

@router.get("/my-merchants")
async def get_my_merchant_assignments(staff_email: str):
    """Alle Merchant-Zuweisungen für einen Mitarbeiter"""
    assignments = await db.staff_merchant_assignments.find(
        {"staff_email": staff_email, "active": True},
        {"_id": 0}
    ).to_list(100)
    
    # Enrich with merchant names
    for assignment in assignments:
        merchant = await db.users.find_one(
            {"id": assignment["merchant_id"]},
            {"_id": 0, "business_name": 1, "email": 1}
        )
        if merchant:
            assignment["merchant_name"] = merchant.get("business_name", merchant.get("email", "Unknown"))
    
    return {"success": True, "assignments": assignments, "count": len(assignments)}

@router.post("/clock/{merchant_id}")
async def multi_merchant_clock(
    merchant_id: str,
    action: str,
    staff_email: str,
    lat: Optional[float] = None,
    lng: Optional[float] = None
):
    """Check-in/out für spezifischen Merchant"""
    # Verify assignment
    assignment = await db.staff_merchant_assignments.find_one({
        "staff_email": staff_email,
        "merchant_id": merchant_id,
        "active": True
    })
    
    if not assignment:
        raise HTTPException(403, "Nicht diesem Merchant zugewiesen")
    
    # Create clock event
    event = {
        "id": str(uuid4()),
        "merchant_id": merchant_id,
        "staff_id": assignment["staff_id"],
        "action": action,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "lat": lat,
        "lng": lng,
        "source": "multi_merchant",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.staff_clock_events.insert_one(event)
    event.pop("_id", None)
    
    return {"success": True, "event": event}
