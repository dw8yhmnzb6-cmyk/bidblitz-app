"""
Friends Battle Router
Allows users to challenge friends to bidding duels on specific auctions
"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from pydantic import BaseModel
import uuid

from config import db, logger
from dependencies import get_current_user

router = APIRouter(prefix="/friends-battle", tags=["Friends Battle"])

# ==================== SCHEMAS ====================

class CreateBattleRequest(BaseModel):
    opponent_id: str
    auction_id: str
    wager_bids: int = 0  # Optional bid wager

class BattleResponse(BaseModel):
    accept: bool


# ==================== ENDPOINTS ====================

@router.get("/challenges")
async def get_battle_challenges(user: dict = Depends(get_current_user)):
    """Get all battle challenges for user (sent and received)"""
    
    # Get received challenges
    received = await db.friends_battles.find({
        "opponent_id": user["id"],
        "status": "pending"
    }, {"_id": 0}).to_list(50)
    
    # Get sent challenges
    sent = await db.friends_battles.find({
        "challenger_id": user["id"],
        "status": "pending"
    }, {"_id": 0}).to_list(50)
    
    # Get active battles
    active = await db.friends_battles.find({
        "$or": [
            {"challenger_id": user["id"]},
            {"opponent_id": user["id"]}
        ],
        "status": "active"
    }, {"_id": 0}).to_list(50)
    
    # Enrich with user names and auction info
    for battle in received + sent + active:
        challenger = await db.users.find_one({"id": battle["challenger_id"]})
        opponent = await db.users.find_one({"id": battle["opponent_id"]})
        auction = await db.auctions.find_one({"id": battle["auction_id"]})
        product = await db.products.find_one({"id": auction["product_id"]}) if auction else None
        
        battle["challenger_name"] = challenger.get("username") if challenger else "Unknown"
        battle["opponent_name"] = opponent.get("username") if opponent else "Unknown"
        battle["auction_title"] = product.get("name") if product else "Unknown Auction"
        battle["auction_image"] = product.get("image_url") if product else None
        if auction:
            battle["auction_end_time"] = auction.get("end_time")
            battle["auction_current_price"] = auction.get("current_price", 0)
    
    return {
        "received": received,
        "sent": sent,
        "active": active
    }


@router.post("/challenge")
async def create_battle_challenge(
    data: CreateBattleRequest,
    user: dict = Depends(get_current_user)
):
    """Challenge a friend to a bidding battle"""
    
    if data.opponent_id == user["id"]:
        raise HTTPException(status_code=400, detail="Du kannst dich nicht selbst herausfordern!")
    
    # Check if opponent exists
    opponent = await db.users.find_one({"id": data.opponent_id})
    if not opponent:
        raise HTTPException(status_code=404, detail="Gegner nicht gefunden")
    
    # Check if auction exists and is active
    auction = await db.auctions.find_one({"id": data.auction_id})
    if not auction:
        raise HTTPException(status_code=404, detail="Auktion nicht gefunden")
    if auction.get("status") != "active":
        raise HTTPException(status_code=400, detail="Auktion ist nicht aktiv")
    
    # Check if already in a battle with this opponent on this auction
    existing = await db.friends_battles.find_one({
        "auction_id": data.auction_id,
        "$or": [
            {"challenger_id": user["id"], "opponent_id": data.opponent_id},
            {"challenger_id": data.opponent_id, "opponent_id": user["id"]}
        ],
        "status": {"$in": ["pending", "active"]}
    })
    if existing:
        raise HTTPException(status_code=400, detail="Battle mit diesem Gegner für diese Auktion existiert bereits")
    
    # Check if user has enough bids for wager
    if data.wager_bids > 0:
        if user.get("bids", 0) < data.wager_bids:
            raise HTTPException(status_code=400, detail="Nicht genug Gebote für den Einsatz")
    
    # Create battle challenge
    battle_id = str(uuid.uuid4())
    battle = {
        "id": battle_id,
        "challenger_id": user["id"],
        "opponent_id": data.opponent_id,
        "auction_id": data.auction_id,
        "wager_bids": data.wager_bids,
        "status": "pending",  # pending, active, completed, declined, expired
        "winner_id": None,
        "challenger_bids_count": 0,
        "opponent_bids_count": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()
    }
    
    await db.friends_battles.insert_one(battle)
    
    # Create notification for opponent
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": data.opponent_id,
        "type": "battle_challenge",
        "title": "Herausforderung zum Battle!",
        "message": f"{user.get('username', 'Ein Spieler')} fordert dich zu einem Bieter-Duell heraus!",
        "data": {"battle_id": battle_id, "challenger_name": user.get("username")},
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    logger.info(f"⚔️ Battle challenge created: {user.get('username')} vs {opponent.get('username')}")
    
    return {
        "success": True,
        "battle_id": battle_id,
        "message": f"Herausforderung an {opponent.get('username')} gesendet!"
    }


@router.post("/respond/{battle_id}")
async def respond_to_challenge(
    battle_id: str,
    response: BattleResponse,
    user: dict = Depends(get_current_user)
):
    """Accept or decline a battle challenge"""
    
    battle = await db.friends_battles.find_one({"id": battle_id})
    if not battle:
        raise HTTPException(status_code=404, detail="Battle nicht gefunden")
    
    if battle["opponent_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Du bist nicht der Herausgeforderte")
    
    if battle["status"] != "pending":
        raise HTTPException(status_code=400, detail="Herausforderung ist nicht mehr ausstehend")
    
    if response.accept:
        # Check if user has enough bids for wager
        if battle["wager_bids"] > 0:
            if user.get("bids", 0) < battle["wager_bids"]:
                raise HTTPException(status_code=400, detail="Nicht genug Gebote für den Einsatz")
            
            # Lock wager bids for both players
            await db.users.update_one(
                {"id": battle["challenger_id"]},
                {"$inc": {"bids": -battle["wager_bids"]}}
            )
            await db.users.update_one(
                {"id": user["id"]},
                {"$inc": {"bids": -battle["wager_bids"]}}
            )
        
        # Activate battle
        await db.friends_battles.update_one(
            {"id": battle_id},
            {"$set": {
                "status": "active",
                "accepted_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        # Notify challenger
        challenger = await db.users.find_one({"id": battle["challenger_id"]})
        await db.notifications.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": battle["challenger_id"],
            "type": "battle_accepted",
            "title": "Herausforderung angenommen!",
            "message": f"{user.get('username')} hat deine Herausforderung angenommen! Das Battle beginnt!",
            "data": {"battle_id": battle_id},
            "read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        logger.info(f"⚔️ Battle accepted: {battle_id}")
        return {"success": True, "message": "Herausforderung angenommen! Das Battle beginnt!"}
    else:
        # Decline battle
        await db.friends_battles.update_one(
            {"id": battle_id},
            {"$set": {"status": "declined", "declined_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        logger.info(f"⚔️ Battle declined: {battle_id}")
        return {"success": True, "message": "Herausforderung abgelehnt"}


@router.get("/active")
async def get_active_battles(user: dict = Depends(get_current_user)):
    """Get user's active battles with live status"""
    
    battles = await db.friends_battles.find({
        "$or": [
            {"challenger_id": user["id"]},
            {"opponent_id": user["id"]}
        ],
        "status": "active"
    }, {"_id": 0}).to_list(20)
    
    result = []
    for battle in battles:
        # Get auction info
        auction = await db.auctions.find_one({"id": battle["auction_id"]})
        product = await db.products.find_one({"id": auction["product_id"]}) if auction else None
        
        # Get opponent info
        is_challenger = battle["challenger_id"] == user["id"]
        opponent_id = battle["opponent_id"] if is_challenger else battle["challenger_id"]
        opponent = await db.users.find_one({"id": opponent_id})
        
        # Count bids from each player in this auction
        user_bid_count = await db.bids.count_documents({
            "auction_id": battle["auction_id"],
            "user_id": user["id"],
            "created_at": {"$gte": battle.get("accepted_at", battle["created_at"])}
        })
        
        opponent_bid_count = await db.bids.count_documents({
            "auction_id": battle["auction_id"],
            "user_id": opponent_id,
            "created_at": {"$gte": battle.get("accepted_at", battle["created_at"])}
        })
        
        result.append({
            "id": battle["id"],
            "auction_id": battle["auction_id"],
            "auction_title": product.get("name") if product else "Unknown",
            "auction_image": product.get("image_url") if product else None,
            "auction_status": auction.get("status") if auction else "unknown",
            "auction_current_price": auction.get("current_price", 0) if auction else 0,
            "auction_end_time": auction.get("end_time") if auction else None,
            "opponent_name": opponent.get("username") if opponent else "Unknown",
            "opponent_avatar": opponent.get("avatar_url") if opponent else None,
            "wager_bids": battle["wager_bids"],
            "your_bids": user_bid_count,
            "opponent_bids": opponent_bid_count,
            "is_winning": user_bid_count > opponent_bid_count,
            "created_at": battle["created_at"]
        })
    
    return {"battles": result}


