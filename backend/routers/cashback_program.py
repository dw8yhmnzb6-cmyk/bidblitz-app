"""
BidBlitz Cashback Program API
=============================
Customer loyalty cashback program with:
- 1% base cashback rate
- Instant redemption
- 6-month expiry
- 50/50 cost split (BidBlitz/Merchant)
- Merchant promotions (e.g., double cashback weekends)
"""

from fastapi import APIRouter, HTTPException, Header, Query, Depends
from pydantic import BaseModel, Field
from datetime import datetime, timezone, timedelta
from typing import Optional, List
import uuid
from config import db

router = APIRouter(prefix="/cashback", tags=["Cashback Program"])

# ==================== CONFIGURATION ====================

BASE_CASHBACK_RATE = 0.01  # 1%
CASHBACK_EXPIRY_MONTHS = 6
BIDBLITZ_SHARE = 0.5  # 50%
MERCHANT_SHARE = 0.5  # 50%
MIN_REDEMPTION = 0  # Sofort einlösbar (€0 minimum)


# ==================== MODELS ====================

class CashbackRedemption(BaseModel):
    amount: float = Field(..., gt=0, description="Amount to redeem")

class PromotionCreate(BaseModel):
    name: str = Field(..., description="Promotion name (e.g., 'Doppeltes Cashback Wochenende')")
    description: Optional[str] = None
    multiplier: float = Field(default=2.0, ge=1.0, le=5.0, description="Cashback multiplier (2.0 = double)")
    start_date: str = Field(..., description="Start date ISO format")
    end_date: str = Field(..., description="End date ISO format")
    branch_ids: Optional[List[str]] = None  # If None, applies to all branches

class PromotionUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    multiplier: Optional[float] = None
    is_active: Optional[bool] = None


# ==================== HELPER FUNCTIONS ====================

async def get_user_from_token(authorization: str):
    """Get user from JWT token."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token erforderlich")
    
    token = authorization.replace("Bearer ", "")
    
    # Find session
    session = await db.sessions.find_one({"token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Ungültiger Token")
    
    user = await db.users.find_one({"_id": session.get("user_id")}, {"_id": 0, "password": 0})
    if not user:
        # Try by email
        user = await db.users.find_one({"email": session.get("email")}, {"_id": 0, "password": 0})
    
    if not user:
        raise HTTPException(status_code=401, detail="Benutzer nicht gefunden")
    
    return user


async def get_enterprise_from_token(authorization: str):
    """Get enterprise from token."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token erforderlich")
    
    token = authorization.replace("Bearer ", "")
    
    session = await db.enterprise_sessions.find_one(
        {"token": token, "expires_at": {"$gt": datetime.now(timezone.utc).isoformat()}},
        {"_id": 0}
    )
    
    if not session:
        raise HTTPException(status_code=401, detail="Ungültiger Token")
    
    enterprise = await db.enterprise_accounts.find_one(
        {"id": session["enterprise_id"]},
        {"_id": 0, "password": 0}
    )
    
    return enterprise


async def get_active_promotion(enterprise_id: str = None, branch_id: str = None):
    """Get currently active promotion for a merchant."""
    now = datetime.now(timezone.utc).isoformat()
    
    query = {
        "is_active": True,
        "start_date": {"$lte": now},
        "end_date": {"$gte": now}
    }
    
    if enterprise_id:
        query["enterprise_id"] = enterprise_id
    
    promotion = await db.cashback_promotions.find_one(query, {"_id": 0})
    
    if promotion and branch_id:
        # Check if promotion applies to this branch
        if promotion.get("branch_ids") and branch_id not in promotion["branch_ids"]:
            return None
    
    return promotion


async def calculate_cashback(amount: float, enterprise_id: str = None, branch_id: str = None):
    """Calculate cashback amount including any active promotions."""
    base_cashback = amount * BASE_CASHBACK_RATE
    multiplier = 1.0
    promotion_name = None
    
    # Check for active promotion
    promotion = await get_active_promotion(enterprise_id, branch_id)
    if promotion:
        multiplier = promotion.get("multiplier", 1.0)
        promotion_name = promotion.get("name")
    
    total_cashback = base_cashback * multiplier
    
    return {
        "base_rate": BASE_CASHBACK_RATE,
        "base_cashback": base_cashback,
        "multiplier": multiplier,
        "promotion_name": promotion_name,
        "total_cashback": total_cashback,
        "bidblitz_share": total_cashback * BIDBLITZ_SHARE,
        "merchant_share": total_cashback * MERCHANT_SHARE
    }


