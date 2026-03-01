"""
Manufacturer/OEM Scooter Integration - Lock/Unlock/Status via Hardware API
Demo mode until real API credentials are provided
"""
import os
import time
import hmac
import hashlib
import httpx
from typing import Any, Dict, Optional
from fastapi import APIRouter, HTTPException, Depends, Request
from datetime import datetime, timezone
import uuid

from dependencies import get_current_user, get_admin_user
from config import db, logger

router = APIRouter(prefix="/oem", tags=["OEM Scooter Hardware"])


# ==================== MANUFACTURER CLIENT ====================

class ManufacturerClient:
    def __init__(self):
        self.base_url = os.getenv("MFG_BASE_URL", "").rstrip("/")
        self.auth_type = os.getenv("MFG_AUTH_TYPE", "demo").lower()
        self.api_key = os.getenv("MFG_API_KEY")
        self.token_url = os.getenv("MFG_TOKEN_URL")
        self.client_id = os.getenv("MFG_CLIENT_ID")
        self.client_secret = os.getenv("MFG_CLIENT_SECRET")
        self.timeout = float(os.getenv("MFG_TIMEOUT_SECONDS", "8"))
        self._access_token: Optional[str] = None
        self._token_expiry: float = 0.0
        self.demo_mode = not self.base_url or self.auth_type == "demo"

    async def _get_oauth_token(self) -> str:
        now = time.time()
        if self._access_token and now < self._token_expiry - 30:
            return self._access_token
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(self.token_url, data={"grant_type": "client_credentials"}, auth=(self.client_id, self.client_secret))
            resp.raise_for_status()
            data = resp.json()
            self._access_token = data["access_token"]
            self._token_expiry = now + int(data.get("expires_in", 3600))
            return self._access_token

    async def _headers(self) -> Dict[str, str]:
        if self.auth_type == "oauth2":
            token = await self._get_oauth_token()
            return {"Authorization": f"Bearer {token}", "Accept": "application/json"}
        return {"Authorization": f"ApiKey {self.api_key or 'demo'}", "Accept": "application/json"}

    async def _request(self, method: str, path: str, json=None) -> Dict[str, Any]:
        if self.demo_mode:
            return {"ok": True, "demo": True, "request_id": str(uuid.uuid4())[:8]}
        url = f"{self.base_url}{path}"
        headers = await self._headers()
        for attempt in range(3):
            try:
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    resp = await client.request(method, url, headers=headers, json=json)
                resp.raise_for_status()
                return resp.json() if resp.content else {"ok": True}
            except Exception as e:
                if attempt == 2: raise
                time.sleep(0.3 * (2 ** attempt))

    async def unlock(self, device_id: str) -> Dict: return await self._request("POST", f"/devices/{device_id}/unlock")
    async def lock(self, device_id: str) -> Dict: return await self._request("POST", f"/devices/{device_id}/lock")
    async def status(self, device_id: str) -> Dict: return await self._request("GET", f"/devices/{device_id}/status")


mfg = ManufacturerClient()


# ==================== SCOOTER HARDWARE ENDPOINTS ====================

@router.post("/scooters/{scooter_id}/unlock")
async def hw_unlock(scooter_id: str, user: dict = Depends(get_current_user)):
    scooter = await db.devices.find_one({"id": scooter_id})
    if not scooter:
        raise HTTPException(404, "Scooter nicht gefunden")
    if scooter.get("status") not in ["available", "reserved"]:
        raise HTTPException(409, "Scooter nicht verfügbar")

    mfg_id = scooter.get("manufacturer_device_id", scooter_id)
    now = datetime.now(timezone.utc).isoformat()

    try:
        resp = await mfg.unlock(mfg_id)
    except Exception as e:
        await db.scooter_commands.insert_one({"scooter_id": scooter_id, "manufacturer_device_id": mfg_id, "command": "unlock", "status": "failed", "error": str(e), "created_at": now})
        raise HTTPException(502, f"Hardware-Unlock fehlgeschlagen: {e}")

    await db.scooter_commands.insert_one({"scooter_id": scooter_id, "manufacturer_device_id": mfg_id, "command": "unlock", "status": "sent", "request_id": resp.get("request_id"), "demo": resp.get("demo", False), "created_at": now})
    await db.devices.update_one({"id": scooter_id}, {"$set": {"lock_state": "unlocked", "status": "in_use", "last_seen_at": now}})

    logger.info(f"OEM Unlock: {scooter_id} ({'DEMO' if resp.get('demo') else 'LIVE'})")
    return {"ok": True, "demo": resp.get("demo", False), "oem_response": resp}


