"""
BidBlitz Enterprise Portal API
==============================
Portal for large retailers (e.g., Edeka, Rewe) to manage multiple branches,
cash registers, API keys, and access comprehensive reports.

Features:
- Multi-branch management (Zentrale → Filiale → Kasse)
- API key management per cash register
- Reports: Daily, Weekly, Monthly, Yearly
- Export: PDF, CSV/Excel
- Role-based access (Admin, Branch Manager, Cashier)
"""

from fastapi import APIRouter, HTTPException, Header, Query, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, EmailStr
from datetime import datetime, timezone, timedelta
from typing import Optional, List
import uuid
import hashlib
import secrets
import io
import csv
import os
from config import db, logger

router = APIRouter(prefix="/enterprise", tags=["Enterprise Portal"])


# ==================== MODELS ====================

class EnterpriseCreate(BaseModel):
    company_name: str = Field(..., description="Company name (e.g., 'Edeka Zentrale')")
    email: EmailStr
    password: str = Field(..., min_length=8)
    contact_person: str
    phone: Optional[str] = None
    address: Optional[str] = None
    tax_id: Optional[str] = None  # Steuernummer

class EnterpriseLogin(BaseModel):
    email: EmailStr
    password: str

class BranchCreate(BaseModel):
    name: str = Field(..., description="Branch name (e.g., 'Edeka München Zentrum')")
    address: Optional[str] = None
    city: Optional[str] = None
    manager_name: Optional[str] = None
    manager_email: Optional[EmailStr] = None
    phone: Optional[str] = None

class BranchUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    manager_name: Optional[str] = None
    manager_email: Optional[EmailStr] = None
    phone: Optional[str] = None
    is_active: Optional[bool] = None

class CashRegisterCreate(BaseModel):
    name: str = Field(..., description="Cash register name (e.g., 'Kasse 1')")
    branch_id: str
    description: Optional[str] = None

class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str = Field(..., min_length=6)
    role: str = Field(..., description="admin, branch_manager, cashier, tax_advisor")
    branch_id: Optional[str] = None  # Required for branch_manager and cashier

class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    branch_id: Optional[str] = None
    is_active: Optional[bool] = None


# ==================== HELPER FUNCTIONS ====================

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def generate_api_key() -> str:
    return f"ent_{secrets.token_hex(24)}"

def generate_secret_key() -> str:
    return f"sec_{secrets.token_hex(24)}"

async def get_enterprise_from_token(token: str):
    """Verify enterprise token and return enterprise data."""
    if not token or not token.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token erforderlich")
    
    token_value = token.replace("Bearer ", "")
    
    # Check enterprise session
    session = await db.enterprise_sessions.find_one(
        {"token": token_value, "expires_at": {"$gt": datetime.now(timezone.utc).isoformat()}},
        {"_id": 0}
    )
    
    if not session:
        raise HTTPException(status_code=401, detail="Ungültiger oder abgelaufener Token")
    
    enterprise = await db.enterprise_accounts.find_one(
        {"id": session["enterprise_id"]},
        {"_id": 0, "password": 0}
    )
    
    if not enterprise:
        raise HTTPException(status_code=401, detail="Unternehmen nicht gefunden")
    
    # Add user info if it's a user session
    if session.get("user_id"):
        user = await db.enterprise_users.find_one(
            {"id": session["user_id"]},
            {"_id": 0, "password": 0}
        )
        if user:
            enterprise["current_user"] = user
    
    return enterprise


# ==================== AUTHENTICATION ====================

@router.post("/register")
async def register_enterprise(data: EnterpriseCreate):
    """Register a new enterprise account."""
    
    # Check if email already exists
    existing = await db.enterprise_accounts.find_one({"email": data.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="E-Mail bereits registriert")
    
    enterprise_id = f"ent_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)
    
    enterprise = {
        "id": enterprise_id,
        "company_name": data.company_name,
        "email": data.email.lower(),
        "password": hash_password(data.password),
        "contact_person": data.contact_person,
        "phone": data.phone,
        "address": data.address,
        "tax_id": data.tax_id,
        "status": "pending",  # pending, approved, suspended
        "created_at": now.isoformat(),
        "updated_at": now.isoformat()
    }
    
    await db.enterprise_accounts.insert_one(enterprise)
    
    return {
        "success": True,
        "enterprise_id": enterprise_id,
        "message": "Registrierung erfolgreich! Ihr Account wird geprüft und freigeschaltet."
    }


@router.post("/login")
async def login_enterprise(data: EnterpriseLogin):
    """Login to enterprise portal (supports both admin and staff accounts)."""
    
    logger.info(f"Enterprise login attempt for: {data.email}")
    
    # First, try to find enterprise admin account
    enterprise = await db.enterprise_accounts.find_one(
        {"email": data.email.lower()},
        {"_id": 0}
    )
    
    if enterprise:
        logger.info(f"Found enterprise: {enterprise.get('company_name')}, status: {enterprise.get('status')}")
        stored_hash = enterprise.get("password")
        input_hash = hash_password(data.password)
        logger.info(f"Hash match: {stored_hash == input_hash}")
    else:
        logger.info("No enterprise found for email")
    
    if enterprise and enterprise["password"] == hash_password(data.password):
        # Enterprise admin login
        if enterprise.get("status") == "pending":
            raise HTTPException(status_code=403, detail="Account wartet auf Freischaltung")
        
        if enterprise.get("status") == "suspended":
            raise HTTPException(status_code=403, detail="Account gesperrt")
        
        # Create session token
        token = secrets.token_hex(32)
        expires_at = datetime.now(timezone.utc) + timedelta(hours=24)
        
        await db.enterprise_sessions.insert_one({
            "token": token,
            "enterprise_id": enterprise["id"],
            "user_id": None,  # Main admin login
            "role": "admin",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "expires_at": expires_at.isoformat()
        })
        
        return {
            "success": True,
            "token": token,
            "enterprise_id": enterprise["id"],
            "company_name": enterprise["company_name"],
            "role": "admin",
            "expires_at": expires_at.isoformat()
        }
    
    # If not enterprise admin, try enterprise user (staff)
    user = await db.enterprise_users.find_one(
        {"email": data.email.lower()},
        {"_id": 0}
    )
    
    if user and user.get("password") == hash_password(data.password):
        if not user.get("is_active", True):
            raise HTTPException(status_code=403, detail="Account deaktiviert")
        
        # Get enterprise info
        user_enterprise = await db.enterprise_accounts.find_one(
            {"id": user["enterprise_id"]},
            {"_id": 0, "password": 0}
        )
        
        if not user_enterprise or user_enterprise.get("status") != "approved":
            raise HTTPException(status_code=403, detail="Unternehmens-Account nicht aktiv")
        
        # Create session token
        token = secrets.token_hex(32)
        expires_at = datetime.now(timezone.utc) + timedelta(hours=12)
        
        await db.enterprise_sessions.insert_one({
            "token": token,
            "enterprise_id": user["enterprise_id"],
            "user_id": user["id"],
            "role": user["role"],
            "branch_id": user.get("branch_id"),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "expires_at": expires_at.isoformat()
        })
        
        return {
            "success": True,
            "token": token,
            "enterprise_id": user["enterprise_id"],
            "company_name": user_enterprise["company_name"],
            "user_name": user["name"],
            "role": user["role"],
            "branch_id": user.get("branch_id"),
            "expires_at": expires_at.isoformat()
        }
    
    # Neither admin nor user found
    raise HTTPException(status_code=401, detail="Ungültige Anmeldedaten")


@router.post("/user/login")
async def login_enterprise_user(data: EnterpriseLogin):
    """Login as enterprise user (branch manager, cashier)."""
    
    user = await db.enterprise_users.find_one(
        {"email": data.email.lower()},
        {"_id": 0}
    )
    
    if not user or user["password"] != hash_password(data.password):
        raise HTTPException(status_code=401, detail="Ungültige Anmeldedaten")
    
    if not user.get("is_active", True):
        raise HTTPException(status_code=403, detail="Account deaktiviert")
    
    # Get enterprise
    enterprise = await db.enterprise_accounts.find_one(
        {"id": user["enterprise_id"]},
        {"_id": 0, "password": 0}
    )
    
    if not enterprise or enterprise.get("status") != "approved":
        raise HTTPException(status_code=403, detail="Unternehmens-Account nicht aktiv")
    
    # Create session token
    token = secrets.token_hex(32)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=12)
    
    await db.enterprise_sessions.insert_one({
        "token": token,
        "enterprise_id": user["enterprise_id"],
        "user_id": user["id"],
        "role": user["role"],
        "branch_id": user.get("branch_id"),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": expires_at.isoformat()
    })
    
    return {
        "success": True,
        "token": token,
        "enterprise_id": user["enterprise_id"],
        "company_name": enterprise["company_name"],
        "user_name": user["name"],
        "role": user["role"],
        "branch_id": user.get("branch_id"),
        "expires_at": expires_at.isoformat()
    }


