"""
Coinbase Commerce Integration
Accepts BTC, ETH, USDC, etc. via hosted checkout and credits user wallet on confirmation.
"""
import os
import hmac
import hashlib
import json
import logging
import secrets
from datetime import datetime, timezone
from typing import Optional
import httpx
from fastapi import APIRouter, Request, HTTPException, BackgroundTasks, Depends
from pydantic import BaseModel, Field

from core.database import db
from core.security import get_current_user

logger = logging.getLogger("bidblitz.coinbase")

router = APIRouter(prefix="/api/coinbase", tags=["coinbase"])

COMMERCE_API_KEY = os.environ.get("COINBASE_COMMERCE_API_KEY", "")
COMMERCE_WEBHOOK_SECRET = os.environ.get("COINBASE_COMMERCE_WEBHOOK_SECRET", "")
COMMERCE_API_URL = "https://api.commerce.coinbase.com"


class ChargeRequest(BaseModel):
    amount: float = Field(gt=0, description="Betrag in EUR (> 0)")
    description: str = "Wallet Aufladung"


class ChargeResponse(BaseModel):
    id: str
    charge_code: str
    hosted_url: str
    amount: float
    currency: str
    status: str
    created_at: str
    expires_at: Optional[str] = None


def _frontend_url(request: Request) -> str:
    """Infer frontend URL from request origin/referer; fallback to production."""
    origin = request.headers.get("origin") or request.headers.get("referer") or ""
    if origin.startswith("http"):
        return origin.rstrip("/").split("/api")[0]
    return "https://bidblitz.ae"


@router.post("/charge", response_model=ChargeResponse)
async def create_charge(req: ChargeRequest, request: Request, user=Depends(get_current_user)):
    """Create a Coinbase Commerce charge (hosted checkout) and return hosted_url."""
    if not COMMERCE_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="Coinbase Commerce ist nicht konfiguriert. Bitte COINBASE_COMMERCE_API_KEY setzen.",
        )

    base = _frontend_url(request)
    user_id_str = str(user.get("_id") or user.get("id"))
    payload = {
        "name": "BidBlitz Wallet Aufladung",
        "description": req.description,
        "pricing_type": "fixed_price",
        "local_price": {"amount": f"{req.amount:.2f}", "currency": "EUR"},
        "redirect_url": f"{base}/wallet?crypto=success",
        "cancel_url": f"{base}/wallet?crypto=cancel",
        "metadata": {
            "user_id": user_id_str,
            "email": user.get("email", ""),
            "amount_eur": req.amount,
            "source": "bidblitz_wallet_topup",
        },
    }

    headers = {"X-CC-Api-Key": COMMERCE_API_KEY, "Content-Type": "application/json"}
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(f"{COMMERCE_API_URL}/charges", json=payload, headers=headers)
        if r.status_code >= 400:
            logger.error(f"Coinbase create charge failed: {r.status_code} {r.text[:400]}")
            raise HTTPException(status_code=502, detail="Coinbase Commerce API-Fehler")
        data = r.json().get("data", {})
    except httpx.HTTPError as e:
        logger.error(f"Coinbase HTTP error: {e}")
        raise HTTPException(status_code=502, detail="Coinbase Commerce nicht erreichbar")

    # Persist charge record
    user_id = user_id_str
    await db.crypto_charges.insert_one(
        {
            "charge_id": data["id"],
            "charge_code": data.get("code", ""),
            "user_id": user_id,
            "email": user.get("email", ""),
            "amount_eur": req.amount,
            "currency": "EUR",
            "status": "created",
            "hosted_url": data.get("hosted_url", ""),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "confirmed_at": None,
            "webhook_events": [],
        }
    )

    return ChargeResponse(
        id=data["id"],
        charge_code=data.get("code", ""),
        hosted_url=data.get("hosted_url", ""),
        amount=req.amount,
        currency="EUR",
        status=data.get("timeline", [{}])[-1].get("status", "NEW"),
        created_at=data.get("created_at", datetime.now(timezone.utc).isoformat()),
        expires_at=data.get("expires_at"),
    )


@router.get("/charges")
async def list_user_charges(user=Depends(get_current_user), limit: int = 20):
    """Liste der letzten Krypto-Aufladungen des Nutzers."""
    user_id = str(user.get("_id") or user.get("id"))
    cursor = db.crypto_charges.find({"user_id": user_id}, {"_id": 0, "webhook_events": 0}).sort(
        "created_at", -1
    ).limit(limit)
    charges = await cursor.to_list(length=limit)
    return {"charges": charges}


