"""Leaderboard Router - Weekly rankings with prizes"""
from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timedelta, timezone
from ..config import get_db, get_current_user
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/leaderboard", tags=["leaderboard"])

# Weekly prize configuration
WEEKLY_PRIZES = {
    1: {"bids": 50, "badge": "🥇"},   # 1st place
    2: {"bids": 30, "badge": "🥈"},   # 2nd place
    3: {"bids": 20, "badge": "🥉"},   # 3rd place
    4: {"bids": 10, "badge": "🏅"},   # 4th-5th
    5: {"bids": 10, "badge": "🏅"},
    6: {"bids": 5, "badge": "⭐"},    # 6th-10th
    7: {"bids": 5, "badge": "⭐"},
    8: {"bids": 5, "badge": "⭐"},
    9: {"bids": 5, "badge": "⭐"},
    10: {"bids": 5, "badge": "⭐"},
}


def get_week_start():
    """Get the start of the current week (Monday 00:00 UTC)"""
    now = datetime.now(timezone.utc)
    days_since_monday = now.weekday()
    week_start = now - timedelta(days=days_since_monday, hours=now.hour, minutes=now.minute, seconds=now.second, microseconds=now.microsecond)
    return week_start


def get_week_end():
    """Get the end of the current week (Sunday 23:59 UTC)"""
    week_start = get_week_start()
    return week_start + timedelta(days=7) - timedelta(seconds=1)


@router.get("/weekly")
async def get_weekly_leaderboard(
    db=Depends(get_db)
):
    """Get current week's leaderboard"""
    week_start = get_week_start()
    week_end = get_week_end()
    
    # Aggregate bids per user for this week
    pipeline = [
        {
            "$match": {
                "created_at": {
                    "$gte": week_start.isoformat(),
                    "$lte": week_end.isoformat()
                }
            }
        },
        {
            "$group": {
                "_id": "$user_id",
                "total_bids": {"$sum": 1},
                "user_name": {"$first": "$user_name"}
            }
        },
        {
            "$sort": {"total_bids": -1}
        },
        {
            "$limit": 50
        }
    ]
    
    leaderboard_raw = await db.bids.aggregate(pipeline).to_list(50)
    
    # Build leaderboard with prizes
    leaderboard = []
    for i, entry in enumerate(leaderboard_raw):
        rank = i + 1
        prize = WEEKLY_PRIZES.get(rank, {"bids": 0, "badge": ""})
        
        # Anonymize name partially
        name = entry.get("user_name", "Anonymous")
        if len(name) > 3:
            display_name = name[:2] + "*" * (len(name) - 3) + name[-1]
        else:
            display_name = name
        
        leaderboard.append({
            "rank": rank,
            "user_id": entry["_id"],
            "display_name": display_name,
            "total_bids": entry["total_bids"],
            "prize_bids": prize["bids"],
            "badge": prize["badge"]
        })
    
    return {
        "leaderboard": leaderboard,
        "week_start": week_start.isoformat(),
        "week_end": week_end.isoformat(),
        "prizes": WEEKLY_PRIZES
    }


@router.get("/my-rank")
async def get_my_rank(
    db=Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Get current user's rank this week"""
    user_id = current_user["id"]
    week_start = get_week_start()
    week_end = get_week_end()
    
    # Get user's bid count this week
    user_bids = await db.bids.count_documents({
        "user_id": user_id,
        "created_at": {
            "$gte": week_start.isoformat(),
            "$lte": week_end.isoformat()
        }
    })
    
    # Count how many users have more bids
    pipeline = [
        {
            "$match": {
                "created_at": {
                    "$gte": week_start.isoformat(),
                    "$lte": week_end.isoformat()
                }
            }
        },
        {
            "$group": {
                "_id": "$user_id",
                "total_bids": {"$sum": 1}
            }
        },
        {
            "$match": {
                "total_bids": {"$gt": user_bids}
            }
        },
        {
            "$count": "users_ahead"
        }
    ]
    
    result = await db.bids.aggregate(pipeline).to_list(1)
    users_ahead = result[0]["users_ahead"] if result else 0
    
    rank = users_ahead + 1
    prize = WEEKLY_PRIZES.get(rank, {"bids": 0, "badge": ""})
    
    return {
        "rank": rank,
        "total_bids": user_bids,
        "prize_bids": prize["bids"],
        "badge": prize["badge"],
        "in_top_10": rank <= 10
    }


@router.get("/history")
async def get_leaderboard_history(
    db=Depends(get_db)
):
    """Get past weeks' winners"""
    # Get past 4 weeks of winners
    history = await db.leaderboard_history.find(
        {},
        {"_id": 0}
    ).sort("week_end", -1).limit(4).to_list(4)
    
    return {"history": history}


@router.post("/finalize-week")
async def finalize_week(
    db=Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Admin only: Finalize current week and award prizes"""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    # Get current leaderboard
    leaderboard_data = await get_weekly_leaderboard(db)
    leaderboard = leaderboard_data["leaderboard"]
    
    awarded = []
    for entry in leaderboard[:10]:
        if entry["prize_bids"] > 0:
            # Award bids to user
            await db.users.update_one(
                {"id": entry["user_id"]},
                {"$inc": {"bids_balance": entry["prize_bids"]}}
            )
            awarded.append({
                "user_id": entry["user_id"],
                "rank": entry["rank"],
                "bids_awarded": entry["prize_bids"]
            })
            logger.info(f"🏆 Leaderboard: Awarded {entry['prize_bids']} bids to rank #{entry['rank']} user {entry['user_id']}")
    
    # Save to history
    await db.leaderboard_history.insert_one({
        "week_start": leaderboard_data["week_start"],
        "week_end": leaderboard_data["week_end"],
        "winners": leaderboard[:10],
        "finalized_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {
        "success": True,
        "message": f"Awarded prizes to {len(awarded)} users",
        "awarded": awarded
    }
