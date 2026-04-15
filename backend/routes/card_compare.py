"""BidBlitz V2 - Kreditkarten-Vergleich"""
from fastapi import APIRouter, Request
from core.security import get_current_user
import secrets
from datetime import datetime, timezone
from core.database import db

router = APIRouter(prefix="/api/card-compare", tags=["card-compare"])

CARDS = [
    {"id": "cc1", "name": "BidBlitz Visa Gold", "bank": "BidBlitz", "cashback": 3, "fee": 0, "bonus": "50 EUR Startguthaben", "limit": 5000, "color": "#F59E0B", "affiliate": 80},
    {"id": "cc2", "name": "N26 Metal", "bank": "N26", "cashback": 0.5, "fee": 16.90, "bonus": "Reiseversicherung inkl.", "limit": 10000, "color": "#1a1a1a", "affiliate": 120},
    {"id": "cc3", "name": "DKB Visa Debit", "bank": "DKB", "cashback": 0, "fee": 0, "bonus": "Weltweit kostenlos abheben", "limit": 3000, "color": "#0066B3", "affiliate": 60},
    {"id": "cc4", "name": "Amex Payback", "bank": "American Express", "cashback": 1, "fee": 0, "bonus": "4000 Payback Punkte", "limit": 7500, "color": "#016FD0", "affiliate": 150},
    {"id": "cc5", "name": "Crypto.com Ruby", "bank": "Crypto.com", "cashback": 2, "fee": 0, "bonus": "Spotify gratis", "limit": 5000, "color": "#C41E3A", "affiliate": 100},
    {"id": "cc6", "name": "Revolut Premium", "bank": "Revolut", "cashback": 1, "fee": 9.99, "bonus": "Lounge-Pass + Versicherung", "limit": 8000, "color": "#0075EB", "affiliate": 90},
]

@router.get("/cards")
async def get_cards():
    return {"cards": CARDS}

@router.post("/apply/{card_id}")
async def apply_card(card_id: str, request: Request):
    user = await get_current_user(request)
    card = next((c for c in CARDS if c["id"] == card_id), None)
    if not card: return {"ok": False, "message": "Karte nicht gefunden"}
    await db.card_applications.insert_one({"user_email": user.get("email",""), "card_id": card_id, "card_name": card["name"], "affiliate_revenue": card["affiliate"], "created_at": datetime.now(timezone.utc).isoformat()})
    return {"ok": True, "message": f"Antrag fuer {card['name']} eingereicht! Du wirst weitergeleitet."}
