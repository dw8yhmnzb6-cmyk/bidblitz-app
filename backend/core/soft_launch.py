"""
BidBlitz V2 - Soft Launch Module
Controls invite-only access, tracks real-time activity metrics.
"""

from datetime import datetime, timezone, timedelta
from core.database import db
import logging

logger = logging.getLogger("bidblitz.softlaunch")

SOFT_LAUNCH_CONFIG_KEY = "soft_launch"


async def get_soft_launch_config():
    """Get soft launch config from DB, create default if missing."""
    config = await db.platform_config.find_one({"key": SOFT_LAUNCH_CONFIG_KEY}, {"_id": 0})
    if not config:
        config = {
            "key": SOFT_LAUNCH_CONFIG_KEY,
            "enabled": True,
            "whitelist": [],
            "allow_existing_users": True,
            "registration_open": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.platform_config.insert_one(config)
        config.pop("_id", None)
    return config


async def is_soft_launch_active():
    config = await get_soft_launch_config()
    return config.get("enabled", False)


async def is_email_whitelisted(email: str):
    """Check if email is allowed during soft launch."""
    config = await get_soft_launch_config()
    if not config.get("enabled", False):
        return True  # Soft launch off = everyone allowed
    email = email.lower().strip()
    whitelist = [e.lower().strip() for e in config.get("whitelist", [])]
    if email in whitelist:
        return True
    if config.get("allow_existing_users", True):
        existing = await db.users.find_one({"email": email})
        if existing:
            return True
    return False


async def is_registration_open():
    config = await get_soft_launch_config()
    if not config.get("enabled", False):
        return True
    return config.get("registration_open", False)
