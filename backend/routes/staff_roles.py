"""
BidBlitz Staff - Rollen & Rechte (Roles & Permissions)
======================================================
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, List
import os
from motor.motor_asyncio import AsyncIOMotorClient

router = APIRouter(prefix="/api/staff/roles", tags=["staff-roles"])
client = AsyncIOMotorClient(os.getenv("MONGO_URL"))
db = client[os.getenv("DB_NAME", "bidblitz")]


PERMISSIONS = {
    "view_own_hours": "Eigene Arbeitszeiten sehen",
    "view_all_hours": "Alle Arbeitszeiten sehen",
    "edit_hours": "Arbeitszeiten bearbeiten",
    "create_shifts": "Schichten erstellen",
    "approve_leave": "Urlaub genehmigen",
    "export_reports": "Reports exportieren",
    "edit_settings": "Einstellungen ändern",
    "manage_members": "Mitarbeiter verwalten",
    "manage_billing": "Subscription verwalten",
}

ROLE_MATRIX = {
    "owner": list(PERMISSIONS.keys()),
    "manager": [
        "view_own_hours", "view_all_hours", "edit_hours", "create_shifts",
        "approve_leave", "export_reports", "edit_settings", "manage_members",
    ],
    "shift_lead": [
        "view_own_hours", "view_all_hours", "create_shifts", "approve_leave",
    ],
    "employee": ["view_own_hours"],
    "helper": ["view_own_hours"],
}

ROLE_LABELS = {
    "owner": "Inhaber",
    "manager": "Manager",
    "shift_lead": "Schichtleiter",
    "employee": "Mitarbeiter",
    "helper": "Aushilfe",
}


class RoleAssign(BaseModel):
    staff_id: str
    role: str


async def _merchant_id(request: Request) -> str:
    from routes.auth import get_current_user as auth_user
    user = await auth_user(request)
    if user.get("role") not in ("merchant", "admin"):
        raise HTTPException(403, "Nur für Händler oder Administratoren")
    return str(user.get("user_id") or user.get("id"))


def role_has_permission(role: str, permission: str) -> bool:
    return permission in ROLE_MATRIX.get(role, [])


@router.get("/list")
async def list_roles():
    return {
        "success": True,
        "roles": [
            {"id": rid, "label": ROLE_LABELS[rid], "permissions": perms}
            for rid, perms in ROLE_MATRIX.items()
        ],
        "permissions": [{"id": k, "label": v} for k, v in PERMISSIONS.items()],
    }


@router.post("/assign")
async def assign_role(req: RoleAssign, request: Request):
    mid = await _merchant_id(request)
    if req.role not in ROLE_MATRIX:
        raise HTTPException(400, "Unbekannte Rolle")
    res = await db.staff_members.update_one(
        {"id": req.staff_id, "merchant_id": mid},
        {"$set": {"staff_role": req.role}},
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Mitarbeiter nicht gefunden")
    return {"success": True, "staff_id": req.staff_id, "role": req.role, "label": ROLE_LABELS[req.role]}


@router.get("/check/{staff_id}/{permission}")
async def check_permission(staff_id: str, permission: str, request: Request):
    mid = await _merchant_id(request)
    member = await db.staff_members.find_one({"id": staff_id, "merchant_id": mid}, {"_id": 0})
    if not member:
        raise HTTPException(404, "Mitarbeiter nicht gefunden")
    role = member.get("staff_role", "employee")
    return {"success": True, "has_permission": role_has_permission(role, permission), "role": role}
