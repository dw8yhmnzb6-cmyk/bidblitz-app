"""
BidBlitz V2 - Bills & Utility Payments
Pay eSIM, electricity, gas, parking, waste disposal from wallet

Categories:
- eSIM / Mobile Top-up
- Electricity (Strom)
- Gas
- Parking
- Waste disposal (Müll)
- Internet
- Water
"""

from datetime import datetime, timezone
from typing import Optional, List
import secrets
import hashlib
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from core.database import db
from core.security import get_current_user
from core.config import TEST_MODE
from core.payment_engine import debit_wallet, TransactionType

router = APIRouter(prefix="/api/bills", tags=["bills"])


def _require_bills_idempotency_key(body_key: Optional[str], request: Request, *, prefix: str) -> str:
    key = (body_key or request.headers.get("Idempotency-Key") or "").strip()
    if not 8 <= len(key) <= 200:
        raise HTTPException(status_code=400, detail="Idempotency-Key erforderlich")
    return f"{prefix}:{key}"

# ═══════════════════════════════════════════════════════════════════════════════
# BILL CATEGORIES & PROVIDERS
# ═══════════════════════════════════════════════════════════════════════════════

BILL_CATEGORIES = [
    {
        "id": "esim",
        "name": "eSIM & Mobile",
        "icon": "Smartphone",
        "color": "#8B5CF6",
        "providers": [
            {"id": "telekom", "name": "Telekom", "logo": "🇩🇪"},
            {"id": "vodafone", "name": "Vodafone", "logo": "🔴"},
            {"id": "o2", "name": "O2", "logo": "🔵"},
            {"id": "aldi_talk", "name": "ALDI TALK", "logo": "🟡"},
            {"id": "lebara", "name": "Lebara", "logo": "🟢"},
            {"id": "lycamobile", "name": "Lycamobile", "logo": "🟣"},
        ],
        "amounts": [5, 10, 15, 20, 30, 50],
    },
    {
        "id": "electricity",
        "name": "Strom",
        "icon": "Zap",
        "color": "#F59E0B",
        "providers": [
            {"id": "eon", "name": "E.ON", "logo": "⚡"},
            {"id": "vattenfall", "name": "Vattenfall", "logo": "💡"},
            {"id": "rwe", "name": "RWE", "logo": "🔌"},
            {"id": "enbw", "name": "EnBW", "logo": "⚡"},
        ],
        "custom_amount": True,
    },
    {
        "id": "gas",
        "name": "Gas",
        "icon": "Flame",
        "color": "#EF4444",
        "providers": [
            {"id": "eon_gas", "name": "E.ON Gas", "logo": "🔥"},
            {"id": "vattenfall_gas", "name": "Vattenfall Gas", "logo": "🔥"},
            {"id": "stadtwerke", "name": "Stadtwerke", "logo": "🏠"},
        ],
        "custom_amount": True,
    },
    {
        "id": "parking",
        "name": "Parkgebühren",
        "icon": "Car",
        "color": "#3B82F6",
        "providers": [
            {"id": "easypark", "name": "EasyPark", "logo": "🅿️"},
            {"id": "parkster", "name": "Parkster", "logo": "🚗"},
            {"id": "paybyphone", "name": "PayByPhone", "logo": "📱"},
        ],
        "amounts": [2, 5, 10, 20, 50],
    },
    {
        "id": "waste",
        "name": "Müllgebühren",
        "icon": "Trash2",
        "color": "#22C55E",
        "providers": [
            {"id": "awb", "name": "AWB Köln", "logo": "♻️"},
            {"id": "bsr", "name": "BSR Berlin", "logo": "🗑️"},
            {"id": "stadtwerke_muell", "name": "Stadtwerke", "logo": "🏛️"},
        ],
        "custom_amount": True,
    },
    {
        "id": "internet",
        "name": "Internet",
        "icon": "Wifi",
        "color": "#06B6D4",
        "providers": [
            {"id": "telekom_dsl", "name": "Telekom DSL", "logo": "🌐"},
            {"id": "vodafone_cable", "name": "Vodafone Kabel", "logo": "📶"},
            {"id": "1und1", "name": "1&1", "logo": "🔢"},
        ],
        "custom_amount": True,
    },
    {
        "id": "water",
        "name": "Wasser",
        "icon": "Droplet",
        "color": "#0EA5E9",
        "providers": [
            {"id": "berliner_wasser", "name": "Berliner Wasserbetriebe", "logo": "💧"},
            {"id": "stadtwerke_wasser", "name": "Stadtwerke", "logo": "🚰"},
        ],
        "custom_amount": True,
    },
]


