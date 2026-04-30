"""
BidBlitz Debit Card — Waitlist + Application Tracking
Schema ready for card-issuer (Weavr/Railsr/Marqeta) integration.
Until real BaFin-licensed partner is wired, this tracks applications only.
"""
import logging
import random
import string
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional, Literal

from core.database import db
from core.security import get_current_user
from core.rate_limit import limiter
from core.audit import log_audit, get_client_info

router = APIRouter(prefix="/api/card", tags=["card"])
logger = logging.getLogger("bidblitz.card")

CARD_TIERS = {
    "virtual_free": {
        "id": "virtual_free",
        "name": "Virtual",
        "price_eur": 0,
        "price_label": "Gratis",
        "color_hex": "#00E0FF",
        "gradient": "from-cyan-500 via-blue-500 to-cyan-400",
        "features": ["Virtuelle Kartennummer", "Apple Pay / Google Pay", "0.3% Cashback in BLZ", "Sofort ausgestellt"],
        "monthly_fee": 0,
        "atm_free_eur": 0,
    },
    "physical_standard": {
        "id": "physical_standard",
        "name": "Standard",
        "price_eur": 9.99,
        "price_label": "€9.99 einmalig",
        "color_hex": "#B068FF",
        "gradient": "from-purple-600 via-violet-500 to-fuchsia-500",
        "features": ["Physische Karte", "Kostenlose Lieferung EU", "0.5% Cashback in BLZ", "5 Gratis-Bargeldabhebungen/Monat"],
        "monthly_fee": 0,
        "atm_free_eur": 200,
    },
    "metal_premium": {
        "id": "metal_premium",
        "name": "Metal",
        "price_eur": 0,
        "price_label": "€14.99 / Monat",
        "color_hex": "#FFD166",
        "gradient": "from-yellow-600 via-amber-500 to-yellow-400",
        "features": ["Metall-Karte", "1.5% Cashback in BLZ", "Unbegrenzte Bargeldabhebungen", "Reiseversicherung", "Concierge-Service", "Priority Auctions"],
        "monthly_fee": 14.99,
        "atm_free_eur": 99999,
    },
}


class CardApplyRequest(BaseModel):
    tier: Literal["virtual_free", "physical_standard", "metal_premium"]
    shipping_name: Optional[str] = None
    shipping_street: Optional[str] = None
    shipping_city: Optional[str] = None
    shipping_zip: Optional[str] = None
    shipping_country: Optional[str] = "DE"
    consent_terms: bool = False


class CardApplyResponse(BaseModel):
    application_id: str
    tier: str
    status: str
    waitlist_position: Optional[int] = None
    masked_pan: Optional[str] = None


def _gen_masked_virtual() -> str:
    """Generate a DEMO virtual PAN (NOT real — for UI preview only)."""
    first4 = "5367"  # fake BIN
    last4 = "".join(random.choices(string.digits, k=4))
    return f"{first4} •••• •••• {last4}"


@router.get("/tiers")
async def list_tiers():
    """Public: return all available card tiers + pricing."""
    return {"tiers": list(CARD_TIERS.values())}


@router.get("/status")
async def my_card_status(request: Request):
    """Return all applications + active cards for current user."""
    user = await get_current_user(request)
    user_id = str(user["_id"])

    apps = []
    cursor = db.card_applications.find({"user_id": user_id}, {"_id": 0}).sort("applied_at", -1)
    async for a in cursor:
        if isinstance(a.get("applied_at"), datetime):
            a["applied_at"] = a["applied_at"].isoformat()
        apps.append(a)

    # Count current waitlist size for display
    total_waitlist = await db.card_applications.count_documents({"status": "waitlist"})

    return {
        "applications": apps,
        "has_virtual": any(a.get("tier") == "virtual_free" and a.get("status") in ("active", "issued") for a in apps),
        "total_waitlist": total_waitlist,
    }


@router.post("/apply", response_model=CardApplyResponse)
@limiter.limit("5/hour")
async def apply_card(req: CardApplyRequest, request: Request):
    """Submit a card application.
    - virtual_free → instant-issue DEMO card (masked PAN shown in UI)
    - physical/metal → added to waitlist pending issuer integration.
    """
    user = await get_current_user(request)
    user_id = str(user["_id"])

    if not req.consent_terms:
        raise HTTPException(400, "Terms must be accepted")

    tier = CARD_TIERS.get(req.tier)
    if not tier:
        raise HTTPException(400, "Invalid tier")

    # Physical/Metal require shipping info
    if req.tier != "virtual_free":
        required = [req.shipping_name, req.shipping_street, req.shipping_city, req.shipping_zip]
        if not all(required):
            raise HTTPException(400, "Shipping info required for physical card")

    # Check existing
    existing = await db.card_applications.find_one({
        "user_id": user_id,
        "tier": req.tier,
        "status": {"$in": ["waitlist", "issued", "active", "pending"]},
    })
    if existing:
        raise HTTPException(409, f"Application already exists for {req.tier}")

    application_id = f"CARD-{int(datetime.now(timezone.utc).timestamp())}-{random.randint(1000, 9999)}"

    # Virtual is instantly "issued" as DEMO
    if req.tier == "virtual_free":
        status = "issued"
        masked_pan = _gen_masked_virtual()
        waitlist_pos = None
    else:
        status = "waitlist"
        masked_pan = None
        waitlist_pos = await db.card_applications.count_documents({"status": "waitlist"}) + 1

    doc = {
        "application_id": application_id,
        "user_id": user_id,
        "tier": req.tier,
        "tier_name": tier["name"],
        "status": status,
        "masked_pan": masked_pan,
        "waitlist_position": waitlist_pos,
        "applied_at": datetime.now(timezone.utc),
        "shipping": {
            "name": req.shipping_name,
            "street": req.shipping_street,
            "city": req.shipping_city,
            "zip": req.shipping_zip,
            "country": req.shipping_country,
        } if req.tier != "virtual_free" else None,
        "consent_at": datetime.now(timezone.utc),
        "is_demo": True,  # FLAG: remove when real issuer wired
    }
    await db.card_applications.insert_one(doc)

    ip, ua = get_client_info(request)
    await log_audit("card_application", user_id=user_id, email=user.get("email", ""),
                    ip=ip, user_agent=ua,
                    details={"tier": req.tier, "status": status, "application_id": application_id})

    return CardApplyResponse(
        application_id=application_id,
        tier=req.tier,
        status=status,
        waitlist_position=waitlist_pos,
        masked_pan=masked_pan,
    )


@router.post("/cancel/{application_id}")
async def cancel_application(application_id: str, request: Request):
    """User cancels their pending/waitlist application."""
    user = await get_current_user(request)
    user_id = str(user["_id"])

    app_doc = await db.card_applications.find_one({"application_id": application_id, "user_id": user_id})
    if not app_doc:
        raise HTTPException(404, "Application not found")
    if app_doc.get("status") not in ("waitlist", "pending"):
        raise HTTPException(400, "Cannot cancel in current status")

    await db.card_applications.update_one(
        {"application_id": application_id, "user_id": user_id},
        {"$set": {"status": "cancelled", "cancelled_at": datetime.now(timezone.utc)}},
    )
    return {"ok": True, "application_id": application_id}
