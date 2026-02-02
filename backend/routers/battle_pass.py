"""Battle Pass System - Seasonal progression with free and premium rewards"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone, timedelta
from typing import Optional
import uuid
import os
import stripe

from config import db, logger, FRONTEND_URL
from dependencies import get_current_user, get_admin_user as get_current_admin

router = APIRouter(prefix="/battle-pass", tags=["Battle Pass"])

# Stripe
STRIPE_API_KEY = os.environ.get('STRIPE_API_KEY')
if STRIPE_API_KEY:
    stripe.api_key = STRIPE_API_KEY

# Battle Pass Configuration
BATTLE_PASS_PRICE = 9.99  # EUR
BATTLE_PASS_PREMIUM_PLUS_PRICE = 19.99  # EUR (includes 25 tier skips)
SEASON_DURATION_DAYS = 30
MAX_TIER = 50
XP_PER_TIER = 100  # XP needed to advance one tier

# ==================== SEASON REWARDS ====================

def generate_season_rewards():
    """Generate rewards for each tier (Free + Premium track)"""
    rewards = []
    
    for tier in range(1, MAX_TIER + 1):
        tier_reward = {
            "tier": tier,
            "free": None,
            "premium": None
        }
        
        # Free track rewards (every 5 tiers)
        if tier % 5 == 0:
            free_bids = (tier // 5) * 2  # 2, 4, 6, 8, 10...
            tier_reward["free"] = {
                "type": "bids",
                "amount": free_bids,
                "icon": "🎁",
                "name": f"{free_bids} Gratis-Gebote"
            }
        elif tier % 10 == 3:
            tier_reward["free"] = {
                "type": "xp_boost",
                "amount": 2,
                "duration_hours": 24,
                "icon": "⚡",
                "name": "24h Doppel-XP"
            }
        
        # Premium track rewards (every tier)
        if tier <= 10:
            # Early tiers: Small rewards
            premium_bids = 1 + (tier // 3)
            tier_reward["premium"] = {
                "type": "bids",
                "amount": premium_bids,
                "icon": "💎",
                "name": f"{premium_bids} Premium-Gebote"
            }
        elif tier <= 25:
            # Mid tiers: Better rewards
            if tier % 5 == 0:
                tier_reward["premium"] = {
                    "type": "bids",
                    "amount": tier // 2,
                    "icon": "💰",
                    "name": f"{tier // 2} Gebote"
                }
            elif tier % 3 == 0:
                tier_reward["premium"] = {
                    "type": "wheel_spin",
                    "amount": 1,
                    "icon": "🎡",
                    "name": "Bonus Glücksrad-Spin"
                }
            else:
                tier_reward["premium"] = {
                    "type": "bids",
                    "amount": 2,
                    "icon": "✨",
                    "name": "2 Gebote"
                }
        elif tier <= 40:
            # High tiers: Great rewards
            if tier % 5 == 0:
                tier_reward["premium"] = {
                    "type": "bids",
                    "amount": 15,
                    "icon": "👑",
                    "name": "15 Gebote"
                }
            elif tier == 30:
                tier_reward["premium"] = {
                    "type": "vip_days",
                    "amount": 3,
                    "icon": "⭐",
                    "name": "3 Tage VIP"
                }
            else:
                tier_reward["premium"] = {
                    "type": "bids",
                    "amount": 3 + (tier // 10),
                    "icon": "💎",
                    "name": f"{3 + (tier // 10)} Gebote"
                }
        else:
            # Final tiers: Best rewards
            if tier == 45:
                tier_reward["premium"] = {
                    "type": "vip_days",
                    "amount": 7,
                    "icon": "👑",
                    "name": "7 Tage VIP"
                }
            elif tier == 50:
                tier_reward["premium"] = {
                    "type": "mega_bundle",
                    "bids": 50,
                    "vip_days": 14,
                    "icon": "🏆",
                    "name": "MEGA BUNDLE: 50 Gebote + 14 Tage VIP"
                }
            else:
                tier_reward["premium"] = {
                    "type": "bids",
                    "amount": 8,
                    "icon": "💰",
                    "name": "8 Gebote"
                }
        
        rewards.append(tier_reward)
    
    return rewards

SEASON_REWARDS = generate_season_rewards()

# ==================== SEASON MANAGEMENT ====================

async def get_current_season():
    """Get or create current season"""
    now = datetime.now(timezone.utc)
    
    # Find active season
    season = await db.battle_pass_seasons.find_one({
        "start_date": {"$lte": now.isoformat()},
        "end_date": {"$gte": now.isoformat()},
        "is_active": True
    }, {"_id": 0})
    
    if season:
        return season
    
    # Create new season
    season_num = await db.battle_pass_seasons.count_documents({}) + 1
    start_date = now
    end_date = now + timedelta(days=SEASON_DURATION_DAYS)
    
    season = {
        "id": str(uuid.uuid4()),
        "season_number": season_num,
        "name": f"Saison {season_num}",
        "theme": get_season_theme(season_num),
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "max_tier": MAX_TIER,
        "xp_per_tier": XP_PER_TIER,
        "rewards": SEASON_REWARDS,
        "is_active": True,
        "created_at": now.isoformat()
    }
    
    await db.battle_pass_seasons.insert_one(season)
    logger.info(f"New Battle Pass season created: {season['name']}")
    
    return season

def get_season_theme(season_num):
    """Get theme for season"""
    themes = [
        {"name": "Frühlings-Fieber", "color": "#22C55E", "icon": "🌸"},
        {"name": "Sommer-Sensation", "color": "#F59E0B", "icon": "☀️"},
        {"name": "Herbst-Ernte", "color": "#EF4444", "icon": "🍂"},
        {"name": "Winter-Wunder", "color": "#3B82F6", "icon": "❄️"},
        {"name": "Neon-Nächte", "color": "#A855F7", "icon": "🌃"},
        {"name": "Cyber-Blitz", "color": "#06B6D4", "icon": "⚡"},
    ]
    return themes[(season_num - 1) % len(themes)]

# ==================== USER ENDPOINTS ====================

@router.get("/current")
async def get_battle_pass_status(user: dict = Depends(get_current_user)):
    """Get user's battle pass status for current season"""
    user_id = user["id"]
    season = await get_current_season()
    
    # Get user's battle pass record
    user_bp = await db.battle_pass_users.find_one({
        "user_id": user_id,
        "season_id": season["id"]
    }, {"_id": 0})
    
    if not user_bp:
        user_bp = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "season_id": season["id"],
            "current_xp": 0,
            "current_tier": 0,
            "has_premium": False,
            "claimed_free": [],
            "claimed_premium": [],
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.battle_pass_users.insert_one(user_bp)
    
    # Calculate time remaining
    end_date = datetime.fromisoformat(season["end_date"].replace('Z', '+00:00'))
    now = datetime.now(timezone.utc)
    seconds_remaining = max(0, int((end_date - now).total_seconds()))
    days_remaining = seconds_remaining // 86400
    
    # Calculate XP progress in current tier
    current_xp = user_bp.get("current_xp", 0)
    current_tier = current_xp // XP_PER_TIER
    xp_in_tier = current_xp % XP_PER_TIER
    xp_progress_percent = (xp_in_tier / XP_PER_TIER) * 100
    
    return {
        "season": {
            "id": season["id"],
            "name": season["name"],
            "theme": season["theme"],
            "season_number": season["season_number"],
            "days_remaining": days_remaining,
            "seconds_remaining": seconds_remaining,
            "end_date": season["end_date"]
        },
        "user_progress": {
            "current_tier": min(current_tier, MAX_TIER),
            "current_xp": current_xp,
            "xp_in_tier": xp_in_tier,
            "xp_to_next_tier": XP_PER_TIER - xp_in_tier if current_tier < MAX_TIER else 0,
            "xp_progress_percent": xp_progress_percent,
            "has_premium": user_bp.get("has_premium", False),
            "claimed_free": user_bp.get("claimed_free", []),
            "claimed_premium": user_bp.get("claimed_premium", [])
        },
        "rewards": season.get("rewards", SEASON_REWARDS),
        "max_tier": MAX_TIER,
        "xp_per_tier": XP_PER_TIER,
        "prices": {
            "premium": BATTLE_PASS_PRICE,
            "premium_plus": BATTLE_PASS_PREMIUM_PLUS_PRICE
        }
    }

