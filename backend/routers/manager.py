"""Manager router - Regional Influencer Managers who manage influencers in their cities"""
from fastapi import APIRouter, HTTPException, Depends, Query
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel
from typing import Optional, List
import uuid
import hashlib

from config import db, logger
from dependencies import get_admin_user
from utils.email import send_admin_payout_notification

router = APIRouter(prefix="/manager", tags=["Manager"])

# ==================== CONFIGURATION ====================

MANAGER_COMMISSION_PERCENT = 15.0  # Manager gets 15% of influencer earnings

# ==================== SCHEMAS ====================

class ManagerCreate(BaseModel):
    name: str
    email: str
    password: str
    cities: List[str] = []  # Cities the manager is responsible for
    commission_percent: float = MANAGER_COMMISSION_PERCENT

class ManagerUpdate(BaseModel):
    name: Optional[str] = None
    cities: Optional[List[str]] = None
    commission_percent: Optional[float] = None
    is_active: Optional[bool] = None

class ManagerLogin(BaseModel):
    email: str
    password: str

class InfluencerCityAssign(BaseModel):
    influencer_id: str
    city: str

# ==================== HELPER FUNCTIONS ====================

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(password: str, hashed: str) -> bool:
    return hash_password(password) == hashed

async def get_current_manager(manager_id: str):
    """Get manager by ID"""
    manager = await db.managers.find_one({"id": manager_id, "is_active": True})
    if not manager:
        raise HTTPException(status_code=401, detail="Manager nicht gefunden oder deaktiviert")
    return manager

# ==================== ADMIN ENDPOINTS (Create/Manage Managers) ====================

@router.get("/admin/list")
async def list_managers(admin: dict = Depends(get_admin_user)):
    """Get all managers with their statistics (Admin only)"""
    managers = await db.managers.find({}, {"_id": 0, "password_hash": 0}).to_list(100)
    
    for manager in managers:
        cities = manager.get("cities", [])
        manager_id = manager.get("id")
        
        # Count influencers in manager's cities
        influencer_count = await db.influencers.count_documents({
            "city": {"$in": cities},
            "manager_id": manager_id
        })
        
        # Calculate total revenue from influencers
        influencers = await db.influencers.find({
            "city": {"$in": cities},
            "manager_id": manager_id
        }, {"code": 1}).to_list(100)
        
        total_influencer_revenue = 0
        total_influencer_commission = 0
        
        for inf in influencers:
            code = inf.get("code")
            purchases = await db.influencer_uses.find({
                "influencer_code": code,
                "purchase_amount": {"$gt": 0}
            }).to_list(1000)
            
            revenue = sum(p.get("purchase_amount", 0) for p in purchases)
            inf_commission_rate = (await db.influencers.find_one({"code": code})).get("commission_percent", 10)
            commission = revenue * (inf_commission_rate / 100)
            
            total_influencer_revenue += revenue
            total_influencer_commission += commission
        
        # Manager's commission (15% of influencer commissions)
        manager_commission_rate = manager.get("commission_percent", MANAGER_COMMISSION_PERCENT)
        manager_commission = total_influencer_commission * (manager_commission_rate / 100)
        
        manager["influencer_count"] = influencer_count
        manager["total_influencer_revenue"] = round(total_influencer_revenue, 2)
        manager["total_influencer_commission"] = round(total_influencer_commission, 2)
        manager["manager_commission"] = round(manager_commission, 2)
        manager["pending_payout"] = round(manager_commission - manager.get("total_paid_out", 0), 2)
    
    return {"managers": managers}

