"""
BidBlitz V2 - Role & Application System
Handles driver and restaurant owner registration with admin approval.
NO FAKE DATA - Real registration required.
"""

import secrets
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Request, UploadFile, File, Form
from pydantic import BaseModel, Field
from typing import Optional, List
from bson import ObjectId

from core.database import db
from core.security import get_current_user

router = APIRouter(prefix="/api/applications", tags=["Applications"])
logger = logging.getLogger("bidblitz.applications")


# ══════════════════════════════════════════════════════════════════════════════
# ROLES & STATUS
# ══════════════════════════════════════════════════════════════════════════════

VALID_ROLES = ["customer", "driver", "restaurant_owner", "merchant", "admin", "influencer", "manager"]
ROLE_STATUS = ["pending", "approved", "rejected"]


# ══════════════════════════════════════════════════════════════════════════════
# SCHEMAS
# ══════════════════════════════════════════════════════════════════════════════

class DriverApplicationRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=100)
    phone: str = Field(..., min_length=5, max_length=20)
    vehicle_type: str = Field(..., description="standard, premium, van")
    vehicle_brand: Optional[str] = None
    vehicle_model: Optional[str] = None
    vehicle_year: Optional[int] = None
    vehicle_color: Optional[str] = None
    license_plate: Optional[str] = None
    city: Optional[str] = None
    # Document URLs (from upload)
    license_image_url: Optional[str] = None
    id_front_url: Optional[str] = None
    id_back_url: Optional[str] = None
    selfie_url: Optional[str] = None


class RestaurantApplicationRequest(BaseModel):
    restaurant_name: str = Field(..., min_length=2, max_length=100)
    address: str = Field(..., min_length=5, max_length=200)
    phone: str = Field(..., min_length=5, max_length=20)
    owner_name: str = Field(..., min_length=2, max_length=100)
    category: str = Field(default="restaurant")
    cuisine_type: Optional[str] = None
    city: Optional[str] = None
    # Document URLs
    business_license_url: Optional[str] = None
    id_front_url: Optional[str] = None
    id_back_url: Optional[str] = None


class ApprovalRequest(BaseModel):
    application_id: str
    approved: bool
    rejection_reason: Optional[str] = None


# ══════════════════════════════════════════════════════════════════════════════
# DRIVER APPLICATION
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/driver/apply")
async def apply_as_driver(req: DriverApplicationRequest, request: Request):
    """
    Apply to become a driver.
    Requires manual admin approval.
    """
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    # Check if already has pending or approved driver application
    existing = await db.driver_applications.find_one({
        "user_id": user_id,
        "status": {"$in": ["pending", "approved"]}
    })
    if existing:
        if existing["status"] == "approved":
            raise HTTPException(status_code=400, detail="Du bist bereits als Fahrer registriert")
        raise HTTPException(status_code=400, detail="Du hast bereits eine ausstehende Bewerbung")
    
    # Validate vehicle type
    if req.vehicle_type not in ["standard", "premium", "van"]:
        raise HTTPException(status_code=400, detail="Ungültiger Fahrzeugtyp")
    
    now = datetime.now(timezone.utc)
    application_id = secrets.token_hex(8)
    
    application = {
        "application_id": application_id,
        "user_id": user_id,
        "user_email": user.get("email", ""),
        "user_name": user.get("name", ""),
        "type": "driver",
        "full_name": req.full_name,
        "phone": req.phone,
        "vehicle_type": req.vehicle_type,
        "vehicle_info": {
            "brand": req.vehicle_brand,
            "model": req.vehicle_model,
            "year": req.vehicle_year,
            "color": req.vehicle_color,
            "license_plate": req.license_plate,
        },
        "city": req.city,
        "documents": {
            "license_image": req.license_image_url,
            "id_front": req.id_front_url,
            "id_back": req.id_back_url,
            "selfie": req.selfie_url,
        },
        "status": "pending",
        "rejection_reason": None,
        "reviewed_by": None,
        "reviewed_at": None,
        "created_at": now.isoformat(),
    }
    
    await db.driver_applications.insert_one(application)
    application.pop("_id", None)
    
    # Update user role status
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {
            "pending_role": "driver",
            "role_status": "pending",
        }}
    )
    
    # Notify admins
    admins = await db.users.find({"role": "admin"}).to_list(10)
    for admin in admins:
        await db.notifications.insert_one({
            "id": secrets.token_hex(8),
            "user_id": str(admin["_id"]),
            "type": "driver_application",
            "title": "Neue Fahrer-Bewerbung",
            "message": f"{req.full_name} möchte Fahrer werden",
            "data": {"application_id": application_id},
            "read": False,
            "created_at": now.isoformat(),
        })
    
    # Notify applicant
    await db.notifications.insert_one({
        "id": secrets.token_hex(8),
        "user_id": user_id,
        "type": "application_received",
        "title": "Bewerbung eingegangen",
        "message": "Deine Fahrer-Bewerbung wurde eingereicht. Wir prüfen sie schnellstmöglich.",
        "read": False,
        "created_at": now.isoformat(),
    })
    
    logger.info(f"Driver application submitted: {application_id} by {user.get('email')}")
    
    return {
        "ok": True,
        "application_id": application_id,
        "status": "pending",
        "message": "Bewerbung eingereicht! Du wirst benachrichtigt, sobald sie geprüft wurde.",
    }


