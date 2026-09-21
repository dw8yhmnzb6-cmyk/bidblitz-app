"""
BidBlitz V2 — Crypto Mining Module
Virtual mining system with miners, upgrades, VIP levels, referrals.
"""

import secrets
import random
import hashlib
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional
from bson import ObjectId
from core.database import db
from core.config import TEST_MODE
from core.security import get_current_user

router = APIRouter(prefix="/api/mining", tags=["mining"])

# ── Constants ──
BLZ_TO_EUR = 0.10  # 1 BLZ token = €0.10
DAILY_BASE_RATE = 0.5  # BLZ per TH/s per day
REFERRAL_BONUS_RATE = 0.05  # 5% of referral's mining earnings


def _safe_mining_float(value, default: float = 0.0) -> float:
    try:
        return float(value if value is not None else default)
    except (TypeError, ValueError):
        return float(default)


def _normalize_mining_wallet(wallet: dict | None, user_id: str) -> dict:
    row = dict(wallet or {})
    row["user_id"] = str(row.get("user_id") or user_id)
    row["blz_balance"] = _safe_mining_float(row.get("blz_balance"))
    row["total_mined"] = _safe_mining_float(row.get("total_mined"))
    row["total_withdrawn"] = _safe_mining_float(row.get("total_withdrawn"))
    row["total_deposited"] = _safe_mining_float(row.get("total_deposited"))
    return row


def _require_mining_value_mode() -> None:
    if not TEST_MODE:
        raise HTTPException(
            status_code=503,
            detail=(
                "Mining-Wertfunktionen sind noch nicht mit einem verifizierten Mining-/Settlement-Provider verbunden. "
                "Es werden in Production keine EUR belastet und keine konvertierbaren BLZ erzeugt."
            ),
        )


def _mining_capabilities() -> dict:
    return {
        "live_mining_provider_connected": False,
        "value_actions_enabled": bool(TEST_MODE),
        "conversion_enabled": bool(TEST_MODE),
        "marketplace_enabled": bool(TEST_MODE),
        "launchpad_enabled": bool(TEST_MODE),
        "production_message": (
            None if TEST_MODE else
            "Mining läuft als Preview. Kauf, Ertrag, Transfer und BLZ→EUR bleiben bis zur Live-Provider-Anbindung deaktiviert."
        ),
    }

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

PUBLIC_MINING_PROOF_METRICS = {
    "hashrate_cluster_phs": 46.2,
    "uptime_percent": 99.4,
    "cooling_status": "stable",
    "monitoring": "24/7",
    "locations": [
        {"city": "Dubai", "country": "UAE", "status": "active", "server_halls": 2},
        {"city": "Abu Dhabi", "country": "UAE", "status": "active", "server_halls": 1},
    ],
    "last_maintenance_window": "2026-07-08T01:30:00+00:00",
    "next_maintenance_window": "2026-07-15T01:30:00+00:00",
}


class MiningTrustLeadRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    email: str = Field(..., min_length=5, max_length=180)
    topic: Optional[str] = Field(default="", max_length=80)
    company: Optional[str] = Field(default="", max_length=160)
    message: Optional[str] = Field(default="", max_length=1000)


class MiningTrustVideoUpdateRequest(BaseModel):
    city: str = Field(..., min_length=2, max_length=80)
    title: str = Field(..., min_length=2, max_length=140)
    description: Optional[str] = Field(default="", max_length=400)
    video_url: str = Field(..., min_length=8, max_length=500)
    thumbnail_url: Optional[str] = Field(default="", max_length=500)


class MiningTrustLeadStatusRequest(BaseModel):
    status: str = Field(..., min_length=2, max_length=40)


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


@router.get("/trust/public")
async def mining_trust_public():
    total_miners = await db.mining_miners.count_documents({"status": "active"})
    total_users = await db.mining_wallets.count_documents({})
    total_hashrate = 0.0
    try:
        pipeline = [
            {"$match": {"status": "active"}},
            {"$group": {"_id": None, "hashrate": {"$sum": "$hashrate"}}},
        ]
        rows = await db.mining_miners.aggregate(pipeline).to_list(1)
        if rows:
            total_hashrate = float(rows[0].get("hashrate") or 0)
    except Exception:
        total_hashrate = 0.0

    videos = await db.mining_trust_videos.find({}, {"_id": 0}).sort("city", 1).to_list(20)
    return {
        "proof_metrics": PUBLIC_MINING_PROOF_METRICS if TEST_MODE else {},
        "proof_verified_live": False,
        "capabilities": _mining_capabilities(),
        "network": {
            "active_miners": total_miners,
            "wallets": total_users,
            "registered_hashrate_ths": round(total_hashrate, 1),
            "registered_hashrate_phs": round(total_hashrate / 1000, 2) if total_hashrate else 0,
        },
        "videos": videos,
    }


