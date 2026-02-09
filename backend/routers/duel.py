"""
Auction Duel Router - 1v1 direct battles for products
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from bson import ObjectId
import random
import string

router = APIRouter(prefix="/duel", tags=["Auction Duel"])

class CreateDuelRequest(BaseModel):
    product_id: str
    max_bids: int = 20  # Max bids per player
    duration_seconds: int = 120  # 2 minute duels

class JoinDuelRequest(BaseModel):
    duel_code: str

class DuelBidRequest(BaseModel):
    bid_amount: int = 1

def generate_duel_code():
    """Generate a 4-character duel code"""
    return ''.join(random.choices(string.ascii_uppercase, k=4))

@router.get("/available")
async def get_available_duels():
    """Get duels waiting for opponents"""
    from server import db
    
    duels = await db.duels.find({
        "status": "waiting",
        "player2": None
    }).sort("created_at", -1).limit(10).to_list(10)
    
    for duel in duels:
        duel["id"] = str(duel.pop("_id"))
        
        # Get product info
        if duel.get("product_id"):
            product = await db.products.find_one({"_id": ObjectId(duel["product_id"])})
            if product:
                product["id"] = str(product.pop("_id"))
                duel["product"] = product
    
    return duels

@router.post("/create")
async def create_duel(data: CreateDuelRequest):
    """Create a new 1v1 duel"""
    from server import db
    
    # Get product
    product = await db.products.find_one({"_id": ObjectId(data.product_id)})
    if not product:
        raise HTTPException(status_code=404, detail="Produkt nicht gefunden")
    
    duel_code = generate_duel_code()
    
    duel = {
        "code": duel_code,
        "product_id": data.product_id,
        "product_name": product.get("name"),
        "product_image": product.get("image_url"),
        "retail_price": product.get("retail_price", 0),
        "max_bids": data.max_bids,
        "duration_seconds": data.duration_seconds,
        "player1": {
            "id": f"player_{random.randint(1000, 9999)}",
            "name": "Herausforderer",
            "bids_used": 0,
            "last_bid_time": None
        },
        "player2": None,
        "current_price": 0.00,
        "current_leader": None,
        "status": "waiting",  # waiting, active, finished
        "winner": None,
        "start_time": None,
        "end_time": None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    result = await db.duels.insert_one(duel)
    duel["id"] = str(result.inserted_id)
    
    return {
        "success": True,
        "duel": duel,
        "duel_code": duel_code,
        "share_message": f"⚔️ Ich fordere dich zum Duell! Code: {duel_code}"
    }

@router.post("/join")
async def join_duel(data: JoinDuelRequest):
    """Join an existing duel"""
    from server import db
    
    duel = await db.duels.find_one({
        "code": data.duel_code.upper(),
        "status": "waiting"
    })
    
    if not duel:
        raise HTTPException(status_code=404, detail="Duell nicht gefunden oder bereits gestartet")
    
    # Add player 2 and start the duel
    start_time = datetime.now(timezone.utc)
    end_time = start_time + timedelta(seconds=duel["duration_seconds"])
    
    player2 = {
        "id": f"player_{random.randint(1000, 9999)}",
        "name": "Gegner",
        "bids_used": 0,
        "last_bid_time": None
    }
    
    await db.duels.update_one(
        {"_id": duel["_id"]},
        {
            "$set": {
                "player2": player2,
                "status": "active",
                "start_time": start_time.isoformat(),
                "end_time": end_time.isoformat()
            }
        }
    )
    
    duel["id"] = str(duel.pop("_id"))
    duel["player2"] = player2
    duel["status"] = "active"
    duel["start_time"] = start_time.isoformat()
    duel["end_time"] = end_time.isoformat()
    
    return {
        "success": True,
        "duel": duel,
        "message": "⚔️ Das Duell beginnt!"
    }

@router.get("/{duel_id}")
async def get_duel(duel_id: str):
    """Get duel status and details"""
    from server import db
    
    duel = await db.duels.find_one({"_id": ObjectId(duel_id)})
    if not duel:
        raise HTTPException(status_code=404, detail="Duell nicht gefunden")
    
    duel["id"] = str(duel.pop("_id"))
    
    # Check if duel should end
    if duel["status"] == "active" and duel.get("end_time"):
        end_time = datetime.fromisoformat(duel["end_time"].replace("Z", "+00:00"))
        if datetime.now(timezone.utc) >= end_time:
            # Determine winner
            winner = duel["current_leader"]
            await db.duels.update_one(
                {"_id": ObjectId(duel_id)},
                {"$set": {"status": "finished", "winner": winner}}
            )
            duel["status"] = "finished"
            duel["winner"] = winner
    
    # Calculate time remaining
    if duel.get("end_time") and duel["status"] == "active":
        end_time = datetime.fromisoformat(duel["end_time"].replace("Z", "+00:00"))
        time_remaining = max(0, (end_time - datetime.now(timezone.utc)).total_seconds())
        duel["time_remaining"] = int(time_remaining)
    
    return duel

@router.post("/{duel_id}/bid/{player}")
async def place_duel_bid(duel_id: str, player: str):
    """Place a bid in the duel (player = 'player1' or 'player2')"""
    from server import db
    
    duel = await db.duels.find_one({"_id": ObjectId(duel_id)})
    if not duel:
        raise HTTPException(status_code=404, detail="Duell nicht gefunden")
    
    if duel["status"] != "active":
        raise HTTPException(status_code=400, detail="Duell ist nicht aktiv")
    
    if player not in ["player1", "player2"]:
        raise HTTPException(status_code=400, detail="Ungültiger Spieler")
    
    player_data = duel.get(player)
    if not player_data:
        raise HTTPException(status_code=400, detail="Spieler nicht im Duell")
    
    # Check bid limit
    if player_data["bids_used"] >= duel["max_bids"]:
        raise HTTPException(status_code=400, detail="Maximale Gebote erreicht!")
    
    # Place bid
    new_price = duel["current_price"] + 0.01
    
    await db.duels.update_one(
        {"_id": ObjectId(duel_id)},
        {
            "$set": {
                "current_price": round(new_price, 2),
                "current_leader": player,
                f"{player}.bids_used": player_data["bids_used"] + 1,
                f"{player}.last_bid_time": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    # Check for instant win (opponent out of bids)
    opponent = "player2" if player == "player1" else "player1"
    opponent_data = duel.get(opponent)
    
    instant_win = False
    if opponent_data and opponent_data["bids_used"] >= duel["max_bids"]:
        await db.duels.update_one(
            {"_id": ObjectId(duel_id)},
            {"$set": {"status": "finished", "winner": player}}
        )
        instant_win = True
    
    return {
        "success": True,
        "new_price": round(new_price, 2),
        "bids_remaining": duel["max_bids"] - player_data["bids_used"] - 1,
        "you_are_leading": True,
        "instant_win": instant_win,
        "message": "🏆 Du hast gewonnen! Gegner hat keine Gebote mehr." if instant_win else "Gebot platziert!"
    }

@router.get("/{duel_id}/history")
async def get_duel_history(duel_id: str):
    """Get bid history for a duel"""
    from server import db
    
    bids = await db.duel_bids.find({
        "duel_id": duel_id
    }).sort("created_at", 1).to_list(100)
    
    for bid in bids:
        bid["id"] = str(bid.pop("_id"))
    
    return bids

@router.get("/leaderboard")
async def get_duel_leaderboard():
    """Get top duel winners"""
    from server import db
    
    # Aggregate wins per player
    leaderboard = await db.duels.aggregate([
        {"$match": {"status": "finished", "winner": {"$ne": None}}},
        {"$group": {"_id": "$winner", "wins": {"$sum": 1}}},
        {"$sort": {"wins": -1}},
        {"$limit": 10}
    ]).to_list(10)
    
    return [{"player": item["_id"], "wins": item["wins"], "rank": i+1} for i, item in enumerate(leaderboard)]
