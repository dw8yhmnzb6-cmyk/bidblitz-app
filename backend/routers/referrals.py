"""
Referral System Router
Friend-invite-friend with rewards for both
"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel
from typing import Optional
import uuid
import hashlib

from config import db, logger
from dependencies import get_current_user

router = APIRouter(prefix="/referrals", tags=["Referrals"])

# Configuration
REFERRER_REWARD = 10.0  # €10 Euro for the referrer
REFEREE_REWARD = 5  # 5 Free Bids for the new user
MIN_DEPOSIT_FOR_REWARD = 5.0  # Minimum €5 deposit to trigger reward
REFERRAL_EXPIRY_DAYS = 30  # Link expires after 30 days


def generate_referral_code(user_id: str) -> str:
    """Generate a unique referral code for a user"""
    hash_input = f"{user_id}-bidblitz-referral"
    return hashlib.md5(hash_input.encode()).hexdigest()[:8].upper()


class ReferralLink(BaseModel):
    code: str
    link: str
    created_at: str
    expires_at: str
    uses: int
    successful_referrals: int


@router.get("/my-code")
async def get_my_referral_code(user: dict = Depends(get_current_user)):
    """Get or create user's referral code"""
    user_id = user["id"]
    
    # Check if code exists
    existing = await db.referral_codes.find_one(
        {"user_id": user_id, "status": "active"},
        {"_id": 0}
    )
    
    if existing:
        return existing
    
    # Create new referral code
    code = generate_referral_code(user_id)
    now = datetime.now(timezone.utc)
    
    referral = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "code": code,
        "link": f"https://bidblitz.ae/register?ref={code}",
        "created_at": now.isoformat(),
        "expires_at": (now + timedelta(days=365)).isoformat(),  # 1 year
        "uses": 0,
        "successful_referrals": 0,
        "total_earned": 0,
        "status": "active"
    }
    
    await db.referral_codes.insert_one(referral)
    referral.pop("_id", None)
    
    return referral


@router.get("/stats")
async def get_referral_stats(user: dict = Depends(get_current_user)):
    """Get user's referral statistics"""
    user_id = user["id"]
    
    # Get referral code
    code = await db.referral_codes.find_one(
        {"user_id": user_id},
        {"_id": 0}
    )
    
    if not code:
        return {
            "code": None,
            "total_referrals": 0,
            "successful_referrals": 0,
            "pending_referrals": 0,
            "total_earned": 0
        }
    
    # Get referrals
    referrals = await db.referrals.find(
        {"referrer_id": user_id},
        {"_id": 0}
    ).to_list(length=1000)
    
    successful = len([r for r in referrals if r.get("status") == "completed"])
    pending = len([r for r in referrals if r.get("status") == "pending"])
    total_earned = sum(r.get("referrer_reward", 0) for r in referrals if r.get("status") == "completed")
    
    return {
        "code": code.get("code"),
        "link": code.get("link"),
        "total_referrals": len(referrals),
        "successful_referrals": successful,
        "pending_referrals": pending,
        "total_earned": total_earned,
        "reward_per_referral": REFERRER_REWARD
    }


