"""
Partner Auth System - Separate authentication for scooter/mobility partners
Roles: PARTNER_ADMIN (manages their own fleet), SUPER_ADMIN (manages everything)
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone, timedelta
import uuid
import bcrypt
import jwt
import os

from config import db

router = APIRouter(prefix="/partner-auth", tags=["Partner Auth"])

JWT_SECRET = os.environ.get("JWT_SECRET", "bidblitz_secret_key_2024_auction_platform")
PARTNER_JWT_PREFIX = "partner_"


class PartnerRegister(BaseModel):
    name: str
    email: str
    password: str
    organization_id: Optional[str] = None
    phone: Optional[str] = None

class PartnerLogin(BaseModel):
    email: str
    password: str

class PartnerInvite(BaseModel):
    email: str
    name: str
    role: str = "partner_admin"  # partner_admin, partner_staff


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())

def create_partner_token(partner_id: str, org_id: str, role: str) -> str:
    payload = {
        "sub": partner_id,
        "org_id": org_id,
        "role": role,
        "type": "partner",
        "exp": datetime.now(timezone.utc) + timedelta(days=30)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

async def get_current_partner(token: str = Depends(lambda: None)):
    """Dependency to get current partner from JWT"""
    # This will be called via header extraction in actual usage
    pass


@router.post("/register")
async def register_partner(data: PartnerRegister):
    """Register a new partner admin"""
    existing = await db.partner_users.find_one({"email": data.email.lower()})
    if existing:
        raise HTTPException(409, "E-Mail bereits registriert")
    
    partner_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    partner = {
        "id": partner_id,
        "name": data.name,
        "email": data.email.lower(),
        "password": hash_password(data.password),
        "phone": data.phone,
        "role": "partner_admin",
        "organization_id": data.organization_id,
        "status": "pending",  # pending, active, suspended
        "created_at": now,
        "last_login": None
    }
    
    await db.partner_users.insert_one(partner)
    
    return {
        "success": True,
        "partner_id": partner_id,
        "message": "Registrierung erfolgreich. Warten Sie auf Freischaltung durch den Administrator."
    }


@router.post("/login")
async def login_partner(data: PartnerLogin):
    """Partner login"""
    partner = await db.partner_users.find_one({"email": data.email.lower()})
    if not partner or not verify_password(data.password, partner["password"]):
        raise HTTPException(401, "Ungültige Anmeldedaten")
    
    if partner.get("status") != "active":
        raise HTTPException(403, "Konto noch nicht freigeschaltet")
    
    token = create_partner_token(partner["id"], partner.get("organization_id", ""), partner["role"])
    
    # Update last login
    await db.partner_users.update_one(
        {"id": partner["id"]},
        {"$set": {"last_login": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {
        "token": token,
        "partner": {
            "id": partner["id"],
            "name": partner["name"],
            "email": partner["email"],
            "role": partner["role"],
            "organization_id": partner.get("organization_id")
        }
    }


@router.get("/me")
async def get_partner_profile(authorization: str = ""):
    """Get current partner's profile"""
    try:
        if authorization.startswith("Bearer "):
            token = authorization[7:]
        else:
            token = authorization
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        if payload.get("type") != "partner":
            raise HTTPException(401, "Ungültiger Token-Typ")
        
        partner = await db.partner_users.find_one({"id": payload["sub"]}, {"_id": 0, "password": 0})
        if not partner:
            raise HTTPException(404, "Partner nicht gefunden")
        
        # Get organization info
        org = None
        if partner.get("organization_id"):
            org = await db.organizations.find_one({"id": partner["organization_id"]}, {"_id": 0})
        
        return {
            "partner": partner,
            "organization": org
        }
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token abgelaufen")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Ungültiger Token")


@router.get("/admin/partners")
async def list_partners():
    """Super admin: List all partners"""
    partners = await db.partner_users.find({}, {"_id": 0, "password": 0}).to_list(100)
    return {"partners": partners}


@router.patch("/admin/partners/{partner_id}/activate")
async def activate_partner(partner_id: str):
    """Super admin: Activate a partner"""
    result = await db.partner_users.update_one(
        {"id": partner_id},
        {"$set": {"status": "active"}}
    )
    if result.matched_count == 0:
        raise HTTPException(404, "Partner nicht gefunden")
    return {"success": True, "message": "Partner aktiviert"}


@router.patch("/admin/partners/{partner_id}/suspend")
async def suspend_partner(partner_id: str):
    """Super admin: Suspend a partner"""
    result = await db.partner_users.update_one(
        {"id": partner_id},
        {"$set": {"status": "suspended"}}
    )
    if result.matched_count == 0:
        raise HTTPException(404, "Partner nicht gefunden")
    return {"success": True, "message": "Partner gesperrt"}
