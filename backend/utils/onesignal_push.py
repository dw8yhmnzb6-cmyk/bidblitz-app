"""
BidBlitz Staff - OneSignal Push Notifications
==============================================
Wrapped helper that sends pushes when notifications are created.
Gracefully no-ops if ONESIGNAL_APP_ID / ONESIGNAL_API_KEY are missing.

ENV:
  ONESIGNAL_APP_ID
  ONESIGNAL_API_KEY      (REST API Key)
"""
import os
import logging
import httpx
from typing import Optional, List, Dict

log = logging.getLogger("bidblitz.onesignal")

ONESIGNAL_APP_ID = os.getenv("ONESIGNAL_APP_ID", "")
ONESIGNAL_API_KEY = os.getenv("ONESIGNAL_API_KEY", "")
ONESIGNAL_URL = "https://onesignal.com/api/v1/notifications"


def is_configured() -> bool:
    return bool(ONESIGNAL_APP_ID and ONESIGNAL_API_KEY)


async def send_push(
    title: str,
    body: str,
    *,
    external_user_ids: Optional[List[str]] = None,
    player_ids: Optional[List[str]] = None,
    data: Optional[Dict] = None,
    url: Optional[str] = None,
) -> Dict:
    """
    Sendet eine Push-Notification via OneSignal.
    Wenn nicht konfiguriert: gibt {'sent': False, 'reason': 'not_configured'} zurück.
    """
    if not is_configured():
        return {"sent": False, "reason": "not_configured"}
    if not (external_user_ids or player_ids):
        return {"sent": False, "reason": "no_recipient"}

    payload: Dict = {
        "app_id": ONESIGNAL_APP_ID,
        "headings": {"en": title, "de": title},
        "contents": {"en": body, "de": body},
    }
    if external_user_ids:
        payload["include_external_user_ids"] = external_user_ids
    if player_ids:
        payload["include_player_ids"] = player_ids
    if data:
        payload["data"] = data
    if url:
        payload["url"] = url

    headers = {
        "Authorization": f"Basic {ONESIGNAL_API_KEY}",
        "Content-Type": "application/json",
    }
    try:
        async with httpx.AsyncClient(timeout=8.0) as ac:
            r = await ac.post(ONESIGNAL_URL, json=payload, headers=headers)
            if r.status_code >= 400:
                log.warning(f"OneSignal API {r.status_code}: {r.text[:200]}")
                return {"sent": False, "reason": f"http_{r.status_code}", "detail": r.text[:200]}
            return {"sent": True, "response": r.json()}
    except Exception as e:
        log.error(f"OneSignal send failed: {e}")
        return {"sent": False, "reason": "exception", "detail": str(e)}


async def send_to_staff(staff_id: str, title: str, body: str, **kwargs) -> Dict:
    """Kürzel: an einen einzelnen Mitarbeiter (external_user_id = staff_id)."""
    return await send_push(title, body, external_user_ids=[staff_id], **kwargs)