@router.post("/purchase")
async def purchase_battle_pass(
    premium_plus: bool = False,
    user: dict = Depends(get_current_user)
):
    """Purchase the battle pass"""
    if not STRIPE_API_KEY:
        raise HTTPException(status_code=503, detail="Zahlungsdienst nicht verfügbar")
    
    season = await get_current_season()
    user_id = user["id"]
    
    # Check if already has premium
    user_bp = await db.battle_pass_users.find_one({
        "user_id": user_id,
        "season_id": season["id"]
    })
    
    if user_bp and user_bp.get("has_premium"):
        raise HTTPException(status_code=400, detail="Du hast bereits den Battle Pass!")
    
    price = BATTLE_PASS_PREMIUM_PLUS_PRICE if premium_plus else BATTLE_PASS_PRICE
    product_name = "Battle Pass Premium+" if premium_plus else "Battle Pass Premium"
    
    try:
        session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[{
                'price_data': {
                    'currency': 'eur',
                    'product_data': {
                        'name': f"🎖️ {product_name} - {season['name']}",
                        'description': f"Schalte alle Premium-Belohnungen frei!" + (" +25 Tier-Skips!" if premium_plus else "")
                    },
                    'unit_amount': int(price * 100)
                },
                'quantity': 1
            }],
            mode='payment',
            success_url=f"{FRONTEND_URL}/battle-pass?purchased=true",
            cancel_url=f"{FRONTEND_URL}/battle-pass",
            metadata={
                'type': 'battle_pass',
                'user_id': user_id,
                'season_id': season["id"],
                'premium_plus': str(premium_plus)
            }
        )
        
        return {"checkout_url": session.url, "session_id": session.id}
        
    except stripe.error.StripeError as e:
        logger.error(f"Battle Pass Stripe error: {e}")
        raise HTTPException(status_code=500, detail="Zahlungsfehler")