@router.get("/history")
async def get_battle_history(
    limit: int = 20,
    user: dict = Depends(get_current_user)
):
    """Get user's battle history"""
    
    battles = await db.friends_battles.find({
        "$or": [
            {"challenger_id": user["id"]},
            {"opponent_id": user["id"]}
        ],
        "status": "completed"
    }, {"_id": 0}).sort("completed_at", -1).limit(limit).to_list(limit)
    
    result = []
    for battle in battles:
        opponent_id = battle["opponent_id"] if battle["challenger_id"] == user["id"] else battle["challenger_id"]
        opponent = await db.users.find_one({"id": opponent_id})
        
        result.append({
            "id": battle["id"],
            "opponent_name": opponent.get("username") if opponent else "Unknown",
            "wager_bids": battle["wager_bids"],
            "won": battle.get("winner_id") == user["id"],
            "your_bids": battle.get("challenger_bids_count") if battle["challenger_id"] == user["id"] else battle.get("opponent_bids_count"),
            "opponent_bids": battle.get("opponent_bids_count") if battle["challenger_id"] == user["id"] else battle.get("challenger_bids_count"),
            "completed_at": battle.get("completed_at")
        })
    
    # Calculate stats
    total_battles = await db.friends_battles.count_documents({
        "$or": [{"challenger_id": user["id"]}, {"opponent_id": user["id"]}],
        "status": "completed"
    })
    wins = await db.friends_battles.count_documents({
        "winner_id": user["id"],
        "status": "completed"
    })
    
    return {
        "history": result,
        "stats": {
            "total_battles": total_battles,
            "wins": wins,
            "losses": total_battles - wins,
            "win_rate": round(wins / total_battles * 100, 1) if total_battles > 0 else 0
        }
    }


@router.get("/leaderboard")
async def get_battle_leaderboard():
    """Get top battle winners"""
    
    # Aggregate wins by user
    pipeline = [
        {"$match": {"status": "completed", "winner_id": {"$ne": None}}},
        {"$group": {"_id": "$winner_id", "wins": {"$sum": 1}}},
        {"$sort": {"wins": -1}},
        {"$limit": 20}
    ]
    
    leaders = []
    async for doc in db.friends_battles.aggregate(pipeline):
        user = await db.users.find_one({"id": doc["_id"]})
        if user:
            leaders.append({
                "username": user.get("username"),
                "avatar_url": user.get("avatar_url"),
                "wins": doc["wins"]
            })
    
    return {"leaderboard": leaders}