@router.post("/admin/create")
async def create_manager(data: ManagerCreate, admin: dict = Depends(get_admin_user)):
    """Create a new manager (Admin only)"""
    # Check if email already exists
    existing = await db.managers.find_one({"email": data.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Diese E-Mail existiert bereits")
    
    manager = {
        "id": str(uuid.uuid4()),
        "name": data.name,
        "email": data.email.lower(),
        "password_hash": hash_password(data.password),
        "cities": data.cities,
        "commission_percent": data.commission_percent,
        "is_active": True,
        "total_paid_out": 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.managers.insert_one(manager)
    
    # Remove sensitive data
    del manager["password_hash"]
    manager.pop("_id", None)
    
    logger.info(f"New manager created: {data.name} ({data.email}) for cities: {data.cities}")
    return {"success": True, "manager": manager}

@router.put("/admin/{manager_id}")
async def update_manager(manager_id: str, data: ManagerUpdate, admin: dict = Depends(get_admin_user)):
    """Update a manager (Admin only)"""
    manager = await db.managers.find_one({"id": manager_id})
    if not manager:
        raise HTTPException(status_code=404, detail="Manager nicht gefunden")
    
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    if updates:
        await db.managers.update_one({"id": manager_id}, {"$set": updates})
    
    updated = await db.managers.find_one({"id": manager_id}, {"_id": 0, "password_hash": 0})
    return {"success": True, "manager": updated}

@router.delete("/admin/{manager_id}")
async def delete_manager(manager_id: str, admin: dict = Depends(get_admin_user)):
    """Delete/deactivate a manager (Admin only)"""
    result = await db.managers.update_one(
        {"id": manager_id},
        {"$set": {"is_active": False, "deleted_at": datetime.now(timezone.utc).isoformat()}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Manager nicht gefunden")
    
    return {"success": True, "message": "Manager deaktiviert"}

@router.get("/admin/{manager_id}/influencers")
async def get_manager_influencers(manager_id: str, admin: dict = Depends(get_admin_user)):
    """Get all influencers managed by a specific manager (Admin only)"""
    manager = await db.managers.find_one({"id": manager_id}, {"_id": 0})
    if not manager:
        raise HTTPException(status_code=404, detail="Manager nicht gefunden")
    
    cities = manager.get("cities", []) or manager.get("managed_cities", [])
    
    # Find influencers in manager's cities or explicitly assigned
    query = {
        "$or": [
            {"manager_id": manager_id},
            {"city": {"$in": cities}}
        ]
    }
    
    influencers = await db.influencers.find(query, {"_id": 0}).to_list(100)
    
    # Enrich with earnings data
    for inf in influencers:
        code = inf.get("code")
        if code:
            # Calculate total earnings
            purchases = await db.influencer_uses.find({
                "influencer_code": code,
                "purchase_amount": {"$gt": 0}
            }).to_list(1000)
            
            total_revenue = sum(p.get("purchase_amount", 0) for p in purchases)
            commission_rate = inf.get("commission_percent", 10)
            total_earnings = total_revenue * (commission_rate / 100)
            
            # Count signups
            signups = await db.influencer_uses.count_documents({"influencer_code": code})
            
            inf["total_revenue"] = round(total_revenue, 2)
            inf["total_earnings"] = round(total_earnings, 2)
            inf["total_signups"] = signups
    
    return {
        "manager_id": manager_id,
        "manager_name": manager.get("name"),
        "cities": cities,
        "influencers": influencers,
        "total_count": len(influencers)
    }

@router.get("/admin/cities")
async def get_all_cities(admin: dict = Depends(get_admin_user)):
    """Get list of all cities with managers and influencers (Admin only)"""
    # Get all unique cities from influencers
    influencer_cities = await db.influencers.distinct("city")
    
    # Get cities from managers
    manager_cities = await db.managers.distinct("cities")
    
    # Combine and deduplicate
    all_cities = list(set([c for c in influencer_cities if c] + [c for cities in manager_cities for c in cities if c]))
    
    cities_data = []
    for city in sorted(all_cities):
        # Count managers for this city
        manager_count = await db.managers.count_documents({"cities": city, "is_active": True})
        
        # Count influencers for this city
        influencer_count = await db.influencers.count_documents({"city": city, "is_active": True})
        
        cities_data.append({
            "name": city,
            "manager_count": manager_count,
            "influencer_count": influencer_count
        })
    
    return {"cities": cities_data}

# ==================== MANAGER LOGIN ====================

@router.post("/login")
async def manager_login(data: ManagerLogin):
    """Manager login - supports both direct manager password and user account"""
    # First try to find manager by email
    manager = await db.managers.find_one({
        "email": data.email.lower(),
        "is_active": {"$ne": False}
    }, {"_id": 0})
    
    if manager:
        # Check if manager has own password_hash
        if manager.get("password_hash"):
            if verify_password(data.password, manager["password_hash"]):
                # Direct manager login
                await db.managers.update_one(
                    {"id": manager["id"]},
                    {"$set": {"last_login": datetime.now(timezone.utc).isoformat()}}
                )
                
                # Log activity
                await log_manager_activity(manager["id"], "login", "Manager eingeloggt")
                
                return {
                    "success": True,
                    "manager": {
                        "id": manager["id"],
                        "name": manager["name"],
                        "email": manager["email"],
                        "cities": manager.get("cities", manager.get("managed_cities", [])),
                        "commission_percent": manager.get("commission_percent", MANAGER_COMMISSION_PERCENT)
                    }
                }
        
        # Try user account login
        if manager.get("user_id"):
            user = await db.users.find_one({"id": manager["user_id"]}, {"_id": 0})
            if user and verify_password(data.password, user.get("password", "")):
                await db.managers.update_one(
                    {"id": manager["id"]},
                    {"$set": {"last_login": datetime.now(timezone.utc).isoformat()}}
                )
                
                await log_manager_activity(manager["id"], "login", "Manager eingeloggt")
                
                return {
                    "success": True,
                    "manager": {
                        "id": manager["id"],
                        "name": manager["name"],
                        "email": manager["email"],
                        "cities": manager.get("cities", manager.get("managed_cities", [])),
                        "commission_percent": manager.get("commission_percent", MANAGER_COMMISSION_PERCENT)
                    }
                }
    
    # Try to find user with manager role
    user = await db.users.find_one({
        "email": data.email.lower(),
        "$or": [{"role": "manager"}, {"is_manager": True}]
    }, {"_id": 0})
    
    if user and verify_password(data.password, user.get("password", "")):
        # Find or create manager record for this user
        manager = await db.managers.find_one({"user_id": user["id"]}, {"_id": 0})
        
        if not manager:
            manager = await db.managers.find_one({"email": user["email"]}, {"_id": 0})
        
        if manager:
            await db.managers.update_one(
                {"id": manager["id"]},
                {"$set": {
                    "user_id": user["id"],
                    "last_login": datetime.now(timezone.utc).isoformat()
                }}
            )
            
            await log_manager_activity(manager["id"], "login", "Manager eingeloggt")
            
            return {
                "success": True,
                "manager": {
                    "id": manager["id"],
                    "name": manager.get("name", user.get("name", user.get("username"))),
                    "email": manager["email"],
                    "cities": manager.get("cities", manager.get("managed_cities", [])),
                    "commission_percent": manager.get("commission_percent", MANAGER_COMMISSION_PERCENT)
                }
            }
    
    raise HTTPException(status_code=401, detail="Ungültige Anmeldedaten")

async def log_manager_activity(manager_id: str, action: str, description: str, details: dict = None):
    """Log manager activity for audit trail"""
    activity = {
        "id": str(uuid.uuid4()),
        "manager_id": manager_id,
        "action": action,
        "description": description,
        "details": details or {},
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.manager_activities.insert_one(activity)
    return activity

# ==================== MANAGER DASHBOARD ====================

@router.get("/dashboard/{manager_id}")
async def get_manager_dashboard(manager_id: str):
    """Get manager dashboard with all statistics"""
    manager = await get_current_manager(manager_id)
    cities = manager.get("cities", [])
    
    # Get all influencers managed by this manager
    influencers = await db.influencers.find({
        "manager_id": manager_id,
        "city": {"$in": cities}
    }, {"_id": 0}).to_list(100)
    
    # Also get influencers in manager's cities without explicit manager assignment
    unassigned_in_cities = await db.influencers.find({
        "city": {"$in": cities},
        "$or": [
            {"manager_id": {"$exists": False}},
            {"manager_id": None}
        ]
    }, {"_id": 0}).to_list(100)
    
    total_influencer_revenue = 0
    total_influencer_commission = 0
    influencer_stats = []
    
    all_influencers = influencers + unassigned_in_cities
    
    for inf in all_influencers:
        code = inf.get("code")
        
        # Count customers
        unique_customers = await db.influencer_uses.distinct("user_id", {"influencer_code": code})
        
        # Sum purchases
        purchases = await db.influencer_uses.find({
            "influencer_code": code,
            "purchase_amount": {"$gt": 0}
        }).to_list(1000)
        
        revenue = sum(p.get("purchase_amount", 0) for p in purchases)
        commission_rate = inf.get("commission_percent", 10)
        commission = revenue * (commission_rate / 100)
        
        total_influencer_revenue += revenue
        total_influencer_commission += commission
        
        influencer_stats.append({
            "id": inf.get("id"),
            "name": inf.get("name"),
            "code": inf.get("code"),
            "city": inf.get("city"),
            "is_active": inf.get("is_active", True),
            "is_approved": inf.get("is_approved", True),
            "total_customers": len(unique_customers),
            "total_revenue": round(revenue, 2),
            "total_commission": round(commission, 2),
            "commission_percent": commission_rate
        })
    
    # Manager's commission (15% of total influencer commissions)
    manager_commission_rate = manager.get("commission_percent", MANAGER_COMMISSION_PERCENT)
    manager_commission = total_influencer_commission * (manager_commission_rate / 100)
    pending_payout = manager_commission - manager.get("total_paid_out", 0)
    
    return {
        "manager": {
            "id": manager["id"],
            "name": manager["name"],
            "email": manager["email"],
            "cities": cities,
            "commission_percent": manager_commission_rate
        },
        "statistics": {
            "total_influencers": len(all_influencers),
            "active_influencers": len([i for i in all_influencers if i.get("is_active", True)]),
            "total_influencer_revenue": round(total_influencer_revenue, 2),
            "total_influencer_commission": round(total_influencer_commission, 2),
            "manager_commission": round(manager_commission, 2),
            "pending_payout": round(pending_payout, 2),
            "total_paid_out": manager.get("total_paid_out", 0)
        },
        "influencers": sorted(influencer_stats, key=lambda x: x["total_revenue"], reverse=True)
    }

# ==================== MANAGER INFLUENCER MANAGEMENT ====================

@router.post("/{manager_id}/influencer/approve/{influencer_id}")
async def approve_influencer(manager_id: str, influencer_id: str):
    """Approve/activate an influencer (Manager only)"""
    manager = await get_current_manager(manager_id)
    cities = manager.get("cities", [])
    
    # Check if influencer is in manager's cities
    influencer = await db.influencers.find_one({"id": influencer_id})
    if not influencer:
        raise HTTPException(status_code=404, detail="Influencer nicht gefunden")
    
    if influencer.get("city") and influencer["city"] not in cities:
        raise HTTPException(status_code=403, detail="Influencer ist nicht in Ihren Städten")
    
    await db.influencers.update_one(
        {"id": influencer_id},
        {"$set": {
            "is_active": True,
            "is_approved": True,
            "approved_by": manager_id,
            "approved_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    logger.info(f"Manager {manager['name']} approved influencer {influencer['name']}")
    return {"success": True, "message": "Influencer freigeschaltet"}

@router.post("/{manager_id}/influencer/block/{influencer_id}")
async def block_influencer(manager_id: str, influencer_id: str):
    """Block/deactivate an influencer (Manager only)"""
    manager = await get_current_manager(manager_id)
    cities = manager.get("cities", [])
    
    influencer = await db.influencers.find_one({"id": influencer_id})
    if not influencer:
        raise HTTPException(status_code=404, detail="Influencer nicht gefunden")
    
    if influencer.get("city") and influencer["city"] not in cities:
        raise HTTPException(status_code=403, detail="Influencer ist nicht in Ihren Städten")
    
    await db.influencers.update_one(
        {"id": influencer_id},
        {"$set": {
            "is_active": False,
            "blocked_by": manager_id,
            "blocked_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    logger.info(f"Manager {manager['name']} blocked influencer {influencer['name']}")
    return {"success": True, "message": "Influencer gesperrt"}

@router.post("/{manager_id}/influencer/assign-city")
async def assign_influencer_city(manager_id: str, data: InfluencerCityAssign):
    """Assign an influencer to a city (Manager only)"""
    manager = await get_current_manager(manager_id)
    cities = manager.get("cities", [])
    
    if data.city not in cities:
        raise HTTPException(status_code=403, detail="Sie können nur Städte zuweisen, die Sie verwalten")
    
    influencer = await db.influencers.find_one({"id": data.influencer_id})
    if not influencer:
        raise HTTPException(status_code=404, detail="Influencer nicht gefunden")
    
    await db.influencers.update_one(
        {"id": data.influencer_id},
        {"$set": {
            "city": data.city,
            "manager_id": manager_id,
            "city_assigned_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    logger.info(f"Manager {manager['name']} assigned influencer {influencer['name']} to city {data.city}")
    return {"success": True, "message": f"Influencer zu {data.city} zugewiesen"}

# ==================== MANAGER PAYOUT ====================

@router.post("/{manager_id}/request-payout")
async def request_manager_payout(manager_id: str, amount: float = Query(..., gt=0)):
    """Request payout for manager commission"""
    manager = await get_current_manager(manager_id)
    
    # Calculate available balance
    cities = manager.get("cities", [])
    total_influencer_commission = 0
    
    influencers = await db.influencers.find({
        "manager_id": manager_id,
        "city": {"$in": cities}
    }).to_list(100)
    
    for inf in influencers:
        code = inf.get("code")
        purchases = await db.influencer_uses.find({
            "influencer_code": code,
            "purchase_amount": {"$gt": 0}
        }).to_list(1000)
        
        revenue = sum(p.get("purchase_amount", 0) for p in purchases)
        commission = revenue * (inf.get("commission_percent", 10) / 100)
        total_influencer_commission += commission
    
    manager_commission = total_influencer_commission * (manager.get("commission_percent", MANAGER_COMMISSION_PERCENT) / 100)
    available = manager_commission - manager.get("total_paid_out", 0)
    
    if amount > available:
        raise HTTPException(status_code=400, detail=f"Maximale Auszahlung: €{available:.2f}")
    
    # Create payout request
    payout_request = {
        "id": str(uuid.uuid4()),
        "manager_id": manager_id,
        "manager_name": manager["name"],
        "manager_email": manager["email"],
        "amount": amount,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.manager_payouts.insert_one(payout_request)
    
    logger.info(f"Manager {manager['name']} requested payout of €{amount}")
    
    # Send admin notification email
    await send_admin_payout_notification(
        influencer_name=manager["name"],
        influencer_code=f"Manager-{manager_id[:8]}",
        payout_amount=amount,
        payment_method="bank",
        payment_details=manager["email"],
        request_type="manager"
    )
    
    return {"success": True, "message": f"Auszahlung von €{amount:.2f} angefordert", "payout_id": payout_request["id"]}

@router.get("/admin/payouts")
async def get_manager_payouts(admin: dict = Depends(get_admin_user)):
    """Get all manager payout requests (Admin only)"""
    payouts = await db.manager_payouts.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return {"payouts": payouts}

@router.post("/admin/payouts/{payout_id}/approve")
async def approve_manager_payout(payout_id: str, admin: dict = Depends(get_admin_user)):
    """Approve a manager payout request (Admin only)"""
    payout = await db.manager_payouts.find_one({"id": payout_id})
    if not payout:
        raise HTTPException(status_code=404, detail="Auszahlung nicht gefunden")
    
    if payout["status"] != "pending":
        raise HTTPException(status_code=400, detail="Auszahlung bereits bearbeitet")
    
    # Update payout status
    await db.manager_payouts.update_one(
        {"id": payout_id},
        {"$set": {
            "status": "approved",
            "approved_by": admin["email"],
            "approved_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Update manager's total paid out
    await db.managers.update_one(
        {"id": payout["manager_id"]},
        {"$inc": {"total_paid_out": payout["amount"]}}
    )
    
    logger.info(f"Admin approved manager payout: €{payout['amount']} to {payout['manager_name']}")
    return {"success": True, "message": "Auszahlung genehmigt"}

@router.post("/admin/payouts/{payout_id}/reject")
async def reject_manager_payout(payout_id: str, reason: str = Query(default=""), admin: dict = Depends(get_admin_user)):
    """Reject a manager payout request (Admin only)"""
    payout = await db.manager_payouts.find_one({"id": payout_id})
    if not payout:
        raise HTTPException(status_code=404, detail="Auszahlung nicht gefunden")
    
    await db.manager_payouts.update_one(
        {"id": payout_id},
        {"$set": {
            "status": "rejected",
            "rejected_by": admin["email"],
            "rejected_at": datetime.now(timezone.utc).isoformat(),
            "rejection_reason": reason
        }}
    )
    
    return {"success": True, "message": "Auszahlung abgelehnt"}


manager_router = router
