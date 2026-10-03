"""BidBlitz Pay SDK — embeddable payment widget for 3rd-party websites.

Flow:
1. Merchant creates API key pair (pk_live_xxx / sk_live_xxx) in admin panel.
2. Merchant embeds <script src="https://bidblitz.ae/pay.js"></script> on their site.
3. Merchant JS calls BidBlitzPay.createSession({public_key, amount, currency, order_id, success_url, webhook_url})
   which server-side POSTs to /api/pay/session → returns session_id + checkout_url.
4. User redirected to /pay/checkout/{session_id} → logs in → confirms → wallet debit → redirect to success_url.
5. Webhook fired to merchant's webhook_url with HMAC signature.
"""
import os
import secrets
import hmac
import hashlib
import json
from datetime import datetime, timezone
from typing import Optional

import httpx
from bson import ObjectId
from fastapi import APIRouter, Request, HTTPException
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field

from core.security import get_current_user
from core.payment_engine import transfer_between_wallets, TransactionType

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

router = APIRouter(prefix="/api/pay", tags=["BidBlitz Pay SDK"])


# ─── MODELS ──────────────────────────────────────────────────────────────────
class CreateSessionRequest(BaseModel):
    public_key: str
    amount: float = Field(..., gt=0, le=50000)
    currency: str = "EUR"
    order_id: str = Field("", max_length=120)
    description: str = Field("", max_length=200)
    success_url: str = ""
    cancel_url: str = ""
    webhook_url: str = ""
    customer_email: str = ""
    metadata: dict = {}


class KeyPairCreate(BaseModel):
    merchant_email: str
    label: str = "Default"


# ─── HELPERS ─────────────────────────────────────────────────────────────────
def _make_pk(): return "pk_live_" + secrets.token_urlsafe(24)
def _make_sk(): return "sk_live_" + secrets.token_urlsafe(32)


import re as _re

def _slugify(s: str) -> str:
    s = (s or "").lower().strip()
    s = _re.sub(r"[äöüß]", lambda m: {"ä": "ae", "ö": "oe", "ü": "ue", "ß": "ss"}[m.group(0)], s)
    s = _re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s[:60] or "merchant"


async def _find_merchant_by_pk(pk: str):
    """Look up merchant_keys doc by public key and return it + the merchant user."""
    key_doc = await db.pay_merchant_keys.find_one({"public_key": pk, "revoked": False})
    if not key_doc:
        return None, None
    merchant = await db.users.find_one({"email": key_doc["merchant_email"]})
    return key_doc, merchant


def _sign(secret: str, payload: dict) -> str:
    msg = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode()
    return hmac.new(secret.encode(), msg, hashlib.sha256).hexdigest()


# ─── ADMIN: Create/List Merchant API Key Pairs ───────────────────────────────
@router.post("/admin/keys/create")
async def admin_create_keys(req: KeyPairCreate, request: Request):
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(403, "Nur Admins")
    merchant = await db.users.find_one({"email": req.merchant_email})
    if not merchant:
        raise HTTPException(404, "Händler nicht gefunden")
    pk = _make_pk()
    sk = _make_sk()
    doc = {
        "key_id": secrets.token_hex(8),
        "merchant_email": req.merchant_email,
        "merchant_name": merchant.get("business_name") or merchant.get("name", ""),
        "public_key": pk,
        "secret_key": sk,
        "label": req.label,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": str(user.get("_id", "")),
        "revoked": False,
        "revoked_at": None,
        "total_sessions": 0,
        "total_paid": 0.0,
    }
    await db.pay_merchant_keys.insert_one(doc)
    doc.pop("_id", None)
    return {"ok": True, "keys": doc, "note": "Secret-Key wird nur hier angezeigt. Merchant muss sie sofort speichern."}


@router.get("/admin/keys")
async def admin_list_keys(request: Request):
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(403, "Nur Admins")
    items = await db.pay_merchant_keys.find({}, {"_id": 0, "secret_key": 0}).sort("created_at", -1).to_list(200)
    return {"keys": items, "count": len(items)}