@router.post("/claim/{tier}")
async def claim_tier_reward(
    tier: int,
    track: str = "free",  # "free" or "premium"
    user: dict = Depends(get_current_user)
):
    """Claim reward for a specific tier"""
    user_id = user["id"]
    season = await get_current_season()
    
    if tier < 1 or tier > MAX_TIER:
        raise HTTPException(status_code=400, detail="Ungültiger Tier")
    
    user_bp = await db.battle_pass_users.find_one({
        "user_id": user_id,
        "season_id": season["id"]
    })
    
    if not user_bp:
        raise HTTPException(status_code=404, detail="Battle Pass nicht gefunden")
    
    current_tier = user_bp.get("current_xp", 0) // XP_PER_TIER
    
    if tier > current_tier:
        raise HTTPException(status_code=400, detail="Tier noch nicht erreicht")
    
    # Check track access
    if track == "premium" and not user_bp.get("has_premium"):
        raise HTTPException(status_code=403, detail="Premium-Pass erforderlich")
    
    # Check if already claimed
    claimed_list = user_bp.get(f"claimed_{track}", [])
    if tier in claimed_list:
        raise HTTPException(status_code=400, detail="Bereits abgeholt")
    
    # Get reward
    tier_rewards = season.get("rewards", SEASON_REWARDS)
    reward_data = tier_rewards[tier - 1] if tier <= len(tier_rewards) else None
    reward = reward_data.get(track) if reward_data else None
    
    if not reward:
        raise HTTPException(status_code=404, detail="Keine Belohnung für diesen Tier/Track")
    
    # Apply reward
    reward_message = await apply_reward(user_id, reward)
    
    # Mark as claimed
    claimed_list.append(tier)
    await db.battle_pass_users.update_one(
        {"id": user_bp["id"]},
        {"$set": {f"claimed_{track}": claimed_list}}
    )
    
    logger.info(f"Battle Pass reward claimed: {user_id} - Tier {tier} ({track})")
    
    return {
        "message": reward_message,
        "reward": reward,
        "tier": tier,
        "track": track
    }

async def apply_reward(user_id: str, reward: dict) -> str:
    """Apply a battle pass reward to user"""
    reward_type = reward.get("type")
    amount = reward.get("amount", 0)
    
    if reward_type == "bids":
        await db.users.update_one(
            {"id": user_id},
            {"$inc": {"bids_balance": amount}}
        )
        return f"+{amount} Gebote erhalten!"
    
    elif reward_type == "xp_boost":
        # Set XP boost
        until = (datetime.now(timezone.utc) + timedelta(hours=reward.get("duration_hours", 24))).isoformat()
        await db.users.update_one(
            {"id": user_id},
            {"$set": {"xp_boost_until": until, "xp_boost_multiplier": amount}}
        )
        return f"{amount}x XP-Boost aktiviert!"
    
    elif reward_type == "wheel_spin":
        await db.users.update_one(
            {"id": user_id},
            {"$inc": {"bonus_wheel_spins": amount}}
        )
        return f"+{amount} Bonus Glücksrad-Spin!"
    
    elif reward_type == "vip_days":
        until = (datetime.now(timezone.utc) + timedelta(days=amount)).isoformat()
        await db.users.update_one(
            {"id": user_id},
            {"$set": {"is_vip": True, "vip_until": until}}
        )
        return f"{amount} Tage VIP-Status aktiviert!"
    
    elif reward_type == "mega_bundle":
        bids = reward.get("bids", 0)
        vip_days = reward.get("vip_days", 0)
        until = (datetime.now(timezone.utc) + timedelta(days=vip_days)).isoformat()
        await db.users.update_one(
            {"id": user_id},
            {
                "$inc": {"bids_balance": bids},
                "$set": {"is_vip": True, "vip_until": until}
            }
        )
        return f"🎉 MEGA BUNDLE: +{bids} Gebote + {vip_days} Tage VIP!"
    
    return "Belohnung erhalten!"

