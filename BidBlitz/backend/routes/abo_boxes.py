"""BidBlitz V2 - Abo-Boxen (Subscription Boxes)"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from datetime import datetime, timezone
from core.database import db
from core.security import get_current_user
import secrets

router = APIRouter(prefix="/api/abo-boxes", tags=["abo-boxes"])

BOXES = [
    {"id": "snack", "name": "Snack Box", "desc": "Internationale Snacks & Suessigkeiten", "price": 14.99, "items_count": "8-12 Snacks", "color": "#F59E0B", "popular": True},
    {"id": "gaming", "name": "Gaming Box", "desc": "Gaming-Merch, Codes & Collectibles", "price": 24.99, "items_count": "5-8 Items", "color": "#8B5CF6", "popular": True},
    {"id": "beauty", "name": "Beauty Box", "desc": "Skincare, Makeup & Pflege-Produkte", "price": 19.99, "items_count": "6-10 Produkte", "color": "#EC4899", "popular": False},
    {"id": "crypto", "name": "Crypto Merch Box", "desc": "Bitcoin-Hoodie, Sticker, Hardware", "price": 29.99, "items_count": "4-6 Items", "color": "#F7931A", "popular": False},
    {"id": "fitness", "name": "Fitness Box", "desc": "Supplements, Shaker & Workout-Gear", "price": 22.99, "items_count": "5-8 Produkte", "color": "#EF4444", "popular": False},
    {"id": "mystery", "name": "Mystery Premium Box", "desc": "Ueberraschung! Wert mind. 3x Preis", "price": 39.99, "items_count": "???", "color": "#0EA5E9", "popular": True},
]

class SubscribeBox(BaseModel):
    box_id: str

@router.get("/list")
async def list_boxes():
    return {"boxes": BOXES}

@router.post("/subscribe")
async def subscribe_box(req: SubscribeBox, request: Request):
    user = await get_current_user(request)
    box = next((b for b in BOXES if b["id"] == req.box_id), None)
    if not box: raise HTTPException(404, "Box nicht gefunden")
    sub = {"sub_id": f"box_{secrets.token_hex(6)}", "user_email": user.get("email",""), "box_id": req.box_id, "box_name": box["name"],
           "price": box["price"], "status": "active", "next_delivery": "2026-05-01", "created_at": datetime.now(timezone.utc).isoformat()}
    await db.box_subscriptions.insert_one(sub)
    return {"ok": True, "message": f"{box['name']} abonniert fuer {box['price']} EUR/Mo! Erste Lieferung am 1. Mai."}

@router.get("/my-subs")
async def my_subs(request: Request):
    user = await get_current_user(request)
    subs = await db.box_subscriptions.find({"user_email": user.get("email",""), "status": "active"}, {"_id": 0}).to_list(10)
    return {"subscriptions": subs}

@router.post("/cancel/{sub_id}")
async def cancel_sub(sub_id: str, request: Request):
    user = await get_current_user(request)
    await db.box_subscriptions.update_one({"sub_id": sub_id, "user_email": user.get("email","")}, {"$set": {"status": "cancelled"}})
    return {"ok": True, "message": "Abo gekuendigt!"}
