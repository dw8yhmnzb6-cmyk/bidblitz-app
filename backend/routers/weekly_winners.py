"""Weekly Winners Router - Weekly top deals push notifications"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone, timedelta
from typing import Optional
import uuid

from config import db, logger
from dependencies import get_admin_user

router = APIRouter(prefix="/weekly-winners", tags=["Weekly Winners"])

# ==================== ENDPOINTS ====================

@router.get("/top-deals")
async def get_weekly_top_deals(limit: int = 10):
    """Get top deals from the past week (biggest savings)"""
    one_week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    
    # Get ended auctions from the past week
    auctions = await db.auctions.find({
        "status": "ended",
        "winner_id": {"$ne": None},
        "ended_at": {"$gte": one_week_ago}
    }, {"_id": 0}).to_list(500)
    
    deals = []
    for auction in auctions:
        product = await db.products.find_one({"id": auction.get("product_id")}, {"_id": 0})
        
        if product and product.get("retail_price"):
            retail_price = product["retail_price"]
            final_price = auction.get("final_price", auction.get("current_price", 0))
            savings = retail_price - final_price
            savings_percent = (savings / retail_price) * 100
            
            deals.append({
                "auction_id": auction["id"],
                "product_name": product.get("name"),
                "product_image": product.get("image_url"),
                "retail_price": retail_price,
                "final_price": final_price,
                "savings": round(savings, 2),
                "savings_percent": round(savings_percent, 1),
                "winner_name": auction.get("winner_name", "Glücklicher Gewinner"),
                "ended_at": auction.get("ended_at")
            })
    
    # Sort by savings amount
    deals.sort(key=lambda x: x["savings"], reverse=True)
    
    return {
        "top_deals": deals[:limit],
        "period": {
            "start": one_week_ago,
            "end": datetime.now(timezone.utc).isoformat()
        }
    }

@router.get("/stats")
async def get_weekly_stats():
    """Get weekly auction statistics"""
    one_week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    
    # Count ended auctions
    total_auctions = await db.auctions.count_documents({
        "status": "ended",
        "ended_at": {"$gte": one_week_ago}
    })
    
    # Count unique winners
    winners = await db.auctions.distinct("winner_id", {
        "status": "ended",
        "winner_id": {"$ne": None},
        "ended_at": {"$gte": one_week_ago}
    })
    
    # Calculate total savings
    auctions = await db.auctions.find({
        "status": "ended",
        "winner_id": {"$ne": None},
        "ended_at": {"$gte": one_week_ago}
    }, {"_id": 0, "product_id": 1, "final_price": 1, "current_price": 1}).to_list(500)
    
    total_savings = 0
    total_retail = 0
    
    for auction in auctions:
        product = await db.products.find_one({"id": auction.get("product_id")}, {"_id": 0, "retail_price": 1})
        if product and product.get("retail_price"):
            retail = product["retail_price"]
            final = auction.get("final_price", auction.get("current_price", 0))
            total_retail += retail
            total_savings += (retail - final)
    
    return {
        "total_auctions": total_auctions,
        "unique_winners": len(winners),
        "total_savings": round(total_savings, 2),
        "total_retail_value": round(total_retail, 2),
        "avg_savings_percent": round((total_savings / total_retail * 100) if total_retail > 0 else 0, 1)
    }

@router.post("/broadcast")
async def broadcast_weekly_winners(admin: dict = Depends(get_admin_user)):
    """Broadcast weekly top deals to all users (admin only)"""
    # Get top 3 deals
    deals_response = await get_weekly_top_deals(limit=3)
    top_deals = deals_response["top_deals"]
    
    if not top_deals:
        raise HTTPException(status_code=400, detail="Keine Deals diese Woche")
    
    # Create notification message
    deal_lines = []
    for i, deal in enumerate(top_deals, 1):
        deal_lines.append(
            f"{i}. {deal['product_name'][:25]}... - nur €{deal['final_price']:.2f} (statt €{deal['retail_price']:.0f})"
        )
    
    message = "🏆 Top Schnäppchen der Woche:\n" + "\n".join(deal_lines)
    
    # Get all users
    users = await db.users.find(
        {"is_blocked": {"$ne": True}},
        {"_id": 0, "id": 1}
    ).to_list(10000)
    
    # Create notifications
    now = datetime.now(timezone.utc).isoformat()
    for user in users:
        notification = {
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "type": "weekly_winners",
            "title": "🏆 Gewinner der Woche!",
            "message": message,
            "read": False,
            "created_at": now
        }
        await db.notifications.insert_one(notification)
    
    logger.info(f"Weekly winners broadcast sent to {len(users)} users")
    
    return {
        "success": True,
        "message": f"Benachrichtigung an {len(users)} Benutzer gesendet",
        "deals_featured": len(top_deals)
    }

@router.get("/leaderboard")
async def get_weekly_winners_leaderboard(limit: int = 10):
    """Get top winners of the week by number of wins"""
    one_week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    
    # Aggregate wins by user
    pipeline = [
        {"$match": {
            "status": "ended",
            "winner_id": {"$ne": None},
            "ended_at": {"$gte": one_week_ago}
        }},
        {"$group": {
            "_id": "$winner_id",
            "wins": {"$sum": 1},
            "winner_name": {"$first": "$winner_name"}
        }},
        {"$sort": {"wins": -1}},
        {"$limit": limit}
    ]
    
    results = await db.auctions.aggregate(pipeline).to_list(limit)
    
    leaderboard = []
    for i, result in enumerate(results, 1):
        leaderboard.append({
            "rank": i,
            "user_id": result["_id"],
            "name": result.get("winner_name", "Gewinner"),
            "wins": result["wins"]
        })
    
    return {"leaderboard": leaderboard}


weekly_winners_router = router
