import asyncio
import hashlib
import hmac
import ipaddress
import json
import os
import secrets
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, Header, HTTPException, Request
from pydantic import BaseModel, Field

from core.audit import AuditEvent, get_client_info, log_audit
from core.database import db
from core.security import get_current_user

router = APIRouter(prefix="/api/bidblitz-pay", tags=["bidblitz-pay"])

_bidblitz_pay_index_lock = asyncio.Lock()
_bidblitz_pay_indexes_ready = False


class BidBlitzPayCreateRequest(BaseModel):
    amount: float = Field(..., gt=0, le=50000)
    currency: str = Field("EUR", min_length=3, max_length=6)
    order_id: str = Field("", max_length=120)
    description: str = Field("", max_length=240)
    success_url: str = Field("", max_length=500)
    cancel_url: str = Field("", max_length=500)
    webhook_url: str = Field("", max_length=500)
    customer_email: str = Field("", max_length=190)
    metadata: Dict[str, Any] = Field(default_factory=dict)
    idempotency_key: Optional[str] = Field(None, max_length=180)
    redirect_preference: str = Field("app_or_wallet", max_length=40)


class BidBlitzPayMockDecisionRequest(BaseModel):
    approval_method: str = Field("wallet", max_length=40)


class BidBlitzPayRefundRequest(BaseModel):
    amount: Optional[float] = Field(None, gt=0, le=50000)
    reason: str = Field("", max_length=240)
    idempotency_key: Optional[str] = Field(None, max_length=180)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _cfg() -> Dict[str, str]:
    return {
        "api_url": (os.environ.get("BIDBLITZ_PAY_API_URL") or "").strip(),
        "api_key": (os.environ.get("BIDBLITZ_PAY_API_KEY") or "").strip(),
        "merchant_id": (os.environ.get("BIDBLITZ_PAY_MERCHANT_ID") or "").strip(),
        "webhook_secret": (os.environ.get("BIDBLITZ_PAY_WEBHOOK_SECRET") or "").strip(),
    }


def _mode(cfg: Dict[str, str]) -> str:
    required = (cfg["api_url"], cfg["api_key"], cfg["merchant_id"], cfg["webhook_secret"])
    return "live" if all(required) else "mock"


def _signature(secret: str, payload: Dict[str, Any]) -> str:
    raw = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode()
    return hmac.new(secret.encode(), raw, hashlib.sha256).hexdigest()


def _build_idempotency_key(req: BidBlitzPayCreateRequest, header_key: str = "") -> str:
    if header_key:
        return header_key[:180]
    if req.idempotency_key:
        return req.idempotency_key[:180]
    base = {
        "amount": round(float(req.amount), 2),
        "currency": req.currency.upper(),
        "order_id": req.order_id,
        "description": req.description,
        "customer_email": req.customer_email,
        "success_url": req.success_url,
        "cancel_url": req.cancel_url,
        "webhook_url": req.webhook_url,
    }
    return "bbp_" + hashlib.sha256(json.dumps(base, sort_keys=True).encode()).hexdigest()[:32]


def _normalized_email(value: Any) -> str:
    return str(value or "").strip().lower()


def _payment_request_fingerprint(req: BidBlitzPayCreateRequest) -> str:
    payload = {
        "amount": round(float(req.amount), 2),
        "currency": req.currency.upper(),
        "order_id": req.order_id,
        "description": req.description,
        "success_url": req.success_url,
        "cancel_url": req.cancel_url,
        "webhook_url": req.webhook_url,
        "customer_email": _normalized_email(req.customer_email),
        "metadata": req.metadata or {},
        "redirect_preference": req.redirect_preference,
    }
    raw = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str).encode()
    return hashlib.sha256(raw).hexdigest()


def _idempotency_scope(req: BidBlitzPayCreateRequest, actor: Optional[Dict[str, Any]]) -> str:
    if actor:
        user_id = str(actor.get("_id") or "").strip()
        if user_id:
            return f"user:{user_id}"
        actor_email = _normalized_email(actor.get("email"))
        if actor_email:
            digest = hashlib.sha256(actor_email.encode()).hexdigest()
            return f"user-email:{digest}"

    customer_email = _normalized_email(req.customer_email)
    if customer_email:
        digest = hashlib.sha256(customer_email.encode()).hexdigest()
        return f"guest-email:{digest}"

    if req.order_id:
        raw = f"{req.currency.upper()}|{req.order_id}".encode()
        return f"guest-order:{hashlib.sha256(raw).hexdigest()}"

    # Anonymous payments without an account, email or order id have no durable
    # caller identity. Scope them by the complete request instead of allowing a
    # globally reusable key that could expose another customer's payment record.
    return f"guest-request:{_payment_request_fingerprint(req)}"


