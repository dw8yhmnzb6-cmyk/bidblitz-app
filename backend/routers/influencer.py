"""Influencer router - Influencer codes, commissions, and statistics"""
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel
from typing import Optional, List
import uuid

from config import db, logger
from dependencies import get_current_user, get_admin_user
from utils.email import (
    send_influencer_new_sale_notification,
    send_influencer_new_signup_notification,
    send_influencer_payout_confirmation
)

router = APIRouter(prefix="/influencer", tags=["Influencer"])

# ==================== COMMISSION TIERS ====================

# Default commission tiers - can be overridden per influencer
DEFAULT_COMMISSION_TIERS = [
    {"min_customers": 0, "bonus_percent": 0},      # 0-10 customers: base rate
    {"min_customers": 11, "bonus_percent": 2},     # 11-50 customers: +2%
    {"min_customers": 51, "bonus_percent": 3},     # 51-100 customers: +3%
    {"min_customers": 101, "bonus_percent": 5},    # 100+ customers: +5%
]

def calculate_effective_commission(base_commission: float, total_customers: int, custom_tiers: list = None) -> dict:
    """Calculate effective commission based on customer count"""
    tiers = custom_tiers or DEFAULT_COMMISSION_TIERS
    bonus = 0
    current_tier = "Bronze"
    
    for tier in sorted(tiers, key=lambda x: x["min_customers"], reverse=True):
        if total_customers >= tier["min_customers"]:
            bonus = tier["bonus_percent"]
            if tier["min_customers"] >= 101:
                current_tier = "Platin"
            elif tier["min_customers"] >= 51:
                current_tier = "Gold"
            elif tier["min_customers"] >= 11:
                current_tier = "Silber"
            break
    
    return {
        "base_commission": base_commission,
        "tier_bonus": bonus,
        "effective_commission": base_commission + bonus,
        "current_tier": current_tier,
        "next_tier_at": get_next_tier_threshold(total_customers, tiers)
    }

def get_next_tier_threshold(current_customers: int, tiers: list) -> int:
    """Get the customer count needed for next tier"""
    for tier in sorted(tiers, key=lambda x: x["min_customers"]):
        if current_customers < tier["min_customers"]:
            return tier["min_customers"]
    return None  # Already at max tier

# ==================== SCHEMAS ====================

class InfluencerCreate(BaseModel):
    name: str
    code: str  # The influencer's unique code (usually their name)
    commission_percent: float = 10.0  # Default 10% commission
    email: Optional[str] = None
    instagram: Optional[str] = None
    youtube: Optional[str] = None
    tiktok: Optional[str] = None
    custom_tiers: Optional[List[dict]] = None  # Custom commission tiers

class InfluencerUpdate(BaseModel):
    name: Optional[str] = None
    commission_percent: Optional[float] = None
    is_active: Optional[bool] = None
    email: Optional[str] = None
    instagram: Optional[str] = None
    youtube: Optional[str] = None
    tiktok: Optional[str] = None
    custom_tiers: Optional[List[dict]] = None

# ==================== ADMIN ENDPOINTS ====================

@router.get("/admin/list")
async def list_influencers(admin: dict = Depends(get_admin_user)):
    """Get all influencers with their statistics"""
    influencers = await db.influencers.find({}, {"_id": 0}).to_list(100)
    
    # Enrich with statistics
    for influencer in influencers:
        code = influencer.get("code")
        
        # Count unique customers (users who used the code)
        unique_customers = await db.influencer_uses.distinct("user_id", {"influencer_code": code})
        total_customers = len(unique_customers)
        
        # Count total uses
        uses = await db.influencer_uses.count_documents({"influencer_code": code})
        
        # Sum purchases
        purchases = await db.influencer_uses.find(
            {"influencer_code": code, "purchase_amount": {"$gt": 0}}
        ).to_list(1000)
        
        total_revenue = sum(p.get("purchase_amount", 0) for p in purchases)
        
        # Calculate tiered commission
        base_commission = influencer.get("commission_percent", 10)
        custom_tiers = influencer.get("custom_tiers")
        commission_info = calculate_effective_commission(base_commission, total_customers, custom_tiers)
        
        # Calculate actual commission with tier bonus
        effective_rate = commission_info["effective_commission"]
        total_commission = total_revenue * (effective_rate / 100)
        
        influencer["total_uses"] = uses
        influencer["total_customers"] = total_customers
        influencer["total_revenue"] = round(total_revenue, 2)
        influencer["total_commission"] = round(total_commission, 2)
        influencer["total_purchases"] = len(purchases)
        influencer["commission_tier"] = commission_info["current_tier"]
        influencer["effective_commission"] = commission_info["effective_commission"]
        influencer["tier_bonus"] = commission_info["tier_bonus"]
        influencer["next_tier_at"] = commission_info["next_tier_at"]
    
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

