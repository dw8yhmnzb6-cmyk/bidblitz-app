"""
BidBlitz V2 - Admin Routes
Platform control center: overview, user/merchant management, payout approval, transaction monitoring.
"""

from fastapi import APIRouter, HTTPException, Request, Query
from pydantic import BaseModel, Field
from bson import ObjectId
from datetime import datetime, timezone
from core.database import db
from core.security import get_current_user
from core.config import FEES
from core.rate_limit import limiter, RATE_ADMIN_ACTION
from core.audit import log_audit, AuditEvent, get_client_info
from typing import Optional

router = APIRouter(prefix="/api/admin", tags=["admin"])


async def require_admin(request: Request):
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


# ── Admin Stats (alias for overview) ──
@router.get("/stats")
async def admin_stats(request: Request):
    """Alias for /overview - returns platform statistics."""
    return await overview(request)


# ── Platform Overview ──
@router.get("/overview")
async def overview(request: Request):
    await require_admin(request)

    total_users = await db.users.count_documents({})
    total_merchants = await db.merchants.count_documents({})

    # Aggregate payment volume from all transactions
    pipeline = [
        {"$match": {"status": "completed"}},
        {"$group": {
            "_id": None, 
            "volume": {"$sum": {"$abs": {"$ifNull": ["$amount", 0]}}},
            "fees": {"$sum": {"$ifNull": ["$fee_amount", 0]}}
        }},
    ]
    agg = await db.transactions.aggregate(pipeline).to_list(1)
    stats = agg[0] if agg else {"volume": 0, "fees": 0}

    # Calculate total revenue from different sources
    total_revenue = 0
    
    # Auction credits purchases
    auction_revenue = await db.transactions.aggregate([
        {"$match": {"type": "credit_purchase", "status": "completed"}},
        {"$group": {"_id": None, "total": {"$sum": {"$abs": "$amount"}}}}
    ]).to_list(1)
    total_revenue += auction_revenue[0]["total"] if auction_revenue else 0
    
    # Mining packages
    mining_revenue = await db.transactions.aggregate([
        {"$match": {"type": "mining_purchase", "status": "completed"}},
        {"$group": {"_id": None, "total": {"$sum": {"$abs": "$amount"}}}}
    ]).to_list(1)
    total_revenue += mining_revenue[0]["total"] if mining_revenue else 0
    
    # Kids subscriptions
    kids_revenue = await db.transactions.aggregate([
        {"$match": {"type": "kids_subscription", "status": "completed"}},
        {"$group": {"_id": None, "total": {"$sum": {"$abs": "$amount"}}}}
    ]).to_list(1)
    total_revenue += kids_revenue[0]["total"] if kids_revenue else 0

    # Payout stats
    pending_payouts = await db.payouts.count_documents({"status": {"$in": ["pending", "approved"]}})
    pending_amount_agg = await db.payouts.aggregate([
        {"$match": {"status": {"$in": ["pending", "approved"]}}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}},
    ]).to_list(1)
    pending_amount = pending_amount_agg[0]["total"] if pending_amount_agg else 0

    processed_agg = await db.payouts.aggregate([
        {"$match": {"status": "processed"}},
        {"$group": {"_id": None, "total": {"$sum": "$net_amount"}, "count": {"$sum": 1}}},
    ]).to_list(1)
    processed = processed_agg[0] if processed_agg else {"total": 0, "count": 0}

    total_txns = await db.transactions.count_documents({})
    
    # Auction stats
    active_auctions = await db.auctions.count_documents({"status": "active"})
    
    # Mining stats
    active_miners = await db.mining_miners.count_documents({"status": "active"})
    
    # Driver stats
    active_drivers = await db.drivers.count_documents({"status": "active", "is_verified": True})
    online_drivers = await db.drivers.count_documents({"is_online": True})
    
    # Restaurant stats
    active_restaurants = await db.food_restaurants.count_documents({"status": "approved"})
    
    # Scooter stats
    total_scooters = await db.scooters.count_documents({})
    available_scooters = await db.scooters.count_documents({"status": "available"})

    # Today stats
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    today_txns = await db.transactions.count_documents({"created_at": {"$gte": today_start}})
    today_users = await db.users.count_documents({"created_at": {"$gte": today_start}})

    return {
        "total_users": total_users,
        "total_merchants": total_merchants,
        "total_transactions": total_txns,
        "payment_volume": round(stats["volume"], 2),
        "platform_fee_revenue": round(stats["fees"], 2),
        "total_revenue": round(total_revenue, 2),
        "pending_payouts_count": pending_payouts,
        "pending_payouts_amount": round(pending_amount, 2),
        "processed_payouts_count": processed["count"],
        "processed_payouts_amount": round(processed["total"], 2),
        "today_transactions": today_txns,
        "today_new_users": today_users,
        "active_auctions": active_auctions,
        "active_miners": active_miners,
        "active_drivers": active_drivers,
        "online_drivers": online_drivers,
        "active_restaurants": active_restaurants,
        "total_scooters": total_scooters,
        "available_scooters": available_scooters,
        "fee_config": FEES,
    }


