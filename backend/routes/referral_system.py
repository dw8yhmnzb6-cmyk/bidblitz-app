"""
BidBlitz V2 - Complete Referral & Rewards System
Multi-level referrals, daily bonuses, streaks, influencer/manager support.
"""

import secrets
import logging
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional
from bson import ObjectId

from core.database import db
from core.security import get_current_user
from core.payment_engine import credit_wallet, TransactionType, process_login_streak

router = APIRouter(prefix="/api/referral", tags=["Referral"])
logger = logging.getLogger("bidblitz.referral")


# ══════════════════════════════════════════════════════════════════════════════
# CONFIGURATION (Admin can modify these)
# ══════════════════════════════════════════════════════════════════════════════

DEFAULT_CONFIG = {
    # Basic referral rewards
    "new_user_bonus": 2.00,         # New user gets €2
    "inviter_bonus": 3.00,          # Inviter gets €3
    
    # Multi-level rewards (% of transaction)
    "level1_rate": 0.02,            # 2% from direct referral
    "level2_rate": 0.005,           # 0.5% from level 2
    "level3_rate": 0.001,           # 0.1% from level 3
    
    # Influencer bonuses
    "influencer_rate": 0.05,        # 5% from referrals
    "manager_rate": 0.01,           # 1% from influencer earnings
    
    # Daily bonus
    "daily_bonus": 0.10,            # €0.10 per day
    "daily_bonus_enabled": True,
    
    # Streak bonuses
    "streak_3_days": 0.50,
    "streak_7_days": 2.00,
    "streak_14_days": 5.00,
    "streak_30_days": 15.00,
    
    # Limits
    "max_referrals_per_day": 10,
    "min_transaction_for_reward": 5.00,  # Min €5 purchase to trigger reward
}


def generate_referral_code(name: str = "") -> str:
    """Generate unique referral code like BB-AFRIM123."""
    prefix = "BB"
    if name:
        # Use first 5 chars of name (uppercase, alphanumeric only)
        name_part = ''.join(c for c in name.upper() if c.isalnum())[:5]
    else:
        name_part = secrets.token_hex(2).upper()
    
    random_part = secrets.token_hex(2).upper()
    return f"{prefix}-{name_part}{random_part}"


async def get_referral_config() -> dict:
    """Get referral config from admin settings or use defaults."""
    config = await db.platform_config.find_one({"key": "referral_config"})
    if config:
        return {**DEFAULT_CONFIG, **config.get("settings", {})}
    return DEFAULT_CONFIG


# ══════════════════════════════════════════════════════════════════════════════
# SCHEMAS
# ══════════════════════════════════════════════════════════════════════════════

class ClaimDailyRequest(BaseModel):
    pass


class AdminConfigRequest(BaseModel):
    new_user_bonus: Optional[float] = None
    inviter_bonus: Optional[float] = None
    level1_rate: Optional[float] = None
    level2_rate: Optional[float] = None
    daily_bonus: Optional[float] = None
    daily_bonus_enabled: Optional[bool] = None