# ==================== INFLUENCER LOGIN & STATS ====================

class InfluencerLogin(BaseModel):
    code: str
    email: str

@router.post("/login")
async def influencer_login(data: InfluencerLogin):
    """Login for influencers - creates/links user account with VIP access"""
    from dependencies import create_token, hash_password
    
    influencer = await db.influencers.find_one(
        {"code": data.code.lower(), "email": data.email, "is_active": True},
        {"_id": 0}
    )
    
    if not influencer:
        raise HTTPException(status_code=401, detail="Ungültiger Code oder E-Mail")
    
    # Check if user account exists for this influencer
    user = await db.users.find_one({"email": data.email}, {"_id": 0})
    
    if not user:
        # Create new user account for influencer with VIP status
        user_id = str(uuid.uuid4())
        # Generate a secure random password (influencer logs in with code+email)
        temp_password = str(uuid.uuid4())[:16] + "Aa1!"
        
        user = {
            "id": user_id,
            "email": data.email,
            "name": influencer["name"],
            "password": hash_password(temp_password),
            "bids_balance": 100,  # Welcome bonus for influencers
            "is_admin": False,
            "is_vip": True,  # FREE VIP access
            "vip_expires_at": None,  # Never expires for influencers
            "is_influencer": True,
            "influencer_code": influencer["code"],
            "total_bids_placed": 0,
            "total_deposits": 0,
            "won_auctions": [],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "is_verified": True  # Auto-verified
        }
        await db.users.insert_one(user)
        logger.info(f"🌟 Created user account for influencer: {influencer['name']}")
    else:
        # Update existing user to have VIP and influencer status
        await db.users.update_one(
            {"email": data.email},
            {"$set": {
                "is_vip": True,
                "vip_expires_at": None,  # Never expires
                "is_influencer": True,
                "influencer_code": influencer["code"]
            }}
        )
        # Refresh user data
        user = await db.users.find_one({"email": data.email}, {"_id": 0})
        logger.info(f"🌟 Updated existing user with influencer VIP status: {influencer['name']}")
    
    # Create JWT token for the user
    token = create_token(user["id"], is_admin=user.get("is_admin", False))
    
    logger.info(f"🌟 Influencer login: {influencer['name']} (VIP access granted)")
    
    return {
        "success": True,
        "influencer": influencer,
        "token": token,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "bids_balance": user.get("bids_balance", 0),
            "is_vip": True,
            "is_influencer": True
        }
    }