# ==================== XP EARNING ====================

async def award_battle_pass_xp(user_id: str, xp_amount: int, reason: str = ""):
    """Award XP to user's battle pass"""
    season = await get_current_season()
    
    result = await db.battle_pass_users.find_one_and_update(
        {"user_id": user_id, "season_id": season["id"]},
        {
            "$inc": {"current_xp": xp_amount},
            "$setOnInsert": {
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "season_id": season["id"],
                "has_premium": False,
                "claimed_free": [],
                "claimed_premium": [],
                "created_at": datetime.now(timezone.utc).isoformat()
            }
        },
        upsert=True,
        return_document=True
    )
    
    old_tier = (result.get("current_xp", 0) - xp_amount) // XP_PER_TIER
    new_tier = result.get("current_xp", 0) // XP_PER_TIER
    
    if new_tier > old_tier and new_tier <= MAX_TIER:
        # Tier up notification
        await db.notifications.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "type": "battle_pass_tier_up",
            "title": f"🎖️ Tier {new_tier} erreicht!",
            "message": "Hol dir deine Belohnung im Battle Pass ab!",
            "action_url": "/battle-pass",
            "read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    logger.info(f"Battle Pass XP: {user_id} +{xp_amount} XP ({reason})")
    return xp_amount

# ==================== WEBHOOK ====================

@router.post("/webhook/stripe")
async def battle_pass_webhook(request_body: dict):
    """Handle Stripe webhook for battle pass purchases"""
    event_type = request_body.get("type")
    data = request_body.get("data", {}).get("object", {})
    
    if event_type == "checkout.session.completed":
        metadata = data.get("metadata", {})
        
        if metadata.get("type") == "battle_pass":
            user_id = metadata.get("user_id")
            season_id = metadata.get("season_id")
            premium_plus = metadata.get("premium_plus") == "True"
            
            # Activate premium
            update = {"has_premium": True, "purchased_at": datetime.now(timezone.utc).isoformat()}
            
            # Premium+ includes 25 tier skips (2500 XP)
            if premium_plus:
                update["current_xp"] = 2500  # 25 tiers
            
            await db.battle_pass_users.update_one(
                {"user_id": user_id, "season_id": season_id},
                {"$set": update},
                upsert=True
            )
            
            logger.info(f"Battle Pass purchased: {user_id} (premium_plus={premium_plus})")

# ==================== ADMIN ====================

@router.post("/admin/new-season")
async def create_new_season(
    name: str,
    duration_days: int = 30,
    admin: dict = Depends(get_current_admin)
):
    """Create a new battle pass season"""
    # Deactivate current season
    await db.battle_pass_seasons.update_many(
        {"is_active": True},
        {"$set": {"is_active": False}}
    )
    
    now = datetime.now(timezone.utc)
    season_num = await db.battle_pass_seasons.count_documents({}) + 1
    
    season = {
        "id": str(uuid.uuid4()),
        "season_number": season_num,
        "name": name,
        "theme": get_season_theme(season_num),
        "start_date": now.isoformat(),
        "end_date": (now + timedelta(days=duration_days)).isoformat(),
        "max_tier": MAX_TIER,
        "xp_per_tier": XP_PER_TIER,
        "rewards": SEASON_REWARDS,
        "is_active": True,
        "created_by": admin["id"],
        "created_at": now.isoformat()
    }
    
    await db.battle_pass_seasons.insert_one(season)
    
    return {"season": season, "message": "Neue Saison gestartet!"}

@router.get("/admin/stats")
async def get_battle_pass_stats(admin: dict = Depends(get_current_admin)):
    """Get battle pass statistics"""
    season = await get_current_season()
    
    total_users = await db.battle_pass_users.count_documents({"season_id": season["id"]})
    premium_users = await db.battle_pass_users.count_documents({
        "season_id": season["id"],
        "has_premium": True
    })
    
    # Average tier
    pipeline = [
        {"$match": {"season_id": season["id"]}},
        {"$group": {"_id": None, "avg_xp": {"$avg": "$current_xp"}}}
    ]
    avg_result = await db.battle_pass_users.aggregate(pipeline).to_list(1)
    avg_xp = avg_result[0]["avg_xp"] if avg_result else 0
    avg_tier = int(avg_xp // XP_PER_TIER)
    
    return {
        "season": season["name"],
        "total_users": total_users,
        "premium_users": premium_users,
        "conversion_rate": (premium_users / total_users * 100) if total_users > 0 else 0,
        "average_tier": avg_tier
    }

__all__ = ['award_battle_pass_xp']
