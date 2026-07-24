"""
BidBlitz V2 - Monetization Features
Promoted Listings, Instant Cashout, Job Boost, Spar-Challenges
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timezone, timedelta
from core.database import db
from core.security import get_current_user
import secrets, random

router = APIRouter(prefix="/api/monetize", tags=["monetization"])

# ═══ PROMOTED LISTINGS ═══
PROMOTE_PRICES = {"24h": 1.99, "3d": 3.99, "7d": 6.99}

class PromoteRequest(BaseModel):
    listing_id: str
    duration: str = "24h"  # 24h, 3d, 7d

@router.post("/promote")
async def promote_listing(req: PromoteRequest, request: Request):
    user = await get_current_user(request)
    email = user.get("email", "")
    price = PROMOTE_PRICES.get(req.duration, 1.99)
    
    balance = user.get("balance", 0)
    if balance < price:
        raise HTTPException(400, f"Nicht genug Guthaben. Benötigt: €{price:.2f}")
    
    listing = await db.resell_listings.find_one({"listing_id": req.listing_id, "seller_email": email})
    if not listing:
        raise HTTPException(404, "Listing nicht gefunden")
    
    await db.users.update_one({"email": email}, {"$inc": {"balance": -price}})
    
    hours = {"24h": 24, "3d": 72, "7d": 168}.get(req.duration, 24)
    expires = datetime.now(timezone.utc) + timedelta(hours=hours)
    
    await db.resell_listings.update_one(
        {"listing_id": req.listing_id},
        {"$set": {"promoted": True, "promote_expires": expires.isoformat(), "promote_tier": req.duration}}
    )
    
    await db.monetize_transactions.insert_one({
        "tx_id": secrets.token_hex(8), "type": "promote", "user_email": email,
        "amount": price, "item_id": req.listing_id, "duration": req.duration,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    
    return {"ok": True, "price": price, "expires": expires.isoformat(),
            "message": f"Listing promoted für {req.duration} (€{price:.2f})"}

@router.get("/promote/prices")
async def get_promote_prices():
    return {"prices": PROMOTE_PRICES}


# ═══ INSTANT CASHOUT ═══
INSTANT_FEE = 0.99

class CashoutRequest(BaseModel):
    amount: float = Field(..., gt=0, le=10000)

@router.post("/instant-cashout")
async def instant_cashout(req: CashoutRequest, request: Request):
    user = await get_current_user(request)
    email = user.get("email", "")
    balance = user.get("balance", 0)
    total = req.amount + INSTANT_FEE
    
    # Check if premium (free instant cashout for Pro+)
    is_premium_pro = user.get("premium_plan") in ["pro", "elite"]
    fee = 0 if is_premium_pro else INSTANT_FEE
    total = req.amount + fee
    
    if balance < total:
        raise HTTPException(400, f"Nicht genug Guthaben. Benötigt: €{total:.2f} (inkl. €{fee:.2f} Gebühr)")
    
    await db.users.update_one({"email": email}, {"$inc": {"balance": -total}})
    
    cashout = {
        "cashout_id": secrets.token_hex(8), "user_email": email,
        "amount": req.amount, "fee": fee, "total_deducted": total,
        "status": "completed", "method": "instant",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.cashouts.insert_one(cashout)
    
    new_bal = (await db.users.find_one({"email": email})).get("balance", 0)
    
    return {"ok": True, "amount": req.amount, "fee": fee,
            "new_balance": round(new_bal, 2),
            "message": f"€{req.amount:.2f} sofort ausgezahlt!" + (" (Pro: Gebühr entfällt)" if is_premium_pro else f" (Gebühr: €{fee:.2f})")}

@router.get("/cashout/history")
async def cashout_history(request: Request):
    user = await get_current_user(request)
    history = await db.cashouts.find({"user_email": user.get("email", "")}, {"_id": 0}).sort("created_at", -1).to_list(30)
    return {"cashouts": history}


# ═══ JOB BOOST ═══
BOOST_PRICES = {"standard": 0.99, "premium": 2.49, "ultra": 4.99}

class BoostJobRequest(BaseModel):
    job_id: str
    tier: str = "standard"  # standard, premium, ultra

@router.post("/boost-job")
async def boost_job(req: BoostJobRequest, request: Request):
    user = await get_current_user(request)
    email = user.get("email", "")
    price = BOOST_PRICES.get(req.tier, 0.99)
    
    balance = user.get("balance", 0)
    if balance < price:
        raise HTTPException(400, f"Nicht genug Guthaben. Benötigt: €{price:.2f}")
    
    job = await db.blitz_jobs.find_one({"job_id": req.job_id, "poster_email": email})
    if not job:
        raise HTTPException(404, "Job nicht gefunden")
    
    await db.users.update_one({"email": email}, {"$inc": {"balance": -price}})
    
    boost_hours = {"standard": 12, "premium": 24, "ultra": 72}.get(req.tier, 12)
    expires = datetime.now(timezone.utc) + timedelta(hours=boost_hours)
    
    await db.blitz_jobs.update_one(
        {"job_id": req.job_id},
        {"$set": {"boosted": True, "boost_tier": req.tier, "boost_expires": expires.isoformat(), "urgent": True}}
    )
    
    return {"ok": True, "price": price, "tier": req.tier,
            "message": f"Job geboostet ({req.tier}) für €{price:.2f}!"}

@router.get("/boost/prices")
async def get_boost_prices():
    return {"prices": BOOST_PRICES}


# ═══ SPAR-CHALLENGES ═══

class ChallengeCreate(BaseModel):
    title: str = Field(..., min_length=2, max_length=80)
    target_amount: float = Field(..., gt=0, le=10000)
    duration_days: int = Field(30, ge=7, le=365)
    entry_fee: float = Field(5.0, ge=1, le=1000)

class ChallengeJoin(BaseModel):
    challenge_id: str

@router.get("/challenges")
async def get_challenges(request: Request):
    try:
        user = await get_current_user(request)
        email = user.get("email", "")
    except:
        email = ""
    
    public = await db.spar_challenges.find({"status": "active"}, {"_id": 0}).sort("created_at", -1).to_list(20)
    return {"challenges": public}

@router.post("/challenges/create")
async def create_challenge(req: ChallengeCreate, request: Request):
    user = await get_current_user(request)
    email = user.get("email", "")
    
    balance = user.get("balance", 0)
    if balance < req.entry_fee:
        raise HTTPException(400, f"Eintritt: €{req.entry_fee:.2f} benötigt")
    
    await db.users.update_one({"email": email}, {"$inc": {"balance": -req.entry_fee}})
    
    now = datetime.now(timezone.utc)
    challenge = {
        "challenge_id": f"ch_{secrets.token_hex(6)}",
        "creator_email": email,
        "creator_name": user.get("name", email),
        "title": req.title,
        "target_amount": req.target_amount,
        "duration_days": req.duration_days,
        "entry_fee": req.entry_fee,
        "pool": req.entry_fee,
        "platform_fee_pct": 5,
        "participants": [{
            "email": email, "name": user.get("name", email),
            "saved": 0, "joined_at": now.isoformat(),
        }],
        "status": "active",
        "created_at": now.isoformat(),
        "ends_at": (now + timedelta(days=req.duration_days)).isoformat(),
    }
    await db.spar_challenges.insert_one(challenge)
    challenge.pop("_id", None)
    return {"ok": True, "challenge": challenge}

@router.post("/challenges/join")
async def join_challenge(req: ChallengeJoin, request: Request):
    user = await get_current_user(request)
    email = user.get("email", "")
    
    ch = await db.spar_challenges.find_one({"challenge_id": req.challenge_id, "status": "active"})
    if not ch:
        raise HTTPException(404, "Challenge nicht gefunden")
    if any(p["email"] == email for p in ch.get("participants", [])):
        raise HTTPException(400, "Bereits beigetreten")
    
    fee = ch["entry_fee"]
    balance = user.get("balance", 0)
    if balance < fee:
        raise HTTPException(400, f"Eintritt: €{fee:.2f} benötigt")
    
    await db.users.update_one({"email": email}, {"$inc": {"balance": -fee}})
    
    await db.spar_challenges.update_one(
        {"challenge_id": req.challenge_id},
        {"$push": {"participants": {"email": email, "name": user.get("name", email), "saved": 0, "joined_at": datetime.now(timezone.utc).isoformat()}},
         "$inc": {"pool": fee}}
    )
    return {"ok": True, "message": f"Beigetreten! Eintritt: €{fee:.2f}"}

@router.get("/challenges/{challenge_id}")
async def get_challenge(challenge_id: str):
    ch = await db.spar_challenges.find_one({"challenge_id": challenge_id}, {"_id": 0})
    if not ch:
        raise HTTPException(404, "Challenge nicht gefunden")
    return ch

# ═══ REVENUE STATS (Admin) ═══
@router.get("/revenue")
async def revenue_stats(request: Request):
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(403, "Nur Admin")
    
    promote_rev = await db.monetize_transactions.aggregate([
        {"$match": {"type": "promote"}}, {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]).to_list(1)
    cashout_rev = await db.cashouts.aggregate([
        {"$group": {"_id": None, "total": {"$sum": "$fee"}}}
    ]).to_list(1)
    premium_rev = await db.premium_subs.aggregate([
        {"$match": {"status": "active"}}, {"$group": {"_id": None, "total": {"$sum": "$price"}}}
    ]).to_list(1)
    
    return {
        "promoted_listings": round(promote_rev[0]["total"], 2) if promote_rev else 0,
        "instant_cashout_fees": round(cashout_rev[0]["total"], 2) if cashout_rev else 0,
        "premium_subscriptions": round(premium_rev[0]["total"], 2) if premium_rev else 0,
    }
