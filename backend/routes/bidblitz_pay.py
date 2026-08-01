import hashlib
import hmac
import json
import os
import secrets
from datetime import datetime, timezone
from typing import Any, Dict, Optional

import httpx
from fastapi import APIRouter, Header, HTTPException, Request
from pydantic import BaseModel, Field

from core.audit import AuditEvent, get_client_info, log_audit
from core.database import db
from core.security import get_current_user

router = APIRouter(prefix="/api/bidblitz-pay", tags=["bidblitz-pay"])


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
    signature = _signature(cfg["webhook_secret"] or "mock-webhook-secret", payload)
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
    key = _build_idempotency_key(req, idempotency_key or "")
    existing = await db.bidblitz_pay_payments.find_one({"idempotency_key": key})
    if existing:
        await _write_gateway_audit("create_payment_idempotent_hit", existing["payment_id"], {"idempotency_key": key})
        return {"ok": True, "reused": True, "payment": _serialize_payment(existing)}

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
            "Idempotency-Key": key,
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
        "created_by_user_id": "",
        "created_by_email": "",
    }
    await db.bidblitz_pay_payments.insert_one(payment)
    await _write_gateway_audit("create_payment", payment_id, {"mode": mode, "idempotency_key": key})
    await log_audit(
        AuditEvent.PAYMENT_INITIATED,
        user_id="",
        email=req.customer_email,
        details={"provider": "bidblitz_pay", "payment_id": payment_id, "mode": mode, "amount": req.amount},
    )
    return {"ok": True, "reused": False, "payment": _serialize_payment(payment)}


@router.get("/payments/{payment_id}")
async def get_bidblitz_pay_payment(payment_id: str):
    payment = await _get_payment_or_404(payment_id)
    refunds = await db.bidblitz_pay_refunds.find({"payment_id": payment_id}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return {"ok": True, "payment": _serialize_payment(payment), "refunds": refunds}


@router.post("/payments/{payment_id}/confirm-mock")
async def confirm_bidblitz_pay_mock(payment_id: str, req: BidBlitzPayMockDecisionRequest, request: Request):
    payment = await _get_payment_or_404(payment_id)
    if payment.get("mode") != "mock":
        raise HTTPException(status_code=400, detail="Mock-Freigabe ist nur im Sandbox-Modus erlaubt")
    if payment.get("status") != "pending":
        raise HTTPException(status_code=400, detail=f"Zahlung ist bereits {payment.get('status')}")
    user = await get_current_user(request)
    if payment.get("customer_email") and user.get("role") != "admin" and user.get("email") != payment.get("customer_email"):
        raise HTTPException(status_code=403, detail="Diese BidBlitz-Pay-Zahlung gehört zu einem anderen Kunden")
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
    if payment.get("status") != "pending":
        raise HTTPException(status_code=400, detail=f"Zahlung ist bereits {payment.get('status')}")
    user = None
    try:
        user = await get_current_user(request)
    except Exception:
        user = None
    updated = await _mark_payment_status(
        payment_id,
        "cancelled",
        "cancelled",
        {
            "cancelled_at": _now(),
            "cancelled_by_email": user.get("email", "") if user else "",
        },
    )
    await _write_gateway_audit("cancel_payment", payment_id, {"email": user.get("email", "") if user else "guest"})
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
    if payment.get("status") not in {"paid", "partially_refunded", "refunded"}:
        raise HTTPException(status_code=400, detail="Refund ist nur für bezahlte Zahlungen möglich")
    refund_key = (idempotency_key or req.idempotency_key or f"refund_{payment_id}_{round(float(req.amount or payment.get('amount') or 0), 2)}")[:180]
    existing = await db.bidblitz_pay_refunds.find_one({"idempotency_key": refund_key}, {"_id": 0})
    if existing:
        return {"ok": True, "reused": True, "refund": existing}

    user = await get_current_user(request)
    if payment.get("customer_email") and user.get("role") != "admin" and user.get("email") != payment.get("customer_email"):
        raise HTTPException(status_code=403, detail="Keine Berechtigung für diesen Refund")
    total_amount = round(float(payment.get("amount") or 0), 2)
    refunded_total = 0.0
    async for row in db.bidblitz_pay_refunds.find({"payment_id": payment_id}, {"_id": 0, "amount": 1, "status": 1}):
        if row.get("status") in {"succeeded", "completed"}:
            refunded_total += round(float(row.get("amount") or 0), 2)
    refund_amount = round(float(req.amount or (total_amount - refunded_total)), 2)
    if refund_amount <= 0:
        raise HTTPException(status_code=400, detail="Refund-Betrag muss positiv sein")
    if refund_amount > round(total_amount - refunded_total, 2):
        raise HTTPException(status_code=400, detail="Refund-Betrag überschreitet den offenen Restbetrag")

    refund = {
        "refund_id": f"bbr_{secrets.token_urlsafe(8)}",
        "payment_id": payment_id,
        "provider_payment_id": payment.get("provider_payment_id") or "",
        "mode": payment.get("mode", "mock"),
        "amount": refund_amount,
        "currency": payment.get("currency", "EUR"),
        "reason": req.reason,
        "idempotency_key": refund_key,
        "status": "succeeded" if payment.get("mode") == "mock" else "pending",
        "requested_by_email": user.get("email", ""),
        "requested_by_user_id": str(user.get("_id", "")),
        "created_at": _now(),
        "updated_at": _now(),
        "mocked": payment.get("mode") == "mock",
    }
    await db.bidblitz_pay_refunds.insert_one(refund)
    refund.pop("_id", None)
    new_refunded_total = round(refunded_total + refund_amount, 2)
    payment_status = "refunded" if new_refunded_total >= total_amount else "partially_refunded"
    updated = await _mark_payment_status(payment_id, payment_status, payment_status, {"refunded_amount": new_refunded_total})
    await _write_gateway_audit("create_refund", payment_id, {"refund_id": refund["refund_id"], "amount": refund_amount})
    await _send_merchant_webhook(updated, "payment.refunded", {"refund_id": refund["refund_id"], "refund_amount": refund_amount})
    return {"ok": True, "reused": False, "refund": refund, "payment": _serialize_payment(updated)}


@router.post("/webhook")
async def bidblitz_pay_webhook(
    request: Request,
    x_bidblitz_pay_signature: Optional[str] = Header(default="", alias="X-BidBlitz-Pay-Signature"),
):
    payload = await request.json()
    cfg = _cfg()
    raw_secret = cfg["webhook_secret"] or "mock-webhook-secret"
    expected = _signature(raw_secret, payload)
    valid_signature = bool(x_bidblitz_pay_signature) and hmac.compare_digest(expected, x_bidblitz_pay_signature)
    event_type = payload.get("event") or payload.get("type") or "unknown"
    payment_id = payload.get("payment_id") or payload.get("paymentId") or ""
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