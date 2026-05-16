"""
BidBlitz Taxi — Lost & Found (iter123 P1-11)
==============================================
Kunden können nach Beendigung einer Fahrt einen Gegenstand als verloren melden.
Driver bekommt Push, Customer und Driver können in einem Mini-Thread chatten.

Models:
  taxi_lostfound_cases {
    id, ride_id, user_id, driver_id, item_description, contact_phone,
    status: 'open'|'driver_responded'|'returned'|'closed',
    created_at, updated_at, messages:[{sender,text,at}]
  }
"""
from __future__ import annotations
from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from core.database import db
from core.security import get_current_user

router = APIRouter(prefix="/api/taxi/lostfound", tags=["taxi-lostfound"])


class CaseCreate(BaseModel):
    ride_id: str
    item_description: str = Field(..., min_length=2, max_length=500)
    contact_phone: Optional[str] = Field(None, max_length=32)


class MessageBody(BaseModel):
    text: str = Field(..., min_length=1, max_length=600)


@router.post("/cases")
async def open_case(payload: CaseCreate, request: Request):
    user = await get_current_user(request)
    uid = str(user.get("_id") or user.get("id"))
    ride = await db.taxi_rides.find_one(
        {"ride_id": payload.ride_id, "user_id": uid}, {"_id": 0, "driver_id": 1},
    )
    if not ride:
        raise HTTPException(404, "Fahrt nicht gefunden")
    doc = {
        "id": str(uuid4()),
        "ride_id": payload.ride_id, "user_id": uid,
        "driver_id": ride.get("driver_id"),
        "item_description": payload.item_description,
        "contact_phone": payload.contact_phone,
        "status": "open",
        "messages": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.taxi_lostfound_cases.insert_one(doc)
    try:
        from utils.onesignal_push import send_to_user, is_configured
        if is_configured() and ride.get("driver_id"):
            await send_to_user(
                ride["driver_id"],
                "Verloren-gemeldet 🔍",
                f"In deiner letzten Fahrt wurde etwas vermisst: {payload.item_description[:60]}",
                data={"type": "lostfound_case", "id": doc["id"]},
            )
    except Exception:
        pass
    doc.pop("_id", None)
    return {"success": True, "case": doc}


@router.get("/cases/mine")
async def list_my_cases(request: Request):
    user = await get_current_user(request)
    uid = str(user.get("_id") or user.get("id"))
    cursor = db.taxi_lostfound_cases.find(
        {"$or": [{"user_id": uid}, {"driver_id": uid}]}, {"_id": 0},
    ).sort("created_at", -1).limit(100)
    return {"items": [c async for c in cursor]}


@router.post("/cases/{cid}/messages")
async def post_message(cid: str, payload: MessageBody, request: Request):
    user = await get_current_user(request)
    uid = str(user.get("_id") or user.get("id"))
    case = await db.taxi_lostfound_cases.find_one(
        {"id": cid, "$or": [{"user_id": uid}, {"driver_id": uid}]}, {"_id": 0},
    )
    if not case:
        raise HTTPException(404, "Case nicht gefunden")
    sender_role = "owner" if case["user_id"] == uid else "driver"
    msg = {"sender": sender_role, "user_id": uid, "text": payload.text,
           "at": datetime.now(timezone.utc).isoformat()}
    new_status = "driver_responded" if sender_role == "driver" and case["status"] == "open" else case["status"]
    await db.taxi_lostfound_cases.update_one(
        {"id": cid},
        {"$push": {"messages": msg},
         "$set": {"updated_at": msg["at"], "status": new_status}},
    )
    return {"success": True, "message": msg}


@router.post("/cases/{cid}/close")
async def close_case(cid: str, request: Request):
    user = await get_current_user(request)
    uid = str(user.get("_id") or user.get("id"))
    await db.taxi_lostfound_cases.update_one(
        {"id": cid, "$or": [{"user_id": uid}, {"driver_id": uid}]},
        {"$set": {"status": "closed", "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    return {"success": True}
