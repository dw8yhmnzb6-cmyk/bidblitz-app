"""
BidBlitz V2 — Crypto Mining Module
Virtual mining system with miners, upgrades, VIP levels, referrals.
"""

import secrets
import random
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional
from bson import ObjectId
from core.database import db
from core.security import get_current_user

router = APIRouter(prefix="/api/mining", tags=["mining"])

# ── Constants ──
BLZ_TO_EUR = 0.10  # 1 BLZ token = €0.10
DAILY_BASE_RATE = 0.5  # BLZ per TH/s per day
REFERRAL_BONUS_RATE = 0.05  # 5% of referral's mining earnings

MINER_PACKAGES = [
    {"id": "starter", "name": "Starter Rig", "hashrate": 10, "base_efficiency": 0.85, "price_eur": 49, "price_monthly": 4.99, "price_yearly": 44.99, "icon": "cpu"},
    {"id": "pro", "name": "Pro Miner", "hashrate": 50, "base_efficiency": 0.90, "price_eur": 199, "price_monthly": 19.99, "price_yearly": 179.99, "icon": "server"},
    {"id": "elite", "name": "Elite Station", "hashrate": 200, "base_efficiency": 0.93, "price_eur": 699, "price_monthly": 69.99, "price_yearly": 629.99, "icon": "zap"},
    {"id": "titan", "name": "Titan Cluster", "hashrate": 1000, "base_efficiency": 0.96, "price_eur": 2999, "price_monthly": 249.99, "price_yearly": 2399.99, "icon": "flame"},
    {"id": "quantum", "name": "Quantum Array", "hashrate": 5000, "base_efficiency": 0.98, "price_eur": 9999, "price_monthly": 799.99, "price_yearly": 7999.99, "icon": "atom"},
]

DISCOUNT_RATES = {
    "onetime": 0,
    "monthly": 0.30,  # 30% off original
    "yearly": 0.40,   # 40% off original
}

UPGRADE_COSTS = {
    "power": [0, 10, 25, 50, 100, 200, 400, 800, 1500, 3000],
    "efficiency": [0, 15, 35, 70, 150, 300, 600, 1200, 2500, 5000],
}

VIP_LEVELS = [
    {"level": 0, "name": "Bronze", "min_hashrate": 0, "bonus": 0, "color": "#CD7F32"},
    {"level": 1, "name": "Silver", "min_hashrate": 100, "bonus": 0.02, "color": "#C0C0C0"},
    {"level": 2, "name": "Gold", "min_hashrate": 500, "bonus": 0.05, "color": "#FFD700"},
    {"level": 3, "name": "Platinum", "min_hashrate": 2000, "bonus": 0.10, "color": "#E5E4E2"},
    {"level": 4, "name": "Diamond", "min_hashrate": 10000, "bonus": 0.15, "color": "#B9F2FF"},
]


def get_vip_level(total_hashrate):
    """Determine VIP level based on total hashrate."""
    current = VIP_LEVELS[0]
    for vl in VIP_LEVELS:
        if total_hashrate >= vl["min_hashrate"]:
            current = vl
    return current


def calc_daily_earnings(hashrate, efficiency, vip_bonus):
    """Calculate daily BLZ earnings."""
    base = hashrate * DAILY_BASE_RATE * efficiency
    return round(base * (1 + vip_bonus), 8)