@router.post("/webhook")
async def coinbase_webhook(request: Request, background_tasks: BackgroundTasks):
    """
    Coinbase Commerce Webhook Endpoint.
    Verifiziert HMAC-SHA256 Signatur, bestätigt sofort mit 200 OK,
    und verarbeitet Payment asynchron.
    """
    body = await request.body()
    payload_raw = body.decode("utf-8")
    signature = request.headers.get("X-CC-Webhook-Signature", "")

    if not COMMERCE_WEBHOOK_SECRET:
        logger.error("Webhook received but COINBASE_COMMERCE_WEBHOOK_SECRET not configured")
        raise HTTPException(status_code=503, detail="Webhook secret not configured")

    # Signature check (HMAC-SHA256, HEX - Coinbase Standard)
    expected = hmac.new(
        COMMERCE_WEBHOOK_SECRET.encode("utf-8"),
        payload_raw.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(expected, signature):
        logger.warning(f"Invalid webhook signature. Expected {expected[:12]}..., got {signature[:12]}...")
        raise HTTPException(status_code=401, detail="Invalid signature")

    try:
        event = json.loads(payload_raw)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    event_type = event.get("event", {}).get("type", "")
    charge_data = event.get("event", {}).get("data", {})
    charge_id = charge_data.get("id")

    logger.info(f"Coinbase webhook: {event_type} for charge {charge_id}")

    # Ack immediately, process async
    background_tasks.add_task(_process_event, event_type, charge_id, charge_data)
    return {"status": "received", "event": event_type}


async def _process_event(event_type: str, charge_id: str, charge_data: dict):
    """Process webhook event asynchronously - idempotent wallet credit on confirm."""
    if not charge_id:
        return
    charge = await db.crypto_charges.find_one({"charge_id": charge_id})
    if not charge:
        logger.warning(f"Webhook for unknown charge {charge_id}")
        return

    # Store event for audit
    await db.crypto_charges.update_one(
        {"charge_id": charge_id},
        {"$push": {"webhook_events": {"type": event_type, "at": datetime.now(timezone.utc).isoformat()}}},
    )

    new_status = None
    if event_type == "charge:pending":
        new_status = "pending"
    elif event_type == "charge:confirmed":
        new_status = "confirmed"
    elif event_type == "charge:failed":
        new_status = "failed"
    elif event_type == "charge:delayed":
        new_status = "delayed"
    elif event_type == "charge:resolved":
        new_status = "resolved"
    else:
        return

    # Idempotency: only credit once
    if event_type == "charge:confirmed" and charge.get("status") != "confirmed":
        user_id = charge["user_id"]
        amount = float(charge["amount_eur"])

        # Credit user wallet
        await db.users.update_one({"_id": _oid(user_id)}, {"$inc": {"balance": amount}})

        # Log wallet transaction
        await db.transactions.insert_one(
            {
                "user_id": user_id,
                "type": "topup",
                "amount": amount,
                "currency": "EUR",
                "status": "completed",
                "description": "Krypto-Aufladung via Coinbase",
                "merchant_name": "Coinbase Commerce",
                "category": "topup",
                "reference": f"CB-{charge_id[:8].upper()}",
                "date": datetime.now(timezone.utc).isoformat(),
                "created_at": datetime.now(timezone.utc).isoformat(),
                "external_id": charge_id,
            }
        )

        await db.crypto_charges.update_one(
            {"charge_id": charge_id},
            {"$set": {"status": "confirmed", "confirmed_at": datetime.now(timezone.utc).isoformat()}},
        )
        logger.info(f"✅ Credited {amount}€ to user {user_id} from Coinbase charge {charge_id}")
        return

    # All other status updates
    await db.crypto_charges.update_one(
        {"charge_id": charge_id}, {"$set": {"status": new_status}}
    )


def _oid(s):
    """Safe ObjectId conversion or string fallback."""
    try:
        from bson import ObjectId
        return ObjectId(s)
    except Exception:
        return s


@router.get("/status")
async def integration_status():
    """Public endpoint to check if Coinbase Commerce is configured."""
    return {
        "configured": bool(COMMERCE_API_KEY and COMMERCE_WEBHOOK_SECRET),
        "api_key_present": bool(COMMERCE_API_KEY),
        "webhook_secret_present": bool(COMMERCE_WEBHOOK_SECRET),
    }
