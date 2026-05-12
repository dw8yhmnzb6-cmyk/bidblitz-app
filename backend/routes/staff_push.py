"""
BidBlitz Staff - Push Subscription Management
==============================================
Verbindet Browser/Native Devices (OneSignal Player IDs) mit staff_members.
"""
from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
from uuid import uuid4
import os
from motor.motor_asyncio import AsyncIOMotorClient

router = APIRouter(prefix="/api/staff/push", tags=["staff-push"])
client = AsyncIOMotorClient(os.getenv("MONGO_URL"))
db = client[os.getenv("DB_NAME", "bidblitz")]


class PushRegister(BaseModel):
    player_id: str
    platform: Optional[str] = "web"


async def _staff(request: Request) -> dict:
    sid = request.cookies.get("staff_session")
    if not sid:
        raise HTTPException(401, "Nicht angemeldet")
    m = await db.staff_members.find_one({"id": sid, "active": True}, {"_id": 0})
    if not m:
        raise HTTPException(401, "Session ungültig")
    return m


@router.get("/status")
async def push_status():
    from utils.onesignal_push import is_configured, ONESIGNAL_APP_ID
    return {
        "configured": is_configured(),
        "app_id": ONESIGNAL_APP_ID if is_configured() else None,
    }


@router.post("/register")
async def register_device(req: PushRegister, member=Depends(_staff)):
    doc = {
        "id": str(uuid4()),
        "merchant_id": member["merchant_id"],
        "staff_id": member["id"],
        "player_id": req.player_id,
        "platform": req.platform or "web",
        "active": True,
        "registered_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.staff_push_devices.update_one(
        {"player_id": req.player_id},
        {"$set": doc},
        upsert=True,
    )
    return {"success": True, "registered": True}


@router.delete("/unregister/{player_id}")
async def unregister_device(player_id: str, member=Depends(_staff)):
    await db.staff_push_devices.update_one(
        {"player_id": player_id, "staff_id": member["id"]},
        {"$set": {"active": False, "unregistered_at": datetime.now(timezone.utc).isoformat()}},
    )
    return {"success": True}


@router.post("/test")
async def send_test_push(member=Depends(_staff)):
    from utils.onesignal_push import send_to_staff, is_configured
    if not is_configured():
        raise HTTPException(503, "OneSignal nicht konfiguriert (ONESIGNAL_APP_ID/API_KEY)")
    res = await send_to_staff(member["id"], "BidBlitz Staff", "Test-Push erfolgreich")
    return {"success": True, "result": res}
