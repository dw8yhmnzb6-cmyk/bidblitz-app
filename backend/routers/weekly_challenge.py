"""Weekly Challenge System - Competition for biggest savings"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel
import uuid

from config import db, logger
from dependencies import get_current_user, get_admin_user

router = APIRouter(prefix="/weekly-challenge", tags=["Weekly Challenge"])

@router.get("/current")
async def get_current_challenge():
    """Get current week's challenge"""
    now = datetime.now(timezone.utc)
    
    # Find active challenge
    challenge = await db.weekly_challenges.find_one({
        "status": "active",
        "end_date": {"$gt": now.isoformat()}
    }, {"_id": 0})
    
    if not challenge:
        # Create new challenge
        start = now
        end = now + timedelta(days=7)
        
        challenge = {
            "id": str(uuid.uuid4()),
            "week_number": now.isocalendar()[1],
            "year": now.year,
            "title": f"Woche {now.isocalendar()[1]} Challenge",
            "description": "Wer spart diese Woche am meisten?",
            "prize_bids": 100,
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
            "status": "active"
        }
        await db.weekly_challenges.insert_one(challenge)
        del challenge["_id"]
    
    # Get leaderboard
    leaderboard = await db.challenge_scores.find(
        {"challenge_id": challenge["id"]},
        {"_id": 0}
    ).sort("total_savings", -1).limit(10).to_list(10)
    
    for entry in leaderboard:
        user = await db.users.find_one({"id": entry["user_id"]}, {"username": 1})
        entry["username"] = user.get("username", "User") if user else "User"
    
    challenge["leaderboard"] = leaderboard
    
    return {"challenge": challenge}

@router.post("/record-win")
async def record_challenge_win(user: dict = Depends(get_current_user)):
    """Record a win for the weekly challenge (called after auction win)"""
    user_id = user["id"]
    now = datetime.now(timezone.utc)
    
    # Get current challenge
    challenge = await db.weekly_challenges.find_one({
        "status": "active",
        "end_date": {"$gt": now.isoformat()}
    })
    
    if not challenge:
        return {"recorded": False}
    
    # Get user's latest win
    latest_win = await db.won_auctions.find_one(
        {"winner_id": user_id},
        sort=[("won_at", -1)]
    )
    
    if not latest_win:
        return {"recorded": False}
    
    savings = latest_win.get("retail_price", 0) - latest_win.get("final_price", 0)
    
    # Update or create score
    await db.challenge_scores.update_one(
        {"challenge_id": challenge["id"], "user_id": user_id},
        {
            "$inc": {"total_savings": savings, "wins_count": 1},
            "$set": {"last_win_at": now.isoformat()}
        },
        upsert=True
    )
    
    return {"recorded": True, "savings_added": savings}

@router.get("/my-rank")
async def get_my_rank(user: dict = Depends(get_current_user)):
    """Get user's rank in current challenge"""
    user_id = user["id"]
    now = datetime.now(timezone.utc)
    
    challenge = await db.weekly_challenges.find_one({
        "status": "active",
        "end_date": {"$gt": now.isoformat()}
    })
    
    if not challenge:
        return {"rank": None, "in_challenge": False}
    
    my_score = await db.challenge_scores.find_one(
        {"challenge_id": challenge["id"], "user_id": user_id},
        {"_id": 0}
    )
    
    if not my_score:
        return {"rank": None, "in_challenge": False, "total_savings": 0}
    
    # Count users with higher savings
    higher_count = await db.challenge_scores.count_documents({
        "challenge_id": challenge["id"],
        "total_savings": {"$gt": my_score.get("total_savings", 0)}
    })
    
    return {
        "rank": higher_count + 1,
        "in_challenge": True,
        "total_savings": my_score.get("total_savings", 0),
        "wins_count": my_score.get("wins_count", 0)
    }

@router.get("/history")
async def get_challenge_history():
    """Get past challenge winners"""
    challenges = await db.weekly_challenges.find(
        {"status": "completed"},
        {"_id": 0}
    ).sort("end_date", -1).limit(10).to_list(10)
    
    for challenge in challenges:
        winner = await db.challenge_scores.find_one(
            {"challenge_id": challenge["id"]},
            {"_id": 0},
            sort=[("total_savings", -1)]
        )
        if winner:
            user = await db.users.find_one({"id": winner["user_id"]}, {"username": 1})
            challenge["winner"] = {
                "username": user.get("username", "User") if user else "User",
                "total_savings": winner.get("total_savings", 0)
            }
    
    return {"history": challenges}


# ==================== ADMIN ENDPOINTS ====================

class ChallengeCreate(BaseModel):
    title: str
    description: str = "Wer spart diese Woche am meisten?"
    prize_bids: int = 100
    duration_days: int = 7

class ChallengeUpdate(BaseModel):
    title: str = None
    description: str = None
    prize_bids: int = None

