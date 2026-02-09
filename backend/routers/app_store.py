"""App Store Request Router - Request app for mobile stores"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from pydantic import BaseModel
import uuid

from config import db, logger
from dependencies import get_current_user, get_admin_user

router = APIRouter(prefix="/app-store", tags=["App Store"])

# ==================== SCHEMAS ====================

class AppRequest(BaseModel):
    platform: str  # ios, android
    device_model: Optional[str] = None
    os_version: Optional[str] = None
    email_notify: bool = True

class FeatureRequest(BaseModel):
    title: str
    description: str
    category: str  # ui, feature, bug, other

# ==================== PUBLIC ENDPOINTS ====================

@router.get("/status")
async def get_app_status():
    """Get current app availability status"""
    return {
        "ios": {
            "status": "coming_soon",
            "expected_date": "Q1 2025",
            "beta_available": True,
            "testflight_url": None
        },
        "android": {
            "status": "coming_soon", 
            "expected_date": "Q1 2025",
            "beta_available": True,
            "play_store_url": None
        },
        "web_app": {
            "status": "available",
            "pwa_installable": True,
            "url": "https://bidblitz.de"
        },
        "features_planned": [
            "Push-Benachrichtigungen",
            "Biometrische Anmeldung",
            "Offline-Favoriten",
            "Apple Pay / Google Pay",
            "Widget für Auktions-Timer"
        ]
    }

@router.post("/request-notify")
async def request_app_notification(request: AppRequest, user: dict = Depends(get_current_user)):
    """Request to be notified when app is available"""
    user_id = user["id"]
    
    # Check for existing request
    existing = await db.app_requests.find_one({
        "user_id": user_id,
        "platform": request.platform
    })
    
    if existing:
        return {"already_registered": True, "message": "Du bist bereits registriert"}
    
    # Create request
    request_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "user_email": user.get("email"),
        "platform": request.platform,
        "device_model": request.device_model,
        "os_version": request.os_version,
        "email_notify": request.email_notify,
        "notified": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.app_requests.insert_one(request_doc)
    
    logger.info(f"App notification request from {user_id} for {request.platform}")
    
    return {
        "success": True,
        "message": f"Du wirst benachrichtigt, sobald die {request.platform.upper()}-App verfügbar ist!"
    }

@router.get("/my-requests")
async def get_my_requests(user: dict = Depends(get_current_user)):
    """Get user's app notification requests"""
    requests = await db.app_requests.find(
        {"user_id": user["id"]},
        {"_id": 0}
    ).to_list(10)
    
    return {"requests": requests}

