from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel
from datetime import datetime, timezone
from pymongo import MongoClient
import os
import random
import string

router = APIRouter(prefix="/referral", tags=["Referral"])

# MongoDB Connection
mongo_url = os.environ.get("MONGO_URL")
db_name = os.environ.get("DB_NAME", "bidblitz")
client = MongoClient(mongo_url)
db = client[db_name]

wallets_col = db["wallets"]
referrals_col = db["referrals"]
referral_uses_col = db["referral_uses"]

# Referral Configuration
INVITER_REWARD = 100
NEW_USER_REWARD = 50

# Referral Tiers
REFERRAL_TIERS = {
    1: {"min_refs": 0, "bonus": 0, "name": "Starter"},
    2: {"min_refs": 5, "bonus": 25, "name": "Promoter"},
    3: {"min_refs": 15, "bonus": 50, "name": "Ambassador"},
    4: {"min_refs": 50, "bonus": 100, "name": "Elite"}
}


def get_user_id_from_token(authorization: str) -> str:
    """Extract user_id from token or return demo_user"""
    if not authorization:
        return "demo_user"
    try:
        token = authorization.replace("Bearer ", "")
        import jwt
        payload = jwt.decode(token, options={"verify_signature": False})
        return payload.get("user_id", "demo_user")
    except:
        return "demo_user"


def generate_referral_code(length: int = 8) -> str:
    """Generate a unique referral code"""
    chars = string.ascii_uppercase + string.digits
    return ''.join(random.choices(chars, k=length))


@router.post("/create")
async def create_referral(authorization: str = Header(None)):
    """Create a referral code for user"""
    user_id = get_user_id_from_token(authorization)
    now = datetime.now(timezone.utc)
    
    # Check if user already has a code
    existing = referrals_col.find_one({"user_id": user_id})
    if existing:
        return {
            "referral_code": existing.get("code"),
            "message": "Du hast bereits einen Code!"
        }
    
    # Generate unique code
    code = generate_referral_code()
    while referrals_col.find_one({"code": code}):
        code = generate_referral_code()
    
    # Save referral code
    referrals_col.insert_one({
        "user_id": user_id,
        "code": code,
        "uses": 0,
        "total_earned": 0,
        "created_at": now.isoformat()
    })
    
    return {
        "success": True,
        "referral_code": code,
        "message": "Referral Code erstellt!"
    }


class UseReferralRequest(BaseModel):
    code: str


@router.post("/use")
async def use_referral(request: UseReferralRequest, authorization: str = Header(None)):
    """Use a referral code"""
    user_id = get_user_id_from_token(authorization)
    now = datetime.now(timezone.utc)
    
    # Find referral code
    referral = referrals_col.find_one({"code": request.code.upper()})
    if not referral:
        raise HTTPException(status_code=404, detail="Ungültiger Referral Code!")
    
    inviter_id = referral.get("user_id")
    
    # Check if user already used a code
    already_used = referral_uses_col.find_one({"user_id": user_id})
    if already_used:
        raise HTTPException(status_code=400, detail="Du hast bereits einen Code eingelöst!")
    
    # Can't use own code
    if inviter_id == user_id:
        raise HTTPException(status_code=400, detail="Du kannst deinen eigenen Code nicht nutzen!")
    
    # Calculate bonus based on inviter's tier
    uses = referral.get("uses", 0)
    tier_bonus = 0
    for tier_level, tier_data in sorted(REFERRAL_TIERS.items(), reverse=True):
        if uses >= tier_data["min_refs"]:
            tier_bonus = tier_data["bonus"]
            break
    
    total_inviter_reward = INVITER_REWARD + tier_bonus
    
    # Reward inviter
    wallets_col.update_one(
        {"user_id": inviter_id},
        {
            "$inc": {"coins": total_inviter_reward, "total_earned": total_inviter_reward},
            "$setOnInsert": {"created_at": now.isoformat()}
        },
        upsert=True
    )
    
    # Reward new user
    wallets_col.update_one(
        {"user_id": user_id},
        {
            "$inc": {"coins": NEW_USER_REWARD, "total_earned": NEW_USER_REWARD},
            "$setOnInsert": {"created_at": now.isoformat()}
        },
        upsert=True
    )
    
    # Update referral stats
    referrals_col.update_one(
        {"code": request.code.upper()},
        {
            "$inc": {"uses": 1, "total_earned": total_inviter_reward}
        }
    )
    
    # Record the use
    referral_uses_col.insert_one({
        "user_id": user_id,
        "code": request.code.upper(),
        "inviter_id": inviter_id,
        "used_at": now.isoformat()
    })
    
    return {
        "success": True,
        "inviter_reward": total_inviter_reward,
        "new_user_reward": NEW_USER_REWARD,
        "message": f"+{NEW_USER_REWARD} Coins erhalten!"
    }


@router.get("/stats")
async def get_referral_stats(authorization: str = Header(None)):
    """Get user's referral statistics"""
    user_id = get_user_id_from_token(authorization)
    
    referral = referrals_col.find_one({"user_id": user_id}, {"_id": 0})
    
    if not referral:
        return {
            "has_code": False,
            "code": None,
            "uses": 0,
            "total_earned": 0,
            "tier": 1,
            "tier_name": "Starter"
        }
    
    uses = referral.get("uses", 0)
    
    # Determine tier
    current_tier = 1
    tier_name = "Starter"
    for tier_level, tier_data in sorted(REFERRAL_TIERS.items(), reverse=True):
        if uses >= tier_data["min_refs"]:
            current_tier = tier_level
            tier_name = tier_data["name"]
            break
    
    # Next tier info
    next_tier = None
    if current_tier < 4:
        next_tier_data = REFERRAL_TIERS[current_tier + 1]
        next_tier = {
            "level": current_tier + 1,
            "name": next_tier_data["name"],
            "refs_needed": next_tier_data["min_refs"] - uses
        }
    
    return {
        "has_code": True,
        "code": referral.get("code"),
        "uses": uses,
        "total_earned": referral.get("total_earned", 0),
        "tier": current_tier,
        "tier_name": tier_name,
        "next_tier": next_tier
    }


@router.get("/leaderboard")
async def get_referral_leaderboard():
    """Get top referrers"""
    top_referrers = list(referrals_col.find(
        {},
        {"_id": 0, "user_id": 1, "uses": 1, "total_earned": 1}
    ).sort("uses", -1).limit(10))
    
    return {
        "leaderboard": top_referrers
    }
