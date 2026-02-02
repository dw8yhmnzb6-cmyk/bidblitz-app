"""Referral System Router - Customer referral tracking with rankings"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone, timedelta
from typing import Optional
import uuid
import random
import string

from config import db, logger
from dependencies import get_current_user, get_admin_user

router = APIRouter(prefix="/referral", tags=["referral"])

# ==================== REFERRAL CODE GENERATION ====================

def generate_referral_code(name: str) -> str:
    """Generate a unique referral code based on user name"""
    # Take first 3-4 chars of name + random suffix
    name_part = ''.join(c for c in name.upper() if c.isalnum())[:4]
    random_part = ''.join(random.choices(string.digits, k=4))
    return f"{name_part}{random_part}"


# ==================== USER ENDPOINTS ====================

@router.get("/my-code")
async def get_my_referral_code(user: dict = Depends(get_current_user)):
    """Get or create user's referral code"""
    user_id = user["id"]
    
    # Check if user already has a referral code
    user_data = await db.users.find_one({"id": user_id}, {"_id": 0, "referral_code": 1, "name": 1})
    
    if user_data and user_data.get("referral_code"):
        referral_code = user_data["referral_code"]
    else:
        # Generate new code
        referral_code = generate_referral_code(user.get("name", "USER"))
        
        # Ensure uniqueness
        while await db.users.find_one({"referral_code": referral_code}):
            referral_code = generate_referral_code(user.get("name", "USER"))
        
        # Save to user
        await db.users.update_one(
            {"id": user_id},
            {"$set": {"referral_code": referral_code}}
        )
    
    # Get referral stats
    referrals = await db.referrals.find({"referrer_id": user_id}).to_list(1000)
    total_referrals = len(referrals)
    
    # Count successful referrals (referred user made a purchase)
    successful_referrals = sum(1 for r in referrals if r.get("has_purchased", False))
    
    # Calculate total earnings
    total_earnings = sum(r.get("reward_bids", 0) for r in referrals)
    
    # Get user's rank
    rank_data = await get_user_rank(user_id)
    
    return {
        "referral_code": referral_code,
        "referral_link": f"https://bidblitz.de/register?ref={referral_code}",
        "stats": {
            "total_referrals": total_referrals,
            "successful_referrals": successful_referrals,
            "total_bids_earned": total_earnings,
            "rank": rank_data["rank"],
            "rank_title": rank_data["title"]
        }
    }


