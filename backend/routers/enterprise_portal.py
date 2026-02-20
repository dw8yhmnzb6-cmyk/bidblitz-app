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
from config import db

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
    role: str = Field(..., description="admin, branch_manager, cashier")
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
    """Login to enterprise portal."""
    
    enterprise = await db.enterprise_accounts.find_one(
        {"email": data.email.lower()},
        {"_id": 0}
    )
    
    if not enterprise or enterprise["password"] != hash_password(data.password):
        raise HTTPException(status_code=401, detail="Ungültige Anmeldedaten")
    
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
    
    return {
        **enterprise,
        "stats": {
            "branches": branches_count,
            "api_keys": api_keys_count,
            "users": users_count
        }
    }


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
    if data.role not in ["admin", "branch_manager", "cashier"]:
        raise HTTPException(status_code=400, detail="Ungültige Rolle")
    
    # Branch required for branch_manager and cashier
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
    
    role_names = {"admin": "Administrator", "branch_manager": "Filialleiter", "cashier": "Kassierer"}
    
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
    authorization: str = Header(None)
):
    """Get overview statistics for the enterprise."""
    enterprise = await get_enterprise_from_token(authorization)
    
    # Calculate date range
    now = datetime.now(timezone.utc)
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
    page: int = Query(1, ge=1),
    limit: int = Query(50, le=200),
    authorization: str = Header(None)
):
    """Get detailed transactions report."""
    enterprise = await get_enterprise_from_token(authorization)
    
    # Calculate date range
    now = datetime.now(timezone.utc)
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


# ==================== ADMIN ENDPOINTS ====================

@router.get("/admin/list")
async def list_all_enterprises(x_admin_key: str = Header(...)):
    """Admin: Get list of all enterprise accounts."""
    if x_admin_key != "bidblitz-admin-2026":
        raise HTTPException(status_code=403, detail="Ungültiger Admin-Key")
    
    enterprises = await db.enterprise_accounts.find(
        {},
        {"_id": 0, "password": 0}
    ).sort("created_at", -1).to_list(100)
    
    return {"enterprises": enterprises, "total": len(enterprises)}


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