@router.get("/admin/all")
async def get_all_challenges(admin: dict = Depends(get_admin_user)):
    """Get all challenges (admin)"""
    challenges = await db.weekly_challenges.find(
        {},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    # Enrich with participant counts and winners
    for challenge in challenges:
        participant_count = await db.challenge_scores.count_documents(
            {"challenge_id": challenge["id"]}
        )
        challenge["participant_count"] = participant_count
        
        # Get top 3 for each challenge
        top3 = await db.challenge_scores.find(
            {"challenge_id": challenge["id"]},
            {"_id": 0}
        ).sort("total_savings", -1).limit(3).to_list(3)
        
        for entry in top3:
            user = await db.users.find_one({"id": entry["user_id"]}, {"username": 1, "email": 1})
            entry["username"] = user.get("username", "User") if user else "User"
            entry["email"] = user.get("email", "") if user else ""
        
        challenge["top_participants"] = top3
    
    return {"challenges": challenges}


@router.post("/admin/create")
async def create_challenge(data: ChallengeCreate, admin: dict = Depends(get_admin_user)):
    """Create a new challenge (admin)"""
    now = datetime.now(timezone.utc)
    
    # End any active challenges
    await db.weekly_challenges.update_many(
        {"status": "active"},
        {"$set": {"status": "ended_early", "ended_at": now.isoformat()}}
    )
    
    challenge = {
        "id": str(uuid.uuid4()),
        "week_number": now.isocalendar()[1],
        "year": now.year,
        "title": data.title,
        "description": data.description,
        "prize_bids": data.prize_bids,
        "start_date": now.isoformat(),
        "end_date": (now + timedelta(days=data.duration_days)).isoformat(),
        "status": "active",
        "created_by": admin.get("id"),
        "created_at": now.isoformat()
    }
    
    await db.weekly_challenges.insert_one(challenge)
    del challenge["_id"]
    
    logger.info(f"New challenge created: {data.title} by admin {admin.get('id')}")
    
    return {"success": True, "challenge": challenge}


@router.put("/admin/{challenge_id}")
async def update_challenge(challenge_id: str, data: ChallengeUpdate, admin: dict = Depends(get_admin_user)):
    """Update a challenge (admin)"""
    update_data = {k: v for k, v in data.dict().items() if v is not None}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="Keine Änderungen angegeben")
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    update_data["updated_by"] = admin.get("id")
    
    result = await db.weekly_challenges.update_one(
        {"id": challenge_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Challenge nicht gefunden")
    
    return {"success": True}


@router.post("/admin/{challenge_id}/end")
async def end_challenge(challenge_id: str, admin: dict = Depends(get_admin_user)):
    """End a challenge and award prizes (admin)"""
    now = datetime.now(timezone.utc)
    
    challenge = await db.weekly_challenges.find_one({"id": challenge_id})
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge nicht gefunden")
    
    if challenge.get("status") == "completed":
        raise HTTPException(status_code=400, detail="Challenge bereits beendet")
    
    # Get winner (highest savings)
    winner = await db.challenge_scores.find_one(
        {"challenge_id": challenge_id},
        sort=[("total_savings", -1)]
    )
    
    prize_awarded = False
    winner_info = None
    
    if winner:
        # Award prize to winner
        prize_bids = challenge.get("prize_bids", 100)
        await db.users.update_one(
            {"id": winner["user_id"]},
            {"$inc": {"bids": prize_bids}}
        )
        
        user = await db.users.find_one({"id": winner["user_id"]}, {"username": 1, "email": 1})
        winner_info = {
            "user_id": winner["user_id"],
            "username": user.get("username", "User") if user else "User",
            "email": user.get("email", "") if user else "",
            "total_savings": winner.get("total_savings", 0),
            "wins_count": winner.get("wins_count", 0),
            "prize_awarded": prize_bids
        }
        prize_awarded = True
        
        # Log the award
        await db.challenge_awards.insert_one({
            "id": str(uuid.uuid4()),
            "challenge_id": challenge_id,
            "user_id": winner["user_id"],
            "prize_bids": prize_bids,
            "awarded_at": now.isoformat(),
            "awarded_by": admin.get("id")
        })
        
        logger.info(f"Challenge {challenge_id} ended. Winner: {winner_info['username']} awarded {prize_bids} bids")
    
    # Update challenge status
    await db.weekly_challenges.update_one(
        {"id": challenge_id},
        {"$set": {
            "status": "completed",
            "ended_at": now.isoformat(),
            "ended_by": admin.get("id"),
            "winner_id": winner["user_id"] if winner else None
        }}
    )
    
    return {
        "success": True,
        "prize_awarded": prize_awarded,
        "winner": winner_info
    }


@router.get("/admin/{challenge_id}/leaderboard")
async def get_full_leaderboard(challenge_id: str, admin: dict = Depends(get_admin_user)):
    """Get full leaderboard for a challenge (admin)"""
    leaderboard = await db.challenge_scores.find(
        {"challenge_id": challenge_id},
        {"_id": 0}
    ).sort("total_savings", -1).to_list(100)
    
    for i, entry in enumerate(leaderboard):
        user = await db.users.find_one(
            {"id": entry["user_id"]}, 
            {"username": 1, "email": 1, "bids": 1}
        )
        entry["rank"] = i + 1
        entry["username"] = user.get("username", "User") if user else "User"
        entry["email"] = user.get("email", "") if user else ""
        entry["current_bids"] = user.get("bids", 0) if user else 0
    
    return {"leaderboard": leaderboard}


@router.delete("/admin/{challenge_id}")
async def delete_challenge(challenge_id: str, admin: dict = Depends(get_admin_user)):
    """Delete a challenge (admin) - only if no participants"""
    participant_count = await db.challenge_scores.count_documents({"challenge_id": challenge_id})
    
    if participant_count > 0:
        raise HTTPException(
            status_code=400, 
            detail=f"Challenge hat {participant_count} Teilnehmer und kann nicht gelöscht werden"
        )
    
    result = await db.weekly_challenges.delete_one({"id": challenge_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Challenge nicht gefunden")
    
    return {"success": True}


weekly_challenge_router = router
