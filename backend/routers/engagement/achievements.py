# Achievements & Badges System
from fastapi import APIRouter, HTTPException
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel

router = APIRouter(prefix="/api/achievements", tags=["Achievements"])

# All Achievements
ACHIEVEMENTS = [
    # Bidding Achievements
    {"id": "first_bid", "name": "Erster Schritt", "description": "Gib dein erstes Gebot ab", "icon": "🎯", "category": "bidding", "requirement": 1, "reward": 5},
    {"id": "bid_100", "name": "Fleißiger Bieter", "description": "Gib 100 Gebote ab", "icon": "💪", "category": "bidding", "requirement": 100, "reward": 20},
    {"id": "bid_500", "name": "Bieter-Profi", "description": "Gib 500 Gebote ab", "icon": "🔥", "category": "bidding", "requirement": 500, "reward": 50},
    {"id": "bid_1000", "name": "Bieter-Legende", "description": "Gib 1000 Gebote ab", "icon": "⭐", "category": "bidding", "requirement": 1000, "reward": 100},
    {"id": "bid_5000", "name": "Bieter-Gott", "description": "Gib 5000 Gebote ab", "icon": "👑", "category": "bidding", "requirement": 5000, "reward": 250},
    
    # Winning Achievements
    {"id": "first_win", "name": "Gewinner!", "description": "Gewinne deine erste Auktion", "icon": "🏆", "category": "winning", "requirement": 1, "reward": 10},
    {"id": "win_5", "name": "Seriengewinner", "description": "Gewinne 5 Auktionen", "icon": "🥇", "category": "winning", "requirement": 5, "reward": 30},
    {"id": "win_25", "name": "Auktions-Champion", "description": "Gewinne 25 Auktionen", "icon": "🏅", "category": "winning", "requirement": 25, "reward": 100},
    {"id": "win_100", "name": "Auktions-König", "description": "Gewinne 100 Auktionen", "icon": "👸", "category": "winning", "requirement": 100, "reward": 500},
    
    # Savings Achievements
    {"id": "save_100", "name": "Schnäppchenjäger", "description": "Spare €100 insgesamt", "icon": "💰", "category": "savings", "requirement": 100, "reward": 15},
    {"id": "save_500", "name": "Spar-Fuchs", "description": "Spare €500 insgesamt", "icon": "🦊", "category": "savings", "requirement": 500, "reward": 50},
    {"id": "save_1000", "name": "Spar-Meister", "description": "Spare €1000 insgesamt", "icon": "💎", "category": "savings", "requirement": 1000, "reward": 150},
    {"id": "save_5000", "name": "Spar-Legende", "description": "Spare €5000 insgesamt", "icon": "🌟", "category": "savings", "requirement": 5000, "reward": 500},
    
    # Streak Achievements
    {"id": "streak_7", "name": "Treuer Nutzer", "description": "7 Tage Login-Streak", "icon": "📅", "category": "loyalty", "requirement": 7, "reward": 25},
    {"id": "streak_30", "name": "Monatliche Treue", "description": "30 Tage Login-Streak", "icon": "📆", "category": "loyalty", "requirement": 30, "reward": 100},
    {"id": "streak_100", "name": "Ultimative Treue", "description": "100 Tage Login-Streak", "icon": "🔥", "category": "loyalty", "requirement": 100, "reward": 500},
    
    # Social Achievements
    {"id": "refer_1", "name": "Freunde werben", "description": "Werbe 1 Freund", "icon": "👫", "category": "social", "requirement": 1, "reward": 50},
    {"id": "refer_5", "name": "Netzwerker", "description": "Werbe 5 Freunde", "icon": "🤝", "category": "social", "requirement": 5, "reward": 150},
    {"id": "refer_10", "name": "Influencer", "description": "Werbe 10 Freunde", "icon": "🌐", "category": "social", "requirement": 10, "reward": 500},
    
    # Special Achievements
    {"id": "night_owl", "name": "Nachteule", "description": "Gewinne eine Nacht-Auktion", "icon": "🦉", "category": "special", "requirement": 1, "reward": 20},
    {"id": "early_bird", "name": "Frühaufsteher", "description": "Biete vor 6 Uhr morgens", "icon": "🐦", "category": "special", "requirement": 1, "reward": 15},
    {"id": "vip_winner", "name": "VIP-Gewinner", "description": "Gewinne eine VIP-Auktion", "icon": "💫", "category": "special", "requirement": 1, "reward": 50},
    {"id": "beginner_grad", "name": "Absolvent", "description": "Gewinne 3 Anfänger-Auktionen", "icon": "🎓", "category": "special", "requirement": 3, "reward": 30},
    {"id": "jackpot_winner", "name": "Jackpot!", "description": "Gewinne den Jackpot", "icon": "🎰", "category": "special", "requirement": 1, "reward": 0},
    {"id": "photo_uploader", "name": "Fotograf", "description": "Lade ein Gewinner-Foto hoch", "icon": "📸", "category": "special", "requirement": 1, "reward": 25},
]