def _scoped_idempotency_key(scope: str, key: str) -> str:
    digest = hashlib.sha256(f"{scope}|{key}".encode()).hexdigest()
    return f"bbp2_{digest[:48]}"


def _payment_matches_request(payment: Dict[str, Any], req: BidBlitzPayCreateRequest) -> bool:
    try:
        existing_amount = round(float(payment.get("amount") or 0), 2)
    except (TypeError, ValueError):
        return False
    return (
        existing_amount == round(float(req.amount), 2)
        and str(payment.get("currency") or "").upper() == req.currency.upper()
        and str(payment.get("order_id") or "") == req.order_id
        and _normalized_email(payment.get("customer_email")) == _normalized_email(req.customer_email)
    )


async def _ensure_bidblitz_pay_idempotency_indexes() -> None:
    global _bidblitz_pay_indexes_ready
    if _bidblitz_pay_indexes_ready:
        return

    async with _bidblitz_pay_index_lock:
        if _bidblitz_pay_indexes_ready:
            return
        try:
            await db.bidblitz_pay_payments.create_index(
                "scoped_idempotency_key",
                unique=True,
                sparse=True,
                name="uniq_bbp_scoped_idempotency",
            )
            await db.bidblitz_pay_refunds.create_index(
                [("payment_id", 1), ("idempotency_key", 1)],
                unique=True,
                name="uniq_bbp_refund_idempotency",
            )
        except Exception as exc:
            raise HTTPException(
                status_code=503,
                detail="BidBlitz-Pay-Idempotency-Schutz konnte nicht initialisiert werden",
            ) from exc
        _bidblitz_pay_indexes_ready = True


async def _optional_current_user(request: Request) -> Optional[Dict[str, Any]]:
    try:
        return await get_current_user(request)
    except HTTPException as exc:
        if exc.status_code == 401:
            return None
        raise


def _payment_access_allowed(payment: Dict[str, Any], user: Dict[str, Any]) -> bool:
    if user.get("role") == "admin":
        return True

    user_id = str(user.get("_id") or "")
    created_by_user_id = str(payment.get("created_by_user_id") or "")
    if user_id and created_by_user_id and user_id == created_by_user_id:
        return True

    user_email = _normalized_email(user.get("email"))
    customer_email = _normalized_email(payment.get("customer_email"))
    created_by_email = _normalized_email(payment.get("created_by_email"))
    if user_email and customer_email and user_email == customer_email:
        return True
    if user_email and created_by_email and user_email == created_by_email:
        return True
    return False


def _legacy_idempotency_owner_matches(
    payment: Dict[str, Any],
    actor: Optional[Dict[str, Any]],
    req: BidBlitzPayCreateRequest,
) -> bool:
    if actor:
        return _payment_access_allowed(payment, actor) and _payment_matches_request(payment, req)

    customer_email = _normalized_email(req.customer_email)
    if customer_email and customer_email == _normalized_email(payment.get("customer_email")):
        return _payment_matches_request(payment, req)

    if req.order_id and req.order_id == str(payment.get("order_id") or ""):
        return _payment_matches_request(payment, req)
    return False


def _require_payment_access(payment: Dict[str, Any], user: Dict[str, Any]) -> None:
    if not _payment_access_allowed(payment, user):
        raise HTTPException(status_code=403, detail="Keine Berechtigung für diese BidBlitz-Pay-Zahlung")


def _validate_merchant_webhook_url(webhook_url: str, user: Optional[Dict[str, Any]]) -> None:
    value = (webhook_url or "").strip()
    if not value:
        return
    if not user or user.get("role") not in {"admin", "merchant"}:
        raise HTTPException(status_code=403, detail="Webhook-URLs dürfen nur Händler oder Admins setzen")

    parsed = urlparse(value)
    hostname = (parsed.hostname or "").strip().lower()
    if parsed.scheme.lower() != "https" or not hostname:
        raise HTTPException(status_code=400, detail="Webhook-URL muss eine gültige HTTPS-URL sein")
    if hostname == "localhost" or hostname.endswith(".localhost"):
        raise HTTPException(status_code=400, detail="Lokale Webhook-Ziele sind nicht erlaubt")
    try:
        address = ipaddress.ip_address(hostname)
    except ValueError:
        address = None
    if address is not None and not address.is_global:
        raise HTTPException(status_code=400, detail="Private oder lokale Webhook-IP-Adressen sind nicht erlaubt")


async def _write_gateway_audit(action: str, payment_id: str = "", details: Optional[Dict[str, Any]] = None) -> None:
    doc = {
        "audit_id": f"bbpa_{secrets.token_hex(8)}",
        "provider": "bidblitz_pay",
        "payment_id": payment_id,
        "action": action,
        "details": details or {},
        "created_at": _now(),
    }
    await db.bidblitz_pay_audit_logs.insert_one(doc)


