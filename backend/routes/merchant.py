from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from bson import ObjectId
from datetime import datetime, timezone, timedelta
from typing import Optional
from core.database import db
from core.security import get_current_user
from core.config import FEES
from core.payment_engine import debit_wallet, TransactionType
import secrets
import logging

router = APIRouter(prefix="/api/merchant", tags=["merchant"])
logger = logging.getLogger("bidblitz.merchant")


def _slugify(value: str) -> str:
    slug = "".join(ch.lower() if ch.isalnum() else "-" for ch in value).strip("-")
    while "--" in slug:
        slug = slug.replace("--", "-")
    return slug[:60] or f"business-{secrets.token_hex(3)}"


async def _ensure_public_slug(user_id: str, business_name: str):
    merchant = await db.merchants.find_one({"user_id": user_id}, {"_id": 0, "public_slug": 1})
    if merchant and merchant.get("public_slug"):
        return merchant["public_slug"]
    slug = _slugify(business_name)
    candidate = slug
    idx = 1
    while await db.merchants.find_one({"public_slug": candidate}):
        idx += 1
        candidate = f"{slug[:54]}-{idx}"
    await db.merchants.update_one({"user_id": user_id}, {"$set": {"public_slug": candidate}}, upsert=True)
    await db.merchant_profiles.update_one({"user_id": user_id}, {"$set": {"public_slug": candidate}}, upsert=True)
    return candidate


def _as_amount(value) -> float:
    try:
        return round(float(value or 0), 2)
    except (TypeError, ValueError):
        return 0.0


async def _build_dashboard_summary(user_id: str, merchant: dict | None = None, merchant_profile: dict | None = None):
    merchant = merchant or await db.merchants.find_one({"user_id": user_id})
    merchant_profile = merchant_profile or await db.merchant_profiles.find_one({"user_id": user_id})

    merchant_refs = [user_id]
    if merchant and merchant.get("_id"):
        merchant_refs.append(str(merchant["_id"]))
    if merchant_profile and merchant_profile.get("_id"):
        merchant_refs.append(str(merchant_profile["_id"]))
    merchant_refs = list(dict.fromkeys([ref for ref in merchant_refs if ref]))

    recent = await db.merchant_transactions.find(
        {"merchant_id": {"$in": merchant_refs}},
        {"_id": 0},
    ).sort("created_at", -1).limit(10).to_list(10)

    all_merchant_txns = await db.merchant_transactions.find(
        {"merchant_id": {"$in": merchant_refs}},
        {"_id": 0},
    ).to_list(5000)

    gross_from_tx = round(sum(_as_amount(t.get("amount")) for t in all_merchant_txns if t.get("status") == "completed"), 2)
    fees_from_tx = round(sum(_as_amount(t.get("fee")) for t in all_merchant_txns if t.get("status") == "completed"), 2)
    earnings_from_tx = round(sum(_as_amount(t.get("net", _as_amount(t.get("amount")) - _as_amount(t.get("fee")))) for t in all_merchant_txns if t.get("status") == "completed"), 2)

    payouts = await db.payouts.find(
        {"user_id": user_id},
        {"_id": 0, "amount": 1, "status": 1},
    ).to_list(2000)
    pending_requested = round(sum(_as_amount(p.get("amount")) for p in payouts if p.get("status") in ("pending", "approved")), 2)
    processed_requested = round(sum(_as_amount(p.get("amount")) for p in payouts if p.get("status") == "processed"), 2)

    gross_earnings = round(max(
        _as_amount((merchant or {}).get("gross_earnings")),
        _as_amount((merchant_profile or {}).get("total_revenue")),
        gross_from_tx,
    ), 2)
    total_fees = round(max(
        _as_amount((merchant or {}).get("total_fees")),
        _as_amount((merchant_profile or {}).get("total_fees")),
        fees_from_tx,
    ), 2)
    total_earnings = round(max(
        _as_amount((merchant or {}).get("total_earnings")),
        max(_as_amount((merchant_profile or {}).get("total_revenue")) - _as_amount((merchant_profile or {}).get("total_fees")), 0.0),
        earnings_from_tx,
    ), 2)
    available_payout = round(max(total_earnings - pending_requested - processed_requested, 0.0), 2)

    return {
        "recent": recent,
        "all_merchant_txns": all_merchant_txns,
        "gross_earnings": gross_earnings,
        "total_fees": total_fees,
        "total_earnings": total_earnings,
        "available_payout": available_payout,
    }

