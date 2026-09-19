"""
Express Checkout — 1-Klick-Zahlung mit gespeicherten Karten
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
from core.database import db
from core.security import get_current_user
from uuid import uuid4

router = APIRouter(prefix="/api/express-checkout", tags=["Express Checkout"])


def _now():
    return datetime.now(timezone.utc).isoformat()


# ═══════════════════════════════════════════════════════════
# GESPEICHERTE ZAHLUNGSMETHODEN
# ═══════════════════════════════════════════════════════════
@router.get("/payment-methods")
async def get_saved_payment_methods(request: Request):
    """Liste aller gespeicherten Zahlungsmethoden des Users."""
    user = await get_current_user(request)
    methods = await db.saved_payment_methods.find(
        {"user_id": str(user["_id"]), "deleted": {"$ne": True}},
        {"_id": 0}
    ).sort("is_default", -1).to_list(50)
    return {"payment_methods": methods}


class SavePaymentMethod(BaseModel):
    stripe_payment_method_id: str
    is_default: bool = False


@router.post("/payment-methods")
async def save_payment_method(req: SavePaymentMethod, request: Request):
    """Legacy endpoint: raw PAN storage is forbidden. Use tokenized Stripe route."""
    await get_current_user(request)
    raise HTTPException(
        status_code=410,
        detail={
            "error": "tokenized_payment_method_required",
            "message": "Rohe Kartendaten werden nicht akzeptiert. Nutze /api/express-checkout/stripe/save-payment-method mit Stripe Payment Method.",
            "stripe_payment_method_id": req.stripe_payment_method_id,
        },
    )


@router.delete("/payment-methods/{method_id}")
async def delete_payment_method(method_id: str, request: Request):
    """Zahlungsmethode löschen."""
    user = await get_current_user(request)
    await db.saved_payment_methods.update_one(
        {"id": method_id, "user_id": str(user["_id"])},
        {"$set": {"deleted": True, "deleted_at": _now()}}
    )
    return {"ok": True}


@router.post("/payment-methods/{method_id}/set-default")
async def set_default_payment_method(method_id: str, request: Request):
    """Zahlungsmethode als Standard setzen."""
    user = await get_current_user(request)
    await db.saved_payment_methods.update_many(
        {"user_id": str(user["_id"])},
        {"$set": {"is_default": False}}
    )
    await db.saved_payment_methods.update_one(
        {"id": method_id, "user_id": str(user["_id"])},
        {"$set": {"is_default": True}}
    )
    return {"ok": True}


# ═══════════════════════════════════════════════════════════
# GESPEICHERTE ADRESSEN
# ═══════════════════════════════════════════════════════════
@router.get("/addresses")
async def get_saved_addresses(request: Request):
    """Liste aller gespeicherten Lieferadressen."""
    user = await get_current_user(request)
    addresses = await db.saved_addresses.find(
        {"user_id": str(user["_id"]), "deleted": {"$ne": True}},
        {"_id": 0}
    ).sort("is_default", -1).to_list(50)
    return {"addresses": addresses}


class SaveAddress(BaseModel):
    label: str  # "Zuhause", "Büro", "Eltern"
    street: str
    city: str
    zip_code: str
    country: str = "DE"
    is_default: bool = False


@router.post("/addresses")
async def save_address(req: SaveAddress, request: Request):
    """Neue Adresse speichern."""
    user = await get_current_user(request)
    
    if req.is_default:
        await db.saved_addresses.update_many(
            {"user_id": str(user["_id"])},
            {"$set": {"is_default": False}}
        )
    
    address = {
        "id": str(uuid4()),
        "user_id": str(user["_id"]),
        "label": req.label,
        "street": req.street,
        "city": req.city,
        "zip_code": req.zip_code,
        "country": req.country,
        "is_default": req.is_default,
        "created_at": _now(),
        "deleted": False,
    }
    await db.saved_addresses.insert_one(address)
    address.pop("_id", None)
    return {"ok": True, "address": address}


@router.delete("/addresses/{address_id}")
async def delete_address(address_id: str, request: Request):
    """Adresse löschen."""
    user = await get_current_user(request)
    await db.saved_addresses.update_one(
        {"id": address_id, "user_id": str(user["_id"])},
        {"$set": {"deleted": True, "deleted_at": _now()}}
    )
    return {"ok": True}


@router.post("/addresses/{address_id}/set-default")
async def set_default_address(address_id: str, request: Request):
    """Adresse als Standard setzen."""
    user = await get_current_user(request)
    await db.saved_addresses.update_many(
        {"user_id": str(user["_id"])},
        {"$set": {"is_default": False}}
    )
    await db.saved_addresses.update_one(
        {"id": address_id, "user_id": str(user["_id"])},
        {"$set": {"is_default": True}}
    )
    return {"ok": True}


# ═══════════════════════════════════════════════════════════
# 1-KLICK CHECKOUT
# ═══════════════════════════════════════════════════════════
class ExpressCheckoutRequest(BaseModel):
    product_id: Optional[str] = None
    auction_id: Optional[str] = None
    amount: float
    quantity: int = 1
    use_default_payment: bool = True
    use_default_address: bool = True
    payment_method_id: Optional[str] = None
    address_id: Optional[str] = None


@router.post("/quick-buy")
@router.post("/init")
async def express_checkout(req: ExpressCheckoutRequest, request: Request):
    """Legacy route intentionally fails closed until server-priced provider settlement is used."""
    await get_current_user(request)
    raise HTTPException(
        status_code=409,
        detail={
            "error": "canonical_checkout_required",
            "message": "Dieser alte Express-Checkout ist deaktiviert, weil Preis und Zahlungsabschluss nicht serverseitig verifiziert wurden. Nutze den kanonischen Marketplace-/Stripe-Checkout.",
        },
    )