# ── User Management ──
@router.get("/users")
async def list_users(request: Request, search: str = "", limit: int = 50, skip: int = 0):
    await require_admin(request)

    query = {}
    if search:
        query = {"$or": [
            {"name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
        ]}

    users = await db.users.find(query, {"password_hash": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.users.count_documents(query)

    user_ids = [u.get("id") or str(u["_id"]) for u in users]
    txn_counts = await db.transactions.aggregate([
        {"$match": {"user_id": {"$in": user_ids}}},
        {"$group": {"_id": "$user_id", "count": {"$sum": 1}}}
    ]).to_list(None)
    txn_map = {t["_id"]: t["count"] for t in txn_counts}

    result = []
    for u in users:
        uid = u.get("id") or str(u["_id"])
        result.append({
            "id": uid,
            "name": u.get("name", ""),
            "email": u.get("email", ""),
            "role": u.get("role", "user"),
            "balance": u.get("balance", u.get("bids_balance", 0)),
            "transaction_count": txn_map.get(uid, 0),
            "created_at": u.get("created_at", ""),
            "registered_at": u.get("registered_at", u.get("created_at", "")),
            "last_login_at": u.get("last_login_at", ""),
            "login_count": int(u.get("login_count", 0) or 0),
        })

    return {"users": result, "total": total}


@router.put("/users/{user_id}/role")
async def update_user_role(user_id: str, request: Request):
    await require_admin(request)
    body = await request.json()
    new_role = body.get("role", "")
    if new_role not in ["user", "merchant", "admin", "driver"]:
        raise HTTPException(status_code=400, detail="Ungueltige Rolle")
    result = await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": {"role": new_role}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User nicht gefunden")
    return {"ok": True, "message": f"Rolle auf '{new_role}' geaendert!"}



# ── Merchant Management ──
@router.get("/merchants")
async def list_merchants(request: Request, search: str = "", limit: int = 50, skip: int = 0):
    await require_admin(request)

    query = {}
    if search:
        query = {"business_name": {"$regex": search, "$options": "i"}}

    merchants = await db.merchants.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.merchants.count_documents(query)

    merchant_ids = [str(m["_id"]) for m in merchants]
    payout_counts = await db.payouts.aggregate([
        {"$match": {"merchant_id": {"$in": merchant_ids}}},
        {"$group": {"_id": "$merchant_id", "count": {"$sum": 1}}}
    ]).to_list(None)
    payout_map = {p["_id"]: p["count"] for p in payout_counts}

    result = []
    for m in merchants:
        result.append({
            "id": str(m["_id"]),
            "user_id": m.get("user_id", ""),
            "business_name": m.get("business_name", ""),
            "gross_earnings": round(m.get("gross_earnings", 0), 2),
            "total_earnings": round(m.get("total_earnings", 0), 2),
            "total_fees": round(m.get("total_fees", 0), 2),
            "available_payout": round(m.get("available_payout", 0), 2),
            "pending_payout": round(m.get("pending_payout", 0), 2),
            "total_transactions": m.get("total_transactions", 0),
            "payout_requests": payout_map.get(str(m["_id"]), 0),
            "created_at": m.get("created_at", ""),
        })

    return {"merchants": result, "total": total}


# ── Payout Management ──
@router.get("/payouts")
async def list_payouts(request: Request, status: str = "", limit: int = 50, skip: int = 0):
    await require_admin(request)

    query = {}
    if status:
        query["status"] = status

    payouts = await db.payouts.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.payouts.count_documents(query)

    return {"payouts": payouts, "total": total}


class PayoutAction(BaseModel):
    action: str  # approve, process, fail, cancel


@router.post("/payouts/{payout_ref}/action")
@limiter.limit(RATE_ADMIN_ACTION)
async def payout_action(payout_ref: str, req: PayoutAction, request: Request):
    admin = await require_admin(request)
    admin_id = str(admin["_id"])
    ip, ua = get_client_info(request)

    payout = await db.payouts.find_one({"reference": payout_ref})
    if not payout:
        raise HTTPException(status_code=404, detail="Payout not found")

    now = datetime.now(timezone.utc).isoformat()
    valid_transitions = {
        "approve": (["pending"], "approved"),
        "process": (["approved"], "processed"),
        "fail": (["pending", "approved"], "failed"),
        "cancel": (["pending"], "cancelled"),
    }

    if req.action not in valid_transitions:
        raise HTTPException(status_code=400, detail=f"Invalid action: {req.action}")

    allowed_from, new_status = valid_transitions[req.action]
    if payout["status"] not in allowed_from:
        raise HTTPException(status_code=400, detail=f"Cannot {req.action} payout with status: {payout['status']}")

    update = {"$set": {"status": new_status, "processed_at": now if new_status in ("processed", "failed", "cancelled") else payout.get("processed_at")}}
    await db.payouts.update_one({"reference": payout_ref}, update)

    # If failed or cancelled, return funds to available
    if new_status in ("failed", "cancelled"):
        await db.merchants.update_one(
            {"_id": ObjectId(payout["merchant_id"])} if ObjectId.is_valid(payout["merchant_id"]) else {"user_id": payout["user_id"]},
            {"$inc": {"available_payout": payout["amount"], "pending_payout": -payout["amount"]}},
        )

    # If processed, move from pending_payout to paid_out
    if new_status == "processed":
        await db.merchants.update_one(
            {"_id": ObjectId(payout["merchant_id"])} if ObjectId.is_valid(payout["merchant_id"]) else {"user_id": payout["user_id"]},
            {"$inc": {"pending_payout": -payout["amount"]}},
        )

    await log_audit(AuditEvent.PAYOUT_ACTION, user_id=admin_id, email=admin.get("email", ""),
                    ip=ip, user_agent=ua,
                    details={"action": req.action, "reference": payout_ref,
                             "new_status": new_status, "amount": payout.get("amount", 0),
                             "merchant_id": payout.get("merchant_id", "")})

    return {"success": True, "new_status": new_status, "reference": payout_ref}


# ── Transaction Monitoring ──
@router.get("/transactions")
async def list_transactions(
    request: Request,
    search: str = "",
    txn_type: str = "",
    status: str = "",
    limit: int = 50,
    skip: int = 0,
):
    await require_admin(request)

    query = {}
    if search:
        query["$or"] = [
            {"reference": {"$regex": search, "$options": "i"}},
            {"merchant_name": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
        ]
    if txn_type:
        query["type"] = txn_type
    if status:
        query["status"] = status

    txns = await db.transactions.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.transactions.count_documents(query)

    return {"transactions": txns, "total": total}


# ── Platform Settings (read) ──
@router.get("/settings")
async def get_settings(request: Request):
    await require_admin(request)
    return {
        "fees": FEES,
    }


@router.put("/settings")
async def update_settings(request: Request):
    user = await require_admin(request)
    body = await request.json()
    new_fees = body.get("fees", {})
    valid_keys = ["payment", "send", "topup", "payout_flat", "payout_percent", "min_payout", "settlement_delay_hours"]
    for k in valid_keys:
        if k in new_fees:
            FEES[k] = float(new_fees[k])
    await log_audit("admin_settings_update", str(user["_id"]), request, details={"fees": FEES})
    return {"success": True, "fees": FEES}


# ── Audit Logs (Admin Review) ──
@router.get("/audit-logs")
async def get_audit_logs(
    request: Request,
    event: str = "",
    user_id: str = "",
    email: str = "",
    severity: str = "",
    date_from: str = "",
    date_to: str = "",
    search: str = "",
    limit: int = 50,
    skip: int = 0,
):
    admin = await require_admin(request)
    ip, ua = get_client_info(request)

    query = {}
    if event:
        query["event"] = event
    if user_id:
        query["user_id"] = user_id
    if email:
        query["email"] = {"$regex": email, "$options": "i"}
    if severity:
        query["severity"] = severity
    # ISO date-range filter on timestamp
    ts_filter = {}
    if date_from:
        ts_filter["$gte"] = date_from
    if date_to:
        ts_filter["$lte"] = date_to
    if ts_filter:
        query["timestamp"] = ts_filter
    # Free-text search across event/email/ip
    if search:
        query["$or"] = [
            {"event": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
            {"ip": {"$regex": search, "$options": "i"}},
        ]

    logs = await db.audit_logs.find(query, {"_id": 0}).sort("timestamp", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.audit_logs.count_documents(query)

    # Distinct values for client-side dropdowns
    distinct_events = await db.audit_logs.distinct("event")
    distinct_severities = await db.audit_logs.distinct("severity")

    await log_audit(AuditEvent.ADMIN_ACTION, user_id=str(admin["_id"]), email=admin.get("email", ""),
                    ip=ip, user_agent=ua,
                    details={"action": "view_audit_logs", "filters": {"event": event, "user_id": user_id, "email": email, "severity": severity, "date_from": date_from, "date_to": date_to, "search": search}})

    return {
        "logs": logs,
        "total": total,
        "skip": skip,
        "limit": limit,
        "available_events": sorted([e for e in distinct_events if e]),
        "available_severities": sorted([s for s in distinct_severities if s]),
    }


# ── Compliance Flags (Admin Review) ──
@router.get("/compliance-flags")
async def get_compliance_flags(
    request: Request,
    status: str = "",
    user_id: str = "",
    limit: int = 50,
    skip: int = 0,
):
    admin = await require_admin(request)
    ip, ua = get_client_info(request)

    query = {}
    if status:
        query["status"] = status
    if user_id:
        query["user_id"] = user_id

    flags = await db.compliance_flags.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.compliance_flags.count_documents(query)

    await log_audit(AuditEvent.ADMIN_ACTION, user_id=str(admin["_id"]), email=admin.get("email", ""),
                    ip=ip, user_agent=ua,
                    details={"action": "view_compliance_flags", "filters": {"status": status, "user_id": user_id}})

    return {"flags": flags, "total": total}


class ResolveFlagRequest(BaseModel):
    resolution: str = ""  # notes about resolution


@router.post("/compliance-flags/{flag_index}/resolve")
@limiter.limit(RATE_ADMIN_ACTION)
async def resolve_compliance_flag(flag_index: int, req: ResolveFlagRequest, request: Request):
    admin = await require_admin(request)
    admin_id = str(admin["_id"])
    ip, ua = get_client_info(request)

    # Get the nth open flag
    open_flags = await db.compliance_flags.find({"status": "open"}).sort("created_at", -1).to_list(1000)
    if flag_index < 0 or flag_index >= len(open_flags):
        raise HTTPException(status_code=404, detail="Flag not found")

    flag = open_flags[flag_index]
    now = datetime.now(timezone.utc).isoformat()

    await db.compliance_flags.update_one(
        {"_id": flag["_id"]},
        {"$set": {"status": "resolved", "resolved_at": now, "resolved_by": admin_id, "resolution": req.resolution}},
    )

    await log_audit(AuditEvent.ADMIN_ACTION, user_id=admin_id, email=admin.get("email", ""),
                    ip=ip, user_agent=ua,
                    details={"action": "resolve_compliance_flag", "flag_user": flag.get("user_id", ""),
                             "flag_reason": flag.get("reason", "")})

    return {"success": True, "message": "Flag resolved"}


# ── Compliance Check History ──
@router.get("/compliance-checks")
async def get_compliance_checks(
    request: Request,
    outcome: str = "",
    user_id: str = "",
    txn_type: str = "",
    limit: int = 50,
    skip: int = 0,
):
    await require_admin(request)

    query = {}
    if outcome:
        query["outcome"] = outcome
    if user_id:
        query["user_id"] = user_id
    if txn_type:
        query["txn_type"] = txn_type

    checks = await db.compliance_checks.find(query, {"_id": 0}).sort("timestamp", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.compliance_checks.count_documents(query)

    return {"checks": checks, "total": total}



# ── Feature Flags Management ──
@router.get("/feature-flags")
async def get_feature_flags(request: Request):
    await require_admin(request)
    from core.feature_flags import get_all_flags
    flags = await get_all_flags()
    return {"flags": flags}


@router.put("/feature-flags/{flag_name}")
async def update_feature_flag(flag_name: str, request: Request):
    admin = await require_admin(request)
    from core.feature_flags import update_flag, DEFAULT_FLAGS, get_all_flags
    body = await request.json()
    if flag_name not in DEFAULT_FLAGS and flag_name not in (await get_all_flags()):
        raise HTTPException(status_code=404, detail="Unknown feature flag")
    result = await update_flag(
        flag_name,
        enabled=body.get("enabled"),
        access=body.get("access"),
    )
    ip, ua = get_client_info(request)
    await log_audit(AuditEvent.ADMIN_ACTION, str(admin["_id"]), "admin", ip, ua, "success", f"Updated flag: {flag_name}")
    return {"flag": flag_name, "data": result}



# ── Soft Launch Management ──
from core.soft_launch import get_soft_launch_config, SOFT_LAUNCH_CONFIG_KEY, create_invite_codes
from datetime import timedelta


class WhitelistUpdate(BaseModel):
    emails: list[str]


class InviteCodeRequest(BaseModel):
    count: int = Field(default=5, ge=1, le=100)
    max_uses: int = Field(default=1, ge=1, le=1000)
    label: str = ""
    type: str = Field(default="user", pattern="^(user|merchant)$")


@router.get("/soft-launch")
async def get_soft_launch(request: Request):
    """Get soft launch config + live activity dashboard."""
    await require_admin(request)
    config = await get_soft_launch_config()

    now = datetime.now(timezone.utc)
    h24 = (now - timedelta(hours=24)).isoformat()
    h1 = (now - timedelta(hours=1)).isoformat()

    # Payment activity (24h)
    payments_24h = await db.transactions.count_documents({
        "created_at": {"$gte": h24}, "type": {"$in": ["payment", "send", "topup"]}
    })
    payments_1h = await db.transactions.count_documents({
        "created_at": {"$gte": h1}, "type": {"$in": ["payment", "send", "topup"]}
    })

    # Failed payments (24h)
    failed_24h = await db.audit_logs.count_documents({
        "timestamp": {"$gte": h24},
        "event": {"$in": ["payment_failed", "send_failed", "topup_failed"]},
    })

    # Payment volume (24h)
    volume_pipeline = [
        {"$match": {"created_at": {"$gte": h24}, "type": {"$in": ["payment", "send", "topup"]}, "amount": {"$gt": 0}}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}},
    ]
    vol = await db.transactions.aggregate(volume_pipeline).to_list(1)
    volume_24h = round(vol[0]["total"], 2) if vol else 0

    # Support issues (open)
    open_tickets = await db.support_tickets.count_documents({"status": {"$in": ["open", "pending"]}})
    tickets_24h = await db.support_tickets.count_documents({"created_at": {"$gte": h24}})

    # Active users (24h)
    active_logins = await db.audit_logs.count_documents({
        "timestamp": {"$gte": h24}, "event": "login_success"
    })

    # New registrations (24h)
    new_users = await db.users.count_documents({"created_at": {"$gte": h24}})

    # Alerts (24h)
    alerts_24h = await db.notifications.count_documents({
        "type": "admin_alert", "created_at": {"$gte": h24}
    })

    config.pop("key", None)
    return {
        "config": config,
        "dashboard": {
            "payments_24h": payments_24h,
            "payments_1h": payments_1h,
            "failed_payments_24h": failed_24h,
            "volume_24h": volume_24h,
            "open_support_tickets": open_tickets,
            "new_tickets_24h": tickets_24h,
            "active_logins_24h": active_logins,
            "new_users_24h": new_users,
            "admin_alerts_24h": alerts_24h,
        },
    }


@router.put("/soft-launch")
async def update_soft_launch(request: Request):
    """Toggle soft launch on/off, control registration."""
    admin = await require_admin(request)
    body = await request.json()
    update = {}
    if "enabled" in body:
        update["enabled"] = bool(body["enabled"])
    if "registration_open" in body:
        update["registration_open"] = bool(body["registration_open"])
    if "allow_existing_users" in body:
        update["allow_existing_users"] = bool(body["allow_existing_users"])
    if not update:
        raise HTTPException(status_code=400, detail="Nothing to update")
    await db.platform_config.update_one(
        {"key": SOFT_LAUNCH_CONFIG_KEY}, {"$set": update}
    )
    ip, ua = get_client_info(request)
    await log_audit(AuditEvent.ADMIN_ACTION, str(admin["_id"]), admin["email"],
                    ip, ua, details={"action": "soft_launch_update", **update})
    config = await get_soft_launch_config()
    config.pop("key", None)
    return {"success": True, "config": config}


@router.post("/soft-launch/whitelist")
async def add_to_whitelist(req: WhitelistUpdate, request: Request):
    """Add emails to the soft launch whitelist."""
    admin = await require_admin(request)
    emails = [e.lower().strip() for e in req.emails if e.strip()]
    if not emails:
        raise HTTPException(status_code=400, detail="No emails provided")
    await db.platform_config.update_one(
        {"key": SOFT_LAUNCH_CONFIG_KEY},
        {"$addToSet": {"whitelist": {"$each": emails}}},
    )
    ip, ua = get_client_info(request)
    await log_audit(AuditEvent.ADMIN_ACTION, str(admin["_id"]), admin["email"],
                    ip, ua, details={"action": "whitelist_add", "emails": emails})
    config = await get_soft_launch_config()
    return {"success": True, "whitelist": config.get("whitelist", []), "count": len(config.get("whitelist", []))}


@router.delete("/soft-launch/whitelist")
async def remove_from_whitelist(req: WhitelistUpdate, request: Request):
    """Remove emails from the soft launch whitelist."""
    admin = await require_admin(request)
    emails = [e.lower().strip() for e in req.emails if e.strip()]
    if not emails:
        raise HTTPException(status_code=400, detail="No emails provided")
    await db.platform_config.update_one(
        {"key": SOFT_LAUNCH_CONFIG_KEY},
        {"$pullAll": {"whitelist": emails}},
    )
    ip, ua = get_client_info(request)
    await log_audit(AuditEvent.ADMIN_ACTION, str(admin["_id"]), admin["email"],
                    ip, ua, details={"action": "whitelist_remove", "emails": emails})
    config = await get_soft_launch_config()
    return {"success": True, "whitelist": config.get("whitelist", []), "count": len(config.get("whitelist", []))}


# ── Invite Codes ──

@router.post("/invite-codes")
async def generate_invite_codes(req: InviteCodeRequest, request: Request):
    """Generate a batch of invite codes."""
    admin = await require_admin(request)
    codes = await create_invite_codes(
        count=req.count,
        created_by=admin["email"],
        max_uses=req.max_uses,
        label=req.label,
        code_type=req.type,
    )
    ip, ua = get_client_info(request)
    await log_audit(AuditEvent.ADMIN_ACTION, str(admin["_id"]), admin["email"],
                    ip, ua, details={"action": "invite_codes_created", "count": len(codes), "type": req.type, "label": req.label})
    return {"success": True, "codes": codes, "count": len(codes), "max_uses": req.max_uses, "type": req.type}


@router.get("/invite-codes")
async def list_invite_codes(request: Request, active_only: bool = False):
    """List all invite codes with usage stats."""
    await require_admin(request)
    query = {"active": True} if active_only else {}
    codes = await db.invite_codes.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    total = len(codes)
    total_used = sum(c["used_count"] for c in codes)
    total_capacity = sum(c["max_uses"] for c in codes)
    return {
        "codes": codes,
        "total": total,
        "total_used": total_used,
        "total_capacity": total_capacity,
        "remaining": total_capacity - total_used,
    }


@router.put("/invite-codes/{code}/deactivate")
async def deactivate_invite_code(code: str, request: Request):
    """Deactivate a specific invite code."""
    admin = await require_admin(request)
    result = await db.invite_codes.update_one(
        {"code": code.strip().upper()}, {"$set": {"active": False}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Invite code not found")
    ip, ua = get_client_info(request)
    await log_audit(AuditEvent.ADMIN_ACTION, str(admin["_id"]), admin["email"],
                    ip, ua, details={"action": "invite_code_deactivated", "code": code})
    return {"success": True, "code": code, "active": False}



# ══════════════════════════════════════
# SYSTEM HEALTH CHECK
# ══════════════════════════════════════

@router.get("/system-health")
async def system_health(request: Request):
    """
    Complete system health check for production readiness.
    Returns status of all modules.
    """
    await require_admin(request)
    
    health = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "status": "healthy",
        "modules": {},
        "counts": {},
        "warnings": [],
    }
    
    # 1. Database connectivity
    try:
        await db.users.find_one({})
        health["modules"]["database"] = "✓ OK"
    except Exception as e:
        health["modules"]["database"] = f"✗ ERROR: {str(e)}"
        health["status"] = "unhealthy"
    
    # 2. User counts
    health["counts"]["users"] = await db.users.count_documents({})
    health["counts"]["admins"] = await db.users.count_documents({"role": "admin"})
    health["counts"]["drivers"] = await db.drivers.count_documents({})
    health["counts"]["verified_drivers"] = await db.drivers.count_documents({"verified": True})
    health["counts"]["restaurants"] = await db.food_restaurants.count_documents({})
    health["counts"]["scooters"] = await db.scooters.count_documents({})
    health["counts"]["active_scooters"] = await db.scooters.count_documents({"status": {"$in": ["available", "locked"]}})
    
    # 3. Module checks
    health["modules"]["wallet"] = "✓ OK" if health["counts"]["users"] > 0 else "⚠ No users"
    health["modules"]["drivers"] = "✓ OK" if health["counts"]["drivers"] >= 0 else "✗ ERROR"
    health["modules"]["scooters"] = "✓ OK" if health["counts"]["scooters"] >= 0 else "✗ ERROR"
    health["modules"]["restaurants"] = "✓ OK" if health["counts"]["restaurants"] >= 0 else "✗ ERROR"
    
    # 4. Transaction volume
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_txs = await db.transactions.count_documents({"created_at": {"$gte": today.isoformat()}})
    health["counts"]["transactions_today"] = today_txs
    
    # 5. Pending applications
    pending_drivers = await db.driver_applications.count_documents({"status": "pending"})
    pending_restaurants = await db.restaurant_applications.count_documents({"status": "pending"})
    health["counts"]["pending_driver_applications"] = pending_drivers
    health["counts"]["pending_restaurant_applications"] = pending_restaurants
    
    if pending_drivers > 0:
        health["warnings"].append(f"{pending_drivers} Fahrer-Bewerbungen warten auf Genehmigung")
    if pending_restaurants > 0:
        health["warnings"].append(f"{pending_restaurants} Restaurant-Bewerbungen warten auf Genehmigung")
    
    # 6. Active rides/orders
    health["counts"]["active_rides"] = await db.taxi_rides.count_documents({
        "status": {"$in": ["requested", "accepted", "arriving", "in_progress"]}
    })
    health["counts"]["active_food_orders"] = await db.food_orders.count_documents({
        "status": {"$in": ["pending", "confirmed", "preparing", "ready", "picked_up"]}
    })
    
    # 7. Auctions
    health["counts"]["active_auctions"] = await db.auctions.count_documents({
        "status": "active"
    })
    
    # 8. Marketplace
    health["counts"]["active_listings"] = await db.marketplace_listings.count_documents({
        "status": "active"
    })
    
    # 9. Chat messages today
    health["counts"]["messages_today"] = await db.chat_messages.count_documents({
        "created_at": {"$gte": today.isoformat()}
    })
    
    # 10. Platform revenue today
    revenue_doc = await db.platform_revenue.find_one({"date": today.strftime("%Y-%m-%d")})
    health["counts"]["revenue_today"] = round(revenue_doc.get("total", 0) if revenue_doc else 0, 2)
    
    # Overall status
    if health["status"] == "healthy" and len(health["warnings"]) == 0:
        health["message"] = "Alle Systeme laufen einwandfrei!"
    elif health["status"] == "healthy":
        health["message"] = f"System läuft mit {len(health['warnings'])} Hinweis(en)"
    else:
        health["message"] = "System hat Probleme - bitte prüfen!"
    
    return health


@router.get("/cleanup-fake-data")
async def admin_cleanup_all_fake_data(request: Request):
    """
    Remove ALL fake/demo data from the entire system.
    Only keeps real, verified, approved data.
    Now also covers: hotels, flights, scooters, taxi drivers, food restaurants, rental cars.
    Test accounts with valid email patterns are preserved.
    """
    await require_admin(request)

    # Whitelist real test accounts (kept):
    keep_driver_emails = ["fahrer@bidblitz.com"]

    results = {}

    # 1. Taxi drivers — remove all except whitelisted test account(s)
    r = await db.drivers.delete_many({
        "email": {"$nin": keep_driver_emails},
        "$or": [
            {"verified": {"$ne": True}},
            {"is_verified": {"$ne": True}},
            {"is_demo": True},
            {"kyc_status": {"$ne": "approved"}},
        ],
    })
    results["taxi_drivers_removed"] = r.deleted_count

    # 2. Scooters — remove ALL (no real fleet exists)
    r = await db.scooters.delete_many({})
    results["scooters_removed"] = r.deleted_count

    # 3. Flights — remove ALL (no real airline integration yet)
    r = await db.flights.delete_many({})
    results["flights_removed"] = r.deleted_count

    # 4. Hotels — remove all not flagged as real
    r = await db.hotels.delete_many({"is_real": {"$ne": True}})
    results["hotels_removed"] = r.deleted_count

    # 5. Rental cars — remove ALL (no real fleet)
    r = await db.rental_cars.delete_many({})
    results["rental_cars_removed"] = r.deleted_count

    # 6. Food restaurants — keep only is_real=True
    r = await db.food_restaurants.delete_many({"is_real": {"$ne": True}})
    results["restaurants_removed"] = r.deleted_count

    # 7. Auctions — keep only real, no demo
    r = await db.auctions.delete_many({"is_demo": True})
    results["auctions_removed"] = r.deleted_count

    # 8. Marketplace listings — old inactive
    from datetime import timedelta
    cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    r = await db.marketplace_listings.delete_many({
        "status": "inactive",
        "created_at": {"$lt": cutoff},
    })
    results["listings_removed"] = r.deleted_count

    total_removed = sum(results.values())

    return {
        "ok": True,
        "total_removed": total_removed,
        "details": results,
        "message": f"Aufräumung abgeschlossen! {total_removed} Einträge entfernt."
    }



# ─── Email Dispatch Smoketest (Resend DNS-Verifikation) ───────────────────
class EmailTestRequest(BaseModel):
    to: str
    subject: Optional[str] = "BidBlitz Resend Smoketest"


@router.post("/test-email")
async def admin_test_email(req: EmailTestRequest, request: Request):
    """Admin-only: löst eine Test-Email via Resend aus. Nutzbar nach DNS-Updates."""
    await require_admin(request)
    from routes.email_service import send_email, RESEND_KEY, SENDER

    if not req.to or "@" not in req.to:
        raise HTTPException(status_code=400, detail="Ungültige Empfänger-Adresse")

    html = f"""
    <h2>Resend DNS Smoketest</h2>
    <p>Diese E-Mail wurde von der BidBlitz Backend-Instanz gesendet.</p>
    <ul>
      <li>Sender: <code>{SENDER}</code></li>
      <li>Resend-Key gesetzt: {bool(RESEND_KEY)}</li>
      <li>Zeitstempel: {datetime.now(timezone.utc).isoformat()}</li>
    </ul>
    <p>Wenn diese Mail im Posteingang erscheint, ist die DNS-Konfiguration vollständig.</p>
    """
    sent = await send_email(req.to, req.subject, html, "admin_test")
    return {
        "ok": sent,
        "via": "resend" if sent else "logged",
        "to": req.to,
        "sender": SENDER,
        "resend_configured": bool(RESEND_KEY),
        "hint": None if sent else "Resend-Antwort: Domain-Verifikation fehlt. Siehe /app/RESEND_DNS_FIX.md",
    }


@router.get("/test-email/dns-status")
async def admin_email_dns_status(request: Request):
    """Admin-only: prüft kritische DNS-Records für Resend-Setup."""
    await require_admin(request)
    import dns.resolver

    domain = "bidblitz.ae"
    checks = {}

    queries = [
        ("MX", domain),
        ("TXT", domain),
        ("TXT", f"_dmarc.{domain}"),
        ("TXT", f"resend._domainkey.{domain}"),
        ("TXT", f"send.{domain}"),
        ("MX", f"send.{domain}"),
    ]

    for rec_type, name in queries:
        key = f"{rec_type} {name}"
        try:
            ans = dns.resolver.resolve(name, rec_type)
            checks[key] = [str(r) for r in ans]
        except Exception as e:
            checks[key] = {"error": str(e)[:120]}

    spf_send = checks.get(f"TXT send.{domain}", {})
    spf_send_ok = isinstance(spf_send, list) and any("amazonses" in s for s in spf_send)
    dkim_ok = bool(checks.get(f"TXT resend._domainkey.{domain}"))

    return {
        "domain": domain,
        "checks": checks,
        "summary": {
            "dkim_published": dkim_ok and "error" not in str(checks.get(f"TXT resend._domainkey.{domain}")),
            "spf_subdomain_resend_ok": spf_send_ok,
            "all_ready": dkim_ok and spf_send_ok,
        },
        "next_step": None if spf_send_ok else "TXT-Record auf send.bidblitz.ae anlegen: 'v=spf1 include:amazonses.com ~all'",
    }