# ══════════════════════════════════════════════════════════════════════════════
# MERCHANT PLANS & PRICING
# ══════════════════════════════════════════════════════════════════════════════

MERCHANT_PLANS = {
    "basic": {
        "name": "Basic",
        "price": 0,
        "features": [
            "Bis zu 10 Anzeigen",
            "Standard Support",
            "2.5% Transaktionsgebühr",
        ],
        "max_listings": 10,
        "fee_percent": 2.5,
        "boost_discount": 0,
    },
    "pro": {
        "name": "Pro",
        "price": 29.99,
        "features": [
            "Unbegrenzte Anzeigen",
            "Priority Support",
            "1.5% Transaktionsgebühr",
            "Gratis VIP Badge",
            "20% Boost-Rabatt",
            "Analytics Dashboard",
        ],
        "max_listings": -1,  # unlimited
        "fee_percent": 1.5,
        "boost_discount": 0.20,
        "free_vip_badge": True,
    },
}


# ══════════════════════════════════════════════════════════════════════════════
# SCHEMAS
# ══════════════════════════════════════════════════════════════════════════════

class MerchantRegisterRequest(BaseModel):
    business_name: str = Field(..., min_length=2, max_length=100)
    owner_name: str = Field(..., min_length=2, max_length=100)
    email: str
    phone: Optional[str] = None
    business_type: Optional[str] = "retail"
    description: Optional[str] = None
    address: Optional[str] = None


class QRRequest(BaseModel):
    amount: float = Field(0, ge=0, description="Fixed amount (0 = open amount)")


# ── Dashboard ──
@router.get("/dashboard")
async def get_dashboard(request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])

    merchant = await db.merchants.find_one({"user_id": user_id}, {"_id": 0})
    merchant_profile = await db.merchant_profiles.find_one({"user_id": user_id})
    if not merchant and not merchant_profile:
        return {
            "merchant_id": user_id,
            "business_name": f"{user.get('name', 'User')}'s Store",
            "gross_earnings": 0.0,
            "total_earnings": 0.0,
            "total_fees": 0.0,
            "total_transactions": 0,
            "available_payout": 0.0,
            "today_earnings": 0.0,
            "today_transactions": 0,
            "fee_percent": FEES["payment"] * 100,
            "recent_payments": [],
            "public_slug": _slugify(f"{user.get('name', 'User')}-store"),
        }

    summary = await _build_dashboard_summary(user_id, merchant, merchant_profile)
    merchant_id = user_id
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_start_str = today_start.isoformat()

    recent = summary["recent"]

    # Fallback to old transactions collection
    if not recent:
        recent = await db.transactions.find(
            {"user_id": user_id, "type": {"$in": ["merchant_credit", "payment"]}},
            {"_id": 0}
        ).sort("created_at", -1).limit(10).to_list(10)

    # Calculate today's revenue - check both string and datetime comparisons
    all_merchant_txns = summary["all_merchant_txns"]
    
    today_earnings = 0
    today_count = 0
    for t in all_merchant_txns:
        if t.get("status") != "completed":
            continue
        created = t.get("created_at", "")
        if isinstance(created, str) and created >= today_start_str:
            today_earnings += abs(t.get("net", t.get("amount", 0)))
            today_count += 1
        elif isinstance(created, datetime) and created >= today_start:
            today_earnings += abs(t.get("net", t.get("amount", 0)))
            today_count += 1

    # Fallback to transactions collection if no merchant_transactions
    if not all_merchant_txns:
        all_txns = await db.transactions.find(
            {"user_id": user_id, "type": {"$in": ["merchant_credit", "payment"]}},
            {"_id": 0}
        ).to_list(1000)
        for t in all_txns:
            if t.get("status") != "completed":
                continue
            created = t.get("created_at", "")
            if isinstance(created, str) and created >= today_start_str:
                today_earnings += abs(t.get("amount", 0))
                today_count += 1

    business_name = (merchant or {}).get("business_name") or (merchant_profile or {}).get("business_name", "")
    public_slug = await _ensure_public_slug(user_id, business_name or f"business-{user_id[:6]}")
    return {
        "merchant_id": merchant_id,
        "business_name": business_name,
        "gross_earnings": summary["gross_earnings"],
        "total_earnings": summary["total_earnings"],
        "total_fees": summary["total_fees"],
        "total_transactions": (merchant or {}).get("total_transactions", len(all_merchant_txns) if all_merchant_txns else len(recent)),
        "available_payout": summary["available_payout"],
        "today_earnings": round(today_earnings, 2),
        "today_transactions": today_count,
        "fee_percent": FEES["payment"] * 100,
        "recent_payments": recent,
        "public_slug": public_slug,
    }


