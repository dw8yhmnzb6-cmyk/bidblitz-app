"""
Partner Self-Onboarding - Mode A: instant ACTIVE
Register, Documents, Vehicles, Pricing
Adapted for BidBlitz: Motor async, dependencies.py auth
"""
import os
import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Depends, Query, UploadFile, File, Body

from dependencies import get_current_user, get_admin_user
from config import db

router = APIRouter(prefix="/partners", tags=["Partner Onboarding"])

UPLOAD_DIR = "/var/www/bidblitz/backend/storage/partner_uploads"

def _now(): return datetime.now(timezone.utc)
def _pid(): return "PART-" + uuid.uuid4().hex[:12].upper()
def _vid(): return "VEH-" + uuid.uuid4().hex[:10].upper()
def _did(): return "DOC-" + uuid.uuid4().hex[:10].upper()

PARTNER_TYPES = ["taxi_fleet", "scooter_operator", "restaurant", "merchant", "services"]
VEHICLE_TYPES = ["standard", "premium", "van", "scooter", "ebike"]
DOC_TYPES = ["license", "id_card", "insurance", "contract", "other"]


# ==================== REGISTER ====================

@router.post("/register")
async def register_partner(payload: dict = Body(...), user: dict = Depends(get_current_user)):
    ptype = (payload.get("type") or "").strip().lower()
    if ptype not in PARTNER_TYPES:
        raise HTTPException(400, f"Typ muss einer von: {PARTNER_TYPES}")

    existing = await db.partner_accounts.find_one({"partner_user_id": user["id"]})
    if existing:
        await db.partner_accounts.update_one({"_id": existing["_id"]}, {"$set": {
            "type": ptype, "business_name": payload.get("business_name", ""),
            "city": payload.get("city", ""), "zone_id": payload.get("zone_id"),
            "contact": payload.get("contact", {}), "status": "active", "updated_at": _now().isoformat()
        }})
        return {"ok": True, "partner_id": existing["partner_id"], "mode": "A", "message": "Partner aktualisiert"}

    partner = {
        "partner_id": _pid(), "partner_user_id": user["id"],
        "type": ptype, "business_name": payload.get("business_name", ""),
        "city": payload.get("city", ""), "zone_id": payload.get("zone_id"),
        "contact": payload.get("contact", {}),
        "status": "active", "created_at": _now().isoformat()
    }
    await db.partner_accounts.insert_one(partner)
    partner.pop("_id", None)
    return {"ok": True, "partner": partner, "mode": "A", "message": "Partner registriert und sofort aktiv!"}


@router.get("/me")
async def my_partner(user: dict = Depends(get_current_user)):
    p = await db.partner_accounts.find_one({"partner_user_id": user["id"]}, {"_id": 0})
    if not p: raise HTTPException(404, "Kein Partner-Account")
    return {"ok": True, "partner": p}


# ==================== DOCUMENTS ====================