async def _get_payment_or_404(payment_id: str) -> Dict[str, Any]:
    payment = await db.bidblitz_pay_payments.find_one({"payment_id": payment_id})
    if not payment:
        raise HTTPException(status_code=404, detail="BidBlitz-Pay-Zahlung nicht gefunden")
    return payment


def _serialize_payment(doc: Dict[str, Any]) -> Dict[str, Any]:
    provider = doc.get("provider_response") or {}
    return {
        "payment_id": doc["payment_id"],
        "provider_payment_id": doc.get("provider_payment_id") or "",
        "mode": doc.get("mode", "mock"),
        "status": doc.get("status", "pending"),
        "provider_status": doc.get("provider_status", "pending"),
        "amount": round(float(doc.get("amount") or 0), 2),
        "currency": doc.get("currency", "EUR"),
        "order_id": doc.get("order_id", ""),
        "description": doc.get("description", ""),
        "customer_email": doc.get("customer_email", ""),
        "redirect_url": doc.get("redirect_url", ""),
        "wallet_redirect_url": doc.get("wallet_redirect_url", ""),
        "app_redirect_url": doc.get("app_redirect_url", ""),
        "success_url": doc.get("success_url", ""),
        "cancel_url": doc.get("cancel_url", ""),
        "webhook_url": doc.get("webhook_url", ""),
        "redirect_preference": doc.get("redirect_preference", "app_or_wallet"),
        "idempotency_key": doc.get("idempotency_key", ""),
        "test_mode": bool(doc.get("test_mode", False)),
        "mocked_wallet_release": bool(doc.get("mocked_wallet_release", False)),
        "created_at": doc.get("created_at"),
        "updated_at": doc.get("updated_at"),
        "approved_at": doc.get("approved_at"),
        "paid_at": doc.get("paid_at"),
        "cancelled_at": doc.get("cancelled_at"),
        "metadata": doc.get("metadata") or {},
        "provider_response": {
            "redirect_url": provider.get("redirect_url") or provider.get("redirectUrl") or "",
            "status": provider.get("status") or doc.get("provider_status", "pending"),
        },
    }


async def _send_merchant_webhook(payment: Dict[str, Any], event_type: str, extra: Optional[Dict[str, Any]] = None) -> None:
    webhook_url = (payment.get("webhook_url") or "").strip()
    if not webhook_url:
        return
    payload = {
        "event": event_type,
        "payment_id": payment["payment_id"],
        "provider_payment_id": payment.get("provider_payment_id") or "",
        "status": payment.get("status", "pending"),
        "amount": round(float(payment.get("amount") or 0), 2),
        "currency": payment.get("currency", "EUR"),
        "order_id": payment.get("order_id", ""),
        "test_mode": bool(payment.get("test_mode", False)),
        "ts": _now(),
        **(extra or {}),
    }
    cfg = _cfg()
    raw_secret = cfg["webhook_secret"]
    if not raw_secret:
        delivery = {
            "delivery_id": f"bbpwd_{secrets.token_hex(8)}",
            "payment_id": payment["payment_id"],
            "event": event_type,
            "webhook_url": webhook_url,
            "request_payload": payload,
            "signature": "",
            "attempted_at": _now(),
            "status": "failed",
            "error": "webhook_secret_missing",
        }
        await db.bidblitz_pay_webhook_deliveries.insert_one(delivery)
        await _write_gateway_audit(
            "merchant_webhook_delivery_blocked_missing_secret",
            payment["payment_id"],
            {"event": event_type},
        )
        return

    signature = _signature(raw_secret, payload)
    delivery = {
        "delivery_id": f"bbpwd_{secrets.token_hex(8)}",
        "payment_id": payment["payment_id"],
        "event": event_type,
        "webhook_url": webhook_url,
        "request_payload": payload,
        "signature": signature,
        "attempted_at": _now(),
        "status": "pending",
    }
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(
                webhook_url,
                json=payload,
                headers={"X-BidBlitz-Pay-Signature": signature, "X-BidBlitz-Pay-Mode": payment.get("mode", "mock")},
            )
        delivery["status"] = "delivered" if 200 <= response.status_code < 300 else "failed"
        delivery["response_status"] = response.status_code
        delivery["response_body"] = response.text[:500]
    except Exception as exc:
        delivery["status"] = "failed"
        delivery["error"] = str(exc)
    await db.bidblitz_pay_webhook_deliveries.insert_one(delivery)
    await _write_gateway_audit("merchant_webhook_delivery", payment["payment_id"], {"event": event_type, "status": delivery["status"]})