@router.get("/public/{slug}")
async def get_public_merchant_page(slug: str):
    merchant = await db.merchants.find_one({"public_slug": slug}, {"_id": 0})
    if not merchant:
        profile = await db.merchant_profiles.find_one({"public_slug": slug}, {"_id": 0})
        if not profile:
            raise HTTPException(status_code=404, detail="Business nicht gefunden")
        merchant = await db.merchants.find_one({"user_id": profile.get("user_id")}, {"_id": 0}) or {}
        merchant_profile = profile
    else:
        merchant_profile = await db.merchant_profiles.find_one({"user_id": merchant.get("user_id")}, {"_id": 0}) or {}

    owner_user_id = merchant.get("user_id") or merchant_profile.get("user_id")
    business_name = merchant.get("business_name") or merchant_profile.get("business_name") or slug
    products = await db.pos_products.find({"merchant_id": merchant.get("merchant_id"), "active": True}, {"_id": 0}).sort("created_at", -1).limit(20).to_list(20)
    vouchers = await db.vouchers.find({"merchant_id": owner_user_id, "status": "active"}, {"_id": 0}).sort("created_at", -1).limit(10).to_list(10)
    promos = await db.promotions.find({"active": True, "target": {"$in": ["all", "merchants"]}}, {"_id": 0}).sort("created_at", -1).limit(10).to_list(10)
    reviews = await db.directory_reviews.find({"owner_email": merchant.get("email", "")}, {"_id": 0}).sort("created_at", -1).limit(10).to_list(10)
    return {
        "slug": slug,
        "business_name": business_name,
        "description": merchant.get("description") or merchant_profile.get("description", ""),
        "phone": merchant.get("phone") or merchant_profile.get("phone", ""),
        "email": merchant.get("email") or merchant_profile.get("email", ""),
        "website": merchant_profile.get("website", ""),
        "address": merchant.get("address") or merchant_profile.get("address", ""),
        "city": merchant_profile.get("city", ""),
        "logo_url": merchant_profile.get("logo_url", ""),
        "products": products,
        "vouchers": vouchers,
        "promotions": promos,
        "reviews": reviews,
        "qr_payment": {
            "merchant_id": merchant.get("merchant_id") or owner_user_id,
            "merchant_name": business_name,
        },
    }


