"""Weekly Leaderboard Router"""
from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timedelta, timezone
from config import db, logger
from dependencies import get_current_user

router = APIRouter(prefix="/leaderboard", tags=["leaderboard"])

# Weekly prizes for top 10 users
WEEKLY_PRIZES = {
    1: {"bids": 100, "badge": "🥇 Champion"},
    2: {"bids": 75, "badge": "🥈 Zweiter"},
    3: {"bids": 50, "badge": "🥉 Dritter"},
    4: {"bids": 30, "badge": "⭐ Top 5"},
    5: {"bids": 25, "badge": "⭐ Top 5"},
    6: {"bids": 20, "badge": "Top 10"},
    7: {"bids": 15, "badge": "Top 10"},
    8: {"bids": 12, "badge": "Top 10"},
    9: {"bids": 10, "badge": "Top 10"},
    10: {"bids": 8, "badge": "Top 10"},
}


def get_week_bounds():
    """Get the start and end of the current week (Monday to Sunday)"""
    now = datetime.now(timezone.utc)
    # Monday of this week
    week_start = now - timedelta(days=now.weekday())
    week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)
    # Sunday end
    week_end = week_start + timedelta(days=7)
    return week_start, week_end


@router.get("")
async def get_leaderboard(current_user: dict = Depends(get_current_user)):
    """Get the weekly leaderboard with top bidders"""
    week_start, week_end = get_week_bounds()
    
    # Aggregate bids per user for the current week
    pipeline = [
        {
            "$match": {
                "created_at": {
                    "$gte": week_start,
                    "$lt": week_end
                }
            }
        },
        {
            "$group": {
                "_id": "$user_id",
                "total_bids": {"$sum": 1},
                "last_bid": {"$max": "$created_at"}
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
    
    # Enrich with user data
    leaderboard = []
    for idx, entry in enumerate(leaderboard_raw):
        user = await db.users.find_one({"id": entry["_id"]}, {"_id": 0, "password": 0})
        if user:
            rank = idx + 1
            prize = WEEKLY_PRIZES.get(rank, None)
            leaderboard.append({
                "rank": rank,
                "user_id": entry["_id"],
                "username": user.get("username") or user.get("name", "Anonym"),
                "avatar": user.get("avatar"),
                "is_vip": user.get("is_vip", False),
                "total_bids": entry["total_bids"],
                "last_bid": entry["last_bid"].isoformat() if entry["last_bid"] else None,
                "prize": prize
            })
    
    # Check current user's position
    current_user_entry = None
    current_user_id = current_user["id"]
    
    for entry in leaderboard:
        if entry["user_id"] == current_user_id:
            current_user_entry = entry
            break
    
    # If not in top 50, calculate their rank separately
    if not current_user_entry:
        user_bids_count = await db.bids.count_documents({
            "user_id": current_user_id,
            "created_at": {"$gte": week_start, "$lt": week_end}
        })
        
        if user_bids_count > 0:
            # Count how many users have more bids
            users_above = await db.bids.aggregate([
                {
                    "$match": {
                        "created_at": {"$gte": week_start, "$lt": week_end}
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
                        "total_bids": {"$gt": user_bids_count}
                    }
                },
                {
                    "$count": "count"
                }
            ]).to_list(1)
            
            rank = (users_above[0]["count"] if users_above else 0) + 1
            
            current_user_entry = {
                "rank": rank,
                "user_id": current_user_id,
                "username": current_user.get("username") or current_user.get("name", "Du"),
                "total_bids": user_bids_count,
                "prize": WEEKLY_PRIZES.get(rank, None) if rank <= 10 else None
            }
    
    return {
        "leaderboard": leaderboard[:10],  # Return top 10
        "full_leaderboard": leaderboard,  # Return top 50
        "current_user": current_user_entry,
        "week_start": week_start.isoformat(),
        "week_end": week_end.isoformat(),
        "prizes": WEEKLY_PRIZES
    }


@router.get("/public")
async def get_public_leaderboard():
    """Get the weekly leaderboard (public, no auth required)"""
    week_start, week_end = get_week_bounds()
    
    # Aggregate bids per user for the current week
    pipeline = [
        {
            "$match": {
                "created_at": {
                    "$gte": week_start,
                    "$lt": week_end
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
            "$sort": {"total_bids": -1}
        },
        {
            "$limit": 10
        }
    ]
    
    leaderboard_raw = await db.bids.aggregate(pipeline).to_list(10)
    
    # Enrich with user data
    leaderboard = []
    for idx, entry in enumerate(leaderboard_raw):
        user = await db.users.find_one({"id": entry["_id"]}, {"_id": 0, "password": 0})
        if user:
            rank = idx + 1
            prize = WEEKLY_PRIZES.get(rank, None)
            leaderboard.append({
                "rank": rank,
                "username": user.get("username") or user.get("name", "Anonym")[:3] + "***",
                "is_vip": user.get("is_vip", False),
                "total_bids": entry["total_bids"],
                "prize": prize
            })
    
    return {
        "leaderboard": leaderboard,
        "week_start": week_start.isoformat(),
        "week_end": week_end.isoformat(),
        "prizes": WEEKLY_PRIZES
    }


@router.post("/award-weekly-prizes")
async def award_weekly_prizes(current_user: dict = Depends(get_current_user)):
    """Award prizes to weekly top 10 (Admin only, called by scheduler)"""
    # Check admin
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    # Get previous week's bounds
    now = datetime.now(timezone.utc)
    week_start = now - timedelta(days=now.weekday() + 7)
    week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)
    week_end = week_start + timedelta(days=7)
    
    # Check if already awarded
    existing_award = await db.leaderboard_awards.find_one({
        "week_start": week_start.isoformat()
    })
    
    if existing_award:
        return {"message": "Prizes already awarded for this week", "awarded": False}
    
    # Get top 10 from last week
    pipeline = [
        {
            "$match": {
                "created_at": {
                    "$gte": week_start,
                    "$lt": week_end
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
            "$sort": {"total_bids": -1}
        },
        {
            "$limit": 10
        }
    ]
    
    winners = await db.bids.aggregate(pipeline).to_list(10)
    
    awarded_users = []
    for idx, winner in enumerate(winners):
        rank = idx + 1
        prize = WEEKLY_PRIZES.get(rank)
        
        if prize and winner["_id"]:
            # Award bids
            await db.users.update_one(
                {"id": winner["_id"]},
                {"$inc": {"bids_balance": prize["bids"]}}
            )
            
            # Create notification
            await db.notifications.insert_one({
                "user_id": winner["_id"],
                "type": "leaderboard_prize",
                "title": f"🏆 Ranglisten-Preis: Platz {rank}!",
                "message": f"Du hast {prize['bids']} Gratis-Gebote gewonnen! {prize['badge']}",
                "read": False,
                "created_at": datetime.now(timezone.utc).isoformat()
            })
            
            awarded_users.append({
                "user_id": winner["_id"],
                "rank": rank,
                "bids_awarded": prize["bids"]
            })
            
            logger.info(f"🏆 Leaderboard: User {winner['_id']} won {prize['bids']} bids (Rank {rank})")
    
    # Record the award
    await db.leaderboard_awards.insert_one({
        "week_start": week_start.isoformat(),
        "week_end": week_end.isoformat(),
        "awarded_at": datetime.now(timezone.utc).isoformat(),
        "winners": awarded_users
    })
    
    return {
        "message": f"Awarded prizes to {len(awarded_users)} users",
        "awarded": True,
        "winners": awarded_users
    }
