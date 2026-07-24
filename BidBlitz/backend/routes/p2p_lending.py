"""
BidBlitz V2 - P2P Lending (Privatkredite)
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from datetime import datetime, timezone
from core.database import db
from core.security import get_current_user
import secrets

router = APIRouter(prefix="/api/p2p-lending", tags=["p2p-lending"])

class CreateOffer(BaseModel):
    amount_eur: float = Field(..., gt=0, le=5000)
    interest_rate: float = Field(..., ge=1, le=25)
    term_months: int = Field(..., ge=1, le=24)
    description: str = ""

class FundLoan(BaseModel):
    offer_id: str

@router.get("/offers")
async def list_offers():
    offers = await db.p2p_offers.find({"status": "open"}, {"_id": 0}).sort("created_at", -1).to_list(30)
    return {"offers": offers}

@router.post("/create")
async def create_offer(req: CreateOffer, request: Request):
    user = await get_current_user(request)
    offer = {
        "offer_id": f"p2p_{secrets.token_hex(6)}",
        "borrower_email": user.get("email", ""),
        "borrower_name": user.get("name", "Anonym"),
        "amount_eur": req.amount_eur,
        "interest_rate": req.interest_rate,
        "term_months": req.term_months,
        "monthly_payment": round(req.amount_eur * (1 + req.interest_rate / 100) / req.term_months, 2),
        "description": req.description or "Privatkredit",
        "status": "open",
        "funded_by": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.p2p_offers.insert_one(offer)
    return {"ok": True, "offer_id": offer["offer_id"], "message": f"Kreditanfrage ueber {req.amount_eur} EUR erstellt!"}

@router.post("/fund")
async def fund_loan(req: FundLoan, request: Request):
    user = await get_current_user(request)
    offer = await db.p2p_offers.find_one({"offer_id": req.offer_id, "status": "open"})
    if not offer:
        raise HTTPException(404, "Angebot nicht gefunden")
    if offer["borrower_email"] == user.get("email", ""):
        raise HTTPException(400, "Du kannst deinen eigenen Kredit nicht finanzieren")
    await db.p2p_offers.update_one({"offer_id": req.offer_id}, {"$set": {
        "status": "funded", "funded_by": user.get("email", ""), "funded_at": datetime.now(timezone.utc).isoformat()
    }})
    await db.users.update_one({"email": offer["borrower_email"]}, {"$inc": {"balance": offer["amount_eur"]}})
    fee = round(offer["amount_eur"] * 0.03, 2)
    return {"ok": True, "fee": fee, "message": f"Kredit ueber {offer['amount_eur']} EUR finanziert! Gebuehr: {fee} EUR"}

@router.get("/my-activity")
async def my_activity(request: Request):
    user = await get_current_user(request)
    email = user.get("email", "")
    borrowed = await db.p2p_offers.find({"borrower_email": email}, {"_id": 0}).to_list(20)
    funded = await db.p2p_offers.find({"funded_by": email}, {"_id": 0}).to_list(20)
    return {"borrowed": borrowed, "funded": funded}
