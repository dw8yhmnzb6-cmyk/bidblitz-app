"""BidBlitz V2 - Daily Gluecksrad (Spin Wheel)"""
from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timezone
from core.database import db
from core.security import get_current_user
import random

router = APIRouter(prefix="/api/daily-spin", tags=["daily-spin"])

PRIZES = [
    {"label": "0.10 EUR", "value": 0.10, "weight": 30, "color": "#6B7280", "type": "cash"},
    {"label": "0.50 EUR", "value": 0.50, "weight": 25, "color": "#22C55E", "type": "cash"},
    {"label": "1.00 EUR", "value": 1.00, "weight": 15, "color": "#3B82F6", "type": "cash"},
    {"label": "2.00 EUR", "value": 2.00, "weight": 10, "color": "#8B5CF6", "type": "cash"},
    {"label": "5.00 EUR", "value": 5.00, "weight": 5, "color": "#F59E0B", "type": "cash"},
    {"label": "2x Cashback", "value": 0, "weight": 8, "color": "#EC4899", "type": "boost"},
    {"label": "Nochmal drehen!", "value": 0, "weight": 5, "color": "#06B6D4", "type": "respin"},
    {"label": "50 EUR JACKPOT", "value": 50.00, "weight": 2, "color": "#EF4444", "type": "jackpot"},
]

@router.get("/status")
async def spin_status(request: Request):
    user = await get_current_user(request)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    spin = await db.daily_spins.find_one({"user_email": user.get("email",""), "date": today})
    return {"can_spin": spin is None, "today_prize": spin.get("prize_label") if spin else None, "prizes": [{"label": p["label"], "color": p["color"]} for p in PRIZES]}

@router.post("/spin")
async def spin(request: Request):
    user = await get_current_user(request)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    existing = await db.daily_spins.find_one({"user_email": user.get("email",""), "date": today})
    if existing:
        raise HTTPException(400, "Du hast heute schon gedreht! Komm morgen wieder.")
    weights = [p["weight"] for p in PRIZES]
    prize = random.choices(PRIZES, weights=weights, k=1)[0]
    await db.daily_spins.insert_one({"user_email": user.get("email",""), "date": today, "prize_label": prize["label"], "prize_value": prize["value"], "prize_type": prize["type"], "created_at": datetime.now(timezone.utc).isoformat()})
    if prize["value"] > 0:
        await db.users.update_one({"email": user.get("email","")}, {"$inc": {"balance": prize["value"]}})
    return {"ok": True, "prize": prize["label"], "value": prize["value"], "type": prize["type"], "color": prize["color"],
            "message": f"Gewonnen: {prize['label']}!" if prize["value"] > 0 else f"{prize['label']}!"}