@router.post("/apply/{referral_code}")
async def apply_referral_code(referral_code: str, user: dict = Depends(get_current_user)):
    """Apply a referral code (for new users)"""
    user_id = user["id"]
    
    # Check if user already used a referral code
    existing = await db.referrals.find_one({"referred_id": user_id})
    if existing:
        raise HTTPException(status_code=400, detail="Du hast bereits einen Empfehlungscode verwendet")
    
    # Check if user is trying to use their own code
    user_data = await db.users.find_one({"id": user_id}, {"_id": 0, "referral_code": 1, "created_at": 1})
    if user_data and user_data.get("referral_code") == referral_code.upper():
        raise HTTPException(status_code=400, detail="Du kannst deinen eigenen Code nicht verwenden")
    
    # Check if user registered more than 7 days ago
    try:
        created_at = datetime.fromisoformat(user_data.get("created_at", "").replace('Z', '+00:00'))
        if (datetime.now(timezone.utc) - created_at).days > 7:
            raise HTTPException(status_code=400, detail="Empfehlungscodes können nur in den ersten 7 Tagen eingelöst werden")
    except:
        pass
    
    # Find referrer
    referrer = await db.users.find_one(
        {"referral_code": referral_code.upper()},
        {"_id": 0, "id": 1, "name": 1, "email": 1}
    )
    
    if not referrer:
        raise HTTPException(status_code=404, detail="Ungültiger Empfehlungscode")
    
    if referrer["id"] == user_id:
        raise HTTPException(status_code=400, detail="Du kannst deinen eigenen Code nicht verwenden")
    
    # Create referral record (NO IMMEDIATE BONUS - bonus only on first purchase!)
    referral_id = str(uuid.uuid4())
    await db.referrals.insert_one({
        "id": referral_id,
        "referrer_id": referrer["id"],
        "referrer_name": referrer.get("name", ""),
        "referred_id": user_id,
        "referred_name": user.get("name", ""),
        "referral_code": referral_code.upper(),
        "has_purchased": False,
        "reward_bids": 0,
        "referrer_bonus_given": False,  # Track if 10 bids given to referrer
        "referred_bonus_given": False,  # Track if 5 bids given to referred user
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # NO IMMEDIATE BONUS - User must make first purchase to receive bonus!
    # This prevents fake account creation for free bids
    
    # Notify referrer that someone signed up (but no bonus yet)
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": referrer["id"],
        "type": "referral",
        "title": "👋 Neuer Empfohlener!",
        "message": f"{user.get('name', 'Jemand')} hat sich mit deinem Code angemeldet! Bonus gibt's sobald er kauft.",
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    logger.info(f"Referral: {user.get('name')} used code {referral_code} from {referrer.get('name')} (pending purchase)")
    
    return {
        "message": "Empfehlungscode erfolgreich registriert! Dein Bonus (5 Gebote) wird nach deinem ersten Kauf gutgeschrieben.",
        "bids_earned": 0,  # Changed from 5 to 0
        "pending_bonus": 5,
        "referrer_name": referrer.get("name", "")
    }


@router.get("/my-referrals")
async def get_my_referrals(user: dict = Depends(get_current_user)):
    """Get list of users I have referred"""
    user_id = user["id"]
    
    referrals = await db.referrals.find(
        {"referrer_id": user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return {
        "referrals": referrals,
        "count": len(referrals)
    }


# ==================== RANKING SYSTEM ====================

RANK_TITLES = {
    0: {"title": "Starter", "icon": "🌱", "min_referrals": 0},
    1: {"title": "Bronze-Werber", "icon": "🥉", "min_referrals": 1},
    5: {"title": "Silber-Werber", "icon": "🥈", "min_referrals": 5},
    10: {"title": "Gold-Werber", "icon": "🥇", "min_referrals": 10},
    25: {"title": "Platin-Werber", "icon": "💎", "min_referrals": 25},
    50: {"title": "Diamant-Werber", "icon": "👑", "min_referrals": 50},
    100: {"title": "Legende", "icon": "🏆", "min_referrals": 100}
}


async def get_user_rank(user_id: str) -> dict:
    """Get user's referral rank based on total referrals"""
    # Count referrals
    referral_count = await db.referrals.count_documents({"referrer_id": user_id})
    
    # Determine rank title
    rank_title = RANK_TITLES[0]
    for min_refs, rank_info in sorted(RANK_TITLES.items(), reverse=True):
        if referral_count >= min_refs:
            rank_title = rank_info
            break
    
    # Calculate position in leaderboard
    pipeline = [
        {"$group": {"_id": "$referrer_id", "count": {"$sum": 1}}},
        {"$match": {"count": {"$gt": referral_count}}},
        {"$count": "users_above"}
    ]
    
    result = await db.referrals.aggregate(pipeline).to_list(1)
    position = (result[0]["users_above"] if result else 0) + 1
    
    return {
        "referral_count": referral_count,
        "rank": position,
        "title": rank_title["title"],
        "icon": rank_title["icon"],
        "next_rank": get_next_rank(referral_count)
    }


def get_next_rank(current_count: int) -> dict:
    """Get info about the next rank"""
    for min_refs, rank_info in sorted(RANK_TITLES.items()):
        if min_refs > current_count:
            return {
                "title": rank_info["title"],
                "icon": rank_info["icon"],
                "referrals_needed": min_refs - current_count
            }
    return None


@router.get("/leaderboard")
async def get_referral_leaderboard(
    period: str = "all",  # all, month, week
    limit: int = 20
):
    """Get referral leaderboard"""
    # Build date filter
    date_filter = {}
    now = datetime.now(timezone.utc)
    
    if period == "week":
        week_start = now - timedelta(days=now.weekday())
        week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)
        date_filter["created_at"] = {"$gte": week_start.isoformat()}
    elif period == "month":
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        date_filter["created_at"] = {"$gte": month_start.isoformat()}
    
    # Aggregate referrals per user
    pipeline = [
        {"$match": date_filter} if date_filter else {"$match": {}},
        {
            "$group": {
                "_id": "$referrer_id",
                "referrer_name": {"$first": "$referrer_name"},
                "total_referrals": {"$sum": 1},
                "successful_referrals": {
                    "$sum": {"$cond": ["$has_purchased", 1, 0]}
                }
            }
        },
        {"$sort": {"total_referrals": -1}},
        {"$limit": limit}
    ]
    
    leaderboard_raw = await db.referrals.aggregate(pipeline).to_list(limit)
    
    # Enrich with user data and ranks
    leaderboard = []
    for idx, entry in enumerate(leaderboard_raw):
        user = await db.users.find_one({"id": entry["_id"]}, {"_id": 0, "name": 1, "avatar": 1})
        
        # Get rank title
        rank_title = RANK_TITLES[0]
        for min_refs, rank_info in sorted(RANK_TITLES.items(), reverse=True):
            if entry["total_referrals"] >= min_refs:
                rank_title = rank_info
                break
        
        leaderboard.append({
            "position": idx + 1,
            "user_id": entry["_id"],
            "name": user.get("name", entry.get("referrer_name", "Anonym")) if user else entry.get("referrer_name", "Anonym"),
            "avatar": user.get("avatar") if user else None,
            "total_referrals": entry["total_referrals"],
            "successful_referrals": entry["successful_referrals"],
            "rank_title": rank_title["title"],
            "rank_icon": rank_title["icon"]
        })
    
    return {
        "leaderboard": leaderboard,
        "period": period,
        "period_label": {
            "all": "Gesamt",
            "month": "Diesen Monat",
            "week": "Diese Woche"
        }.get(period, "Gesamt")
    }


@router.get("/my-rank")
async def get_my_rank(user: dict = Depends(get_current_user)):
    """Get current user's rank details"""
    return await get_user_rank(user["id"])


# ==================== REWARD PROCESSING ====================

async def process_referral_reward(referred_user_id: str, is_subscription: bool = False):
    """
    Called when a referred user makes their first purchase.
    Awards bonus bids to BOTH the referrer AND the referred user.
    
    Args:
        referred_user_id: The user who made a purchase
        is_subscription: True if the purchase was a subscription (VIP+ gives extra bonus)
    """
    # Find the referral record
    referral = await db.referrals.find_one({"referred_id": referred_user_id})
    
    if not referral:
        return  # User wasn't referred by anyone
    
    referrer_id = referral["referrer_id"]
    
    # ===== REWARD FOR REFERRED USER (5 bids - first purchase bonus) =====
    if not referral.get("referred_bonus_given", False):
        referred_bonus = 5
        await db.users.update_one(
            {"id": referred_user_id},
            {"$inc": {"bids_balance": referred_bonus}}
        )
        
        # Notify referred user
        await db.notifications.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": referred_user_id,
            "type": "referral_welcome",
            "title": "🎁 Willkommensbonus!",
            "message": f"Danke für deinen ersten Kauf! Du erhältst {referred_bonus} Gratis-Gebote als Empfehlungsbonus!",
            "read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        logger.info(f"Referral bonus: Referred user {referred_user_id} received {referred_bonus} bids")
    
    # ===== REWARD FOR REFERRER (10 bids - standard, 20 for subscription) =====
    if not referral.get("referrer_bonus_given", False):
        # Check if referrer is VIP+ for extra subscription bonus
        referrer = await db.users.find_one({"id": referrer_id}, {"_id": 0, "is_vip_plus": 1})
        is_referrer_vip_plus = referrer.get("is_vip_plus", False) if referrer else False
        
        # Base reward
        reward_bids = 10
        
        # VIP+ referrer gets 20 bids if referred friend buys subscription
        if is_subscription and is_referrer_vip_plus:
            reward_bids = 20
        # Non-VIP+ referrer still gets extra for subscription referrals
        elif is_subscription:
            reward_bids = 15
        
        await db.users.update_one(
            {"id": referrer_id},
            {"$inc": {"bids_balance": reward_bids}}
        )
        
        # Notify referrer
        referred_user = await db.users.find_one({"id": referred_user_id}, {"_id": 0, "name": 1})
        referred_name = referred_user.get("name", "Dein Empfohlener") if referred_user else "Dein Empfohlener"
        
        bonus_type = "Abo" if is_subscription else "Kauf"
        await db.notifications.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": referrer_id,
            "type": "referral_reward",
            "title": "🎁 Empfehlungsbonus!",
            "message": f"{referred_name} hat eingekauft ({bonus_type})! Du erhältst {reward_bids} Gratis-Gebote!",
            "read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        logger.info(f"Referral reward: Referrer {referrer_id} earned {reward_bids} bids from {referred_user_id}'s {bonus_type}")
    
    # Update referral record
    await db.referrals.update_one(
        {"id": referral["id"]},
        {
            "$set": {
                "has_purchased": True,
                "reward_bids": 10,  # Keep track of referrer reward
                "referrer_bonus_given": True,
                "referred_bonus_given": True,
                "rewarded_at": datetime.now(timezone.utc).isoformat(),
                "purchase_type": "subscription" if is_subscription else "bids"
            }
        }
    )


# ==================== ADMIN ENDPOINTS ====================

@router.get("/admin/stats")
async def get_referral_stats(admin: dict = Depends(get_admin_user)):
    """Get referral system statistics (Admin only)"""
    total_referrals = await db.referrals.count_documents({})
    successful_referrals = await db.referrals.count_documents({"has_purchased": True})
    
    # This month
    month_start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    monthly_referrals = await db.referrals.count_documents({
        "created_at": {"$gte": month_start.isoformat()}
    })
    
    # Top referrers
    top_referrers = await db.referrals.aggregate([
        {"$group": {"_id": "$referrer_id", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 5}
    ]).to_list(5)
    
    for ref in top_referrers:
        user = await db.users.find_one({"id": ref["_id"]}, {"_id": 0, "name": 1, "email": 1})
        ref["name"] = user.get("name") if user else "Unknown"
        ref["email"] = user.get("email") if user else ""
    
    return {
        "total_referrals": total_referrals,
        "successful_referrals": successful_referrals,
        "conversion_rate": round((successful_referrals / total_referrals * 100) if total_referrals > 0 else 0, 1),
        "monthly_referrals": monthly_referrals,
        "top_referrers": top_referrers
    }


@router.post("/admin/award-prizes")
async def award_referral_prizes(
    period: str = "month",  # week or month
    prizes: dict = None,  # {"1": 100, "2": 50, "3": 25} - position: bids
    admin: dict = Depends(get_admin_user)
):
    """Award prizes to top referrers (Admin only)"""
    if prizes is None:
        prizes = {"1": 100, "2": 75, "3": 50, "4": 30, "5": 20}
    
    # Get period bounds
    now = datetime.now(timezone.utc)
    if period == "week":
        period_start = now - timedelta(days=now.weekday() + 7)  # Last week
        period_end = now - timedelta(days=now.weekday())
    else:
        # Last month
        if now.month == 1:
            period_start = now.replace(year=now.year - 1, month=12, day=1)
        else:
            period_start = now.replace(month=now.month - 1, day=1)
        period_end = now.replace(day=1)
    
    period_start = period_start.replace(hour=0, minute=0, second=0, microsecond=0)
    period_end = period_end.replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Get top referrers for that period
    pipeline = [
        {
            "$match": {
                "created_at": {
                    "$gte": period_start.isoformat(),
                    "$lt": period_end.isoformat()
                }
            }
        },
        {"$group": {"_id": "$referrer_id", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": len(prizes)}
    ]
    
    winners = await db.referrals.aggregate(pipeline).to_list(len(prizes))
    
    awarded = []
    for idx, winner in enumerate(winners):
        position = str(idx + 1)
        if position in prizes:
            bids_reward = prizes[position]
            
            # Award bids
            await db.users.update_one(
                {"id": winner["_id"]},
                {"$inc": {"bids_balance": bids_reward}}
            )
            
            # Get user info
            user = await db.users.find_one({"id": winner["_id"]}, {"_id": 0, "name": 1, "email": 1})
            
            # Notify winner
            await db.notifications.insert_one({
                "id": str(uuid.uuid4()),
                "user_id": winner["_id"],
                "type": "referral_prize",
                "title": f"🏆 Werber-Preis: Platz {position}!",
                "message": f"Glückwunsch! Du hast {bids_reward} Gratis-Gebote für Platz {position} in der Werber-Rangliste gewonnen!",
                "read": False,
                "created_at": datetime.now(timezone.utc).isoformat()
            })
            
            awarded.append({
                "position": int(position),
                "user_id": winner["_id"],
                "name": user.get("name") if user else "Unknown",
                "referrals": winner["count"],
                "bids_awarded": bids_reward
            })
            
            logger.info(f"🏆 Referral prize: #{position} {winner['_id']} got {bids_reward} bids")
    
    # Record the award
    await db.referral_awards.insert_one({
        "id": str(uuid.uuid4()),
        "period": period,
        "period_start": period_start.isoformat(),
        "period_end": period_end.isoformat(),
        "winners": awarded,
        "awarded_at": datetime.now(timezone.utc).isoformat(),
        "awarded_by": admin.get("email")
    })
    
    return {
        "message": f"{len(awarded)} Werber wurden ausgezeichnet!",
        "period": f"{period_start.strftime('%d.%m.%Y')} - {period_end.strftime('%d.%m.%Y')}",
        "winners": awarded
    }


# Export for use in other modules
__all__ = ['process_referral_reward']