# ═══════════════════════════════════════════════════════════════════════════════
# MODELS
# ═══════════════════════════════════════════════════════════════════════════════

class BillPaymentRequest(BaseModel):
    category_id: str
    provider_id: str
    amount: float = Field(..., gt=0, le=1000)
    account_number: Optional[str] = Field(None, max_length=50)  # Kundennummer
    phone_number: Optional[str] = Field(None, max_length=20)  # Für eSIM
    idempotency_key: Optional[str] = None


class SavedBillAccount(BaseModel):
    category_id: str
    provider_id: str
    account_number: str
    nickname: Optional[str] = None


# ═══════════════════════════════════════════════════════════════════════════════
# ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/categories")
async def get_bill_categories():
    """Get all bill payment categories and providers."""
    return {
        "categories": BILL_CATEGORIES,
    }


@router.get("/category/{category_id}")
async def get_category_details(category_id: str):
    """Get details for a specific category."""
    category = next((c for c in BILL_CATEGORIES if c["id"] == category_id), None)
    if not category:
        raise HTTPException(status_code=404, detail="Kategorie nicht gefunden")
    return category


@router.post("/pay")
async def pay_bill(req: BillPaymentRequest, request: Request):
    """Utility-payment simulation is test-only until a verified bill provider is integrated."""
    user = await get_current_user(request)
    if not TEST_MODE:
        raise HTTPException(
            status_code=503,
            detail="Versorgerzahlungen sind noch nicht mit einem verifizierten Provider verbunden. Es wird kein Wallet-Geld abgebucht.",
        )
    user_id = str(user["_id"])

    category = next((c for c in BILL_CATEGORIES if c["id"] == req.category_id), None)
    if not category:
        raise HTTPException(status_code=400, detail="Ungültige Kategorie")
    provider = next((p for p in category["providers"] if p["id"] == req.provider_id), None)
    if not provider:
        raise HTTPException(status_code=400, detail="Ungültiger Anbieter")
    if req.category_id == "esim" and not req.phone_number:
        raise HTTPException(status_code=400, detail="Telefonnummer erforderlich")

    idempotency_key = _require_bills_idempotency_key(req.idempotency_key, request, prefix="bill-pay")
    digest = hashlib.sha256(f"{user_id}:{idempotency_key}".encode("utf-8")).hexdigest()[:24]
    payment_id = f"BILL-{digest.upper()}"

    existing = await db.bill_payments.find_one({"payment_id": payment_id, "user_id": user_id}, {"_id": 0})
    if existing:
        return {
            "ok": True,
            "payment": existing,
            "new_balance": round(float(user.get("balance", 0) or 0), 2),
            "message": f"€{req.amount:.2f} an {provider['name']} bezahlt!",
            "replayed": True,
        }

    debit = await debit_wallet(
        user_id=user_id,
        amount=round(float(req.amount), 2),
        tx_type=TransactionType.PAYMENT,
        description=f"{category['name']} - {provider['name']}",
        reference=payment_id,
        metadata={
            "category_id": req.category_id,
            "provider_id": req.provider_id,
            "test_mode": True,
        },
        idempotency_key=idempotency_key,
    )
    if not debit.success:
        status_code = 409 if debit.status.value in {"pending", "reconciliation_required"} else 400
        raise HTTPException(status_code=status_code, detail=debit.error or "Versorgerzahlung fehlgeschlagen")

    now = datetime.now(timezone.utc).isoformat()
    payment = {
        "payment_id": payment_id,
        "user_id": user_id,
        "category_id": req.category_id,
        "category_name": category["name"],
        "provider_id": req.provider_id,
        "provider_name": provider["name"],
        "amount": round(req.amount, 2),
        "account_number": req.account_number,
        "phone_number": req.phone_number,
        "status": "completed",
        "wallet_transaction_id": debit.transaction_id,
        "idempotency_key": idempotency_key,
        "created_at": now,
        "completed_at": now,
    }
    await db.bill_payments.update_one(
        {"payment_id": payment_id},
        {"$setOnInsert": payment},
        upsert=True,
    )

    return {
        "ok": True,
        "payment": payment,
        "new_balance": debit.new_balance,
        "message": f"€{req.amount:.2f} an {provider['name']} bezahlt!",
        "replayed": bool(debit.idempotent_replay),
    }


