"""
BidBlitz V2 - Complete Referral & Rewards System
Multi-level referrals, daily bonuses, streaks, influencer/manager support.
"""

import secrets
from pymongo.errors import DuplicateKeyError
import logging
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
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
    new_user_bonus: Optional[float] = Field(default=None, ge=0, le=100, allow_inf_nan=False)
    inviter_bonus: Optional[float] = Field(default=None, ge=0, le=100, allow_inf_nan=False)
    level1_rate: Optional[float] = Field(default=None, ge=0, le=1, allow_inf_nan=False)
    level2_rate: Optional[float] = Field(default=None, ge=0, le=1, allow_inf_nan=False)
    daily_bonus: Optional[float] = Field(default=None, ge=0, le=100, allow_inf_nan=False)
    daily_bonus_enabled: Optional[bool] = None


class MerchantReferralApplyRequest(BaseModel):
    code: str = Field(..., min_length=3, max_length=32)


class FranchiseApplicationRequest(BaseModel):
    business_name: str = Field(..., min_length=2, max_length=120)
    city: str = Field(..., min_length=2, max_length=120)
    country: str = Field(..., min_length=2, max_length=2)
    experience: str = Field("", max_length=1200)
    capital_available: float = Field(0, ge=0)
    message: str = Field("", max_length=1200)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _ensure_referral_code(user: dict) -> str:
    existing = user.get("referral_code")
    if existing:
        return existing
    referral_code = generate_referral_code(user.get("name", ""))
    while await db.users.find_one({"referral_code": referral_code}):
        referral_code = generate_referral_code(user.get("name", ""))
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"referral_code": referral_code}})
    return referral_code


async def _build_growth_snapshot() -> Dict[str, Any]:
    now = datetime.now(timezone.utc)
    day_start = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    week_start = (now - timedelta(days=7)).isoformat()
    month_start = (now - timedelta(days=30)).isoformat()
    year_start = (now - timedelta(days=365)).isoformat()

    sales = await db.pos_sales.find(
        {"created_at": {"$gte": year_start}, "status": "completed"},
        {"_id": 0, "created_at": 1, "total": 1},
    ).to_list(50000)

    def revenue_since(start: str) -> float:
        return round(sum(float(s.get("total", 0) or 0) for s in sales if str(s.get("created_at", "")) >= start), 2)

    return {
        "daily": {
            "user_growth": await db.users.count_documents({"created_at": {"$gte": day_start}}),
            "merchant_growth": await db.merchants.count_documents({"created_at": {"$gte": day_start}}),
            "referral_growth": await db.referrals.count_documents({"created_at": {"$gte": day_start}}),
            "revenue_growth": revenue_since(day_start),
        },
        "weekly": {
            "user_growth": await db.users.count_documents({"created_at": {"$gte": week_start}}),
            "merchant_growth": await db.merchants.count_documents({"created_at": {"$gte": week_start}}),
            "referral_growth": await db.referrals.count_documents({"created_at": {"$gte": week_start}}),
            "revenue_growth": revenue_since(week_start),
        },
        "monthly": {
            "user_growth": await db.users.count_documents({"created_at": {"$gte": month_start}}),
            "merchant_growth": await db.merchants.count_documents({"created_at": {"$gte": month_start}}),
            "referral_growth": await db.referrals.count_documents({"created_at": {"$gte": month_start}}),
            "revenue_growth": revenue_since(month_start),
        },
        "yearly": {
            "user_growth": await db.users.count_documents({"created_at": {"$gte": year_start}}),
            "merchant_growth": await db.merchants.count_documents({"created_at": {"$gte": year_start}}),
            "referral_growth": await db.referrals.count_documents({"created_at": {"$gte": year_start}}),
            "revenue_growth": revenue_since(year_start),
        },
    }


