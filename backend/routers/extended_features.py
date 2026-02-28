"""
BidBlitz Extended Features:
1. Chat (Fahrer <-> Fahrgast)
2. Food Delivery
4. Treuepunkte (Loyalty)
5. Referral-Programm
7. SOS/Notfall-Button
8. Fahrpreis-Splitting
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import uuid, secrets

from dependencies import get_current_user, get_admin_user
from config import db

router = APIRouter(prefix="/features", tags=["Extended Features"])


# ==================== 1. CHAT ====================

class ChatMessage(BaseModel):
    message: str

@router.post("/chat/{ride_id}/send")
async def send_chat(ride_id: str, data: ChatMessage, user: dict = Depends(get_current_user)):
    ride = await db.taxi_rides.find_one({"id": ride_id})
    if not ride:
        raise HTTPException(404, "Fahrt nicht gefunden")
    if user["id"] not in [ride.get("rider_user_id"), ride.get("driver_user_id")]:
        raise HTTPException(403, "Nicht berechtigt")

    msg = {
        "id": str(uuid.uuid4()), "ride_id": ride_id,
        "sender_id": user["id"], "sender_name": user.get("name"),
        "sender_role": "rider" if user["id"] == ride.get("rider_user_id") else "driver",
        "message": data.message,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.ride_chats.insert_one(msg)
    msg.pop("_id", None)
    return {"success": True, "message": msg}

@router.get("/chat/{ride_id}")
async def get_chat(ride_id: str, user: dict = Depends(get_current_user)):
    msgs = await db.ride_chats.find({"ride_id": ride_id}, {"_id": 0}).sort("created_at", 1).to_list(100)
    return {"messages": msgs}


# ==================== 2. FOOD DELIVERY ====================

class FoodOrder(BaseModel):
    restaurant_name: str
    items: List[dict]  # [{name, qty, price}]
    delivery_address: str
    delivery_lat: float
    delivery_lng: float
    note: Optional[str] = None

@router.get("/food/restaurants")
async def get_food_restaurants():
    restaurants = [
        {"id": "nobu", "name": "Nobu Dubai", "category": "Japanisch", "rating": 4.8, "delivery_fee": 5, "min_order": 30, "delivery_time": "35-45 min", "image": "https://images.unsplash.com/photo-1559339352-11d035aa65de?w=300&q=80"},
        {"id": "zuma", "name": "ZUMA Dubai", "category": "Japanisch", "rating": 4.9, "delivery_fee": 5, "min_order": 40, "delivery_time": "40-50 min", "image": "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=300&q=80"},
        {"id": "la-petite", "name": "La Petite Maison", "category": "Französisch", "rating": 4.7, "delivery_fee": 4, "min_order": 25, "delivery_time": "30-40 min", "image": "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=300&q=80"},
        {"id": "cafe-mozart", "name": "Café Mozart Pristina", "category": "Café", "rating": 4.6, "delivery_fee": 2, "min_order": 10, "delivery_time": "20-30 min", "image": "https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=300&q=80"},
        {"id": "restaurant-peja", "name": "Restaurant Peja", "category": "Kosovarisch", "rating": 4.8, "delivery_fee": 2, "min_order": 15, "delivery_time": "25-35 min", "image": "https://images.unsplash.com/photo-1544148103-0773bf10d330?w=300&q=80"},
        {"id": "burger-king", "name": "Burger King Pristina", "category": "Fast Food", "rating": 4.2, "delivery_fee": 1.5, "min_order": 8, "delivery_time": "15-25 min", "image": "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=300&q=80"},
    ]
    return {"restaurants": restaurants}

@router.post("/food/order")
async def place_food_order(data: FoodOrder, user: dict = Depends(get_current_user)):
    total = sum(item.get("price", 0) * item.get("qty", 1) for item in data.items)
    order = {
        "id": str(uuid.uuid4()), "user_id": user["id"], "user_name": user.get("name"),
        "restaurant_name": data.restaurant_name,
        "items": data.items, "total_cents": int(total * 100),
        "delivery_address": data.delivery_address,
        "delivery_lat": data.delivery_lat, "delivery_lng": data.delivery_lng,
        "note": data.note, "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.food_orders.insert_one(order)
    order.pop("_id", None)
    return {"success": True, "order": order, "message": f"Bestellung bei {data.restaurant_name} aufgegeben!"}

@router.get("/food/my-orders")
async def my_food_orders(user: dict = Depends(get_current_user)):
    orders = await db.food_orders.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(20)
    return {"orders": orders}


# ==================== 4. TREUEPUNKTE ====================

POINTS_PER_RIDE = 10
POINTS_PER_EURO_AUCTION = 5
POINTS_PER_SCOOTER_MIN = 1
POINTS_TO_EUR = 100  # 100 Punkte = 1 EUR

@router.get("/loyalty/my-points")
async def get_loyalty_points(user: dict = Depends(get_current_user)):
    loyalty = await db.loyalty_points.find_one({"user_id": user["id"]}, {"_id": 0})
    if not loyalty:
        loyalty = {"user_id": user["id"], "points": 0, "total_earned": 0, "total_redeemed": 0, "tier": "Bronze"}
    # Determine tier
    total = loyalty.get("total_earned", 0)
    if total >= 5000: loyalty["tier"] = "Platin"
    elif total >= 2000: loyalty["tier"] = "Gold"
    elif total >= 500: loyalty["tier"] = "Silber"
    else: loyalty["tier"] = "Bronze"
    return {"loyalty": loyalty, "exchange_rate": f"{POINTS_TO_EUR} Punkte = 1 EUR"}

@router.post("/loyalty/earn")
async def earn_points(points: int, reason: str, user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc).isoformat()
    await db.loyalty_points.update_one(
        {"user_id": user["id"]},
        {"$inc": {"points": points, "total_earned": points}, "$set": {"updated_at": now}},
        upsert=True
    )
    await db.loyalty_history.insert_one({"id": str(uuid.uuid4()), "user_id": user["id"], "type": "earn", "points": points, "reason": reason, "created_at": now})
    return {"success": True, "message": f"+{points} Punkte ({reason})"}

@router.post("/loyalty/redeem")
async def redeem_points(points: int, user: dict = Depends(get_current_user)):
    loyalty = await db.loyalty_points.find_one({"user_id": user["id"]})
    if not loyalty or loyalty.get("points", 0) < points:
        raise HTTPException(400, "Nicht genug Punkte")
    if points < POINTS_TO_EUR:
        raise HTTPException(400, f"Mindestens {POINTS_TO_EUR} Punkte zum Einlösen")

    eur_cents = int(points / POINTS_TO_EUR * 100)
    now = datetime.now(timezone.utc).isoformat()
    await db.loyalty_points.update_one({"user_id": user["id"]}, {"$inc": {"points": -points, "total_redeemed": points}})
    await db.users.update_one({"id": user["id"]}, {"$inc": {"wallet_balance_cents": eur_cents}})
    await db.loyalty_history.insert_one({"id": str(uuid.uuid4()), "user_id": user["id"], "type": "redeem", "points": -points, "reason": f"{eur_cents/100:.2f} EUR auf Wallet", "created_at": now})
    return {"success": True, "message": f"{points} Punkte eingelöst = {eur_cents/100:.2f} EUR auf Wallet!"}

@router.get("/loyalty/history")
async def loyalty_history(user: dict = Depends(get_current_user)):
    history = await db.loyalty_history.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return {"history": history}


# ==================== 5. REFERRAL ====================

@router.get("/referral/my-code")
async def get_referral_code(user: dict = Depends(get_current_user)):
    ref = await db.referral_codes.find_one({"user_id": user["id"]}, {"_id": 0})
    if not ref:
        code = f"BB-{user['id'][:6].upper()}"
        ref = {"user_id": user["id"], "code": code, "uses": 0, "earned_cents": 0, "created_at": datetime.now(timezone.utc).isoformat()}
        await db.referral_codes.insert_one(ref)
        ref.pop("_id", None)
    return {"referral": ref, "share_text": f"Melde dich bei BidBlitz an mit Code {ref['code']} und bekomme 5 EUR Startguthaben! https://bidblitz.ae/register?ref={ref['code']}"}

@router.post("/referral/apply")
async def apply_referral(code: str, user: dict = Depends(get_current_user)):
    ref = await db.referral_codes.find_one({"code": code.upper()})
    if not ref:
        raise HTTPException(404, "Code nicht gefunden")
    if ref["user_id"] == user["id"]:
        raise HTTPException(400, "Eigener Code nicht nutzbar")
    already = await db.referral_uses.find_one({"user_id": user["id"]})
    if already:
        raise HTTPException(409, "Bereits einen Code genutzt")

    now = datetime.now(timezone.utc).isoformat()
    bonus = 500  # 5 EUR

    # Bonus for new user
    await db.users.update_one({"id": user["id"]}, {"$inc": {"wallet_balance_cents": bonus}})
    # Bonus for referrer
    await db.users.update_one({"id": ref["user_id"]}, {"$inc": {"wallet_balance_cents": bonus}})
    await db.referral_codes.update_one({"code": code.upper()}, {"$inc": {"uses": 1, "earned_cents": bonus}})
    await db.referral_uses.insert_one({"user_id": user["id"], "code": code.upper(), "referrer_id": ref["user_id"], "created_at": now})

    return {"success": True, "message": "5 EUR Bonus gutgeschrieben! Dein Freund bekommt auch 5 EUR."}


# ==================== 7. SOS/NOTFALL ====================

@router.post("/sos/alert")
async def send_sos(user: dict = Depends(get_current_user)):
    ride = await db.taxi_rides.find_one(
        {"$or": [{"rider_user_id": user["id"]}, {"driver_user_id": user["id"]}], "status": {"$in": ["accepted", "arrived", "started"]}},
        {"_id": 0, "tracking": 0}
    )
    alert = {
        "id": str(uuid.uuid4()), "user_id": user["id"], "user_name": user.get("name"),
        "ride_id": ride["id"] if ride else None,
        "ride_status": ride["status"] if ride else None,
        "driver_id": ride.get("driver_user_id") if ride else None,
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.sos_alerts.insert_one(alert)
    alert.pop("_id", None)
    return {"success": True, "alert": alert, "message": "SOS gesendet! Unser Team wird Sie kontaktieren. Bei akuter Gefahr rufen Sie 112 an."}

@router.get("/sos/admin/alerts")
async def admin_sos_alerts(admin: dict = Depends(get_admin_user)):
    alerts = await db.sos_alerts.find({}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return {"alerts": alerts}


# ==================== 8. FAHRPREIS-SPLITTING ====================

class SplitRequest(BaseModel):
    ride_id: str
    split_with_user_ids: List[str]

@router.post("/split/request")
async def request_split(data: SplitRequest, user: dict = Depends(get_current_user)):
    ride = await db.taxi_rides.find_one({"id": data.ride_id, "status": "completed"})
    if not ride:
        raise HTTPException(404, "Fahrt nicht gefunden oder nicht abgeschlossen")

    total = ride.get("final_fare", ride.get("estimated_fare", 0))
    num_people = len(data.split_with_user_ids) + 1
    per_person_cents = int(total * 100 / num_people)
    now = datetime.now(timezone.utc).isoformat()

    split = {
        "id": str(uuid.uuid4()), "ride_id": data.ride_id,
        "requester_id": user["id"], "total_cents": int(total * 100),
        "per_person_cents": per_person_cents, "num_people": num_people,
        "participants": [{"user_id": uid, "status": "pending", "amount_cents": per_person_cents} for uid in data.split_with_user_ids],
        "status": "pending", "created_at": now
    }
    await db.fare_splits.insert_one(split)
    split.pop("_id", None)
    return {"success": True, "split": split, "message": f"Split angefragt: {per_person_cents/100:.2f} EUR pro Person ({num_people} Personen)"}

@router.post("/split/accept/{split_id}")
async def accept_split(split_id: str, user: dict = Depends(get_current_user)):
    split = await db.fare_splits.find_one({"id": split_id})
    if not split:
        raise HTTPException(404, "Split nicht gefunden")

    for p in split.get("participants", []):
        if p["user_id"] == user["id"] and p["status"] == "pending":
            await db.users.update_one({"id": user["id"]}, {"$inc": {"wallet_balance_cents": -p["amount_cents"]}})
            await db.users.update_one({"id": split["requester_id"]}, {"$inc": {"wallet_balance_cents": p["amount_cents"]}})
            await db.fare_splits.update_one(
                {"id": split_id, "participants.user_id": user["id"]},
                {"$set": {"participants.$.status": "paid"}}
            )
            return {"success": True, "message": f"{p['amount_cents']/100:.2f} EUR bezahlt!"}

    raise HTTPException(400, "Nicht Teil dieses Splits")