async def award_cashback(
    user_id: str,
    amount: float,
    transaction_type: str,
    merchant_name: str = None,
    enterprise_id: str = None,
    branch_id: str = None,
    reference: str = None
):
    """Award cashback to a user after a transaction."""
    
    cashback_info = await calculate_cashback(amount, enterprise_id, branch_id)
    
    if cashback_info["total_cashback"] <= 0:
        return None
    
    now = datetime.now(timezone.utc)
    expiry_date = now + timedelta(days=CASHBACK_EXPIRY_MONTHS * 30)
    
    cashback_id = f"cb_{uuid.uuid4().hex[:12]}"
    
    cashback_record = {
        "id": cashback_id,
        "user_id": user_id,
        "amount": cashback_info["total_cashback"],
        "base_amount": cashback_info["base_cashback"],
        "multiplier": cashback_info["multiplier"],
        "promotion_name": cashback_info["promotion_name"],
        "transaction_amount": amount,
        "transaction_type": transaction_type,
        "merchant_name": merchant_name,
        "enterprise_id": enterprise_id,
        "branch_id": branch_id,
        "reference": reference,
        "bidblitz_share": cashback_info["bidblitz_share"],
        "merchant_share": cashback_info["merchant_share"],
        "status": "available",  # available, redeemed, expired
        "created_at": now.isoformat(),
        "expires_at": expiry_date.isoformat(),
        "redeemed_at": None
    }
    
    await db.cashback_rewards.insert_one(cashback_record)
    
    # Update user's total cashback balance
    await db.users.update_one(
        {"_id": user_id},
        {"$inc": {"cashback_balance": cashback_info["total_cashback"]}}
    )
    
    return cashback_record


# ==================== CUSTOMER ENDPOINTS ====================

@router.get("/balance")
async def get_cashback_balance(authorization: str = Header(None)):
    """Get customer's current cashback balance and summary."""
    user = await get_user_from_token(authorization)
    user_id = str(user.get("_id", user.get("id", user.get("email"))))
    
    # Get available cashback (not expired, not redeemed)
    now = datetime.now(timezone.utc).isoformat()
    
    pipeline = [
        {
            "$match": {
                "user_id": user_id,
                "status": "available",
                "expires_at": {"$gt": now}
            }
        },
        {
            "$group": {
                "_id": None,
                "total_available": {"$sum": "$amount"},
                "count": {"$sum": 1}
            }
        }
    ]
    
    result = await db.cashback_rewards.aggregate(pipeline).to_list(1)
    available = result[0] if result else {"total_available": 0, "count": 0}
    
    # Get total earned (all time)
    total_pipeline = [
        {"$match": {"user_id": user_id}},
        {"$group": {"_id": None, "total_earned": {"$sum": "$amount"}}}
    ]
    total_result = await db.cashback_rewards.aggregate(total_pipeline).to_list(1)
    total_earned = total_result[0]["total_earned"] if total_result else 0
    
    # Get total redeemed
    redeemed_pipeline = [
        {"$match": {"user_id": user_id, "status": "redeemed"}},
        {"$group": {"_id": None, "total_redeemed": {"$sum": "$amount"}}}
    ]
    redeemed_result = await db.cashback_rewards.aggregate(redeemed_pipeline).to_list(1)
    total_redeemed = redeemed_result[0]["total_redeemed"] if redeemed_result else 0
    
    # Get expiring soon (within 30 days)
    expiry_threshold = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
    expiring_pipeline = [
        {
            "$match": {
                "user_id": user_id,
                "status": "available",
                "expires_at": {"$lte": expiry_threshold, "$gt": now}
            }
        },
        {"$group": {"_id": None, "expiring_soon": {"$sum": "$amount"}}}
    ]
    expiring_result = await db.cashback_rewards.aggregate(expiring_pipeline).to_list(1)
    expiring_soon = expiring_result[0]["expiring_soon"] if expiring_result else 0
    
    return {
        "available_balance": available["total_available"],
        "available_count": available["count"],
        "total_earned": total_earned,
        "total_redeemed": total_redeemed,
        "expiring_soon": expiring_soon,
        "expiring_in_days": 30,
        "min_redemption": MIN_REDEMPTION,
        "can_redeem": available["total_available"] >= MIN_REDEMPTION
    }


