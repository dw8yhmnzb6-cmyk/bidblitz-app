"""
BidBlitz V2 - Launch Control & Feature Flags System
Complete control for soft launch, monetization, and go-live.
"""

import secrets
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from bson import ObjectId

from core.database import db
from core.security import get_current_user

router = APIRouter(prefix="/api/launch", tags=["Launch Control"])

# ══════════════════════════════════════
# DEFAULT CONFIGURATION
# ══════════════════════════════════════

DEFAULT_CONFIG = {
    # Launch mode
    "launch_mode": "development",  # development, soft_launch, public_launch
    "maintenance_mode": False,
    "maintenance_message": "BidBlitz wird gewartet. Bitte versuche es später.",
    
    # Feature flags
    "features": {
        "auctions": True,
        "mining": True,
        "taxi": True,
        "scooter": True,
        "food": True,
        "kids": True,
        "influencer": True,
        "investor": True,
        "merchant": True,
        "payments": True,
        "payouts": True,
        "referrals": True,
        "kyc": True,
        "notifications": True,
    },
    
    # Registration
    "registration_open": False,
    "require_invite_code": True,
    "max_users_soft_launch": 1000,
    
    # Kill switches
    "kill_switches": {
        "all_payments": False,
        "stripe": False,
        "wallet_transfers": False,
        "new_orders": False,
        "new_rides": False,
    },
    
    # Version
    "app_version": "2.0.0",
    "min_supported_version": "2.0.0",
    "force_update": False,
}


# ══════════════════════════════════════
# MODELS
# ══════════════════════════════════════

class FeatureToggle(BaseModel):
    feature: str
    enabled: bool


class PricingUpdate(BaseModel):
    module: str
    key: str
    value: float


class LaunchModeUpdate(BaseModel):
    mode: str  # development, soft_launch, public_launch


# ══════════════════════════════════════
# CONFIG HELPERS
# ══════════════════════════════════════

async def get_config(key: str = None) -> Dict:
    """Get launch configuration."""
    config = await db.launch_config.find_one({"_id": "main"})
    
    if not config:
        # Initialize with defaults
        config = {"_id": "main", **DEFAULT_CONFIG}
        await db.launch_config.insert_one(config)
    
    config.pop("_id", None)
    
    if key:
        return config.get(key)
    return config