@router.get("/driver/status")
async def get_driver_application_status(request: Request):
    """Get current user's driver application status."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    application = await db.driver_applications.find_one(
        {"user_id": user_id},
        {"_id": 0},
        sort=[("created_at", -1)]
    )
    
    if not application:
        return {"has_application": False, "application": None}
    
    return {
        "has_application": True,
        "application": application,
        "can_reapply": application.get("status") == "rejected",
    }


# ══════════════════════════════════════════════════════════════════════════════
# RESTAURANT APPLICATION
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/restaurant/apply")
async def apply_as_restaurant(req: RestaurantApplicationRequest, request: Request):
    """
    Apply to register a restaurant.
    Requires manual admin approval.
    """
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    # Check existing
    existing = await db.restaurant_applications.find_one({
        "user_id": user_id,
        "status": {"$in": ["pending", "approved"]}
    })
    if existing:
        if existing["status"] == "approved":
            raise HTTPException(status_code=400, detail="Du hast bereits ein registriertes Restaurant")
        raise HTTPException(status_code=400, detail="Du hast bereits eine ausstehende Bewerbung")
    
    now = datetime.now(timezone.utc)
    application_id = secrets.token_hex(8)
    
    application = {
        "application_id": application_id,
        "user_id": user_id,
        "user_email": user.get("email", ""),
        "type": "restaurant",
        "restaurant_name": req.restaurant_name,
        "address": req.address,
        "phone": req.phone,
        "owner_name": req.owner_name,
        "category": req.category,
        "cuisine_type": req.cuisine_type,
        "city": req.city,
        "documents": {
            "business_license": req.business_license_url,
            "id_front": req.id_front_url,
            "id_back": req.id_back_url,
        },
        "status": "pending",
        "rejection_reason": None,
        "reviewed_by": None,
        "reviewed_at": None,
        "created_at": now.isoformat(),
    }
    
    await db.restaurant_applications.insert_one(application)
    application.pop("_id", None)
    
    # Update user
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {
            "pending_role": "restaurant_owner",
            "role_status": "pending",
        }}
    )
    
    # Notify admins
    admins = await db.users.find({"role": "admin"}).to_list(10)
    for admin in admins:
        await db.notifications.insert_one({
            "id": secrets.token_hex(8),
            "user_id": str(admin["_id"]),
            "type": "restaurant_application",
            "title": "Neue Restaurant-Bewerbung",
            "message": f"{req.restaurant_name} möchte sich registrieren",
            "data": {"application_id": application_id},
            "read": False,
            "created_at": now.isoformat(),
        })
    
    # Notify applicant
    await db.notifications.insert_one({
        "id": secrets.token_hex(8),
        "user_id": user_id,
        "type": "application_received",
        "title": "Bewerbung eingegangen",
        "message": f"Die Registrierung für '{req.restaurant_name}' wurde eingereicht.",
        "read": False,
        "created_at": now.isoformat(),
    })
    
    logger.info(f"Restaurant application submitted: {application_id} by {user.get('email')}")
    
    return {
        "ok": True,
        "application_id": application_id,
        "status": "pending",
        "message": "Registrierung eingereicht! Du wirst benachrichtigt.",
    }


@router.get("/restaurant/status")
async def get_restaurant_application_status(request: Request):
    """Get current user's restaurant application status."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    application = await db.restaurant_applications.find_one(
        {"user_id": user_id},
        {"_id": 0},
        sort=[("created_at", -1)]
    )
    
    if not application:
        return {"has_application": False, "application": None}
    
    return {
        "has_application": True,
        "application": application,
        "can_reapply": application.get("status") == "rejected",
    }


