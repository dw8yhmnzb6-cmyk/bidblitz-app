"""
Friend Battle Router - 1v1 Wettbewerbe mit Freunden
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone, timedelta
import uuid

from .auth import get_current_user
from .database import db

router = APIRouter(prefix="/friend-battle", tags=["friend-battle"])


class BattleCreate(BaseModel):
    friend_id: str
    challenge_type: str  # "most_bids", "first_win", "most_savings"
    duration_hours: int = 24
    stake_bids: int = 5  # Bids to wager


@router.get("/types")
async def get_battle_types():
    """Get available battle types"""
    return {
        "types": [
            {
                "id": "most_bids",
                "name": "Meiste Gebote",
                "name_en": "Most Bids",
                "description": "Wer platziert die meisten Gebote?",
                "icon": "🎯",
                "min_stake": 5,
                "max_stake": 50
            },
            {
                "id": "first_win",
                "name": "Erster Gewinn",
                "name_en": "First Win",
                "description": "Wer gewinnt zuerst eine Auktion?",
                "icon": "🏆",
                "min_stake": 10,
                "max_stake": 100
            },
            {
                "id": "most_savings",
                "name": "Größte Ersparnis",
                "name_en": "Most Savings",
                "description": "Wer spart am meisten beim Gewinnen?",
                "icon": "💰",
                "min_stake": 10,
                "max_stake": 100
            },
            {
                "id": "bid_streak",
                "name": "Längste Serie",
                "name_en": "Longest Streak",
                "description": "Wer hält die längste Bieter-Serie?",
                "icon": "🔥",
                "min_stake": 5,
                "max_stake": 50
            }
        ]
    }


@router.post("/challenge")
async def create_battle(battle: BattleCreate, user: dict = Depends(get_current_user)):
    """Challenge a friend to a battle"""
    # Verify friend exists
    friend = await db.users.find_one({"id": battle.friend_id}, {"_id": 0, "id": 1, "name": 1})
    if not friend:
        raise HTTPException(status_code=404, detail="Freund nicht gefunden")
    
    if battle.friend_id == user["id"]:
        raise HTTPException(status_code=400, detail="Du kannst dich nicht selbst herausfordern")
    
    # Check user has enough bids
    if user.get("bids_balance", 0) < battle.stake_bids:
        raise HTTPException(status_code=400, detail="Nicht genug Gebote für den Einsatz")
    
    # Check for existing active battle between users
    existing = await db.friend_battles.find_one({
        "status": "active",
        "$or": [
            {"challenger_id": user["id"], "opponent_id": battle.friend_id},
            {"challenger_id": battle.friend_id, "opponent_id": user["id"]}
        ]
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Ihr habt bereits ein aktives Battle")
    
    now = datetime.now(timezone.utc)
    end_time = now + timedelta(hours=battle.duration_hours)
    
    battle_doc = {
        "id": str(uuid.uuid4()),
        "challenger_id": user["id"],
        "challenger_name": user.get("name", "Spieler"),
        "opponent_id": battle.friend_id,
        "opponent_name": friend.get("name", "Spieler"),
        "challenge_type": battle.challenge_type,
        "stake_bids": battle.stake_bids,
        "duration_hours": battle.duration_hours,
        "status": "pending",  # pending, active, completed, declined
        "start_time": None,
        "end_time": None,
        "challenger_score": 0,
        "opponent_score": 0,
        "winner_id": None,
        "created_at": now.isoformat()
    }
    
    await db.friend_battles.insert_one(battle_doc)
    
    # Reserve bids from challenger
    await db.users.update_one(
        {"id": user["id"]},
        {"$inc": {"bids_balance": -battle.stake_bids}}
    )
    
    return {
        "success": True,
        "battle_id": battle_doc["id"],
        "message": f"Herausforderung an {friend.get('name')} gesendet!"
    }


@router.post("/accept/{battle_id}")
async def accept_battle(battle_id: str, user: dict = Depends(get_current_user)):
    """Accept a battle challenge"""
    battle = await db.friend_battles.find_one({"id": battle_id, "status": "pending"})
    
    if not battle:
        raise HTTPException(status_code=404, detail="Battle nicht gefunden")
    
    if battle["opponent_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Diese Herausforderung ist nicht für dich")
    
    # Check user has enough bids
    if user.get("bids_balance", 0) < battle["stake_bids"]:
        raise HTTPException(status_code=400, detail="Nicht genug Gebote für den Einsatz")
    
    now = datetime.now(timezone.utc)
    end_time = now + timedelta(hours=battle["duration_hours"])
    
    # Reserve bids from opponent
    await db.users.update_one(
        {"id": user["id"]},
        {"$inc": {"bids_balance": -battle["stake_bids"]}}
    )
    
    # Start battle
    await db.friend_battles.update_one(
        {"id": battle_id},
        {
            "$set": {
                "status": "active",
                "start_time": now.isoformat(),
                "end_time": end_time.isoformat()
            }
        }
    )
    
    return {
        "success": True,
        "message": "Battle gestartet!",
        "ends_at": end_time.isoformat()
    }


@router.post("/decline/{battle_id}")
async def decline_battle(battle_id: str, user: dict = Depends(get_current_user)):
    """Decline a battle challenge"""
    battle = await db.friend_battles.find_one({"id": battle_id, "status": "pending"})
    
    if not battle:
        raise HTTPException(status_code=404, detail="Battle nicht gefunden")
    
    if battle["opponent_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Diese Herausforderung ist nicht für dich")
    
    # Refund challenger
    await db.users.update_one(
        {"id": battle["challenger_id"]},
        {"$inc": {"bids_balance": battle["stake_bids"]}}
    )
    
    await db.friend_battles.update_one(
        {"id": battle_id},
        {"$set": {"status": "declined"}}
    )
    
    return {"success": True, "message": "Herausforderung abgelehnt"}


@router.get("/my-battles")
async def get_my_battles(user: dict = Depends(get_current_user)):
    """Get all battles for current user"""
    battles = await db.friend_battles.find({
        "$or": [
            {"challenger_id": user["id"]},
            {"opponent_id": user["id"]}
        ]
    }, {"_id": 0}).sort("created_at", -1).to_list(50)
    
    # Categorize
    pending_received = [b for b in battles if b["status"] == "pending" and b["opponent_id"] == user["id"]]
    pending_sent = [b for b in battles if b["status"] == "pending" and b["challenger_id"] == user["id"]]
    active = [b for b in battles if b["status"] == "active"]
    completed = [b for b in battles if b["status"] == "completed"]
    
    return {
        "pending_received": pending_received,
        "pending_sent": pending_sent,
        "active": active,
        "completed": completed[:10],  # Last 10
        "total_wins": sum(1 for b in completed if b.get("winner_id") == user["id"]),
        "total_battles": len(completed)
    }


@router.get("/battle/{battle_id}")
async def get_battle_details(battle_id: str, user: dict = Depends(get_current_user)):
    """Get detailed battle info with live scores"""
    battle = await db.friend_battles.find_one({"id": battle_id}, {"_id": 0})
    
    if not battle:
        raise HTTPException(status_code=404, detail="Battle nicht gefunden")
    
    # Check user is participant
    if user["id"] not in [battle["challenger_id"], battle["opponent_id"]]:
        raise HTTPException(status_code=403, detail="Du bist nicht Teil dieses Battles")
    
    # Calculate live scores for active battles
    if battle["status"] == "active":
        start = datetime.fromisoformat(battle["start_time"].replace('Z', '+00:00'))
        
        if battle["challenge_type"] == "most_bids":
            # Count bids since start
            challenger_bids = await db.bids.count_documents({
                "user_id": battle["challenger_id"],
                "created_at": {"$gte": start.isoformat()}
            })
            opponent_bids = await db.bids.count_documents({
                "user_id": battle["opponent_id"],
                "created_at": {"$gte": start.isoformat()}
            })
            battle["challenger_score"] = challenger_bids
            battle["opponent_score"] = opponent_bids
            
        elif battle["challenge_type"] == "first_win":
            # Check for wins since start
            challenger_won = await db.auctions.find_one({
                "winner_id": battle["challenger_id"],
                "ended_at": {"$gte": start.isoformat()}
            })
            opponent_won = await db.auctions.find_one({
                "winner_id": battle["opponent_id"],
                "ended_at": {"$gte": start.isoformat()}
            })
            battle["challenger_score"] = 1 if challenger_won else 0
            battle["opponent_score"] = 1 if opponent_won else 0
    
    return battle


@router.get("/leaderboard")
async def get_battle_leaderboard():
    """Get top battle winners"""
    # Aggregate wins
    pipeline = [
        {"$match": {"status": "completed", "winner_id": {"$ne": None}}},
        {"$group": {
            "_id": "$winner_id",
            "wins": {"$sum": 1},
            "total_winnings": {"$sum": "$stake_bids"}
        }},
        {"$sort": {"wins": -1}},
        {"$limit": 20}
    ]
    
    results = await db.friend_battles.aggregate(pipeline).to_list(20)
    
    # Get user names
    leaderboard = []
    for r in results:
        user = await db.users.find_one(
            {"id": r["_id"]},
            {"_id": 0, "name": 1, "avatar_url": 1}
        )
        if user:
            leaderboard.append({
                "user_id": r["_id"],
                "name": user.get("name", "Anonym"),
                "avatar": user.get("avatar_url"),
                "wins": r["wins"],
                "total_winnings": r["total_winnings"] * 2  # Winner gets both stakes
            })
    
    return {"leaderboard": leaderboard}


friend_battle_router = router
