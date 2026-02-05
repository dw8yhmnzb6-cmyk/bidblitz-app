"""User Statistics - Personal stats and savings tracker"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone, timedelta
from typing import Optional
import uuid

from config import db, logger
from dependencies import get_current_user

router = APIRouter(prefix="/user-stats", tags=["User Statistics"])

# ==================== STATISTICS ENDPOINTS ====================

@router.get("/overview")
async def get_stats_overview(user: dict = Depends(get_current_user)):
    """Get comprehensive user statistics overview"""
    user_id = user["id"]
    
    # Get won auctions
    won_auctions = await db.won_auctions.find(
        {"user_id": user_id},
        {"_id": 0}
    ).to_list(1000)
    
    # Calculate savings
    total_savings = 0
    total_retail_value = 0
    total_paid = 0
    
    for auction in won_auctions:
        retail = auction.get("retail_price") or 0
        paid = (auction.get("final_price") or 0) + (auction.get("bids_cost") or 0)
        total_retail_value += retail
        total_paid += paid
        total_savings += max(0, retail - paid)
    
    # Get bid statistics
    total_bids_placed = await db.bids.count_documents({"user_id": user_id})
    total_bids_purchased = user.get("total_bids_purchased", 0)
    
    # Get auction participation
    participated_auctions = await db.bids.distinct("auction_id", {"user_id": user_id})
    
    # Win rate
    win_rate = (len(won_auctions) / len(participated_auctions) * 100) if participated_auctions else 0
    
    # Loyalty points
    loyalty = await db.loyalty_points.find_one({"user_id": user_id}, {"_id": 0})
    
    # Streak info
    current_streak = user.get("login_streak", 0)
    max_streak = user.get("max_login_streak", 0)
    
    # Recent activity (last 30 days)
    thirty_days_ago = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    recent_bids = await db.bids.count_documents({
        "user_id": user_id,
        "created_at": {"$gte": thirty_days_ago}
    })
    recent_wins = await db.won_auctions.count_documents({
        "user_id": user_id,
        "won_at": {"$gte": thirty_days_ago}
    })
    
    return {
        "overview": {
            "total_savings": round(total_savings, 2),
            "total_retail_value": round(total_retail_value, 2),
            "total_paid": round(total_paid, 2),
            "savings_percentage": round((total_savings / total_retail_value * 100), 1) if total_retail_value > 0 else 0
        },
        "auctions": {
            "total_won": len(won_auctions),
            "total_participated": len(participated_auctions),
            "win_rate": round(win_rate, 1)
        },
        "bids": {
            "total_placed": total_bids_placed,
            "total_purchased": total_bids_purchased,
            "current_balance": user.get("bids_balance", 0)
        },
        "loyalty": {
            "available_points": loyalty.get("available_points", 0) if loyalty else 0,
            "lifetime_points": loyalty.get("lifetime_points", 0) if loyalty else 0,
            "level": loyalty.get("level", "Bronze") if loyalty else "Bronze"
        },
        "streaks": {
            "current_login_streak": current_streak,
            "max_login_streak": max_streak
        },
        "recent_activity": {
            "bids_last_30_days": recent_bids,
            "wins_last_30_days": recent_wins
        },
        "member_since": user.get("created_at", ""),
        "is_vip": user.get("is_vip", False)
    }

@router.get("/achievements")
async def get_achievements(user: dict = Depends(get_current_user)):
    """Get user achievements and badges"""
    user_id = user["id"]
    
    # Define achievements
    achievements = [
        {
            "id": "first_win",
            "name": "Erster Sieg",
            "description": "Erste Auktion gewonnen",
            "icon": "🏆",
            "unlocked": False
        },
        {
            "id": "bid_100",
            "name": "Fleißiger Bieter",
            "description": "100 Gebote platziert",
            "icon": "⚡",
            "unlocked": False
        },
        {
            "id": "bid_500",
            "name": "Power-Bieter",
            "description": "500 Gebote platziert",
            "icon": "💪",
            "unlocked": False
        },
        {
            "id": "bid_1000",
            "name": "Gebot-Meister",
            "description": "1000 Gebote platziert",
            "icon": "👑",
            "unlocked": False
        },
        {
            "id": "win_5",
            "name": "Gewinner",
            "description": "5 Auktionen gewonnen",
            "icon": "🥇",
            "unlocked": False
        },
        {
            "id": "win_25",
            "name": "Champion",
            "description": "25 Auktionen gewonnen",
            "icon": "🏅",
            "unlocked": False
        },
        {
            "id": "savings_100",
            "name": "Sparfuchs",
            "description": "€100 gespart",
            "icon": "💰",
            "unlocked": False
        },
        {
            "id": "savings_500",
            "name": "Spar-Profi",
            "description": "€500 gespart",
            "icon": "💎",
            "unlocked": False
        },
        {
            "id": "streak_7",
            "name": "Treuer Besucher",
            "description": "7 Tage Login-Streak",
            "icon": "🔥",
            "unlocked": False
        },
        {
            "id": "streak_30",
            "name": "Stammgast",
            "description": "30 Tage Login-Streak",
            "icon": "⭐",
            "unlocked": False
        },
        {
            "id": "referral_1",
            "name": "Empfehler",
            "description": "Ersten Freund geworben",
            "icon": "🤝",
            "unlocked": False
        },
        {
            "id": "vip",
            "name": "VIP-Status",
            "description": "VIP-Mitglied geworden",
            "icon": "👑",
            "unlocked": False
        }
    ]
    
    # Check unlocks
    total_bids = await db.bids.count_documents({"user_id": user_id})
    total_wins = await db.won_auctions.count_documents({"user_id": user_id})
    
    # Calculate savings
    won_auctions = await db.won_auctions.find({"user_id": user_id}, {"_id": 0}).to_list(1000)
    total_savings = sum(
        max(0, (a.get("retail_price") or 0) - (a.get("final_price") or 0) - (a.get("bids_cost") or 0))
        for a in won_auctions
    )
    
    max_streak = user.get("max_login_streak", 0)
    referrals = await db.referrals.count_documents({"referrer_id": user_id, "has_purchased": True})
    
    # Update achievement status
    for ach in achievements:
        if ach["id"] == "first_win" and total_wins >= 1:
            ach["unlocked"] = True
        elif ach["id"] == "bid_100" and total_bids >= 100:
            ach["unlocked"] = True
        elif ach["id"] == "bid_500" and total_bids >= 500:
            ach["unlocked"] = True
        elif ach["id"] == "bid_1000" and total_bids >= 1000:
            ach["unlocked"] = True
        elif ach["id"] == "win_5" and total_wins >= 5:
            ach["unlocked"] = True
        elif ach["id"] == "win_25" and total_wins >= 25:
            ach["unlocked"] = True
        elif ach["id"] == "savings_100" and total_savings >= 100:
            ach["unlocked"] = True
        elif ach["id"] == "savings_500" and total_savings >= 500:
            ach["unlocked"] = True
        elif ach["id"] == "streak_7" and max_streak >= 7:
            ach["unlocked"] = True
        elif ach["id"] == "streak_30" and max_streak >= 30:
            ach["unlocked"] = True
        elif ach["id"] == "referral_1" and referrals >= 1:
            ach["unlocked"] = True
        elif ach["id"] == "vip" and user.get("is_vip"):
            ach["unlocked"] = True
    
    unlocked = [a for a in achievements if a["unlocked"]]
    locked = [a for a in achievements if not a["unlocked"]]
    
    return {
        "achievements": achievements,
        "unlocked_count": len(unlocked),
        "total_count": len(achievements),
        "completion_percentage": round(len(unlocked) / len(achievements) * 100)
    }

@router.get("/history")
async def get_bidding_history(
    limit: int = 50,
    offset: int = 0,
    user: dict = Depends(get_current_user)
):
    """Get user's bidding history"""
    bids = await db.bids.find(
        {"user_id": user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).skip(offset).limit(limit).to_list(limit)
    
    # Enrich with auction info
    enriched = []
    for bid in bids:
        auction = await db.auctions.find_one(
            {"id": bid["auction_id"]},
            {"_id": 0, "id": 1, "status": 1}
        )
        product = None
        if auction:
            product = await db.products.find_one(
                {"id": auction.get("product_id")},
                {"_id": 0, "name": 1, "image_url": 1}
            )
        enriched.append({
            **bid,
            "auction_status": auction.get("status") if auction else "unknown",
            "product_name": product.get("name") if product else "Unbekannt",
            "product_image": product.get("image_url") if product else None
        })
    
    total = await db.bids.count_documents({"user_id": user["id"]})
    
    return {
        "bids": enriched,
        "total": total,
        "has_more": offset + limit < total
    }

@router.get("/wins")
async def get_win_history(
    limit: int = 50,
    user: dict = Depends(get_current_user)
):
    """Get user's win history with savings"""
    wins = await db.won_auctions.find(
        {"user_id": user["id"]},
        {"_id": 0}
    ).sort("won_at", -1).limit(limit).to_list(limit)
    
    # Enrich with product info
    enriched = []
    for win in wins:
        product = await db.products.find_one(
            {"id": win.get("product_id")},
            {"_id": 0, "name": 1, "image_url": 1, "retail_price": 1}
        )
        
        retail = win.get("retail_price", 0)
        paid = win.get("final_price", 0) + win.get("bids_cost", 0)
        savings = max(0, retail - paid)
        
        enriched.append({
            **win,
            "product": product,
            "savings": round(savings, 2),
            "savings_percent": round((savings / retail * 100), 1) if retail > 0 else 0
        })
    
    return {"wins": enriched}

@router.get("/leaderboard-position")
async def get_leaderboard_position(user: dict = Depends(get_current_user)):
    """Get user's position in various leaderboards"""
    user_id = user["id"]
    
    # Savings leaderboard
    all_users_savings = []
    users = await db.users.find({}, {"_id": 0, "id": 1}).to_list(10000)
    
    for u in users:
        wins = await db.won_auctions.find({"user_id": u["id"]}).to_list(1000)
        savings = sum(
            max(0, w.get("retail_price", 0) - w.get("final_price", 0) - w.get("bids_cost", 0))
            for w in wins
        )
        all_users_savings.append({"user_id": u["id"], "savings": savings})
    
    all_users_savings.sort(key=lambda x: x["savings"], reverse=True)
    
    savings_position = next(
        (i + 1 for i, u in enumerate(all_users_savings) if u["user_id"] == user_id),
        None
    )
    
    # Wins leaderboard
    pipeline = [
        {"$group": {"_id": "$user_id", "wins": {"$sum": 1}}},
        {"$sort": {"wins": -1}}
    ]
    wins_ranking = await db.won_auctions.aggregate(pipeline).to_list(10000)
    wins_position = next(
        (i + 1 for i, u in enumerate(wins_ranking) if u["_id"] == user_id),
        None
    )
    
    return {
        "savings_rank": savings_position,
        "wins_rank": wins_position,
        "total_users": len(users)
    }