@router.get("/history")
async def get_bill_history(request: Request, limit: int = 20):
    """Get user's bill payment history."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    payments = await db.bill_payments.find(
        {"user_id": user_id}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    for p in payments:
        p.pop("_id", None)
    
    # Calculate totals per category
    totals = {}
    for p in payments:
        cat = p.get("category_id", "other")
        totals[cat] = totals.get(cat, 0) + p.get("amount", 0)
    
    return {
        "payments": payments,
        "totals_by_category": totals,
        "total_paid": sum(p.get("amount", 0) for p in payments),
    }


@router.get("/saved-accounts")
async def get_saved_accounts(request: Request):
    """Get user's saved bill accounts."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    accounts = await db.saved_bill_accounts.find(
        {"user_id": user_id}
    ).to_list(50)
    
    for a in accounts:
        a.pop("_id", None)
    
    return {"accounts": accounts}


@router.post("/saved-accounts")
async def save_bill_account(req: SavedBillAccount, request: Request):
    """Save a bill account for quick payments."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    # Validate category and provider
    category = next((c for c in BILL_CATEGORIES if c["id"] == req.category_id), None)
    if not category:
        raise HTTPException(status_code=400, detail="Ungültige Kategorie")
    
    provider = next((p for p in category["providers"] if p["id"] == req.provider_id), None)
    if not provider:
        raise HTTPException(status_code=400, detail="Ungültiger Anbieter")
    
    now = datetime.now(timezone.utc)
    
    account = {
        "account_id": secrets.token_hex(8),
        "user_id": user_id,
        "category_id": req.category_id,
        "category_name": category["name"],
        "provider_id": req.provider_id,
        "provider_name": provider["name"],
        "account_number": req.account_number,
        "nickname": req.nickname or f"{provider['name']} - {req.account_number[-4:]}",
        "created_at": now.isoformat(),
    }
    
    await db.saved_bill_accounts.insert_one(account)
    account.pop("_id", None)
    
    return {
        "ok": True,
        "account": account,
        "message": "Konto gespeichert!",
    }


@router.delete("/saved-accounts/{account_id}")
async def delete_saved_account(account_id: str, request: Request):
    """Delete a saved bill account."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    result = await db.saved_bill_accounts.delete_one({
        "account_id": account_id,
        "user_id": user_id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Konto nicht gefunden")
    
    return {"ok": True, "message": "Konto gelöscht"}


# ═══════════════════════════════════════════════════════════════════════════════
# eSIM SPECIFIC ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/esim/packages")
async def get_esim_packages():
    """Get available eSIM data packages."""
    packages = [
        {"id": "data_1gb", "name": "1 GB", "data": "1 GB", "validity": "7 Tage", "price": 4.99},
        {"id": "data_3gb", "name": "3 GB", "data": "3 GB", "validity": "30 Tage", "price": 9.99},
        {"id": "data_5gb", "name": "5 GB", "data": "5 GB", "validity": "30 Tage", "price": 14.99},
        {"id": "data_10gb", "name": "10 GB", "data": "10 GB", "validity": "30 Tage", "price": 24.99},
        {"id": "data_unlimited", "name": "Unlimited", "data": "Unbegrenzt", "validity": "30 Tage", "price": 39.99},
    ]
    
    countries = [
        {"code": "DE", "name": "Deutschland", "flag": "🇩🇪"},
        {"code": "AT", "name": "Österreich", "flag": "🇦🇹"},
        {"code": "CH", "name": "Schweiz", "flag": "🇨🇭"},
        {"code": "EU", "name": "Europa (Roaming)", "flag": "🇪🇺"},
        {"code": "US", "name": "USA", "flag": "🇺🇸"},
        {"code": "TR", "name": "Türkei", "flag": "🇹🇷"},
    ]
    
    return {
        "packages": packages,
        "countries": countries,
    }


