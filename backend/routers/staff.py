"""Staff/Employee management router with role-based permissions"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
from typing import List, Optional
from pydantic import BaseModel
import uuid

from config import db, logger
from dependencies import get_admin_user, get_current_user, hash_password

router = APIRouter(prefix="/admin/staff", tags=["Staff Management"])

# Redirect slashes
from fastapi import Request
from fastapi.responses import RedirectResponse

# Permission definitions
PERMISSIONS = {
    "products": {
        "name": "Produkte",
        "description": "Produkte erstellen, bearbeiten und löschen",
        "actions": ["create", "edit", "delete", "view"]
    },
    "auctions": {
        "name": "Auktionen", 
        "description": "Auktionen erstellen und verwalten",
        "actions": ["create", "edit", "delete", "view", "end"]
    },
    "users": {
        "name": "Benutzer",
        "description": "Benutzer verwalten und sperren",
        "actions": ["view", "edit", "block", "adjust_bids"]
    },
    "bots": {
        "name": "Bots",
        "description": "Bots erstellen und steuern",
        "actions": ["create", "edit", "delete", "seed", "bid"]
    },
    "vouchers": {
        "name": "Gutscheine",
        "description": "Gutscheine erstellen und verwalten",
        "actions": ["create", "edit", "delete", "view"]
    },
    "email": {
        "name": "E-Mail Marketing",
        "description": "E-Mail-Kampagnen senden",
        "actions": ["view", "send_campaign", "send_test"]
    },
    "transactions": {
        "name": "Transaktionen",
        "description": "Zahlungen und Transaktionen einsehen",
        "actions": ["view"]
    },
    "stats": {
        "name": "Statistiken",
        "description": "Dashboard und Statistiken einsehen",
        "actions": ["view"]
    },
    "staff": {
        "name": "Mitarbeiter",
        "description": "Mitarbeiter verwalten (nur Admin)",
        "actions": ["create", "edit", "delete", "view"]
    }
}

# Predefined roles
ROLES = {
    "admin": {
        "name": "Administrator",
        "description": "Voller Zugriff auf alle Funktionen",
        "permissions": list(PERMISSIONS.keys())
    },
    "manager": {
        "name": "Manager",
        "description": "Verwaltung von Produkten, Auktionen und Benutzern",
        "permissions": ["products", "auctions", "users", "bots", "vouchers", "stats", "transactions"]
    },
    "editor": {
        "name": "Redakteur",
        "description": "Produkte und Auktionen erstellen/bearbeiten",
        "permissions": ["products", "auctions", "stats"]
    },
    "support": {
        "name": "Support",
        "description": "Benutzer einsehen und unterstützen",
        "permissions": ["users", "vouchers", "stats", "transactions"]
    },
    "marketing": {
        "name": "Marketing",
        "description": "E-Mail-Kampagnen und Gutscheine",
        "permissions": ["email", "vouchers", "stats"]
    }
}

# Pydantic models
class StaffCreate(BaseModel):
    email: str
    password: str
    name: str
    role: str
    custom_permissions: Optional[List[str]] = None

class StaffUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    custom_permissions: Optional[List[str]] = None
    is_active: Optional[bool] = None

# ==================== ENDPOINTS ====================

@router.get("/permissions")
async def get_available_permissions(admin: dict = Depends(get_admin_user)):
    """Get all available permissions"""
    return PERMISSIONS

@router.get("/roles")
async def get_available_roles(admin: dict = Depends(get_admin_user)):
    """Get all predefined roles"""
    return ROLES

@router.get("")
@router.get("/")
async def list_staff(admin: dict = Depends(get_admin_user)):
    """List all staff members"""
    staff = await db.staff.find({}, {"_id": 0, "password": 0}).sort("created_at", -1).to_list(100)
    return staff

@router.post("")
@router.post("/")
async def create_staff(data: StaffCreate, admin: dict = Depends(get_admin_user)):
    """Create a new staff member"""
    # Check if email exists
    existing = await db.staff.find_one({"email": data.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="E-Mail bereits vergeben")
    
    # Validate role
    if data.role not in ROLES:
        raise HTTPException(status_code=400, detail="Ungültige Rolle")
    
    # Get permissions from role or custom
    permissions = data.custom_permissions if data.custom_permissions else ROLES[data.role]["permissions"]
    
    staff_member = {
        "id": str(uuid.uuid4()),
        "email": data.email.lower(),
        "password": hash_password(data.password),
        "name": data.name,
        "role": data.role,
        "role_name": ROLES[data.role]["name"],
        "permissions": permissions,
        "is_active": True,
        "is_staff": True,
        "created_by": admin["id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "last_login": None
    }
    
    await db.staff.insert_one(staff_member)
    
    # Return without password and _id
    staff_member.pop("password", None)
    staff_member.pop("_id", None)
    return staff_member

@router.get("/{staff_id}")
async def get_staff_member(staff_id: str, admin: dict = Depends(get_admin_user)):
    """Get a single staff member"""
    staff = await db.staff.find_one({"id": staff_id}, {"_id": 0, "password": 0})
    if not staff:
        raise HTTPException(status_code=404, detail="Mitarbeiter nicht gefunden")
    return staff

@router.put("/{staff_id}")
async def update_staff(staff_id: str, data: StaffUpdate, admin: dict = Depends(get_admin_user)):
    """Update a staff member"""
    staff = await db.staff.find_one({"id": staff_id})
    if not staff:
        raise HTTPException(status_code=404, detail="Mitarbeiter nicht gefunden")
    
    updates = {}
    
    if data.name:
        updates["name"] = data.name
    
    if data.role and data.role in ROLES:
        updates["role"] = data.role
        updates["role_name"] = ROLES[data.role]["name"]
        # Update permissions based on new role unless custom permissions provided
        if not data.custom_permissions:
            updates["permissions"] = ROLES[data.role]["permissions"]
    
    if data.custom_permissions:
        # Validate permissions
        valid_perms = [p for p in data.custom_permissions if p in PERMISSIONS]
        updates["permissions"] = valid_perms
    
    if data.is_active is not None:
        updates["is_active"] = data.is_active
    
    if updates:
        updates["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.staff.update_one({"id": staff_id}, {"$set": updates})
    
    updated = await db.staff.find_one({"id": staff_id}, {"_id": 0, "password": 0})
    return updated

@router.delete("/{staff_id}")
async def delete_staff(staff_id: str, admin: dict = Depends(get_admin_user)):
    """Delete a staff member"""
    result = await db.staff.delete_one({"id": staff_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Mitarbeiter nicht gefunden")
    return {"message": "Mitarbeiter gelöscht"}

@router.post("/{staff_id}/reset-password")
async def reset_staff_password(staff_id: str, new_password: str, admin: dict = Depends(get_admin_user)):
    """Reset a staff member's password"""
    result = await db.staff.update_one(
        {"id": staff_id},
        {"$set": {"password": hash_password(new_password)}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Mitarbeiter nicht gefunden")
    return {"message": "Passwort zurückgesetzt"}

# ==================== STAFF LOGIN ====================

@router.post("/login")
async def staff_login(email: str, password: str):
    """Staff login endpoint"""
    from dependencies import verify_password, create_access_token
    
    staff = await db.staff.find_one({"email": email.lower()})
    if not staff:
        raise HTTPException(status_code=401, detail="Ungültige Anmeldedaten")
    
    if not staff.get("is_active"):
        raise HTTPException(status_code=403, detail="Konto deaktiviert")
    
    if not verify_password(password, staff["password"]):
        raise HTTPException(status_code=401, detail="Ungültige Anmeldedaten")
    
    # Update last login
    await db.staff.update_one(
        {"id": staff["id"]},
        {"$set": {"last_login": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Create token with staff info
    token = create_access_token({
        "sub": staff["id"],
        "email": staff["email"],
        "name": staff["name"],
        "is_staff": True,
        "role": staff["role"],
        "permissions": staff["permissions"]
    })
    
    return {
        "token": token,
        "user": {
            "id": staff["id"],
            "email": staff["email"],
            "name": staff["name"],
            "role": staff["role"],
            "role_name": staff["role_name"],
            "permissions": staff["permissions"],
            "is_staff": True
        }
    }

# ==================== CHECK PERMISSION HELPER ====================

async def check_staff_permission(user: dict, required_permission: str) -> bool:
    """Check if staff member has a specific permission"""
    if user.get("is_admin"):
        return True
    
    if not user.get("is_staff"):
        return False
    
    permissions = user.get("permissions", [])
    return required_permission in permissions
