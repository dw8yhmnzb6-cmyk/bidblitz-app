"""
BidBlitz V2 - Paketversand
Preisvergleich DHL/Hermes/DPD/UPS + Buchung per Wallet + Tracking
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from core.database import db
from core.config import TEST_MODE
from core.security import get_current_user
import hashlib

router = APIRouter(prefix="/api/parcels", tags=["parcels"])

CASHBACK_RATE = 0.01

CARRIERS = [
    {"id": "dhl", "name": "DHL", "color": "#FFCC00", "logo": "https://images.unsplash.com/photo-1616432043562-3671ea2e5571?w=100&q=80", "base_price": 4.99, "kg_price": 0.80, "delivery_days": "1-2"},
    {"id": "hermes", "name": "Hermes", "color": "#00A0E1", "logo": "", "base_price": 3.89, "kg_price": 0.60, "delivery_days": "2-3"},
    {"id": "dpd", "name": "DPD", "color": "#DC0032", "logo": "", "base_price": 4.49, "kg_price": 0.70, "delivery_days": "1-3"},
    {"id": "ups", "name": "UPS", "color": "#351C15", "logo": "", "base_price": 6.99, "kg_price": 1.20, "delivery_days": "1-2"},
    {"id": "gls", "name": "GLS", "color": "#003DA5", "logo": "", "base_price": 4.29, "kg_price": 0.65, "delivery_days": "2-4"},
]


class ParcelQuote(BaseModel):
    weight: float = Field(..., gt=0, le=31.5)
    length: float = 30
    width: float = 20
    height: float = 15
    origin_zip: str = ""
    dest_zip: str = ""


class ParcelBook(BaseModel):
    carrier_id: str
    weight: float = Field(..., gt=0)
    idempotency_key: Optional[str] = None
    sender_name: str = ""
    sender_address: str = ""
    sender_zip: str = ""
    sender_city: str = ""
    recipient_name: str = ""
    recipient_address: str = ""
    recipient_zip: str = ""
    recipient_city: str = ""


class TrackingLookup(BaseModel):
    tracking_number: str


def _require_parcel_idempotency_key(body_key: Optional[str], request: Request) -> str:
    key = (body_key or request.headers.get("Idempotency-Key") or "").strip()
    if not 8 <= len(key) <= 200:
        raise HTTPException(status_code=400, detail="Idempotency-Key erforderlich")
    return key


def _require_parcel_booking_provider() -> None:
    if not TEST_MODE:
        raise HTTPException(
            status_code=503,
            detail=(
                "Paketbuchung ist in Production noch Preview. "
                "Ohne verifizierte Carrier-/Label-API werden keine Wallet-Beträge abgebucht "
                "und keine Versandlabels oder Trackingnummern erzeugt."
            ),
        )


@router.get("/carriers")
async def get_carriers():
    return {"carriers": CARRIERS}


@router.post("/quote")
async def get_quotes(req: ParcelQuote, request: Request):
    quotes = []
    for c in CARRIERS:
        price = round(c["base_price"] + req.weight * c["kg_price"], 2)
        # Size surcharge
        vol = (req.length * req.width * req.height) / 1000
        if vol > 20:
            price = round(price * 1.3, 2)
        quotes.append({
            "carrier_id": c["id"],
            "carrier_name": c["name"],
            "color": c["color"],
            "price": price,
            "delivery_days": c["delivery_days"],
            "weight": req.weight,
        })
    quotes.sort(key=lambda x: x["price"])
    return {
        "quotes": quotes,
        "booking_enabled": bool(TEST_MODE),
        "provider_mode": "test" if TEST_MODE else "preview",
        "production_message": (
            None if TEST_MODE else
            "Preisvergleich ist Preview. Echte Buchung, Versandlabel und Tracking werden erst nach verifizierter Carrier-API freigeschaltet."
        ),
    }


@router.post("/book")
async def book_parcel(req: ParcelBook, request: Request):
    """Book a parcel once through the canonical wallet engine; live carrier booking stays fail-closed."""
    from core.payment_engine import debit_wallet, credit_wallet, TransactionType

    _require_parcel_booking_provider()
    user = await get_current_user(request)
    user_id = str(user["_id"])
    client_key = _require_parcel_idempotency_key(req.idempotency_key, request)
    digest = hashlib.sha256(f"{user_id}:{client_key}".encode("utf-8")).hexdigest()
    parcel_id = f"PAR-{digest[:20].upper()}"

    existing = await db.parcels.find_one({"parcel_id": parcel_id, "user_id": user_id}, {"_id": 0})
    if existing:
        fresh = await db.users.find_one({"_id": user["_id"]}, {"_id": 0, "balance": 1}) or {}
        return {
            "ok": True,
            "parcel": existing,
            "new_balance": round(float(fresh.get("balance") or 0), 2),
            "replayed": True,
        }

    carrier = next((item for item in CARRIERS if item["id"] == req.carrier_id), None)
    if not carrier:
        raise HTTPException(status_code=404, detail="Carrier nicht gefunden")

    price = round(carrier["base_price"] + req.weight * carrier["kg_price"], 2)
    reference = f"PKG-{digest[:10].upper()}"
    payment = await debit_wallet(
        user_id=user_id,
        amount=price,
        tx_type=TransactionType.PAYMENT,
        description=f"Paket Preview: {carrier['name']} ({req.weight}kg)",
        reference=reference,
        metadata={
            "parcel_id": parcel_id,
            "carrier_id": req.carrier_id,
            "weight": req.weight,
            "kind": "parcel_booking_test",
        },
        idempotency_key=f"parcel-book:{client_key}",
    )
    if not payment.success:
        raise HTTPException(status_code=400, detail=payment.error or f"Nicht genug Guthaben (€{price:.2f})")

    cashback = round(price * CASHBACK_RATE, 2)
    cashback_result = None
    if cashback > 0:
        cashback_result = await credit_wallet(
            user_id=user_id,
            amount=cashback,
            tx_type=TransactionType.LOYALTY_CASHBACK,
            description=f"Paket Cashback Preview: {carrier['name']}",
            reference=f"PKG-CB-{digest[:8].upper()}",
            source="parcel_cashback_test",
            metadata={"parcel_id": parcel_id, "carrier_id": req.carrier_id},
            idempotency_key=f"parcel-cashback:{parcel_id}",
        )

    now = datetime.now(timezone.utc).isoformat()
    tracking = f"TEST-{carrier['id'].upper()}-{digest[:10].upper()}"
    parcel = {
        "parcel_id": parcel_id,
        "tracking_number": tracking,
        "carrier_id": req.carrier_id,
        "carrier_name": carrier["name"],
        "weight": req.weight,
        "price": price,
        "cashback": cashback if cashback_result and cashback_result.success else 0.0,
        "cashback_status": "credited" if cashback_result and cashback_result.success else ("not_applicable" if cashback <= 0 else "pending"),
        "sender_name": req.sender_name,
        "sender_address": req.sender_address,
        "sender_zip": req.sender_zip,
        "sender_city": req.sender_city,
        "recipient_name": req.recipient_name,
        "recipient_address": req.recipient_address,
        "recipient_zip": req.recipient_zip,
        "recipient_city": req.recipient_city,
        "user_id": user_id,
        "status": "label_preview",
        "provider_mode": "test",
        "payment_status": "paid_test",
        "payment_transaction_id": payment.transaction_id,
        "booking_idempotency_key": client_key,
        "tracking_events": [
            {"status": "label_preview", "message": "Test-Versandlabel erstellt", "timestamp": now},
        ],
        "reference": reference,
        "created_at": now,
    }
    await db.parcels.update_one(
        {"parcel_id": parcel_id, "user_id": user_id},
        {"$setOnInsert": parcel},
        upsert=True,
    )
    saved = await db.parcels.find_one({"parcel_id": parcel_id, "user_id": user_id}, {"_id": 0}) or parcel
    fresh = await db.users.find_one({"_id": user["_id"]}, {"_id": 0, "balance": 1}) or {}

    return {
        "ok": True,
        "parcel": saved,
        "new_balance": round(float(fresh.get("balance") or 0), 2),
        "replayed": bool(payment.idempotent_replay),
    }


@router.get("/my-parcels")
async def my_parcels(request: Request):
    user = await get_current_user(request)
    parcels = await db.parcels.find(
        {"user_id": str(user["_id"])}, {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    return {"parcels": parcels}


@router.get("/track/{tracking_number}")
async def track_parcel(tracking_number: str):
    p = await db.parcels.find_one({"tracking_number": tracking_number.upper()}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Sendung nicht gefunden")
    return p
