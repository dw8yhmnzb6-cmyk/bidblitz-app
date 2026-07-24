"""POS Kassenmeldepflicht (§146a AO) - Selbstmeldung beim Finanzamt"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
from core.database import db
from core.security import get_current_user

router = APIRouter(prefix="/api/pos/kassenmeldung", tags=["POS Compliance"])


class MeldungSave(BaseModel):
    store_id: str
    business_name: str = ""
    tax_id: str = ""
    address: str = ""
    contact_email: str = ""
    register_serial: str = ""
    tse_serial: str = ""
    commissioning_date: Optional[str] = None
    decommissioning_date: Optional[str] = None
    notes: str = ""


async def _check_store_access(user: dict, store_id: str):
    """Nur Merchant-Owner oder Admin darf zugreifen."""
    if user.get("role") in ("admin", "superadmin"):
        return
    user_id = str(user["_id"])
    store = await db.pos_stores.find_one({"store_id": store_id})
    if not store:
        raise HTTPException(404, "Filiale nicht gefunden")
    merchant = await db.pos_merchants.find_one({"merchant_id": store["merchant_id"]})
    if not merchant or merchant.get("owner_id") != user_id:
        raise HTTPException(403, "Keine Berechtigung für diese Filiale")


@router.get("/get")
async def get_meldung(store_id: str, request: Request):
    user = await get_current_user(request)
    await _check_store_access(user, store_id)
    m = await db.pos_kassenmeldung.find_one({"store_id": store_id}, {"_id": 0})
    return {"meldung": m}


@router.post("/save")
async def save_meldung(req: MeldungSave, request: Request):
    user = await get_current_user(request)
    await _check_store_access(user, req.store_id)
    now = datetime.now(timezone.utc).isoformat()
    doc = req.dict()
    doc["updated_at"] = now
    doc["updated_by"] = str(user["_id"])
    existing = await db.pos_kassenmeldung.find_one({"store_id": req.store_id})
    if existing:
        await db.pos_kassenmeldung.update_one({"store_id": req.store_id}, {"$set": doc})
    else:
        doc["created_at"] = now
        await db.pos_kassenmeldung.insert_one(doc)
        doc.pop("_id", None)
    saved = await db.pos_kassenmeldung.find_one({"store_id": req.store_id}, {"_id": 0})
    return {"ok": True, "meldung": saved}