# ══════════════════════════════════════════════════════════════════════════════
# ADMIN: VIEW APPLICATIONS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/admin/pending")
async def admin_get_pending_applications(request: Request):
    """Admin: Get all pending applications."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Nur Admin")
    
    driver_apps = await db.driver_applications.find(
        {"status": "pending"},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    restaurant_apps = await db.restaurant_applications.find(
        {"status": "pending"},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return {
        "drivers": driver_apps,
        "restaurants": restaurant_apps,
        "total_pending": len(driver_apps) + len(restaurant_apps),
    }


@router.get("/admin/all")
async def admin_get_all_applications(
    request: Request,
    app_type: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 50
):
    """Admin: Get all applications with filters."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Nur Admin")
    
    results = {"drivers": [], "restaurants": []}
    
    # Driver applications
    if not app_type or app_type == "driver":
        query = {}
        if status:
            query["status"] = status
        results["drivers"] = await db.driver_applications.find(
            query, {"_id": 0}
        ).sort("created_at", -1).limit(limit).to_list(limit)
    
    # Restaurant applications
    if not app_type or app_type == "restaurant":
        query = {}
        if status:
            query["status"] = status
        results["restaurants"] = await db.restaurant_applications.find(
            query, {"_id": 0}
        ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return results


@router.get("/admin/{application_id}")
async def admin_get_application_detail(application_id: str, request: Request):
    """Admin: Get detailed application info."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Nur Admin")
    
    # Try driver applications
    app = await db.driver_applications.find_one(
        {"application_id": application_id},
        {"_id": 0}
    )
    if app:
        app["app_type"] = "driver"
        return app
    
    # Try restaurant applications
    app = await db.restaurant_applications.find_one(
        {"application_id": application_id},
        {"_id": 0}
    )
    if app:
        app["app_type"] = "restaurant"
        return app
    
    raise HTTPException(status_code=404, detail="Bewerbung nicht gefunden")


# ══════════════════════════════════════════════════════════════════════════════
# ADMIN: APPROVE / REJECT
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/admin/approve")
async def admin_approve_application(req: ApprovalRequest, request: Request):
    """Admin: Approve or reject an application."""
    admin = await get_current_user(request)
    if admin.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Nur Admin")
    
    admin_id = str(admin["_id"])
    now = datetime.now(timezone.utc)
    
    # Find application (check both collections)
    driver_app = await db.driver_applications.find_one({"application_id": req.application_id})
    restaurant_app = await db.restaurant_applications.find_one({"application_id": req.application_id})
    
    app = driver_app or restaurant_app
    if not app:
        raise HTTPException(status_code=404, detail="Bewerbung nicht gefunden")
    
    if app["status"] != "pending":
        raise HTTPException(status_code=400, detail="Bewerbung wurde bereits bearbeitet")
    
    user_id = app["user_id"]
    new_status = "approved" if req.approved else "rejected"
    
    # Update application
    update_data = {
        "status": new_status,
        "reviewed_by": admin_id,
        "reviewed_at": now.isoformat(),
    }
    if not req.approved:
        update_data["rejection_reason"] = req.rejection_reason or "Nicht genehmigt"
    
    if driver_app:
        await db.driver_applications.update_one(
            {"application_id": req.application_id},
            {"$set": update_data}
        )
        
        if req.approved:
            # Create driver profile
            driver_id = secrets.token_hex(8)
            await db.drivers.insert_one({
                "driver_id": driver_id,
                "user_id": user_id,
                "name": app.get("full_name", ""),
                "phone": app.get("phone", ""),
                "email": app.get("user_email", ""),
                "vehicle_type": app.get("vehicle_type", "standard"),
                "vehicle_info": app.get("vehicle_info", {}),
                "verified": True,
                "is_online": False,
                "status": "offline",
                "current_location": None,
                "rating": 5.0,
                "total_rides": 0,
                "total_earnings": 0,
                "created_at": now.isoformat(),
            })
            
            # Update user role
            await db.users.update_one(
                {"_id": ObjectId(user_id)},
                {"$set": {
                    "role": "driver",
                    "role_status": "approved",
                    "driver_id": driver_id,
                    "verified": True,
                }}
            )
            
            logger.info(f"Driver approved: {driver_id} for user {user_id}")
        else:
            # Reset user role status
            await db.users.update_one(
                {"_id": ObjectId(user_id)},
                {"$set": {
                    "role_status": "rejected",
                    "pending_role": None,
                }}
            )
    
    elif restaurant_app:
        await db.restaurant_applications.update_one(
            {"application_id": req.application_id},
            {"$set": update_data}
        )
        
        if req.approved:
            # Create restaurant
            restaurant_id = secrets.token_hex(8)
            await db.food_restaurants.insert_one({
                "restaurant_id": restaurant_id,
                "owner_id": user_id,
                "name": app.get("restaurant_name", ""),
                "address": app.get("address", ""),
                "phone": app.get("phone", ""),
                "category": app.get("category", "restaurant"),
                "cuisine_type": app.get("cuisine_type", ""),
                "rating": 5.0,
                "review_count": 0,
                "delivery_time": "30-45 min",
                "price_level": "€€",
                "image": "",
                "menu": [],
                "is_open": False,
                "status": "approved",
                "verified": True,
                "min_order": 10.0,
                "delivery_fee": 2.99,
                "location": None,
                "created_at": now.isoformat(),
            })
            
            # Update user role
            await db.users.update_one(
                {"_id": ObjectId(user_id)},
                {"$set": {
                    "role": "restaurant_owner",
                    "role_status": "approved",
                    "restaurant_id": restaurant_id,
                    "verified": True,
                }}
            )
            
            logger.info(f"Restaurant approved: {restaurant_id} for user {user_id}")
        else:
            await db.users.update_one(
                {"_id": ObjectId(user_id)},
                {"$set": {
                    "role_status": "rejected",
                    "pending_role": None,
                }}
            )
    
    # Notify applicant
    if req.approved:
        notification = {
            "id": secrets.token_hex(8),
            "user_id": user_id,
            "type": "application_approved",
            "title": "Bewerbung genehmigt! 🎉",
            "message": "Deine Bewerbung wurde genehmigt. Du kannst jetzt loslegen!",
            "read": False,
            "created_at": now.isoformat(),
        }
    else:
        notification = {
            "id": secrets.token_hex(8),
            "user_id": user_id,
            "type": "application_rejected",
            "title": "Bewerbung abgelehnt",
            "message": f"Leider wurde deine Bewerbung abgelehnt. Grund: {req.rejection_reason or 'Nicht angegeben'}",
            "read": False,
            "created_at": now.isoformat(),
        }
    await db.notifications.insert_one(notification)
    
    return {
        "ok": True,
        "status": new_status,
        "message": "Genehmigt!" if req.approved else "Abgelehnt",
    }


# ══════════════════════════════════════════════════════════════════════════════
# STATS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/admin/stats")
async def admin_get_application_stats(request: Request):
    """Admin: Get application statistics."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Nur Admin")
    
    driver_stats = {
        "total": await db.driver_applications.count_documents({}),
        "pending": await db.driver_applications.count_documents({"status": "pending"}),
        "approved": await db.driver_applications.count_documents({"status": "approved"}),
        "rejected": await db.driver_applications.count_documents({"status": "rejected"}),
    }
    
    restaurant_stats = {
        "total": await db.restaurant_applications.count_documents({}),
        "pending": await db.restaurant_applications.count_documents({"status": "pending"}),
        "approved": await db.restaurant_applications.count_documents({"status": "approved"}),
        "rejected": await db.restaurant_applications.count_documents({"status": "rejected"}),
    }
    
    return {
        "drivers": driver_stats,
        "restaurants": restaurant_stats,
        "total_pending": driver_stats["pending"] + restaurant_stats["pending"],
    }
