from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional
import uuid

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from core.database import db
from core.security import get_current_user
from routes.loyalty_system import get_loyalty_status as _get_loyalty_status
from routes.loyalty_system import get_loyalty_stats as _get_loyalty_stats
from routes.loyalty_system import get_reward_history as _get_loyalty_history


router = APIRouter(prefix="/api/charge-app", tags=["charge-app"])


class ChargeWarrantyRegistrationRequest(BaseModel):
    product_name: str
    serial_number: str
    purchase_date: str = ""
    merchant_name: str = ""
    invoice_number: str = ""


class ChargeInvoiceSaveRequest(BaseModel):
    invoice_number: str
    merchant_name: str
    amount: float = 0
    purchase_date: str = ""
    product_name: str = ""
    serial_number: str = ""


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _safe_float(value: Any) -> float:
    try:
        return round(float(value or 0), 2)
    except (TypeError, ValueError):
        return 0.0


def _parse_iso(value: Any) -> Optional[datetime]:
    if not value or not isinstance(value, str):
        return None
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        return None


def _warranty_card(doc: Dict[str, Any]) -> Dict[str, Any]:
    purchase_dt = _parse_iso(doc.get("purchase_date")) or _parse_iso(doc.get("created_at")) or datetime.now(timezone.utc)
    valid_until = (purchase_dt + timedelta(days=730)).date().isoformat()
    return {
        "registration_id": doc.get("registration_id"),
        "product_name": doc.get("product_name") or "BidBlitz Charge Produkt",
        "serial_number": doc.get("serial_number") or "—",
        "purchase_date": doc.get("purchase_date") or purchase_dt.date().isoformat(),
        "merchant_name": doc.get("merchant_name") or "BidBlitz Charge Händler",
        "invoice_number": doc.get("invoice_number") or "—",
        "status": doc.get("status") or "active",
        "valid_until": valid_until,
        "coverage_label": "24 Monate Charge Care",
        "support_hint": "Digitale Garantie gespeichert – bei Bedarf direkt im Händlernetz abrufbar.",
        "created_at": doc.get("created_at") or _now_iso(),
    }


async def _get_charge_merchants(limit: int = 12) -> List[Dict[str, Any]]:
    merchants = await db.merchant_profiles.find({}, {"_id": 0}).sort("updated_at", -1).limit(limit).to_list(limit)
    payload = []
    for item in merchants:
        business_name = item.get("business_name") or "BidBlitz Partner"
        city = item.get("city") or "Deutschland"
        category = item.get("category") or "Charge / Retail"
        slug = item.get("public_slug") or ""
        payload.append({
            "business_name": business_name,
            "city": city,
            "category": category,
            "website": item.get("website") or "",
            "address": item.get("address") or "",
            "phone": item.get("phone") or "",
            "logo_url": item.get("logo_url") or "",
            "public_slug": slug,
            "route": f"/business/{slug}" if slug else "/merchant",
        })
    return payload