# ══════════════════════════════════════════════════════════════════════════════
# GET MY REFERRAL CODE
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/program/my-code")
async def get_my_referral_code(request: Request):
    """Get or generate user's referral code."""
    user = await get_current_user(request)
    referral_code = await _ensure_referral_code(user)
    
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
    """Award all referral legs exactly once after the first qualifying transaction."""
    config = await get_referral_config()
    min_amount = float(config.get("min_transaction_for_reward", 5.0) or 0)
    if transaction_amount < min_amount:
        return {"rewarded": False, "reason": "below_minimum"}

    referral = await db.referrals.find_one({
        "invited_id": user_id,
        "status": "pending",
    })
    if not referral:
        return {"rewarded": False, "reason": "no_pending_referral"}

    inviter_id = str(referral["inviter_id"])
    inviter = None
    try:
        inviter = await db.users.find_one({"_id": ObjectId(inviter_id)})
    except Exception:
        inviter = await db.users.find_one({"id": inviter_id})
    if not inviter:
        return {"rewarded": False, "reason": "inviter_missing"}

    is_influencer = bool(inviter.get("is_influencer", False))
    new_user_bonus = round(float(config["new_user_bonus"]), 2)
    inviter_bonus = round(
        float(config["influencer_rate"]) * float(transaction_amount)
        if is_influencer else float(config["inviter_bonus"]),
        2,
    )
    reward_scope = f"refsys:{user_id}"
    now = datetime.now(timezone.utc)

    invited_result = await credit_wallet(
        user_id=user_id,
        amount=new_user_bonus,
        tx_type=TransactionType.REWARD,
        description="Willkommensbonus für Empfehlung",
        reference=f"REFSYS-{user_id[:8]}-NEW",
        source="referral",
        metadata={"invited_id": user_id, "inviter_id": inviter_id, "leg": "invited"},
        idempotency_key=f"{reward_scope}:invited",
    )
    if not invited_result.success:
        return {"rewarded": False, "reason": invited_result.error or "invited_credit_failed"}

    inviter_result = await credit_wallet(
        user_id=inviter_id,
        amount=inviter_bonus,
        tx_type=TransactionType.REWARD,
        description="Empfehlungsbonus",
        reference=f"REFSYS-{user_id[:8]}-INV",
        source="referral",
        metadata={"invited_id": user_id, "inviter_id": inviter_id, "leg": "inviter"},
        idempotency_key=f"{reward_scope}:inviter",
    )
    if not inviter_result.success:
        return {"rewarded": False, "reason": inviter_result.error or "inviter_credit_failed"}

    level2_result = None
    if inviter.get("referred_by"):
        level2_id = str(inviter["referred_by"])
        level2_bonus = round(float(transaction_amount) * float(config["level2_rate"]), 2)
        if level2_bonus >= 0.01:
            level2_result = await credit_wallet(
                user_id=level2_id,
                amount=level2_bonus,
                tx_type=TransactionType.REWARD,
                description="Multi-Level Empfehlungsbonus (L2)",
                reference=f"REFSYS-{user_id[:8]}-L2",
                source="referral_multilevel",
                metadata={"invited_id": user_id, "inviter_id": inviter_id, "leg": "level2"},
                idempotency_key=f"{reward_scope}:level2",
            )
            if not level2_result.success:
                return {"rewarded": False, "reason": level2_result.error or "level2_credit_failed"}

    manager_result = None
    if inviter.get("manager_id"):
        manager_id = str(inviter["manager_id"])
        manager_bonus = round(inviter_bonus * float(config["manager_rate"]), 2)
        if manager_bonus >= 0.01:
            manager_result = await credit_wallet(
                user_id=manager_id,
                amount=manager_bonus,
                tx_type=TransactionType.REWARD,
                description="Manager-Provision von Influencer",
                reference=f"REFSYS-{user_id[:8]}-MGR",
                source="manager_commission",
                metadata={"invited_id": user_id, "inviter_id": inviter_id, "leg": "manager"},
                idempotency_key=f"{reward_scope}:manager",
            )
            if not manager_result.success:
                return {"rewarded": False, "reason": manager_result.error or "manager_credit_failed"}

    completed = await db.referrals.update_one(
        {"_id": referral["_id"], "status": "pending"},
        {"$set": {
            "status": "completed",
            "invited_rewarded": True,
            "inviter_rewarded": True,
            "invited_reward": new_user_bonus,
            "inviter_reward": inviter_bonus,
            "completed_at": now.isoformat(),
            "invited_transaction_id": invited_result.transaction_id,
            "inviter_transaction_id": inviter_result.transaction_id,
            "level2_transaction_id": level2_result.transaction_id if level2_result else None,
            "manager_transaction_id": manager_result.transaction_id if manager_result else None,
        }},
    )

    if completed.modified_count == 1:
        try:
            inviter_oid = ObjectId(inviter_id)
            await db.users.update_one(
                {"_id": inviter_oid},
                {
                    "$inc": {
                        "pending_referrals": -1,
                        "completed_referrals": 1,
                        "total_referral_earnings": inviter_bonus,
                    }
                },
            )
        except Exception:
            logger.warning("Referral stats update failed for inviter %s", inviter_id)

        await db.notifications.update_one(
            {"id": f"REFSYS-{user_id}-NEW"},
            {"$setOnInsert": {
                "id": f"REFSYS-{user_id}-NEW",
                "user_id": user_id,
                "type": "referral_bonus",
                "title": f"€{new_user_bonus:.2f} Willkommensbonus!",
                "message": "Du hast deinen Empfehlungsbonus erhalten!",
                "read": False,
                "created_at": now.isoformat(),
            }},
            upsert=True,
        )
        await db.notifications.update_one(
            {"id": f"REFSYS-{user_id}-INV"},
            {"$setOnInsert": {
                "id": f"REFSYS-{user_id}-INV",
                "user_id": inviter_id,
                "type": "referral_bonus",
                "title": f"€{inviter_bonus:.2f} Empfehlungsbonus!",
                "message": "Dein eingeladener Freund hat seine erste Zahlung gemacht!",
                "read": False,
                "created_at": now.isoformat(),
            }},
            upsert=True,
        )

    logger.info("Referral rewards processed: %s -> %s", user_id, inviter_id)
    return {
        "rewarded": True,
        "invited_transaction_id": invited_result.transaction_id,
        "inviter_transaction_id": inviter_result.transaction_id,
        "replayed": completed.modified_count != 1,
    }


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
        "merchant_referral": {
            "free_months_earned": int(user.get("merchant_free_months", 0) or 0),
            "cashback_earned": round(float(user.get("merchant_cashback_earned", 0) or 0), 2),
            "revenue_share_earned": round(float(user.get("merchant_revenue_share_earned", 0) or 0), 2),
        },
        "growth": await _build_growth_snapshot(),
    }


