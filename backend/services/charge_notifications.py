"""BidBlitz Charge in-app notification compatibility helper.

Writes one notification document that is compatible with both legacy
notification readers currently present in BidBlitz.  No push/email/external
delivery is triggered here.
"""
from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from bson import ObjectId

from core.database import db


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _resolve_recipient(user_id: str = "", user_email: str = "") -> Dict[str, str]:
    uid = str(user_id or "").strip()
    email = str(user_email or "").strip().lower()

    user = None
    if uid:
        candidates = []
        if ObjectId.is_valid(uid):
            candidates.append({"_id": ObjectId(uid)})
        candidates.append({"_id": uid})
        for query in candidates:
            user = await db.users.find_one(query, {"_id": 1, "email": 1})
            if user:
                break
    elif email:
        user = await db.users.find_one({"email": {"$regex": f"^{email}$", "$options": "i"}}, {"_id": 1, "email": 1})

    if user:
        uid = str(user.get("_id") or uid)
        email = str(user.get("email") or email).strip().lower()

    return {"user_id": uid, "user_email": email}


async def create_charge_notification(
    *,
    event_key: str,
    title: str,
    message: str,
    action_url: str,
    user_id: str = "",
    user_email: str = "",
    notification_type: str = "system",
    category: str = "charging",
    metadata: Optional[Dict[str, Any]] = None,
) -> Optional[Dict[str, Any]]:
    """Create one retry-safe in-app Charge notification.

    Returns None when no resolvable recipient exists. Existing notifications
    are left untouched so a retry never resets read/read_at state.
    """
    recipient = await _resolve_recipient(user_id=user_id, user_email=user_email)
    if not recipient["user_id"] and not recipient["user_email"]:
        return None

    key_seed = f"{event_key}|{recipient['user_id']}|{recipient['user_email']}"
    digest = hashlib.sha256(key_seed.encode("utf-8")).hexdigest()[:24]
    notification_id = f"chg_{digest}"
    now = _now_iso()

    doc = {
        "id": notification_id,
        "notif_id": notification_id,
        "notification_key": event_key,
        "user_id": recipient["user_id"],
        "user_email": recipient["user_email"],
        "type": notification_type,
        "category": category,
        "title": str(title or "BidBlitz Charge")[:140],
        "message": str(message or "")[:1000],
        "body": str(message or "")[:1000],
        "action_url": str(action_url or "/charge-app")[:500],
        "read": False,
        "metadata": metadata or {},
        "created_at": now,
    }
    await db.notifications.update_one(
        {
            "id": notification_id,
            "notification_key": event_key,
        },
        {"$setOnInsert": doc},
        upsert=True,
    )
    return await db.notifications.find_one({"id": notification_id}, {"_id": 0})


async def safe_create_charge_notification(**kwargs) -> Optional[Dict[str, Any]]:
    """Best-effort wrapper: notifications must never break Charge business flows."""
    try:
        return await create_charge_notification(**kwargs)
    except Exception:
        return None