@router.get("/dashboard")
async def get_charge_dashboard(request: Request):
    user = await get_current_user(request)
    user_id = str(user.get("_id"))

    warranties = await db.charge_app_warranties.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).limit(20).to_list(20)
    invoices = await db.charge_app_invoices.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).limit(20).to_list(20)
    merchants = await _get_charge_merchants()

    offers = await db.promotions.find(
        {"active": True},
        {"_id": 0, "name": 1, "description": 1, "type": 1, "value": 1, "expires_at": 1, "target": 1}
    ).sort("created_at", -1).limit(8).to_list(8)
    normalized_offers = [
        {
            "title": item.get("name") or "Charge Offer",
            "description": item.get("description") or "Exklusives Angebot für BidBlitz Charge Kunden.",
            "offer_type": item.get("type") or "cashback",
            "value": item.get("value"),
            "expires_at": item.get("expires_at"),
            "target": item.get("target") or "all",
        }
        for item in offers
    ]

    if not normalized_offers:
        normalized_offers = [
            {
                "title": "Charge Starter Bonus",
                "description": "Sichere dir exklusive Händlerangebote und verlängerte Sichtbarkeit deiner Garantie.",
                "offer_type": "member_offer",
                "value": 15,
                "expires_at": "",
                "target": "all",
            },
            {
                "title": "Bundle Rabatt",
                "description": "Kabel + Charger + Zubehör als Premium-Bundle zum Vorteilspreis.",
                "offer_type": "bundle",
                "value": 10,
                "expires_at": "",
                "target": "all",
            },
        ]

    loyalty_status = await _get_loyalty_status(request)
    loyalty_stats = await _get_loyalty_stats(request)
    loyalty_history = await _get_loyalty_history(request, limit=8)

    return {
        "summary": {
            "registered_warranties": len(warranties),
            "stored_invoices": len(invoices),
            "coins_balance": loyalty_status.get("coins_balance", 0),
            "offers_total": len(normalized_offers),
            "merchants_total": len(merchants),
        },
        "warranties": [_warranty_card(item) for item in warranties],
        "invoices": [
            {
                "invoice_id": item.get("invoice_id"),
                "invoice_number": item.get("invoice_number") or "—",
                "merchant_name": item.get("merchant_name") or "BidBlitz Charge Händler",
                "amount": _safe_float(item.get("amount")),
                "purchase_date": item.get("purchase_date") or "",
                "product_name": item.get("product_name") or "BidBlitz Charge Produkt",
                "serial_number": item.get("serial_number") or "",
                "created_at": item.get("created_at") or "",
            }
            for item in invoices
        ],
        "loyalty": {
            "status": loyalty_status,
            "stats": loyalty_stats,
            "history": loyalty_history,
        },
        "offers": normalized_offers,
        "merchants": merchants,
    }


@router.post("/warranty/register")
async def register_charge_warranty(req: ChargeWarrantyRegistrationRequest, request: Request):
    user = await get_current_user(request)
    user_id = str(user.get("_id"))
    serial = req.serial_number.strip()
    if not req.product_name.strip() or not serial:
        raise HTTPException(status_code=400, detail="Produktname und Seriennummer sind erforderlich")

    existing = await db.charge_app_warranties.find_one(
        {"user_id": user_id, "serial_number": serial},
        {"_id": 0}
    )
    if existing:
        return {"ok": True, "warranty": _warranty_card(existing), "duplicate": True}

    doc = {
        "registration_id": f"CHG-WAR-{uuid.uuid4().hex[:10].upper()}",
        "user_id": user_id,
        "product_name": req.product_name.strip(),
        "serial_number": serial,
        "purchase_date": req.purchase_date.strip(),
        "merchant_name": req.merchant_name.strip(),
        "invoice_number": req.invoice_number.strip(),
        "status": "active",
        "created_at": _now_iso(),
    }
    await db.charge_app_warranties.insert_one(doc)
    return {"ok": True, "warranty": _warranty_card(doc)}


@router.post("/invoices/save")
async def save_charge_invoice(req: ChargeInvoiceSaveRequest, request: Request):
    user = await get_current_user(request)
    user_id = str(user.get("_id"))
    if not req.invoice_number.strip() or not req.merchant_name.strip():
        raise HTTPException(status_code=400, detail="Rechnungsnummer und Händlername sind erforderlich")

    existing = await db.charge_app_invoices.find_one(
        {"user_id": user_id, "invoice_number": req.invoice_number.strip()},
        {"_id": 0}
    )
    if existing:
        return {"ok": True, "invoice": existing, "duplicate": True}

    doc = {
        "invoice_id": f"CHG-INV-{uuid.uuid4().hex[:10].upper()}",
        "user_id": user_id,
        "invoice_number": req.invoice_number.strip(),
        "merchant_name": req.merchant_name.strip(),
        "amount": _safe_float(req.amount),
        "purchase_date": req.purchase_date.strip(),
        "product_name": req.product_name.strip(),
        "serial_number": req.serial_number.strip(),
        "created_at": _now_iso(),
    }
    await db.charge_app_invoices.insert_one(doc)
    # Exclude MongoDB _id from response to avoid ObjectId serialization error
    doc.pop("_id", None)
    return {"ok": True, "invoice": doc}
