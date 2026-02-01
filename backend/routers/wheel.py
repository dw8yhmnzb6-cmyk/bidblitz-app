"""Wheel of Fortune / Lucky Spin Router"""
from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timedelta, timezone
import random
from config import db, logger
from dependencies import get_current_user

router = APIRouter(prefix="/wheel", tags=["wheel"])

# Prize configuration with probabilities
PRIZES = [
    {"type": "bids", "value": 1, "probability": 25},
    {"type": "bids", "value": 2, "probability": 20},
    {"type": "bids", "value": 3, "probability": 15},
    {"type": "bids", "value": 5, "probability": 10},
    {"type": "discount", "value": 10, "probability": 12},  # 10% discount code
    {"type": "vip_day", "value": 1, "probability": 5},      # 1 day VIP
    {"type": "retry", "value": 0, "probability": 8},        # Free retry
    {"type": "bids", "value": 10, "probability": 5},        # Jackpot: 10 bids
]

def select_prize():
    """Select a random prize based on probabilities"""
    total = sum(p["probability"] for p in PRIZES)
    r = random.uniform(0, total)
    
    cumulative = 0
    for prize in PRIZES:
        cumulative += prize["probability"]
        if r <= cumulative:
            return {"type": prize["type"], "value": prize["value"]}
    
    return PRIZES[0]  # Fallback


@router.get("/status")
async def get_spin_status(
    db=Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Check if user can spin today"""
    user_id = current_user["id"]
    
    # Get user's last spin
    spin_record = await db.wheel_spins.find_one(
        {"user_id": user_id},
        sort=[("created_at", -1)]
    )
    
    if not spin_record:
        return {"can_spin": True, "next_spin_time": None}
    
    last_spin = spin_record["created_at"]
    if isinstance(last_spin, str):
        last_spin = datetime.fromisoformat(last_spin.replace('Z', '+00:00'))
    
    # Check if 24 hours have passed
    now = datetime.now(timezone.utc)
    next_spin_time = last_spin + timedelta(hours=24)
    
    if now >= next_spin_time:
        return {"can_spin": True, "next_spin_time": None}
    
    return {
        "can_spin": False,
        "next_spin_time": next_spin_time.isoformat()
    }


@router.post("/spin")
async def spin_wheel(
    db=Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Spin the wheel and win a prize"""
    user_id = current_user["id"]
    
    # Check if user can spin
    status = await get_spin_status(db, current_user)
    if not status["can_spin"]:
        raise HTTPException(status_code=400, detail="Du hast heute schon gedreht! Komm morgen wieder.")
    
    # Select prize
    prize = select_prize()
    
    # Record the spin
    spin_record = {
        "user_id": user_id,
        "prize_type": prize["type"],
        "prize_value": prize["value"],
        "created_at": datetime.now(timezone.utc)
    }
    await db.wheel_spins.insert_one(spin_record)
    
    # Award the prize
    if prize["type"] == "bids":
        # Add bids to user's balance
        await db.users.update_one(
            {"id": user_id},
            {"$inc": {"bids_balance": prize["value"]}}
        )
        logger.info(f"🎰 Wheel: User {user_id} won {prize['value']} bids")
        
    elif prize["type"] == "discount":
        # Create a discount code for the user
        discount_code = f"WHEEL{user_id[:8].upper()}{random.randint(100, 999)}"
        await db.discount_codes.insert_one({
            "code": discount_code,
            "user_id": user_id,
            "discount_percent": prize["value"],
            "valid_until": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
            "used": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        prize["code"] = discount_code
        logger.info(f"🎰 Wheel: User {user_id} won {prize['value']}% discount code: {discount_code}")
        
    elif prize["type"] == "vip_day":
        # Add 1 day VIP
        user = await db.users.find_one({"id": user_id})
        current_vip_until = user.get("vip_until")
        
        if current_vip_until:
            if isinstance(current_vip_until, str):
                current_vip_until = datetime.fromisoformat(current_vip_until.replace('Z', '+00:00'))
            if current_vip_until > datetime.now(timezone.utc):
                new_vip_until = current_vip_until + timedelta(days=1)
            else:
                new_vip_until = datetime.now(timezone.utc) + timedelta(days=1)
        else:
            new_vip_until = datetime.now(timezone.utc) + timedelta(days=1)
        
        await db.users.update_one(
            {"id": user_id},
            {"$set": {"vip_until": new_vip_until.isoformat(), "is_vip": True}}
        )
        logger.info(f"🎰 Wheel: User {user_id} won 1 day VIP")
        
    elif prize["type"] == "retry":
        # Delete the spin record so user can spin again
        await db.wheel_spins.delete_one({"_id": spin_record.get("_id")})
        logger.info(f"🎰 Wheel: User {user_id} won a free retry")
    
    return {
        "success": True,
        "prize": prize,
        "message": f"Congratulations! You won: {prize['type']} - {prize['value']}"
    }


@router.get("/history")
async def get_spin_history(
    db=Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Get user's spin history"""
    user_id = current_user["id"]
    
    spins = await db.wheel_spins.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(30).to_list(30)
    
    return {"spins": spins}
