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

# Prize configuration (string keys for MongoDB compatibility)
PRIZES = {
    "1": {"bids": 100, "badge": "🥇", "title": "1. Platz"},
    "2": {"bids": 50, "badge": "🥈", "title": "2. Platz"},
    "3": {"bids": 25, "badge": "🥉", "title": "3. Platz"},
    "4": {"bids": 10, "badge": "⭐", "title": "Top 10"},
    "5": {"bids": 10, "badge": "⭐", "title": "Top 10"},
    "6": {"bids": 5, "badge": "✨", "title": "Top 10"},
    "7": {"bids": 5, "badge": "✨", "title": "Top 10"},
    "8": {"bids": 5, "badge": "✨", "title": "Top 10"},
    "9": {"bids": 5, "badge": "✨", "title": "Top 10"},
    "10": {"bids": 5, "badge": "✨", "title": "Top 10"}
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
        prize = PRIZES.get(str(rank), {"bids": 0, "badge": "", "title": ""})
        
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
        "potential_prize": PRIZES.get("1") if score > 0 else None
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


# ==================== TOURNAMENT NOTIFICATIONS ====================

@router.post("/subscribe")
async def subscribe_to_tournament_notifications(
    user: dict = Depends(get_current_user)
):
    """Subscribe to tournament push notifications"""
    user_id = user["id"]
    
    # Update user preferences
    await db.notification_preferences.update_one(
        {"user_id": user_id},
        {
            "$set": {
                "tournament_notifications": True,
                "tournament_new": True,
                "tournament_position_change": True,
                "tournament_ending": True,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        },
        upsert=True
    )
    
    return {
        "message": "Turnier-Benachrichtigungen aktiviert",
        "preferences": {
            "tournament_new": True,
            "tournament_position_change": True,
            "tournament_ending": True
        }
    }


@router.delete("/subscribe")
async def unsubscribe_from_tournament_notifications(
    user: dict = Depends(get_current_user)
):
    """Unsubscribe from tournament push notifications"""
    user_id = user["id"]
    
    await db.notification_preferences.update_one(
        {"user_id": user_id},
        {
            "$set": {
                "tournament_notifications": False,
                "tournament_new": False,
                "tournament_position_change": False,
                "tournament_ending": False
            }
        }
    )
    
    return {"message": "Turnier-Benachrichtigungen deaktiviert"}


@router.get("/notification-status")
async def get_tournament_notification_status(user: dict = Depends(get_current_user)):
    """Get user's tournament notification preferences"""
    prefs = await db.notification_preferences.find_one(
        {"user_id": user["id"]},
        {"_id": 0}
    )
    
    return {
        "subscribed": prefs.get("tournament_notifications", False) if prefs else False,
        "preferences": {
            "tournament_new": prefs.get("tournament_new", False) if prefs else False,
            "tournament_position_change": prefs.get("tournament_position_change", False) if prefs else False,
            "tournament_ending": prefs.get("tournament_ending", False) if prefs else False
        }
    }


# ==================== NOTIFICATION HELPER FUNCTIONS ====================

async def notify_position_change(user_id: str, old_rank: int, new_rank: int, tournament_name: str):
    """Send notification when user's position changes in tournament"""
    from routers.notifications import send_push_to_user
    
    if new_rank > 3 and old_rank <= 3:
        # User dropped out of top 3
        title = "⚠️ Turnier-Update"
        body = f"Du bist von Platz {old_rank} auf Platz {new_rank} gefallen! Kämpfe zurück in die Top 3!"
    elif new_rank <= 3 and old_rank > 3:
        # User entered top 3
        title = "🎉 Top 3 erreicht!"
        body = f"Glückwunsch! Du bist jetzt auf Platz {new_rank} im {tournament_name}!"
    elif new_rank < old_rank:
        # User moved up
        title = "📈 Aufstieg im Turnier!"
        body = f"Super! Du bist von Platz {old_rank} auf Platz {new_rank} gestiegen!"
    else:
        # User moved down (but not out of top 3)
        title = "📉 Turnier-Update"
        body = f"Achtung! Du bist von Platz {old_rank} auf Platz {new_rank} gefallen."
    
    # Create in-app notification
    notification = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "title": title,
        "message": body,
        "type": "tournament",
        "link": "/tournaments",
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(notification)
    
    # Send push notification
    try:
        await send_push_to_user(user_id, title, body, {"url": "/tournaments"})
    except Exception as e:
        logger.warning(f"Failed to send push notification: {e}")


async def notify_tournament_start(tournament: dict):
    """Notify all subscribed users when a new tournament starts"""
    from routers.notifications import send_push_to_users
    
    # Find users subscribed to tournament notifications
    subscribed_prefs = await db.notification_preferences.find(
        {"tournament_new": True},
        {"_id": 0, "user_id": 1}
    ).to_list(length=10000)
    
    if not subscribed_prefs:
        return 0
    
    user_ids = [p["user_id"] for p in subscribed_prefs]
    
    title = f"🏆 Neues Turnier: {tournament['name']}"
    body = f"{tournament['description']} Kämpfe um Preise bis zu {PRIZES['1']['bids']} Gebote!"
    
    # Create in-app notifications
    now = datetime.now(timezone.utc).isoformat()
    notifications = []
    for user_id in user_ids:
        notifications.append({
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "title": title,
            "message": body,
            "type": "tournament",
            "link": "/tournaments",
            "read": False,
            "created_at": now
        })
    
    if notifications:
        await db.notifications.insert_many(notifications)
    
    # Send push notifications
    try:
        sent = await send_push_to_users(user_ids, title, body, "/tournaments")
        logger.info(f"Tournament start notification sent to {sent} users")
        return sent
    except Exception as e:
        logger.warning(f"Failed to send tournament start push: {e}")
        return 0


async def notify_tournament_ending(hours_remaining: int = 24):
    """Notify users in top 10 that tournament is ending soon"""
    from routers.notifications import send_push_to_user
    
    # Get current tournament
    tournament = await db.tournaments.find_one({
        "status": "active"
    }, {"_id": 0})
    
    if not tournament:
        return 0
    
    # Get top 10 leaderboard
    leaderboard_data = await get_tournament_leaderboard(limit=10)
    leaderboard = leaderboard_data.get("leaderboard", [])
    
    title = f"⏰ Turnier endet in {hours_remaining} Stunden!"
    
    sent = 0
    for entry in leaderboard:
        user_id = entry.get("user_id")
        if not user_id:
            continue
        
        rank = entry.get("rank", 0)
        prize = entry.get("prize", {})
        
        body = f"Du bist aktuell auf Platz {rank} und könntest {prize.get('bids', 0)} Gebote gewinnen!"
        
        # Create in-app notification
        notification = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "title": title,
            "message": body,
            "type": "tournament",
            "link": "/tournaments",
            "read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.notifications.insert_one(notification)
        
        # Send push
        try:
            if await send_push_to_user(user_id, title, body, {"url": "/tournaments"}):
                sent += 1
        except Exception as e:
            pass
    
    logger.info(f"Tournament ending notification sent to {sent} users")
    return sent


# ==================== ADMIN: MANUAL NOTIFICATIONS ====================

@router.post("/admin/notify-all")
async def admin_send_tournament_notification(
    title: str,
    message: str,
    user: dict = Depends(get_current_user)
):
    """Admin endpoint to send tournament notification to all subscribed users"""
    # Check if admin
    if not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    from routers.notifications import send_push_to_users
    
    # Find subscribed users
    subscribed = await db.notification_preferences.find(
        {"tournament_notifications": True},
        {"_id": 0, "user_id": 1}
    ).to_list(length=10000)
    
    user_ids = [s["user_id"] for s in subscribed]
    
    if not user_ids:
        return {"sent": 0, "message": "Keine abonnierten Benutzer"}
    
    # Create in-app notifications
    now = datetime.now(timezone.utc).isoformat()
    notifications = []
    for uid in user_ids:
        notifications.append({
            "id": str(uuid.uuid4()),
            "user_id": uid,
            "title": title,
            "message": message,
            "type": "tournament",
            "link": "/tournaments",
            "read": False,
            "created_at": now
        })
    
    await db.notifications.insert_many(notifications)
    
    # Send push
    try:
        push_sent = await send_push_to_users(user_ids, title, message, "/tournaments")
    except:
        push_sent = 0
    
    return {
        "sent": len(notifications),
        "push_sent": push_sent,
        "message": f"Benachrichtigung an {len(notifications)} Benutzer gesendet"
    }
