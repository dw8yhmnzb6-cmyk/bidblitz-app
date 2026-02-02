"""Loyalty Points System - Treuepunkte für jeden Kauf"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone, timedelta
from typing import Optional
import uuid

from config import db, logger
from dependencies import get_current_user

router = APIRouter(prefix="/loyalty", tags=["Loyalty"])

# Points configuration
POINTS_PER_EURO = 10  # 10 points per €1 spent
POINTS_PER_BID = 1    # 1 point per bid used
POINTS_PER_WIN = 50   # 50 bonus points per auction win

# Redemption tiers
REDEMPTION_TIERS = [
    {"points": 500, "reward": "5_bids", "bids": 5, "description": "5 Gratis-Gebote"},
    {"points": 1000, "reward": "12_bids", "bids": 12, "description": "12 Gratis-Gebote (+20% Bonus)"},
    {"points": 2000, "reward": "free_shipping", "bids": 0, "description": "Gratis-Versand (nächster Gewinn)"},
    {"points": 3000, "reward": "30_bids", "bids": 30, "description": "30 Gratis-Gebote (+50% Bonus)"},
    {"points": 5000, "reward": "vip_week", "bids": 0, "description": "1 Woche VIP-Status"},
    {"points": 10000, "reward": "100_bids", "bids": 100, "description": "100 Gratis-Gebote (+100% Bonus)"},
]

# ==================== USER ENDPOINTS ====================

@router.get("/balance")
async def get_loyalty_balance(user: dict = Depends(get_current_user)):
    """Get user's loyalty points balance and history"""
    user_id = user["id"]
    
    # Get or create loyalty record
    loyalty = await db.loyalty_points.find_one({"user_id": user_id}, {"_id": 0})
    
    if not loyalty:
        loyalty = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "total_points": 0,
            "available_points": 0,
            "lifetime_points": 0,
            "level": "Bronze",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.loyalty_points.insert_one(loyalty)
    
    # Get recent transactions
    transactions = await db.loyalty_transactions.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(20).to_list(20)
    
    # Calculate next tier
    available = loyalty.get("available_points", 0)
    next_tier = None
    for tier in REDEMPTION_TIERS:
        if tier["points"] > available:
            next_tier = tier
            break
    
    return {
        "balance": loyalty,
        "transactions": transactions,
        "redemption_tiers": REDEMPTION_TIERS,
        "next_tier": next_tier,
        "points_to_next": next_tier["points"] - available if next_tier else 0
    }

@router.post("/redeem/{tier_index}")
async def redeem_points(tier_index: int, user: dict = Depends(get_current_user)):
    """Redeem loyalty points for rewards"""
    user_id = user["id"]
    
    if tier_index < 0 or tier_index >= len(REDEMPTION_TIERS):
        raise HTTPException(status_code=400, detail="Ungültige Belohnungsstufe")
    
    tier = REDEMPTION_TIERS[tier_index]
    
    # Check balance
    loyalty = await db.loyalty_points.find_one({"user_id": user_id})
    if not loyalty or loyalty.get("available_points", 0) < tier["points"]:
        raise HTTPException(status_code=400, detail="Nicht genug Punkte")
    
    # Deduct points
    await db.loyalty_points.update_one(
        {"user_id": user_id},
        {"$inc": {"available_points": -tier["points"]}}
    )
    
    # Apply reward
    reward_applied = False
    reward_message = ""
    
    if tier["bids"] > 0:
        # Give bids
        await db.users.update_one(
            {"id": user_id},
            {"$inc": {"bids_balance": tier["bids"]}}
        )
        reward_applied = True
        reward_message = f"{tier['bids']} Gebote gutgeschrieben!"
    
    elif tier["reward"] == "free_shipping":
        # Set free shipping flag
        await db.users.update_one(
            {"id": user_id},
            {"$set": {"free_shipping_next_win": True}}
        )
        reward_applied = True
        reward_message = "Gratis-Versand für deinen nächsten Gewinn aktiviert!"
    
    elif tier["reward"] == "vip_week":
        # Grant VIP for 1 week
        vip_until = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
        await db.users.update_one(
            {"id": user_id},
            {"$set": {"is_vip": True, "vip_until": vip_until}}
        )
        reward_applied = True
        reward_message = "VIP-Status für 1 Woche aktiviert!"
    
    # Log transaction
    await db.loyalty_transactions.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "type": "redemption",
        "points": -tier["points"],
        "description": f"Eingelöst: {tier['description']}",
        "reward": tier["reward"],
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    logger.info(f"Loyalty redemption: {user_id} redeemed {tier['points']} points for {tier['reward']}")
    
    return {
        "success": reward_applied,
        "message": reward_message,
        "points_spent": tier["points"],
        "reward": tier["description"]
    }

@router.get("/history")
async def get_points_history(
    limit: int = 50,
    user: dict = Depends(get_current_user)
):
    """Get detailed points history"""
    transactions = await db.loyalty_transactions.find(
        {"user_id": user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return {"transactions": transactions}

# ==================== POINTS AWARDING FUNCTIONS ====================

async def award_purchase_points(user_id: str, amount_eur: float):
    """Award points for a purchase"""
    points = int(amount_eur * POINTS_PER_EURO)
    
    await db.loyalty_points.update_one(
        {"user_id": user_id},
        {
            "$inc": {
                "total_points": points,
                "available_points": points,
                "lifetime_points": points
            },
            "$setOnInsert": {
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "level": "Bronze",
                "created_at": datetime.now(timezone.utc).isoformat()
            }
        },
        upsert=True
    )
    
    await db.loyalty_transactions.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "type": "purchase",
        "points": points,
        "description": f"Kauf: €{amount_eur:.2f} = {points} Punkte",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    logger.info(f"Loyalty: {user_id} earned {points} points from €{amount_eur} purchase")
    return points

async def award_bid_points(user_id: str, bids_used: int = 1):
    """Award points for placing bids"""
    points = bids_used * POINTS_PER_BID
    
    await db.loyalty_points.update_one(
        {"user_id": user_id},
        {"$inc": {"total_points": points, "available_points": points, "lifetime_points": points}},
        upsert=True
    )
    
    # Don't log individual bids to avoid spam, just update the balance
    return points

async def award_win_points(user_id: str, auction_title: str):
    """Award bonus points for winning an auction"""
    points = POINTS_PER_WIN
    
    await db.loyalty_points.update_one(
        {"user_id": user_id},
        {"$inc": {"total_points": points, "available_points": points, "lifetime_points": points}},
        upsert=True
    )
    
    await db.loyalty_transactions.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "type": "auction_win",
        "points": points,
        "description": f"Auktion gewonnen: {auction_title}",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    logger.info(f"Loyalty: {user_id} earned {points} bonus points for winning auction")
    return points

# Export for use in other modules
__all__ = ['award_purchase_points', 'award_bid_points', 'award_win_points']
