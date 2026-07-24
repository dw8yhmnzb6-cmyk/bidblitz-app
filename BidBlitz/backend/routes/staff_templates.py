"""
BidBlitz Staff - Branchen-Vorlagen (Industry Templates)
Setzt Schichtzeiten, Pausenregeln, Rollen, Check-in-Methode, Urlaubstage.
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
from uuid import uuid4
import os
from motor.motor_asyncio import AsyncIOMotorClient

router = APIRouter(prefix="/api/staff/templates", tags=["staff-templates"])
client = AsyncIOMotorClient(os.getenv("MONGO_URL"))
db = client[os.getenv("DB_NAME", "bidblitz")]


INDUSTRY_TEMPLATES = {
    "gastronomy": {
        "label": "Gastronomie",
        "icon": "🍽️",
        "shifts": [
            {"name": "Mittagsschicht", "start": "11:00", "end": "15:00"},
            {"name": "Abendschicht", "start": "17:00", "end": "23:00"},
        ],
        "break_rules": {"min_minutes_after_hours": {"6": 30, "9": 45}},
        "roles": ["Koch", "Kellner", "Barkeeper", "Aushilfe"],
        "checkin_method": "qr",
        "vacation_days": 24,
    },
    "ice_cafe": {
        "label": "Eiscafé",
        "icon": "🍦",
        "shifts": [
            {"name": "Vormittag", "start": "10:00", "end": "14:00"},
            {"name": "Nachmittag", "start": "14:00", "end": "20:00"},
        ],
        "break_rules": {"min_minutes_after_hours": {"6": 30}},
        "roles": ["Eismacher", "Verkäufer", "Aushilfe"],
        "checkin_method": "qr",
        "vacation_days": 24,
    },
    "retail": {
        "label": "Einzelhandel",
        "icon": "🛍️",
        "shifts": [
            {"name": "Frühschicht", "start": "08:00", "end": "14:00"},
            {"name": "Spätschicht", "start": "13:00", "end": "20:00"},
        ],
        "break_rules": {"min_minutes_after_hours": {"6": 30, "9": 45}},
        "roles": ["Filialleiter", "Verkäufer", "Kassierer", "Aushilfe"],
        "checkin_method": "gps",
        "vacation_days": 25,
    },
    "hairdresser": {
        "label": "Friseur / Kosmetik",
        "icon": "💇",
        "shifts": [
            {"name": "Tagesschicht", "start": "09:00", "end": "18:00"},
        ],
        "break_rules": {"min_minutes_after_hours": {"6": 30}},
        "roles": ["Friseur", "Kosmetiker", "Auszubildender", "Empfang"],
        "checkin_method": "pin",
        "vacation_days": 25,
    },
    "construction": {
        "label": "Bau / Handwerk",
        "icon": "🔨",
        "shifts": [
            {"name": "Tagesschicht", "start": "07:00", "end": "16:00"},
        ],
        "break_rules": {"min_minutes_after_hours": {"6": 30, "9": 45}},
        "roles": ["Polier", "Geselle", "Helfer", "Lehrling"],
        "checkin_method": "gps",
        "vacation_days": 30,
    },
    "cleaning": {
        "label": "Reinigung",
        "icon": "🧹",
        "shifts": [
            {"name": "Morgenschicht", "start": "06:00", "end": "10:00"},
            {"name": "Abendschicht", "start": "18:00", "end": "22:00"},
        ],
        "break_rules": {"min_minutes_after_hours": {"6": 30}},
        "roles": ["Vorarbeiter", "Reinigungskraft", "Aushilfe"],
        "checkin_method": "gps",
        "vacation_days": 24,
    },
    "delivery": {
        "label": "Lieferdienst",
        "icon": "🛵",
        "shifts": [
            {"name": "Mittag", "start": "11:00", "end": "15:00"},
            {"name": "Abend", "start": "17:00", "end": "23:00"},
        ],
        "break_rules": {"min_minutes_after_hours": {"6": 30}},
        "roles": ["Fahrer", "Disponent", "Aushilfe"],
        "checkin_method": "gps",
        "vacation_days": 24,
    },
}


class ApplyTemplateReq(BaseModel):
    template_id: str


async def _merchant_id(request: Request) -> str:
    from routes.auth import get_current_user as auth_user
    user = await auth_user(request)
    if user.get("role") not in ("merchant", "admin"):
        raise HTTPException(403, "Nur für Händler oder Administratoren")
    return str(user.get("user_id") or user.get("id"))


@router.get("/list")
async def list_templates():
    return {
        "success": True,
        "templates": [{"id": k, **v} for k, v in INDUSTRY_TEMPLATES.items()],
    }


@router.get("/active")
async def get_active_template(request: Request):
    mid = await _merchant_id(request)
    doc = await db.staff_settings.find_one({"merchant_id": mid}, {"_id": 0})
    if not doc or not doc.get("active_template"):
        return {"success": True, "active_template": None}
    tid = doc["active_template"]
    return {
        "success": True,
        "active_template": tid,
        "template": INDUSTRY_TEMPLATES.get(tid),
        "applied_at": doc.get("template_applied_at"),
    }


@router.post("/apply")
async def apply_template(req: ApplyTemplateReq, request: Request):
    mid = await _merchant_id(request)
    tpl = INDUSTRY_TEMPLATES.get(req.template_id)
    if not tpl:
        raise HTTPException(400, "Unbekannte Branchen-Vorlage")
    now = datetime.now(timezone.utc).isoformat()
    await db.staff_settings.update_one(
        {"merchant_id": mid},
        {"$set": {
            "merchant_id": mid,
            "active_template": req.template_id,
            "template_data": tpl,
            "template_applied_at": now,
            "updated_at": now,
        }},
        upsert=True,
    )
    return {"success": True, "applied": req.template_id, "template": tpl}