@router.post("/documents/upload")
async def upload_document(doc_type: str = Query(...), file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    if doc_type not in DOC_TYPES:
        raise HTTPException(400, f"doc_type muss einer von: {DOC_TYPES}")
    p = await db.partner_accounts.find_one({"partner_user_id": user["id"]})
    if not p: raise HTTPException(404, "Kein Partner-Account")

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    content = await file.read()
    if len(content) > 15 * 1024 * 1024:
        raise HTTPException(413, "Max 15MB")

    doc_id = _did()
    ext = file.filename.split(".")[-1].lower() if "." in (file.filename or "") else "bin"
    fn = f"{p['partner_id']}_{doc_id}_{doc_type}.{ext}"
    with open(os.path.join(UPLOAD_DIR, fn), "wb") as f:
        f.write(content)

    doc = {"doc_id": doc_id, "partner_id": p["partner_id"], "doc_type": doc_type, "filename": fn, "size": len(content), "created_at": _now().isoformat()}
    await db.partner_documents.insert_one(doc)
    doc.pop("_id", None)
    return {"ok": True, "document": doc}


@router.get("/documents/list")
async def list_documents(user: dict = Depends(get_current_user)):
    p = await db.partner_accounts.find_one({"partner_user_id": user["id"]})
    if not p: return {"documents": []}
    docs = await db.partner_documents.find({"partner_id": p["partner_id"]}, {"_id": 0}).to_list(100)
    return {"documents": docs}


# ==================== VEHICLES ====================

@router.post("/vehicles/add")
async def add_vehicle(payload: dict = Body(...), user: dict = Depends(get_current_user)):
    p = await db.partner_accounts.find_one({"partner_user_id": user["id"]})
    if not p: raise HTTPException(404, "Kein Partner-Account")
    vtype = (payload.get("vehicle_type") or "").lower()
    if vtype not in VEHICLE_TYPES:
        raise HTTPException(400, f"vehicle_type: {VEHICLE_TYPES}")

    v = {"vehicle_id": _vid(), "partner_id": p["partner_id"], "vehicle_type": vtype,
         "plate": payload.get("plate"), "model": payload.get("model"), "brand": payload.get("brand"),
         "year": payload.get("year"), "status": "active", "created_at": _now().isoformat()}
    await db.partner_vehicles.insert_one(v)
    v.pop("_id", None)
    return {"ok": True, "vehicle": v}


@router.get("/vehicles/list")
async def list_vehicles(user: dict = Depends(get_current_user)):
    p = await db.partner_accounts.find_one({"partner_user_id": user["id"]})
    if not p: return {"vehicles": []}
    vs = await db.partner_vehicles.find({"partner_id": p["partner_id"]}, {"_id": 0}).to_list(200)
    return {"vehicles": vs}


@router.post("/vehicles/set-status")
async def set_vehicle_status(vehicle_id: str = Query(...), status: str = Query(...), user: dict = Depends(get_current_user)):
    p = await db.partner_accounts.find_one({"partner_user_id": user["id"]})
    if not p: raise HTTPException(404, "Kein Partner-Account")
    if status not in ("active", "inactive"): raise HTTPException(400, "active oder inactive")
    await db.partner_vehicles.update_one({"partner_id": p["partner_id"], "vehicle_id": vehicle_id}, {"$set": {"status": status}})
    return {"ok": True}


# ==================== PRICING ====================

@router.post("/pricing/set")
async def set_pricing(payload: dict = Body(...), user: dict = Depends(get_current_user)):
    p = await db.partner_accounts.find_one({"partner_user_id": user["id"]})
    if not p: raise HTTPException(404, "Kein Partner-Account")
    pricing = {"partner_id": p["partner_id"], "taxi": payload.get("taxi", {}), "scooter": payload.get("scooter", {}),
               "restaurant": payload.get("restaurant", {}), "commission": payload.get("commission", {}), "updated_at": _now().isoformat()}
    await db.partner_pricing.update_one({"partner_id": p["partner_id"]}, {"$set": pricing}, upsert=True)
    return {"ok": True, "pricing": pricing}


@router.get("/pricing/get")
async def get_pricing(user: dict = Depends(get_current_user)):
    p = await db.partner_accounts.find_one({"partner_user_id": user["id"]})
    if not p: return {"pricing": {}}
    pr = await db.partner_pricing.find_one({"partner_id": p["partner_id"]}, {"_id": 0})
    return {"pricing": pr or {}}


# ==================== PUBLIC ====================

@router.get("/public/list")
async def public_list(city: str = Query("Pristina"), type: str = None):
    q = {"status": "active"}
    if city: q["city"] = city
    if type: q["type"] = type
    rows = await db.partner_accounts.find(q, {"_id": 0, "partner_user_id": 0}).to_list(200)
    return {"partners": rows}


# ==================== ADMIN ====================

@router.get("/admin/all")
async def admin_list(admin: dict = Depends(get_admin_user)):
    rows = await db.partner_accounts.find({}, {"_id": 0}).to_list(500)
    return {"partners": rows}

@router.post("/admin/set-status/{partner_id}")
async def admin_set_status(partner_id: str, status: str = Query(...), admin: dict = Depends(get_admin_user)):
    await db.partner_accounts.update_one({"partner_id": partner_id}, {"$set": {"status": status}})
    return {"ok": True}
