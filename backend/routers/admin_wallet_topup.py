"""
Admin Wallet Top-up Router
Allows admins to top-up customer BidBlitz Pay wallets
Includes bonuses: configurable customer bonus, €1 first top-up, configurable merchant commission
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from datetime import datetime, timezone, timedelta
from typing import Optional
from pydantic import BaseModel
import uuid

from config import db, logger
from dependencies import get_admin_user

router = APIRouter(tags=["Admin Wallet Top-up"])

# ==================== DEFAULT CONSTANTS ====================
DEFAULT_CUSTOMER_BONUS_PERCENT = 0.02  # 2% customer bonus
FIRST_TOPUP_BONUS = 1.0  # €1 for first top-up
DEFAULT_MERCHANT_COMMISSION_PERCENT = 0.02  # 2% merchant commission

# ==================== MODELS ====================

class TopUpRequest(BaseModel):
    user_id: str
    amount: float
    merchant_id: Optional[str] = None

class CommissionSettingsRequest(BaseModel):
    customer_bonus_percent: Optional[float] = None  # 0.02 = 2%
    merchant_commission_percent: Optional[float] = None  # 0.02 = 2%

class MerchantCommissionRequest(BaseModel):
    merchant_id: str
    commission_percent: float  # 0.02 = 2%

# ==================== HELPER FUNCTIONS ====================

async def get_commission_settings():
    """Get global commission settings from DB or return defaults"""
    settings = await db.settings.find_one({"type": "commission_settings"}, {"_id": 0})
    if not settings:
        return {
            "customer_bonus_percent": DEFAULT_CUSTOMER_BONUS_PERCENT,
            "merchant_commission_percent": DEFAULT_MERCHANT_COMMISSION_PERCENT
        }
    return {
        "customer_bonus_percent": settings.get("customer_bonus_percent", DEFAULT_CUSTOMER_BONUS_PERCENT),
        "merchant_commission_percent": settings.get("merchant_commission_percent", DEFAULT_MERCHANT_COMMISSION_PERCENT)
    }

async def get_merchant_commission_rate(merchant_id: str, default_rate: float):
    """Get merchant-specific commission rate or return default"""
    if not merchant_id:
        return default_rate
    merchant = await db.partner_accounts.find_one({"id": merchant_id}, {"_id": 0, "commission_rate": 1})
    if merchant and "commission_rate" in merchant:
        return merchant["commission_rate"]
    return default_rate

# ==================== COMMISSION SETTINGS ENDPOINTS ====================

@router.get("/commission-settings")
async def get_commission_settings_endpoint(admin: dict = Depends(get_admin_user)):
    """Get current commission settings"""
    settings = await get_commission_settings()
    return {
        "customer_bonus_percent": settings["customer_bonus_percent"],
        "customer_bonus_display": f"{settings['customer_bonus_percent'] * 100:.1f}%",
        "merchant_commission_percent": settings["merchant_commission_percent"],
        "merchant_commission_display": f"{settings['merchant_commission_percent'] * 100:.1f}%"
    }

@router.put("/commission-settings")
async def update_commission_settings(
    data: CommissionSettingsRequest,
    admin: dict = Depends(get_admin_user)
):
    """Update global commission settings"""
    update_data = {"type": "commission_settings", "updated_at": datetime.now(timezone.utc).isoformat()}
    
    if data.customer_bonus_percent is not None:
        if not 0 <= data.customer_bonus_percent <= 0.5:  # Max 50%
            raise HTTPException(status_code=400, detail="Kundenbonus muss zwischen 0% und 50% liegen")
        update_data["customer_bonus_percent"] = data.customer_bonus_percent
    
    if data.merchant_commission_percent is not None:
        if not 0 <= data.merchant_commission_percent <= 0.5:  # Max 50%
            raise HTTPException(status_code=400, detail="Händlerprovision muss zwischen 0% und 50% liegen")
        update_data["merchant_commission_percent"] = data.merchant_commission_percent
    
    await db.settings.update_one(
        {"type": "commission_settings"},
        {"$set": update_data},
        upsert=True
    )
    
    return {"message": "Einstellungen gespeichert", "settings": update_data}

@router.put("/merchant-commission")
async def update_merchant_commission(
    data: MerchantCommissionRequest,
    admin: dict = Depends(get_admin_user)
):
    """Set commission rate for a specific merchant"""
    if not 0 <= data.commission_percent <= 0.5:  # Max 50%
        raise HTTPException(status_code=400, detail="Provision muss zwischen 0% und 50% liegen")
    
    result = await db.partner_accounts.update_one(
        {"id": data.merchant_id},
        {"$set": {"commission_rate": data.commission_percent}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Händler nicht gefunden")
    
    return {
        "message": f"Provision für Händler auf {data.commission_percent * 100:.1f}% gesetzt",
        "merchant_id": data.merchant_id,
        "commission_percent": data.commission_percent
    }

# ==================== MAIN ENDPOINTS ====================

@router.get("/search")
async def search_customers(
    query: str = Query(..., min_length=1),
    admin: dict = Depends(get_admin_user)
):
    """Search customers by email, ID, name, or customer number"""
    # Search by email (case-insensitive), ID, name, or customer_number
    users = await db.users.find({
        "$or": [
            {"email": {"$regex": query, "$options": "i"}},
            {"id": {"$regex": query, "$options": "i"}},
            {"name": {"$regex": query, "$options": "i"}},
            {"customer_number": {"$regex": query, "$options": "i"}}
        ]
    }, {
        "_id": 0,
        "id": 1,
        "name": 1,
        "email": 1,
        "customer_number": 1,
        "bidblitz_balance": 1,
        "has_first_topup": 1
    }).limit(10).to_list(10)
    
    return {"users": users}

@router.post("/topup")
async def topup_customer_wallet(
    data: TopUpRequest,
    admin: dict = Depends(get_admin_user)
):
    """Top up customer BidBlitz Pay wallet with bonuses"""
    amount = data.amount
    
    if amount < 1:
        raise HTTPException(status_code=400, detail="Mindestbetrag: €1")
    if amount > 10000:
        raise HTTPException(status_code=400, detail="Maximalbetrag: €10,000")
    
    # Get user
    user = await db.users.find_one(
        {"id": data.user_id},
        {"_id": 0, "id": 1, "name": 1, "email": 1, "bidblitz_balance": 1, "has_first_topup": 1}
    )
    if not user:
        raise HTTPException(status_code=404, detail="Kunde nicht gefunden")
    
    # Get commission settings
    settings = await get_commission_settings()
    customer_bonus_rate = settings["customer_bonus_percent"]
    default_merchant_rate = settings["merchant_commission_percent"]
    
    # Calculate bonuses
    customer_bonus = amount * customer_bonus_rate
    first_topup_bonus = 0.0
    
    # Check if first top-up
    if not user.get("has_first_topup", False):
        first_topup_bonus = FIRST_TOPUP_BONUS
    
    # Total credit
    total_credit = amount + customer_bonus + first_topup_bonus
    
    # Calculate merchant commission (if merchant provided) - use merchant-specific rate or default
    merchant_commission = 0
    merchant_commission_rate = 0
    if data.merchant_id:
        merchant_commission_rate = await get_merchant_commission_rate(data.merchant_id, default_merchant_rate)
        merchant_commission = amount * merchant_commission_rate
    
    # Update user balance
    await db.users.update_one(
        {"id": data.user_id},
        {
            "$inc": {"bidblitz_balance": total_credit},
            "$set": {"has_first_topup": True}
        }
    )
    
    # Create transaction record
    transaction_id = str(uuid.uuid4())
    transaction_doc = {
        "id": transaction_id,
        "user_id": data.user_id,
        "user_name": user.get("name", ""),
        "user_email": user.get("email", ""),
        "type": "admin_topup",
        "amount": amount,
        "customer_bonus": customer_bonus,
        "first_topup_bonus": first_topup_bonus,
        "total_credit": total_credit,
        "merchant_id": data.merchant_id,
        "merchant_commission": merchant_commission,
        "admin_id": admin["id"],
        "admin_name": admin.get("name", ""),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.admin_wallet_topups.insert_one(transaction_doc)
    
    # Update merchant commission if applicable
    if data.merchant_id and merchant_commission > 0:
        await db.partner_accounts.update_one(
            {"id": data.merchant_id},
            {
                "$inc": {
                    "total_commission": merchant_commission,
                    "pending_commission": merchant_commission,
                    "topup_count": 1,
                    "topup_volume": amount
                }
            }
        )
    
    # Update daily stats
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    await db.admin_topup_stats.update_one(
        {"date": today},
        {
            "$inc": {
                "total_topups": 1,
                "total_amount": amount,
                "total_bonus": customer_bonus + first_topup_bonus,
                "new_customers": 1 if first_topup_bonus > 0 else 0
            }
        },
        upsert=True
    )
    
    logger.info(f"💰 Admin top-up: {admin['id']} -> {data.user_id}: €{amount} (+€{customer_bonus + first_topup_bonus} bonus)")
    
    # Get new balance
    updated_user = await db.users.find_one({"id": data.user_id}, {"_id": 0, "bidblitz_balance": 1})
    
    return {
        "success": True,
        "transaction_id": transaction_id,
        "amount": amount,
        "customer_bonus": customer_bonus,
        "first_topup_bonus": first_topup_bonus,
        "total_credit": total_credit,
        "merchant_commission": merchant_commission,
        "new_balance": updated_user.get("bidblitz_balance", 0),
        "message": f"€{total_credit:.2f} erfolgreich gutgeschrieben"
    }

@router.get("/stats")
async def get_topup_stats(admin: dict = Depends(get_admin_user)):
    """Get top-up statistics, leaderboard, and recent transactions"""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    # Get today's stats
    stats_doc = await db.admin_topup_stats.find_one({"date": today}, {"_id": 0})
    stats = {
        "totalTopUps": stats_doc.get("total_topups", 0) if stats_doc else 0,
        "totalAmount": stats_doc.get("total_amount", 0) if stats_doc else 0,
        "totalBonus": stats_doc.get("total_bonus", 0) if stats_doc else 0,
        "newCustomers": stats_doc.get("new_customers", 0) if stats_doc else 0
    }
    
    # Get merchant leaderboard (top 3 by volume this month)
    start_of_month = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    # Aggregate top merchants
    leaderboard_pipeline = [
        {
            "$match": {
                "created_at": {"$gte": start_of_month.isoformat()},
                "merchant_id": {"$ne": None}
            }
        },
        {
            "$group": {
                "_id": "$merchant_id",
                "total_volume": {"$sum": "$amount"},
                "commission": {"$sum": "$merchant_commission"},
                "topups_count": {"$sum": 1}
            }
        },
        {"$sort": {"total_volume": -1}},
        {"$limit": 3}
    ]
    
    leaderboard_raw = await db.admin_wallet_topups.aggregate(leaderboard_pipeline).to_list(3)
    
    # Enrich with merchant names
    leaderboard = []
    for item in leaderboard_raw:
        merchant = await db.partner_accounts.find_one(
            {"id": item["_id"]},
            {"_id": 0, "company_name": 1}
        )
        leaderboard.append({
            "id": item["_id"],
            "name": merchant.get("company_name", "Unbekannt") if merchant else "Unbekannt",
            "total_volume": item["total_volume"],
            "commission": item["commission"],
            "topups_count": item["topups_count"]
        })
    
    # Get recent top-ups
    recent_topups = await db.admin_wallet_topups.find(
        {},
        {"_id": 0}
    ).sort("created_at", -1).limit(10).to_list(10)
    
    # Format recent topups
    recent = []
    for topup in recent_topups:
        recent.append({
            "id": topup.get("id"),
            "user_name": topup.get("user_name", "Unbekannt"),
            "amount": topup.get("amount", 0),
            "bonus": topup.get("customer_bonus", 0) + topup.get("first_topup_bonus", 0),
            "created_at": topup.get("created_at")
        })
    
    return {
        "stats": stats,
        "leaderboard": leaderboard,
        "recent_topups": recent
    }

@router.get("/history")
async def get_topup_history(
    admin: dict = Depends(get_admin_user),
    page: int = 1,
    limit: int = 20,
    user_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None
):
    """Get paginated top-up history with filters"""
    query = {}
    
    if user_id:
        query["user_id"] = user_id
    
    if date_from:
        query["created_at"] = {"$gte": date_from}
    if date_to:
        if "created_at" in query:
            query["created_at"]["$lte"] = date_to
        else:
            query["created_at"] = {"$lte": date_to}
    
    skip = (page - 1) * limit
    
    topups = await db.admin_wallet_topups.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    total = await db.admin_wallet_topups.count_documents(query)
    
    return {
        "topups": topups,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit
    }