@router.get("/me")
async def get_enterprise_info(authorization: str = Header(None)):
    """Get current enterprise account info."""
    enterprise = await get_enterprise_from_token(authorization)
    
    # Get stats
    branches_count = await db.enterprise_branches.count_documents({"enterprise_id": enterprise["id"]})
    api_keys_count = await db.enterprise_api_keys.count_documents({"enterprise_id": enterprise["id"]})
    users_count = await db.enterprise_users.count_documents({"enterprise_id": enterprise["id"]})
    
    result = {
        **enterprise,
        "stats": {
            "branches": branches_count,
            "api_keys": api_keys_count,
            "users": users_count
        }
    }
    
    # If it's a user login, add user-specific info
    current_user = enterprise.get("current_user")
    if current_user:
        result["role"] = current_user.get("role", "user")
        result["user_name"] = current_user.get("name")
        result["user_id"] = current_user.get("id")
        result["branch_id"] = current_user.get("branch_id")
    else:
        result["role"] = "admin"
    
    return result


# ==================== BRANCH MANAGEMENT ====================

@router.post("/branches")
async def create_branch(data: BranchCreate, authorization: str = Header(None)):
    """Create a new branch under the enterprise."""
    enterprise = await get_enterprise_from_token(authorization)
    
    branch_id = f"branch_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)
    
    branch = {
        "id": branch_id,
        "enterprise_id": enterprise["id"],
        "name": data.name,
        "address": data.address,
        "city": data.city,
        "manager_name": data.manager_name,
        "manager_email": data.manager_email,
        "phone": data.phone,
        "is_active": True,
        "created_at": now.isoformat(),
        "updated_at": now.isoformat()
    }
    
    await db.enterprise_branches.insert_one(branch)
    
    return {
        "success": True,
        "branch_id": branch_id,
        "message": f"Filiale '{data.name}' erfolgreich erstellt"
    }