@router.post("/esim/purchase")
async def purchase_esim(request: Request, package_id: str, country_code: str = "DE"):
    """Mock eSIM issuance is test-only until a real eSIM provider is integrated."""
    user = await get_current_user(request)
    if not TEST_MODE:
        raise HTTPException(
            status_code=503,
            detail="eSIM-Kauf ist noch nicht mit einem echten Provider verbunden. Es wird kein Wallet-Geld abgebucht.",
        )
    user_id = str(user["_id"])

    packages = {
        "data_1gb": {"price": 4.99, "data": "1 GB"},
        "data_3gb": {"price": 9.99, "data": "3 GB"},
        "data_5gb": {"price": 14.99, "data": "5 GB"},
        "data_10gb": {"price": 24.99, "data": "10 GB"},
        "data_unlimited": {"price": 39.99, "data": "Unbegrenzt"},
    }
    package = packages.get(package_id)
    if not package:
        raise HTTPException(status_code=400, detail="Ungültiges Paket")

    idempotency_key = _require_bills_idempotency_key(None, request, prefix="esim-purchase")
    digest = hashlib.sha256(
        f"{user_id}:{package_id}:{country_code}:{idempotency_key}".encode("utf-8")
    ).hexdigest()[:24]
    esim_id = f"ESIM-{digest.upper()}"

    existing = await db.esim_purchases.find_one({"esim_id": esim_id, "user_id": user_id}, {"_id": 0})
    if existing:
        return {
            "ok": True,
            "esim": existing,
            "activation_code": existing.get("activation_code"),
            "new_balance": round(float(user.get("balance", 0) or 0), 2),
            "replayed": True,
        }

    debit = await debit_wallet(
        user_id=user_id,
        amount=round(float(package["price"]), 2),
        tx_type=TransactionType.PAYMENT,
        description=f"eSIM {package['data']} ({country_code})",
        reference=esim_id,
        metadata={"package_id": package_id, "country_code": country_code, "test_mode": True},
        idempotency_key=idempotency_key,
    )
    if not debit.success:
        status_code = 409 if debit.status.value in {"pending", "reconciliation_required"} else 400
        raise HTTPException(status_code=status_code, detail=debit.error or "eSIM-Zahlung fehlgeschlagen")

    now = datetime.now(timezone.utc).isoformat()
    activation_code = f"LPA:1$smdp.io$K{digest.upper()}"
    esim = {
        "esim_id": esim_id,
        "user_id": user_id,
        "package_id": package_id,
        "data_amount": package["data"],
        "country_code": country_code,
        "price": package["price"],
        "activation_code": activation_code,
        "status": "active",
        "wallet_transaction_id": debit.transaction_id,
        "idempotency_key": idempotency_key,
        "purchased_at": now,
        "expires_at": None,
    }
    await db.esim_purchases.update_one(
        {"esim_id": esim_id},
        {"$setOnInsert": esim},
        upsert=True,
    )

    return {
        "ok": True,
        "esim": esim,
        "activation_code": activation_code,
        "new_balance": debit.new_balance,
        "replayed": bool(debit.idempotent_replay),
    }


@router.get("/esim/my-esims")
async def get_my_esims(request: Request):
    """Get user's purchased eSIMs."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    esims = await db.esim_purchases.find(
        {"user_id": user_id}
    ).sort("purchased_at", -1).to_list(20)
    
    for e in esims:
        e.pop("_id", None)
    
    return {"esims": esims}
