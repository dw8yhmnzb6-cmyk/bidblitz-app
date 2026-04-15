"""
BidBlitz V2 - Level Up Subscription (Tiered Rewards) + Referral System
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from datetime import datetime, timezone, timedelta
from core.database import db
from core.security import get_current_user
import secrets, hashlib

router = APIRouter(prefix="/api/levelup", tags=["levelup"])

TIERS = [
    {"id": "starter", "name": "Starter", "price": 0, "cashback": 1, "earn_bonus": 0, "features": ["Basis-Trading", "1% Cashback", "Standard Support"], "color": "#6B7280"},
    {"id": "silver", "name": "Silver", "price": 4.99, "cashback": 2, "earn_bonus": 0.5, "features": ["2% Cashback", "+0.5% Earn Bonus", "Prioritaet-Support", "Keine Trading-Gebuehren bis 500 EUR/Mo"], "color": "#94A3B8"},
    {"id": "gold", "name": "Gold", "price": 9.99, "cashback": 3, "earn_bonus": 1.0, "features": ["3% Cashback", "+1% Earn Bonus", "VIP Support", "Keine Trading-Gebuehren bis 2.000 EUR/Mo", "Exklusive Airdrops"], "color": "#F59E0B"},
    {"id": "platinum", "name": "Platinum", "price": 19.99, "cashback": 5, "earn_bonus": 2.0, "features": ["5% Cashback", "+2% Earn Bonus", "Persoenlicher Berater", "Unbegrenzt kostenlos traden", "Priority Airdrops", "Lounge-Zugang Events"], "color": "#8B5CF6"},
    {"id": "obsidian", "name": "Obsidian", "price": 49.99, "cashback": 8, "earn_bonus": 3.0, "features": ["8% Cashback", "+3% Earn Bonus", "Dedizierter Account Manager", "Private Events", "Metal-Karte", "Airport Lounge weltweit"], "color": "#0F0F0F"},
]

TIER_ORDER = ["starter", "silver", "gold", "platinum", "obsidian"]

# Referral rewards config
REFERRAL_REWARDS = {
    "referrer_free_months": 1,      # 1 Monat gratis fuer den Einlader
    "referrer_bonus_eur": 5.0,      # 5 EUR Wallet-Bonus fuer den Einlader
    "referee_bonus_eur": 10.0,      # 10 EUR Wallet-Bonus fuer den Eingeladenen
    "referee_free_tier": "silver",   # Eingeladener bekommt 1 Monat Silver gratis
    "max_referrals_per_user": 50,   # Max Einladungen pro User
}


class SubscribeTier(BaseModel):
    tier_id: str


class RedeemReferral(BaseModel):
    referral_code: str


@router.get("/tiers")
async def get_tiers():
    return {"tiers": TIERS}


@router.get("/my-tier")
async def get_my_tier(request: Request):
    user = await get_current_user(request)
    email = user.get("email", "")
    sub = await db.levelup_subscriptions.find_one(
        {"user_email": email, "status": "active"}, {"_id": 0}
    )
    if not sub:
        return {"tier": TIERS[0], "subscribed": False}
    tier = next((t for t in TIERS if t["id"] == sub.get("tier_id")), TIERS[0])
    return {"tier": tier, "subscribed": True, "since": sub.get("created_at")}


@router.post("/subscribe")
async def subscribe(req: SubscribeTier, request: Request):
    user = await get_current_user(request)
    tier = next((t for t in TIERS if t["id"] == req.tier_id), None)
    if not tier:
        raise HTTPException(404, "Tier nicht gefunden")
    await db.levelup_subscriptions.update_many(
        {"user_email": user.get("email", ""), "status": "active"},
        {"$set": {"status": "cancelled"}}
    )
    sub = {
        "sub_id": f"lvl_{secrets.token_hex(6)}",
        "user_email": user.get("email", ""),
        "tier_id": req.tier_id,
        "tier_name": tier["name"],
        "price": tier["price"],
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.levelup_subscriptions.insert_one(sub)
    return {"ok": True, "tier": tier, "message": f"{tier['name']} Abo aktiviert!"}


# ─── REFERRAL SYSTEM ───

@router.get("/referral")
async def get_referral_info(request: Request):
    """Get user's referral code and stats."""
    user = await get_current_user(request)
    email = user.get("email", "")

    # Find or create referral code
    ref = await db.levelup_referrals.find_one({"user_email": email}, {"_id": 0})
    if not ref:
        raw = f"{email}:{secrets.token_hex(8)}"
        code = "BLITZ-" + hashlib.sha256(raw.encode()).hexdigest()[:6].upper()
        ref = {
            "user_email": email,
            "referral_code": code,
            "total_referrals": 0,
            "total_bonus_earned": 0,
            "free_months_earned": 0,
            "referrals": [],
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.levelup_referrals.insert_one(ref)
        ref.pop("_id", None)

    return {
        "referral_code": ref["referral_code"],
        "total_referrals": ref.get("total_referrals", 0),
        "total_bonus_earned": ref.get("total_bonus_earned", 0),
        "free_months_earned": ref.get("free_months_earned", 0),
        "referrals": ref.get("referrals", [])[-10:],
        "rewards_config": REFERRAL_REWARDS,
    }


@router.post("/referral/redeem")
async def redeem_referral(req: RedeemReferral, request: Request):
    """New user redeems a referral code from a friend."""
    user = await get_current_user(request)
    email = user.get("email", "")

    # Check user hasn't already redeemed a referral
    existing = await db.levelup_referral_redeems.find_one({"redeemed_by": email})
    if existing:
        raise HTTPException(400, "Du hast bereits einen Einladungscode eingeloest!")

    # Find the referrer
    referrer = await db.levelup_referrals.find_one({"referral_code": req.referral_code.upper().strip()})
    if not referrer:
        raise HTTPException(404, "Einladungscode ungueltig!")

    referrer_email = referrer["user_email"]
    if referrer_email == email:
        raise HTTPException(400, "Du kannst deinen eigenen Code nicht einloesen!")

    if referrer.get("total_referrals", 0) >= REFERRAL_REWARDS["max_referrals_per_user"]:
        raise HTTPException(400, "Dieser Einladungscode hat das Maximum erreicht")

    now = datetime.now(timezone.utc).isoformat()

    # 1. Reward the REFEREE (new user): Wallet bonus + free Silver month
    await db.users.update_one({"email": email}, {"$inc": {"balance": REFERRAL_REWARDS["referee_bonus_eur"]}})

    # Give referee free Silver tier for 1 month
    free_tier = next((t for t in TIERS if t["id"] == REFERRAL_REWARDS["referee_free_tier"]), TIERS[1])
    await db.levelup_subscriptions.update_many(
        {"user_email": email, "status": "active"}, {"$set": {"status": "cancelled"}}
    )
    await db.levelup_subscriptions.insert_one({
        "sub_id": f"lvl_{secrets.token_hex(6)}",
        "user_email": email,
        "tier_id": free_tier["id"],
        "tier_name": free_tier["name"],
        "price": 0,
        "status": "active",
        "source": "referral_reward",
        "referrer_email": referrer_email,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(),
        "created_at": now,
    })

    # 2. Reward the REFERRER: Wallet bonus + extend subscription by 1 month
    await db.users.update_one({"email": referrer_email}, {"$inc": {"balance": REFERRAL_REWARDS["referrer_bonus_eur"]}})

    # Update referrer stats
    user_doc = await db.users.find_one({"email": email})
    referee_name = user_doc.get("name", "Unbekannt") if user_doc else "Unbekannt"

    await db.levelup_referrals.update_one(
        {"user_email": referrer_email},
        {
            "$inc": {
                "total_referrals": 1,
                "total_bonus_earned": REFERRAL_REWARDS["referrer_bonus_eur"],
                "free_months_earned": REFERRAL_REWARDS["referrer_free_months"],
            },
            "$push": {
                "referrals": {
                    "name": referee_name,
                    "date": now,
                    "bonus": REFERRAL_REWARDS["referrer_bonus_eur"],
                }
            },
        },
    )

    # Record redemption
    await db.levelup_referral_redeems.insert_one({
        "redeemed_by": email,
        "referral_code": req.referral_code.upper().strip(),
        "referrer_email": referrer_email,
        "created_at": now,
    })

    return {
        "ok": True,
        "message": f"Einladungscode eingeloest! Du erhaeltst {REFERRAL_REWARDS['referee_bonus_eur']} EUR Bonus + 1 Monat {free_tier['name']} gratis!",
        "bonus_eur": REFERRAL_REWARDS["referee_bonus_eur"],
        "free_tier": free_tier["name"],
    }


@router.get("/referral/leaderboard")
async def referral_leaderboard():
    """Top referrers leaderboard."""
    top = await db.levelup_referrals.find(
        {"total_referrals": {"$gt": 0}}, {"_id": 0, "user_email": 1, "total_referrals": 1, "total_bonus_earned": 1}
    ).sort("total_referrals", -1).to_list(10)

    # Mask emails for privacy
    for t in top:
        e = t.get("user_email", "")
        t["display_name"] = e.split("@")[0][:3] + "***" if e else "***"
        del t["user_email"]

    return {"leaderboard": top}
