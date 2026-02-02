"""
Bieter-Bundles Router - Kombinierte Pakete für mehr Umsatz
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import os
import stripe
import uuid

from config import db
from dependencies import get_current_user

router = APIRouter(prefix="/bundles", tags=["bundles"])

# Stripe Setup
stripe.api_key = os.environ.get("STRIPE_SECRET_KEY")

# Bundle Definitionen
BUNDLES = {
    "starter": {
        "id": "starter",
        "name": "Starter Pack",
        "name_de": "Starter Paket",
        "description": "Perfect for beginners",
        "description_de": "Perfekt für Einsteiger",
        "bids": 50,
        "vip_days": 7,
        "battle_pass": False,
        "wheel_spins": 3,
        "price": 29.99,
        "original_price": 45.99,
        "savings_percent": 35,
        "color": "#10B981",
        "icon": "🌟",
        "popular": False
    },
    "pro": {
        "id": "pro",
        "name": "Pro Bundle",
        "name_de": "Pro Paket",
        "description": "Best value for regular bidders",
        "description_de": "Bestes Preis-Leistungs-Verhältnis",
        "bids": 150,
        "vip_days": 14,
        "battle_pass": True,
        "wheel_spins": 7,
        "price": 69.99,
        "original_price": 119.99,
        "savings_percent": 42,
        "color": "#8B5CF6",
        "icon": "🚀",
        "popular": True
    },
    "ultimate": {
        "id": "ultimate",
        "name": "Ultimate Pack",
        "name_de": "Ultimate Paket",
        "description": "Maximum value for power users",
        "description_de": "Maximaler Wert für Power-User",
        "bids": 500,
        "vip_days": 30,
        "battle_pass": True,
        "battle_pass_premium": True,
        "wheel_spins": 15,
        "price": 149.99,
        "original_price": 299.99,
        "savings_percent": 50,
        "color": "#F59E0B",
        "icon": "👑",
        "popular": False
    },
    "vip_yearly": {
        "id": "vip_yearly",
        "name": "VIP Annual",
        "name_de": "VIP Jahresabo",
        "description": "Full year VIP + monthly bids",
        "description_de": "Ganzes Jahr VIP + monatliche Gebote",
        "bids": 100,
        "bids_monthly": 25,
        "vip_days": 365,
        "battle_pass": True,
        "battle_pass_premium": True,
        "wheel_spins": 30,
        "price": 299.99,
        "original_price": 599.99,
        "savings_percent": 50,
        "color": "#EC4899",
        "icon": "💎",
        "popular": False,
        "is_subscription": True
    }
}


@router.get("/available")
async def get_available_bundles(user: dict = Depends(get_current_user)):
    """Get all available bundles with user-specific info"""
    bundles = []
    
    for bundle_id, bundle in BUNDLES.items():
        bundle_data = {**bundle}
        
        # Check if user already has VIP
        if user.get("is_vip"):
            bundle_data["user_has_vip"] = True
            
        # Check if user has battle pass
        user_pass = await db.user_battle_pass.find_one(
            {"user_id": user["id"]},
            {"_id": 0}
        )
        if user_pass and user_pass.get("has_premium"):
            bundle_data["user_has_battle_pass"] = True
            
        bundles.append(bundle_data)
    
    return {"bundles": bundles}


@router.post("/purchase/{bundle_id}")
async def purchase_bundle(bundle_id: str, user: dict = Depends(get_current_user)):
    """Create Stripe checkout for bundle purchase"""
    if bundle_id not in BUNDLES:
        raise HTTPException(status_code=404, detail="Bundle nicht gefunden")
    
    bundle = BUNDLES[bundle_id]
    
    # Create line items description
    items_desc = []
    items_desc.append(f"{bundle['bids']} Gebote")
    if bundle.get("vip_days"):
        items_desc.append(f"{bundle['vip_days']} Tage VIP")
    if bundle.get("battle_pass"):
        items_desc.append("Battle Pass" + (" Premium" if bundle.get("battle_pass_premium") else ""))
    if bundle.get("wheel_spins"):
        items_desc.append(f"{bundle['wheel_spins']} Glücksrad-Spins")
    
    frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")
    
    try:
        checkout_session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=[{
                "price_data": {
                    "currency": "eur",
                    "product_data": {
                        "name": bundle["name_de"],
                        "description": " + ".join(items_desc),
                    },
                    "unit_amount": int(bundle["price"] * 100),
                },
                "quantity": 1,
            }],
            mode="payment",
            success_url=f"{frontend_url}/bundles?success=true&bundle={bundle_id}",
            cancel_url=f"{frontend_url}/bundles?canceled=true",
            metadata={
                "user_id": user["id"],
                "bundle_id": bundle_id,
                "type": "bundle"
            }
        )
        
        return {"checkout_url": checkout_session.url, "session_id": checkout_session.id}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/fulfill/{bundle_id}")
async def fulfill_bundle(bundle_id: str, user: dict = Depends(get_current_user)):
    """Fulfill bundle after successful payment (called by webhook or success page)"""
    if bundle_id not in BUNDLES:
        raise HTTPException(status_code=404, detail="Bundle nicht gefunden")
    
    bundle = BUNDLES[bundle_id]
    now = datetime.now(timezone.utc)
    
    updates = {}
    rewards = []
    
    # Add bids
    if bundle.get("bids"):
        updates["$inc"] = {"bids_balance": bundle["bids"]}
        rewards.append(f"+{bundle['bids']} Gebote")
    
    # Add VIP days
    if bundle.get("vip_days"):
        current_vip_end = user.get("vip_expires_at")
        if current_vip_end:
            try:
                vip_end = datetime.fromisoformat(current_vip_end.replace('Z', '+00:00'))
                if vip_end > now:
                    new_vip_end = vip_end
                else:
                    new_vip_end = now
            except:
                new_vip_end = now
        else:
            new_vip_end = now
            
        from datetime import timedelta
        new_vip_end = new_vip_end + timedelta(days=bundle["vip_days"])
        
        updates["$set"] = updates.get("$set", {})
        updates["$set"]["is_vip"] = True
        updates["$set"]["vip_expires_at"] = new_vip_end.isoformat()
        updates["$set"]["vip_status"] = "premium" if bundle["vip_days"] >= 30 else "basic"
        rewards.append(f"+{bundle['vip_days']} Tage VIP")
    
    # Add wheel spins
    if bundle.get("wheel_spins"):
        updates["$inc"] = updates.get("$inc", {})
        updates["$inc"]["bonus_wheel_spins"] = bundle["wheel_spins"]
        rewards.append(f"+{bundle['wheel_spins']} Glücksrad-Spins")
    
    # Apply updates
    if updates:
        await db.users.update_one({"id": user["id"]}, updates)
    
    # Handle Battle Pass
    if bundle.get("battle_pass"):
        await db.user_battle_pass.update_one(
            {"user_id": user["id"]},
            {
                "$set": {
                    "has_premium": bundle.get("battle_pass_premium", False),
                    "purchased_at": now.isoformat()
                }
            },
            upsert=True
        )
        rewards.append("Battle Pass" + (" Premium" if bundle.get("battle_pass_premium") else ""))
    
    # Log purchase
    await db.bundle_purchases.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "bundle_id": bundle_id,
        "price": bundle["price"],
        "rewards": rewards,
        "purchased_at": now.isoformat()
    })
    
    return {
        "success": True,
        "message": f"{bundle['name_de']} aktiviert!",
        "rewards": rewards
    }


# Export router
bundles_router = router