@router.delete("/cancel/{platform}")
async def cancel_notification(platform: str, user: dict = Depends(get_current_user)):
    """Cancel notification request"""
    result = await db.app_requests.delete_one({
        "user_id": user["id"],
        "platform": platform
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Anfrage nicht gefunden")
    
    return {"success": True}

# ==================== FEATURE REQUESTS ====================

@router.post("/feature-request")
async def submit_feature_request(request: FeatureRequest, user: dict = Depends(get_current_user)):
    """Submit a feature request for the app"""
    request_id = str(uuid.uuid4())
    
    request_doc = {
        "id": request_id,
        "user_id": user["id"],
        "user_name": user.get("name", user.get("username")),
        "title": request.title,
        "description": request.description,
        "category": request.category,
        "votes": 1,
        "voters": [user["id"]],
        "status": "submitted",  # submitted, under_review, planned, in_progress, completed, rejected
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.feature_requests.insert_one(request_doc)
    
    return {
        "success": True,
        "message": "Danke für deinen Vorschlag!",
        "request_id": request_id
    }

@router.get("/feature-requests")
async def get_feature_requests(status: Optional[str] = None, limit: int = 20):
    """Get feature requests (public voting)"""
    query = {}
    if status:
        query["status"] = status
    
    requests = await db.feature_requests.find(
        query,
        {"_id": 0}
    ).sort("votes", -1).limit(limit).to_list(limit)
    
    return {"requests": requests}

@router.post("/feature-requests/{request_id}/vote")
async def vote_feature_request(request_id: str, user: dict = Depends(get_current_user)):
    """Vote for a feature request"""
    request = await db.feature_requests.find_one({"id": request_id})
    
    if not request:
        raise HTTPException(status_code=404, detail="Anfrage nicht gefunden")
    
    if user["id"] in request.get("voters", []):
        return {"already_voted": True}
    
    await db.feature_requests.update_one(
        {"id": request_id},
        {
            "$inc": {"votes": 1},
            "$push": {"voters": user["id"]}
        }
    )
    
    return {"success": True, "new_vote_count": request.get("votes", 0) + 1}

# ==================== BETA TESTING ====================

@router.post("/beta/signup")
async def signup_beta(platform: str, user: dict = Depends(get_current_user)):
    """Sign up for beta testing"""
    if platform not in ["ios", "android"]:
        raise HTTPException(status_code=400, detail="Ungültige Plattform")
    
    # Check existing
    existing = await db.beta_testers.find_one({
        "user_id": user["id"],
        "platform": platform
    })
    
    if existing:
        return {"already_registered": True}
    
    await db.beta_testers.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "user_email": user.get("email"),
        "platform": platform,
        "status": "pending",  # pending, approved, active
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {
        "success": True,
        "message": f"Du bist für die {platform.upper()}-Beta angemeldet! Wir melden uns bald."
    }

@router.get("/beta/status")
async def get_beta_status(user: dict = Depends(get_current_user)):
    """Get user's beta testing status"""
    status = await db.beta_testers.find(
        {"user_id": user["id"]},
        {"_id": 0}
    ).to_list(10)
    
    return {"beta_status": status}

# ==================== ADMIN ENDPOINTS ====================

@router.get("/admin/requests")
async def get_all_requests(
    platform: Optional[str] = None,
    admin: dict = Depends(get_admin_user)
):
    """Get all app notification requests"""
    query = {}
    if platform:
        query["platform"] = platform
    
    requests = await db.app_requests.find(query, {"_id": 0}).to_list(1000)
    
    # Count by platform
    ios_count = sum(1 for r in requests if r.get("platform") == "ios")
    android_count = sum(1 for r in requests if r.get("platform") == "android")
    
    return {
        "requests": requests,
        "stats": {
            "ios": ios_count,
            "android": android_count,
            "total": len(requests)
        }
    }

@router.get("/admin/beta-testers")
async def get_beta_testers(admin: dict = Depends(get_admin_user)):
    """Get all beta tester signups"""
    testers = await db.beta_testers.find({}, {"_id": 0}).to_list(500)
    return {"testers": testers, "count": len(testers)}

@router.put("/admin/feature-requests/{request_id}/status")
async def update_feature_status(
    request_id: str,
    status: str,
    admin: dict = Depends(get_admin_user)
):
    """Update feature request status"""
    valid_statuses = ["submitted", "under_review", "planned", "in_progress", "completed", "rejected"]
    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail="Ungültiger Status")
    
    result = await db.feature_requests.update_one(
        {"id": request_id},
        {"$set": {
            "status": status,
            "updated_by": admin["id"],
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Anfrage nicht gefunden")
    
    return {"success": True}

@router.post("/admin/notify-release")
async def notify_app_release(
    platform: str,
    store_url: str,
    admin: dict = Depends(get_admin_user)
):
    """Notify all users who requested app availability"""
    if platform not in ["ios", "android"]:
        raise HTTPException(status_code=400, detail="Ungültige Plattform")
    
    # Get all unnotified requests for this platform
    requests = await db.app_requests.find({
        "platform": platform,
        "notified": False,
        "email_notify": True
    }, {"_id": 0}).to_list(10000)
    
    # Mark as notified
    await db.app_requests.update_many(
        {"platform": platform, "notified": False},
        {"$set": {"notified": True, "notified_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # In production, this would trigger emails
    logger.info(f"App release notification sent to {len(requests)} users for {platform}")
    
    return {
        "success": True,
        "notifications_sent": len(requests),
        "platform": platform
    }


app_store_router = router