@router.get("/my-referrals")
async def get_my_referrals(user: dict = Depends(get_current_user)):
    """Get list of users referred by this user"""
    user_id = user["id"]
    
    referrals = await db.referrals.find(
        {"referrer_id": user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(length=100)
    
    # Enrich with user names (partially hidden for privacy)
    enriched = []
    for ref in referrals:
        referred_user = await db.users.find_one(
            {"id": ref.get("referred_id")},
            {"_id": 0, "name": 1, "created_at": 1}
        )
        
        name = "Anonym"
        if referred_user and referred_user.get("name"):
            full_name = referred_user["name"]
            name = full_name[0] + "***" + (full_name[-1] if len(full_name) > 1 else "")
        
        enriched.append({
            "id": ref.get("id"),
            "name": name,
            "status": ref.get("status"),
            "reward_earned": ref.get("referrer_reward", 0) if ref.get("status") == "completed" else 0,
            "created_at": ref.get("created_at"),
            "completed_at": ref.get("completed_at")
        })
    
    return {"referrals": enriched}


@router.post("/apply/{code}")
async def apply_referral_code(code: str, user: dict = Depends(get_current_user)):
    """Apply a referral code (for new users)"""
    user_id = user["id"]
    
    # Check if user already has a referrer
    existing = await db.referrals.find_one({"referred_id": user_id})
    if existing:
        raise HTTPException(status_code=400, detail="Du hast bereits einen Empfehlungscode verwendet")
    
    # Check if user is trying to use own code
    own_code = await db.referral_codes.find_one({"user_id": user_id, "code": code.upper()})
    if own_code:
        raise HTTPException(status_code=400, detail="Du kannst deinen eigenen Code nicht verwenden")
    
    # Find referral code
    referral_code = await db.referral_codes.find_one(
        {"code": code.upper(), "status": "active"},
        {"_id": 0}
    )
    
    if not referral_code:
        raise HTTPException(status_code=404, detail="Ungültiger Empfehlungscode")
    
    # Check expiry
    expires_at = datetime.fromisoformat(referral_code["expires_at"].replace("Z", "+00:00"))
    if datetime.now(timezone.utc) > expires_at:
        raise HTTPException(status_code=400, detail="Dieser Code ist abgelaufen")
    
    # Create referral entry
    referral = {
        "id": str(uuid.uuid4()),
        "referrer_id": referral_code["user_id"],
        "referred_id": user_id,
        "code": code.upper(),
        "status": "pending",  # Becomes 'completed' after first purchase
        "referrer_reward": REFERRER_REWARD,
        "referee_reward": REFEREE_REWARD,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.referrals.insert_one(referral)
    
    # Update code usage count
    await db.referral_codes.update_one(
        {"code": code.upper()},
        {"$inc": {"uses": 1}}
    )
    
    # Give immediate welcome bonus to new user
    await db.users.update_one(
        {"id": user_id},
        {"$inc": {"bids_balance": 5, "bid_balance": 5}}  # Small welcome bonus
    )
    
    return {
        "success": True,
        "message": f"Code angewendet! Du erhältst {REFEREE_REWARD} Gebote nach deinem ersten Kauf.",
        "welcome_bonus": 5
    }


@router.post("/complete/{referred_id}")
async def complete_referral(referred_id: str, deposit_amount: float = 0):
    """Complete a referral after first deposit of €5+ (called internally)"""
    # Check minimum deposit
    if deposit_amount < MIN_DEPOSIT_FOR_REWARD:
        return {"success": False, "message": f"Mindesteinzahlung €{MIN_DEPOSIT_FOR_REWARD} erforderlich"}
    
    # Find pending referral
    referral = await db.referrals.find_one({
        "referred_id": referred_id,
        "status": "pending"
    })
    
    if not referral:
        return {"success": False, "message": "No pending referral found"}
    
    # Complete the referral
    now = datetime.now(timezone.utc).isoformat()
    
    await db.referrals.update_one(
        {"id": referral["id"]},
        {"$set": {
            "status": "completed",
            "completed_at": now,
            "trigger_deposit": deposit_amount
        }}
    )
    
    # Award rewards
    # Referrer gets €10 EURO (not bids) - credited to balance and wallet
    await db.users.update_one(
        {"id": referral["referrer_id"]},
        {"$inc": {
            "balance": REFERRER_REWARD,
            "bidblitz_balance": REFERRER_REWARD
        }}
    )
    
    # Also update BidBlitz Pay wallet for referrer
    await db.bidblitz_wallets.update_one(
        {"user_id": referral["referrer_id"]},
        {"$inc": {"universal_balance": REFERRER_REWARD}},
        upsert=True
    )
    
    # Referred user gets FREE BIDS
    await db.users.update_one(
        {"id": referred_id},
        {"$inc": {
            "bids_balance": REFEREE_REWARD,
            "bid_balance": REFEREE_REWARD
        }}
    )
    
    # Update code stats
    await db.referral_codes.update_one(
        {"code": referral["code"]},
        {"$inc": {
            "successful_referrals": 1,
            "total_earned": REFERRER_REWARD
        }}
    )
    
    # Create notifications
    await db.notifications.insert_many([
        {
            "id": str(uuid.uuid4()),
            "user_id": referral["referrer_id"],
            "type": "referral_success",
            "title": "Empfehlung erfolgreich!",
            "message": f"Dein Freund hat gekauft! Du erhältst {REFERRER_REWARD} Gebote.",
            "read": False,
            "created_at": now
        },
        {
            "id": str(uuid.uuid4()),
            "user_id": referred_id,
            "type": "referral_bonus",
            "title": "Willkommensbonus!",
            "message": f"Du erhältst {REFEREE_REWARD} Gebote als Empfehlungsbonus!",
            "read": False,
            "created_at": now
        }
    ])
    
    return {
        "success": True,
        "referrer_reward": REFERRER_REWARD,
        "referee_reward": REFEREE_REWARD
    }


@router.get("/leaderboard")
async def get_referral_leaderboard(limit: int = 10):
    """Get top referrers"""
    pipeline = [
        {"$match": {"status": "completed"}},
        {"$group": {
            "_id": "$referrer_id",
            "total_referrals": {"$sum": 1},
            "total_earned": {"$sum": "$referrer_reward"}
        }},
        {"$sort": {"total_referrals": -1}},
        {"$limit": limit}
    ]
    
    results = await db.referrals.aggregate(pipeline).to_list(length=limit)
    
    leaderboard = []
    for i, result in enumerate(results):
        user = await db.users.find_one(
            {"id": result["_id"]},
            {"_id": 0, "name": 1}
        )
        
        leaderboard.append({
            "rank": i + 1,
            "username": user.get("name", "Anonym") if user else "Anonym",
            "total_referrals": result["total_referrals"],
            "total_earned": result["total_earned"]
        })
    
    return {"leaderboard": leaderboard}