async def set_config(key: str, value: Any):
    """Set a config value."""
    await db.launch_config.update_one(
        {"_id": "main"},
        {"$set": {key: value, "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )


async def is_feature_enabled(feature: str) -> bool:
    """Check if a feature is enabled."""
    config = await get_config()
    
    # Check kill switches first
    if config.get("kill_switches", {}).get("all_payments") and feature in ["payments", "payouts", "stripe"]:
        return False
    
    # Check maintenance mode
    if config.get("maintenance_mode"):
        return False
    
    return config.get("features", {}).get(feature, True)


async def check_launch_access(user_id: str = None) -> Dict:
    """Check if user has access based on launch mode."""
    config = await get_config()
    mode = config.get("launch_mode", "development")
    
    if mode == "public_launch":
        return {"allowed": True, "mode": mode}
    
    if mode == "development":
        # Only admins in development
        if user_id:
            from bson import ObjectId
            user = await db.users.find_one({"_id": ObjectId(user_id)})
            if user and user.get("role") == "admin":
                return {"allowed": True, "mode": mode}
        return {"allowed": False, "mode": mode, "message": "App in Entwicklung"}
    
    if mode == "soft_launch":
        # Check if user has invite or is existing user
        if user_id:
            user = await db.users.find_one({"_id": ObjectId(user_id)})
            if user:
                return {"allowed": True, "mode": mode}
        
        # Check user count
        user_count = await db.users.count_documents({})
        max_users = config.get("max_users_soft_launch", 1000)
        
        if user_count >= max_users:
            return {"allowed": False, "mode": mode, "message": "Soft Launch ist voll"}
        
        return {"allowed": True, "mode": mode, "requires_invite": config.get("require_invite_code", True)}
    
    return {"allowed": False, "mode": mode}


# ══════════════════════════════════════
# PUBLIC ENDPOINTS
# ══════════════════════════════════════

@router.get("/status")
async def get_launch_status():
    """Get current launch status (public)."""
    config = await get_config()
    
    return {
        "mode": config.get("launch_mode", "development"),
        "maintenance": config.get("maintenance_mode", False),
        "maintenance_message": config.get("maintenance_message") if config.get("maintenance_mode") else None,
        "registration_open": config.get("registration_open", False),
        "require_invite": config.get("require_invite_code", True),
        "version": config.get("app_version", "2.0.0"),
        "features": {k: v for k, v in config.get("features", {}).items()},
    }


@router.get("/check-access")
async def check_access(request: Request):
    """Check if current user has access."""
    try:
        user = await get_current_user(request)
        user_id = str(user["_id"])
    except:
        user_id = None
    
    return await check_launch_access(user_id)


@router.get("/version")
async def get_version():
    """Get app version info."""
    config = await get_config()
    
    return {
        "current_version": config.get("app_version", "2.0.0"),
        "min_version": config.get("min_supported_version", "2.0.0"),
        "force_update": config.get("force_update", False),
    }


# ══════════════════════════════════════
# INVITE SYSTEM
# ══════════════════════════════════════

@router.post("/invite/generate")
async def generate_invite_codes(request: Request):
    """Admin: Generate invite codes."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    body = await request.json()
    count = min(body.get("count", 10), 100)
    
    codes = []
    for _ in range(count):
        code = f"BB-{secrets.token_hex(4).upper()}"
        await db.invite_codes.insert_one({
            "code": code,
            "created_by": str(user["_id"]),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "used": False,
            "used_by": None,
        })
        codes.append(code)
    
    return {"codes": codes, "count": len(codes)}


@router.get("/invite/list")
async def list_invite_codes(request: Request, used: bool = None):
    """Admin: List invite codes."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    query = {}
    if used is not None:
        query["used"] = used
    
    codes = await db.invite_codes.find(query, {"_id": 0}).limit(500).to_list(500)
    
    stats = {
        "total": await db.invite_codes.count_documents({}),
        "used": await db.invite_codes.count_documents({"used": True}),
        "available": await db.invite_codes.count_documents({"used": False}),
    }
    
    return {"codes": codes, "stats": stats}


@router.post("/invite/validate")
async def validate_invite_code(request: Request):
    """Validate an invite code."""
    body = await request.json()
    code = body.get("code", "").upper()
    
    invite = await db.invite_codes.find_one({"code": code, "used": False})
    
    if not invite:
        return {"valid": False, "message": "Ungültiger oder bereits verwendeter Code"}
    
    return {"valid": True}


async def use_invite_code(code: str, user_id: str) -> bool:
    """Mark invite code as used."""
    result = await db.invite_codes.update_one(
        {"code": code.upper(), "used": False},
        {"$set": {
            "used": True,
            "used_by": user_id,
            "used_at": datetime.now(timezone.utc).isoformat(),
        }}
    )
    return result.modified_count > 0


# ══════════════════════════════════════
# ADMIN CONTROLS
# ══════════════════════════════════════

@router.get("/admin/config")
async def admin_get_config(request: Request):
    """Admin: Get full config."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    return await get_config()


@router.post("/admin/mode")
async def admin_set_mode(req: LaunchModeUpdate, request: Request):
    """Admin: Set launch mode."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    if req.mode not in ["development", "soft_launch", "public_launch"]:
        raise HTTPException(status_code=400, detail="Invalid mode")
    
    await set_config("launch_mode", req.mode)
    
    # Auto-adjust settings based on mode
    if req.mode == "public_launch":
        await set_config("registration_open", True)
        await set_config("require_invite_code", False)
    elif req.mode == "soft_launch":
        await set_config("registration_open", True)
        await set_config("require_invite_code", True)
    
    # Log
    await db.audit_logs.insert_one({
        "event": "launch_mode_change",
        "admin_id": str(user["_id"]),
        "new_mode": req.mode,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })
    
    return {"ok": True, "mode": req.mode}


@router.post("/admin/feature")
async def admin_toggle_feature(req: FeatureToggle, request: Request):
    """Admin: Toggle a feature."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    config = await get_config()
    features = config.get("features", {})
    features[req.feature] = req.enabled
    
    await set_config("features", features)
    
    # Log
    await db.audit_logs.insert_one({
        "event": "feature_toggle",
        "admin_id": str(user["_id"]),
        "feature": req.feature,
        "enabled": req.enabled,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })
    
    return {"ok": True, "feature": req.feature, "enabled": req.enabled}


@router.post("/admin/maintenance")
async def admin_toggle_maintenance(request: Request):
    """Admin: Toggle maintenance mode."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    body = await request.json()
    enabled = body.get("enabled", False)
    message = body.get("message", "BidBlitz wird gewartet. Bitte versuche es später.")
    
    await set_config("maintenance_mode", enabled)
    await set_config("maintenance_message", message)
    
    return {"ok": True, "maintenance_mode": enabled}


@router.post("/admin/kill-switch")
async def admin_kill_switch(request: Request):
    """Admin: Emergency kill switch."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    body = await request.json()
    switch = body.get("switch")
    enabled = body.get("enabled", True)
    
    valid_switches = ["all_payments", "stripe", "wallet_transfers", "new_orders", "new_rides"]
    if switch not in valid_switches:
        raise HTTPException(status_code=400, detail="Invalid kill switch")
    
    config = await get_config()
    kill_switches = config.get("kill_switches", {})
    kill_switches[switch] = enabled
    
    await set_config("kill_switches", kill_switches)
    
    # Log critical action
    await db.audit_logs.insert_one({
        "event": "kill_switch_activated" if enabled else "kill_switch_deactivated",
        "admin_id": str(user["_id"]),
        "switch": switch,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })
    
    return {"ok": True, "switch": switch, "enabled": enabled}


# ══════════════════════════════════════
# REVENUE DASHBOARD
# ══════════════════════════════════════

@router.get("/admin/revenue")
async def admin_revenue_dashboard(request: Request, days: int = 30):
    """Admin: Revenue dashboard."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    now = datetime.now(timezone.utc)
    start_date = (now - timedelta(days=days)).isoformat()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    
    # Total revenue
    total_pipeline = [
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]
    total_result = await db.platform_revenue.aggregate(total_pipeline).to_list(1)
    total_revenue = total_result[0]["total"] if total_result else 0
    
    # Period revenue
    period_pipeline = [
        {"$match": {"created_at": {"$gte": start_date}}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]
    period_result = await db.platform_revenue.aggregate(period_pipeline).to_list(1)
    period_revenue = period_result[0]["total"] if period_result else 0
    
    # Today's revenue
    today_pipeline = [
        {"$match": {"created_at": {"$gte": today_start}}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]
    today_result = await db.platform_revenue.aggregate(today_pipeline).to_list(1)
    today_revenue = today_result[0]["total"] if today_result else 0
    
    # By category
    category_pipeline = [
        {"$match": {"created_at": {"$gte": start_date}}},
        {"$group": {"_id": "$category", "total": {"$sum": "$amount"}, "count": {"$sum": 1}}}
    ]
    category_result = await db.platform_revenue.aggregate(category_pipeline).to_list(100)
    by_category = {r["_id"]: {"revenue": round(r["total"], 2), "count": r["count"]} for r in category_result}
    
    # Daily breakdown
    daily_pipeline = [
        {"$match": {"created_at": {"$gte": start_date}}},
        {"$addFields": {"date": {"$substr": ["$created_at", 0, 10]}}},
        {"$group": {"_id": "$date", "total": {"$sum": "$amount"}, "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}}
    ]
    daily_result = await db.platform_revenue.aggregate(daily_pipeline).to_list(100)
    daily = [{"date": r["_id"], "revenue": round(r["total"], 2), "transactions": r["count"]} for r in daily_result]
    
    return {
        "total_revenue": round(total_revenue, 2),
        "period_revenue": round(period_revenue, 2),
        "today_revenue": round(today_revenue, 2),
        "by_category": by_category,
        "daily": daily,
        "period_days": days,
    }


# ══════════════════════════════════════
# PRICING CONTROL
# ══════════════════════════════════════

@router.get("/admin/pricing")
async def admin_get_all_pricing(request: Request):
    """Admin: Get all pricing."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    # Get all pricing configs
    configs = await db.mobility_config.find({"key": {"$regex": "^pricing_"}}, {"_id": 0}).to_list(100)
    
    pricing = {}
    for c in configs:
        module = c["key"].replace("pricing_", "")
        pricing[module] = c.get("value", {})
    
    # Add defaults for missing
    defaults = {
        "taxi": {"base_fare": 2.50, "per_km": 1.20, "per_min": 0.25, "min_fare": 5.00},
        "scooter": {"unlock_fee": 1.00, "per_minute": 0.19, "daily_cap": 15.00},
        "food": {"delivery_base": 1.99, "service_fee": 0.10, "small_order_fee": 2.00},
        "auctions": {"bid_credit_price": 0.50},
        "mining": {"starter_price": 49.00},
    }
    
    for module, default in defaults.items():
        if module not in pricing:
            pricing[module] = default
    
    return {"pricing": pricing}


@router.post("/admin/pricing")
async def admin_update_pricing(req: PricingUpdate, request: Request):
    """Admin: Update pricing."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    config_key = f"pricing_{req.module}"
    
    # Get current pricing
    current = await db.mobility_config.find_one({"key": config_key})
    pricing = current.get("value", {}) if current else {}
    
    # Update specific key
    pricing[req.key] = req.value
    
    await db.mobility_config.update_one(
        {"key": config_key},
        {"$set": {"key": config_key, "value": pricing, "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )
    
    return {"ok": True, "module": req.module, "key": req.key, "value": req.value}