# Level System
LEVELS = [
    {"level": 1, "name": "Neuling", "min_xp": 0, "badge": "🌱", "perks": []},
    {"level": 2, "name": "Anfänger", "min_xp": 100, "badge": "🌿", "perks": ["1% Rabatt auf Gebote"]},
    {"level": 3, "name": "Fortgeschritten", "min_xp": 300, "badge": "🌳", "perks": ["2% Rabatt auf Gebote"]},
    {"level": 4, "name": "Erfahren", "min_xp": 600, "badge": "⭐", "perks": ["3% Rabatt", "Exklusive Auktionen"]},
    {"level": 5, "name": "Experte", "min_xp": 1000, "badge": "🌟", "perks": ["5% Rabatt", "Priority Support"]},
    {"level": 6, "name": "Meister", "min_xp": 2000, "badge": "💫", "perks": ["7% Rabatt", "VIP-Zugang"]},
    {"level": 7, "name": "Champion", "min_xp": 3500, "badge": "🏆", "perks": ["10% Rabatt", "Alle VIP-Features"]},
    {"level": 8, "name": "Legende", "min_xp": 5000, "badge": "👑", "perks": ["15% Rabatt", "Persönlicher Berater"]},
    {"level": 9, "name": "Gott", "min_xp": 10000, "badge": "🔱", "perks": ["20% Rabatt", "Exklusivste Auktionen"]},
]

@router.get("/all")
async def get_all_achievements():
    """Get all available achievements"""
    categories = {}
    for achievement in ACHIEVEMENTS:
        cat = achievement["category"]
        if cat not in categories:
            categories[cat] = []
        categories[cat].append(achievement)
    
    return {
        "achievements": ACHIEVEMENTS,
        "categories": categories,
        "total_count": len(ACHIEVEMENTS),
        "total_rewards": sum(a["reward"] for a in ACHIEVEMENTS)
    }

@router.get("/user/{user_id}")
async def get_user_achievements(user_id: str):
    """Get user's achievements and progress"""
    import random
    
    # Simulate user progress
    user_achievements = []
    unlocked_count = 0
    total_xp = 0
    
    for achievement in ACHIEVEMENTS:
        progress = random.randint(0, achievement["requirement"] + 5)
        unlocked = progress >= achievement["requirement"]
        if unlocked:
            unlocked_count += 1
            total_xp += achievement["reward"] * 10  # XP = reward * 10
        
        user_achievements.append({
            **achievement,
            "progress": min(progress, achievement["requirement"]),
            "unlocked": unlocked,
            "unlocked_at": datetime.utcnow().isoformat() if unlocked else None,
            "claimed": unlocked and random.choice([True, False])
        })
    
    # Calculate level
    current_level = LEVELS[0]
    next_level = LEVELS[1] if len(LEVELS) > 1 else None
    for i, level in enumerate(LEVELS):
        if total_xp >= level["min_xp"]:
            current_level = level
            next_level = LEVELS[i + 1] if i + 1 < len(LEVELS) else None
    
    return {
        "user_id": user_id,
        "achievements": user_achievements,
        "unlocked_count": unlocked_count,
        "total_count": len(ACHIEVEMENTS),
        "completion_percentage": round(unlocked_count / len(ACHIEVEMENTS) * 100, 1),
        "total_xp": total_xp,
        "level": current_level,
        "next_level": next_level,
        "xp_to_next_level": next_level["min_xp"] - total_xp if next_level else 0
    }

@router.get("/levels")
async def get_level_system():
    """Get all levels and perks"""
    return {
        "levels": LEVELS,
        "xp_sources": {
            "bid": 1,
            "win": 50,
            "daily_login": 5,
            "mission_complete": 10,
            "achievement_unlock": "varies",
            "referral": 100
        }
    }

@router.post("/claim/{achievement_id}")
async def claim_achievement_reward(achievement_id: str, user_id: Optional[str] = None):
    """Claim reward for unlocked achievement"""
    achievement = next((a for a in ACHIEVEMENTS if a["id"] == achievement_id), None)
    if not achievement:
        raise HTTPException(status_code=404, detail="Achievement nicht gefunden")
    
    return {
        "success": True,
        "achievement": achievement,
        "reward": achievement["reward"],
        "xp_earned": achievement["reward"] * 10,
        "message": f"🎉 Achievement freigeschaltet: {achievement['name']}! +{achievement['reward']} Gebote"
    }

@router.get("/leaderboard")
async def get_achievements_leaderboard(limit: int = 10):
    """Get top users by achievements"""
    import random
    
    fake_users = [
        {"name": "MaxBieter", "achievements": random.randint(15, 25), "level": random.randint(5, 9)},
        {"name": "SchnäppchenQueen", "achievements": random.randint(12, 22), "level": random.randint(4, 8)},
        {"name": "BidKing2024", "achievements": random.randint(10, 20), "level": random.randint(4, 7)},
        {"name": "LuckyWinner", "achievements": random.randint(8, 18), "level": random.randint(3, 6)},
        {"name": "AuktionsProfi", "achievements": random.randint(6, 15), "level": random.randint(2, 5)},
    ]
    
    # Sort by achievements
    fake_users.sort(key=lambda x: x["achievements"], reverse=True)
    
    return {
        "leaderboard": [
            {
                "rank": i + 1,
                "user": user["name"],
                "achievements_unlocked": user["achievements"],
                "level": LEVELS[min(user["level"], len(LEVELS)-1)],
            }
            for i, user in enumerate(fake_users[:limit])
        ]
    }
