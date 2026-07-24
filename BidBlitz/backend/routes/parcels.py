"""
BidBlitz V2 - Paketversand
Preisvergleich DHL/Hermes/DPD/UPS + Buchung per Wallet + Tracking
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from core.database import db
from core.security import get_current_user
import secrets, random

router = APIRouter(prefix="/api/parcels", tags=["parcels"])

CASHBACK_RATE = 0.01

CARRIERS = [
    {"id": "dhl", "name": "DHL", "color": "#FFCC00", "logo": "https://images.unsplash.com/photo-1616432043562-3671ea2e5571?w=100&q=80", "base_price": 4.99, "kg_price": 0.80, "delivery_days": "1-2"},
    {"id": "hermes", "name": "Hermes", "color": "#00A0E1", "logo": "", "base_price": 3.89, "kg_price": 0.60, "delivery_days": "2-3"},
    {"id": "dpd", "name": "DPD", "color": "#DC0032", "logo": "", "base_price": 4.49, "kg_price": 0.70, "delivery_days": "1-3"},
    {"id": "ups", "name": "UPS", "color": "#351C15", "logo": "", "base_price": 6.99, "kg_price": 1.20, "delivery_days": "1-2"},
    {"id": "gls", "name": "GLS", "color": "#003DA5", "logo": "", "base_price": 4.29, "kg_price": 0.65, "delivery_days": "2-4"},
]


class ParcelQuote(BaseModel):
    weight: float = Field(..., gt=0, le=31.5)
    length: float = 30
    width: float = 20
    height: float = 15
    origin_zip: str = ""
    dest_zip: str = ""


class ParcelBook(BaseModel):
    carrier_id: str
    weight: float = Field(..., gt=0)
    sender_name: str = ""
    sender_address: str = ""
    sender_zip: str = ""
    sender_city: str = ""
    recipient_name: str = ""
    recipient_address: str = ""
    recipient_zip: str = ""
    recipient_city: str = ""


class TrackingLookup(BaseModel):
    tracking_number: str


@router.get("/carriers")
async def get_carriers():
    return {"carriers": CARRIERS}


@router.post("/quote")
async def get_quotes(req: ParcelQuote, request: Request):
    quotes = []
    for c in CARRIERS:
        price = round(c["base_price"] + req.weight * c["kg_price"], 2)
        # Size surcharge
        vol = (req.length * req.width * req.height) / 1000
        if vol > 20:
            price = round(price * 1.3, 2)
        quotes.append({
            "carrier_id": c["id"],
            "carrier_name": c["name"],
            "color": c["color"],
            "price": price,
            "delivery_days": c["delivery_days"],
            "weight": req.weight,
        })
    quotes.sort(key=lambda x: x["price"])
    return {"quotes": quotes}


@router.post("/book")
async def book_parcel(req: ParcelBook, request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])

    carrier = next((c for c in CARRIERS if c["id"] == req.carrier_id), None)
    if not carrier:
        raise HTTPException(status_code=404, detail="Carrier nicht gefunden")

    price = round(carrier["base_price"] + req.weight * carrier["kg_price"], 2)

    balance = user.get("balance", 0)
    if balance < price:
        raise HTTPException(status_code=400, detail=f"Nicht genug Guthaben (€{price:.2f})")

    await db.users.update_one({"_id": user["_id"], "balance": {"$gte": price}}, {"$inc": {"balance": -price}})

    cashback = round(price * CASHBACK_RATE, 2)
    if cashback > 0:
        await db.users.update_one({"_id": user["_id"]}, {"$inc": {"balance": cashback}})

    now = datetime.now(timezone.utc).isoformat()
    parcel_id = secrets.token_hex(8)
    tracking = f"{carrier['id'].upper()}{secrets.token_hex(5).upper()}"
    ref = f"PKG-{secrets.token_hex(4).upper()}"

    parcel = {
        "parcel_id": parcel_id,
        "tracking_number": tracking,
        "carrier_id": req.carrier_id,
        "carrier_name": carrier["name"],
        "weight": req.weight,
        "price": price,
        "cashback": cashback,
        "sender_name": req.sender_name,
        "sender_address": req.sender_address,
        "sender_zip": req.sender_zip,
        "sender_city": req.sender_city,
        "recipient_name": req.recipient_name,
        "recipient_address": req.recipient_address,
        "recipient_zip": req.recipient_zip,
        "recipient_city": req.recipient_city,
        "user_id": user_id,
        "status": "label_created",
        "tracking_events": [
            {"status": "label_created", "message": "Versandlabel erstellt", "timestamp": now},
        ],
        "reference": ref,
        "created_at": now,
    }
    await db.parcels.insert_one(parcel)
    parcel.pop("_id", None)

    await db.transactions.insert_one({
        "id": parcel_id, "user_id": user_id, "type": "parcel_shipping",
        "amount": -price, "description": f"Paket: {carrier['name']} ({req.weight}kg) → {req.recipient_city}",
        "status": "completed", "reference": ref, "category": "parcel", "created_at": now,
    })

    return {"ok": True, "parcel": parcel}


@router.get("/my-parcels")
async def my_parcels(request: Request):
    user = await get_current_user(request)
    parcels = await db.parcels.find(
        {"user_id": str(user["_id"])}, {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    return {"parcels": parcels}


@router.get("/track/{tracking_number}")
async def track_parcel(tracking_number: str):
    p = await db.parcels.find_one({"tracking_number": tracking_number.upper()}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Sendung nicht gefunden")
    return p