@router.post("/scooters/{scooter_id}/lock")
async def hw_lock(scooter_id: str, user: dict = Depends(get_current_user)):
    scooter = await db.devices.find_one({"id": scooter_id})
    if not scooter:
        raise HTTPException(404, "Scooter nicht gefunden")

    mfg_id = scooter.get("manufacturer_device_id", scooter_id)
    now = datetime.now(timezone.utc).isoformat()

    try:
        resp = await mfg.lock(mfg_id)
    except Exception as e:
        await db.scooter_commands.insert_one({"scooter_id": scooter_id, "manufacturer_device_id": mfg_id, "command": "lock", "status": "failed", "error": str(e), "created_at": now})
        raise HTTPException(502, f"Hardware-Lock fehlgeschlagen: {e}")

    await db.scooter_commands.insert_one({"scooter_id": scooter_id, "manufacturer_device_id": mfg_id, "command": "lock", "status": "sent", "request_id": resp.get("request_id"), "demo": resp.get("demo", False), "created_at": now})
    await db.devices.update_one({"id": scooter_id}, {"$set": {"lock_state": "locked", "status": "available", "last_seen_at": now}})

    return {"ok": True, "demo": resp.get("demo", False), "oem_response": resp}


@router.get("/scooters/{scooter_id}/status")
async def hw_status(scooter_id: str, user: dict = Depends(get_current_user)):
    scooter = await db.devices.find_one({"id": scooter_id})
    if not scooter:
        raise HTTPException(404, "Scooter nicht gefunden")

    mfg_id = scooter.get("manufacturer_device_id", scooter_id)

    try:
        resp = await mfg.status(mfg_id)
    except Exception as e:
        raise HTTPException(502, f"Status-Abfrage fehlgeschlagen: {e}")

    update = {"last_seen_at": datetime.now(timezone.utc).isoformat()}
    if "battery" in resp: update["battery_percent"] = resp["battery"]
    if "lock_state" in resp: update["lock_state"] = resp["lock_state"]
    if "lat" in resp and "lng" in resp: update["lat"] = resp["lat"]; update["lng"] = resp["lng"]
    await db.devices.update_one({"id": scooter_id}, {"$set": update})

    return {"ok": True, "demo": resp.get("demo", False), "status": resp, "local": update}


# ==================== OEM WEBHOOK ====================

@router.post("/webhook")
async def oem_webhook(request: Request):
    raw = await request.body()
    sig = request.headers.get("X-Signature", "")
    secret = os.getenv("MFG_WEBHOOK_SECRET", "")

    if secret and sig:
        mac = hmac.new(secret.encode(), raw, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(mac, sig):
            raise HTTPException(401, "Invalid signature")

    payload = await request.json()
    event_type = payload.get("event_type")
    mfg_id = payload.get("device_id")
    now = datetime.now(timezone.utc).isoformat()

    if not mfg_id:
        raise HTTPException(400, "Missing device_id")

    scooter = await db.devices.find_one({"manufacturer_device_id": mfg_id})
    if not scooter:
        await db.oem_unmatched.insert_one({"payload": payload, "created_at": now})
        return {"ok": True, "unmatched": True}

    update = {"last_seen_at": now}
    if "battery" in payload: update["battery_percent"] = payload["battery"]
    if "lock_state" in payload: update["lock_state"] = payload["lock_state"]
    if "lat" in payload: update["lat"] = payload["lat"]
    if "lng" in payload: update["lng"] = payload["lng"]
    await db.devices.update_one({"id": scooter["id"]}, {"$set": update})

    if event_type:
        await db.scooter_commands.insert_one({
            "scooter_id": scooter["id"], "manufacturer_device_id": mfg_id,
            "command": "unlock" if "unlock" in event_type else "lock",
            "status": "success" if "success" in event_type else "failed",
            "error": payload.get("error"), "request_id": payload.get("request_id"), "created_at": now
        })

    logger.info(f"OEM Webhook: {event_type} for {mfg_id}")
    return {"ok": True}


# ==================== ADMIN: OEM CONFIG ====================

@router.get("/admin/config")
async def get_oem_config(admin: dict = Depends(get_admin_user)):
    return {
        "demo_mode": mfg.demo_mode,
        "base_url": mfg.base_url or "Nicht konfiguriert",
        "auth_type": mfg.auth_type,
        "has_api_key": bool(mfg.api_key),
        "webhook_url": "https://bidblitz.ae/api/oem/webhook"
    }

@router.get("/admin/commands")
async def get_commands(limit: int = 50, admin: dict = Depends(get_admin_user)):
    cmds = await db.scooter_commands.find({}, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return {"commands": cmds}
