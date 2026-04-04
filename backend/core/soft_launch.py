"""
BidBlitz V2 - Soft Launch Module
Controls invite-only access via invite codes and email whitelist.
"""

from datetime import datetime, timezone
from core.database import db
import logging
import secrets

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
        return True
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


def generate_invite_code():
    """Generate a readable 8-char invite code like BLZ-XXXX-XXXX."""
    part1 = secrets.token_hex(2).upper()
    part2 = secrets.token_hex(2).upper()
    return f"BLZ-{part1}-{part2}"


async def create_invite_codes(count: int, created_by: str, max_uses: int = 1, label: str = ""):
    """Generate batch of invite codes and store in DB."""
    now = datetime.now(timezone.utc).isoformat()
    codes = []
    for _ in range(count):
        code = generate_invite_code()
        doc = {
            "code": code,
            "max_uses": max_uses,
            "used_count": 0,
            "used_by": [],
            "label": label,
            "active": True,
            "created_by": created_by,
            "created_at": now,
        }
        await db.invite_codes.insert_one(doc)
        codes.append(code)
    return codes


async def validate_invite_code(code: str):
    """Check if an invite code is valid and has remaining uses."""
    code = code.strip().upper()
    invite = await db.invite_codes.find_one({"code": code}, {"_id": 0})
    if not invite:
        return False, "Invalid invite code"
    if not invite.get("active", True):
        return False, "Invite code is deactivated"
    if invite["used_count"] >= invite["max_uses"]:
        return False, "Invite code has been fully used"
    return True, "valid"


async def redeem_invite_code(code: str, email: str, user_id: str):
    """Mark an invite code as used by a user."""
    code = code.strip().upper()
    await db.invite_codes.update_one(
        {"code": code},
        {
            "$inc": {"used_count": 1},
            "$push": {"used_by": {"email": email, "user_id": user_id, "at": datetime.now(timezone.utc).isoformat()}},
        },
    )