async def _mark_payment_status(payment_id: str, status: str, provider_status: str, extra: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    payment = await _get_payment_or_404(payment_id)
    update = {
        "status": status,
        "provider_status": provider_status,
        "updated_at": _now(),
    }
    if extra:
        update.update(extra)
    await db.bidblitz_pay_payments.update_one({"payment_id": payment_id}, {"$set": update})
    payment.update(update)
    return payment


async def _reserve_mock_refund(
    payment_id: str,
    refund_key: str,
    requested_amount: Optional[float],
) -> Dict[str, Any]:
    """Atomically reserve mock refund value on the payment document.

    The payment document is the canonical refund counter. A stable reservation field
    makes retries recoverable and the Mongo $expr guard prevents concurrent refund
    requests with different idempotency keys from exceeding the original payment.
    """
    payment = await _get_payment_or_404(payment_id)
    total_amount = round(float(payment.get("amount") or 0), 2)
    if total_amount <= 0:
        raise HTTPException(status_code=400, detail="Zahlungsbetrag ist ungültig")

    historical_refunded_total = 0.0
    async for row in db.bidblitz_pay_refunds.find(
        {"payment_id": payment_id},
        {"_id": 0, "amount": 1, "status": 1},
    ):
        if row.get("status") in {"succeeded", "completed"}:
            historical_refunded_total += round(float(row.get("amount") or 0), 2)
    historical_refunded_total = round(historical_refunded_total, 2)

    # Backfill legacy rows without ever lowering a newer concurrent reservation.
    await db.bidblitz_pay_payments.update_one(
        {"payment_id": payment_id},
        {"$max": {"refunded_amount": historical_refunded_total}},
    )
    payment = await _get_payment_or_404(payment_id)
    current_refunded = round(float(payment.get("refunded_amount") or 0), 2)
    remaining_amount = round(max(0.0, total_amount - current_refunded), 2)
    refund_amount = round(float(requested_amount if requested_amount is not None else remaining_amount), 2)
    if refund_amount <= 0:
        raise HTTPException(status_code=400, detail="Refund-Betrag muss positiv sein")

    reservation_hash = hashlib.sha256(f"{payment_id}:{refund_key}".encode()).hexdigest()
    reservation_field = f"mock_refund_reservations.{reservation_hash}"
    refund_id = f"bbr_{reservation_hash[:24]}"
    reservations = payment.get("mock_refund_reservations") or {}
    existing_reservation = reservations.get(reservation_hash)
    if existing_reservation:
        saved_amount = round(float(existing_reservation.get("amount") or 0), 2)
        if saved_amount != refund_amount:
            raise HTTPException(status_code=409, detail="Idempotency-Key wurde bereits für einen anderen Refund-Betrag verwendet")
        return {
            "payment": payment,
            "amount": saved_amount,
            "refund_id": str(existing_reservation.get("refund_id") or refund_id),
            "reservation_hash": reservation_hash,
            "reused": True,
        }

    if refund_amount > remaining_amount:
        raise HTTPException(status_code=400, detail="Refund-Betrag überschreitet den offenen Restbetrag")

    reservation = {
        "refund_id": refund_id,
        "amount": refund_amount,
        "idempotency_key": refund_key,
        "created_at": _now(),
    }
    result = await db.bidblitz_pay_payments.update_one(
        {
            "payment_id": payment_id,
            reservation_field: {"$exists": False},
            "$expr": {
                "$lte": [
                    {"$add": [{"$ifNull": ["$refunded_amount", 0]}, refund_amount]},
                    total_amount,
                ]
            },
        },
        {
            "$inc": {"refunded_amount": refund_amount},
            "$set": {
                reservation_field: reservation,
                "updated_at": _now(),
            },
        },
    )
    if result.modified_count != 1:
        fresh = await _get_payment_or_404(payment_id)
        concurrent_reservation = (fresh.get("mock_refund_reservations") or {}).get(reservation_hash)
        if concurrent_reservation:
            saved_amount = round(float(concurrent_reservation.get("amount") or 0), 2)
            if saved_amount != refund_amount:
                raise HTTPException(status_code=409, detail="Idempotency-Key wurde bereits für einen anderen Refund-Betrag verwendet")
            return {
                "payment": fresh,
                "amount": saved_amount,
                "refund_id": str(concurrent_reservation.get("refund_id") or refund_id),
                "reservation_hash": reservation_hash,
                "reused": True,
            }
        raise HTTPException(status_code=400, detail="Refund-Betrag überschreitet den offenen Restbetrag")

    fresh = await _get_payment_or_404(payment_id)
    return {
        "payment": fresh,
        "amount": refund_amount,
        "refund_id": refund_id,
        "reservation_hash": reservation_hash,
        "reused": False,
    }


async def _sync_mock_refund_status(payment_id: str, total_amount: float) -> Dict[str, Any]:
    # Full-refund is monotonic: a later partial-refund request can never downgrade it.
    await db.bidblitz_pay_payments.update_one(
        {"payment_id": payment_id, "refunded_amount": {"$gte": total_amount}},
        {"$set": {"status": "refunded", "provider_status": "refunded", "updated_at": _now()}},
    )
    await db.bidblitz_pay_payments.update_one(
        {
            "payment_id": payment_id,
            "refunded_amount": {"$gt": 0, "$lt": total_amount},
            "status": {"$ne": "refunded"},
        },
        {"$set": {"status": "partially_refunded", "provider_status": "partially_refunded", "updated_at": _now()}},
    )
    return await _get_payment_or_404(payment_id)


@router.get("/config")
async def get_bidblitz_pay_config():
    cfg = _cfg()
    mode = _mode(cfg)
    return {
        "provider": "bidblitz_pay",
        "mode": mode,
        "test_mode": mode == "mock",
        "has_api_url": bool(cfg["api_url"]),
        "has_api_key": bool(cfg["api_key"]),
        "has_merchant_id": bool(cfg["merchant_id"]),
        "has_webhook_secret": bool(cfg["webhook_secret"]),
    }


@router.post("/payments")
async def create_bidblitz_pay_payment(
    req: BidBlitzPayCreateRequest,
    request: Request,
    idempotency_key: Optional[str] = Header(default=None, alias="Idempotency-Key"),
):
    cfg = _cfg()
    mode = _mode(cfg)
    actor = await _optional_current_user(request)
    _validate_merchant_webhook_url(req.webhook_url, actor)
    await _ensure_bidblitz_pay_idempotency_indexes()

    key = _build_idempotency_key(req, idempotency_key or "")
    scope = _idempotency_scope(req, actor)
    scoped_key = _scoped_idempotency_key(scope, key)
    request_fingerprint = _payment_request_fingerprint(req)

    existing = await db.bidblitz_pay_payments.find_one({"scoped_idempotency_key": scoped_key})
    if existing:
        existing_fingerprint = str(existing.get("request_fingerprint") or "")
        if existing_fingerprint and existing_fingerprint != request_fingerprint:
            raise HTTPException(status_code=409, detail="Idempotency-Key wurde bereits für eine andere Zahlung verwendet")
        if not existing_fingerprint and not _payment_matches_request(existing, req):
            raise HTTPException(status_code=409, detail="Idempotency-Key wurde bereits für eine andere Zahlung verwendet")
        await _write_gateway_audit(
            "create_payment_idempotent_hit",
            existing["payment_id"],
            {"idempotency_scope": scope},
        )
        return {"ok": True, "reused": True, "payment": _serialize_payment(existing)}

    # Legacy rows used a global idempotency key. Reuse/backfill them only when
    # ownership and payment identity can be proven; never return another caller's row.
    legacy = await db.bidblitz_pay_payments.find_one({
        "idempotency_key": key,
        "scoped_idempotency_key": {"$exists": False},
    })
    if legacy and _legacy_idempotency_owner_matches(legacy, actor, req):
        try:
            await db.bidblitz_pay_payments.update_one(
                {"payment_id": legacy["payment_id"], "scoped_idempotency_key": {"$exists": False}},
                {"$set": {
                    "idempotency_scope": scope,
                    "scoped_idempotency_key": scoped_key,
                    "request_fingerprint": request_fingerprint,
                    "updated_at": _now(),
                }},
            )
        except Exception:
            concurrent = await db.bidblitz_pay_payments.find_one({"scoped_idempotency_key": scoped_key})
            if concurrent:
                return {"ok": True, "reused": True, "payment": _serialize_payment(concurrent)}
            raise
        legacy["idempotency_scope"] = scope
        legacy["scoped_idempotency_key"] = scoped_key
        legacy["request_fingerprint"] = request_fingerprint
        await _write_gateway_audit(
            "create_payment_legacy_idempotency_backfill",
            legacy["payment_id"],
            {"idempotency_scope": scope},
        )
        return {"ok": True, "reused": True, "payment": _serialize_payment(legacy)}

    now = _now()
    base_url = str(request.base_url).rstrip("/")
    payment_id = f"bbp_{secrets.token_urlsafe(10)}"
    app_redirect_url = f"bidblitz://bidblitz-pay/checkout/{payment_id}"
    wallet_redirect_url = f"{base_url}/wallet?bidblitzPayPaymentId={payment_id}"
    redirect_url = f"{base_url}/bidblitz-pay/checkout/{payment_id}"
    provider_response: Dict[str, Any] = {}
    provider_payment_id = ""
    provider_status = "mock_pending"

    if mode == "live":
        payload = {
            "amount": round(float(req.amount), 2),
            "currency": req.currency.upper(),
            "orderId": req.order_id,
            "description": req.description,
            "successUrl": req.success_url,
            "cancelUrl": req.cancel_url,
            "webhookUrl": req.webhook_url,
            "customerEmail": req.customer_email,
            "metadata": req.metadata or {},
            "merchantId": cfg["merchant_id"],
        }
        headers = {
            "Authorization": f"Bearer {cfg['api_key']}",
            "X-Merchant-Id": cfg["merchant_id"],
            "Idempotency-Key": scoped_key,
        }
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                response = await client.post(f"{cfg['api_url'].rstrip('/')}/api/v1/payments", json=payload, headers=headers)
            provider_response = response.json() if response.content else {}
            if not response.is_success:
                raise HTTPException(status_code=502, detail="BidBlitz-Pay-Provider konnte nicht gestartet werden")
            provider_payment_id = (
                provider_response.get("paymentId")
                or provider_response.get("id")
                or provider_response.get("payment_id")
                or payment_id
            )
            redirect_url = (
                provider_response.get("redirectUrl")
                or provider_response.get("redirect_url")
                or redirect_url
            )
            provider_status = provider_response.get("status") or "created"
        except HTTPException:
            raise
        except Exception as exc:
            await _write_gateway_audit("provider_create_failed", payment_id, {"error": str(exc)})
            raise HTTPException(status_code=502, detail="BidBlitz-Pay-Provider antwortet nicht")
    else:
        provider_payment_id = f"mock_{payment_id}"
        provider_response = {
            "redirect_url": redirect_url,
            "status": provider_status,
            "mocked": True,
            "app_redirect_url": app_redirect_url,
            "wallet_redirect_url": wallet_redirect_url,
        }

    actor_user_id = str(actor.get("_id") or "") if actor else ""
    actor_email = actor.get("email", "") if actor else ""
    payment = {
        "payment_id": payment_id,
        "provider": "bidblitz_pay",
        "provider_payment_id": provider_payment_id,
        "mode": mode,
        "test_mode": mode == "mock",
        "mocked_wallet_release": mode == "mock",
        "status": "pending",
        "provider_status": provider_status,
        "amount": round(float(req.amount), 2),
        "currency": req.currency.upper(),
        "order_id": req.order_id,
        "description": req.description,
        "success_url": req.success_url,
        "cancel_url": req.cancel_url,
        "webhook_url": req.webhook_url,
        "customer_email": req.customer_email,
        "metadata": req.metadata or {},
        "idempotency_key": key,
        "idempotency_scope": scope,
        "scoped_idempotency_key": scoped_key,
        "request_fingerprint": request_fingerprint,
        "redirect_preference": req.redirect_preference,
        "redirect_url": redirect_url,
        "app_redirect_url": app_redirect_url,
        "wallet_redirect_url": wallet_redirect_url,
        "provider_response": provider_response,
        "created_at": now,
        "updated_at": now,
        "approved_at": None,
        "paid_at": None,
        "cancelled_at": None,
        "created_by_user_id": actor_user_id,
        "created_by_email": actor_email,
    }
    try:
        await db.bidblitz_pay_payments.insert_one(payment)
    except Exception:
        # A concurrent retry can race after the initial lookup. The unique scoped
        # idempotency index makes one insert win; the loser safely reuses it.
        concurrent = await db.bidblitz_pay_payments.find_one({"scoped_idempotency_key": scoped_key})
        if concurrent:
            concurrent_fingerprint = str(concurrent.get("request_fingerprint") or "")
            if concurrent_fingerprint == request_fingerprint or (
                not concurrent_fingerprint and _payment_matches_request(concurrent, req)
            ):
                return {"ok": True, "reused": True, "payment": _serialize_payment(concurrent)}
        raise

    await _write_gateway_audit(
        "create_payment",
        payment_id,
        {"mode": mode, "idempotency_scope": scope},
    )
    await log_audit(
        AuditEvent.PAYMENT_INITIATED,
        user_id=actor_user_id,
        email=actor_email or req.customer_email,
        details={"provider": "bidblitz_pay", "payment_id": payment_id, "mode": mode, "amount": req.amount},
    )
    return {"ok": True, "reused": False, "payment": _serialize_payment(payment)}


@router.get("/payments/{payment_id}")
async def get_bidblitz_pay_payment(payment_id: str, request: Request):
    payment = await _get_payment_or_404(payment_id)
    user = await get_current_user(request)
    _require_payment_access(payment, user)
    refunds = await db.bidblitz_pay_refunds.find({"payment_id": payment_id}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return {"ok": True, "payment": _serialize_payment(payment), "refunds": refunds}


@router.post("/payments/{payment_id}/confirm-mock")
async def confirm_bidblitz_pay_mock(payment_id: str, req: BidBlitzPayMockDecisionRequest, request: Request):
    payment = await _get_payment_or_404(payment_id)
    user = await get_current_user(request)
    _require_payment_access(payment, user)
    if payment.get("mode") != "mock":
        raise HTTPException(status_code=400, detail="Mock-Freigabe ist nur im Sandbox-Modus erlaubt")
    if payment.get("status") != "pending":
        raise HTTPException(status_code=400, detail=f"Zahlung ist bereits {payment.get('status')}")
    ip, ua = get_client_info(request)
    updated = await _mark_payment_status(
        payment_id,
        "paid",
        "mock_paid",
        {
            "approved_at": _now(),
            "paid_at": _now(),
            "approved_by_user_id": str(user.get("_id", "")),
            "approved_by_email": user.get("email", ""),
            "approval_method": req.approval_method,
        },
    )
    await _write_gateway_audit("confirm_mock_payment", payment_id, {"approval_method": req.approval_method, "email": user.get("email", "")})
    await log_audit(
        AuditEvent.PAYMENT_SUCCESS,
        user_id=str(user.get("_id", "")),
        email=user.get("email", ""),
        ip=ip,
        user_agent=ua,
        details={"provider": "bidblitz_pay", "payment_id": payment_id, "mode": "mock", "approval_method": req.approval_method},
    )
    await _send_merchant_webhook(updated, "payment.paid", {"approval_method": req.approval_method})
    return {"ok": True, "payment": _serialize_payment(updated)}


@router.post("/payments/{payment_id}/cancel")
async def cancel_bidblitz_pay(payment_id: str, request: Request):
    payment = await _get_payment_or_404(payment_id)
    user = await get_current_user(request)
    _require_payment_access(payment, user)
    if payment.get("status") != "pending":
        raise HTTPException(status_code=400, detail=f"Zahlung ist bereits {payment.get('status')}")
    if payment.get("mode") == "live":
        await _write_gateway_audit(
            "live_cancel_blocked_no_provider_api",
            payment_id,
            {"requested_by": user.get("email", "")},
        )
        raise HTTPException(
            status_code=501,
            detail="Live-Cancel ist deaktiviert, bis die Provider-Cancel-API technisch integriert ist",
        )
    updated = await _mark_payment_status(
        payment_id,
        "cancelled",
        "cancelled",
        {
            "cancelled_at": _now(),
            "cancelled_by_email": user.get("email", ""),
        },
    )
    await _write_gateway_audit("cancel_payment", payment_id, {"email": user.get("email", "")})
    await _send_merchant_webhook(updated, "payment.cancelled")
    return {"ok": True, "payment": _serialize_payment(updated)}


@router.post("/payments/{payment_id}/refunds")
async def create_bidblitz_pay_refund(
    payment_id: str,
    req: BidBlitzPayRefundRequest,
    request: Request,
    idempotency_key: Optional[str] = Header(default=None, alias="Idempotency-Key"),
):
    payment = await _get_payment_or_404(payment_id)
    user = await get_current_user(request)
    _require_payment_access(payment, user)
    if payment.get("status") not in {"paid", "partially_refunded", "refunded"}:
        raise HTTPException(status_code=400, detail="Refund ist nur für bezahlte Zahlungen möglich")
    if payment.get("mode") == "live":
        await _write_gateway_audit(
            "live_refund_blocked_no_provider_api",
            payment_id,
            {"requested_by": user.get("email", "")},
        )
        raise HTTPException(
            status_code=501,
            detail="Live-Refund ist deaktiviert, bis die Provider-Refund-API technisch integriert ist",
        )

    await _ensure_bidblitz_pay_idempotency_indexes()
    refund_key = (idempotency_key or req.idempotency_key or f"refund_{payment_id}_{round(float(req.amount or payment.get('amount') or 0), 2)}")[:180]
    existing = await db.bidblitz_pay_refunds.find_one(
        {"payment_id": payment_id, "idempotency_key": refund_key},
        {"_id": 0},
    )
    if existing:
        if req.amount is not None and round(float(existing.get("amount") or 0), 2) != round(float(req.amount), 2):
            raise HTTPException(status_code=409, detail="Idempotency-Key wurde bereits für einen anderen Refund-Betrag verwendet")
        return {"ok": True, "reused": True, "refund": existing}

    reservation = await _reserve_mock_refund(payment_id, refund_key, req.amount)
    refund_amount = reservation["amount"]
    refund = {
        "refund_id": reservation["refund_id"],
        "payment_id": payment_id,
        "provider_payment_id": payment.get("provider_payment_id") or "",
        "mode": payment.get("mode", "mock"),
        "amount": refund_amount,
        "currency": payment.get("currency", "EUR"),
        "reason": req.reason,
        "idempotency_key": refund_key,
        "status": "succeeded",
        "requested_by_email": user.get("email", ""),
        "requested_by_user_id": str(user.get("_id", "")),
        "created_at": _now(),
        "updated_at": _now(),
        "mocked": True,
    }
    try:
        await db.bidblitz_pay_refunds.insert_one(refund)
    except Exception:
        concurrent = await db.bidblitz_pay_refunds.find_one(
            {"payment_id": payment_id, "idempotency_key": refund_key},
            {"_id": 0},
        )
        if concurrent:
            if round(float(concurrent.get("amount") or 0), 2) != refund_amount:
                raise HTTPException(status_code=409, detail="Idempotency-Key wurde bereits für einen anderen Refund-Betrag verwendet")
            updated = await _sync_mock_refund_status(payment_id, round(float(payment.get("amount") or 0), 2))
            return {"ok": True, "reused": True, "refund": concurrent, "payment": _serialize_payment(updated)}
        # Keep the durable payment reservation. A retry with the same key completes
        # the audit row without reserving/refunding the amount a second time.
        raise HTTPException(
            status_code=500,
            detail="Refund wurde reserviert; Finalisierung fehlgeschlagen. Mit demselben Idempotency-Key sicher erneut versuchen.",
        )
    refund.pop("_id", None)

    total_amount = round(float(payment.get("amount") or 0), 2)
    updated = await _sync_mock_refund_status(payment_id, total_amount)
    await _write_gateway_audit("create_refund", payment_id, {"refund_id": refund["refund_id"], "amount": refund_amount})
    await _send_merchant_webhook(updated, "payment.refunded", {"refund_id": refund["refund_id"], "refund_amount": refund_amount})
    return {
        "ok": True,
        "reused": bool(reservation.get("reused")),
        "refund": refund,
        "payment": _serialize_payment(updated),
    }


@router.post("/webhook")
async def bidblitz_pay_webhook(
    request: Request,
    x_bidblitz_pay_signature: Optional[str] = Header(default="", alias="X-BidBlitz-Pay-Signature"),
):
    payload = await request.json()
    cfg = _cfg()
    event_type = payload.get("event") or payload.get("type") or "unknown"
    payment_id = payload.get("payment_id") or payload.get("paymentId") or ""
    raw_secret = cfg["webhook_secret"]
    if not raw_secret:
        await _write_gateway_audit(
            "provider_webhook_rejected_missing_secret",
            payment_id,
            {"event": event_type},
        )
        raise HTTPException(
            status_code=503,
            detail="BidBlitz-Pay-Webhook ist ohne konfiguriertes Secret deaktiviert",
        )

    expected = _signature(raw_secret, payload)
    valid_signature = bool(x_bidblitz_pay_signature) and hmac.compare_digest(expected, x_bidblitz_pay_signature)
    log_doc = {
        "webhook_id": f"bbpwh_{secrets.token_hex(8)}",
        "payment_id": payment_id,
        "event": event_type,
        "payload": payload,
        "signature_received": x_bidblitz_pay_signature,
        "signature_valid": valid_signature,
        "created_at": _now(),
    }
    await db.bidblitz_pay_provider_webhooks.insert_one(log_doc)
    if not valid_signature:
        await _write_gateway_audit("provider_webhook_invalid_signature", payment_id, {"event": event_type})
        raise HTTPException(status_code=401, detail="Ungültige Webhook-Signatur")
    if not payment_id:
        raise HTTPException(status_code=400, detail="payment_id fehlt")

    if event_type in {"payment.paid", "payment.completed"}:
        updated = await _mark_payment_status(payment_id, "paid", payload.get("status") or "paid", {"paid_at": payload.get("paid_at") or _now()})
        await _send_merchant_webhook(updated, "payment.paid", {"source": "provider_webhook"})
    elif event_type in {"payment.cancelled", "payment.canceled"}:
        updated = await _mark_payment_status(payment_id, "cancelled", payload.get("status") or "cancelled", {"cancelled_at": payload.get("cancelled_at") or _now()})
        await _send_merchant_webhook(updated, "payment.cancelled", {"source": "provider_webhook"})
    elif event_type in {"payment.refunded", "refund.succeeded"}:
        updated = await _mark_payment_status(payment_id, "refunded", payload.get("status") or "refunded", {"refunded_amount": payload.get("refunded_amount") or payload.get("amount") or 0})
        await _send_merchant_webhook(updated, "payment.refunded", {"source": "provider_webhook"})
    else:
        await _write_gateway_audit("provider_webhook_unhandled", payment_id, {"event": event_type})
    return {"ok": True, "event": event_type, "payment_id": payment_id}


@router.get("/audit-logs")
async def get_bidblitz_pay_audit_logs(request: Request, payment_id: str = "", limit: int = 100):
    user = await get_current_user(request)
    if user.get("role") not in {"admin", "merchant"}:
        raise HTTPException(status_code=403, detail="Keine Berechtigung für BidBlitz-Pay-Audit-Logs")
    query = {"payment_id": payment_id} if payment_id else {}
    rows = await db.bidblitz_pay_audit_logs.find(query, {"_id": 0}).sort("created_at", -1).to_list(min(limit, 200))
    return {"ok": True, "logs": rows, "count": len(rows)}