@router.get("/stats/{code}")
async def get_influencer_public_stats(code: str):
    """Get statistics for an influencer (public endpoint for influencer dashboard)"""
    influencer = await db.influencers.find_one(
        {"code": code.lower()},
        {"_id": 0}
    )
    
    if not influencer:
        raise HTTPException(status_code=404, detail="Influencer nicht gefunden")
    
    # Get all uses
    uses = await db.influencer_uses.find(
        {"influencer_code": code.lower()},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    total_revenue = sum(u.get("purchase_amount", 0) for u in uses)
    total_commission = total_revenue * (influencer.get("commission_percent", 10) / 100)
    total_purchases = len([u for u in uses if u.get("purchase_amount", 0) > 0])
    
    return {
        "total_uses": len(uses),
        "total_purchases": total_purchases,
        "total_revenue": round(total_revenue, 2),
        "total_commission": round(total_commission, 2),
        "commission_percent": influencer.get("commission_percent", 10),
        "recent_uses": uses[:10]  # Last 10 uses
    }

class InfluencerApply(BaseModel):
    name: str
    email: str
    instagram: Optional[str] = None
    youtube: Optional[str] = None
    tiktok: Optional[str] = None
    followers: str
    message: Optional[str] = None

@router.post("/apply")
async def apply_as_influencer(data: InfluencerApply):
    """Submit an application to become an influencer"""
    # Check if email already has an application
    existing = await db.influencer_applications.find_one({"email": data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Sie haben bereits eine Bewerbung eingereicht")
    
    application = {
        "id": str(uuid.uuid4()),
        "name": data.name,
        "email": data.email,
        "instagram": data.instagram,
        "youtube": data.youtube,
        "tiktok": data.tiktok,
        "followers": data.followers,
        "message": data.message,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.influencer_applications.insert_one(application)
    logger.info(f"🌟 New influencer application from: {data.name} ({data.email})")
    
    return {"success": True, "message": "Bewerbung erfolgreich gesendet!"}

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
    
    # Send email notification to influencer (async, non-blocking)
    if influencer.get("email"):
        try:
            await send_influencer_new_signup_notification(
                influencer_email=influencer["email"],
                influencer_name=influencer["name"],
                new_user_name=user.get("name", "Neuer Benutzer")
            )
        except Exception as e:
            logger.error(f"Failed to send signup notification: {e}")
    
    return {
        "success": True,
        "message": f"Code von {influencer['name']} aktiviert!",
        "influencer_name": influencer["name"]
    }

# ==================== PAYOUT / WITHDRAWAL ENDPOINTS ====================

MINIMUM_PAYOUT = 50.0  # Minimum €50 for withdrawal

class PayoutRequest(BaseModel):
    amount: float
    payment_method: str  # "bank_transfer" or "paypal"
    bank_iban: Optional[str] = None
    bank_name: Optional[str] = None
    paypal_email: Optional[str] = None

@router.get("/payout/balance/{code}")
async def get_payout_balance(code: str):
    """Get available balance for withdrawal"""
    influencer = await db.influencers.find_one(
        {"code": code.lower()},
        {"_id": 0}
    )
    
    if not influencer:
        raise HTTPException(status_code=404, detail="Influencer nicht gefunden")
    
    # Calculate total commission earned
    uses = await db.influencer_uses.find(
        {"influencer_code": code.lower()},
        {"_id": 0}
    ).to_list(1000)
    
    total_revenue = sum(u.get("purchase_amount", 0) for u in uses)
    total_commission = total_revenue * (influencer.get("commission_percent", 10) / 100)
    
    # Get already paid out amount
    payouts = await db.influencer_payouts.find(
        {"influencer_code": code.lower(), "status": {"$in": ["completed", "pending"]}},
        {"_id": 0}
    ).to_list(100)
    
    total_paid = sum(p.get("amount", 0) for p in payouts)
    available_balance = total_commission - total_paid
    
    return {
        "total_commission": round(total_commission, 2),
        "total_paid": round(total_paid, 2),
        "available_balance": round(available_balance, 2),
        "minimum_payout": MINIMUM_PAYOUT,
        "can_withdraw": available_balance >= MINIMUM_PAYOUT
    }

@router.post("/payout/request")
async def request_payout(data: PayoutRequest):
    """Request a payout (requires influencer to be logged in via localStorage data)"""
    # Note: This uses code from the request, validated via the influencer_data in localStorage
    # For security, we should add proper authentication, but for now we trust the frontend
    
    # Validate payment method data
    if data.payment_method == "bank_transfer":
        if not data.bank_iban or not data.bank_name:
            raise HTTPException(status_code=400, detail="IBAN und Bankname erforderlich")
    elif data.payment_method == "paypal":
        if not data.paypal_email:
            raise HTTPException(status_code=400, detail="PayPal E-Mail erforderlich")
    else:
        raise HTTPException(status_code=400, detail="Ungültige Zahlungsmethode")
    
    if data.amount < MINIMUM_PAYOUT:
        raise HTTPException(status_code=400, detail=f"Mindestbetrag für Auszahlung: €{MINIMUM_PAYOUT}")
    
    return {"success": True, "message": "Bitte verwenden Sie den authentifizierten Endpoint"}

@router.post("/payout/request/{code}")
async def request_payout_for_influencer(code: str, data: PayoutRequest):
    """Request a payout for an influencer"""
    influencer = await db.influencers.find_one(
        {"code": code.lower(), "is_active": True},
        {"_id": 0}
    )
    
    if not influencer:
        raise HTTPException(status_code=404, detail="Influencer nicht gefunden")
    
    # Validate payment method data
    if data.payment_method == "bank_transfer":
        if not data.bank_iban or not data.bank_name:
            raise HTTPException(status_code=400, detail="IBAN und Bankname erforderlich")
    elif data.payment_method == "paypal":
        if not data.paypal_email:
            raise HTTPException(status_code=400, detail="PayPal E-Mail erforderlich")
    else:
        raise HTTPException(status_code=400, detail="Ungültige Zahlungsmethode")
    
    # Calculate available balance
    uses = await db.influencer_uses.find(
        {"influencer_code": code.lower()},
        {"_id": 0}
    ).to_list(1000)
    
    total_revenue = sum(u.get("purchase_amount", 0) for u in uses)
    total_commission = total_revenue * (influencer.get("commission_percent", 10) / 100)
    
    payouts = await db.influencer_payouts.find(
        {"influencer_code": code.lower(), "status": {"$in": ["completed", "pending"]}},
        {"_id": 0}
    ).to_list(100)
    
    total_paid = sum(p.get("amount", 0) for p in payouts)
    available_balance = total_commission - total_paid
    
    if data.amount > available_balance:
        raise HTTPException(status_code=400, detail=f"Nicht genügend Guthaben. Verfügbar: €{available_balance:.2f}")
    
    if data.amount < MINIMUM_PAYOUT:
        raise HTTPException(status_code=400, detail=f"Mindestbetrag für Auszahlung: €{MINIMUM_PAYOUT}")
    
    # Create payout request
    payout = {
        "id": str(uuid.uuid4()),
        "influencer_code": code.lower(),
        "influencer_name": influencer["name"],
        "influencer_email": influencer.get("email"),
        "amount": data.amount,
        "payment_method": data.payment_method,
        "bank_iban": data.bank_iban,
        "bank_name": data.bank_name,
        "paypal_email": data.paypal_email,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.influencer_payouts.insert_one(payout)
    
    logger.info(f"💸 Payout request: {influencer['name']} - €{data.amount} via {data.payment_method}")
    
    # Send confirmation email to influencer
    if influencer.get("email"):
        try:
            await send_influencer_payout_confirmation(
                influencer_email=influencer["email"],
                influencer_name=influencer["name"],
                payout_amount=data.amount,
                payment_method=data.payment_method,
                payout_id=payout["id"]
            )
        except Exception as e:
            logger.error(f"Failed to send payout confirmation email: {e}")
    
    return {
        "success": True,
        "message": f"Auszahlungsanfrage über €{data.amount:.2f} wurde eingereicht",
        "payout_id": payout["id"],
        "status": "pending"
    }

@router.get("/payout/history/{code}")
async def get_payout_history(code: str):
    """Get payout history for an influencer"""
    payouts = await db.influencer_payouts.find(
        {"influencer_code": code.lower()},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    return payouts

# ==================== IN-APP NOTIFICATIONS ====================

@router.get("/notifications/{code}")
async def get_influencer_notifications(code: str, limit: int = 20):
    """Get in-app notifications for an influencer"""
    notifications = await db.influencer_notifications.find(
        {"influencer_code": code.lower()},
        {"_id": 0}
    ).sort("created_at", -1).to_list(limit)
    
    return notifications

@router.get("/notifications/{code}/unread-count")
async def get_unread_notification_count(code: str):
    """Get count of unread notifications"""
    count = await db.influencer_notifications.count_documents({
        "influencer_code": code.lower(),
        "read": False
    })
    return {"unread_count": count}

@router.post("/notifications/{code}/mark-read")
async def mark_notifications_read(code: str):
    """Mark all notifications as read"""
    result = await db.influencer_notifications.update_many(
        {"influencer_code": code.lower(), "read": False},
        {"$set": {"read": True}}
    )
    return {"marked_read": result.modified_count}

# ==================== HELPER FUNCTIONS ====================

async def record_influencer_purchase(user_id: str, purchase_amount: float):
    """Record a purchase for influencer commission tracking and send notification"""
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        return
    
    influencer_code = user.get("influencer_code")
    if not influencer_code:
        return
    
    # Get influencer details
    influencer = await db.influencers.find_one(
        {"code": influencer_code.lower()},
        {"_id": 0}
    )
    
    if not influencer:
        return
    
    # Update the use record with purchase amount
    await db.influencer_uses.update_one(
        {"user_id": user_id, "influencer_code": influencer_code},
        {"$inc": {"purchase_amount": purchase_amount}}
    )
    
    # Calculate commission for this purchase
    commission_rate = influencer.get("commission_percent", 10)
    commission_earned = purchase_amount * (commission_rate / 100)
    
    # Calculate total commission for email
    uses = await db.influencer_uses.find(
        {"influencer_code": influencer_code.lower()},
        {"_id": 0}
    ).to_list(1000)
    
    total_revenue = sum(u.get("purchase_amount", 0) for u in uses)
    total_commission = total_revenue * (commission_rate / 100)
    
    # Get already paid out amount
    payouts = await db.influencer_payouts.find(
        {"influencer_code": influencer_code.lower(), "status": {"$in": ["completed", "pending"]}},
        {"_id": 0}
    ).to_list(100)
    
    total_paid = sum(p.get("amount", 0) for p in payouts)
    available_commission = total_commission - total_paid
    
    logger.info(f"💰 Influencer purchase recorded: {influencer_code} - €{purchase_amount} (Commission: €{commission_earned:.2f})")
    
    # Send email notification to influencer
    if influencer.get("email"):
        try:
            await send_influencer_new_sale_notification(
                influencer_email=influencer["email"],
                influencer_name=influencer["name"],
                customer_name=user.get("name", "Kunde"),
                purchase_amount=purchase_amount,
                commission_rate=commission_rate,
                commission_earned=commission_earned,
                total_commission=available_commission
            )
        except Exception as e:
            logger.error(f"Failed to send sale notification email: {e}")
    
    # Create in-app notification for influencer
    notification = {
        "id": str(uuid.uuid4()),
        "influencer_code": influencer_code.lower(),
        "type": "new_sale",
        "title": f"💰 Neue Provision: +€{commission_earned:.2f}",
        "message": f"{user.get('name', 'Ein Kunde')} hat €{purchase_amount:.2f} ausgegeben. Ihre Provision: €{commission_earned:.2f}",
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.influencer_notifications.insert_one(notification)
