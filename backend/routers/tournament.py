"""Weekly Tournament Router - Weekly bidding competitions with prizes"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from pydantic import BaseModel
import uuid

from config import db, logger
from dependencies import get_current_user, get_admin_user

router = APIRouter(prefix="/tournament", tags=["Weekly Tournament"])

# ==================== SCHEMAS ====================

class TournamentCreate(BaseModel):
    name: str
    description: Optional[str] = None
    prize_first: int = 100  # Bids for 1st place
    prize_second: int = 50  # Bids for 2nd place
    prize_third: int = 25   # Bids for 3rd place
    duration_days: int = 7

# ==================== ENDPOINTS ====================

@router.get("/current")
async def get_current_tournament():
    """Get the current active tournament"""
    now = datetime.now(timezone.utc)
    
    tournament = await db.tournaments.find_one(
        {
            "status": "active",
            "start_date": {"$lte": now.isoformat()},
            "end_date": {"$gte": now.isoformat()}
        },
        {"_id": 0}
    )
    
    if not tournament:
        # Create a default weekly tournament if none exists
        tournament = await create_weekly_tournament()
    
    # Calculate time remaining
    end_date = datetime.fromisoformat(tournament["end_date"].replace('Z', '+00:00'))
    time_remaining = end_date - now
    
    return {
        "tournament": tournament,
        "time_remaining": {
            "days": time_remaining.days,
            "hours": int(time_remaining.seconds / 3600),
            "minutes": int((time_remaining.seconds % 3600) / 60)
        }
    }

@router.get("/leaderboard")
async def get_tournament_leaderboard(tournament_id: Optional[str] = None, limit: int = 20):
    """Get tournament leaderboard"""
    if not tournament_id:
        # Get current tournament
        current = await get_current_tournament()
        tournament_id = current["tournament"]["id"]
    
    tournament = await db.tournaments.find_one({"id": tournament_id}, {"_id": 0})
    if not tournament:
        raise HTTPException(status_code=404, detail="Turnier nicht gefunden")
    
    # Get leaderboard entries
    entries = await db.tournament_scores.find(
        {"tournament_id": tournament_id},
        {"_id": 0}
    ).sort("score", -1).limit(limit).to_list(limit)
    
    # Enrich with user data
    leaderboard = []
    for i, entry in enumerate(entries):
        user = await db.users.find_one(
            {"id": entry["user_id"]},
            {"_id": 0, "name": 1, "username": 1}
        )
        
        if user:
            name = user.get("name") or user.get("username", "Anonym")
            # Partially anonymize
            if len(name) > 2:
                display_name = name[:2] + "***"
            else:
                display_name = name
            
            leaderboard.append({
                "rank": i + 1,
                "user_name": display_name,
                "user_id": entry["user_id"],
                "score": entry["score"],
                "wins": entry.get("wins", 0),
                "bids_placed": entry.get("bids_placed", 0)
            })
    
    # Calculate prizes
    prizes = [
        tournament.get("prize_first", 100),
        tournament.get("prize_second", 50),
        tournament.get("prize_third", 25)
    ]
    
    return {
        "tournament": tournament,
        "leaderboard": leaderboard,
        "prizes": prizes,
        "total_participants": await db.tournament_scores.count_documents({"tournament_id": tournament_id})
    }

@router.get("/my-rank")
async def get_my_tournament_rank(user: dict = Depends(get_current_user)):
    """Get current user's tournament rank and stats"""
    current = await get_current_tournament()
    tournament_id = current["tournament"]["id"]
    
    # Get user's score
    user_score = await db.tournament_scores.find_one(
        {"tournament_id": tournament_id, "user_id": user["id"]},
        {"_id": 0}
    )
    
    if not user_score:
        return {
            "rank": None,
            "score": 0,
            "wins": 0,
            "bids_placed": 0,
            "message": "Du nimmst noch nicht am Turnier teil. Biete jetzt!"
        }
    
    # Calculate rank
    higher_scores = await db.tournament_scores.count_documents({
        "tournament_id": tournament_id,
        "score": {"$gt": user_score["score"]}
    })
    
    rank = higher_scores + 1
    
    # Check if in prize position
    prizes = [
        current["tournament"].get("prize_first", 100),
        current["tournament"].get("prize_second", 50),
        current["tournament"].get("prize_third", 25)
    ]
    
    potential_prize = prizes[rank - 1] if rank <= 3 else 0
    
    return {
        "rank": rank,
        "score": user_score["score"],
        "wins": user_score.get("wins", 0),
        "bids_placed": user_score.get("bids_placed", 0),
        "potential_prize": potential_prize,
        "in_prize_position": rank <= 3
    }

@router.get("/history")
async def get_tournament_history(limit: int = 10):
    """Get past tournament results"""
    tournaments = await db.tournaments.find(
        {"status": "completed"},
        {"_id": 0}
    ).sort("end_date", -1).limit(limit).to_list(limit)
    
    # Add winner info
    for t in tournaments:
        # Get top 3
        top_scores = await db.tournament_scores.find(
            {"tournament_id": t["id"]},
            {"_id": 0}
        ).sort("score", -1).limit(3).to_list(3)
        
        winners = []
        for score in top_scores:
            user = await db.users.find_one({"id": score["user_id"]}, {"_id": 0, "name": 1})
            if user:
                winners.append({
                    "name": user.get("name", "Anonym")[:2] + "***",
                    "score": score["score"]
                })
        
        t["winners"] = winners
    
    return {"tournaments": tournaments}

# ==================== INTERNAL FUNCTIONS ====================

async def create_weekly_tournament():
    """Create a new weekly tournament"""
    now = datetime.now(timezone.utc)
    
    # Start from next Monday
    days_until_monday = (7 - now.weekday()) % 7
    if days_until_monday == 0 and now.hour >= 12:
        days_until_monday = 7
    
    start_date = (now + timedelta(days=days_until_monday)).replace(hour=0, minute=0, second=0, microsecond=0)
    end_date = start_date + timedelta(days=7)
    
    # If we need one now, start from now
    if days_until_monday > 0:
        start_date = now
        end_date = now + timedelta(days=7)
    
    tournament = {
        "id": str(uuid.uuid4()),
        "name": f"Wöchentliches Turnier KW{start_date.isocalendar()[1]}",
        "description": "Wer gewinnt diese Woche am meisten?",
        "status": "active",
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "prize_first": 100,
        "prize_second": 50,
        "prize_third": 25,
        "created_at": now.isoformat()
    }
    
    await db.tournaments.insert_one(tournament)
    logger.info(f"Created weekly tournament: {tournament['id']}")
    
    return tournament

async def update_tournament_score(user_id: str, points: int = 1, win: bool = False):
    """Update user's tournament score (called when user bids/wins)"""
    current = await get_current_tournament()
    tournament_id = current["tournament"]["id"]
    
    # Update or create score
    existing = await db.tournament_scores.find_one({
        "tournament_id": tournament_id,
        "user_id": user_id
    })
    
    if existing:
        update = {"$inc": {"score": points, "bids_placed": 1}}
        if win:
            update["$inc"]["wins"] = 1
            update["$inc"]["score"] = 10  # Bonus for wins
        
        await db.tournament_scores.update_one(
            {"id": existing["id"]},
            update
        )
    else:
        await db.tournament_scores.insert_one({
            "id": str(uuid.uuid4()),
            "tournament_id": tournament_id,
            "user_id": user_id,
            "score": points + (10 if win else 0),
            "wins": 1 if win else 0,
            "bids_placed": 1,
            "created_at": datetime.now(timezone.utc).isoformat()
        })


tournament_router = router
