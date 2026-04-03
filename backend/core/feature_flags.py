"""
BidBlitz V2 - Feature Flags System
Centralized soft-launch controls for staged rollout.
"""

from core.database import db
from datetime import datetime, timezone

# Default flags - used when DB has no entry yet
DEFAULT_FLAGS = {
    "onboarding": {"enabled": True, "access": "all", "label": "Onboarding Flow"},
    "merchant_payouts": {"enabled": True, "access": "all", "label": "Merchant Payouts"},
    "admin_tools": {"enabled": True, "access": "admin", "label": "Admin Tools"},
    "referral": {"enabled": True, "access": "all", "label": "Referral System"},
    "promotions": {"enabled": True, "access": "admin", "label": "Promotions"},
    "support_center": {"enabled": True, "access": "all", "label": "Support Center"},
    "activity_feed": {"enabled": True, "access": "all", "label": "Activity Feed"},
    "kids": {"enabled": True, "access": "all", "label": "BidBlitz Kids"},
    "scanner": {"enabled": True, "access": "all", "label": "Barcode Scanner"},
    "export": {"enabled": True, "access": "all", "label": "Data Export"},
}

# Access levels: "all", "admin", "beta", "merchant"

async def get_all_flags():
    """Get all feature flags from DB, seeding defaults if missing."""
    doc = await db.feature_flags.find_one({"_id": "config"}, {"_id": 0})
    if not doc:
        await db.feature_flags.update_one(
            {"_id": "config"},
            {"$set": {**DEFAULT_FLAGS, "updated_at": datetime.now(timezone.utc).isoformat()}},
            upsert=True,
        )
        return DEFAULT_FLAGS
    doc.pop("updated_at", None)
    return doc


async def get_flag(flag_name):
    """Get a single feature flag."""
    flags = await get_all_flags()
    return flags.get(flag_name, {"enabled": False, "access": "all", "label": flag_name})


async def update_flag(flag_name, enabled=None, access=None):
    """Update a single feature flag."""
    update = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if enabled is not None:
        update[f"{flag_name}.enabled"] = enabled
    if access is not None:
        update[f"{flag_name}.access"] = access
    await db.feature_flags.update_one({"_id": "config"}, {"$set": update}, upsert=True)
    return await get_flag(flag_name)


async def check_feature_access(flag_name, user_role="user"):
    """Check if a user with given role can access a feature. Returns (allowed, flag_data)."""
    flag = await get_flag(flag_name)
    if not flag.get("enabled", False):
        return False, flag
    access = flag.get("access", "all")
    if access == "all":
        return True, flag
    if access == "admin" and user_role == "admin":
        return True, flag
    if access == "merchant" and user_role in ("merchant", "admin"):
        return True, flag
    if access == "beta" and user_role in ("admin", "beta"):
        return True, flag
    return False, flag
