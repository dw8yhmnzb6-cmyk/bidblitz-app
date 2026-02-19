"""
Car Advertising Router
Handles car advertising applications for €50/month passive income
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime, timezone
from bson import ObjectId
from config import get_db

router = APIRouter(prefix="/car-advertising", tags=["Car Advertising"])


class CarAdvertisingApplication(BaseModel):
    name: str
    email: EmailStr
    phone: str
    car_brand: str
    car_model: str
    car_year: str
    car_color: str
    license_plate: str
    city: str
    km_per_month: str
    parking_location: Optional[str] = None
    additional_info: Optional[str] = None
    user_id: Optional[str] = None


class ApplicationResponse(BaseModel):
    id: str
    name: str
    email: str
    car_brand: str
    car_model: str
    license_plate: str
    city: str
    status: str  # pending, approved, active, rejected
    total_earned: float
    contract_start: Optional[str] = None
    created_at: str


@router.post("/apply")
async def apply_for_car_advertising(application: CarAdvertisingApplication):
    """Submit a car advertising application"""
    db = get_db()
    
    # Check if this email already has an application
    existing = await db.car_advertising.find_one({
        "email": application.email.lower()
    })
    
    if existing:
        raise HTTPException(
            status_code=400,
            detail="Sie haben bereits eine Anmeldung für Auto-Werbung."
        )
    
    # Check license plate uniqueness
    plate_exists = await db.car_advertising.find_one({
        "license_plate": application.license_plate.upper()
    })
    
    if plate_exists:
        raise HTTPException(
            status_code=400,
            detail="Dieses Kennzeichen wurde bereits registriert."
        )
    
    # Create application
    doc = {
        "name": application.name,
        "email": application.email.lower(),
        "phone": application.phone,
        "car_brand": application.car_brand,
        "car_model": application.car_model,
        "car_year": application.car_year,
        "car_color": application.car_color,
        "license_plate": application.license_plate.upper(),
        "city": application.city,
        "km_per_month": application.km_per_month,
        "parking_location": application.parking_location,
        "additional_info": application.additional_info,
        "user_id": application.user_id,
        "status": "pending",
        "total_earned": 0,
        "months_active": 0,
        "contract_start": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    result = await db.car_advertising.insert_one(doc)
    
    # Log the application
    await db.logs.insert_one({
        "type": "car_advertising",
        "message": f"Neue Auto-Werbung Anmeldung: {application.name} ({application.car_brand} {application.car_model})",
        "user_email": application.email,
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    
    return {
        "success": True,
        "message": "Anmeldung erfolgreich eingereicht",
        "application_id": str(result.inserted_id)
    }


@router.get("/my-application")
async def get_my_application(email: str = Query(...)):
    """Get existing application for a user"""
    db = get_db()
    
    application = await db.car_advertising.find_one(
        {"email": email.lower()},
        {"_id": 0}
    )
    
    if not application:
        return None
    
    return application


@router.get("/all")
async def get_all_applications(status: Optional[str] = None):
    """Get all car advertising applications (admin only)"""
    db = get_db()
    
    query = {}
    if status:
        query["status"] = status
    
    applications = await db.car_advertising.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).to_list(1000)
    
    return {"applications": applications, "total": len(applications)}


@router.put("/update-status")
async def update_application_status(
    email: str = Query(...),
    status: str = Query(...),
    admin_note: Optional[str] = None
):
    """Update application status (admin only)"""
    db = get_db()
    
    valid_statuses = ["pending", "approved", "active", "rejected"]
    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail="Ungültiger Status")
    
    update_data = {
        "status": status,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    if admin_note:
        update_data["admin_note"] = admin_note
    
    if status == "active":
        update_data["contract_start"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.car_advertising.update_one(
        {"email": email.lower()},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Anmeldung nicht gefunden")
    
    return {"success": True, "message": f"Status auf {status} aktualisiert"}


@router.post("/process-monthly-payouts")
async def process_monthly_payouts():
    """Process monthly €50 payouts for all active car advertisers"""
    db = get_db()
    
    # Get all active advertisers
    active_advertisers = await db.car_advertising.find(
        {"status": "active"}
    ).to_list(1000)
    
    processed = 0
    total_amount = 0
    
    for advertiser in active_advertisers:
        # Add €50 to their total earned
        await db.car_advertising.update_one(
            {"email": advertiser["email"]},
            {
                "$inc": {
                    "total_earned": 50,
                    "months_active": 1
                },
                "$set": {
                    "last_payout": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        
        # If user exists, add to their wallet
        if advertiser.get("user_id"):
            await db.users.update_one(
                {"id": advertiser["user_id"]},
                {
                    "$inc": {"wallet_balance": 50}
                }
            )
        
        processed += 1
        total_amount += 50
    
    # Log the payout
    await db.logs.insert_one({
        "type": "car_advertising_payout",
        "message": f"Auto-Werbung Monatszahlung: {processed} Fahrer, €{total_amount} gesamt",
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    
    return {
        "success": True,
        "processed": processed,
        "total_amount": total_amount
    }


@router.get("/stats")
async def get_car_advertising_stats():
    """Get statistics for car advertising program"""
    db = get_db()
    
    total = await db.car_advertising.count_documents({})
    pending = await db.car_advertising.count_documents({"status": "pending"})
    approved = await db.car_advertising.count_documents({"status": "approved"})
    active = await db.car_advertising.count_documents({"status": "active"})
    rejected = await db.car_advertising.count_documents({"status": "rejected"})
    
    # Get total payout
    pipeline = [
        {"$match": {"status": "active"}},
        {"$group": {"_id": None, "total": {"$sum": "$total_earned"}}}
    ]
    payout_result = await db.car_advertising.aggregate(pipeline).to_list(1)
    total_paid = payout_result[0]["total"] if payout_result else 0
    
    # Get cities
    cities_pipeline = [
        {"$match": {"status": "active"}},
        {"$group": {"_id": "$city", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    cities = await db.car_advertising.aggregate(cities_pipeline).to_list(100)
    
    return {
        "total": total,
        "pending": pending,
        "approved": approved,
        "active": active,
        "rejected": rejected,
        "total_paid_out": total_paid,
        "cities": cities
    }