# ── Generate QR Payment Data ──
@router.post("/qr")
async def generate_qr(req: QRRequest, request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])

    # Look up merchant profile
    merchant = await db.merchants.find_one({"user_id": user_id})
    if not merchant:
        # Auto-create merchant profile
        merchant_doc = {
            "user_id": user_id,
            "business_name": f"{user.get('name', 'User')}'s Store",
            "total_earnings": 0.0,
            "gross_earnings": 0.0,
            "total_fees": 0.0,
            "total_transactions": 0,
            "available_payout": 0.0,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        result = await db.merchants.insert_one(merchant_doc)
        merchant_id = str(result.inserted_id)
        business_name = merchant_doc["business_name"]
    else:
        merchant_id = str(merchant["_id"])
        business_name = merchant.get("business_name", "")

    # Generate QR payload
    qr_ref = f"QR-{secrets.token_hex(4).upper()}"
    qr_payload = {
        "type": "bidblitz_pay",
        "merchant_id": merchant_id,
        "merchant_name": business_name,
        "amount": req.amount if req.amount > 0 else None,
        "reference": qr_ref,
        "currency": "EUR",
        "fee_percent": FEES["payment"] * 100,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    return {
        "qr_data": qr_payload,
        "qr_string": f"bidblitz://pay?mid={merchant_id}&name={business_name}&amt={req.amount}&ref={qr_ref}&cur=EUR",
        "merchant_id": merchant_id,
        "merchant_name": business_name,
        "reference": qr_ref,
    }


# ── Fee Schedule ──
@router.get("/fees")
async def get_fees():
    return {
        "payment_fee_percent": FEES["payment"] * 100,
        "send_fee_percent": FEES["send"] * 100,
        "topup_fee_percent": FEES["topup"] * 100,
        "payout_flat_fee": FEES["payout_flat"],
        "min_payout": FEES["min_payout"],
    }


# ══════════════════════════════════════════════════════════════════════════════
# MERCHANT REGISTRATION
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/register")
async def register_merchant(req: MerchantRegisterRequest, request: Request):
    """
    Register as a merchant.
    Creates merchant profile and sets user role to 'merchant' (pending approval).
    """
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    # Check if already registered
    existing = await db.merchants.find_one({"user_id": user_id})
    if existing:
        if existing.get("status") == "approved":
            raise HTTPException(status_code=400, detail="Bereits als Händler registriert")
        elif existing.get("status") == "pending":
            raise HTTPException(status_code=400, detail="Registrierung wartet auf Genehmigung")
        elif existing.get("status") == "rejected":
            # Allow re-registration after rejection
            await db.merchants.delete_one({"user_id": user_id})
    
    now = datetime.now(timezone.utc)
    merchant_id = secrets.token_hex(8)
    
    merchant = {
        "merchant_id": merchant_id,
        "user_id": user_id,
        "business_name": req.business_name,
        "owner_name": req.owner_name,
        "email": req.email,
        "phone": req.phone,
        "business_type": req.business_type,
        "description": req.description,
        "address": req.address,
        "status": "pending",
        "plan": "basic",
        "plan_expires_at": None,
        "total_earnings": 0.0,
        "gross_earnings": 0.0,
        "total_fees": 0.0,
        "total_transactions": 0,
        "total_listings": 0,
        "is_verified": False,
        "is_featured": False,
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
    }
    
    await db.merchants.insert_one(merchant)
    merchant.pop("_id", None)
    
    # Update user role to merchant (pending)
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {
            "role": "merchant",
            "role_status": "pending",
            "merchant_id": merchant_id,
            "updated_at": now.isoformat(),
        }}
    )
    
    # Create notification for admin
    await db.notifications.insert_one({
        "id": secrets.token_hex(8),
        "user_id": "admin",
        "type": "merchant_registration",
        "title": "Neue Händler-Registrierung",
        "message": f"{req.business_name} hat sich als Händler registriert",
        "data": {"merchant_id": merchant_id, "user_id": user_id},
        "read": False,
        "created_at": now.isoformat(),
    })
    
    logger.info(f"Merchant registered: {merchant_id} - {req.business_name}")
    
    return {
        "ok": True,
        "merchant": merchant,
        "message": "Registrierung erfolgreich! Warte auf Genehmigung.",
    }


