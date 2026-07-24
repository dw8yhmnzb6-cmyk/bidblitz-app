"""
BidBlitz V2 - BlitzPark (Parking), Event Tickets, Micro-Credit, Gift Cards, Flash Deals
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timezone, timedelta
from core.database import db
from core.security import get_current_user
import secrets, random

router = APIRouter(prefix="/api/city", tags=["city-services"])

# ═══ BLITZPARK ═══
PARK_FEE = 0.50

class ParkBooking(BaseModel):
    spot_id: str
    hours: float = Field(1, ge=0.5, le=24)

@router.get("/parking/nearby")
async def nearby_parking(lat: float = 52.52, lng: float = 13.405, radius: float = 3):
    spots = await db.parking_spots.find({"status": "available"}, {"_id": 0}).limit(20).to_list(20)
    return {"spots": spots, "total": len(spots)}

@router.post("/parking/book")
async def book_parking(req: ParkBooking, request: Request):
    user = await get_current_user(request)
    email = user.get("email", "")
    spot = await db.parking_spots.find_one({"spot_id": req.spot_id, "status": "available"})
    if not spot: raise HTTPException(404, "Parkplatz nicht verfügbar")
    price = round(spot.get("price_per_hour", 2) * req.hours + PARK_FEE, 2)
    balance = user.get("balance", 0)
    if balance < price: raise HTTPException(400, f"Benötigt: €{price:.2f}")
    await db.users.update_one({"email": email}, {"$inc": {"balance": -price}})
    await db.parking_spots.update_one({"spot_id": req.spot_id}, {"$set": {"status": "occupied", "booked_by": email}})
    booking = {
        "booking_id": secrets.token_hex(6), "user_email": email, "spot_id": req.spot_id,
        "spot_name": spot.get("name", ""), "hours": req.hours, "price": price, "fee": PARK_FEE,
        "status": "active", "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(hours=req.hours)).isoformat(),
    }
    await db.parking_bookings.insert_one(booking)
    return {"ok": True, "price": price, "booking_id": booking["booking_id"],
            "message": f"Parkplatz gebucht für {req.hours}h · €{price:.2f}"}


# ═══ EVENT TICKETS RESELLING ═══
TICKET_FEE = 0.12

class TicketList(BaseModel):
    event_name: str = Field(..., min_length=2, max_length=100)
    venue: str = ""
    event_date: str = ""
    price: float = Field(..., gt=0)
    category: str = "Konzert"
    quantity: int = Field(1, ge=1, le=10)

class TicketBuy(BaseModel):
    ticket_id: str

@router.get("/tickets")
async def get_tickets(category: Optional[str] = None, search: Optional[str] = None):
    query = {"status": "available"}
    if category: query["category"] = category
    if search: query["event_name"] = {"$regex": search, "$options": "i"}
    tickets = await db.event_tickets.find(query, {"_id": 0}).sort("event_date", 1).to_list(30)
    return {"tickets": tickets, "total": len(tickets)}

@router.post("/tickets/list")
async def list_ticket(req: TicketList, request: Request):
    user = await get_current_user(request)
    ticket = {
        "ticket_id": f"tk_{secrets.token_hex(6)}", "seller_email": user.get("email", ""), "seller_name": user.get("name", ""),
        "event_name": req.event_name, "venue": req.venue, "event_date": req.event_date,
        "price": req.price, "category": req.category, "quantity": req.quantity,
        "status": "available", "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.event_tickets.insert_one(ticket)
    ticket.pop("_id", None)
    return {"ok": True, "ticket": ticket}

@router.post("/tickets/buy")
async def buy_ticket(req: TicketBuy, request: Request):
    user = await get_current_user(request)
    email = user.get("email", "")
    ticket = await db.event_tickets.find_one({"ticket_id": req.ticket_id, "status": "available"})
    if not ticket: raise HTTPException(404, "Ticket nicht verfügbar")
    if ticket["seller_email"] == email: raise HTTPException(400, "Eigenes Ticket")
    price = ticket["price"]
    fee = round(price * TICKET_FEE, 2)
    balance = user.get("balance", 0)
    if balance < price: raise HTTPException(400, f"Benötigt: €{price:.2f}")
    await db.users.update_one({"email": email}, {"$inc": {"balance": -price}})
    await db.users.update_one({"email": ticket["seller_email"]}, {"$inc": {"balance": price - fee}})
    await db.event_tickets.update_one({"ticket_id": req.ticket_id}, {"$set": {"status": "sold", "buyer_email": email}})
    return {"ok": True, "message": f"Ticket gekauft für €{price:.2f}!", "fee": fee}


# ═══ MICRO CREDIT / BNPL ═══
CREDIT_FEE = 1.50

class CreditRequest(BaseModel):
    amount: float = Field(..., ge=10, le=100)
    installments: int = Field(4, ge=2, le=6)

@router.post("/credit/apply")
async def apply_micro_credit(req: CreditRequest, request: Request):
    user = await get_current_user(request)
    email = user.get("email", "")
    if not user.get("verified"): raise HTTPException(400, "Nur für verifizierte User")
    existing = await db.micro_credits.find_one({"user_email": email, "status": "active"})
    if existing: raise HTTPException(400, "Bereits ein aktiver Kredit")
    per_installment = round((req.amount + CREDIT_FEE) / req.installments, 2)
    credit = {
        "credit_id": f"cr_{secrets.token_hex(6)}", "user_email": email,
        "amount": req.amount, "fee": CREDIT_FEE, "total": round(req.amount + CREDIT_FEE, 2),
        "installments": req.installments, "per_installment": per_installment,
        "paid_installments": 0, "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.micro_credits.insert_one(credit)
    await db.users.update_one({"email": email}, {"$inc": {"balance": req.amount}})
    return {"ok": True, "amount": req.amount, "per_installment": per_installment,
            "message": f"€{req.amount:.2f} gutgeschrieben! {req.installments}x €{per_installment:.2f}"}

@router.get("/credit/status")
async def credit_status(request: Request):
    user = await get_current_user(request)
    credit = await db.micro_credits.find_one({"user_email": user.get("email", ""), "status": "active"}, {"_id": 0})
    return {"credit": credit}


# ═══ GIFT CARD MARKETPLACE ═══
GIFT_FEE = 0.08

class GiftCardList(BaseModel):
    brand: str = Field(..., min_length=2, max_length=50)
    value: float = Field(..., gt=0)
    price: float = Field(..., gt=0)
    code_hint: str = ""

class GiftCardBuy(BaseModel):
    card_id: str

@router.get("/giftcards")
async def get_giftcards(brand: Optional[str] = None):
    query = {"status": "available"}
    if brand: query["brand"] = {"$regex": brand, "$options": "i"}
    cards = await db.gift_cards.find(query, {"_id": 0}).sort("created_at", -1).to_list(30)
    return {"cards": cards, "total": len(cards)}

@router.post("/giftcards/list")
async def list_giftcard(req: GiftCardList, request: Request):
    user = await get_current_user(request)
    discount = round((1 - req.price / req.value) * 100, 1) if req.value > 0 else 0
    card = {
        "card_id": f"gc_{secrets.token_hex(6)}", "seller_email": user.get("email", ""),
        "brand": req.brand, "value": req.value, "price": req.price, "discount": discount,
        "code_hint": req.code_hint, "status": "available",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.gift_cards.insert_one(card)
    card.pop("_id", None)
    return {"ok": True, "card": card}

@router.post("/giftcards/buy")
async def buy_giftcard(req: GiftCardBuy, request: Request):
    user = await get_current_user(request)
    email = user.get("email", "")
    card = await db.gift_cards.find_one({"card_id": req.card_id, "status": "available"})
    if not card: raise HTTPException(404, "Nicht verfügbar")
    price = card["price"]
    fee = round(price * GIFT_FEE, 2)
    balance = user.get("balance", 0)
    if balance < price: raise HTTPException(400, f"Benötigt: €{price:.2f}")
    await db.users.update_one({"email": email}, {"$inc": {"balance": -price}})
    await db.users.update_one({"email": card["seller_email"]}, {"$inc": {"balance": price - fee}})
    await db.gift_cards.update_one({"card_id": req.card_id}, {"$set": {"status": "sold", "buyer_email": email}})
    return {"ok": True, "message": f"{card['brand']} Karte (€{card['value']}) für €{price:.2f} gekauft!"}


# ═══ FLASH DEALS ═══
DEAL_POST_FEE = 3.0

class FlashDealCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=80)
    description: str = ""
    original_price: float = 0
    deal_price: float = Field(..., gt=0)
    category: str = "Essen"
    duration_hours: int = Field(2, ge=1, le=24)
    max_claims: int = Field(50, ge=1, le=500)

@router.get("/deals")
async def get_flash_deals():
    now = datetime.now(timezone.utc).isoformat()
    deals = await db.flash_deals.find({"status": "active", "expires_at": {"$gt": now}}, {"_id": 0}).sort("created_at", -1).to_list(20)
    return {"deals": deals, "total": len(deals)}

@router.post("/deals/create")
async def create_deal(req: FlashDealCreate, request: Request):
    user = await get_current_user(request)
    email = user.get("email", "")
    balance = user.get("balance", 0)
    if balance < DEAL_POST_FEE: raise HTTPException(400, f"Posting-Gebühr: €{DEAL_POST_FEE:.2f}")
    await db.users.update_one({"email": email}, {"$inc": {"balance": -DEAL_POST_FEE}})
    now = datetime.now(timezone.utc)
    discount = round((1 - req.deal_price / req.original_price) * 100) if req.original_price > 0 else 0
    deal = {
        "deal_id": f"fd_{secrets.token_hex(6)}", "merchant_email": email, "merchant_name": user.get("name", ""),
        "title": req.title, "description": req.description,
        "original_price": req.original_price, "deal_price": req.deal_price, "discount": discount,
        "category": req.category, "claims": 0, "max_claims": req.max_claims,
        "status": "active", "created_at": now.isoformat(),
        "expires_at": (now + timedelta(hours=req.duration_hours)).isoformat(),
    }
    await db.flash_deals.insert_one(deal)
    deal.pop("_id", None)
    return {"ok": True, "deal": deal, "message": f"Deal live für {req.duration_hours}h!"}

@router.post("/deals/claim/{deal_id}")
async def claim_deal(deal_id: str, request: Request):
    user = await get_current_user(request)
    deal = await db.flash_deals.find_one({"deal_id": deal_id, "status": "active"})
    if not deal: raise HTTPException(404, "Deal nicht verfügbar")
    if deal["claims"] >= deal["max_claims"]: raise HTTPException(400, "Ausverkauft!")
    await db.flash_deals.update_one({"deal_id": deal_id}, {"$inc": {"claims": 1}})
    return {"ok": True, "message": f"Deal eingelöst: {deal['title']}!", "deal_price": deal["deal_price"]}
