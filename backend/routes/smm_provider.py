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
# Default Mapping für JustAnotherPanel (Standard-IDs, siehe JAP Services-Liste).
DEFAULT_SERVICE_MAPPING = {
    # Instagram
    "ig_followers_1k": 5583,
    "ig_followers_premium": 5591,
    "ig_followers_real": 5608,
    "ig_likes_1k": 3024,
    "ig_likes_power": 3028,
    "ig_views_1k": 3031,
    "ig_story_views": 3036,
    "ig_comments": 3033,
    "ig_saves": 3038,
    "ig_impressions": 3037,
    # TikTok
    "tt_followers_1k": 2950,
    "tt_followers_real": 2957,
    "tt_likes_1k": 2960,
    "tt_views_1k": 2958,
    "tt_shares": 2962,
    "tt_comments": 2963,
    "tt_live_views": 2965,
    # YouTube
    "yt_subs_1k": 2875,
    "yt_subs_real": 2879,
    "yt_views_1k": 2880,
    "yt_views_retention": 2881,
    "yt_likes_1k": 2884,
    "yt_watch_hours": 2890,
    "yt_comments": 2886,
    "yt_shorts_views": 2892,
    # Twitter/X
    "tw_followers_1k": 3100,
    "tw_followers_real": 3104,
    "tw_likes_1k": 3106,
    "tw_retweets": 3108,
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