@router.get("/status")
async def get_merchant_status(request: Request):
    """Get current user's merchant status."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    merchant = await db.merchants.find_one({"user_id": user_id}, {"_id": 0})
    
    if not merchant:
        return {
            "is_merchant": False,
            "status": None,
            "merchant": None,
        }
    
    return {
        "is_merchant": True,
        "status": merchant.get("status"),
        "plan": merchant.get("plan", "basic"),
        "merchant": merchant,
    }


@router.get("/plans")
async def get_merchant_plans():
    """Get available merchant plans."""
    return {
        "plans": [
            {"id": k, **v}
            for k, v in MERCHANT_PLANS.items()
        ]
    }


# ══════════════════════════════════════════════════════════════════════════════
# MERCHANT PREMIUM UPGRADE
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/upgrade")
async def upgrade_merchant_plan(request: Request):
    """
    Upgrade to Pro merchant plan.
    Cost: €29.99/month, deducted from wallet.
    """
    body = await request.json()
    plan = body.get("plan", "pro")
    
    if plan not in MERCHANT_PLANS or plan == "basic":
        raise HTTPException(status_code=400, detail="Ungültiger Plan")
    
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    merchant = await db.merchants.find_one({"user_id": user_id})
    if not merchant:
        raise HTTPException(status_code=404, detail="Kein Händlerprofil gefunden")
    
    if merchant.get("status") != "approved":
        raise HTTPException(status_code=400, detail="Händlerprofil muss erst genehmigt werden")
    
    if merchant.get("plan") == plan:
        raise HTTPException(status_code=400, detail=f"Bereits auf {MERCHANT_PLANS[plan]['name']} Plan")
    
    plan_info = MERCHANT_PLANS[plan]
    price = plan_info["price"]
    
    # Deduct from wallet
    payment_result = await debit_wallet(
        user_id=user_id,
        amount=price,
        tx_type=TransactionType.PAYMENT,
        description=f"Merchant {plan_info['name']} Plan",
        reference=f"MERCH-PLAN-{secrets.token_hex(4).upper()}",
        metadata={"plan": plan, "type": "merchant_upgrade"}
    )
    
    if not payment_result.success:
        raise HTTPException(status_code=400, detail=payment_result.error)
    
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(days=30)
    
    # Update merchant plan
    await db.merchants.update_one(
        {"user_id": user_id},
        {"$set": {
            "plan": plan,
            "plan_started_at": now.isoformat(),
            "plan_expires_at": expires_at.isoformat(),
            "updated_at": now.isoformat(),
        }}
    )
    
    # Record revenue
    await db.platform_revenue.update_one(
        {"date": now.strftime("%Y-%m-%d")},
        {"$inc": {"total": price, "by_source.merchant_plans": price}},
        upsert=True
    )
    
    # Notify user
    await db.notifications.insert_one({
        "id": secrets.token_hex(8),
        "user_id": user_id,
        "type": "merchant_upgrade",
        "title": f"{plan_info['name']} Plan aktiviert!",
        "message": f"Dein {plan_info['name']} Plan ist jetzt aktiv bis {expires_at.strftime('%d.%m.%Y')}",
        "data": {"plan": plan},
        "read": False,
        "created_at": now.isoformat(),
    })
    
    logger.info(f"Merchant upgraded: {merchant.get('merchant_id')} to {plan}")
    
    return {
        "ok": True,
        "plan": plan,
        "plan_name": plan_info["name"],
        "expires_at": expires_at.isoformat(),
        "new_balance": payment_result.new_balance,
        "message": f"{plan_info['name']} Plan erfolgreich aktiviert!",
    }


# ══════════════════════════════════════════════════════════════════════════════
# MERCHANT LISTINGS MANAGEMENT
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/listings")
async def get_merchant_listings(request: Request):
    """Get merchant's marketplace listings with stats."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    merchant = await db.merchants.find_one({"user_id": user_id})
    if not merchant:
        raise HTTPException(status_code=404, detail="Kein Händlerprofil")
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Get listings
    listings = await db.marketplace_listings.find(
        {"seller_id": user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(200)
    
    # Calculate stats
    active_listings = [listing for listing in listings if listing.get("status") == "active"]
    boosted_listings = [listing for listing in active_listings if listing.get("boost") and listing["boost"].get("expires_at", "") > now]
    vip_listings = [listing for listing in active_listings if listing.get("is_vip")]
    
    plan_info = MERCHANT_PLANS.get(merchant.get("plan", "basic"), MERCHANT_PLANS["basic"])
    max_listings = plan_info.get("max_listings", 10)
    
    return {
        "listings": listings,
        "stats": {
            "total": len(listings),
            "active": len(active_listings),
            "boosted": len(boosted_listings),
            "vip": len(vip_listings),
            "sold": len([listing for listing in listings if listing.get("status") == "sold"]),
            "views": sum(listing.get("views", 0) for listing in listings),
        },
        "plan": merchant.get("plan", "basic"),
        "max_listings": max_listings,
        "can_create_more": max_listings == -1 or len(active_listings) < max_listings,
    }


# ══════════════════════════════════════════════════════════════════════════════
# ADMIN MERCHANT MANAGEMENT
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/admin/pending")
async def admin_get_pending_merchants(request: Request):
    """Admin: Get pending merchant registrations."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Nur Admin")
    
    pending = await db.merchants.find(
        {"status": "pending"},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return {"merchants": pending, "total": len(pending)}


@router.get("/admin/all")
async def admin_get_all_merchants(request: Request, status: str = None):
    """Admin: Get all merchants."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Nur Admin")
    
    query = {}
    if status:
        query["status"] = status
    
    merchants = await db.merchants.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    
    # Enrich with user info
    for m in merchants:
        user_info = await db.users.find_one(
            {"_id": ObjectId(m["user_id"]) if ObjectId.is_valid(m["user_id"]) else m["user_id"]},
            {"email": 1, "name": 1, "balance": 1}
        )
        if user_info:
            m["user_email"] = user_info.get("email")
            m["user_name"] = user_info.get("name")
            m["wallet_balance"] = user_info.get("balance", 0)
    
    stats = {
        "total": len(merchants),
        "pending": len([m for m in merchants if m.get("status") == "pending"]),
        "approved": len([m for m in merchants if m.get("status") == "approved"]),
        "rejected": len([m for m in merchants if m.get("status") == "rejected"]),
        "pro_plan": len([m for m in merchants if m.get("plan") == "pro"]),
    }
    
    return {"merchants": merchants, "stats": stats}


@router.post("/admin/approve")
async def admin_approve_merchant(request: Request):
    """Admin: Approve a merchant registration."""
    body = await request.json()
    merchant_id = body.get("merchant_id")
    
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Nur Admin")
    
    if not merchant_id:
        raise HTTPException(status_code=400, detail="merchant_id erforderlich")
    
    merchant = await db.merchants.find_one({"merchant_id": merchant_id})
    if not merchant:
        raise HTTPException(status_code=404, detail="Händler nicht gefunden")
    
    if merchant.get("status") == "approved":
        raise HTTPException(status_code=400, detail="Bereits genehmigt")
    
    now = datetime.now(timezone.utc)
    
    # Approve merchant
    await db.merchants.update_one(
        {"merchant_id": merchant_id},
        {"$set": {
            "status": "approved",
            "approved_at": now.isoformat(),
            "approved_by": str(user["_id"]),
            "updated_at": now.isoformat(),
        }}
    )
    
    # Update user role status
    await db.users.update_one(
        {"_id": ObjectId(merchant["user_id"])},
        {"$set": {
            "role_status": "approved",
            "updated_at": now.isoformat(),
        }}
    )
    
    # Notify merchant
    await db.notifications.insert_one({
        "id": secrets.token_hex(8),
        "user_id": merchant["user_id"],
        "type": "merchant_approved",
        "title": "Händlerkonto genehmigt!",
        "message": "Dein Händlerkonto wurde genehmigt. Du kannst jetzt verkaufen!",
        "data": {"merchant_id": merchant_id},
        "read": False,
        "created_at": now.isoformat(),
    })
    
    logger.info(f"Merchant approved: {merchant_id} by admin {user['_id']}")
    
    return {"ok": True, "message": "Händler genehmigt"}


@router.post("/admin/reject")
async def admin_reject_merchant(request: Request):
    """Admin: Reject a merchant registration."""
    body = await request.json()
    merchant_id = body.get("merchant_id")
    reason = body.get("reason", "Nicht genehmigt")
    
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Nur Admin")
    
    if not merchant_id:
        raise HTTPException(status_code=400, detail="merchant_id erforderlich")
    
    merchant = await db.merchants.find_one({"merchant_id": merchant_id})
    if not merchant:
        raise HTTPException(status_code=404, detail="Händler nicht gefunden")
    
    now = datetime.now(timezone.utc)
    
    # Reject merchant
    await db.merchants.update_one(
        {"merchant_id": merchant_id},
        {"$set": {
            "status": "rejected",
            "rejection_reason": reason,
            "rejected_at": now.isoformat(),
            "rejected_by": str(user["_id"]),
            "updated_at": now.isoformat(),
        }}
    )
    
    # Update user role status
    await db.users.update_one(
        {"_id": ObjectId(merchant["user_id"])},
        {"$set": {
            "role": "user",
            "role_status": "rejected",
            "updated_at": now.isoformat(),
        }}
    )
    
    # Notify merchant
    await db.notifications.insert_one({
        "id": secrets.token_hex(8),
        "user_id": merchant["user_id"],
        "type": "merchant_rejected",
        "title": "Händlerkonto abgelehnt",
        "message": f"Grund: {reason}",
        "data": {"merchant_id": merchant_id, "reason": reason},
        "read": False,
        "created_at": now.isoformat(),
    })
    
    logger.info(f"Merchant rejected: {merchant_id}")
    
    return {"ok": True, "message": "Händler abgelehnt"}


@router.post("/admin/block/{merchant_id}")
async def admin_block_merchant(merchant_id: str, request: Request):
    """Admin: Block a merchant."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Nur Admin")
    
    merchant = await db.merchants.find_one({"merchant_id": merchant_id})
    if not merchant:
        raise HTTPException(status_code=404, detail="Händler nicht gefunden")
    
    now = datetime.now(timezone.utc)
    
    await db.merchants.update_one(
        {"merchant_id": merchant_id},
        {"$set": {
            "status": "blocked",
            "blocked_at": now.isoformat(),
            "blocked_by": str(user["_id"]),
        }}
    )
    
    # Deactivate all listings
    await db.marketplace_listings.update_many(
        {"seller_id": merchant["user_id"]},
        {"$set": {"status": "blocked"}}
    )
    
    return {"ok": True, "message": "Händler gesperrt"}


@router.get("/admin/revenue")
async def admin_merchant_revenue(request: Request, days: int = 30):
    """Admin: Get merchant system revenue."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Nur Admin")
    
    now = datetime.now(timezone.utc)
    start_date = (now - timedelta(days=days)).isoformat()
    
    # Get plan upgrade transactions
    plan_txns = await db.transactions.find({
        "reference": {"$regex": "^MERCH-PLAN-"},
        "created_at": {"$gte": start_date}
    }, {"_id": 0}).to_list(500)
    
    total_plan_revenue = sum(abs(t.get("amount", 0)) for t in plan_txns)
    
    # Get merchant transaction fees (commission)
    merchant_txns = await db.merchant_transactions.find({
        "created_at": {"$gte": start_date}
    }, {"fee": 1}).to_list(5000)
    
    total_fee_revenue = sum(t.get("fee", 0) for t in merchant_txns)
    
    return {
        "period_days": days,
        "plan_revenue": round(total_plan_revenue, 2),
        "fee_revenue": round(total_fee_revenue, 2),
        "total_revenue": round(total_plan_revenue + total_fee_revenue, 2),
        "plan_upgrades": len(plan_txns),
        "transactions_processed": len(merchant_txns),
    }
