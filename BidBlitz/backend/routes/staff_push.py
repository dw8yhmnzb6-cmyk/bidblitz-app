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



class PrefUpdate(BaseModel):
    shift_reminders: Optional[bool] = None
    task_assigned: Optional[bool] = None
    bonus_received: Optional[bool] = None
    warnings: Optional[bool] = None


@router.get("/preferences")
async def get_preferences(member=Depends(_staff)):
    p = await db.staff_push_prefs.find_one({"staff_id": member["id"]}, {"_id": 0})
    if not p:
        p = {"staff_id": member["id"], "shift_reminders": True, "task_assigned": True, "bonus_received": True, "warnings": True}
    return {"success": True, "preferences": p}


@router.post("/preferences")
async def update_preferences(req: PrefUpdate, member=Depends(_staff)):
    update = {k: v for k, v in req.model_dump().items() if v is not None}
    if not update:
        return {"success": True, "no_change": True}
    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.staff_push_prefs.update_one(
        {"staff_id": member["id"]},
        {"$set": {"staff_id": member["id"], "merchant_id": member["merchant_id"], **update}},
        upsert=True,
    )
    return {"success": True, "updated": list(update.keys())}


@router.get("/devices/me")
async def my_devices(member=Depends(_staff)):
    devices = await db.staff_push_devices.find(
        {"staff_id": member["id"], "active": True}, {"_id": 0}
    ).to_list(length=20)
    return {"success": True, "devices": devices, "count": len(devices)}