@router.get("/history")
async def get_cashback_history(
    status: Optional[str] = Query(None, description="Filter by status: available, redeemed, expired"),
    limit: int = Query(50, le=100),
    authorization: str = Header(None)
):
    """Get customer's cashback transaction history."""
    user = await get_user_from_token(authorization)
    user_id = str(user.get("_id", user.get("id", user.get("email"))))
    
    query = {"user_id": user_id}
    if status:
        query["status"] = status
    
    transactions = await db.cashback_rewards.find(
        query, {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return {"transactions": transactions, "total": len(transactions)}


@router.post("/redeem")
async def redeem_cashback(data: CashbackRedemption, authorization: str = Header(None)):
    """Redeem cashback to user's BidBlitz balance."""
    user = await get_user_from_token(authorization)
    user_id = str(user.get("_id", user.get("id", user.get("email"))))
    
    # Get available balance
    now = datetime.now(timezone.utc)
    
    pipeline = [
        {
            "$match": {
                "user_id": user_id,
                "status": "available",
                "expires_at": {"$gt": now.isoformat()}
            }
        },
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]
    
    result = await db.cashback_rewards.aggregate(pipeline).to_list(1)
    available = result[0]["total"] if result else 0
    
    if data.amount > available:
        raise HTTPException(
            status_code=400, 
            detail=f"Nicht genügend Cashback. Verfügbar: €{available:.2f}"
        )
    
    if data.amount < MIN_REDEMPTION:
        raise HTTPException(
            status_code=400,
            detail=f"Mindestbetrag für Einlösung: €{MIN_REDEMPTION:.2f}"
        )
    
    # Mark cashback records as redeemed (FIFO - oldest first)
    remaining = data.amount
    
    rewards = await db.cashback_rewards.find(
        {
            "user_id": user_id,
            "status": "available",
            "expires_at": {"$gt": now.isoformat()}
        }
    ).sort("created_at", 1).to_list(100)
    
    redeemed_ids = []
    for reward in rewards:
        if remaining <= 0:
            break
        
        if reward["amount"] <= remaining:
            # Fully redeem this reward
            await db.cashback_rewards.update_one(
                {"id": reward["id"]},
                {"$set": {"status": "redeemed", "redeemed_at": now.isoformat()}}
            )
            remaining -= reward["amount"]
            redeemed_ids.append(reward["id"])
        else:
            # Partially redeem - split the reward
            partial_amount = remaining
            
            # Update original to show only remaining
            await db.cashback_rewards.update_one(
                {"id": reward["id"]},
                {"$inc": {"amount": -partial_amount}}
            )
            
            # Create redeemed record
            redeemed_id = f"cb_{uuid.uuid4().hex[:12]}"
            await db.cashback_rewards.insert_one({
                "id": redeemed_id,
                "user_id": user_id,
                "amount": partial_amount,
                "original_id": reward["id"],
                "status": "redeemed",
                "redeemed_at": now.isoformat(),
                "created_at": now.isoformat()
            })
            
            remaining = 0
            redeemed_ids.append(redeemed_id)
    
    # Add to user's BidBlitz balance
    await db.users.update_one(
        {"email": user.get("email")},
        {
            "$inc": {
                "bidblitz_balance": data.amount,
                "cashback_balance": -data.amount
            }
        }
    )
    
    # Record the redemption transaction
    redemption_id = f"cbr_{uuid.uuid4().hex[:12]}"
    await db.cashback_redemptions.insert_one({
        "id": redemption_id,
        "user_id": user_id,
        "amount": data.amount,
        "redeemed_reward_ids": redeemed_ids,
        "created_at": now.isoformat()
    })
    
    # Get new balance
    updated_user = await db.users.find_one({"email": user.get("email")}, {"_id": 0})
    new_balance = updated_user.get("bidblitz_balance", 0)
    
    return {
        "success": True,
        "redeemed_amount": data.amount,
        "new_bidblitz_balance": new_balance,
        "message": f"€{data.amount:.2f} Cashback erfolgreich eingelöst!"
    }


# ==================== ENTERPRISE/MERCHANT ENDPOINTS ====================

@router.get("/enterprise/stats")
async def get_enterprise_cashback_stats(
    period: str = Query("month", description="day, week, month, year"),
    authorization: str = Header(None)
):
    """Get cashback statistics for enterprise."""
    enterprise = await get_enterprise_from_token(authorization)
    
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
    
    pipeline = [
        {
            "$match": {
                "enterprise_id": enterprise["id"],
                "created_at": {"$gte": start_date.isoformat()}
            }
        },
        {
            "$group": {
                "_id": None,
                "total_cashback_given": {"$sum": "$amount"},
                "merchant_cost": {"$sum": "$merchant_share"},
                "bidblitz_cost": {"$sum": "$bidblitz_share"},
                "transactions_count": {"$sum": 1},
                "avg_cashback": {"$avg": "$amount"}
            }
        }
    ]
    
    result = await db.cashback_rewards.aggregate(pipeline).to_list(1)
    stats = result[0] if result else {
        "total_cashback_given": 0,
        "merchant_cost": 0,
        "bidblitz_cost": 0,
        "transactions_count": 0,
        "avg_cashback": 0
    }
    
    # Get active promotions count
    active_promotions = await db.cashback_promotions.count_documents({
        "enterprise_id": enterprise["id"],
        "is_active": True,
        "end_date": {"$gt": now.isoformat()}
    })
    
    return {
        "period": period,
        "stats": stats,
        "active_promotions": active_promotions,
        "base_rate": BASE_CASHBACK_RATE * 100,  # As percentage
        "merchant_share_percent": MERCHANT_SHARE * 100
    }


@router.post("/enterprise/promotions")
async def create_promotion(data: PromotionCreate, authorization: str = Header(None)):
    """Create a new cashback promotion (e.g., double cashback weekend)."""
    enterprise = await get_enterprise_from_token(authorization)
    
    promotion_id = f"promo_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)
    
    promotion = {
        "id": promotion_id,
        "enterprise_id": enterprise["id"],
        "name": data.name,
        "description": data.description,
        "multiplier": data.multiplier,
        "start_date": data.start_date,
        "end_date": data.end_date,
        "branch_ids": data.branch_ids,
        "is_active": True,
        "created_at": now.isoformat()
    }
    
    await db.cashback_promotions.insert_one(promotion)
    
    return {
        "success": True,
        "promotion_id": promotion_id,
        "message": f"Aktion '{data.name}' erstellt! Cashback x{data.multiplier}"
    }


@router.get("/enterprise/promotions")
async def list_promotions(
    include_expired: bool = Query(False),
    authorization: str = Header(None)
):
    """List all promotions for the enterprise."""
    enterprise = await get_enterprise_from_token(authorization)
    
    query = {"enterprise_id": enterprise["id"]}
    
    if not include_expired:
        query["end_date"] = {"$gt": datetime.now(timezone.utc).isoformat()}
    
    promotions = await db.cashback_promotions.find(
        query, {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    return {"promotions": promotions, "total": len(promotions)}


@router.put("/enterprise/promotions/{promotion_id}")
async def update_promotion(
    promotion_id: str,
    data: PromotionUpdate,
    authorization: str = Header(None)
):
    """Update a promotion."""
    enterprise = await get_enterprise_from_token(authorization)
    
    update_data = {k: v for k, v in data.dict().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="Keine Änderungen angegeben")
    
    result = await db.cashback_promotions.update_one(
        {"id": promotion_id, "enterprise_id": enterprise["id"]},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Aktion nicht gefunden")
    
    return {"success": True, "message": "Aktion aktualisiert"}


@router.delete("/enterprise/promotions/{promotion_id}")
async def delete_promotion(promotion_id: str, authorization: str = Header(None)):
    """Delete a promotion."""
    enterprise = await get_enterprise_from_token(authorization)
    
    result = await db.cashback_promotions.delete_one({
        "id": promotion_id,
        "enterprise_id": enterprise["id"]
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Aktion nicht gefunden")
    
    return {"success": True, "message": "Aktion gelöscht"}


# ==================== PUBLIC ENDPOINTS ====================

@router.get("/info")
async def get_cashback_program_info():
    """Get public information about the cashback program."""
    return {
        "program_name": "BidBlitz Cashback",
        "base_rate": BASE_CASHBACK_RATE * 100,  # As percentage (1%)
        "base_rate_display": f"{BASE_CASHBACK_RATE * 100:.0f}%",
        "expiry_months": CASHBACK_EXPIRY_MONTHS,
        "min_redemption": MIN_REDEMPTION,
        "instant_redemption": MIN_REDEMPTION == 0,
        "description": "Sammeln Sie bei jedem Einkauf 1% Cashback! Sofort einlösbar, gültig für 6 Monate.",
        "features": [
            "1% Cashback bei jedem Einkauf",
            "Sofort einlösbar - kein Mindestbetrag",
            "6 Monate gültig",
            "Bonus-Aktionen bei teilnehmenden Händlern"
        ]
    }


@router.get("/active-promotions")
async def get_active_promotions_public():
    """Get list of currently active promotions (public)."""
    now = datetime.now(timezone.utc).isoformat()
    
    promotions = await db.cashback_promotions.find(
        {
            "is_active": True,
            "start_date": {"$lte": now},
            "end_date": {"$gte": now}
        },
        {"_id": 0, "enterprise_id": 0}
    ).to_list(20)
    
    # Get merchant names for promotions
    for promo in promotions:
        enterprise = await db.enterprise_accounts.find_one(
            {"id": promo.get("enterprise_id")},
            {"_id": 0, "company_name": 1}
        )
        promo["merchant_name"] = enterprise.get("company_name") if enterprise else "Partner"
    
    return {"promotions": promotions, "total": len(promotions)}
