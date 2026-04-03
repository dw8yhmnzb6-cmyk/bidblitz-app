"""
BidBlitz V2 - Notifications System
In-app notifications for onboarding, campaigns, rewards, and system events.
"""

from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Request, Query
from pydantic import BaseModel, Field
from typing import Optional
from core.database import db
from core.security import get_current_user

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("")
async def get_notifications(
    request: Request,
    unread_only: bool = Query(False),
    limit: int = Query(30, le=100),
):
    user = await get_current_user(request)
    user_id = str(user["_id"])

    query = {"user_id": user_id}
    if unread_only:
        query["read"] = False

    notifications = await db.notifications.find(
        query, {"_id": 0}
    ).sort("created_at", -1).to_list(limit)

    unread_count = await db.notifications.count_documents({"user_id": user_id, "read": False})

    return {
        "notifications": notifications,
        "unread_count": unread_count,
    }


@router.post("/read-all")
async def mark_all_read(request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])

    result = await db.notifications.update_many(
        {"user_id": user_id, "read": False},
        {"$set": {"read": True, "read_at": datetime.now(timezone.utc).isoformat()}},
    )

    return {"success": True, "marked": result.modified_count}


class AdminNotificationRequest(BaseModel):
    target: str = Field(..., description="all, users, merchants, or specific user_id")
    title: str = Field(..., min_length=1, max_length=200)
    message: str = Field(..., min_length=1, max_length=1000)
    type: str = Field("campaign", description="campaign, system, reward, alert")


@router.post("/admin/send")
async def admin_send_notification(req: AdminNotificationRequest, request: Request):
    """Admin: Send notification to users."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    now = datetime.now(timezone.utc).isoformat()
    sent_count = 0

    if req.target == "all":
        users = await db.users.find({}, {"_id": 1}).to_list(10000)
    elif req.target == "users":
        users = await db.users.find({"role": {"$ne": "admin"}}, {"_id": 1}).to_list(10000)
    elif req.target == "merchants":
        merchants = await db.merchants.find({}, {"user_id": 1}).to_list(10000)
        merchant_ids = [m["user_id"] for m in merchants]
        from bson import ObjectId
        users = [{"_id": ObjectId(uid)} for uid in merchant_ids]
    else:
        from bson import ObjectId
        users = [{"_id": ObjectId(req.target)}]

    notifications = []
    for u in users:
        notifications.append({
            "user_id": str(u["_id"]),
            "type": req.type,
            "title": req.title,
            "message": req.message,
            "read": False,
            "created_at": now,
            "sent_by": "admin",
        })
        sent_count += 1

    if notifications:
        await db.notifications.insert_many(notifications)

    return {"success": True, "sent_count": sent_count}


async def create_notification(user_id: str, title: str, message: str, notif_type: str = "system"):
    """Helper: Create a single notification."""
    await db.notifications.insert_one({
        "user_id": user_id,
        "type": notif_type,
        "title": title,
        "message": message,
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })


async def create_onboarding_notifications(user_id: str, name: str):
    """Create welcome notifications for a new user."""
    now = datetime.now(timezone.utc).isoformat()
    notifications = [
        {
            "user_id": user_id, "type": "onboarding", "title": "Welcome to BidBlitz!",
            "message": f"Hi {name}, welcome to BidBlitz! Start by adding money to your wallet.",
            "read": False, "created_at": now,
        },
        {
            "user_id": user_id, "type": "onboarding", "title": "Invite & Earn",
            "message": "Share your referral code with friends and earn bonuses!",
            "read": False, "created_at": now,
        },
    ]
    await db.notifications.insert_many(notifications)