@router.post("/admin/keys/{key_id}/revoke")
async def admin_revoke_key(key_id: str, request: Request):
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(403, "Nur Admins")
    res = await db.pay_merchant_keys.update_one(
        {"key_id": key_id},
        {"$set": {"revoked": True, "revoked_at": datetime.now(timezone.utc).isoformat()}},
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Key nicht gefunden")
    return {"ok": True}


# ─── MERCHANT-FACING: Create Checkout Session ────────────────────────────────
@router.post("/session")
async def create_session(req: CreateSessionRequest, request: Request):
    key_doc, merchant = await _find_merchant_by_pk(req.public_key)
    if not key_doc:
        raise HTTPException(401, "Ungültiger oder widerrufener Public Key")
    if not merchant:
        raise HTTPException(500, "Händler-Konto nicht auffindbar")

    base = os.environ.get("PUBLIC_BASE_URL", "").rstrip("/") or str(request.base_url).rstrip("/")
    session_id = "cs_" + secrets.token_urlsafe(20)
    now = datetime.now(timezone.utc).isoformat()

    session = {
        "session_id": session_id,
        "public_key": req.public_key,
        "merchant_email": key_doc["merchant_email"],
        "merchant_name": key_doc.get("merchant_name", ""),
        "amount": round(float(req.amount), 2),
        "currency": req.currency.upper(),
        "order_id": req.order_id,
        "description": req.description,
        "success_url": req.success_url,
        "cancel_url": req.cancel_url,
        "webhook_url": req.webhook_url,
        "customer_email": req.customer_email,
        "metadata": req.metadata or {},
        "status": "pending",        # pending → paid | cancelled | expired
        "created_at": now,
        "paid_at": None,
        "paid_by": None,
        "transaction_id": None,
    }
    await db.pay_sessions.insert_one(session)
    await db.pay_merchant_keys.update_one({"key_id": key_doc["key_id"]}, {"$inc": {"total_sessions": 1}})

    return {
        "ok": True,
        "session_id": session_id,
        "checkout_url": f"{base}/pay/checkout/{session_id}",
        "status": "pending",
        "expires_in": 1800,
    }


@router.get("/session/{session_id}")
async def get_session(session_id: str):
    """Public read — used by checkout page AND merchant for polling."""
    s = await db.pay_sessions.find_one({"session_id": session_id}, {"_id": 0, "public_key": 0})
    if not s:
        raise HTTPException(404, "Session nicht gefunden")
    return s


@router.post("/session/{session_id}/confirm")
async def confirm_session(session_id: str, request: Request):
    """Authenticated user confirms one payment through the canonical wallet ledger."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    s = await db.pay_sessions.find_one({"session_id": session_id})
    if not s:
        raise HTTPException(404, "Session nicht gefunden")

    if s.get("status") == "paid":
        if str(s.get("paid_by") or "") != user_id and user.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Diese Zahlung wurde bereits von einem anderen Konto abgeschlossen")
        return {
            "ok": True,
            "status": "paid",
            "transaction_id": s.get("transaction_id"),
            "success_url": s.get("success_url", ""),
            "replayed": True,
        }
    if s.get("status") != "pending":
        raise HTTPException(400, f"Session bereits {s.get('status')}")

    created = datetime.fromisoformat(s["created_at"].replace("Z", "+00:00"))
    if (datetime.now(timezone.utc) - created).total_seconds() > 1800:
        await db.pay_sessions.update_one(
            {"session_id": session_id, "status": "pending"},
            {"$set": {"status": "expired", "expired_at": datetime.now(timezone.utc).isoformat()}},
        )
        raise HTTPException(400, "Session abgelaufen")

    merchant = await db.users.find_one({"email": s["merchant_email"]})
    if not merchant:
        raise HTTPException(500, "Händler-Konto nicht mehr auffindbar")
    merchant_id = str(merchant["_id"])
    if merchant_id == user_id:
        raise HTTPException(status_code=400, detail="Händler kann die eigene Checkout-Session nicht bezahlen")

    transfer = await transfer_between_wallets(
        from_user_id=user_id,
        to_user_id=merchant_id,
        amount=round(float(s["amount"]), 2),
        tx_type=TransactionType.MERCHANT_PAYMENT,
        description=f"BidBlitz Pay: {s.get('description') or s.get('merchant_name') or session_id}",
        reference=f"PAYSDK-{session_id[:20]}",
        metadata={
            "session_id": session_id,
            "merchant_email": s["merchant_email"],
            "order_id": s.get("order_id", ""),
            "source": "pay_sdk",
        },
        idempotency_key=f"pay-sdk:{session_id}:{user_id}",
    )
    if not transfer.success:
        raise HTTPException(status_code=400, detail=transfer.error or "Wallet-Zahlung fehlgeschlagen")

    now = datetime.now(timezone.utc).isoformat()
    claimed = await db.pay_sessions.update_one(
        {"session_id": session_id, "status": "pending"},
        {"$set": {
            "status": "paid",
            "paid_at": now,
            "paid_by": user_id,
            "paid_by_email": user.get("email", ""),
            "transaction_id": transfer.transaction_id,
            "payment_reference": transfer.reference,
        }},
    )
    if claimed.modified_count == 1:
        await db.pay_merchant_keys.update_one(
            {"public_key": s["public_key"]},
            {"$inc": {"total_paid": round(float(s["amount"]), 2)}},
        )
    else:
        fresh = await db.pay_sessions.find_one({"session_id": session_id}, {"_id": 0}) or {}
        if fresh.get("status") != "paid" or str(fresh.get("paid_by") or "") != user_id:
            raise HTTPException(status_code=409, detail="Checkout-Session wurde parallel geändert")

    if claimed.modified_count == 1 and s.get("webhook_url"):
        key_doc = await db.pay_merchant_keys.find_one({"public_key": s["public_key"]})
        if key_doc:
            payload = {
                "event": "session.paid",
                "session_id": session_id,
                "amount": s["amount"],
                "currency": s["currency"],
                "order_id": s.get("order_id", ""),
                "transaction_id": transfer.transaction_id,
                "paid_at": now,
                "customer_email": user.get("email", ""),
            }
            sig = _sign(key_doc["secret_key"], payload)
            try:
                async with httpx.AsyncClient(timeout=8) as http:
                    await http.post(s["webhook_url"], json=payload, headers={"X-BidBlitz-Signature": sig})
            except Exception:
                await db.pay_webhook_failures.insert_one({
                    "session_id": session_id,
                    "webhook_url": s["webhook_url"],
                    "payload": payload,
                    "failed_at": now,
                })

    return {
        "ok": True,
        "status": "paid",
        "transaction_id": transfer.transaction_id,
        "success_url": s.get("success_url", ""),
        "replayed": transfer.idempotent_replay or claimed.modified_count == 0,
    }


@router.post("/session/{session_id}/cancel")
async def cancel_session(session_id: str, request: Request):
    """Only the merchant owner/admin may invalidate a pending checkout session."""
    user = await get_current_user(request)
    s = await db.pay_sessions.find_one({"session_id": session_id})
    if not s:
        raise HTTPException(404, "Session nicht gefunden")
    if user.get("role") != "admin" and str(user.get("email") or "").lower() != str(s.get("merchant_email") or "").lower():
        raise HTTPException(status_code=403, detail="Nur der Händler kann diese Checkout-Session abbrechen")
    if s["status"] != "pending":
        raise HTTPException(400, f"Session bereits {s['status']}")
    result = await db.pay_sessions.update_one(
        {"session_id": session_id, "status": "pending"},
        {"$set": {"status": "cancelled", "cancelled_at": datetime.now(timezone.utc).isoformat()}},
    )
    if result.modified_count != 1:
        raise HTTPException(status_code=409, detail="Session wurde parallel geändert")
    return {"ok": True, "status": "cancelled", "cancel_url": s.get("cancel_url", "")}


# ─── MERCHANT: Own keys + sessions ───────────────────────────────────────────
@router.post("/my-keys/create")
async def merchant_create_key(payload: dict, request: Request):
    """Merchant self-service key creation. Max 5 active keys per merchant."""
    user = await get_current_user(request)
    email = user.get("email", "")
    if user.get("role") not in ("merchant", "admin"):
        raise HTTPException(403, "Nur Händler-Konten können Keys erstellen")
    active = await db.pay_merchant_keys.count_documents({"merchant_email": email, "revoked": False})
    if active >= 5:
        raise HTTPException(429, "Max. 5 aktive Keys pro Händler erreicht. Widerrufe einen, um neuen zu erstellen.")
    label = (payload or {}).get("label", "Default")[:50] or "Default"
    pk = _make_pk()
    sk = _make_sk()
    doc = {
        "key_id": secrets.token_hex(8),
        "merchant_email": email,
        "merchant_name": user.get("business_name") or user.get("name", ""),
        "public_key": pk,
        "secret_key": sk,
        "label": label,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": str(user.get("_id", "")),
        "revoked": False,
        "revoked_at": None,
        "total_sessions": 0,
        "total_paid": 0.0,
    }
    await db.pay_merchant_keys.insert_one(doc)
    doc.pop("_id", None)
    return {"ok": True, "keys": doc, "note": "Secret-Key wird nur hier einmal angezeigt — sichere ihn sofort ab!"}


@router.post("/my-keys/{key_id}/revoke")
async def merchant_revoke_key(key_id: str, request: Request):
    user = await get_current_user(request)
    k = await db.pay_merchant_keys.find_one({"key_id": key_id})
    if not k:
        raise HTTPException(404, "Key nicht gefunden")
    if k["merchant_email"] != user.get("email"):
        raise HTTPException(403, "Nicht dein Key")
    if k.get("revoked"):
        raise HTTPException(400, "Key bereits widerrufen")
    await db.pay_merchant_keys.update_one(
        {"key_id": key_id},
        {"$set": {"revoked": True, "revoked_at": datetime.now(timezone.utc).isoformat()}},
    )
    return {"ok": True}


@router.get("/my-keys")
async def my_keys(request: Request):
    user = await get_current_user(request)
    items = await db.pay_merchant_keys.find(
        {"merchant_email": user.get("email", "")},
        {"_id": 0, "secret_key": 0},
    ).sort("created_at", -1).to_list(50)
    return {"keys": items}


@router.get("/my-sessions")
async def my_sessions(request: Request, limit: int = 50):
    user = await get_current_user(request)
    items = await db.pay_sessions.find(
        {"merchant_email": user.get("email", "")},
        {"_id": 0, "public_key": 0},
    ).sort("created_at", -1).to_list(limit)
    # Revenue summary
    paid = [i for i in items if i["status"] == "paid"]
    return {
        "sessions": items,
        "summary": {
            "total": len(items),
            "paid_count": len(paid),
            "paid_amount": round(sum(i["amount"] for i in paid), 2),
            "pending_count": sum(1 for i in items if i["status"] == "pending"),
        },
    }


# ─── PUBLIC "Pay by BidBlitz" MARKETPLACE DIRECTORY ──────────────────────────
@router.get("/directory")
async def public_directory(industry: Optional[str] = None, limit: int = 60):
    """Public list of merchants accepting BidBlitz Pay. Sorted by total_paid DESC.
    Featured merchants (admin-toggled) come first."""
    # Aggregate across merchant keys: one entry per merchant_email (sum totals)
    pipeline = [
        {"$match": {"revoked": False}},
        {"$group": {
            "_id": "$merchant_email",
            "merchant_name": {"$last": "$merchant_name"},
            "total_sessions": {"$sum": "$total_sessions"},
            "total_paid": {"$sum": "$total_paid"},
            "first_created": {"$min": "$created_at"},
        }},
        {"$match": {"total_paid": {"$gt": 0}}},  # only merchants with paid sessions
        {"$sort": {"total_paid": -1}},
        {"$limit": limit},
    ]
    agg = await db.pay_merchant_keys.aggregate(pipeline).to_list(limit)

    # Enrich with user profile (industry + website + logo)
    emails = [a["_id"] for a in agg]
    users_map = {}
    if emails:
        async for u in db.users.find(
            {"email": {"$in": emails}},
            {"_id": 0, "email": 1, "industry": 1, "business_name": 1, "logo_url": 1, "website": 1, "shop_url": 1, "description": 1, "city": 1, "pay_featured": 1},
        ):
            users_map[u["email"]] = u

    out = []
    for a in agg:
        u = users_map.get(a["_id"], {})
        ind = u.get("industry") or "retail"
        if industry and ind != industry:
            continue
        shop_url = u.get("shop_url") or u.get("website") or ""
        bname = u.get("business_name") or a.get("merchant_name") or a["_id"].split("@")[0]
        out.append({
            "email": a["_id"],
            "business_name": bname,
            "slug": _slugify(f"{bname}-{u.get('city', '')}"),
            "industry": ind,
            "logo_url": u.get("logo_url") or "",
            "shop_url": shop_url,
            "description": u.get("description") or "",
            "city": u.get("city") or "",
            "featured": bool(u.get("pay_featured", False)),
            "total_sessions": a["total_sessions"],
            "total_paid": round(float(a["total_paid"]), 2),
            "since": (a.get("first_created") or "")[:10],
        })
    # Featured first, then by total_paid
    out.sort(key=lambda m: (not m["featured"], -m["total_paid"]))
    return {"merchants": out, "count": len(out)}


@router.post("/admin/feature/{email}")
async def admin_toggle_featured(email: str, request: Request):
    """Admin toggles merchant's 'pay_featured' flag on the user doc."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(403, "Nur Admins")
    u = await db.users.find_one({"email": email})
    if not u:
        raise HTTPException(404, "Händler nicht gefunden")
    new_val = not bool(u.get("pay_featured", False))
    await db.users.update_one({"email": email}, {"$set": {"pay_featured": new_val}})
    return {"ok": True, "featured": new_val}


# ─── SEO: merchant detail lookup by slug ─────────────────────────────────────
@router.get("/merchant/{slug}")
async def get_merchant_by_slug(slug: str):
    """Public — find a directory merchant by its slug (business_name-city)."""
    # Re-use directory aggregation then filter by slug match (inefficient at scale but simple)
    agg = db.pay_merchant_keys.aggregate([
        {"$match": {"revoked": False}},
        {"$group": {
            "_id": "$merchant_email",
            "merchant_name": {"$last": "$merchant_name"},
            "total_sessions": {"$sum": "$total_sessions"},
            "total_paid": {"$sum": "$total_paid"},
            "first_created": {"$min": "$created_at"},
        }},
        {"$match": {"total_paid": {"$gt": 0}}},
    ])
    async for a in agg:
        u = await db.users.find_one(
            {"email": a["_id"]},
            {"_id": 0, "email": 1, "industry": 1, "business_name": 1, "logo_url": 1,
             "website": 1, "shop_url": 1, "description": 1, "city": 1, "pay_featured": 1, "name": 1},
        ) or {}
        bname = u.get("business_name") or a.get("merchant_name") or a["_id"].split("@")[0]
        test_slug = _slugify(f"{bname}-{u.get('city', '')}")
        test_slug_noloc = _slugify(bname)
        if slug in (test_slug, test_slug_noloc):
            return {
                "email": a["_id"],
                "business_name": bname,
                "industry": u.get("industry") or "retail",
                "logo_url": u.get("logo_url") or "",
                "shop_url": u.get("shop_url") or u.get("website") or "",
                "description": u.get("description") or "",
                "city": u.get("city") or "",
                "featured": bool(u.get("pay_featured", False)),
                "total_sessions": a["total_sessions"],
                "total_paid": round(float(a["total_paid"]), 2),
                "since": (a.get("first_created") or "")[:10],
                "slug": test_slug,
            }
    raise HTTPException(404, "Händler nicht gefunden")


@router.get("/sitemap")
async def sitemap_merchants():
    """Flat list of merchant slugs for sitemap generation. Cached 1h in prod."""
    agg = db.pay_merchant_keys.aggregate([
        {"$match": {"revoked": False}},
        {"$group": {"_id": "$merchant_email", "merchant_name": {"$last": "$merchant_name"},
                    "total_paid": {"$sum": "$total_paid"},
                    "first_created": {"$min": "$created_at"}}},
        {"$match": {"total_paid": {"$gt": 0}}},
    ])
    out = []
    async for a in agg:
        u = await db.users.find_one({"email": a["_id"]}, {"business_name": 1, "city": 1, "_id": 0}) or {}
        bname = u.get("business_name") or a.get("merchant_name") or a["_id"].split("@")[0]
        slug = _slugify(f"{bname}-{u.get('city', '')}")
        out.append({"slug": slug, "updated_at": a.get("first_created", "")})
    return {"merchants": out, "count": len(out)}
