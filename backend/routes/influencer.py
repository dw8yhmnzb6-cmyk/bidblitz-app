"""
BidBlitz V2 — Influencer & Manager System
Multi-level commission tracking, admin-configurable rates, bonus campaigns.
"""
import secrets
import logging
import hashlib
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional
from bson import ObjectId
from core.database import db

router = APIRouter(prefix="/api/influencer", tags=["Influencer"])
logger = logging.getLogger("bidblitz.influencer")

DEFAULT_CONFIG = {
    "influencer_rate": 10.0,
    "manager_rate": 3.0,
    "min_payout": 10.0,
}


async def get_current_user(request: Request):
    from routes.auth import get_current_user as auth_user
    return await auth_user(request)


async def get_config():
    cfg = await db.commission_config.find_one({"_id": "global"}, {"_id": 0})
    return cfg or DEFAULT_CONFIG


# ══════════════════════════════════════
# PUBLIC: Influencer Dashboard
# ══════════════════════════════════════

@router.get("/me")
async def get_influencer_profile(request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    inf = await db.influencers.find_one({"user_id": user_id}, {"_id": 0})
    if not inf:
        return {"is_influencer": False}
    total_earned = 0
    pending = 0
    paid = 0
    commissions = await db.commissions.find({"influencer_id": user_id}, {"_id": 0}).sort("created_at", -1).to_list(50)
    for c in commissions:
        total_earned += c.get("amount", 0)
        if c.get("status") == "pending":
            pending += c.get("amount", 0)
        elif c.get("status") in ("paid", "credited"):
            paid += c.get("amount", 0)
    # If manager, get linked influencers
    linked = []
    if inf.get("type") == "manager":
        linked_infs = await db.influencers.find({"manager_id": user_id}, {"_id": 0}).to_list(50)
        linked = linked_infs
    return {
        "is_influencer": True,
        **inf,
        "total_earned": round(total_earned, 2),
        "pending_payout": round(pending, 2),
        "total_paid": round(paid, 2),
        "recent_commissions": commissions[:15],
        "linked_influencers": linked,
    }


@router.get("/me/referrals")
async def get_referral_stats(request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    inf = await db.influencers.find_one({"user_id": user_id})
    if not inf:
        raise HTTPException(status_code=404, detail="Not an influencer")
    ref_code = inf.get("referral_code", "")
    total_refs = await db.users.count_documents({"referred_by_influencer": user_id})
    active_refs = await db.users.count_documents({"referred_by_influencer": user_id, "bid_credits": {"$gt": 0}})
    return {"referral_code": ref_code, "total_referrals": total_refs, "active_referrals": active_refs}


# ══════════════════════════════════════
# ADMIN: Commission Configuration
# ══════════════════════════════════════

class UpdateConfigReq(BaseModel):
    influencer_rate: Optional[float] = Field(default=None, ge=0, le=100, allow_inf_nan=False)
    manager_rate: Optional[float] = Field(default=None, ge=0, le=100, allow_inf_nan=False)
    min_payout: Optional[float] = Field(default=None, ge=0, le=100000, allow_inf_nan=False)


@router.post("/admin/config")
async def update_global_config(req: UpdateConfigReq, request: Request):
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    update = {}
    if req.influencer_rate is not None:
        update["influencer_rate"] = req.influencer_rate
    if req.manager_rate is not None:
        update["manager_rate"] = req.manager_rate
    if req.min_payout is not None:
        update["min_payout"] = req.min_payout
    if update:
        update["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.commission_config.update_one({"_id": "global"}, {"$set": update}, upsert=True)
    cfg = await get_config()
    return {"config": cfg}


@router.get("/admin/config")
async def get_global_config(request: Request):
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    cfg = await get_config()
    campaigns = await db.bonus_campaigns.find({"status": "active"}, {"_id": 0}).to_list(20)
    return {"config": cfg, "active_campaigns": campaigns}


# ── Admin: Create/Update Influencer ──
class CreateInfluencerReq(BaseModel):
    user_email: str
    type: str = Field(default="influencer", pattern="^(influencer|manager)$")
    commission_rate: Optional[float] = Field(default=None, ge=0, le=100, allow_inf_nan=False)
    manager_id: Optional[str] = None


@router.post("/admin/create")
async def create_influencer(req: CreateInfluencerReq, request: Request):
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    target = await db.users.find_one({"email": req.user_email})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    target_id = str(target["_id"])
    existing = await db.influencers.find_one({"user_id": target_id})
    if existing:
        raise HTTPException(status_code=400, detail="Already an influencer")
    ref_code = f"INF-{secrets.token_hex(4).upper()}"
    inf = {
        "user_id": target_id,
        "user_email": req.user_email,
        "user_name": target.get("name", ""),
        "type": req.type,
        "referral_code": ref_code,
        "commission_rate": req.commission_rate,
        "manager_id": req.manager_id,
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.influencers.insert_one(inf)
    inf.pop("_id", None)
    return {"influencer": inf}


# ── Admin: Update commission rate per influencer ──
class UpdateInfluencerReq(BaseModel):
    user_id: str
    commission_rate: Optional[float] = Field(default=None, ge=0, le=100, allow_inf_nan=False)
    manager_id: Optional[str] = None
    status: Optional[str] = Field(default=None, pattern="^(active|inactive|suspended)$")


@router.post("/admin/update")
async def update_influencer(req: UpdateInfluencerReq, request: Request):
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    update = {}
    if req.commission_rate is not None:
        update["commission_rate"] = req.commission_rate
    if req.manager_id is not None:
        update["manager_id"] = req.manager_id
    if req.status is not None:
        update["status"] = req.status
    if update:
        update["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.influencers.update_one({"user_id": req.user_id}, {"$set": update})
    inf = await db.influencers.find_one({"user_id": req.user_id}, {"_id": 0})
    return {"influencer": inf}


# ── Admin: List all influencers ──
@router.get("/admin/list")
async def list_influencers(request: Request):
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    infs = await db.influencers.find({}, {"_id": 0}).to_list(200)
    return {"influencers": infs, "total": len(infs)}


# ── Admin: Assign influencer to manager ──
class AssignManagerReq(BaseModel):
    influencer_user_id: str
    manager_user_id: str


@router.post("/admin/assign-manager")
async def assign_manager(req: AssignManagerReq, request: Request):
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    mgr = await db.influencers.find_one({"user_id": req.manager_user_id, "type": "manager"})
    if not mgr:
        raise HTTPException(status_code=404, detail="Manager not found")
    await db.influencers.update_one(
        {"user_id": req.influencer_user_id},
        {"$set": {"manager_id": req.manager_user_id, "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    return {"ok": True}


# ── Admin: Create bonus campaign ──
class BonusCampaignReq(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    bonus_rate: float = Field(..., ge=0, le=100, allow_inf_nan=False)
    start_date: str
    end_date: str


@router.post("/admin/campaign")
async def create_campaign(req: BonusCampaignReq, request: Request):
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    campaign = {
        "id": secrets.token_hex(6),
        "name": req.name,
        "bonus_rate": req.bonus_rate,
        "start_date": req.start_date,
        "end_date": req.end_date,
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.bonus_campaigns.insert_one(campaign)
    campaign.pop("_id", None)
    return {"campaign": campaign}


# ══════════════════════════════════════
# COMMISSION PROCESSING (called from purchase flow)
# ══════════════════════════════════════

async def _grant_commission_credits_once(
    *,
    recipient_id: str,
    buyer_id: str,
    purchase_ref: str,
    credits: int,
    rate: float,
    kind: str,
    now: str,
) -> dict:
    """Grant one influencer/manager bid-credit commission exactly once."""
    scope = f"{buyer_id}:{purchase_ref}:{recipient_id}:{kind}"
    marker_hash = hashlib.sha256(scope.encode("utf-8")).hexdigest()[:24]
    marker_field = f"influencer_commission_markers.{marker_hash}"
    commission_id = f"COMM-{marker_hash.upper()}"
    payload = {
        "influencer_id": recipient_id,
        "buyer_id": buyer_id,
        "purchase_ref": purchase_ref,
        "amount": int(credits),
        "rate": float(rate),
        "type": kind,
    }

    await db.commissions.update_one(
        {"_id": commission_id},
        {"$setOnInsert": {
            "_id": commission_id,
            **payload,
            "status": "pending",
            "created_at": now,
        }},
        upsert=True,
    )
    saved = await db.commissions.find_one({"_id": commission_id}, {"_id": 0}) or {}
    for key, value in payload.items():
        if saved.get(key) != value:
            logger.error("Commission idempotency payload mismatch: %s", commission_id)
            return {"ok": False, "status": "reconciliation_required", "commission_id": commission_id}
    if saved.get("status") == "credited":
        return {"ok": True, "replayed": True, "commission_id": commission_id}

    recipient_oid = ObjectId(recipient_id) if ObjectId.is_valid(recipient_id) else recipient_id
    applied = await db.users.update_one(
        {"_id": recipient_oid, marker_field: {"$exists": False}},
        {
            "$inc": {
                "bid_credits": int(credits),
                "total_reward_credits": int(credits),
            },
            "$set": {
                marker_field: {
                    "commission_id": commission_id,
                    "purchase_ref": purchase_ref,
                    "credits": int(credits),
                    "created_at": now,
                }
            },
        },
    )
    if applied.modified_count != 1:
        marker_exists = await db.users.find_one(
            {"_id": recipient_oid, marker_field: {"$exists": True}},
            {"_id": 1},
        )
        if not marker_exists:
            await db.commissions.update_one(
                {"_id": commission_id},
                {"$set": {
                    "status": "reconciliation_required",
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }},
            )
            return {"ok": False, "status": "reconciliation_required", "commission_id": commission_id}

    await db.commissions.update_one(
        {"_id": commission_id},
        {"$set": {
            "status": "credited",
            "credited_at": datetime.now(timezone.utc).isoformat(),
        }},
    )
    return {
        "ok": True,
        "replayed": applied.modified_count != 1,
        "commission_id": commission_id,
    }


async def process_commission(buyer_id: str, purchase_amount: float, purchase_ref: str):
    """Process influencer + manager bid-credit commission exactly once per purchase."""
    purchase_amount = float(purchase_amount)
    if purchase_amount <= 0 or purchase_amount > 1_000_000 or not purchase_ref:
        return {"ok": False, "reason": "invalid_purchase"}
    buyer_oid = ObjectId(buyer_id) if ObjectId.is_valid(buyer_id) else buyer_id
    buyer = await db.users.find_one({"_id": buyer_oid})
    if not buyer:
        return {"ok": False, "reason": "buyer_not_found"}

    inf_id = str(buyer.get("referred_by_influencer") or "")
    if not inf_id:
        return {"ok": False, "reason": "no_influencer"}
    inf = await db.influencers.find_one({"user_id": inf_id, "status": "active"})
    if not inf:
        return {"ok": False, "reason": "influencer_inactive"}

    cfg = await get_config()
    now = datetime.now(timezone.utc).isoformat()
    bonus = 0.0
    campaigns = await db.bonus_campaigns.find({
        "status": "active",
        "start_date": {"$lte": now},
        "end_date": {"$gte": now},
    }).to_list(5)
    for campaign in campaigns:
        bonus += float(campaign.get("bonus_rate", 0) or 0)

    rate = float(inf.get("commission_rate") or cfg.get("influencer_rate", 10.0)) + bonus
    commission_credits = max(1, round(float(purchase_amount) * (rate / 100)))
    direct = await _grant_commission_credits_once(
        recipient_id=inf_id,
        buyer_id=buyer_id,
        purchase_ref=purchase_ref,
        credits=commission_credits,
        rate=rate,
        kind="direct",
        now=now,
    )
    if not direct.get("ok"):
        logger.error("Influencer commission requires reconciliation: %s", direct)
        return direct

    manager_result = None
    mgr_id = str(inf.get("manager_id") or "")
    if mgr_id:
        mgr = await db.influencers.find_one({
            "user_id": mgr_id,
            "type": "manager",
            "status": "active",
        })
        if mgr:
            mgr_rate = float(mgr.get("commission_rate") or cfg.get("manager_rate", 3.0))
            mgr_credits = max(1, round(float(purchase_amount) * (mgr_rate / 100)))
            manager_result = await _grant_commission_credits_once(
                recipient_id=mgr_id,
                buyer_id=buyer_id,
                purchase_ref=purchase_ref,
                credits=mgr_credits,
                rate=mgr_rate,
                kind="override",
                now=now,
            )
            if not manager_result.get("ok"):
                logger.error("Manager commission requires reconciliation: %s", manager_result)

    return {"ok": True, "direct": direct, "manager": manager_result}