@router.post("/trust/lead")
async def mining_trust_lead(payload: MiningTrustLeadRequest):
    now = datetime.now(timezone.utc).isoformat()
    lead = {
        "lead_id": f"mlead_{secrets.token_hex(6)}",
        "name": payload.name.strip(),
        "email": payload.email.strip().lower(),
        "topic": (payload.topic or "").strip(),
        "company": (payload.company or "").strip(),
        "message": (payload.message or "").strip(),
        "source": "mining_trust_page",
        "created_at": now,
        "status": "new",
    }
    await db.mining_trust_leads.insert_one(lead)
    lead.pop("_id", None)
    return {"ok": True, "lead": lead}


@router.get("/trust/leads")
async def mining_trust_leads(request: Request):
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    leads = await db.mining_trust_leads.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return {"leads": leads}


@router.post("/trust/leads/{lead_id}/status")
async def mining_trust_lead_status(lead_id: str, payload: MiningTrustLeadStatusRequest, request: Request):
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    await db.mining_trust_leads.update_one({"lead_id": lead_id}, {"$set": {"status": payload.status, "updated_at": datetime.now(timezone.utc).isoformat()}})
    lead = await db.mining_trust_leads.find_one({"lead_id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    return {"ok": True, "lead": lead}


@router.get("/trust/videos")
async def mining_trust_videos_admin(request: Request):
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    videos = await db.mining_trust_videos.find({}, {"_id": 0}).sort("city", 1).to_list(20)
    return {"videos": videos}


@router.post("/trust/videos")
async def mining_trust_video_upsert(payload: MiningTrustVideoUpdateRequest, request: Request):
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "city": payload.city.strip(),
        "title": payload.title.strip(),
        "description": (payload.description or "").strip(),
        "video_url": payload.video_url.strip(),
        "thumbnail_url": (payload.thumbnail_url or "").strip(),
        "updated_at": now,
    }
    await db.mining_trust_videos.update_one({"city": payload.city.strip()}, {"$set": doc, "$setOnInsert": {"created_at": now}}, upsert=True)
    saved = await db.mining_trust_videos.find_one({"city": payload.city.strip()}, {"_id": 0})
    return {"ok": True, "video": saved}


async def get_or_create_wallet(user_id):
    """Get or create a mining wallet and normalize legacy/incomplete rows in memory."""
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
        await db.mining_wallets.insert_one(dict(wallet))
    return _normalize_mining_wallet(wallet, str(user_id))


# ── Auto-Reward Processing ──
import logging
auto_reward_logger = logging.getLogger("bidblitz.auto_reward")


async def process_auto_rewards():
    """Process automatic daily rewards only in test mode until a live provider exists."""
    if not TEST_MODE:
        return 0
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


# ── Status alias (same as /dashboard) ──
@router.get("/capabilities")
async def mining_capabilities():
    return _mining_capabilities()


@router.get("/status")
async def mining_status(request: Request):
    """Alias for /dashboard endpoint (used by frontend)."""
    return await mining_dashboard(request)

@router.get("/dashboard")
async def mining_dashboard(request: Request):
    """Get mining dashboard with stats."""
    user = await get_current_user(request)
    user_id = str(user["_id"])

    wallet = await get_or_create_wallet(user_id)
    miners = await db.mining_miners.find(
        {"user_id": user_id, "status": "active"}, {"_id": 0}
    ).to_list(50)

    total_hashrate = sum(
        _safe_mining_float(m.get("hashrate")) * (1 + _safe_mining_float(m.get("power_level")) * 0.1)
        for m in miners
    )
    avg_efficiency = (
        sum(
            _safe_mining_float(m.get("efficiency"), 0.85)
            + _safe_mining_float(m.get("efficiency_level")) * 0.01
            for m in miners
        ) / len(miners)
        if miners else 0
    )
    vip = get_vip_level(total_hashrate)
    daily_earnings = calc_daily_earnings(total_hashrate, avg_efficiency, vip["bonus"])

    # Calculate per-miner earnings for dashboard detail
    miners_enriched = []
    for mn in miners:
        eff_hash = _safe_mining_float(mn.get("hashrate")) * (
            1 + _safe_mining_float(mn.get("power_level")) * 0.1
        )
        eff_eff = (
            _safe_mining_float(mn.get("efficiency"), 0.85)
            + _safe_mining_float(mn.get("efficiency_level")) * 0.01
        )
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
        if any(str(claim.get("date") or "") == d for claim in claim_history):
            streak += 1
        else:
            break

    # Recent transactions
    recent_txns = await db.mining_transactions.find(
        {"user_id": user_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(10)
    for tx in recent_txns:
        tx["amount_blz"] = _safe_mining_float(tx.get("amount_blz"))
        tx["amount_eur"] = _safe_mining_float(tx.get("amount_eur"))

    # Next VIP
    next_vip = None
    for vl in VIP_LEVELS:
        if vl["min_hashrate"] > total_hashrate:
            next_vip = vl
            break

    return {
        "capabilities": _mining_capabilities(),
        "wallet": {
            "blz_balance": _safe_mining_float(wallet.get("blz_balance")) if TEST_MODE else 0.0,
            "eur_value": round(_safe_mining_float(wallet.get("blz_balance")) * BLZ_TO_EUR, 2) if TEST_MODE else 0.0,
            "total_mined": _safe_mining_float(wallet.get("total_mined")),
            "total_withdrawn": _safe_mining_float(wallet.get("total_withdrawn")),
            "main_balance_eur": _safe_mining_float(user.get("balance")),
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
    return {
        "packages": [{**pkg, "purchase_available": bool(TEST_MODE)} for pkg in enriched],
        "blz_rate": BLZ_TO_EUR if TEST_MODE else None,
        "discounts": DISCOUNT_RATES,
        "capabilities": _mining_capabilities(),
    }


# ── Buy Miner ──
class BuyMinerRequest(BaseModel):
    package_id: str
    billing: str = "onetime"  # "onetime", "monthly", "yearly"
    idempotency_key: Optional[str] = None


@router.post("/buy-miner")
async def buy_miner(req: BuyMinerRequest, request: Request):
    """Buy a miner package through the canonical wallet with retry-safe fulfillment."""
    _require_mining_value_mode()
    from core.payment_engine import debit_wallet, TransactionType

    user = await get_current_user(request)
    user_id = str(user["_id"])
    raw_key = (req.idempotency_key or request.headers.get("Idempotency-Key") or "").strip()
    if not 8 <= len(raw_key) <= 200:
        raise HTTPException(status_code=400, detail="Idempotency-Key erforderlich")

    pkg = next((p for p in MINER_PACKAGES if p["id"] == req.package_id), None)
    if not pkg:
        raise HTTPException(status_code=400, detail="Invalid package")

    billing = req.billing if req.billing in ("onetime", "monthly", "yearly") else "onetime"
    if billing == "monthly":
        price = pkg["price_monthly"]
    elif billing == "yearly":
        price = pkg["price_yearly"]
    else:
        price = pkg["price_eur"]

    purchase_hash = hashlib.sha256(
        f"{user_id}:{req.package_id}:{billing}:{raw_key}".encode("utf-8")
    ).hexdigest()[:20]
    purchase_id = f"MINBUY-{purchase_hash.upper()}"
    miner_id = f"miner_{purchase_hash}"
    payment_idempotency_key = f"mining-buy:{raw_key}"
    billing_label = {"onetime": "", "monthly": " (Monatlich)", "yearly": " (Jährlich)"}

    result = await debit_wallet(
        user_id=user_id,
        amount=price,
        tx_type=TransactionType.MINING_PURCHASE,
        description=f"Mining: {pkg['name']}{billing_label.get(billing, '')}",
        reference=f"MIN-BUY-{purchase_hash[:12].upper()}",
        metadata={
            "package_id": req.package_id,
            "billing": billing,
            "purchase_id": purchase_id,
            "miner_id": miner_id,
        },
        idempotency_key=payment_idempotency_key,
    )
    if not result.success:
        raise HTTPException(status_code=400, detail=result.error)

    now = datetime.now(timezone.utc).isoformat()
    billing_info = {"type": billing, "price": price}
    if billing == "monthly":
        billing_info["next_payment"] = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
        billing_info["started_at"] = now
    elif billing == "yearly":
        billing_info["next_payment"] = (datetime.now(timezone.utc) + timedelta(days=365)).isoformat()
        billing_info["started_at"] = now

    miner = {
        "miner_id": miner_id,
        "purchase_id": purchase_id,
        "purchase_idempotency_key": payment_idempotency_key,
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
    await db.mining_miners.update_one(
        {"miner_id": miner_id},
        {"$setOnInsert": miner},
        upsert=True,
    )

    txn = {
        "txn_id": purchase_id,
        "user_id": user_id,
        "type": "purchase",
        "amount_eur": -price,
        "description": f"Purchased {pkg['name']}{billing_label.get(billing, '')}",
        "wallet_transaction_id": result.transaction_id,
        "idempotency_key": payment_idempotency_key,
        "created_at": now,
    }
    await db.mining_transactions.update_one(
        {"txn_id": purchase_id},
        {"$setOnInsert": txn},
        upsert=True,
    )

    return {
        "miner": miner,
        "new_balance": result.new_balance,
        "transaction_id": result.transaction_id,
        "purchase_id": purchase_id,
        "replayed": result.idempotent_replay,
    }


# ── Upgrade Miner ──
class UpgradeRequest(BaseModel):
    miner_id: str
    upgrade_type: str  # "power" or "efficiency"
    idempotency_key: Optional[str] = None


@router.post("/upgrade")
async def upgrade_miner(req: UpgradeRequest, request: Request):
    """Upgrade a miner exactly once; refund if a concurrent upgrade wins the level CAS."""
    _require_mining_value_mode()
    from core.payment_engine import debit_wallet, credit_wallet, TransactionType

    user = await get_current_user(request)
    user_id = str(user["_id"])
    raw_key = (req.idempotency_key or request.headers.get("Idempotency-Key") or "").strip()
    if not 8 <= len(raw_key) <= 200:
        raise HTTPException(status_code=400, detail="Idempotency-Key erforderlich")

    if req.upgrade_type not in ("power", "efficiency"):
        raise HTTPException(status_code=400, detail="Invalid upgrade type")

    miner = await db.mining_miners.find_one({"miner_id": req.miner_id, "user_id": user_id})
    if not miner:
        raise HTTPException(status_code=404, detail="Miner not found")

    level_key = f"{req.upgrade_type}_level"
    current_level = int(miner.get(level_key, 0) or 0)
    costs = UPGRADE_COSTS[req.upgrade_type]
    if current_level >= len(costs) - 1:
        raise HTTPException(status_code=400, detail="Max level reached")

    target_level = current_level + 1
    cost = costs[target_level]
    payment_idempotency_key = f"mining-upgrade:{raw_key}"
    operation_hash = hashlib.sha256(
        f"{user_id}:{req.miner_id}:{req.upgrade_type}:{raw_key}".encode("utf-8")
    ).hexdigest()[:20]
    operation_id = f"MUP-{operation_hash.upper()}"
    applied_marker = f"upgrade_applied.{operation_hash}"
    now = datetime.now(timezone.utc).isoformat()

    await db.mining_upgrade_operations.update_one(
        {"user_id": user_id, "idempotency_key": payment_idempotency_key},
        {"$setOnInsert": {
            "operation_id": operation_id,
            "user_id": user_id,
            "miner_id": req.miner_id,
            "upgrade_type": req.upgrade_type,
            "from_level": current_level,
            "to_level": target_level,
            "cost": cost,
            "idempotency_key": payment_idempotency_key,
            "status": "processing",
            "created_at": now,
        }},
        upsert=True,
    )
    operation = await db.mining_upgrade_operations.find_one(
        {"user_id": user_id, "idempotency_key": payment_idempotency_key},
        {"_id": 0},
    ) or {}
    if operation.get("miner_id") != req.miner_id or operation.get("upgrade_type") != req.upgrade_type:
        raise HTTPException(status_code=409, detail="Idempotency-Key wurde bereits für eine andere Mining-Aktion verwendet")
    if operation.get("from_level") is not None:
        current_level = int(operation.get("from_level"))
        target_level = int(operation.get("to_level"))
        cost = float(operation.get("cost"))
    if operation.get("status") == "refunded":
        raise HTTPException(status_code=409, detail="Upgrade wurde wegen eines parallelen Vorgangs zurückgebucht")
    if operation.get("status") == "reconciliation_required":
        raise HTTPException(status_code=503, detail="Upgrade benötigt finanzielle Abstimmung. Keine weitere Belastung wird ausgeführt.")
    if operation.get("status") == "failed":
        raise HTTPException(status_code=400, detail=operation.get("error") or "Upgrade-Zahlung fehlgeschlagen")

    result = await debit_wallet(
        user_id=user_id,
        amount=cost,
        tx_type=TransactionType.MINING_PURCHASE,
        description=f"Mining Upgrade: {miner['name']} {req.upgrade_type} to Lv.{target_level}",
        reference=f"MIN-UP-{operation_hash[:12].upper()}",
        metadata={
            "miner_id": req.miner_id,
            "upgrade_type": req.upgrade_type,
            "from_level": current_level,
            "new_level": target_level,
            "operation_id": operation_id,
        },
        idempotency_key=payment_idempotency_key,
    )
    if not result.success:
        await db.mining_upgrade_operations.update_one(
            {"operation_id": operation_id, "status": "processing"},
            {"$set": {"status": "failed", "error": result.error, "failed_at": datetime.now(timezone.utc).isoformat()}},
        )
        raise HTTPException(status_code=400, detail=result.error)

    applied = await db.mining_miners.update_one(
        {
            "miner_id": req.miner_id,
            "user_id": user_id,
            level_key: current_level,
            applied_marker: {"$exists": False},
        },
        {"$set": {
            level_key: target_level,
            applied_marker: {
                "operation_id": operation_id,
                "wallet_transaction_id": result.transaction_id,
                "applied_at": datetime.now(timezone.utc).isoformat(),
            },
        }},
    )
    if applied.modified_count != 1:
        fresh_miner = await db.mining_miners.find_one({"miner_id": req.miner_id, "user_id": user_id}) or {}
        marker = (fresh_miner.get("upgrade_applied") or {}).get(operation_hash)
        if not marker:
            refund = await credit_wallet(
                user_id=user_id,
                amount=cost,
                tx_type=TransactionType.REFUND,
                description=f"Mining Upgrade Rückerstattung: {miner['name']}",
                reference=f"MIN-UP-REF-{operation_hash[:10].upper()}",
                source="mining_upgrade_race_refund",
                metadata={"operation_id": operation_id, "miner_id": req.miner_id},
                idempotency_key=f"mining-upgrade-refund:{operation_id}",
            )
            refund_status = "refunded" if refund.success else "reconciliation_required"
            await db.mining_upgrade_operations.update_one(
                {"operation_id": operation_id},
                {"$set": {
                    "status": refund_status,
                    "refund_transaction_id": refund.transaction_id if refund.success else None,
                    "refund_error": None if refund.success else refund.error,
                    "refunded_at": datetime.now(timezone.utc).isoformat() if refund.success else None,
                    "reconciliation_required_at": None if refund.success else datetime.now(timezone.utc).isoformat(),
                }},
            )
            if not refund.success:
                raise HTTPException(
                    status_code=503,
                    detail="Parallel-Upgrade erkannt; Rückgutschrift benötigt finanzielle Abstimmung.",
                )
            raise HTTPException(status_code=409, detail="Parallel-Upgrade erkannt. Zahlung wurde zurückgebucht.")

    completed_at = datetime.now(timezone.utc).isoformat()
    await db.mining_upgrade_operations.update_one(
        {"operation_id": operation_id},
        {"$set": {
            "status": "completed",
            "wallet_transaction_id": result.transaction_id,
            "completed_at": completed_at,
        }},
    )
    await db.mining_transactions.update_one(
        {"txn_id": operation_id},
        {"$setOnInsert": {
            "txn_id": operation_id,
            "user_id": user_id,
            "type": "upgrade",
            "amount_eur": -cost,
            "description": f"Upgraded {miner['name']} {req.upgrade_type} to Lv.{target_level}",
            "wallet_transaction_id": result.transaction_id,
            "idempotency_key": payment_idempotency_key,
            "created_at": now,
        }},
        upsert=True,
    )

    return {
        "ok": True,
        "operation_id": operation_id,
        "new_level": target_level,
        "cost": cost,
        "new_balance": result.new_balance,
        "replayed": result.idempotent_replay or operation.get("status") == "completed",
    }


@router.get("/upgrade-costs")
async def get_upgrade_costs(request: Request):
    """Get upgrade cost tables."""
    return {"costs": UPGRADE_COSTS, "max_level": len(UPGRADE_COSTS["power"]) - 1}


# ── Claim Daily Reward ──
@router.post("/claim-daily")
async def claim_daily(request: Request):
    """Claim daily mining earnings."""
    _require_mining_value_mode()
    user = await get_current_user(request)
    user_id = str(user["_id"])

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    claim_marker = await db.mining_claims.update_one(
        {"user_id": user_id, "date": today},
        {"$setOnInsert": {
            "user_id": user_id,
            "date": today,
            "status": "processing",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )
    if claim_marker.upserted_id is None:
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

    # Finalise the atomic daily claim marker.
    await db.mining_claims.update_one(
        {"user_id": user_id, "date": today, "status": "processing"},
        {"$set": {"status": "completed", "amount": earnings, "claimed_at": now}},
    )

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
    idempotency_key: Optional[str] = None


@router.post("/withdraw")
async def withdraw_blz(req: WithdrawRequest, request: Request):
    """Convert BLZ to EUR exactly once with retry recovery."""
    _require_mining_value_mode()
    from core.payment_engine import credit_wallet, TransactionType

    user = await get_current_user(request)
    user_id = str(user["_id"])
    raw_key = (req.idempotency_key or request.headers.get("Idempotency-Key") or "").strip()
    if not 8 <= len(raw_key) <= 200:
        raise HTTPException(status_code=400, detail="Idempotency-Key erforderlich")

    eur_amount = round(req.amount * BLZ_TO_EUR, 2)
    if eur_amount <= 0:
        raise HTTPException(status_code=400, detail="Amount too small")

    operation_hash = hashlib.sha256(f"{user_id}:{raw_key}".encode("utf-8")).hexdigest()[:20]
    operation_id = f"MWD-{operation_hash.upper()}"
    marker_field = f"withdraw_operations.{operation_id}"
    wallet = await db.mining_wallets.find_one({"user_id": user_id}) or {}
    marker = (wallet.get("withdraw_operations") or {}).get(operation_id)

    if marker:
        if round(float(marker.get("amount_blz") or 0), 8) != round(float(req.amount), 8):
            raise HTTPException(status_code=409, detail="Idempotency-Key wurde mit einem anderen Betrag verwendet")
        if marker.get("status") == "failed_refunded":
            raise HTTPException(status_code=409, detail="Frühere Auszahlung wurde zurückgebucht; bitte neue Anfrage starten")
        if marker.get("status") == "reconciliation_required":
            raise HTTPException(status_code=503, detail="Auszahlung benötigt finanzielle Abstimmung")
    else:
        debit = await db.mining_wallets.update_one(
            {
                "user_id": user_id,
                "blz_balance": {"$gte": req.amount},
                marker_field: {"$exists": False},
            },
            {
                "$inc": {"blz_balance": -req.amount, "total_withdrawn": req.amount},
                "$set": {marker_field: {
                    "amount_blz": req.amount,
                    "amount_eur": eur_amount,
                    "status": "debited",
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }},
            },
        )
        if debit.modified_count != 1:
            existing_wallet = await db.mining_wallets.find_one({"user_id": user_id}) or {}
            existing_marker = (existing_wallet.get("withdraw_operations") or {}).get(operation_id)
            if not existing_marker:
                raise HTTPException(status_code=400, detail="Insufficient BLZ balance")
            if round(float(existing_marker.get("amount_blz") or 0), 8) != round(float(req.amount), 8):
                raise HTTPException(status_code=409, detail="Idempotency-Key wurde mit einem anderen Betrag verwendet")

    result = await credit_wallet(
        user_id=user_id,
        amount=eur_amount,
        tx_type=TransactionType.REWARD,
        description=f"Mining BLZ eingelöst: {req.amount:.4f} BLZ",
        reference=f"MINE-WD-{operation_hash[:12].upper()}",
        source="mining.withdraw",
        metadata={"amount_blz": req.amount, "operation_id": operation_id},
        idempotency_key=f"mining-withdraw:{user_id}:{raw_key}",
    )
    if not result.success:
        result_status = getattr(result.status, "value", str(result.status))
        if result_status == "failed":
            refunded = await db.mining_wallets.update_one(
                {"user_id": user_id, f"{marker_field}.status": "debited"},
                {
                    "$inc": {"blz_balance": req.amount, "total_withdrawn": -req.amount},
                    "$set": {
                        f"{marker_field}.status": "failed_refunded",
                        f"{marker_field}.refund_error": result.error,
                        f"{marker_field}.refunded_at": datetime.now(timezone.utc).isoformat(),
                    },
                },
            )
            if refunded.modified_count == 1:
                raise HTTPException(status_code=400, detail=result.error or "Wallet-Gutschrift fehlgeschlagen; BLZ wurden zurückgegeben")
        if result_status == "reconciliation_required":
            await db.mining_wallets.update_one(
                {"user_id": user_id, marker_field: {"$exists": True}},
                {"$set": {
                    f"{marker_field}.status": "reconciliation_required",
                    f"{marker_field}.error": result.error,
                }},
            )
        raise HTTPException(status_code=503, detail=result.error or "Auszahlung wird noch abgestimmt; keine erneute Belastung")

    now = datetime.now(timezone.utc).isoformat()
    await db.mining_wallets.update_one(
        {"user_id": user_id, marker_field: {"$exists": True}},
        {"$set": {
            f"{marker_field}.status": "completed",
            f"{marker_field}.wallet_transaction_id": result.transaction_id,
            f"{marker_field}.completed_at": now,
        }},
    )
    await db.mining_transactions.update_one(
        {"txn_id": operation_id},
        {"$setOnInsert": {
            "txn_id": operation_id,
            "user_id": user_id,
            "type": "withdraw",
            "amount_blz": -req.amount,
            "amount_eur": eur_amount,
            "wallet_transaction_id": result.transaction_id,
            "idempotency_key": f"mining-withdraw:{user_id}:{raw_key}",
            "description": f"Converted {req.amount:.4f} BLZ → €{eur_amount:.2f}",
            "created_at": now,
        }},
        upsert=True,
    )

    updated_wallet = await get_or_create_wallet(user_id)
    return {
        "withdrawn_blz": req.amount,
        "received_eur": eur_amount,
        "new_blz_balance": updated_wallet["blz_balance"],
        "new_eur_balance": result.new_balance,
        "operation_id": operation_id,
        "replayed": result.idempotent_replay,
    }


# ── Send BLZ ──
class SendBLZRequest(BaseModel):
    recipient_email: str
    amount: float = Field(..., gt=0)
    idempotency_key: Optional[str] = None


@router.post("/send")
async def send_blz(req: SendBLZRequest, request: Request):
    """Transfer BLZ exactly once with crash-safe sender/recipient markers."""
    _require_mining_value_mode()
    user = await get_current_user(request)
    user_id = str(user["_id"])
    raw_key = (req.idempotency_key or request.headers.get("Idempotency-Key") or "").strip()
    if not 8 <= len(raw_key) <= 200:
        raise HTTPException(status_code=400, detail="Idempotency-Key erforderlich")

    recipient_email = req.recipient_email.lower().strip()
    if recipient_email == user.get("email", "").lower():
        raise HTTPException(status_code=400, detail="Cannot send to yourself")
    recipient = await db.users.find_one({"email": recipient_email})
    if not recipient:
        raise HTTPException(status_code=404, detail="Recipient not found")
    recipient_id = str(recipient["_id"])

    transfer_hash = hashlib.sha256(f"{user_id}:{raw_key}".encode("utf-8")).hexdigest()[:20]
    transfer_id = f"MTX-{transfer_hash.upper()}"
    operation_key = f"mining-send:{user_id}:{raw_key}"
    now = datetime.now(timezone.utc).isoformat()

    await db.mining_transfer_operations.update_one(
        {"user_id": user_id, "idempotency_key": operation_key},
        {"$setOnInsert": {
            "transfer_id": transfer_id,
            "user_id": user_id,
            "recipient_id": recipient_id,
            "recipient_email": recipient_email,
            "amount": req.amount,
            "idempotency_key": operation_key,
            "status": "processing",
            "created_at": now,
        }},
        upsert=True,
    )
    operation = await db.mining_transfer_operations.find_one(
        {"user_id": user_id, "idempotency_key": operation_key},
        {"_id": 0},
    ) or {}
    if (
        operation.get("recipient_id") != recipient_id
        or round(float(operation.get("amount") or 0), 8) != round(float(req.amount), 8)
    ):
        raise HTTPException(status_code=409, detail="Idempotency-Key wurde mit anderen Transferdaten verwendet")
    if operation.get("status") == "completed":
        updated_wallet = await get_or_create_wallet(user_id)
        return {
            "ok": True,
            "sent": req.amount,
            "recipient": recipient_email,
            "new_balance": updated_wallet["blz_balance"],
            "transfer_id": transfer_id,
            "replayed": True,
        }
    if operation.get("status") == "failed":
        raise HTTPException(status_code=400, detail=operation.get("error") or "Transfer fehlgeschlagen")
    if operation.get("status") == "reconciliation_required":
        raise HTTPException(status_code=503, detail="BLZ-Transfer benötigt finanzielle Abstimmung")

    sender_marker = f"transfer_out.{transfer_id}"
    sender_wallet = await db.mining_wallets.find_one({"user_id": user_id}) or {}
    if not (sender_wallet.get("transfer_out") or {}).get(transfer_id):
        debit = await db.mining_wallets.update_one(
            {
                "user_id": user_id,
                "blz_balance": {"$gte": req.amount},
                sender_marker: {"$exists": False},
            },
            {
                "$inc": {"blz_balance": -req.amount},
                "$set": {sender_marker: {
                    "amount": req.amount,
                    "recipient_id": recipient_id,
                    "created_at": now,
                }},
            },
        )
        if debit.modified_count != 1:
            existing_sender = await db.mining_wallets.find_one(
                {"user_id": user_id, sender_marker: {"$exists": True}},
                {"_id": 1},
            )
            if not existing_sender:
                await db.mining_transfer_operations.update_one(
                    {"transfer_id": transfer_id},
                    {"$set": {"status": "failed", "error": "insufficient_blz", "failed_at": datetime.now(timezone.utc).isoformat()}},
                )
                raise HTTPException(status_code=400, detail="Insufficient BLZ balance")

    recipient_marker = f"transfer_in.{transfer_id}"
    await db.mining_wallets.update_one(
        {"user_id": recipient_id},
        {"$setOnInsert": {
            "user_id": recipient_id,
            "blz_balance": 0.0,
            "total_mined": 0.0,
            "total_withdrawn": 0.0,
        }},
        upsert=True,
    )
    try:
        credit = await db.mining_wallets.update_one(
            {"user_id": recipient_id, recipient_marker: {"$exists": False}},
            {
                "$inc": {"blz_balance": req.amount},
                "$set": {recipient_marker: {
                    "amount": req.amount,
                    "sender_id": user_id,
                    "created_at": now,
                }},
            },
        )
    except Exception as exc:
        await db.mining_transfer_operations.update_one(
            {"transfer_id": transfer_id},
            {"$set": {
                "status": "reconciliation_required",
                "error": str(exc),
                "reconciliation_required_at": datetime.now(timezone.utc).isoformat(),
            }},
        )
        raise HTTPException(status_code=503, detail="BLZ-Transferzustand unklar; finanzielle Abstimmung erforderlich")

    if credit.modified_count != 1 and credit.upserted_id is None:
        existing_credit = await db.mining_wallets.find_one(
            {"user_id": recipient_id, recipient_marker: {"$exists": True}},
            {"_id": 1},
        )
        if not existing_credit:
            await db.mining_transfer_operations.update_one(
                {"transfer_id": transfer_id},
                {"$set": {
                    "status": "reconciliation_required",
                    "error": "recipient_credit_not_confirmed",
                    "reconciliation_required_at": datetime.now(timezone.utc).isoformat(),
                }},
            )
            raise HTTPException(status_code=503, detail="Empfänger-Gutschrift nicht bestätigt; finanzielle Abstimmung erforderlich")

    completed_at = datetime.now(timezone.utc).isoformat()
    await db.mining_transfer_operations.update_one(
        {"transfer_id": transfer_id},
        {"$set": {"status": "completed", "completed_at": completed_at}},
    )
    for uid, amt, desc, direction in [
        (user_id, -req.amount, f"Sent {req.amount:.4f} BLZ to {recipient_email}", "send"),
        (recipient_id, req.amount, f"Received {req.amount:.4f} BLZ from {user.get('email', '')}", "receive"),
    ]:
        await db.mining_transactions.update_one(
            {"txn_id": f"{transfer_id}-{direction}"},
            {"$setOnInsert": {
                "txn_id": f"{transfer_id}-{direction}",
                "user_id": uid,
                "type": direction,
                "amount_blz": amt,
                "description": desc,
                "reference": transfer_id,
                "idempotency_key": operation_key,
                "created_at": now,
            }},
            upsert=True,
        )

    updated_wallet = await get_or_create_wallet(user_id)
    return {
        "ok": True,
        "sent": req.amount,
        "recipient": recipient_email,
        "new_balance": updated_wallet["blz_balance"],
        "transfer_id": transfer_id,
        "replayed": False,
    }


# ── Apply Referral ──
class MiningReferralRequest(BaseModel):
    code: str


@router.post("/apply-referral")
async def apply_mining_referral(req: MiningReferralRequest, request: Request):
    _require_mining_value_mode()
    """Apply one referral code exactly once."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    code = req.code.strip().upper()
    referrer = await db.users.find_one({"mining_ref_code": code})
    if not referrer:
        raise HTTPException(status_code=404, detail="Invalid referral code")
    referrer_id = str(referrer["_id"])
    if referrer_id == user_id:
        raise HTTPException(status_code=400, detail="Cannot use your own code")

    now = datetime.now(timezone.utc).isoformat()
    claim = await db.mining_referrals.update_one(
        {"referred_id": user_id},
        {"$setOnInsert": {
            "referrer_id": referrer_id,
            "referred_id": user_id,
            "bonus_rate": REFERRAL_BONUS_RATE,
            "created_at": now,
        }},
        upsert=True,
    )
    if claim.upserted_id is None:
        raise HTTPException(status_code=400, detail="Already used a referral code")

    bonus = 0.5
    for uid, role in [(user_id, "referred"), (referrer_id, "referrer")]:
        marker = f"referral_bonus_markers.{user_id}"
        result = await db.mining_wallets.update_one(
            {"user_id": uid, marker: {"$exists": False}},
            {
                "$inc": {"blz_balance": bonus},
                "$set": {marker: {"amount": bonus, "role": role, "created_at": now}},
                "$setOnInsert": {"user_id": uid, "total_mined": 0.0, "total_withdrawn": 0.0},
            },
            upsert=True,
        )
        if result.modified_count == 1 or result.upserted_id is not None:
            await db.mining_transactions.update_one(
                {"txn_id": f"MINE-REF-{user_id}-{role}"},
                {"$setOnInsert": {
                    "txn_id": f"MINE-REF-{user_id}-{role}",
                    "user_id": uid,
                    "type": "referral_bonus",
                    "amount_blz": bonus,
                    "description": "Mining referral welcome bonus",
                    "created_at": now,
                }},
                upsert=True,
            )

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
