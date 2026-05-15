"""
POS Extended — Kassensturz (cash-register close-day / history) und Offline-Sync.
Wird vom Frontend POSExtendedPage.jsx unter /api/pos-extended/* aufgerufen.
"""
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from core.database import db
from core.security import get_current_user

router = APIRouter(prefix="/api/pos-extended", tags=["pos-extended-cash"])


async def _merchant_id_for(user: dict, allow_empty: bool = False) -> Optional[str]:
    """Resolve merchant_id for the current authenticated user (merchant role).
    If allow_empty=True, returns None instead of raising 404 when no merchant exists.
    """
    role = user.get("role")
    if role not in ("merchant", "admin"):
        raise HTTPException(403, "Merchant/Admin access required")

    # Try direct merchant lookup
    uid = str(user.get("_id") or user.get("id") or "")
    merchant = await db.merchants.find_one({"owner_user_id": uid}, {"_id": 1})
    if merchant:
        return str(merchant["_id"])
    # Fallback to user's email
    merchant = await db.merchants.find_one({"email": user.get("email")}, {"_id": 1})
    if merchant:
        return str(merchant["_id"])
    # Admin without owned merchant — accept user id as namespace
    if role == "admin":
        return uid
    if allow_empty:
        return None
    raise HTTPException(404, "Kein Merchant für diesen Account gefunden")


class CloseDayBody(BaseModel):
    cash_counted: float
    notes: Optional[str] = None
    branch_id: Optional[str] = None
    register_id: Optional[str] = None


@router.post("/cash-register/close-day")
async def close_day(body: CloseDayBody, request: Request):
    """Tagesabschluss: berechnet Soll vs. Ist und speichert Closing."""
    user = await get_current_user(request)
    merchant_id = await _merchant_id_for(user)

    now = datetime.now(timezone.utc)
    day_start = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()

    # Soll = Summe heutiger Cash-Transaktionen
    query = {
        "merchant_id": merchant_id,
        "payment_method": "cash",
        "status": {"$in": ["completed", "paid"]},
        "created_at": {"$gte": day_start},
    }
    if body.branch_id:
        query["branch_id"] = body.branch_id
    if body.register_id:
        query["register_id"] = body.register_id

    pipeline = [
        {"$match": query},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}, "count": {"$sum": 1}}},
    ]
    agg = await db.transactions.aggregate(pipeline).to_list(1)
    expected = float(agg[0]["total"]) if agg else 0.0
    tx_count = int(agg[0]["count"]) if agg else 0
    diff = round(body.cash_counted - expected, 2)

    closing = {
        "merchant_id": merchant_id,
        "branch_id": body.branch_id,
        "register_id": body.register_id,
        "expected_cash": round(expected, 2),
        "counted_cash": round(body.cash_counted, 2),
        "difference": diff,
        "transaction_count": tx_count,
        "notes": body.notes,
        "closed_by": user.get("email"),
        "closed_at": now.isoformat(),
        "day": now.strftime("%Y-%m-%d"),
    }
    res = await db.pos_cash_closings.insert_one(closing.copy())
    closing["id"] = str(res.inserted_id)
    closing.pop("_id", None)

    return {"ok": True, "closing": closing}


@router.get("/cash-register/history")
async def cash_history(request: Request, limit: int = 50):
    """Liefert die letzten Tagesabschlüsse für den Merchant. Leere Liste wenn kein Merchant existiert."""
    user = await get_current_user(request)
    merchant_id = await _merchant_id_for(user, allow_empty=True)
    if not merchant_id:
        return {"history": [], "count": 0}

    items = await db.pos_cash_closings.find(
        {"merchant_id": merchant_id}, {"_id": 0}
    ).sort("closed_at", -1).limit(min(limit, 200)).to_list(200)

    return {"history": items, "count": len(items)}


@router.get("/offline/download-data")
async def offline_download(request: Request):
    """Snapshot für Offline-Modus. Leere Sammlungen wenn kein Merchant existiert."""
    user = await get_current_user(request)
    merchant_id = await _merchant_id_for(user, allow_empty=True)
    if not merchant_id:
        return {
            "merchant_id": None,
            "snapshot_at": datetime.now(timezone.utc).isoformat(),
            "products": [], "categories": [], "tax_rates": [], "staff": [],
            "ttl_hours": 24,
        }

    products = await db.pos_products.find({"merchant_id": merchant_id}, {"_id": 0}).limit(2000).to_list(2000)
    categories = await db.pos_categories.find({"merchant_id": merchant_id}, {"_id": 0}).limit(500).to_list(500)
    tax_rates = await db.pos_tax_rates.find({"merchant_id": merchant_id}, {"_id": 0}).limit(50).to_list(50)
    staff = await db.staff_employees.find(
        {"merchant_id": merchant_id, "active": {"$ne": False}},
        {"_id": 0, "id": 1, "name": 1, "role": 1, "pin": 1, "email": 1},
    ).limit(500).to_list(500)

    return {
        "merchant_id": merchant_id,
        "snapshot_at": datetime.now(timezone.utc).isoformat(),
        "products": products,
        "categories": categories,
        "tax_rates": tax_rates,
        "staff": staff,
        "ttl_hours": 24,
    }