@router.get("/branches")
async def list_branches(authorization: str = Header(None)):
    """List all branches for the enterprise."""
    enterprise = await get_enterprise_from_token(authorization)
    
    # Check if user has branch restriction
    current_user = enterprise.get("current_user")
    query = {"enterprise_id": enterprise["id"]}
    
    if current_user and current_user.get("role") == "branch_manager":
        query["id"] = current_user.get("branch_id")
    
    branches = await db.enterprise_branches.find(query, {"_id": 0}).to_list(100)
    
    # Add stats per branch
    for branch in branches:
        branch["api_keys_count"] = await db.enterprise_api_keys.count_documents({
            "enterprise_id": enterprise["id"],
            "branch_id": branch["id"]
        })
        
        # Get branch revenue
        revenue = await db.digital_payments.aggregate([
            {"$match": {"enterprise_id": enterprise["id"], "branch_id": branch["id"]}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]).to_list(1)
        branch["total_revenue"] = revenue[0]["total"] if revenue else 0
    
    return {"branches": branches, "total": len(branches)}


@router.put("/branches/{branch_id}")
async def update_branch(branch_id: str, data: BranchUpdate, authorization: str = Header(None)):
    """Update a branch."""
    enterprise = await get_enterprise_from_token(authorization)
    
    update_data = {k: v for k, v in data.dict().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="Keine Änderungen angegeben")
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.enterprise_branches.update_one(
        {"id": branch_id, "enterprise_id": enterprise["id"]},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Filiale nicht gefunden")
    
    return {"success": True, "message": "Filiale aktualisiert"}


@router.delete("/branches/{branch_id}")
async def delete_branch(branch_id: str, authorization: str = Header(None)):
    """Delete a branch (soft delete by deactivating)."""
    enterprise = await get_enterprise_from_token(authorization)
    
    # Deactivate branch and all its API keys
    await db.enterprise_branches.update_one(
        {"id": branch_id, "enterprise_id": enterprise["id"]},
        {"$set": {"is_active": False, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    await db.enterprise_api_keys.update_many(
        {"branch_id": branch_id},
        {"$set": {"is_active": False}}
    )
    
    return {"success": True, "message": "Filiale deaktiviert"}


# ==================== CASH REGISTER / API KEY MANAGEMENT ====================

@router.post("/api-keys")
async def create_api_key(data: CashRegisterCreate, authorization: str = Header(None)):
    """Create a new API key for a cash register."""
    enterprise = await get_enterprise_from_token(authorization)
    
    # Verify branch belongs to enterprise
    branch = await db.enterprise_branches.find_one({
        "id": data.branch_id,
        "enterprise_id": enterprise["id"]
    })
    
    if not branch:
        raise HTTPException(status_code=404, detail="Filiale nicht gefunden")
    
    key_id = f"key_{uuid.uuid4().hex[:12]}"
    api_key = generate_api_key()
    secret_key = generate_secret_key()
    now = datetime.now(timezone.utc)
    
    key_doc = {
        "id": key_id,
        "enterprise_id": enterprise["id"],
        "branch_id": data.branch_id,
        "branch_name": branch["name"],
        "name": data.name,
        "description": data.description,
        "api_key": api_key,
        "secret_key": secret_key,
        "is_active": True,
        "total_volume": 0,
        "total_transactions": 0,
        "created_at": now.isoformat(),
        "last_used_at": None
    }
    
    await db.enterprise_api_keys.insert_one(key_doc)
    
    # Also create in the main api_keys collection for compatibility
    await db.api_keys.insert_one({
        "id": key_id,
        "key": api_key,
        "secret": secret_key,
        "name": f"{enterprise['company_name']} - {branch['name']} - {data.name}",
        "enterprise_id": enterprise["id"],
        "branch_id": data.branch_id,
        "is_active": True,
        "total_volume": 0,
        "created_at": now.isoformat()
    })
    
    return {
        "success": True,
        "key_id": key_id,
        "api_key": api_key,
        "secret_key": secret_key,
        "message": f"⚠️ Speichern Sie diese Schlüssel jetzt! Der Secret-Key wird nicht erneut angezeigt."
    }


@router.get("/api-keys")
async def list_api_keys(
    branch_id: Optional[str] = None,
    authorization: str = Header(None)
):
    """List all API keys for the enterprise."""
    enterprise = await get_enterprise_from_token(authorization)
    
    query = {"enterprise_id": enterprise["id"]}
    
    # Check user's branch restriction
    current_user = enterprise.get("current_user")
    if current_user:
        if current_user.get("role") == "branch_manager":
            query["branch_id"] = current_user.get("branch_id")
        elif current_user.get("role") == "cashier":
            # Cashiers can only see their own branch
            query["branch_id"] = current_user.get("branch_id")
    
    if branch_id:
        query["branch_id"] = branch_id
    
    keys = await db.enterprise_api_keys.find(query, {"_id": 0, "secret_key": 0}).to_list(200)
    
    return {"api_keys": keys, "total": len(keys)}


@router.put("/api-keys/{key_id}/toggle")
async def toggle_api_key(key_id: str, authorization: str = Header(None)):
    """Activate or deactivate an API key."""
    enterprise = await get_enterprise_from_token(authorization)
    
    key = await db.enterprise_api_keys.find_one({
        "id": key_id,
        "enterprise_id": enterprise["id"]
    })
    
    if not key:
        raise HTTPException(status_code=404, detail="API-Key nicht gefunden")
    
    new_status = not key.get("is_active", True)
    
    # Update both collections
    await db.enterprise_api_keys.update_one(
        {"id": key_id},
        {"$set": {"is_active": new_status}}
    )
    
    await db.api_keys.update_one(
        {"id": key_id},
        {"$set": {"is_active": new_status}}
    )
    
    status_text = "aktiviert" if new_status else "deaktiviert"
    return {"success": True, "is_active": new_status, "message": f"API-Key {status_text}"}


@router.delete("/api-keys/{key_id}")
async def delete_api_key(key_id: str, authorization: str = Header(None)):
    """Delete an API key."""
    enterprise = await get_enterprise_from_token(authorization)
    
    result = await db.enterprise_api_keys.delete_one({
        "id": key_id,
        "enterprise_id": enterprise["id"]
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="API-Key nicht gefunden")
    
    # Also delete from main collection
    await db.api_keys.delete_one({"id": key_id})
    
    return {"success": True, "message": "API-Key gelöscht"}


# ==================== USER MANAGEMENT ====================

@router.post("/users")
async def create_user(data: UserCreate, authorization: str = Header(None)):
    """Create a new user for the enterprise."""
    enterprise = await get_enterprise_from_token(authorization)
    
    # Only admin can create users
    current_user = enterprise.get("current_user")
    if current_user and current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Nur Administratoren können Benutzer erstellen")
    
    # Check if email already exists
    existing = await db.enterprise_users.find_one({"email": data.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="E-Mail bereits vergeben")
    
    # Validate role
    if data.role not in ["admin", "branch_manager", "cashier", "tax_advisor"]:
        raise HTTPException(status_code=400, detail="Ungültige Rolle")
    
    # Branch required for branch_manager and cashier (not for admin or tax_advisor)
    if data.role in ["branch_manager", "cashier"] and not data.branch_id:
        raise HTTPException(status_code=400, detail="Filiale erforderlich für diese Rolle")
    
    # Verify branch if provided
    if data.branch_id:
        branch = await db.enterprise_branches.find_one({
            "id": data.branch_id,
            "enterprise_id": enterprise["id"]
        })
        if not branch:
            raise HTTPException(status_code=404, detail="Filiale nicht gefunden")
    
    user_id = f"euser_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)
    
    user = {
        "id": user_id,
        "enterprise_id": enterprise["id"],
        "name": data.name,
        "email": data.email.lower(),
        "password": hash_password(data.password),
        "role": data.role,
        "branch_id": data.branch_id,
        "is_active": True,
        "created_at": now.isoformat()
    }
    
    await db.enterprise_users.insert_one(user)
    
    role_names = {"admin": "Administrator", "branch_manager": "Filialleiter", "cashier": "Kassierer", "tax_advisor": "Steuerberater"}
    
    return {
        "success": True,
        "user_id": user_id,
        "message": f"{role_names[data.role]} '{data.name}' erfolgreich erstellt"
    }


@router.get("/users")
async def list_users(authorization: str = Header(None)):
    """List all users for the enterprise."""
    enterprise = await get_enterprise_from_token(authorization)
    
    # Only admin can see all users
    current_user = enterprise.get("current_user")
    if current_user and current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Zugriff verweigert")
    
    users = await db.enterprise_users.find(
        {"enterprise_id": enterprise["id"]},
        {"_id": 0, "password": 0}
    ).to_list(100)
    
    # Add branch names
    for user in users:
        if user.get("branch_id"):
            branch = await db.enterprise_branches.find_one(
                {"id": user["branch_id"]},
                {"_id": 0, "name": 1}
            )
            user["branch_name"] = branch["name"] if branch else "Unbekannt"
    
    return {"users": users, "total": len(users)}


@router.put("/users/{user_id}")
async def update_user(user_id: str, data: UserUpdate, authorization: str = Header(None)):
    """Update a user."""
    enterprise = await get_enterprise_from_token(authorization)
    
    update_data = {k: v for k, v in data.dict().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="Keine Änderungen angegeben")
    
    result = await db.enterprise_users.update_one(
        {"id": user_id, "enterprise_id": enterprise["id"]},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Benutzer nicht gefunden")
    
    return {"success": True, "message": "Benutzer aktualisiert"}


@router.delete("/users/{user_id}")
async def delete_user(user_id: str, authorization: str = Header(None)):
    """Delete a user."""
    enterprise = await get_enterprise_from_token(authorization)
    
    result = await db.enterprise_users.delete_one({
        "id": user_id,
        "enterprise_id": enterprise["id"]
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Benutzer nicht gefunden")
    
    return {"success": True, "message": "Benutzer gelöscht"}


# ==================== REPORTS ====================

@router.get("/reports/overview")
async def get_reports_overview(
    period: str = Query("month", description="day, week, month, year"),
    branch_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    authorization: str = Header(None)
):
    """Get overview statistics for the enterprise."""
    enterprise = await get_enterprise_from_token(authorization)
    
    # Calculate date range
    now = datetime.now(timezone.utc)
    
    # Custom date range takes priority
    if date_from and date_to:
        try:
            start_date = datetime.fromisoformat(date_from).replace(tzinfo=timezone.utc)
            end_date = datetime.fromisoformat(date_to).replace(hour=23, minute=59, second=59, tzinfo=timezone.utc)
        except ValueError:
            start_date = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            end_date = now
    else:
        end_date = now
        if period == "day":
            start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
        elif period == "week":
            start_date = now - timedelta(days=now.weekday())
            start_date = start_date.replace(hour=0, minute=0, second=0, microsecond=0)
        elif period == "month":
            start_date = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        else:  # year
            start_date = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
    
    # Build query based on user's access
    query = {"enterprise_id": enterprise["id"]}
    current_user = enterprise.get("current_user")
    
    if current_user and current_user.get("role") == "branch_manager":
        query["branch_id"] = current_user.get("branch_id")
    elif branch_id:
        query["branch_id"] = branch_id
    
    # Get all API keys for this enterprise/branch
    api_keys = await db.enterprise_api_keys.find(query, {"_id": 0, "api_key": 1}).to_list(200)
    api_key_values = [k["api_key"] for k in api_keys]
    
    # Query payments using api_key field
    payment_query = {
        "api_key": {"$in": api_key_values},
        "created_at": {"$gte": start_date.isoformat()}
    }
    
    # Aggregate stats
    pipeline = [
        {"$match": {"api_key": {"$in": api_key_values}}},
        {"$addFields": {
            "created_date": {"$dateFromString": {"dateString": "$created_at"}}
        }},
        {"$match": {"created_date": {"$gte": start_date}}},
        {"$group": {
            "_id": None,
            "total_revenue": {"$sum": "$amount"},
            "total_transactions": {"$sum": 1},
            "total_commission": {"$sum": {"$ifNull": ["$merchant_commission", 0]}},
            "total_bonus_given": {"$sum": {"$ifNull": ["$customer_bonus", 0]}}
        }}
    ]
    
    result = await db.digital_payments.aggregate(pipeline).to_list(1)
    stats = result[0] if result else {
        "total_revenue": 0,
        "total_transactions": 0,
        "total_commission": 0,
        "total_bonus_given": 0
    }
    
    # Get cashback stats
    cashback_pipeline = [
        {"$match": {"enterprise_id": enterprise["id"]}},
        {"$group": {
            "_id": None,
            "total_cashback": {"$sum": "$cashback_amount"}
        }}
    ]
    cashback_result = await db.cashback_transactions.aggregate(cashback_pipeline).to_list(1)
    total_cashback = cashback_result[0]["total_cashback"] if cashback_result else 0
    
    # Branch comparison
    branch_stats = []
    if not branch_id and (not current_user or current_user.get("role") == "admin"):
        branches = await db.enterprise_branches.find(
            {"enterprise_id": enterprise["id"], "is_active": True},
            {"_id": 0}
        ).to_list(50)
        
        for branch in branches:
            branch_keys = await db.enterprise_api_keys.find(
                {"branch_id": branch["id"]},
                {"_id": 0, "api_key": 1}
            ).to_list(50)
            branch_key_values = [k["api_key"] for k in branch_keys]
            
            branch_pipeline = [
                {"$match": {"api_key": {"$in": branch_key_values}}},
                {"$group": {
                    "_id": None,
                    "revenue": {"$sum": "$amount"},
                    "transactions": {"$sum": 1}
                }}
            ]
            branch_result = await db.digital_payments.aggregate(branch_pipeline).to_list(1)
            
            branch_stats.append({
                "branch_id": branch["id"],
                "branch_name": branch["name"],
                "revenue": branch_result[0]["revenue"] if branch_result else 0,
                "transactions": branch_result[0]["transactions"] if branch_result else 0
            })
        
        # Sort by revenue descending
        branch_stats.sort(key=lambda x: x["revenue"], reverse=True)
    
    return {
        "period": period,
        "start_date": start_date.isoformat(),
        "end_date": now.isoformat(),
        "stats": {
            "total_revenue": stats.get("total_revenue", 0),
            "total_transactions": stats.get("total_transactions", 0),
            "total_commission": stats.get("total_commission", 0),
            "total_bonus_given": stats.get("total_bonus_given", 0),
            "total_cashback": total_cashback
        },
        "branch_comparison": branch_stats[:10]  # Top 10 branches
    }


@router.get("/reports/transactions")
async def get_transactions_report(
    period: str = Query("month", description="day, week, month, year"),
    branch_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(50, le=200),
    authorization: str = Header(None)
):
    """Get detailed transactions report."""
    enterprise = await get_enterprise_from_token(authorization)
    
    # Calculate date range
    now = datetime.now(timezone.utc)
    
    # Custom date range takes priority
    if date_from and date_to:
        try:
            start_date = datetime.fromisoformat(date_from).replace(tzinfo=timezone.utc)
            end_date = datetime.fromisoformat(date_to).replace(hour=23, minute=59, second=59, tzinfo=timezone.utc)
        except ValueError:
            start_date = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            end_date = now
    else:
        end_date = now
        if period == "day":
            start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
        elif period == "week":
            start_date = now - timedelta(days=now.weekday())
            start_date = start_date.replace(hour=0, minute=0, second=0, microsecond=0)
        elif period == "month":
            start_date = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        else:  # year
            start_date = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
    
    # Build query
    query = {"enterprise_id": enterprise["id"]}
    current_user = enterprise.get("current_user")
    
    if current_user and current_user.get("role") in ["branch_manager", "cashier"]:
        query["branch_id"] = current_user.get("branch_id")
    elif branch_id:
        query["branch_id"] = branch_id
    
    # Get API keys
    api_keys = await db.enterprise_api_keys.find(query, {"_id": 0, "api_key": 1, "name": 1, "branch_name": 1}).to_list(200)
    api_key_map = {k["api_key"]: k for k in api_keys}
    api_key_values = list(api_key_map.keys())
    
    # Get transactions
    skip = (page - 1) * limit
    transactions = await db.digital_payments.find(
        {"api_key": {"$in": api_key_values}},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Enrich with branch/register info
    for tx in transactions:
        key_info = api_key_map.get(tx.get("api_key"), {})
        tx["register_name"] = key_info.get("name", "Unbekannt")
        tx["branch_name"] = key_info.get("branch_name", "Unbekannt")
    
    total = await db.digital_payments.count_documents({"api_key": {"$in": api_key_values}})
    
    return {
        "transactions": transactions,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit
    }


@router.get("/reports/export")
async def export_report(
    format: str = Query("csv", description="csv or pdf"),
    period: str = Query("month", description="day, week, month, year"),
    branch_id: Optional[str] = None,
    authorization: str = Header(None)
):
    """Export report as CSV or PDF."""
    enterprise = await get_enterprise_from_token(authorization)
    
    # Calculate date range
    now = datetime.now(timezone.utc)
    if period == "day":
        start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
        period_name = now.strftime("%d.%m.%Y")
    elif period == "week":
        start_date = now - timedelta(days=now.weekday())
        start_date = start_date.replace(hour=0, minute=0, second=0, microsecond=0)
        period_name = f"KW{now.isocalendar()[1]}_{now.year}"
    elif period == "month":
        start_date = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        period_name = now.strftime("%m_%Y")
    else:  # year
        start_date = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
        period_name = str(now.year)
    
    # Build query
    query = {"enterprise_id": enterprise["id"]}
    if branch_id:
        query["branch_id"] = branch_id
    
    # Get API keys
    api_keys = await db.enterprise_api_keys.find(query, {"_id": 0, "api_key": 1, "name": 1, "branch_name": 1}).to_list(200)
    api_key_map = {k["api_key"]: k for k in api_keys}
    api_key_values = list(api_key_map.keys())
    
    # Get all transactions for the period
    transactions = await db.digital_payments.find(
        {"api_key": {"$in": api_key_values}},
        {"_id": 0}
    ).sort("created_at", -1).to_list(10000)
    
    if format == "csv":
        # Create CSV
        output = io.StringIO()
        writer = csv.writer(output, delimiter=';')
        
        # Header
        writer.writerow([
            "Datum", "Uhrzeit", "Filiale", "Kasse", "Typ", "Betrag (€)", 
            "Bonus (€)", "Gesamt (€)", "Provision (€)", "Kunde", "Referenz"
        ])
        
        # Data rows
        for tx in transactions:
            key_info = api_key_map.get(tx.get("api_key"), {})
            created = tx.get("created_at", "")
            if created:
                dt = datetime.fromisoformat(created.replace("Z", "+00:00"))
                date_str = dt.strftime("%d.%m.%Y")
                time_str = dt.strftime("%H:%M:%S")
            else:
                date_str = time_str = ""
            
            writer.writerow([
                date_str,
                time_str,
                key_info.get("branch_name", ""),
                key_info.get("name", ""),
                tx.get("type", "payment"),
                f"{tx.get('amount', 0):.2f}",
                f"{tx.get('customer_bonus', 0):.2f}",
                f"{tx.get('total_credited', tx.get('amount', 0)):.2f}",
                f"{tx.get('merchant_commission', 0):.2f}",
                tx.get("customer_name", ""),
                tx.get("reference", "")
            ])
        
        output.seek(0)
        filename = f"bericht_{enterprise['company_name']}_{period_name}.csv"
        
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    
    else:  # PDF
        # For PDF, we return HTML that can be printed/saved as PDF
        # (Full PDF generation would require additional libraries)
        
        # Calculate totals
        total_amount = sum(tx.get("amount", 0) for tx in transactions)
        total_bonus = sum(tx.get("customer_bonus", 0) for tx in transactions)
        total_commission = sum(tx.get("merchant_commission", 0) for tx in transactions)
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Bericht - {enterprise['company_name']}</title>
            <style>
                body {{ font-family: Arial, sans-serif; margin: 40px; }}
                h1 {{ color: #f59e0b; }}
                table {{ width: 100%; border-collapse: collapse; margin-top: 20px; }}
                th, td {{ border: 1px solid #ddd; padding: 8px; text-align: left; }}
                th {{ background-color: #f59e0b; color: white; }}
                tr:nth-child(even) {{ background-color: #f9f9f9; }}
                .summary {{ background: #f0f0f0; padding: 20px; margin: 20px 0; border-radius: 8px; }}
                .summary h3 {{ margin-top: 0; }}
                @media print {{ body {{ margin: 20px; }} }}
            </style>
        </head>
        <body>
            <h1>📊 {enterprise['company_name']} - Bericht</h1>
            <p><strong>Zeitraum:</strong> {period_name}</p>
            <p><strong>Erstellt:</strong> {now.strftime("%d.%m.%Y %H:%M")}</p>
            
            <div class="summary">
                <h3>Zusammenfassung</h3>
                <p><strong>Transaktionen:</strong> {len(transactions)}</p>
                <p><strong>Gesamtumsatz:</strong> €{total_amount:.2f}</p>
                <p><strong>Gesamt-Bonus ausgegeben:</strong> €{total_bonus:.2f}</p>
                <p><strong>Ihre Provision:</strong> €{total_commission:.2f}</p>
            </div>
            
            <h2>Transaktionen</h2>
            <table>
                <tr>
                    <th>Datum</th>
                    <th>Filiale</th>
                    <th>Kasse</th>
                    <th>Typ</th>
                    <th>Betrag</th>
                    <th>Bonus</th>
                    <th>Provision</th>
                </tr>
        """
        
        for tx in transactions[:100]:  # Limit to 100 for HTML
            key_info = api_key_map.get(tx.get("api_key"), {})
            created = tx.get("created_at", "")
            if created:
                dt = datetime.fromisoformat(created.replace("Z", "+00:00"))
                date_str = dt.strftime("%d.%m.%Y %H:%M")
            else:
                date_str = ""
            
            html_content += f"""
                <tr>
                    <td>{date_str}</td>
                    <td>{key_info.get("branch_name", "")}</td>
                    <td>{key_info.get("name", "")}</td>
                    <td>{tx.get("type", "payment")}</td>
                    <td>€{tx.get("amount", 0):.2f}</td>
                    <td>€{tx.get("customer_bonus", 0):.2f}</td>
                    <td>€{tx.get("merchant_commission", 0):.2f}</td>
                </tr>
            """
        
        html_content += """
            </table>
            <p style="margin-top: 40px; color: #666; font-size: 12px;">
                Generiert von BidBlitz Enterprise Portal | www.bidblitz.ae
            </p>
        </body>
        </html>
        """
        
        return StreamingResponse(
            iter([html_content]),
            media_type="text/html",
            headers={"Content-Disposition": f"inline; filename=bericht_{period_name}.html"}
        )


@router.get("/reports/peak-hours")
async def get_peak_hours_analysis(
    period: str = Query("month", description="day, week, month, year"),
    branch_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    authorization: str = Header(None)
):
    """
    Stoßzeiten-Analyse - zeigt welche Uhrzeiten am meisten Aktivität haben.
    Für Personalplanung und Optimierung.
    """
    enterprise = await get_enterprise_from_token(authorization)
    
    # Calculate date range
    now = datetime.now(timezone.utc)
    
    if date_from and date_to:
        try:
            start_date = datetime.fromisoformat(date_from).replace(tzinfo=timezone.utc)
            end_date = datetime.fromisoformat(date_to).replace(hour=23, minute=59, second=59, tzinfo=timezone.utc)
        except ValueError:
            start_date = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            end_date = now
    else:
        end_date = now
        if period == "day":
            start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
        elif period == "week":
            start_date = now - timedelta(days=now.weekday())
            start_date = start_date.replace(hour=0, minute=0, second=0, microsecond=0)
        elif period == "month":
            start_date = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        else:  # year
            start_date = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
    
    # Build query
    query = {"enterprise_id": enterprise["id"]}
    if branch_id:
        query["branch_id"] = branch_id
    
    # Get API keys
    api_keys = await db.enterprise_api_keys.find(query, {"_id": 0, "api_key": 1}).to_list(200)
    api_key_values = [k["api_key"] for k in api_keys]
    
    if not api_key_values:
        return {
            "hourly_data": [],
            "daily_data": [],
            "peak_hour": None,
            "peak_day": None,
            "total_transactions": 0
        }
    
    # Get transactions
    transactions = await db.digital_payments.find({
        "api_key": {"$in": api_key_values},
        "created_at": {"$gte": start_date.isoformat(), "$lte": end_date.isoformat()}
    }).to_list(10000)
    
    # Analyze by hour (0-23)
    hourly_counts = {h: {"count": 0, "revenue": 0} for h in range(24)}
    daily_counts = {d: {"count": 0, "revenue": 0} for d in range(7)}  # 0=Monday, 6=Sunday
    
    for tx in transactions:
        try:
            tx_time = datetime.fromisoformat(tx.get("created_at", "").replace("Z", "+00:00"))
            hour = tx_time.hour
            weekday = tx_time.weekday()
            amount = tx.get("amount", 0)
            
            hourly_counts[hour]["count"] += 1
            hourly_counts[hour]["revenue"] += amount
            
            daily_counts[weekday]["count"] += 1
            daily_counts[weekday]["revenue"] += amount
        except:
            continue
    
    # Format hourly data
    hourly_data = []
    for hour in range(24):
        hourly_data.append({
            "hour": hour,
            "label": f"{hour:02d}:00",
            "transactions": hourly_counts[hour]["count"],
            "revenue": round(hourly_counts[hour]["revenue"], 2)
        })
    
    # Format daily data
    day_names = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"]
    day_names_short = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"]
    daily_data = []
    for day in range(7):
        daily_data.append({
            "day": day,
            "name": day_names[day],
            "short": day_names_short[day],
            "transactions": daily_counts[day]["count"],
            "revenue": round(daily_counts[day]["revenue"], 2)
        })
    
    # Find peak hour
    peak_hour = max(hourly_data, key=lambda x: x["transactions"]) if hourly_data else None
    
    # Find peak day
    peak_day = max(daily_data, key=lambda x: x["transactions"]) if daily_data else None
    
    # Calculate busy periods
    busy_periods = []
    for h in hourly_data:
        if h["transactions"] > 0:
            avg = sum(x["transactions"] for x in hourly_data) / 24
            if h["transactions"] >= avg * 1.5:
                busy_periods.append({
                    "time": h["label"],
                    "level": "sehr hoch" if h["transactions"] >= avg * 2 else "hoch"
                })
    
    return {
        "hourly_data": hourly_data,
        "daily_data": daily_data,
        "peak_hour": peak_hour,
        "peak_day": peak_day,
        "busy_periods": busy_periods,
        "total_transactions": len(transactions),
        "total_revenue": round(sum(tx.get("amount", 0) for tx in transactions), 2),
        "period": {
            "from": start_date.isoformat(),
            "to": end_date.isoformat()
        }
    }


# ==================== ADMIN ENDPOINTS ====================

class PayoutSettings(BaseModel):
    iban: Optional[str] = None
    iban_holder: Optional[str] = None
    bic_swift: Optional[str] = None  # BIC/SWIFT code for international transfers
    bank_name: Optional[str] = None  # Bank name
    bank_country: Optional[str] = None  # Bank country (ISO 2-letter code, e.g., DE, AT, US)
    payout_frequency: str = "monthly"  # daily, weekly, monthly, manual
    iban_mode: str = "admin_entry"  # admin_entry, self_entry
    min_payout_amount: int = 100
    currency: str = "EUR"  # Target currency for payouts

class CommissionSettings(BaseModel):
    voucher_commission: float = 5.0  # % commission for vouchers (Händler → BidBlitz)
    self_pay_commission: float = 3.0  # % commission when customer pays directly (BidBlitz → Händler)
    sales_commission: float = 2.0  # % commission on sales/transactions (Händler → BidBlitz)
    customer_cashback: float = 1.0  # % cashback to customers (BidBlitz → Kunde)
    is_active: bool = True

@router.get("/admin/list")
async def list_all_enterprises(x_admin_key: str = Header(...)):
    """Admin: Get list of all enterprise accounts with enriched data."""
    if x_admin_key != "bidblitz-admin-2026":
        raise HTTPException(status_code=403, detail="Ungültiger Admin-Key")
    
    enterprises = await db.enterprise_accounts.find(
        {},
        {"_id": 0, "password": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Enrich with counts and stats
    for enterprise in enterprises:
        ent_id = enterprise["id"]
        
        # Count branches, api keys, users
        enterprise["branch_count"] = await db.enterprise_branches.count_documents({"enterprise_id": ent_id})
        enterprise["api_key_count"] = await db.enterprise_api_keys.count_documents({"enterprise_id": ent_id})
        enterprise["user_count"] = await db.enterprise_users.count_documents({"enterprise_id": ent_id})
        
        # Get payout settings
        payout = await db.enterprise_payout_settings.find_one(
            {"enterprise_id": ent_id},
            {"_id": 0}
        )
        enterprise["payout_settings"] = payout or {
            "iban_mode": "admin_entry",
            "payout_frequency": "monthly",
            "min_payout_amount": 100
        }
        
        # Get commission settings
        commission = await db.enterprise_commission_settings.find_one(
            {"enterprise_id": ent_id},
            {"_id": 0}
        )
        enterprise["commission_settings"] = commission or {
            "voucher_commission": 5.0,
            "self_pay_commission": 3.0,
            "sales_commission": 2.0,
            "customer_cashback": 1.0,
            "is_active": True
        }
        
        # Calculate revenue (from transactions via API keys)
        api_keys = await db.enterprise_api_keys.find(
            {"enterprise_id": ent_id},
            {"_id": 0, "api_key": 1}
        ).to_list(100)
        
        key_list = [k["api_key"] for k in api_keys]
        
        if key_list:
            # Sum up topup transactions
            pipeline = [
                {"$match": {"api_key": {"$in": key_list}, "type": "topup"}},
                {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
            ]
            result = await db.enterprise_transactions.aggregate(pipeline).to_list(1)
            enterprise["total_revenue"] = result[0]["total"] if result else 0
        else:
            enterprise["total_revenue"] = 0
        
        # Use individual commission rate if set
        commission_rate = enterprise["commission_settings"].get("voucher_commission", 5.0) / 100
        enterprise["pending_commission"] = round(enterprise["total_revenue"] * commission_rate, 2)
    
    return {"enterprises": enterprises, "total": len(enterprises)}


@router.put("/admin/payout-settings/{enterprise_id}")
async def update_payout_settings(enterprise_id: str, data: PayoutSettings, x_admin_key: str = Header(...)):
    """Admin: Update payout settings for an enterprise."""
    if x_admin_key != "bidblitz-admin-2026":
        raise HTTPException(status_code=403, detail="Ungültiger Admin-Key")
    
    # Verify enterprise exists
    enterprise = await db.enterprise_accounts.find_one({"id": enterprise_id})
    if not enterprise:
        raise HTTPException(status_code=404, detail="Unternehmen nicht gefunden")
    
    # Validate IBAN format if provided
    if data.iban:
        # Basic IBAN validation (remove spaces, check length)
        iban_clean = data.iban.replace(" ", "").upper()
        if len(iban_clean) < 15 or len(iban_clean) > 34:
            raise HTTPException(status_code=400, detail="Ungültige IBAN-Länge")
        data.iban = iban_clean
    
    now = datetime.now(timezone.utc)
    
    settings_data = {
        "enterprise_id": enterprise_id,
        "iban": data.iban,
        "iban_holder": data.iban_holder,
        "bic_swift": data.bic_swift,
        "bank_name": data.bank_name,
        "bank_country": data.bank_country,
        "payout_frequency": data.payout_frequency,
        "iban_mode": data.iban_mode,
        "min_payout_amount": data.min_payout_amount,
        "currency": data.currency,
        "updated_at": now.isoformat(),
        "updated_by": "admin"
    }
    
    # Upsert settings
    await db.enterprise_payout_settings.update_one(
        {"enterprise_id": enterprise_id},
        {"$set": settings_data, "$setOnInsert": {"created_at": now.isoformat()}},
        upsert=True
    )
    
    return {"success": True, "message": "Auszahlungseinstellungen gespeichert"}


@router.put("/admin/commission-settings/{enterprise_id}")
async def update_commission_settings(enterprise_id: str, data: CommissionSettings, x_admin_key: str = Header(...)):
    """Admin: Update commission settings for an enterprise."""
    if x_admin_key != "bidblitz-admin-2026":
        raise HTTPException(status_code=403, detail="Ungültiger Admin-Key")
    
    # Verify enterprise exists
    enterprise = await db.enterprise_accounts.find_one({"id": enterprise_id})
    if not enterprise:
        raise HTTPException(status_code=404, detail="Unternehmen nicht gefunden")
    
    # Validate percentages
    if not (0 <= data.voucher_commission <= 100):
        raise HTTPException(status_code=400, detail="Gutschein-Provision muss zwischen 0 und 100% liegen")
    if not (0 <= data.self_pay_commission <= 100):
        raise HTTPException(status_code=400, detail="Aufladung-Provision muss zwischen 0 und 100% liegen")
    if not (0 <= data.sales_commission <= 100):
        raise HTTPException(status_code=400, detail="Verkaufs-Provision muss zwischen 0 und 100% liegen")
    if not (0 <= data.customer_cashback <= 100):
        raise HTTPException(status_code=400, detail="Kunden-Cashback muss zwischen 0 und 100% liegen")
    
    now = datetime.now(timezone.utc)
    
    settings_data = {
        "enterprise_id": enterprise_id,
        "voucher_commission": data.voucher_commission,
        "self_pay_commission": data.self_pay_commission,
        "sales_commission": data.sales_commission,
        "customer_cashback": data.customer_cashback,
        "is_active": data.is_active,
        "updated_at": now.isoformat(),
        "updated_by": "admin"
    }
    
    # Upsert settings
    await db.enterprise_commission_settings.update_one(
        {"enterprise_id": enterprise_id},
        {"$set": settings_data, "$setOnInsert": {"created_at": now.isoformat()}},
        upsert=True
    )
    
    return {"success": True, "message": "Provisionseinstellungen gespeichert"}


@router.get("/admin/commission-settings/{enterprise_id}")
async def get_commission_settings(enterprise_id: str, x_admin_key: str = Header(...)):
    """Admin: Get commission settings for an enterprise."""
    if x_admin_key != "bidblitz-admin-2026":
        raise HTTPException(status_code=403, detail="Ungültiger Admin-Key")
    
    settings = await db.enterprise_commission_settings.find_one(
        {"enterprise_id": enterprise_id},
        {"_id": 0}
    )
    
    if not settings:
        settings = {
            "enterprise_id": enterprise_id,
            "voucher_commission": 5.0,
            "self_pay_commission": 3.0,
            "sales_commission": 2.0,
            "customer_cashback": 1.0,
            "is_active": True
        }
    
    return settings


@router.get("/admin/payout-settings/{enterprise_id}")
async def get_payout_settings(enterprise_id: str, x_admin_key: str = Header(...)):
    """Admin: Get payout settings for an enterprise."""
    if x_admin_key != "bidblitz-admin-2026":
        raise HTTPException(status_code=403, detail="Ungültiger Admin-Key")
    
    settings = await db.enterprise_payout_settings.find_one(
        {"enterprise_id": enterprise_id},
        {"_id": 0}
    )
    
    if not settings:
        settings = {
            "enterprise_id": enterprise_id,
            "iban_mode": "admin_entry",
            "payout_frequency": "monthly",
            "min_payout_amount": 100
        }
    
    return settings


@router.get("/admin/pending")
async def get_pending_enterprises(x_admin_key: str = Header(...)):
    """Admin: Get list of pending enterprise registrations."""
    if x_admin_key != "bidblitz-admin-2026":
        raise HTTPException(status_code=403, detail="Ungültiger Admin-Key")
    
    pending = await db.enterprise_accounts.find(
        {"status": "pending"},
        {"_id": 0, "password": 0}
    ).to_list(50)
    
    return {"pending": pending, "total": len(pending)}


class AdminEnterpriseCreate(BaseModel):
    """Model for admin-created enterprise accounts."""
    company_name: str
    email: str
    password: str
    contact_person: str = ""
    phone: str = ""
    address: str = ""
    tax_id: str = ""
    auto_approve: bool = True  # Admin can auto-approve


@router.post("/admin/create")
async def admin_create_enterprise(data: AdminEnterpriseCreate, x_admin_key: str = Header(...)):
    """Admin: Create a new enterprise account directly (bypasses registration)."""
    if x_admin_key != "bidblitz-admin-2026":
        raise HTTPException(status_code=403, detail="Ungültiger Admin-Key")
    
    # Check if email already exists
    existing = await db.enterprise_accounts.find_one({"email": data.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="E-Mail bereits registriert")
    
    enterprise_id = f"ent_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)
    
    enterprise = {
        "id": enterprise_id,
        "company_name": data.company_name,
        "email": data.email.lower(),
        "password": hash_password(data.password),
        "contact_person": data.contact_person,
        "phone": data.phone,
        "address": data.address,
        "tax_id": data.tax_id,
        "status": "approved" if data.auto_approve else "pending",
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
        "created_by_admin": True
    }
    
    if data.auto_approve:
        enterprise["approved_at"] = now.isoformat()
    
    await db.enterprise_accounts.insert_one(enterprise)
    
    return {
        "success": True,
        "enterprise_id": enterprise_id,
        "status": enterprise["status"],
        "message": f"Händler '{data.company_name}' erfolgreich erstellt"
    }


@router.post("/admin/approve/{enterprise_id}")
async def approve_enterprise(enterprise_id: str, x_admin_key: str = Header(...)):
    """Admin: Approve an enterprise registration."""
    if x_admin_key != "bidblitz-admin-2026":
        raise HTTPException(status_code=403, detail="Ungültiger Admin-Key")
    
    result = await db.enterprise_accounts.update_one(
        {"id": enterprise_id, "status": "pending"},
        {"$set": {"status": "approved", "approved_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Unternehmen nicht gefunden oder bereits genehmigt")
    
    return {"success": True, "message": "Unternehmen freigeschaltet"}


@router.post("/admin/suspend/{enterprise_id}")
async def suspend_enterprise(enterprise_id: str, x_admin_key: str = Header(...)):
    """Admin: Suspend an enterprise account."""
    if x_admin_key != "bidblitz-admin-2026":
        raise HTTPException(status_code=403, detail="Ungültiger Admin-Key")
    
    result = await db.enterprise_accounts.update_one(
        {"id": enterprise_id},
        {"$set": {"status": "suspended", "suspended_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Unternehmen nicht gefunden")
    
    return {"success": True, "message": "Unternehmen gesperrt"}


# ==================== SEPA PAYOUT ENDPOINTS ====================

class PayoutCreate(BaseModel):
    enterprise_id: str
    amount: float
    note: Optional[str] = None

@router.get("/admin/payouts/pending")
async def get_pending_payouts(x_admin_key: str = Header(...)):
    """Admin: Get list of all pending payouts based on frequency settings."""
    if x_admin_key != "bidblitz-admin-2026":
        raise HTTPException(status_code=403, detail="Ungültiger Admin-Key")
    
    now = datetime.now(timezone.utc)
    pending_payouts = []
    
    # Get all approved enterprises
    enterprises = await db.enterprise_accounts.find(
        {"status": "approved"},
        {"_id": 0, "password": 0}
    ).to_list(100)
    
    for enterprise in enterprises:
        ent_id = enterprise["id"]
        
        # Get payout settings
        payout_settings = await db.enterprise_payout_settings.find_one(
            {"enterprise_id": ent_id},
            {"_id": 0}
        ) or {"payout_frequency": "monthly", "min_payout_amount": 100, "iban_mode": "admin_entry"}
        
        # Get commission settings
        commission_settings = await db.enterprise_commission_settings.find_one(
            {"enterprise_id": ent_id},
            {"_id": 0}
        ) or {"voucher_commission": 5.0}
        
        # Calculate pending amount from transactions
        api_keys = await db.enterprise_api_keys.find(
            {"enterprise_id": ent_id},
            {"_id": 0, "api_key": 1}
        ).to_list(100)
        
        key_list = [k["api_key"] for k in api_keys]
        total_revenue = 0
        
        if key_list:
            # Get last payout date
            last_payout = await db.enterprise_payouts.find_one(
                {"enterprise_id": ent_id, "status": "completed"},
                sort=[("completed_at", -1)]
            )
            last_payout_date = last_payout["completed_at"] if last_payout else None
            
            # Calculate revenue since last payout
            match_filter = {"api_key": {"$in": key_list}, "type": "topup"}
            if last_payout_date:
                match_filter["created_at"] = {"$gt": last_payout_date}
            
            pipeline = [
                {"$match": match_filter},
                {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
            ]
            result = await db.enterprise_transactions.aggregate(pipeline).to_list(1)
            total_revenue = result[0]["total"] if result else 0
        
        # Calculate commission amount
        commission_rate = commission_settings.get("voucher_commission", 5.0) / 100
        pending_amount = round(total_revenue * commission_rate, 2)
        
        # Check if payout is due based on frequency
        is_due = False
        frequency = payout_settings.get("payout_frequency", "monthly")
        min_amount = payout_settings.get("min_payout_amount", 100)
        
        if pending_amount >= min_amount and frequency != "manual":
            # Get last payout
            last_payout = await db.enterprise_payouts.find_one(
                {"enterprise_id": ent_id, "status": "completed"},
                sort=[("completed_at", -1)]
            )
            
            if not last_payout:
                is_due = True
            else:
                last_date = datetime.fromisoformat(last_payout["completed_at"].replace("Z", "+00:00"))
                
                if frequency == "daily":
                    is_due = (now - last_date).days >= 1
                elif frequency == "weekly":
                    is_due = (now - last_date).days >= 7
                elif frequency == "monthly":
                    is_due = (now - last_date).days >= 30
        
        if pending_amount > 0:
            pending_payouts.append({
                "enterprise_id": ent_id,
                "company_name": enterprise.get("company_name", ""),
                "email": enterprise.get("email", ""),
                "total_revenue": total_revenue,
                "pending_amount": pending_amount,
                "commission_rate": commission_settings.get("voucher_commission", 5.0),
                "frequency": frequency,
                "min_amount": min_amount,
                "is_due": is_due,
                "iban": payout_settings.get("iban", ""),
                "iban_holder": payout_settings.get("iban_holder", ""),
                "iban_mode": payout_settings.get("iban_mode", "admin_entry")
            })
    
    # Sort by pending amount descending
    pending_payouts.sort(key=lambda x: x["pending_amount"], reverse=True)
    
    return {
        "pending_payouts": pending_payouts,
        "total": len(pending_payouts),
        "total_amount": sum(p["pending_amount"] for p in pending_payouts)
    }


@router.post("/admin/payouts/create")
async def create_payout(data: PayoutCreate, x_admin_key: str = Header(...)):
    """Admin: Create a new payout for an enterprise."""
    if x_admin_key != "bidblitz-admin-2026":
        raise HTTPException(status_code=403, detail="Ungültiger Admin-Key")
    
    # Verify enterprise exists
    enterprise = await db.enterprise_accounts.find_one({"id": data.enterprise_id})
    if not enterprise:
        raise HTTPException(status_code=404, detail="Unternehmen nicht gefunden")
    
    # Get payout settings for IBAN
    payout_settings = await db.enterprise_payout_settings.find_one(
        {"enterprise_id": data.enterprise_id},
        {"_id": 0}
    )
    
    if not payout_settings or not payout_settings.get("iban"):
        raise HTTPException(status_code=400, detail="Keine IBAN hinterlegt")
    
    now = datetime.now(timezone.utc)
    payout_id = f"payout_{uuid.uuid4().hex[:12]}"
    
    payout_doc = {
        "id": payout_id,
        "enterprise_id": data.enterprise_id,
        "company_name": enterprise.get("company_name", ""),
        "amount": data.amount,
        "currency": "EUR",
        "iban": payout_settings.get("iban", ""),
        "iban_holder": payout_settings.get("iban_holder", ""),
        "status": "pending",  # pending, processing, completed, failed
        "note": data.note,
        "created_at": now.isoformat(),
        "created_by": "admin"
    }
    
    await db.enterprise_payouts.insert_one(payout_doc)
    
    return {
        "success": True,
        "payout_id": payout_id,
        "message": f"Auszahlung von €{data.amount:.2f} erstellt"
    }


@router.post("/admin/payouts/{payout_id}/process")
async def process_payout(payout_id: str, use_wise: bool = True, x_admin_key: str = Header(...)):
    """Admin: Process a pending payout via Wise API or manual SEPA."""
    if x_admin_key != "bidblitz-admin-2026":
        raise HTTPException(status_code=403, detail="Ungültiger Admin-Key")
    
    payout = await db.enterprise_payouts.find_one({"id": payout_id})
    if not payout:
        raise HTTPException(status_code=404, detail="Auszahlung nicht gefunden")
    
    if payout["status"] == "completed":
        raise HTTPException(status_code=400, detail="Auszahlung bereits abgeschlossen")
    
    now = datetime.now(timezone.utc)
    iban = payout.get("iban", "")
    iban_holder = payout.get("iban_holder", "")
    amount = payout.get("amount", 0)
    
    # Try to use Wise API for real SEPA transfer
    wise_transfer_id = None
    transfer_status = "pending_manual"
    sepa_reference = f"SEPA-{uuid.uuid4().hex[:8].upper()}"
    
    if use_wise and iban:
        try:
            import httpx
            
            WISE_API_TOKEN = os.environ.get("WISE_API_TOKEN", "")
            WISE_SANDBOX = os.environ.get("WISE_SANDBOX_MODE", "false").lower() == "true"
            WISE_API_URL = "https://api.sandbox.wise.com" if WISE_SANDBOX else "https://api.wise.com"
            
            if WISE_API_TOKEN:
                headers = {
                    "Authorization": f"Bearer {WISE_API_TOKEN}",
                    "Content-Type": "application/json"
                }
                
                async with httpx.AsyncClient() as client:
                    # Step 1: Get profile ID
                    profile_response = await client.get(
                        f"{WISE_API_URL}/v1/profiles",
                        headers=headers,
                        timeout=30.0
                    )
                    
                    if profile_response.status_code < 400:
                        profiles = profile_response.json()
                        profile_id = None
                        for profile in profiles:
                            if profile.get("type") == "business":
                                profile_id = profile["id"]
                                break
                        if not profile_id and profiles:
                            profile_id = profiles[0]["id"]
                        
                        if profile_id:
                            # Step 2: Create recipient
                            recipient_data = {
                                "currency": "EUR",
                                "type": "iban",
                                "profile": profile_id,
                                "accountHolderName": iban_holder or payout.get("company_name", "Enterprise"),
                                "legalType": "BUSINESS",
                                "details": {
                                    "iban": iban.replace(" ", "").upper()
                                }
                            }
                            
                            recipient_response = await client.post(
                                f"{WISE_API_URL}/v1/accounts",
                                headers=headers,
                                json=recipient_data,
                                timeout=30.0
                            )
                            
                            recipient_id = None
                            if recipient_response.status_code < 400:
                                recipient = recipient_response.json()
                                recipient_id = recipient.get("id")
                            
                            if recipient_id:
                                # Step 3: Create quote
                                quote_data = {
                                    "sourceCurrency": "EUR",
                                    "targetCurrency": "EUR",
                                    "sourceAmount": amount,
                                    "profile": profile_id
                                }
                                
                                quote_response = await client.post(
                                    f"{WISE_API_URL}/v3/profiles/{profile_id}/quotes",
                                    headers=headers,
                                    json=quote_data,
                                    timeout=30.0
                                )
                                
                                if quote_response.status_code < 400:
                                    quote = quote_response.json()
                                    quote_id = quote["id"]
                                    
                                    # Step 4: Create transfer
                                    transfer_data = {
                                        "targetAccount": recipient_id,
                                        "quoteUuid": quote_id,
                                        "customerTransactionId": str(uuid.uuid4()),
                                        "details": {
                                            "reference": f"BidBlitz Enterprise Auszahlung {payout.get('company_name', '')}"[:35]
                                        }
                                    }
                                    
                                    transfer_response = await client.post(
                                        f"{WISE_API_URL}/v1/transfers",
                                        headers=headers,
                                        json=transfer_data,
                                        timeout=30.0
                                    )
                                    
                                    if transfer_response.status_code < 400:
                                        transfer = transfer_response.json()
                                        wise_transfer_id = transfer["id"]
                                        sepa_reference = f"WISE-{wise_transfer_id}"
                                        transfer_status = "processing"
                                        
                                        # Step 5: Try to fund from Wise balance
                                        fund_response = await client.post(
                                            f"{WISE_API_URL}/v3/profiles/{profile_id}/transfers/{wise_transfer_id}/payments",
                                            headers=headers,
                                            json={"type": "BALANCE"},
                                            timeout=30.0
                                        )
                                        if fund_response.status_code < 400:
                                            transfer_status = "funded"
                                        
                                        logger.info(f"Wise transfer created: {wise_transfer_id} for enterprise payout {payout_id}")
        except Exception as e:
            logger.warning(f"Wise API error for enterprise payout, falling back to manual: {e}")
    
    # Determine final status
    final_status = "completed" if transfer_status in ["processing", "funded"] else "pending_manual"
    
    await db.enterprise_payouts.update_one(
        {"id": payout_id},
        {"$set": {
            "status": final_status,
            "completed_at": now.isoformat() if final_status == "completed" else None,
            "sepa_reference": sepa_reference,
            "wise_transfer_id": wise_transfer_id,
            "transfer_method": "wise_api" if wise_transfer_id else "manual",
            "processed_by": "admin"
        }}
    )
    
    if wise_transfer_id:
        return {
            "success": True,
            "sepa_reference": sepa_reference,
            "wise_transfer_id": wise_transfer_id,
            "status": transfer_status,
            "message": f"SEPA-Überweisung über Wise API gestartet"
        }
    else:
        return {
            "success": True,
            "sepa_reference": sepa_reference,
            "status": "pending_manual",
            "message": f"Auszahlung zur manuellen Bearbeitung markiert (Wise API nicht verfügbar)"
        }


@router.get("/admin/payouts/history")
async def get_payout_history(
    enterprise_id: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = Query(50, le=200),
    x_admin_key: str = Header(...)
):
    """Admin: Get payout history."""
    if x_admin_key != "bidblitz-admin-2026":
        raise HTTPException(status_code=403, detail="Ungültiger Admin-Key")
    
    query = {}
    if enterprise_id:
        query["enterprise_id"] = enterprise_id
    if status:
        query["status"] = status
    
    payouts = await db.enterprise_payouts.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    # Calculate totals
    totals = {
        "pending": 0,
        "processing": 0,
        "completed": 0,
        "failed": 0
    }
    
    for p in payouts:
        status_key = p.get("status", "pending")
        if status_key in totals:
            totals[status_key] += p.get("amount", 0)
    
    return {
        "payouts": payouts,
        "total": len(payouts),
        "totals": totals
    }


@router.post("/admin/payouts/batch-process")
async def batch_process_payouts(x_admin_key: str = Header(...)):
    """Admin: Process all due payouts automatically."""
    if x_admin_key != "bidblitz-admin-2026":
        raise HTTPException(status_code=403, detail="Ungültiger Admin-Key")
    
    # Get all pending payouts that are due
    pending_result = await get_pending_payouts(x_admin_key)
    due_payouts = [p for p in pending_result["pending_payouts"] if p["is_due"] and p.get("iban")]
    
    processed = []
    errors = []
    
    for payout_info in due_payouts:
        try:
            # Create payout
            create_result = await create_payout(
                PayoutCreate(
                    enterprise_id=payout_info["enterprise_id"],
                    amount=payout_info["pending_amount"],
                    note=f"Automatische {payout_info['frequency']} Auszahlung"
                ),
                x_admin_key
            )
            
            # Process it
            process_result = await process_payout(create_result["payout_id"], x_admin_key)
            
            processed.append({
                "enterprise_id": payout_info["enterprise_id"],
                "company_name": payout_info["company_name"],
                "amount": payout_info["pending_amount"],
                "sepa_reference": process_result["sepa_reference"]
            })
        except Exception as e:
            errors.append({
                "enterprise_id": payout_info["enterprise_id"],
                "company_name": payout_info["company_name"],
                "error": str(e)
            })
    
    return {
        "success": True,
        "processed": processed,
        "processed_count": len(processed),
        "total_amount": sum(p["amount"] for p in processed),
        "errors": errors,
        "error_count": len(errors)
    }


# Enterprise Portal - Payout endpoints for logged-in enterprises
@router.get("/payouts/my-history")
async def get_my_payout_history(authorization: str = Header(...)):
    """Enterprise: Get own payout history."""
    enterprise = await get_enterprise_from_token(authorization)
    
    payouts = await db.enterprise_payouts.find(
        {"enterprise_id": enterprise["id"]},
        {"_id": 0}
    ).sort("created_at", -1).limit(50).to_list(50)
    
    # Calculate summary
    total_paid = sum(p["amount"] for p in payouts if p.get("status") == "completed")
    pending = sum(p["amount"] for p in payouts if p.get("status") == "pending")
    
    return {
        "payouts": payouts,
        "total": len(payouts),
        "total_paid": total_paid,
        "pending": pending
    }


@router.get("/payouts/my-pending")
async def get_my_pending_payout(authorization: str = Header(...)):
    """Enterprise: Get own pending payout amount."""
    enterprise = await get_enterprise_from_token(authorization)
    ent_id = enterprise["id"]
    
    # Get commission settings
    commission_settings = await db.enterprise_commission_settings.find_one(
        {"enterprise_id": ent_id},
        {"_id": 0}
    ) or {"voucher_commission": 5.0}
    
    # Get payout settings
    payout_settings = await db.enterprise_payout_settings.find_one(
        {"enterprise_id": ent_id},
        {"_id": 0}
    ) or {"payout_frequency": "monthly", "min_payout_amount": 100}
    
    # Calculate pending amount
    api_keys = await db.enterprise_api_keys.find(
        {"enterprise_id": ent_id},
        {"_id": 0, "api_key": 1}
    ).to_list(100)
    
    key_list = [k["api_key"] for k in api_keys]
    total_revenue = 0
    
    if key_list:
        # Get last payout date
        last_payout = await db.enterprise_payouts.find_one(
            {"enterprise_id": ent_id, "status": "completed"},
            sort=[("completed_at", -1)]
        )
        last_payout_date = last_payout["completed_at"] if last_payout else None
        
        # Calculate revenue since last payout
        match_filter = {"api_key": {"$in": key_list}, "type": "topup"}
        if last_payout_date:
            match_filter["created_at"] = {"$gt": last_payout_date}
        
        pipeline = [
            {"$match": match_filter},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]
        result = await db.enterprise_transactions.aggregate(pipeline).to_list(1)
        total_revenue = result[0]["total"] if result else 0
    
    commission_rate = commission_settings.get("voucher_commission", 5.0) / 100
    pending_amount = round(total_revenue * commission_rate, 2)
    
    # Get last payout info
    last_payout = await db.enterprise_payouts.find_one(
        {"enterprise_id": ent_id, "status": "completed"},
        {"_id": 0},
        sort=[("completed_at", -1)]
    )
    
    return {
        "total_revenue_since_last_payout": total_revenue,
        "commission_rate": commission_settings.get("voucher_commission", 5.0),
        "pending_amount": pending_amount,
        "min_payout_amount": payout_settings.get("min_payout_amount", 100),
        "payout_frequency": payout_settings.get("payout_frequency", "monthly"),
        "last_payout": last_payout,
        "iban_configured": bool(payout_settings.get("iban"))
    }

