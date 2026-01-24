"""Influencer router - Influencer codes, commissions, and statistics"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel
from typing import Optional
import uuid

from config import db, logger
from dependencies import get_current_user, get_admin_user

router = APIRouter(prefix="/influencer", tags=["Influencer"])

# ==================== SCHEMAS ====================

class InfluencerCreate(BaseModel):
    name: str
    code: str  # The influencer's unique code (usually their name)
    commission_percent: float = 10.0  # Default 10% commission
    email: Optional[str] = None
    instagram: Optional[str] = None
    youtube: Optional[str] = None
    tiktok: Optional[str] = None

class InfluencerUpdate(BaseModel):
    name: Optional[str] = None
    commission_percent: Optional[float] = None
    is_active: Optional[bool] = None
    email: Optional[str] = None
    instagram: Optional[str] = None
    youtube: Optional[str] = None
    tiktok: Optional[str] = None

# ==================== ADMIN ENDPOINTS ====================

@router.get("/admin/list")
async def list_influencers(admin: dict = Depends(get_admin_user)):
    """Get all influencers with their statistics"""
    influencers = await db.influencers.find({}, {"_id": 0}).to_list(100)
    
    # Enrich with statistics
    for influencer in influencers:
        code = influencer.get("code")
        
        # Count uses
        uses = await db.influencer_uses.count_documents({"influencer_code": code})
        
        # Sum purchases
        purchases = await db.influencer_uses.find(
            {"influencer_code": code, "purchase_amount": {"$gt": 0}}
        ).to_list(1000)
        
        total_revenue = sum(p.get("purchase_amount", 0) for p in purchases)
        total_commission = total_revenue * (influencer.get("commission_percent", 10) / 100)
        
        influencer["total_uses"] = uses
        influencer["total_revenue"] = round(total_revenue, 2)
        influencer["total_commission"] = round(total_commission, 2)
        influencer["total_purchases"] = len(purchases)
    
    return influencers

@router.post("/admin/create")
async def create_influencer(data: InfluencerCreate, admin: dict = Depends(get_admin_user)):
    """Create a new influencer"""
    # Check if code already exists
    existing = await db.influencers.find_one({"code": data.code.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Dieser Code existiert bereits")
    
    influencer = {
        "id": str(uuid.uuid4()),
        "name": data.name,
        "code": data.code.lower(),
        "commission_percent": data.commission_percent,
        "email": data.email,
        "instagram": data.instagram,
        "youtube": data.youtube,
        "tiktok": data.tiktok,
        "is_active": True,
        "total_uses": 0,
        "total_revenue": 0,
        "total_commission": 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.influencers.insert_one(influencer)
    logger.info(f"🌟 New influencer created: {data.name} (code: {data.code})")
    
    return {"success": True, "influencer": {k: v for k, v in influencer.items() if k != "_id"}}

@router.put("/admin/{influencer_id}")
async def update_influencer(influencer_id: str, data: InfluencerUpdate, admin: dict = Depends(get_admin_user)):
    """Update an influencer"""
    update_data = {k: v for k, v in data.dict().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="Keine Änderungen angegeben")
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.influencers.update_one(
        {"id": influencer_id},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Influencer nicht gefunden")
    
    return {"success": True}

@router.delete("/admin/{influencer_id}")
async def delete_influencer(influencer_id: str, admin: dict = Depends(get_admin_user)):
    """Delete an influencer"""
    result = await db.influencers.delete_one({"id": influencer_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Influencer nicht gefunden")
    
    return {"success": True}

@router.get("/admin/{influencer_id}/stats")
async def get_influencer_stats(influencer_id: str, admin: dict = Depends(get_admin_user)):
    """Get detailed statistics for an influencer"""
    influencer = await db.influencers.find_one({"id": influencer_id}, {"_id": 0})
    if not influencer:
        raise HTTPException(status_code=404, detail="Influencer nicht gefunden")
    
    code = influencer["code"]
    
    # Get all uses with details
    uses = await db.influencer_uses.find(
        {"influencer_code": code},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Calculate daily stats for last 30 days
    daily_stats = {}
    thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
    
    for use in uses:
        created_at = use.get("created_at", "")
        if created_at:
            date = created_at[:10]  # Get YYYY-MM-DD
            if date not in daily_stats:
                daily_stats[date] = {"uses": 0, "revenue": 0}
            daily_stats[date]["uses"] += 1
            daily_stats[date]["revenue"] += use.get("purchase_amount", 0)
    
    # Get customer details
    customers = []
    for use in uses[:50]:  # Last 50 customers
        customer = await db.users.find_one(
            {"id": use.get("user_id")},
            {"_id": 0, "id": 1, "name": 1, "email": 1}
        )
        if customer:
            customers.append({
                **customer,
                "used_at": use.get("created_at"),
                "purchase_amount": use.get("purchase_amount", 0)
            })
    
    return {
        "influencer": influencer,
        "uses": uses,
        "daily_stats": daily_stats,
        "customers": customers,
        "summary": {
            "total_uses": len(uses),
            "total_revenue": sum(u.get("purchase_amount", 0) for u in uses),
            "total_commission": sum(u.get("purchase_amount", 0) for u in uses) * (influencer.get("commission_percent", 10) / 100),
            "conversion_rate": round(len([u for u in uses if u.get("purchase_amount", 0) > 0]) / max(len(uses), 1) * 100, 1)
        }
    }

# ==================== PUBLIC ENDPOINTS ====================

@router.get("/validate/{code}")
async def validate_influencer_code(code: str):
    """Validate an influencer code (public endpoint)"""
    influencer = await db.influencers.find_one(
        {"code": code.lower(), "is_active": True},
        {"_id": 0, "name": 1, "code": 1}
    )
    
    if not influencer:
        return {"valid": False, "message": "Code nicht gefunden"}
    
    return {
        "valid": True,
        "influencer_name": influencer["name"],
        "code": influencer["code"]
    }

@router.post("/use/{code}")
async def use_influencer_code(code: str, user: dict = Depends(get_current_user)):
    """Record usage of an influencer code"""
    influencer = await db.influencers.find_one(
        {"code": code.lower(), "is_active": True},
        {"_id": 0}
    )
    
    if not influencer:
        raise HTTPException(status_code=404, detail="Ungültiger Influencer-Code")
    
    # Check if user already used a code
    existing_use = await db.influencer_uses.find_one({
        "user_id": user["id"],
        "influencer_code": code.lower()
    })
    
    if existing_use:
        return {"success": True, "message": "Code bereits verwendet", "influencer_name": influencer["name"]}
    
    # Record the use
    use_record = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "user_name": user.get("name", "Unknown"),
        "user_email": user.get("email", ""),
        "influencer_code": code.lower(),
        "influencer_id": influencer["id"],
        "influencer_name": influencer["name"],
        "purchase_amount": 0,  # Updated when user makes a purchase
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.influencer_uses.insert_one(use_record)
    
    # Update user to track their influencer code
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"influencer_code": code.lower()}}
    )
    
    logger.info(f"🌟 Influencer code used: {code} by {user.get('name')}")
    
    return {
        "success": True,
        "message": f"Code von {influencer['name']} aktiviert!",
        "influencer_name": influencer["name"]
    }

# ==================== HELPER FUNCTIONS ====================

async def record_influencer_purchase(user_id: str, purchase_amount: float):
    """Record a purchase for influencer commission tracking"""
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        return
    
    influencer_code = user.get("influencer_code")
    if not influencer_code:
        return
    
    # Update the use record with purchase amount
    await db.influencer_uses.update_one(
        {"user_id": user_id, "influencer_code": influencer_code},
        {"$inc": {"purchase_amount": purchase_amount}}
    )
    
    logger.info(f"💰 Influencer purchase recorded: {influencer_code} - €{purchase_amount}")
