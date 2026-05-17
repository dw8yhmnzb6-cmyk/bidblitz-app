"""
BidBlitz V2 - Referral System
Each user gets a referral code. Invite friends, both get rewarded.
"""

import secrets
import string
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from core.database import db
from core.security import get_current_user
from core.config import REWARDS

router = APIRouter(prefix="/api/referral", tags=["referral"])


def generate_referral_code():
    chars = string.ascii_uppercase + string.digits
    return "BB-" + "".join(secrets.choice(chars) for _ in range(6))


@router.get("/my-code")
async def get_my_referral(request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])

    # Check if user already has a referral code
    code = user.get("referral_code")
    if not code:
        code = generate_referral_code()
        # Ensure uniqueness
        while await db.users.find_one({"referral_code": code}):
            code = generate_referral_code()
        await db.users.update_one({"_id": user["_id"]}, {"$set": {"referral_code": code}})

    # Count referrals
    referral_count = await db.referrals.count_documents({"referrer_id": user_id})
    rewarded_count = await db.referrals.count_documents({"referrer_id": user_id, "reward_given": True})
    total_earned = rewarded_count * REWARDS["referral_bonus"]

    return {
        "referral_code": code,
        "referral_link": f"https://bidblitz.com/join?ref={code}",
        "total_referrals": referral_count,
        "rewarded_referrals": rewarded_count,
        "total_earned": round(total_earned, 2),
        "reward_per_referral": REWARDS["referral_bonus"],
    }


class ApplyReferralRequest(BaseModel):
    code: str = Field(..., min_length=5, max_length=20)


@router.post("/apply")
async def apply_referral_code(req: ApplyReferralRequest, request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])

    # Check if user already used a referral
    existing = await db.referrals.find_one({"referred_id": user_id})
    if existing:
        raise HTTPException(status_code=400, detail="You have already used a referral code")

    # Find referrer
    referrer = await db.users.find_one({"referral_code": req.code.upper().strip()})
    if not referrer:
        raise HTTPException(status_code=404, detail="Invalid referral code")

    referrer_id = str(referrer["_id"])
    if referrer_id == user_id:
        raise HTTPException(status_code=400, detail="You cannot refer yourself")

    # Create referral record
    await db.referrals.insert_one({
        "referrer_id": referrer_id,
        "referred_id": user_id,
        "referrer_email": referrer["email"],
        "referred_email": user["email"],
        "code": req.code.upper().strip(),
        "reward_given": False,
        "reward_amount": REWARDS["referral_bonus"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    # Store on user
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"referred_by": referrer_id, "referral_code_used": req.code.upper().strip()}})

    # Auto-create taxi promo code for new user (5€ off first ride)
    referral_promo_code = f"REF-{req.code.upper().strip()[-6:]}"
    try:
        existing_promo = await db.taxi_promo_codes.find_one({"code": referral_promo_code})
        if not existing_promo:
            await db.taxi_promo_codes.insert_one({
                "code": referral_promo_code,
                "type": "fixed",
                "value": 5.0,
                "label": "Empfehlungs-Rabatt: 5€ auf deine erste Fahrt",
                "max_uses_per_user": 1,
                "user_id": user_id,  # Bound to this user only
                "active": True,
                "expires_at": None,
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
    except Exception:
        pass  # Non-blocking

    return {"success": True, "message": "Referral code applied! You'll both be rewarded after your first payment.", "taxi_promo": referral_promo_code}


@router.get("/check-rewards")
async def check_and_grant_rewards(request: Request):
    """Check if referral rewards should be granted (called after first payment/topup OR first ride)."""
    user = await get_current_user(request)
    user_id = str(user["_id"])

    # Find pending referral for this user
    referral = await db.referrals.find_one({"referred_id": user_id, "reward_given": False})
    if not referral:
        return {"rewarded": False}

    # Check if user has made a qualifying action (first payment, topup, OR completed taxi ride)
    qualifying_txn = await db.transactions.find_one({
        "user_id": user_id,
        "status": "completed",
        "type": {"$in": ["payment", "topup"]},
    })
    
    qualifying_ride = await db.taxi_rides.find_one({
        "user_id": user_id,
        "status": "completed",
    })

    if not qualifying_txn and not qualifying_ride:
        return {"rewarded": False, "message": "Complete your first payment, top-up, or taxi ride to earn your referral bonus"}

    # Grant rewards to both users
    bonus = REWARDS["referral_bonus"]
    now = datetime.now(timezone.utc).isoformat()

    # Reward referred user
    await db.users.update_one({"_id": user["_id"]}, {"$inc": {"balance": bonus}})
    await db.transactions.insert_one({
        "user_id": user_id,
        "type": "reward",
        "amount": bonus,
        "status": "completed",
        "description": "Referral bonus",
        "reference": f"REF-{secrets.token_hex(4).upper()}",
        "created_at": now,
    })

    # Reward referrer
    referrer_id = referral["referrer_id"]
    from bson import ObjectId
    await db.users.update_one({"_id": ObjectId(referrer_id)}, {"$inc": {"balance": bonus}})
    await db.transactions.insert_one({
        "user_id": referrer_id,
        "type": "reward",
        "amount": bonus,
        "status": "completed",
        "description": f"Referral reward - {user['email']} joined",
        "reference": f"REF-{secrets.token_hex(4).upper()}",
        "created_at": now,
    })

    # Mark referral as rewarded
    await db.referrals.update_one({"_id": referral["_id"]}, {"$set": {"reward_given": True, "rewarded_at": now}})

    # Create notifications
    await db.notifications.insert_one({
        "user_id": user_id, "type": "reward", "title": "Referral Bonus!",
        "message": f"You earned EUR {bonus:.2f} for joining via referral!",
        "read": False, "created_at": now,
    })
    await db.notifications.insert_one({
        "user_id": referrer_id, "type": "reward", "title": "Referral Reward!",
        "message": f"You earned EUR {bonus:.2f} because {user['email']} joined and made their first transaction!",
        "read": False, "created_at": now,
    })

    return {"rewarded": True, "bonus": bonus}


@router.get("/leaderboard")
async def referral_leaderboard(request: Request):
    """Top referrers - public leaderboard."""
    await get_current_user(request)

    pipeline = [
        {"$match": {"reward_given": True}},
        {"$group": {"_id": "$referrer_id", "count": {"$sum": 1}, "total_earned": {"$sum": "$reward_amount"}}},
        {"$sort": {"count": -1}},
        {"$limit": 10},
    ]
    results = await db.referrals.aggregate(pipeline).to_list(10)

    leaderboard = []
    for r in results:
        from bson import ObjectId
        u = await db.users.find_one({"_id": ObjectId(r["_id"])}, {"name": 1, "email": 1})
        name = u.get("name", "User") if u else "User"
        leaderboard.append({
            "name": name,
            "referrals": r["count"],
            "earned": round(r["total_earned"], 2),
        })

    return {"leaderboard": leaderboard}
