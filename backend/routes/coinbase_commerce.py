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
from datetime import datetime, timezone, timedelta
from typing import Optional
import httpx
from fastapi import APIRouter, Request, HTTPException, Depends
from pydantic import BaseModel, Field

from core.database import db
from core.security import get_current_user
from core.payment_engine import credit_wallet, TransactionType

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
async def coinbase_webhook(request: Request):
    """
    Coinbase Commerce Webhook Endpoint.
    Verifiziert HMAC-SHA256 und verarbeitet Settlement vor der 2xx-Antwort,
    damit Provider-Retries einen Prozessabbruch sicher wieder aufnehmen können.
    """
    body = await request.body()
    payload_raw = body.decode("utf-8")
    signature = request.headers.get("X-CC-Webhook-Signature", "")

    if not COMMERCE_WEBHOOK_SECRET:
        logger.error("Webhook received but COINBASE_COMMERCE_WEBHOOK_SECRET not configured")
        raise HTTPException(status_code=503, detail="Webhook secret not configured")

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
    await _process_event(event_type, charge_id, charge_data)
    return {"status": "processed", "event": event_type}


async def _process_event(event_type: str, charge_id: str, charge_data: dict):
    """Process webhook event asynchronously - idempotent wallet credit on confirm."""
    if not charge_id:
        return
    charge = await db.crypto_charges.find_one({"charge_id": charge_id})
    if not charge:
        logger.warning(f"Webhook for unknown charge {charge_id}")
        return

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

    if event_type == "charge:confirmed":
        current = await db.crypto_charges.find_one({"charge_id": charge_id}, {"_id": 0}) or charge
        settlement_state = str(current.get("settlement_status") or "")
        if settlement_state == "completed":
            return
        if settlement_state in {"pending", "reconciliation_required"}:
            return

        if settlement_state == "processing":
            old_started = current.get("settlement_started_at")
            started_dt = None
            if old_started:
                try:
                    started_dt = datetime.fromisoformat(str(old_started).replace("Z", "+00:00"))
                    if started_dt.tzinfo is None:
                        started_dt = started_dt.replace(tzinfo=timezone.utc)
                except Exception:
                    started_dt = None
            if started_dt and started_dt > datetime.now(timezone.utc) - timedelta(minutes=5):
                return

            attempt = int(current.get("settlement_attempt", 1) or 1)
            reclaimed = await db.crypto_charges.update_one(
                {
                    "charge_id": charge_id,
                    "settlement_status": "processing",
                    "settlement_attempt": attempt,
                    "settlement_started_at": old_started,
                },
                {
                    "$set": {
                        "settlement_started_at": datetime.now(timezone.utc).isoformat(),
                        "settlement_recovered_at": datetime.now(timezone.utc).isoformat(),
                    },
                    "$inc": {"settlement_recovery_count": 1},
                },
            )
            if reclaimed.modified_count != 1:
                return
            claimed_charge = await db.crypto_charges.find_one({"charge_id": charge_id}, {"_id": 0}) or current
        else:
            claim_filter = {
                "charge_id": charge_id,
                "settlement_status": {"$nin": ["completed", "pending", "reconciliation_required", "processing"]},
            }
            if "settlement_status" not in current:
                claim_filter = {
                    "charge_id": charge_id,
                    "$or": [
                        {"settlement_status": {"$exists": False}},
                        {"settlement_status": {"$nin": ["completed", "pending", "reconciliation_required", "processing"]}},
                    ],
                }
            claimed = await db.crypto_charges.update_one(
                claim_filter,
                {
                    "$set": {
                        "settlement_status": "processing",
                        "settlement_started_at": datetime.now(timezone.utc).isoformat(),
                    },
                    "$inc": {"settlement_attempt": 1},
                },
            )
            if claimed.modified_count != 1:
                return
            claimed_charge = await db.crypto_charges.find_one({"charge_id": charge_id}, {"_id": 0}) or current
            attempt = int(claimed_charge.get("settlement_attempt", 1) or 1)
        user_id = claimed_charge["user_id"]
        amount = float(claimed_charge["amount_eur"])

        result = await credit_wallet(
            user_id=user_id,
            amount=amount,
            tx_type=TransactionType.TOPUP,
            description="Krypto-Aufladung via Coinbase",
            source="coinbase_commerce",
            reference=f"CB-{charge_id[:8].upper()}",
            metadata={
                "external_id": charge_id,
                "provider": "coinbase_commerce",
                "route": "coinbase_commerce.webhook",
                "audit_metadata": {"kind": "coinbase_wallet_topup"},
                "settlement_attempt": attempt,
            },
            idempotency_key=f"coinbase_charge:{charge_id}:attempt:{attempt}",
        )
        if not result.success:
            result_state = str(getattr(result.status, "value", result.status))
            next_state = (
                "reconciliation_required"
                if result_state in {"pending", "reconciliation_required"}
                else "failed"
            )
            await db.crypto_charges.update_one(
                {"charge_id": charge_id, "settlement_status": "processing", "settlement_attempt": attempt},
                {"$set": {
                    "settlement_status": next_state,
                    "settlement_error": result.error or "Wallet settlement failed",
                    "settlement_checked_at": datetime.now(timezone.utc).isoformat(),
                    "wallet_transaction_id": result.transaction_id,
                }},
            )
            logger.error("Coinbase wallet settlement failed for charge %s: %s", charge_id, result.error)
            return

        finalized = await db.crypto_charges.update_one(
            {"charge_id": charge_id, "settlement_status": "processing", "settlement_attempt": attempt},
            {"$set": {
                "status": "confirmed",
                "confirmed_at": datetime.now(timezone.utc).isoformat(),
                "settlement_status": "completed",
                "settlement_error": None,
                "settlement_checked_at": datetime.now(timezone.utc).isoformat(),
                "wallet_transaction_id": result.transaction_id,
                "wallet_reference": result.reference,
            }},
        )
        if finalized.modified_count != 1:
            current = await db.crypto_charges.find_one({"charge_id": charge_id}, {"_id": 0}) or {}
            if current.get("settlement_status") != "completed":
                await db.crypto_charges.update_one(
                    {"charge_id": charge_id},
                    {"$set": {
                        "settlement_status": "reconciliation_required",
                        "settlement_error": "wallet_credited_charge_finalize_failed",
                        "wallet_transaction_id": result.transaction_id,
                        "wallet_reference": result.reference,
                        "settlement_checked_at": datetime.now(timezone.utc).isoformat(),
                    }},
                )
                logger.error("Coinbase wallet credited but charge finalization needs reconciliation: %s", charge_id)
                return
        logger.info("Credited %s EUR to user %s from Coinbase charge %s", amount, user_id, charge_id)
        return

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