# ══════════════════════════════════════════════════════════════════════════════
# GET MY REFERRAL CODE
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/my-code")
async def get_my_referral_code(request: Request):
    """Get or generate user's referral code."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    referral_code = user.get("referral_code")
    
    # Generate if doesn't exist
    if not referral_code:
        referral_code = generate_referral_code(user.get("name", ""))
        
        # Ensure uniqueness
        while await db.users.find_one({"referral_code": referral_code}):
            referral_code = generate_referral_code(user.get("name", ""))
        
        await db.users.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"referral_code": referral_code}}
        )
    
    # Build share URL
    base_url = "https://bidblitz.ae"  # Or use environment variable
    share_url = f"{base_url}/register?ref={referral_code}"
    
    return {
        "referral_code": referral_code,
        "share_url": share_url,
        "share_links": {
            "whatsapp": f"https://wa.me/?text=Nutze%20meinen%20Code%20{referral_code}%20und%20erhalte%20Bonus!%20{share_url}",
            "email": f"mailto:?subject=BidBlitz%20Einladung&body=Nutze%20meinen%20Code%20{referral_code}%20und%20erhalte%20Bonus!%20{share_url}",
            "telegram": f"https://t.me/share/url?url={share_url}&text=Nutze%20meinen%20Code%20{referral_code}",
            "copy": share_url,
        }
    }


# ══════════════════════════════════════════════════════════════════════════════
# VALIDATE REFERRAL CODE (for registration)
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/validate/{code}")
async def validate_referral_code(code: str):
    """Validate a referral code before registration."""
    code = code.upper().strip()
    
    user = await db.users.find_one({"referral_code": code})
    if not user:
        return {"valid": False, "message": "Ungültiger Code"}
    
    return {
        "valid": True,
        "inviter_name": user.get("name", "")[:20],
        "code": code,
    }


# ══════════════════════════════════════════════════════════════════════════════
# APPLY REFERRAL ON REGISTRATION
# ══════════════════════════════════════════════════════════════════════════════

async def apply_referral_on_registration(new_user_id: str, referral_code: str):
    """
    Called during user registration to link referral.
    Does NOT give rewards yet - rewards come on first transaction.
    """
    if not referral_code:
        return False
    
    referral_code = referral_code.upper().strip()
    
    # Find inviter
    inviter = await db.users.find_one({"referral_code": referral_code})
    if not inviter:
        return False
    
    inviter_id = str(inviter["_id"])
    
    # Prevent self-referral
    if inviter_id == new_user_id:
        return False
    
    now = datetime.now(timezone.utc)
    
    # Link the referral
    await db.users.update_one(
        {"_id": ObjectId(new_user_id)},
        {"$set": {
            "referred_by": inviter_id,
            "referred_by_code": referral_code,
            "referral_joined_at": now.isoformat(),
        }}
    )
    
    # Record in referrals collection
    await db.referrals.insert_one({
        "referral_id": secrets.token_hex(8),
        "inviter_id": inviter_id,
        "invited_id": new_user_id,
        "code_used": referral_code,
        "status": "pending",  # Becomes "completed" after first transaction
        "inviter_rewarded": False,
        "invited_rewarded": False,
        "created_at": now.isoformat(),
    })
    
    # Update inviter stats
    await db.users.update_one(
        {"_id": ObjectId(inviter_id)},
        {"$inc": {"total_referrals": 1, "pending_referrals": 1}}
    )
    
    # Notify inviter
    await db.notifications.insert_one({
        "id": secrets.token_hex(8),
        "user_id": inviter_id,
        "type": "referral_joined",
        "title": "Neuer Freund beigetreten!",
        "message": "Jemand hat deinen Einladungscode verwendet. Du erhältst deinen Bonus nach deren erster Transaktion.",
        "read": False,
        "created_at": now.isoformat(),
    })
    
    logger.info(f"Referral linked: {new_user_id} invited by {inviter_id}")
    return True


# ══════════════════════════════════════════════════════════════════════════════
# TRIGGER REFERRAL REWARDS (after first transaction)
# ══════════════════════════════════════════════════════════════════════════════

async def trigger_referral_rewards(user_id: str, transaction_amount: float):
    """
    Called after a user's first qualifying transaction.
    Awards bonuses to both the new user and the inviter.
    """
    config = await get_referral_config()
    min_amount = config.get("min_transaction_for_reward", 5.0)
    
    if transaction_amount < min_amount:
        return  # Transaction too small
    
    # Check if user has pending referral
    referral = await db.referrals.find_one({
        "invited_id": user_id,
        "status": "pending",
    })
    
    if not referral:
        return  # No pending referral
    
    if referral.get("invited_rewarded"):
        return  # Already rewarded
    
    now = datetime.now(timezone.utc)
    inviter_id = referral["inviter_id"]
    
    # Get inviter to check if influencer
    inviter = await db.users.find_one({"_id": ObjectId(inviter_id)})
    is_influencer = inviter.get("is_influencer", False) if inviter else False
    
    # Calculate rewards
    new_user_bonus = config["new_user_bonus"]
    inviter_bonus = config["influencer_rate"] * transaction_amount if is_influencer else config["inviter_bonus"]
    
    # Award new user bonus
    await credit_wallet(
        user_id=user_id,
        amount=new_user_bonus,
        tx_type=TransactionType.REFUND,  # Using REFUND as bonus type
        description="Willkommensbonus für Empfehlung",
        reference=f"REF-WELCOME-{secrets.token_hex(4).upper()}",
        source="referral",
    )
    
    # Award inviter bonus
    await credit_wallet(
        user_id=inviter_id,
        amount=inviter_bonus,
        tx_type=TransactionType.REFUND,
        description=f"Empfehlungsbonus",
        reference=f"REF-BONUS-{secrets.token_hex(4).upper()}",
        source="referral",
    )
    
    # Update referral record
    await db.referrals.update_one(
        {"_id": referral["_id"]},
        {"$set": {
            "status": "completed",
            "invited_rewarded": True,
            "inviter_rewarded": True,
            "invited_reward": new_user_bonus,
            "inviter_reward": inviter_bonus,
            "completed_at": now.isoformat(),
        }}
    )
    
    # Update inviter stats
    await db.users.update_one(
        {"_id": ObjectId(inviter_id)},
        {
            "$inc": {
                "pending_referrals": -1,
                "completed_referrals": 1,
                "total_referral_earnings": inviter_bonus,
            }
        }
    )
    
    # Handle multi-level (level 2)
    if inviter and inviter.get("referred_by"):
        level2_id = inviter["referred_by"]
        level2_bonus = transaction_amount * config["level2_rate"]
        if level2_bonus >= 0.01:
            await credit_wallet(
                user_id=level2_id,
                amount=level2_bonus,
                tx_type=TransactionType.REFUND,
                description="Multi-Level Empfehlungsbonus (L2)",
                reference=f"REF-L2-{secrets.token_hex(4).upper()}",
                source="referral_multilevel",
            )
    
    # If inviter has manager, pay manager commission
    if inviter and inviter.get("manager_id"):
        manager_id = inviter["manager_id"]
        manager_bonus = inviter_bonus * config["manager_rate"]
        if manager_bonus >= 0.01:
            await credit_wallet(
                user_id=manager_id,
                amount=manager_bonus,
                tx_type=TransactionType.REFUND,
                description="Manager-Provision von Influencer",
                reference=f"MGR-{secrets.token_hex(4).upper()}",
                source="manager_commission",
            )
    
    # Notifications
    await db.notifications.insert_one({
        "id": secrets.token_hex(8),
        "user_id": user_id,
        "type": "referral_bonus",
        "title": f"€{new_user_bonus:.2f} Willkommensbonus!",
        "message": "Du hast deinen Empfehlungsbonus erhalten!",
        "read": False,
        "created_at": now.isoformat(),
    })
    
    await db.notifications.insert_one({
        "id": secrets.token_hex(8),
        "user_id": inviter_id,
        "type": "referral_bonus",
        "title": f"€{inviter_bonus:.2f} Empfehlungsbonus!",
        "message": "Dein eingeladener Freund hat seine erste Zahlung gemacht!",
        "read": False,
        "created_at": now.isoformat(),
    })
    
    logger.info(f"Referral rewards triggered: {user_id} → {inviter_id}")


# ══════════════════════════════════════════════════════════════════════════════
# REFERRAL DASHBOARD
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/dashboard")
async def get_referral_dashboard(request: Request):
    """Get user's referral statistics and history."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    # Get stats
    total_referrals = user.get("total_referrals", 0)
    pending_referrals = user.get("pending_referrals", 0)
    completed_referrals = user.get("completed_referrals", 0)
    total_earnings = user.get("total_referral_earnings", 0)
    
    # Get referral history
    referrals = await db.referrals.find(
        {"inviter_id": user_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(50).to_list(50)
    
    # Enrich with invited user info
    for ref in referrals:
        invited_user = await db.users.find_one(
            {"_id": ObjectId(ref["invited_id"])},
            {"name": 1, "created_at": 1}
        )
        if invited_user:
            ref["invited_name"] = invited_user.get("name", "")[:20]
            ref["invited_joined"] = invited_user.get("created_at", "")
    
    config = await get_referral_config()
    
    return {
        "stats": {
            "total_invited": total_referrals,
            "pending": pending_referrals,
            "completed": completed_referrals,
            "total_earnings": round(total_earnings, 2),
        },
        "referrals": referrals,
        "rewards": {
            "new_user_gets": config["new_user_bonus"],
            "inviter_gets": config["inviter_bonus"],
        },
        "is_influencer": user.get("is_influencer", False),
    }


# ══════════════════════════════════════════════════════════════════════════════
# DAILY BONUS
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/claim-daily")
async def claim_daily_bonus(request: Request):
    """Claim daily login bonus."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    config = await get_referral_config()
    
    if not config.get("daily_bonus_enabled", True):
        raise HTTPException(status_code=400, detail="Täglicher Bonus deaktiviert")
    
    now = datetime.now(timezone.utc)
    today = now.strftime("%Y-%m-%d")
    
    # Check if already claimed today
    existing = await db.daily_claims.find_one({
        "user_id": user_id,
        "date": today,
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Bereits heute abgeholt")
    
    bonus_amount = config["daily_bonus"]
    
    # Record claim
    await db.daily_claims.insert_one({
        "user_id": user_id,
        "date": today,
        "amount": bonus_amount,
        "created_at": now.isoformat(),
    })
    
    # Credit wallet
    await credit_wallet(
        user_id=user_id,
        amount=bonus_amount,
        tx_type=TransactionType.REFUND,
        description="Täglicher Login-Bonus",
        reference=f"DAILY-{today}",
        source="daily_bonus",
    )
    
    # Process login streak (from payment_engine)
    await process_login_streak(user_id)
    
    # Get streak info
    streak = await db.user_streaks.find_one({"user_id": user_id})
    current_streak = streak.get("login_streak", 1) if streak else 1
    
    # Notify
    await db.notifications.insert_one({
        "id": secrets.token_hex(8),
        "user_id": user_id,
        "type": "daily_bonus",
        "title": f"€{bonus_amount:.2f} Tagesbonus!",
        "message": f"Streak: {current_streak} Tage 🔥",
        "read": False,
        "created_at": now.isoformat(),
    })
    
    return {
        "ok": True,
        "amount": bonus_amount,
        "streak": current_streak,
        "message": f"€{bonus_amount:.2f} gutgeschrieben!",
    }


@router.get("/daily-status")
async def get_daily_bonus_status(request: Request):
    """Check if daily bonus is available."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    config = await get_referral_config()
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    existing = await db.daily_claims.find_one({
        "user_id": user_id,
        "date": today,
    })
    
    streak = await db.user_streaks.find_one({"user_id": user_id})
    
    return {
        "can_claim": existing is None and config.get("daily_bonus_enabled", True),
        "already_claimed": existing is not None,
        "bonus_amount": config["daily_bonus"],
        "current_streak": streak.get("login_streak", 0) if streak else 0,
        "enabled": config.get("daily_bonus_enabled", True),
    }


# ══════════════════════════════════════════════════════════════════════════════
# INFLUENCER ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/influencer/stats")
async def get_influencer_stats(request: Request):
    """Get influencer-specific stats."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    if not user.get("is_influencer"):
        raise HTTPException(status_code=403, detail="Nur für Influencer")
    
    # Get all referrals
    referrals = await db.referrals.find(
        {"inviter_id": user_id, "status": "completed"}
    ).to_list(1000)
    
    total_volume = sum(r.get("inviter_reward", 0) for r in referrals)
    
    # Get monthly stats
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    monthly_referrals = await db.referrals.count_documents({
        "inviter_id": user_id,
        "created_at": {"$gte": month_start.isoformat()},
    })
    
    config = await get_referral_config()
    
    return {
        "is_influencer": True,
        "commission_rate": config["influencer_rate"] * 100,
        "total_referrals": len(referrals),
        "total_earnings": round(total_volume, 2),
        "monthly_referrals": monthly_referrals,
        "manager_id": user.get("manager_id"),
    }


# ══════════════════════════════════════════════════════════════════════════════
# ADMIN ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/admin/config")
async def admin_get_config(request: Request):
    """Admin: Get current referral configuration."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Nur Admin")
    
    config = await get_referral_config()
    return {"config": config}


@router.post("/admin/config")
async def admin_update_config(req: AdminConfigRequest, request: Request):
    """Admin: Update referral configuration."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Nur Admin")
    
    updates = {}
    for field, value in req.dict(exclude_none=True).items():
        updates[f"settings.{field}"] = value
    
    if updates:
        await db.platform_config.update_one(
            {"key": "referral_config"},
            {"$set": updates},
            upsert=True
        )
    
    config = await get_referral_config()
    return {"ok": True, "config": config}


@router.post("/admin/make-influencer/{user_id}")
async def admin_make_influencer(user_id: str, request: Request):
    """Admin: Promote user to influencer."""
    admin = await get_current_user(request)
    if admin.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Nur Admin")
    
    result = await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"is_influencer": True}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Benutzer nicht gefunden")
    
    return {"ok": True, "message": "Benutzer ist jetzt Influencer"}


@router.get("/admin/stats")
async def admin_get_referral_stats(request: Request):
    """Admin: Get platform-wide referral statistics."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Nur Admin")
    
    total_referrals = await db.referrals.count_documents({})
    completed = await db.referrals.count_documents({"status": "completed"})
    pending = await db.referrals.count_documents({"status": "pending"})
    
    # Total paid out
    all_completed = await db.referrals.find({"status": "completed"}).to_list(10000)
    total_paid = sum(r.get("inviter_reward", 0) + r.get("invited_reward", 0) for r in all_completed)
    
    # Top inviters
    pipeline = [
        {"$group": {"_id": "$inviter_id", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 10},
    ]
    top_inviters = await db.referrals.aggregate(pipeline).to_list(10)
    
    # Enrich with names
    for inv in top_inviters:
        user_doc = await db.users.find_one({"_id": ObjectId(inv["_id"])})
        inv["name"] = user_doc.get("name", "") if user_doc else ""
        inv["email"] = user_doc.get("email", "") if user_doc else ""
    
    return {
        "total_referrals": total_referrals,
        "completed": completed,
        "pending": pending,
        "total_paid_out": round(total_paid, 2),
        "top_inviters": top_inviters,
    }