async def get_or_create_wallet(user_id):
    """Get or create mining wallet."""
    wallet = await db.mining_wallets.find_one({"user_id": user_id}, {"_id": 0})
    if not wallet:
        wallet = {
            "user_id": user_id,
            "blz_balance": 0.0,
            "total_mined": 0.0,
            "total_withdrawn": 0.0,
            "total_deposited": 0.0,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.mining_wallets.insert_one(wallet)
        wallet.pop("_id", None)
    return wallet


# ── Auto-Reward Processing ──
import logging
auto_reward_logger = logging.getLogger("bidblitz.auto_reward")


async def process_auto_rewards():
    """Process automatic daily rewards for all users with active miners.
    Runs as a background task. Prevents duplicates via mining_claims date check."""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # Find distinct user_ids that have active miners
    pipeline = [
        {"$match": {"status": "active"}},
        {"$group": {"_id": "$user_id"}},
    ]
    user_groups = await db.mining_miners.aggregate(pipeline).to_list(10000)

    rewarded = 0
    for ug in user_groups:
        user_id = ug["_id"]
        try:
            # Check if already rewarded today
            existing = await db.mining_claims.find_one({"user_id": user_id, "date": today})
            if existing:
                continue

            # Get active miners
            miners = await db.mining_miners.find(
                {"user_id": user_id, "status": "active"}
            ).to_list(50)
            if not miners:
                continue

            total_hashrate = sum(
                m.get("hashrate", 0) * (1 + m.get("power_level", 0) * 0.1) for m in miners
            )
            avg_eff = (
                sum(m.get("efficiency", 0.85) + m.get("efficiency_level", 0) * 0.01 for m in miners)
                / len(miners)
            )
            vip = get_vip_level(total_hashrate)
            earnings = calc_daily_earnings(total_hashrate, avg_eff, vip["bonus"])

            if earnings <= 0:
                continue

            now = datetime.now(timezone.utc).isoformat()

            # Credit wallet
            await db.mining_wallets.update_one(
                {"user_id": user_id},
                {"$inc": {"blz_balance": earnings, "total_mined": earnings}},
                upsert=True,
            )

            # Record claim (auto)
            await db.mining_claims.insert_one({
                "user_id": user_id,
                "date": today,
                "amount": earnings,
                "claimed_at": now,
                "type": "auto",
            })

            # Transaction log
            await db.mining_transactions.insert_one({
                "txn_id": secrets.token_hex(6),
                "user_id": user_id,
                "type": "mining_reward",
                "amount_blz": earnings,
                "description": f"Auto reward ({total_hashrate:.0f} TH/s)",
                "created_at": now,
            })

            # Referral bonus
            ref_entry = await db.mining_referrals.find_one({"referred_id": user_id})
            if ref_entry:
                ref_bonus = round(earnings * REFERRAL_BONUS_RATE, 8)
                if ref_bonus > 0:
                    await db.mining_wallets.update_one(
                        {"user_id": ref_entry["referrer_id"]},
                        {"$inc": {"blz_balance": ref_bonus, "total_mined": ref_bonus}},
                        upsert=True,
                    )
                    await db.mining_transactions.insert_one({
                        "txn_id": secrets.token_hex(6),
                        "user_id": ref_entry["referrer_id"],
                        "type": "referral_bonus",
                        "amount_blz": ref_bonus,
                        "description": "Auto referral mining bonus",
                        "created_at": now,
                    })

            rewarded += 1
        except Exception as e:
            auto_reward_logger.error(f"Auto-reward failed for {user_id}: {e}")

    if rewarded > 0:
        auto_reward_logger.info(f"Auto-rewards: {rewarded} users rewarded for {today}")
    return rewarded


# ── Dashboard ──
@router.get("/dashboard")
async def mining_dashboard(request: Request):
    """Get mining dashboard with stats."""
    user = await get_current_user(request)
    user_id = str(user["_id"])

    wallet = await get_or_create_wallet(user_id)
    miners = await db.mining_miners.find(
        {"user_id": user_id, "status": "active"}, {"_id": 0}
    ).to_list(50)

    total_hashrate = sum(m.get("hashrate", 0) * (1 + m.get("power_level", 0) * 0.1) for m in miners)
    avg_efficiency = (
        sum(m.get("efficiency", 0.85) + m.get("efficiency_level", 0) * 0.01 for m in miners) / len(miners)
        if miners else 0
    )
    vip = get_vip_level(total_hashrate)
    daily_earnings = calc_daily_earnings(total_hashrate, avg_efficiency, vip["bonus"])

    # Calculate per-miner earnings for dashboard detail
    miners_enriched = []
    for mn in miners:
        eff_hash = mn.get("hashrate", 0) * (1 + mn.get("power_level", 0) * 0.1)
        eff_eff = mn.get("efficiency", 0.85) + mn.get("efficiency_level", 0) * 0.01
        mn_daily = calc_daily_earnings(eff_hash, eff_eff, vip["bonus"])
        mn_monthly = round(mn_daily * 30, 4)
        mn_yearly = round(mn_daily * 365, 4)
        miners_enriched.append({
            **mn,
            "effective_hashrate": round(eff_hash, 1),
            "effective_efficiency": round(eff_eff, 4),
            "daily_blz": mn_daily,
            "daily_eur": round(mn_daily * BLZ_TO_EUR, 4),
            "monthly_blz": mn_monthly,
            "monthly_eur": round(mn_monthly * BLZ_TO_EUR, 2),
            "yearly_blz": mn_yearly,
            "yearly_eur": round(mn_yearly * BLZ_TO_EUR, 2),
        })

    # Check if daily reward claimed (auto or manual)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    claimed_today = await db.mining_claims.find_one({"user_id": user_id, "date": today})

    # Calculate next reward time (midnight UTC)
    now_utc = datetime.now(timezone.utc)
    tomorrow_midnight = (now_utc.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1))
    next_reward_at = tomorrow_midnight.isoformat() if claimed_today else None
    last_reward_at = claimed_today.get("claimed_at") if claimed_today else None

    # Referral stats
    ref_count = await db.mining_referrals.count_documents({"referrer_id": user_id})
    ref_code = user.get("mining_ref_code")
    if not ref_code:
        ref_code = f"BLZ-{secrets.token_hex(3).upper()}"
        await db.users.update_one({"_id": user["_id"]}, {"$set": {"mining_ref_code": ref_code}})

    # Referral boost: does this user HAVE a referrer?
    my_referrer = await db.mining_referrals.find_one({"referred_id": user_id})
    referral_boost_active = bool(my_referrer)
    referral_earnings_bonus = 0
    if my_referrer:
        referral_earnings_bonus = round(daily_earnings * REFERRAL_BONUS_RATE, 8)

    # Claim streak
    claim_history = await db.mining_claims.find(
        {"user_id": user_id}, {"_id": 0}
    ).sort("date", -1).to_list(30)
    streak = 0
    today_d = datetime.now(timezone.utc).date()
    for i in range(365):
        d = (today_d - timedelta(days=i)).strftime("%Y-%m-%d")
        if any(c["date"] == d for c in claim_history):
            streak += 1
        else:
            break

    # Recent transactions
    recent_txns = await db.mining_transactions.find(
        {"user_id": user_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(10)

    # Next VIP
    next_vip = None
    for vl in VIP_LEVELS:
        if vl["min_hashrate"] > total_hashrate:
            next_vip = vl
            break

    return {
        "wallet": {
            "blz_balance": wallet["blz_balance"],
            "eur_value": round(wallet["blz_balance"] * BLZ_TO_EUR, 2),
            "total_mined": wallet["total_mined"],
            "total_withdrawn": wallet["total_withdrawn"],
            "main_balance_eur": user.get("balance", 0),
        },
        "mining": {
            "total_hashrate": round(total_hashrate, 1),
            "avg_efficiency": round(avg_efficiency, 4),
            "daily_earnings_blz": daily_earnings,
            "daily_earnings_eur": round(daily_earnings * BLZ_TO_EUR, 4),
            "monthly_earnings_blz": round(daily_earnings * 30, 4),
            "monthly_earnings_eur": round(daily_earnings * 30 * BLZ_TO_EUR, 2),
            "yearly_earnings_blz": round(daily_earnings * 365, 4),
            "yearly_earnings_eur": round(daily_earnings * 365 * BLZ_TO_EUR, 2),
            "active_miners": len(miners),
        },
        "vip": {
            **vip,
            "next_level": next_vip,
            "progress": round(
                (total_hashrate - vip["min_hashrate"]) /
                (next_vip["min_hashrate"] - vip["min_hashrate"]) * 100, 1
            ) if next_vip else 100,
        },
        "daily_reward": {
            "claimed": bool(claimed_today),
            "amount": daily_earnings,
            "auto": True,
            "type": claimed_today.get("type", "manual") if claimed_today else None,
            "last_reward_at": last_reward_at,
            "next_reward_at": next_reward_at,
        },
        "referral": {
            "code": ref_code,
            "count": ref_count,
            "bonus_rate": REFERRAL_BONUS_RATE,
            "boost_active": referral_boost_active,
            "boost_bonus_blz": referral_earnings_bonus,
        },
        "streak": streak,
        "miners": miners_enriched,
        "recent_transactions": recent_txns,
    }


# ── Packages ──
@router.get("/packages")
async def get_packages(request: Request):
    """Get available miner packages with pricing tiers."""
    enriched = []
    for pkg in MINER_PACKAGES:
        daily_blz = pkg["hashrate"] * DAILY_BASE_RATE * pkg["base_efficiency"]
        daily_eur = daily_blz * BLZ_TO_EUR
        monthly_eur = daily_eur * 30
        yearly_eur = daily_eur * 365
        roi_days = round(pkg["price_eur"] / daily_eur) if daily_eur > 0 else 0
        roi_pct = round((yearly_eur / pkg["price_eur"]) * 100, 2) if pkg["price_eur"] > 0 else 0
        # Original prices (before discount) for monthly/yearly
        orig_monthly = round(pkg["price_monthly"] / (1 - DISCOUNT_RATES["monthly"]), 2)
        orig_yearly = round(pkg["price_yearly"] / (1 - DISCOUNT_RATES["yearly"]), 2)
        enriched.append({
            **pkg,
            "daily_blz": round(daily_blz, 4),
            "daily_eur": round(daily_eur, 4),
            "monthly_eur": round(monthly_eur, 2),
            "yearly_eur": round(yearly_eur, 2),
            "roi_days": roi_days,
            "roi_pct": roi_pct,
            "pricing": {
                "onetime": {"price": pkg["price_eur"], "original": pkg["price_eur"], "discount": 0},
                "monthly": {"price": pkg["price_monthly"], "original": orig_monthly, "discount": DISCOUNT_RATES["monthly"]},
                "yearly": {"price": pkg["price_yearly"], "original": orig_yearly, "discount": DISCOUNT_RATES["yearly"]},
            },
        })
    return {"packages": enriched, "blz_rate": BLZ_TO_EUR, "discounts": DISCOUNT_RATES}


# ── Buy Miner ──
class BuyMinerRequest(BaseModel):
    package_id: str
    billing: str = "onetime"  # "onetime", "monthly", "yearly"


@router.post("/buy-miner")
async def buy_miner(req: BuyMinerRequest, request: Request):
    """Buy a miner package using wallet balance."""
    user = await get_current_user(request)
    user_id = str(user["_id"])

    pkg = next((p for p in MINER_PACKAGES if p["id"] == req.package_id), None)
    if not pkg:
        raise HTTPException(status_code=400, detail="Invalid package")

    billing = req.billing if req.billing in ("onetime", "monthly", "yearly") else "onetime"

    # Get the price based on billing type
    if billing == "monthly":
        price = pkg["price_monthly"]
    elif billing == "yearly":
        price = pkg["price_yearly"]
    else:
        price = pkg["price_eur"]

    # WALLET-ONLY: Check balance (BidBlitz closed ecosystem)
    balance = user.get("balance", 0)
    if balance < price:
        raise HTTPException(
            status_code=400, 
            detail=f"Nicht genug Guthaben. Benötigt: €{price:.2f}, Verfügbar: €{balance:.2f}. Bitte lade dein Wallet auf."
        )

    # Deduct balance
    await db.users.update_one({"_id": user["_id"]}, {"$inc": {"balance": -price}})

    # Create miner
    miner_id = secrets.token_hex(6)
    now = datetime.now(timezone.utc).isoformat()

    # Calculate billing dates
    billing_info = {"type": billing, "price": price}
    if billing == "monthly":
        billing_info["next_payment"] = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
        billing_info["started_at"] = now
    elif billing == "yearly":
        billing_info["next_payment"] = (datetime.now(timezone.utc) + timedelta(days=365)).isoformat()
        billing_info["started_at"] = now

    miner = {
        "miner_id": miner_id,
        "user_id": user_id,
        "package_id": pkg["id"],
        "name": pkg["name"],
        "hashrate": pkg["hashrate"],
        "efficiency": pkg["base_efficiency"],
        "power_level": 0,
        "efficiency_level": 0,
        "status": "active",
        "purchased_at": now,
        "icon": pkg["icon"],
        "billing": billing_info,
    }
    await db.mining_miners.insert_one(miner)
    miner.pop("_id", None)

    # Record transaction
    billing_label = {"onetime": "", "monthly": " (Monatlich)", "yearly": " (Jährlich)"}
    txn = {
        "txn_id": secrets.token_hex(6),
        "user_id": user_id,
        "type": "purchase",
        "amount_eur": -price,
        "description": f"Purchased {pkg['name']}{billing_label.get(billing, '')}",
        "created_at": now,
    }
    await db.mining_transactions.insert_one(txn)
    txn.pop("_id", None)

    # Also record in main transactions
    await db.transactions.insert_one({
        "id": secrets.token_hex(8),
        "user_id": user_id,
        "type": "purchase",
        "amount": -price,
        "description": f"Mining: {pkg['name']}{billing_label.get(billing, '')}",
        "status": "completed",
        "reference": f"MINE-{miner_id.upper()[:8]}",
        "category": "mining",
        "created_at": now,
    })

    updated_user = await db.users.find_one({"_id": user["_id"]})

    return {
        "miner": miner,
        "new_balance": updated_user.get("balance", 0),
    }


# ── Upgrade Miner ──
class UpgradeRequest(BaseModel):
    miner_id: str
    upgrade_type: str  # "power" or "efficiency"


@router.post("/upgrade")
async def upgrade_miner(req: UpgradeRequest, request: Request):
    """Upgrade a miner's power or efficiency."""
    user = await get_current_user(request)
    user_id = str(user["_id"])

    if req.upgrade_type not in ("power", "efficiency"):
        raise HTTPException(status_code=400, detail="Invalid upgrade type")

    miner = await db.mining_miners.find_one({"miner_id": req.miner_id, "user_id": user_id})
    if not miner:
        raise HTTPException(status_code=404, detail="Miner not found")

    level_key = f"{req.upgrade_type}_level"
    current_level = miner.get(level_key, 0)

    costs = UPGRADE_COSTS[req.upgrade_type]
    if current_level >= len(costs) - 1:
        raise HTTPException(status_code=400, detail="Max level reached")

    cost = costs[current_level + 1]
    # WALLET-ONLY: Check balance (BidBlitz closed ecosystem)
    balance = user.get("balance", 0)
    if balance < cost:
        raise HTTPException(
            status_code=400, 
            detail=f"Nicht genug Guthaben. Benötigt: €{cost:.2f}, Verfügbar: €{balance:.2f}. Bitte lade dein Wallet auf."
        )

    await db.users.update_one({"_id": user["_id"]}, {"$inc": {"balance": -cost}})
    await db.mining_miners.update_one(
        {"miner_id": req.miner_id},
        {"$inc": {level_key: 1}},
    )

    now = datetime.now(timezone.utc).isoformat()
    await db.mining_transactions.insert_one({
        "txn_id": secrets.token_hex(6),
        "user_id": user_id,
        "type": "upgrade",
        "amount_eur": -cost,
        "description": f"Upgraded {miner['name']} {req.upgrade_type} to Lv.{current_level + 1}",
        "created_at": now,
    })

    updated_user = await db.users.find_one({"_id": user["_id"]})
    return {
        "ok": True,
        "new_level": current_level + 1,
        "cost": cost,
        "new_balance": updated_user.get("balance", 0),
    }


@router.get("/upgrade-costs")
async def get_upgrade_costs(request: Request):
    """Get upgrade cost tables."""
    return {"costs": UPGRADE_COSTS, "max_level": len(UPGRADE_COSTS["power"]) - 1}


# ── Claim Daily Reward ──
@router.post("/claim-daily")
async def claim_daily(request: Request):
    """Claim daily mining earnings."""
    user = await get_current_user(request)
    user_id = str(user["_id"])

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    existing = await db.mining_claims.find_one({"user_id": user_id, "date": today})
    if existing:
        raise HTTPException(status_code=400, detail="Already claimed today")

    miners = await db.mining_miners.find(
        {"user_id": user_id, "status": "active"}
    ).to_list(50)

    if not miners:
        raise HTTPException(status_code=400, detail="No active miners")

    total_hashrate = sum(m.get("hashrate", 0) * (1 + m.get("power_level", 0) * 0.1) for m in miners)
    avg_eff = sum(m.get("efficiency", 0.85) + m.get("efficiency_level", 0) * 0.01 for m in miners) / len(miners)
    vip = get_vip_level(total_hashrate)
    earnings = calc_daily_earnings(total_hashrate, avg_eff, vip["bonus"])

    if earnings <= 0:
        raise HTTPException(status_code=400, detail="No earnings to claim")

    now = datetime.now(timezone.utc).isoformat()

    # Credit wallet
    await db.mining_wallets.update_one(
        {"user_id": user_id},
        {"$inc": {"blz_balance": earnings, "total_mined": earnings}},
        upsert=True,
    )

    # Record claim
    await db.mining_claims.insert_one({
        "user_id": user_id,
        "date": today,
        "amount": earnings,
        "claimed_at": now,
    })

    # Transaction
    await db.mining_transactions.insert_one({
        "txn_id": secrets.token_hex(6),
        "user_id": user_id,
        "type": "mining_reward",
        "amount_blz": earnings,
        "description": f"Daily mining reward ({total_hashrate:.0f} TH/s)",
        "created_at": now,
    })

    # Referral bonus
    ref_entry = await db.mining_referrals.find_one({"referred_id": user_id})
    if ref_entry:
        ref_bonus = round(earnings * REFERRAL_BONUS_RATE, 8)
        if ref_bonus > 0:
            await db.mining_wallets.update_one(
                {"user_id": ref_entry["referrer_id"]},
                {"$inc": {"blz_balance": ref_bonus, "total_mined": ref_bonus}},
                upsert=True,
            )
            await db.mining_transactions.insert_one({
                "txn_id": secrets.token_hex(6),
                "user_id": ref_entry["referrer_id"],
                "type": "referral_bonus",
                "amount_blz": ref_bonus,
                "description": "Referral mining bonus",
                "created_at": now,
            })

    wallet = await get_or_create_wallet(user_id)
    return {
        "claimed": earnings,
        "claimed_eur": round(earnings * BLZ_TO_EUR, 4),
        "new_balance": wallet["blz_balance"],
    }


# ── Withdraw BLZ to EUR wallet ──
class WithdrawRequest(BaseModel):
    amount: float = Field(..., gt=0)


@router.post("/withdraw")
async def withdraw_blz(req: WithdrawRequest, request: Request):
    """Convert BLZ to EUR and add to main wallet."""
    user = await get_current_user(request)
    user_id = str(user["_id"])

    wallet = await get_or_create_wallet(user_id)
    if wallet["blz_balance"] < req.amount:
        raise HTTPException(status_code=400, detail="Insufficient BLZ balance")

    eur_amount = round(req.amount * BLZ_TO_EUR, 2)

    await db.mining_wallets.update_one(
        {"user_id": user_id},
        {"$inc": {"blz_balance": -req.amount, "total_withdrawn": req.amount}},
    )
    await db.users.update_one({"_id": user["_id"]}, {"$inc": {"balance": eur_amount}})

    now = datetime.now(timezone.utc).isoformat()
    await db.mining_transactions.insert_one({
        "txn_id": secrets.token_hex(6),
        "user_id": user_id,
        "type": "withdraw",
        "amount_blz": -req.amount,
        "amount_eur": eur_amount,
        "description": f"Converted {req.amount:.4f} BLZ → €{eur_amount:.2f}",
        "created_at": now,
    })

    updated = await db.users.find_one({"_id": user["_id"]})
    updated_wallet = await get_or_create_wallet(user_id)
    return {
        "withdrawn_blz": req.amount,
        "received_eur": eur_amount,
        "new_blz_balance": updated_wallet["blz_balance"],
        "new_eur_balance": updated.get("balance", 0),
    }


# ── Send BLZ ──
class SendBLZRequest(BaseModel):
    recipient_email: str
    amount: float = Field(..., gt=0)


@router.post("/send")
async def send_blz(req: SendBLZRequest, request: Request):
    """Send BLZ to another user."""
    user = await get_current_user(request)
    user_id = str(user["_id"])

    if req.recipient_email.lower() == user.get("email", "").lower():
        raise HTTPException(status_code=400, detail="Cannot send to yourself")

    recipient = await db.users.find_one({"email": req.recipient_email.lower()})
    if not recipient:
        raise HTTPException(status_code=404, detail="Recipient not found")

    wallet = await get_or_create_wallet(user_id)
    if wallet["blz_balance"] < req.amount:
        raise HTTPException(status_code=400, detail="Insufficient BLZ balance")

    recipient_id = str(recipient["_id"])
    now = datetime.now(timezone.utc).isoformat()

    # Debit sender
    await db.mining_wallets.update_one(
        {"user_id": user_id},
        {"$inc": {"blz_balance": -req.amount}},
    )
    # Credit recipient
    await db.mining_wallets.update_one(
        {"user_id": recipient_id},
        {"$inc": {"blz_balance": req.amount}},
        upsert=True,
    )

    ref = secrets.token_hex(4).upper()
    for uid, amt, desc in [
        (user_id, -req.amount, f"Sent {req.amount:.4f} BLZ to {req.recipient_email}"),
        (recipient_id, req.amount, f"Received {req.amount:.4f} BLZ from {user.get('email', '')}"),
    ]:
        await db.mining_transactions.insert_one({
            "txn_id": secrets.token_hex(6),
            "user_id": uid,
            "type": "send" if amt < 0 else "receive",
            "amount_blz": amt,
            "description": desc,
            "reference": ref,
            "created_at": now,
        })

    updated_wallet = await get_or_create_wallet(user_id)
    return {
        "sent": req.amount,
        "to": req.recipient_email,
        "new_balance": updated_wallet["blz_balance"],
    }


# ── Apply Referral ──
class MiningReferralRequest(BaseModel):
    code: str


@router.post("/apply-referral")
async def apply_mining_referral(req: MiningReferralRequest, request: Request):
    """Apply a mining referral code."""
    user = await get_current_user(request)
    user_id = str(user["_id"])

    existing = await db.mining_referrals.find_one({"referred_id": user_id})
    if existing:
        raise HTTPException(status_code=400, detail="Already used a referral code")

    code = req.code.strip().upper()
    referrer = await db.users.find_one({"mining_ref_code": code})
    if not referrer:
        raise HTTPException(status_code=404, detail="Invalid referral code")
    if str(referrer["_id"]) == user_id:
        raise HTTPException(status_code=400, detail="Cannot use your own code")

    await db.mining_referrals.insert_one({
        "referrer_id": str(referrer["_id"]),
        "referred_id": user_id,
        "bonus_rate": REFERRAL_BONUS_RATE,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    # Bonus: give both users some BLZ
    bonus = 0.5
    for uid in [user_id, str(referrer["_id"])]:
        await db.mining_wallets.update_one(
            {"user_id": uid},
            {"$inc": {"blz_balance": bonus}},
            upsert=True,
        )
        await db.mining_transactions.insert_one({
            "txn_id": secrets.token_hex(6),
            "user_id": uid,
            "type": "referral_bonus",
            "amount_blz": bonus,
            "description": "Mining referral welcome bonus",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

    return {"ok": True, "bonus_blz": bonus}


# ── VIP Info ──
@router.get("/vip-levels")
async def get_vip_levels(request: Request):
    """Get VIP level info."""
    return {"levels": VIP_LEVELS}


# ── Claim History ──
@router.get("/claim-history")
async def get_claim_history(request: Request):
    """Get full claim history for the user."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    claims = await db.mining_claims.find(
        {"user_id": user_id}, {"_id": 0}
    ).sort("claimed_at", -1).to_list(100)

    streak = 0
    today = datetime.now(timezone.utc).date()
    for i in range(365):
        d = (today - timedelta(days=i)).strftime("%Y-%m-%d")
        found = any(c["date"] == d for c in claims)
        if found:
            streak += 1
        else:
            break

    total_claimed = sum(c.get("amount", 0) for c in claims)
    return {
        "claims": claims,
        "total_claims": len(claims),
        "total_claimed_blz": round(total_claimed, 8),
        "total_claimed_eur": round(total_claimed * BLZ_TO_EUR, 4),
        "current_streak": streak,
    }


# ── Reward Log (admin) ──
@router.get("/admin/reward-logs")
async def admin_reward_logs(request: Request):
    """Admin: view all reward logs."""
    user = await get_current_user(request)
    if user.get("role") not in ("admin",):
        raise HTTPException(status_code=403, detail="Admin only")

    recent_claims = await db.mining_claims.find(
        {}, {"_id": 0}
    ).sort("claimed_at", -1).to_list(100)

    return {"reward_logs": recent_claims}


# ── Transaction History ──
@router.get("/transactions")
async def get_mining_transactions(request: Request):
    """Get mining transaction history."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    txns = await db.mining_transactions.find(
        {"user_id": user_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    return {"transactions": txns}
