"""
SMM Provider API Client
Compatible with ALL major SMM panels: JAP, Peakerr, SMMKings, SMMRush, etc.
All of them use the same action-based POST API.

Configure via env:
  SMM_PROVIDER_URL (default: https://justanotherpanel.com/api/v2)
  SMM_PROVIDER_API_KEY
  SMM_MARGIN_PERCENT (default: 40 -> we take +40% margin over provider cost)
"""
import os
import logging
from typing import Optional
import httpx

logger = logging.getLogger("bidblitz.smm_provider")

SMM_PROVIDER_URL = os.environ.get("SMM_PROVIDER_URL", "https://justanotherpanel.com/api/v2")
SMM_PROVIDER_API_KEY = os.environ.get("SMM_PROVIDER_API_KEY", "")
SMM_MARGIN_PERCENT = float(os.environ.get("SMM_MARGIN_PERCENT", "40"))

# Map BidBlitz internal service_id → provider service_id
# Admin kann dieses Mapping in der DB (collection `smm_service_mapping`) überschreiben.
# Default Mapping — echte, geprüfte JustAnotherPanel Service-IDs (validiert 2026-04-18).
# Ausgewählt für: Qualität (Refill wo möglich), Min-Order ≤ 500, vernünftige Rate.
DEFAULT_SERVICE_MAPPING = {
    # Instagram
    "ig_followers_1k": 6594,        # $0.50/1k, Refill 30 Days, Max 500K
    "ig_followers_premium": 7591,   # $2.50/1k, Max 10M
    "ig_followers_real": 6272,      # $7.62/1k, REAL Turkey
    "ig_likes_1k": 8219,            # $0.15/1k, Max 150K
    "ig_likes_power": 3576,         # $0.30/1k, POWER Likes
    "ig_views_1k": 6454,            # $0.006/1k, All Videos, Max 100M
    "ig_story_views": 312,          # $0.003/1k, Max 100K
    "ig_comments": 8565,            # $0.85/1k, CUSTOM
    "ig_saves": 7672,               # $0.002/1k
    "ig_impressions": 8470,         # $0.013/1k, Auto Shares
    # TikTok
    "tt_followers_1k": 8777,        # $0.73/1k, Refill 30D
    "tt_followers_real": 8971,      # $2.00/1k, LQ
    "tt_likes_1k": 10061,           # $0.015/1k, Live Likes
    "tt_views_1k": 6871,            # $0.013/1k
    "tt_shares": 6209,              # $0.012/1k, Saves (Refill 30D)
    "tt_comments": 8734,            # $0.875/1k, Live Comments CUSTOM
    "tt_live_views": 10061,         # same as likes
    # YouTube
    "yt_subs_1k": 4395,             # $3.13/1k, HIGH DROP
    "yt_subs_real": 4395,           # fallback to subs_1k
    "yt_views_1k": 8040,            # $0.53/1k, Refill 365D
    "yt_views_retention": 2258,     # $0.054/1k, HQ Live Stream
    "yt_likes_1k": 7976,            # $0.64/1k, Short Likes Refill 30D
    "yt_watch_hours": 3891,         # $5.15/1k, Watch Time Refill 30D
    "yt_comments": 433,             # $3.89/1k, Custom
    "yt_shorts_views": 7976,        # reused likes mapping
    # Twitter/X
    "tw_followers_1k": 7724,        # $0.04/1k, Impression/New Followers
    "tw_followers_real": 7724,      # fallback
    "tw_likes_1k": 9393,            # $0.11/1k
    "tw_retweets": 8860,            # $0.125/1k
}


def is_configured() -> bool:
    return bool(SMM_PROVIDER_API_KEY)


async def _call(action: str, **kwargs) -> dict:
    """Generic call to SMM provider. All panels use same format."""
    if not SMM_PROVIDER_API_KEY:
        return {"error": "SMM_PROVIDER_API_KEY not configured"}
    payload = {"key": SMM_PROVIDER_API_KEY, "action": action, **kwargs}
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.post(SMM_PROVIDER_URL, data=payload)
        if r.status_code >= 400:
            logger.error(f"SMM provider returned {r.status_code}: {r.text[:300]}")
            return {"error": f"HTTP {r.status_code}"}
        data = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
        if "error" in data:
            logger.warning(f"SMM provider error for action {action}: {data['error']}")
        return data
    except httpx.HTTPError as e:
        logger.error(f"SMM provider request failed: {e}")
        return {"error": str(e)}


async def get_provider_service_id(internal_id: str, db=None) -> Optional[int]:
    """Look up provider service ID, checking DB override first then default mapping."""
    if db is not None:
        try:
            doc = await db.smm_service_mapping.find_one({"internal_id": internal_id}, {"_id": 0})
            if doc and doc.get("provider_service_id"):
                return int(doc["provider_service_id"])
        except Exception:
            pass
    return DEFAULT_SERVICE_MAPPING.get(internal_id)


async def place_order(internal_service_id: str, target_url: str, quantity: int, db=None) -> dict:
    """
    Place an order with the SMM provider.
    Returns {order: int, ok: True} on success or {error: str} on failure.
    """
    provider_service_id = await get_provider_service_id(internal_service_id, db)
    if not provider_service_id:
        return {"error": f"No provider mapping for service '{internal_service_id}'"}
    return await _call(
        "add",
        service=provider_service_id,
        link=target_url,
        quantity=quantity,
    )


async def get_order_status(provider_order_id: int) -> dict:
    """Get status of an order at the provider. Returns dict with status, start_count, remains, charge."""
    return await _call("status", order=provider_order_id)


async def get_balance() -> dict:
    """Get remaining provider balance (for admin monitoring)."""
    return await _call("balance")


async def get_provider_services() -> list:
    """List all services offered by the provider (for admin to discover new service IDs)."""
    result = await _call("services")
    return result if isinstance(result, list) else []
