"""
BidBlitz V2 - Notification Center
Central notification hub for ALL app events
"""
from fastapi import APIRouter, Request, HTTPException
from core.security import get_current_user
from core.database import db

router = APIRouter(prefix="/api/notifications/center", tags=["notifications-center"])


@router.get("")
async def get_notifications(request: Request, limit: int = 50, unread_only: bool = False):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    query = {"user_id": user_id}
    if unread_only:
        query["read"] = False
    notifs = await db.notifications.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    unread = await db.notifications.count_documents({"user_id": user_id, "read": False})
    return {"notifications": notifs, "unread_count": unread}


@router.post("/read/{notification_id}")
async def mark_read(notification_id: str, request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    await db.notifications.update_one(
        {"id": notification_id, "user_id": user_id},
        {"$set": {"read": True}}
    )
    return {"ok": True}


@router.post("/read-all")
async def mark_all_read(request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    result = await db.notifications.update_many(
        {"user_id": user_id, "read": False},
        {"$set": {"read": True}}
    )
    return {"ok": True, "marked": result.modified_count}


@router.get("/count")
async def unread_count(request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    count = await db.notifications.count_documents({"user_id": user_id, "read": False})
    return {"unread_count": count}
