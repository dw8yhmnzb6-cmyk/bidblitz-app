"""
BidBlitz V2 - BlitzPay NFC Contactless Payment System
User holds phone to terminal — instant payment via BidBlitz Wallet
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from datetime import datetime, timezone
from core.database import db
from core.security import get_current_user
import secrets, hashlib

router = APIRouter(prefix="/api/blitzpay", tags=["blitzpay-nfc"])


class NFCPayment(BaseModel):
    nfc_token: str
    amount: float = Field(..., gt=0, le=10000)
    merchant_id: str = ""
    description: str = ""


class GenerateNFCToken(BaseModel):
    pin: str = ""  # Optional PIN for security


class MerchantCharge(BaseModel):
    customer_nfc_token: str
    amount: float = Field(..., gt=0, le=10000)
    description: str = ""


@router.post("/generate-token")
async def generate_nfc_token(req: GenerateNFCToken, request: Request):
    """Generate a unique NFC payment token for the user's device."""
    user = await get_current_user(request)
    email = user.get("email", "")
    
    # Create unique NFC token
    raw = f"{email}:{secrets.token_hex(16)}:{datetime.now(timezone.utc).isoformat()}"
    token = hashlib.sha256(raw.encode()).hexdigest()[:24].upper()
    formatted = f"BPY-{token[:4]}-{token[4:8]}-{token[8:12]}"
    
    nfc_data = {
        "user_email": email,
        "nfc_token": formatted,
        "pin_hash": hashlib.sha256(req.pin.encode()).hexdigest() if req.pin else None,
        "active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "last_used": None,
        "total_payments": 0,
        "total_spent": 0,
    }
    
    # Deactivate old tokens
    await db.nfc_tokens.update_many({"user_email": email}, {"$set": {"active": False}})
    await db.nfc_tokens.insert_one(nfc_data)
    
    return {
        "ok": True,
        "nfc_token": formatted,
        "message": "NFC-Token generiert! Halte dein Handy ans Terminal.",
    }


@router.get("/my-token")
async def get_my_token(request: Request):
    """Get current user's active NFC token."""
    user = await get_current_user(request)
    token = await db.nfc_tokens.find_one(
        {"user_email": user.get("email", ""), "active": True}, {"_id": 0}
    )
    if not token:
        return {"has_token": False, "token": None}
    return {
        "has_token": True,
        "token": token["nfc_token"],
        "total_payments": token.get("total_payments", 0),
        "total_spent": round(token.get("total_spent", 0), 2),
        "last_used": token.get("last_used"),
    }


@router.post("/pay")
async def nfc_payment(req: NFCPayment, request: Request):
    """Process an NFC contactless payment."""
    # Find token
    token_doc = await db.nfc_tokens.find_one({"nfc_token": req.nfc_token, "active": True})
    if not token_doc:
        raise HTTPException(404, "NFC-Token ungültig")
    
    email = token_doc["user_email"]
    user = await db.users.find_one({"email": email})
    if not user:
        raise HTTPException(404, "User nicht gefunden")
    
    balance = user.get("balance", 0)
    if balance < req.amount:
        raise HTTPException(400, f"Nicht genug Guthaben: €{balance:.2f} (benötigt: €{req.amount:.2f})")
    
    # Deduct balance
    await db.users.update_one({"email": email}, {"$inc": {"balance": -req.amount}})
    
    # Update token stats
    await db.nfc_tokens.update_one(
        {"nfc_token": req.nfc_token},
        {"$set": {"last_used": datetime.now(timezone.utc).isoformat()},
         "$inc": {"total_payments": 1, "total_spent": req.amount}}
    )
    
    # Record transaction
    tx = {
        "tx_id": f"nfc_{secrets.token_hex(6)}",
        "type": "nfc_payment",
        "user_email": email,
        "merchant_id": req.merchant_id,
        "amount": req.amount,
        "description": req.description or "NFC Kontaktlos-Zahlung",
        "nfc_token": req.nfc_token,
        "status": "completed",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.nfc_transactions.insert_one(tx)
    
    new_balance = round(balance - req.amount, 2)
    
    return {
        "ok": True,
        "amount": req.amount,
        "new_balance": new_balance,
        "tx_id": tx["tx_id"],
        "message": f"€{req.amount:.2f} bezahlt via BlitzPay NFC!",
    }


@router.post("/merchant-charge")
async def merchant_charge(req: MerchantCharge, request: Request):
    """Merchant charges a customer via their NFC token."""
    merchant = await get_current_user(request)
    if merchant.get("role") not in ["merchant", "admin"]:
        raise HTTPException(403, "Nur Händler können Zahlungen anfordern")
    
    token_doc = await db.nfc_tokens.find_one({"nfc_token": req.customer_nfc_token, "active": True})
    if not token_doc:
        raise HTTPException(404, "Kunden-NFC-Token ungültig")
    
    customer_email = token_doc["user_email"]
    customer = await db.users.find_one({"email": customer_email})
    if not customer:
        raise HTTPException(404, "Kunde nicht gefunden")
    
    balance = customer.get("balance", 0)
    if balance < req.amount:
        raise HTTPException(400, "Kunde hat nicht genug Guthaben")
    
    # Process payment
    await db.users.update_one({"email": customer_email}, {"$inc": {"balance": -req.amount}})
    await db.users.update_one({"email": merchant.get("email", "")}, {"$inc": {"balance": req.amount * 0.97}})  # 3% fee
    
    await db.nfc_tokens.update_one(
        {"nfc_token": req.customer_nfc_token},
        {"$set": {"last_used": datetime.now(timezone.utc).isoformat()},
         "$inc": {"total_payments": 1, "total_spent": req.amount}}
    )
    
    tx = {
        "tx_id": f"nfc_{secrets.token_hex(6)}",
        "type": "merchant_nfc_charge",
        "user_email": customer_email,
        "merchant_email": merchant.get("email", ""),
        "amount": req.amount,
        "fee": round(req.amount * 0.03, 2),
        "description": req.description or "Händler NFC-Zahlung",
        "status": "completed",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.nfc_transactions.insert_one(tx)
    
    return {
        "ok": True,
        "amount": req.amount,
        "fee": round(req.amount * 0.03, 2),
        "tx_id": tx["tx_id"],
        "message": f"€{req.amount:.2f} von Kunde eingezogen!",
    }


@router.get("/history")
async def nfc_history(request: Request):
    """Get NFC payment history."""
    user = await get_current_user(request)
    email = user.get("email", "")
    txs = await db.nfc_transactions.find(
        {"$or": [{"user_email": email}, {"merchant_email": email}]}, {"_id": 0}
    ).sort("created_at", -1).to_list(30)
    
    total = sum(t["amount"] for t in txs if t.get("user_email") == email)
    return {"transactions": txs, "total_spent": round(total, 2), "count": len(txs)}


@router.post("/deactivate")
async def deactivate_token(request: Request):
    """Deactivate NFC token (lost phone, security)."""
    user = await get_current_user(request)
    result = await db.nfc_tokens.update_many(
        {"user_email": user.get("email", ""), "active": True},
        {"$set": {"active": False, "deactivated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"ok": True, "deactivated": result.modified_count, "message": "NFC-Token deaktiviert!"}
