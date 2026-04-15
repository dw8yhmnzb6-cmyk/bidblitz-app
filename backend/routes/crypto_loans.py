"""
BidBlitz V2 - Crypto-Backed Loans (Krypto-Kredit)
Nutzer hinterlegen Crypto als Sicherheit, bekommen EUR sofort
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from datetime import datetime, timezone
from core.database import db
from core.security import get_current_user
import secrets

router = APIRouter(prefix="/api/crypto-loans", tags=["crypto-loans"])

COLLATERAL_OPTIONS = [
    {"coin": "BTC", "ltv": 50, "interest": 8.9, "min_collateral": 0.001, "price_eur": 68500},
    {"coin": "ETH", "ltv": 50, "interest": 9.5, "min_collateral": 0.01, "price_eur": 3280},
    {"coin": "SOL", "ltv": 40, "interest": 11.0, "min_collateral": 0.5, "price_eur": 143},
    {"coin": "BNB", "ltv": 40, "interest": 10.5, "min_collateral": 0.1, "price_eur": 520},
    {"coin": "USDT", "ltv": 80, "interest": 5.9, "min_collateral": 50, "price_eur": 1},
]

class LoanRequest(BaseModel):
    collateral_coin: str
    collateral_amount: float = Field(..., gt=0)

@router.get("/options")
async def get_options():
    return {"collaterals": COLLATERAL_OPTIONS}

@router.post("/request")
async def request_loan(req: LoanRequest, request: Request):
    user = await get_current_user(request)
    opt = next((c for c in COLLATERAL_OPTIONS if c["coin"] == req.collateral_coin), None)
    if not opt:
        raise HTTPException(404, "Coin nicht unterstuetzt")
    if req.collateral_amount < opt["min_collateral"]:
        raise HTTPException(400, f"Minimum: {opt['min_collateral']} {opt['coin']}")
    collateral_value = req.collateral_amount * opt["price_eur"]
    loan_amount = round(collateral_value * opt["ltv"] / 100, 2)
    loan = {
        "loan_id": f"loan_{secrets.token_hex(6)}",
        "user_email": user.get("email", ""),
        "collateral_coin": req.collateral_coin,
        "collateral_amount": req.collateral_amount,
        "collateral_value_eur": round(collateral_value, 2),
        "loan_amount_eur": loan_amount,
        "ltv": opt["ltv"],
        "interest_rate": opt["interest"],
        "monthly_interest": round(loan_amount * opt["interest"] / 100 / 12, 2),
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.crypto_loans.insert_one(loan)
    await db.users.update_one({"email": user.get("email", "")}, {"$inc": {"balance": loan_amount}})
    return {"ok": True, "loan_id": loan["loan_id"], "loan_amount": loan_amount,
            "message": f"{loan_amount} EUR Kredit erhalten! Sicherheit: {req.collateral_amount} {req.collateral_coin}"}

@router.get("/my-loans")
async def my_loans(request: Request):
    user = await get_current_user(request)
    loans = await db.crypto_loans.find({"user_email": user.get("email", "")}, {"_id": 0}).sort("created_at", -1).to_list(20)
    return {"loans": loans}

@router.post("/repay/{loan_id}")
async def repay_loan(loan_id: str, request: Request):
    user = await get_current_user(request)
    loan = await db.crypto_loans.find_one({"loan_id": loan_id, "user_email": user.get("email", ""), "status": "active"})
    if not loan:
        raise HTTPException(404, "Kredit nicht gefunden")
    await db.crypto_loans.update_one({"loan_id": loan_id}, {"$set": {"status": "repaid", "repaid_at": datetime.now(timezone.utc).isoformat()}})
    return {"ok": True, "message": f"Kredit {loan['loan_amount_eur']} EUR zurueckgezahlt! Sicherheit freigegeben."}