@router.get("/merchant-program")
async def get_merchant_referral_program(request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    code = await _ensure_referral_code(user)
    referrals = await db.merchant_partner_referrals.find({"inviter_user_id": user_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    completed = [ref for ref in referrals if ref.get("status") == "completed"]
    return {
        "code": code,
        "stats": {
            "total": len(referrals),
            "pending": len([ref for ref in referrals if ref.get("status") == "pending"]),
            "completed": len(completed),
            "free_months": sum(int(ref.get("free_months_awarded", 0) or 0) for ref in completed),
            "cashback": round(sum(float(ref.get("cashback_awarded", 0) or 0) for ref in completed), 2),
            "revenue_share": round(sum(float(ref.get("revenue_share_awarded", 0) or 0) for ref in completed), 2),
        },
        "rewards": {
            "free_month": 1,
            "cashback": 25,
            "revenue_share_rate": 0.01,
        },
        "referrals": referrals,
    }


@router.post("/merchant-program/apply")
async def apply_merchant_referral(req: MerchantReferralApplyRequest, request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    code = req.code.upper().strip()
    inviter = await db.users.find_one({"referral_code": code})
    if not inviter:
        raise HTTPException(status_code=404, detail="Referral-Code nicht gefunden")
    inviter_id = str(inviter["_id"])
    if inviter_id == user_id:
        raise HTTPException(status_code=400, detail="Eigenen Code kannst du nicht nutzen")
    existing = await db.merchant_partner_referrals.find_one({"invited_user_id": user_id})
    if existing:
        raise HTTPException(status_code=400, detail="Merchant-Referral bereits vorhanden")

    doc = {
        "referral_id": secrets.token_hex(8),
        "inviter_user_id": inviter_id,
        "inviter_name": inviter.get("name", ""),
        "invited_user_id": user_id,
        "invited_name": user.get("name", ""),
        "code_used": code,
        "status": "pending",
        "free_months_awarded": 0,
        "cashback_awarded": 0.0,
        "revenue_share_awarded": 0.0,
        "created_at": _now_iso(),
    }
    await db.merchant_partner_referrals.insert_one(doc)
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"merchant_referred_by": inviter_id, "merchant_referred_by_code": code}})
    return {"ok": True, "message": "Merchant-Referral gespeichert", "referral": doc}


@router.get("/growth-dashboard")
async def get_growth_dashboard(request: Request):
    await get_current_user(request)
    return await _build_growth_snapshot()


@router.post("/franchise/apply")
async def submit_franchise_application(req: FranchiseApplicationRequest, request: Request):
    user = await get_current_user(request)
    doc = {
        "application_id": f"FRA-{secrets.token_hex(5).upper()}",
        "user_id": str(user["_id"]),
        "user_name": user.get("name", ""),
        "email": user.get("email", ""),
        "business_name": req.business_name,
        "city": req.city,
        "country": req.country.upper(),
        "experience": req.experience,
        "capital_available": round(float(req.capital_available or 0), 2),
        "message": req.message,
        "status": "pending",
        "created_at": _now_iso(),
    }
    await db.franchise_applications.insert_one(doc)
    return {"ok": True, "application": doc}


@router.get("/franchise/applications")
async def get_franchise_applications(request: Request):
    user = await get_current_user(request)
    if user.get("role") == "admin":
        items = await db.franchise_applications.find({}, {"_id": 0}).sort("created_at", -1).limit(100).to_list(100)
        return {"applications": items}
    items = await db.franchise_applications.find({"user_id": str(user["_id"])}, {"_id": 0}).sort("created_at", -1).to_list(20)
    return {"applications": items}


# ══════════════════════════════════════════════════════════════════════════════
# DAILY BONUS
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/claim-daily")
async def claim_daily_bonus(request: Request):
    """Claim the daily login bonus exactly once and resume safely after retries."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    config = await get_referral_config()
    if not config.get("daily_bonus_enabled", True):
        raise HTTPException(status_code=400, detail="Täglicher Bonus deaktiviert")

    now = datetime.now(timezone.utc)
    today = now.strftime("%Y-%m-%d")
    bonus_amount = round(float(config["daily_bonus"]), 2)
    claim_id = f"daily-bonus:{user_id}:{today}"

    claim = await db.daily_claims.find_one({"_id": claim_id}, {"_id": 0})
    if claim and claim.get("status") == "completed":
        streak = await db.user_streaks.find_one({"user_id": user_id}, {"_id": 0}) or {}
        fresh_user = await db.users.find_one({"_id": user["_id"]}, {"balance": 1, "_id": 0}) or {}
        return {
            "ok": True,
            "amount": float(claim.get("amount") or bonus_amount),
            "streak": int(streak.get("login_streak") or 1),
            "new_balance": round(float(fresh_user.get("balance") or 0), 2),
            "message": "Tagesbonus bereits gutgeschrieben.",
            "replayed": True,
        }

    if not claim:
        try:
            await db.daily_claims.insert_one({
                "_id": claim_id,
                "user_id": user_id,
                "date": today,
                "amount": bonus_amount,
                "status": "processing",
                "created_at": now.isoformat(),
            })
        except DuplicateKeyError:
            pass

    result = await credit_wallet(
        user_id=user_id,
        amount=bonus_amount,
        tx_type=TransactionType.REWARD,
        description="Täglicher Login-Bonus",
        reference=f"DAILY-{today}-{user_id[:8]}",
        source="daily_bonus",
        metadata={"claim_id": claim_id, "date": today},
        idempotency_key=claim_id,
    )
    if not result.success:
        await db.daily_claims.update_one(
            {"_id": claim_id},
            {"$set": {
                "status": "reconciliation_required" if str(getattr(result.status, "value", result.status)) == "reconciliation_required" else "processing",
                "wallet_error": result.error,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }},
        )
        raise HTTPException(status_code=409, detail=result.error or "Bonus konnte nicht sicher gutgeschrieben werden")

    await db.daily_claims.update_one(
        {"_id": claim_id},
        {"$set": {
            "status": "wallet_credited",
            "wallet_transaction_id": result.transaction_id,
            "wallet_credited_at": datetime.now(timezone.utc).isoformat(),
        }},
    )

    streak_result = await process_login_streak(user_id)
    if streak_result and not streak_result.get("success", True):
        await db.daily_claims.update_one(
            {"_id": claim_id},
            {"$set": {
                "status": "streak_pending",
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }},
        )
        raise HTTPException(status_code=409, detail="Bonus ist gutgeschrieben; Streak wird beim nächsten Versuch fortgesetzt")

    streak = await db.user_streaks.find_one({"user_id": user_id}, {"_id": 0}) or {}
    current_streak = int(streak.get("login_streak") or 1)
    completed_at = datetime.now(timezone.utc).isoformat()
    await db.daily_claims.update_one(
        {"_id": claim_id},
        {"$set": {
            "status": "completed",
            "completed_at": completed_at,
            "streak": current_streak,
        }},
    )

    await db.notifications.update_one(
        {"id": f"DAILY-BONUS-{user_id}-{today}"},
        {"$setOnInsert": {
            "id": f"DAILY-BONUS-{user_id}-{today}",
            "user_id": user_id,
            "type": "daily_bonus",
            "title": f"€{bonus_amount:.2f} Tagesbonus!",
            "message": f"Streak: {current_streak} Tage 🔥",
            "read": False,
            "created_at": completed_at,
        }},
        upsert=True,
    )

    return {
        "ok": True,
        "amount": bonus_amount,
        "streak": current_streak,
        "new_balance": result.new_balance,
        "message": f"€{bonus_amount:.2f} gutgeschrieben!",
        "replayed": bool(result.idempotent_replay),
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
