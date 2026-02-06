"""
Weekly Tournaments Router
Competitive weekly events with prizes
"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel
from typing import Optional, List
import uuid

from config import db, logger
from dependencies import get_current_user

router = APIRouter(prefix="/tournaments", tags=["Tournaments"])

# Tournament types
TOURNAMENT_TYPES = {
    "most_wins": {
        "name": "Gewinner der Woche",
        "description": "Wer gewinnt diese Woche die meisten Auktionen?",
        "metric": "wins",
        "icon": "🏆"
    },
    "most_bids": {
        "name": "Aktivster Bieter",
        "description": "Wer platziert diese Woche die meisten Gebote?",
        "metric": "bids",
        "icon": "⚡"
    },
    "biggest_saver": {
        "name": "Sparfuchs der Woche",
        "description": "Wer spart diese Woche am meisten?",
        "metric": "savings",
        "icon": "💰"
    },
    "streak_master": {
        "name": "Streak Master",
        "description": "Wer hat den längsten Login-Streak?",
        "metric": "streak",
        "icon": "🔥"
    }
}

# Prize configuration
PRIZES = {
    1: {"bids": 100, "badge": "🥇", "title": "1. Platz"},
    2: {"bids": 50, "badge": "🥈", "title": "2. Platz"},
    3: {"bids": 25, "badge": "🥉", "title": "3. Platz"},
    4: {"bids": 10, "badge": "⭐", "title": "Top 10"},
    5: {"bids": 10, "badge": "⭐", "title": "Top 10"},
    6: {"bids": 5, "badge": "✨", "title": "Top 10"},
    7: {"bids": 5, "badge": "✨", "title": "Top 10"},
    8: {"bids": 5, "badge": "✨", "title": "Top 10"},
    9: {"bids": 5, "badge": "✨", "title": "Top 10"},
    10: {"bids": 5, "badge": "✨", "title": "Top 10"}
}


def get_current_week_range():
    """Get start and end of current week (Monday to Sunday)"""
    now = datetime.now(timezone.utc)
    start_of_week = now - timedelta(days=now.weekday())
    start_of_week = start_of_week.replace(hour=0, minute=0, second=0, microsecond=0)
    end_of_week = start_of_week + timedelta(days=6, hours=23, minutes=59, seconds=59)
    return start_of_week, end_of_week


@router.get("/current")
async def get_current_tournament():
    """Get the current active tournament"""
    start, end = get_current_week_range()
    
    # Get or create current tournament
    tournament = await db.tournaments.find_one({
        "start_date": {"$lte": datetime.now(timezone.utc)},
        "end_date": {"$gte": datetime.now(timezone.utc)},
        "status": "active"
    }, {"_id": 0})
    
    if not tournament:
        # Create a new tournament
        import random
        tournament_type = random.choice(list(TOURNAMENT_TYPES.keys()))
        type_info = TOURNAMENT_TYPES[tournament_type]
        
        tournament = {
            "id": str(uuid.uuid4()),
            "type": tournament_type,
            "name": type_info["name"],
            "description": type_info["description"],
            "metric": type_info["metric"],
            "icon": type_info["icon"],
            "start_date": start,
            "end_date": end,
            "status": "active",
            "prizes": PRIZES,
            "created_at": datetime.now(timezone.utc)
        }
        await db.tournaments.insert_one(tournament)
        tournament.pop("_id", None)
    
    # Calculate time remaining
    time_remaining = (end - datetime.now(timezone.utc)).total_seconds()
    
    return {
        "tournament": tournament,
        "time_remaining_seconds": max(0, time_remaining),
        "prizes": PRIZES
    }


@router.get("/leaderboard")
async def get_tournament_leaderboard(limit: int = 10):
    """Get current tournament leaderboard"""
    start, end = get_current_week_range()
    
    tournament = await db.tournaments.find_one({
        "start_date": {"$lte": datetime.now(timezone.utc)},
        "end_date": {"$gte": datetime.now(timezone.utc)},
        "status": "active"
    }, {"_id": 0})
    
    if not tournament:
        return {"leaderboard": [], "tournament": None}
    
    metric = tournament.get("metric", "wins")
    
    # Build leaderboard based on metric
    if metric == "wins":
        pipeline = [
            {"$match": {
                "won_at": {"$gte": start.isoformat(), "$lte": end.isoformat()}
            }},
            {"$group": {
                "_id": "$user_id",
                "score": {"$sum": 1}
            }},
            {"$sort": {"score": -1}},
            {"$limit": limit}
        ]
        results = await db.won_auctions.aggregate(pipeline).to_list(length=limit)
        
    elif metric == "bids":
        pipeline = [
            {"$match": {
                "created_at": {"$gte": start.isoformat(), "$lte": end.isoformat()}
            }},
            {"$group": {
                "_id": "$user_id",
                "score": {"$sum": 1}
            }},
            {"$sort": {"score": -1}},
            {"$limit": limit}
        ]
        results = await db.bids.aggregate(pipeline).to_list(length=limit)
        
    elif metric == "savings":
        pipeline = [
            {"$match": {
                "won_at": {"$gte": start.isoformat(), "$lte": end.isoformat()}
            }},
            {"$group": {
                "_id": "$user_id",
                "score": {"$sum": {"$subtract": ["$retail_price", "$final_price"]}}
            }},
            {"$sort": {"score": -1}},
            {"$limit": limit}
        ]
        results = await db.won_auctions.aggregate(pipeline).to_list(length=limit)
        
    elif metric == "streak":
        pipeline = [
            {"$match": {"login_streak": {"$gt": 0}}},
            {"$sort": {"login_streak": -1}},
            {"$limit": limit},
            {"$project": {
                "_id": 0,
                "user_id": "$id",
                "score": "$login_streak"
            }}
        ]
        results = await db.users.aggregate(pipeline).to_list(length=limit)
        # Restructure for consistency
        results = [{"_id": r.get("user_id"), "score": r.get("score", 0)} for r in results]
    else:
        results = []
    
    # Enrich with user data
    leaderboard = []
    for i, result in enumerate(results):
        user_id = result.get("_id")
        if not user_id:
            continue
            
        user = await db.users.find_one(
            {"id": user_id},
            {"_id": 0, "name": 1, "avatar_url": 1}
        )
        
        rank = i + 1
        prize = PRIZES.get(rank, {"bids": 0, "badge": "", "title": ""})
        
        leaderboard.append({
            "rank": rank,
            "user_id": user_id,
            "username": user.get("name", "Anonym") if user else "Anonym",
            "avatar_url": user.get("avatar_url") if user else None,
            "score": round(result.get("score", 0), 2),
            "prize": prize
        })
    
    return {
        "tournament": tournament,
        "leaderboard": leaderboard,
        "metric_label": {
            "wins": "Gewinne",
            "bids": "Gebote",
            "savings": "€ gespart",
            "streak": "Tage Streak"
        }.get(metric, "Punkte")
    }


@router.get("/my-position")
async def get_my_tournament_position(user: dict = Depends(get_current_user)):
    """Get user's position in current tournament"""
    user_id = user["id"]
    start, end = get_current_week_range()
    
    tournament = await db.tournaments.find_one({
        "start_date": {"$lte": datetime.now(timezone.utc)},
        "end_date": {"$gte": datetime.now(timezone.utc)},
        "status": "active"
    }, {"_id": 0})
    
    if not tournament:
        return {"position": None, "score": 0, "tournament": None}
    
    metric = tournament.get("metric", "wins")
    
    # Calculate user's score
    if metric == "wins":
        score = await db.won_auctions.count_documents({
            "user_id": user_id,
            "won_at": {"$gte": start.isoformat(), "$lte": end.isoformat()}
        })
    elif metric == "bids":
        score = await db.bids.count_documents({
            "user_id": user_id,
            "created_at": {"$gte": start.isoformat(), "$lte": end.isoformat()}
        })
    elif metric == "savings":
        wins = await db.won_auctions.find({
            "user_id": user_id,
            "won_at": {"$gte": start.isoformat(), "$lte": end.isoformat()}
        }).to_list(length=100)
        score = sum(max(0, w.get("retail_price", 0) - w.get("final_price", 0)) for w in wins)
    elif metric == "streak":
        user_data = await db.users.find_one({"id": user_id}, {"_id": 0, "login_streak": 1})
        score = user_data.get("login_streak", 0) if user_data else 0
    else:
        score = 0
    
    # Get position (simplified - count users with higher score)
    # This is approximate but efficient
    position = None  # Would need full ranking calculation
    
    return {
        "tournament": tournament,
        "score": round(score, 2),
        "position": position,
        "potential_prize": PRIZES.get(1) if score > 0 else None
    }


@router.get("/history")
async def get_tournament_history(limit: int = 10):
    """Get past tournament results"""
    tournaments = await db.tournaments.find(
        {"status": "completed"},
        {"_id": 0}
    ).sort("end_date", -1).limit(limit).to_list(length=limit)
    
    return {"tournaments": tournaments}


@router.get("/my-wins")
async def get_my_tournament_wins(user: dict = Depends(get_current_user)):
    """Get user's tournament wins"""
    user_id = user["id"]
    
    wins = await db.tournament_winners.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("won_at", -1).to_list(length=50)
    
    return {
        "wins": wins,
        "total_prizes_won": sum(w.get("prize_bids", 0) for w in wins)
    }
