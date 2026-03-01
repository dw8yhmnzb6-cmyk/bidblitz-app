"""
Extended Services: Hotel, Insurance, Crypto, Gutschein-Marktplatz, Parking, P2P Transfer
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import uuid

from dependencies import get_current_user, get_admin_user
from config import db

router = APIRouter(prefix="/services", tags=["Extended Services"])


# ==================== 1. HOTEL BOOKING ====================

@router.get("/hotels")
async def get_hotels():
    return {"hotels": [
        {"id": "atlantis", "name": "Atlantis The Palm", "city": "Dubai", "stars": 5, "price_from": 350, "image": "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=300&q=80", "rating": 4.8},
        {"id": "burj-al-arab", "name": "Burj Al Arab", "city": "Dubai", "stars": 7, "price_from": 1500, "image": "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=300&q=80", "rating": 4.9},
        {"id": "address-downtown", "name": "Address Downtown", "city": "Dubai", "stars": 5, "price_from": 280, "image": "https://images.unsplash.com/photo-1518684079-3c830dcef090?w=300&q=80", "rating": 4.7},
        {"id": "swiss-diamond", "name": "Swiss Diamond Pristina", "city": "Pristina", "stars": 5, "price_from": 95, "image": "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=300&q=80", "rating": 4.5},
        {"id": "emerald", "name": "Hotel Emerald", "city": "Pristina", "stars": 4, "price_from": 65, "image": "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=300&q=80", "rating": 4.3},
        {"id": "grand-pristina", "name": "Grand Hotel Pristina", "city": "Pristina", "stars": 4, "price_from": 75, "image": "https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=300&q=80", "rating": 4.4},
    ]}

class HotelBooking(BaseModel):
    hotel_id: str
    check_in: str
    check_out: str
    guests: int = 2
    room_type: str = "standard"

@router.post("/hotels/book")
async def book_hotel(data: HotelBooking, user: dict = Depends(get_current_user)):
    booking = {"id": str(uuid.uuid4()), "user_id": user["id"], "hotel_id": data.hotel_id, "check_in": data.check_in, "check_out": data.check_out, "guests": data.guests, "room_type": data.room_type, "status": "confirmed", "created_at": datetime.now(timezone.utc).isoformat()}
    await db.hotel_bookings.insert_one(booking)
    booking.pop("_id", None)
    return {"success": True, "booking": booking, "message": "Hotel gebucht!"}


# ==================== 2. INSURANCE ====================

@router.get("/insurance/plans")
async def get_insurance_plans():
    return {"plans": [
        {"id": "travel-basic", "name": "Reiseversicherung Basic", "price": 9.90, "coverage": "Reiserücktritt + Gepäck", "duration": "pro Reise"},
        {"id": "travel-premium", "name": "Reiseversicherung Premium", "price": 24.90, "coverage": "Alles + Kranken + Unfall", "duration": "pro Reise"},
        {"id": "scooter-monthly", "name": "Scooter-Versicherung", "price": 4.90, "coverage": "Unfall + Haftpflicht beim Scooterfahren", "duration": "monatlich"},
        {"id": "phone-protect", "name": "Handy-Schutz", "price": 7.90, "coverage": "Display + Wasserschaden + Diebstahl", "duration": "monatlich"},
    ]}

class InsuranceBuy(BaseModel):
    plan_id: str

@router.post("/insurance/buy")
async def buy_insurance(data: InsuranceBuy, user: dict = Depends(get_current_user)):
    policy = {"id": str(uuid.uuid4()), "user_id": user["id"], "plan_id": data.plan_id, "status": "active", "created_at": datetime.now(timezone.utc).isoformat()}
    await db.insurance_policies.insert_one(policy)
    policy.pop("_id", None)
    return {"success": True, "policy": policy, "message": "Versicherung abgeschlossen!"}


# ==================== 3. CRYPTO WALLET ====================

@router.get("/crypto/balance")
async def get_crypto_balance(user: dict = Depends(get_current_user)):
    wallet = await db.crypto_wallets.find_one({"user_id": user["id"]}, {"_id": 0})
    if not wallet:
        wallet = {"user_id": user["id"], "btc": 0, "eth": 0, "usdt": 0}
    return {"wallet": wallet, "rates": {"btc_eur": 95000, "eth_eur": 3200, "usdt_eur": 0.92}}

class CryptoBuy(BaseModel):
    coin: str  # btc, eth, usdt
    amount_eur: float

@router.post("/crypto/buy")
async def buy_crypto(data: CryptoBuy, user: dict = Depends(get_current_user)):
    rates = {"btc": 95000, "eth": 3200, "usdt": 0.92}
    rate = rates.get(data.coin)
    if not rate:
        raise HTTPException(400, "Unbekannte Währung")
    coins = round(data.amount_eur / rate, 8)
    cents = int(data.amount_eur * 100)
    
    balance = user.get("wallet_balance_cents", 0)
    if balance < cents:
        raise HTTPException(402, "Nicht genug Guthaben")
    
    await db.users.update_one({"id": user["id"]}, {"$inc": {"wallet_balance_cents": -cents}})
    await db.crypto_wallets.update_one({"user_id": user["id"]}, {"$inc": {data.coin: coins}}, upsert=True)
    return {"success": True, "bought": coins, "coin": data.coin, "message": f"{coins} {data.coin.upper()} gekauft!"}


# ==================== 4. GUTSCHEIN-MARKTPLATZ ====================

@router.get("/marketplace")
async def get_marketplace():
    listings = await db.voucher_marketplace.find({"status": "active"}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return {"listings": listings}

class VoucherListing(BaseModel):
    title: str
    description: str
    value_eur: float
    price_eur: float

@router.post("/marketplace/list")
async def list_voucher(data: VoucherListing, user: dict = Depends(get_current_user)):
    listing = {"id": str(uuid.uuid4()), "seller_id": user["id"], "seller_name": user.get("name"), "title": data.title, "description": data.description, "value_eur": data.value_eur, "price_eur": data.price_eur, "status": "active", "created_at": datetime.now(timezone.utc).isoformat()}
    await db.voucher_marketplace.insert_one(listing)
    listing.pop("_id", None)
    return {"success": True, "listing": listing}

@router.post("/marketplace/buy/{listing_id}")
async def buy_voucher(listing_id: str, user: dict = Depends(get_current_user)):
    listing = await db.voucher_marketplace.find_one({"id": listing_id, "status": "active"})
    if not listing:
        raise HTTPException(404, "Nicht gefunden")
    cents = int(listing["price_eur"] * 100)
    if user.get("wallet_balance_cents", 0) < cents:
        raise HTTPException(402, "Nicht genug Guthaben")
    
    await db.users.update_one({"id": user["id"]}, {"$inc": {"wallet_balance_cents": -cents}})
    await db.users.update_one({"id": listing["seller_id"]}, {"$inc": {"wallet_balance_cents": cents}})
    await db.voucher_marketplace.update_one({"id": listing_id}, {"$set": {"status": "sold", "buyer_id": user["id"]}})
    return {"success": True, "message": f"Gutschein für {listing['price_eur']} EUR gekauft!"}


# ==================== 5. PARKING ====================

@router.get("/parking/nearby")
async def get_parking(lat: float = 42.663, lng: float = 21.165):
    spots = [
        {"id": "p1", "name": "Parking Zentrum Pristina", "address": "Nene Tereza Blvd", "lat": 42.6625, "lng": 21.1645, "price_per_hour": 1.0, "free_spots": 23, "total": 50},
        {"id": "p2", "name": "Grand Hotel Parking", "address": "Sheshi Nene Tereza", "lat": 42.6612, "lng": 21.1635, "price_per_hour": 1.5, "free_spots": 8, "total": 30},
        {"id": "p3", "name": "Albi Mall Parking", "address": "Rruga B", "lat": 42.6485, "lng": 21.1595, "price_per_hour": 0.5, "free_spots": 145, "total": 200},
        {"id": "p4", "name": "Dubai Mall Parking", "address": "Financial Center Rd", "lat": 25.1985, "lng": 55.2796, "price_per_hour": 2.0, "free_spots": 500, "total": 2000},
    ]
    return {"spots": spots}

class ParkingSession(BaseModel):
    spot_id: str
    duration_hours: int = 1

@router.post("/parking/start")
async def start_parking(data: ParkingSession, user: dict = Depends(get_current_user)):
    session = {"id": str(uuid.uuid4()), "user_id": user["id"], "spot_id": data.spot_id, "hours": data.duration_hours, "status": "active", "started_at": datetime.now(timezone.utc).isoformat()}
    await db.parking_sessions.insert_one(session)
    session.pop("_id", None)
    return {"success": True, "session": session, "message": f"Parkplatz für {data.duration_hours}h gebucht!"}


# ==================== 6. P2P GELD SENDEN ====================

class P2PTransfer(BaseModel):
    to_email: str
    amount: float
    note: Optional[str] = None

@router.post("/transfer")
async def send_money(data: P2PTransfer, user: dict = Depends(get_current_user)):
    if data.amount <= 0:
        raise HTTPException(400, "Betrag muss positiv sein")
    cents = int(data.amount * 100)
    if user.get("wallet_balance_cents", 0) < cents:
        raise HTTPException(402, "Nicht genug Guthaben")
    
    recipient = await db.users.find_one({"email": data.to_email}, {"_id": 0, "id": 1, "name": 1})
    if not recipient:
        raise HTTPException(404, "Empfänger nicht gefunden")
    if recipient["id"] == user["id"]:
        raise HTTPException(400, "Kann nicht an sich selbst senden")
    
    now = datetime.now(timezone.utc).isoformat()
    await db.users.update_one({"id": user["id"]}, {"$inc": {"wallet_balance_cents": -cents}})
    await db.users.update_one({"id": recipient["id"]}, {"$inc": {"wallet_balance_cents": cents}})
    
    tx = {"id": str(uuid.uuid4()), "from_id": user["id"], "from_name": user.get("name"), "to_id": recipient["id"], "to_name": recipient["name"], "to_email": data.to_email, "amount_cents": cents, "note": data.note, "created_at": now}
    await db.p2p_transfers.insert_one(tx)
    tx.pop("_id", None)
    return {"success": True, "transfer": tx, "message": f"{data.amount:.2f} EUR an {recipient['name']} gesendet!"}

@router.get("/transfers")
async def get_transfers(user: dict = Depends(get_current_user)):
    txs = await db.p2p_transfers.find({"$or": [{"from_id": user["id"]}, {"to_id": user["id"]}]}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return {"transfers": txs}
