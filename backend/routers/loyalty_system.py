"""
Customer Loyalty & Referral System
VIP Tiers, Cashback, Referrals, Digital Wallet Card
"""

from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone, timedelta
from config import db, logger
import uuid
import jwt
import os

router = APIRouter(prefix="/api/loyalty", tags=["Loyalty & Referrals"])

JWT_SECRET = os.environ.get("JWT_SECRET", "your-secret-key-change-in-production")

# ==================== VIP TIER DEFINITIONS ====================

VIP_TIERS = {
    "bronze": {
        "name": "Bronze",
        "min_spent": 0,
        "cashback_percent": 1.0,
        "points_multiplier": 1.0,
        "benefits": ["Basis-Cashback 1%", "Treue-Punkte sammeln"]
    },
    "silver": {
        "name": "Silber",
        "min_spent": 100,
        "cashback_percent": 2.0,
        "points_multiplier": 1.5,
        "benefits": ["2% Cashback", "1.5x Punkte", "Geburtstagsbonus"]
    },
    "gold": {
        "name": "Gold",
        "min_spent": 500,
        "cashback_percent": 3.0,
        "points_multiplier": 2.0,
        "benefits": ["3% Cashback", "2x Punkte", "Exklusive Auktionen", "Priority Support"]
    },
    "platinum": {
        "name": "Platin",
        "min_spent": 1000,
        "cashback_percent": 5.0,
        "points_multiplier": 3.0,
        "benefits": ["5% Cashback", "3x Punkte", "VIP Auktionen", "Persönlicher Berater", "Kostenlose Lieferung"]
    }
}

# ==================== HELPERS ====================

async def get_user(authorization: Optional[str] = Header(None)):
    """Get user from token"""
    if not authorization:
        raise HTTPException(status_code=401, detail="Login required")
    
    try:
        token = authorization.replace("Bearer ", "")
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        user_id = payload.get("user_id")
        
        user = await db.users.find_one({"id": user_id})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except:
        raise HTTPException(status_code=401, detail="Invalid token")

def calculate_tier(total_spent: float) -> str:
    """Bestimme VIP-Stufe basierend auf Ausgaben"""
    if total_spent >= 1000:
        return "platinum"
    elif total_spent >= 500:
        return "gold"
    elif total_spent >= 100:
        return "silver"
    return "bronze"

# ==================== VIP STATUS ====================

@router.get("/status")
async def get_loyalty_status(user = Depends(get_user)):
    """Aktuellen VIP-Status und Punkte abrufen"""
    user_id = user["id"]
    
    # Loyalty-Daten abrufen oder erstellen
    loyalty = await db.user_loyalty.find_one({"user_id": user_id}, {"_id": 0})
    
    if not loyalty:
        loyalty = {
            "user_id": user_id,
            "points": 0,
            "total_spent": 0,
            "tier": "bronze",
            "cashback_earned": 0,
            "referral_count": 0,
            "referral_code": f"REF-{user_id[:8].upper()}",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.user_loyalty.insert_one(loyalty)
    
    tier_info = VIP_TIERS.get(loyalty.get("tier", "bronze"), VIP_TIERS["bronze"])
    
    # Nächste Stufe berechnen
    current_spent = loyalty.get("total_spent", 0)
    next_tier = None
    amount_to_next = 0
    
    if loyalty["tier"] == "bronze":
        next_tier = "silver"
        amount_to_next = 100 - current_spent
    elif loyalty["tier"] == "silver":
        next_tier = "gold"
        amount_to_next = 500 - current_spent
    elif loyalty["tier"] == "gold":
        next_tier = "platinum"
        amount_to_next = 1000 - current_spent
    
    return {
        "tier": loyalty.get("tier", "bronze"),
        "tier_name": tier_info["name"],
        "points": loyalty.get("points", 0),
        "total_spent": loyalty.get("total_spent", 0),
        "cashback_percent": tier_info["cashback_percent"],
        "points_multiplier": tier_info["points_multiplier"],
        "benefits": tier_info["benefits"],
        "cashback_earned": loyalty.get("cashback_earned", 0),
        "referral_code": loyalty.get("referral_code"),
        "referral_count": loyalty.get("referral_count", 0),
        "next_tier": next_tier,
        "amount_to_next_tier": max(0, amount_to_next) if next_tier else None,
        "all_tiers": VIP_TIERS
    }

@router.get("/points/history")
async def get_points_history(user = Depends(get_user)):
    """Punkte-Verlauf"""
    history = await db.points_history.find(
        {"user_id": user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return {"history": history}

@router.post("/points/redeem")
async def redeem_points(points: int, user = Depends(get_user)):
    """Punkte einlösen für Guthaben"""
    user_id = user["id"]
    
    loyalty = await db.user_loyalty.find_one({"user_id": user_id})
    if not loyalty or loyalty.get("points", 0) < points:
        raise HTTPException(status_code=400, detail="Nicht genügend Punkte")
    
    # 100 Punkte = 1€
    euro_value = points / 100
    
    # Punkte abziehen
    await db.user_loyalty.update_one(
        {"user_id": user_id},
        {"$inc": {"points": -points}}
    )
    
    # Guthaben hinzufügen
    await db.users.update_one(
        {"id": user_id},
        {"$inc": {"wallet_balance": euro_value}}
    )
    
    # History
    await db.points_history.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "type": "redemption",
        "points": -points,
        "euro_value": euro_value,
        "description": f"{points} Punkte eingelöst für €{euro_value:.2f}",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {
        "success": True,
        "points_redeemed": points,
        "euro_credited": euro_value,
        "message": f"€{euro_value:.2f} wurden Ihrem Guthaben gutgeschrieben"
    }

# ==================== CASHBACK ====================

@router.get("/cashback/history")
async def get_cashback_history(user = Depends(get_user)):
    """Cashback-Verlauf"""
    history = await db.cashback_history.find(
        {"user_id": user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    total = sum(h.get("amount", 0) for h in history)
    
    return {
        "history": history,
        "total_earned": total
    }

# ==================== REFERRAL SYSTEM ====================

@router.get("/referral")
async def get_referral_info(user = Depends(get_user)):
    """Empfehlungs-Info und Code"""
    loyalty = await db.user_loyalty.find_one({"user_id": user["id"]}, {"_id": 0})
    
    referral_code = loyalty.get("referral_code") if loyalty else f"REF-{user['id'][:8].upper()}"
    
    # Geworbene Nutzer
    referrals = await db.referrals.find(
        {"referrer_id": user["id"]},
        {"_id": 0}
    ).to_list(100)
    
    total_bonus = sum(r.get("bonus_earned", 0) for r in referrals)
    
    return {
        "referral_code": referral_code,
        "referral_link": f"https://bidblitz.ae/register?ref={referral_code}",
        "total_referrals": len(referrals),
        "total_bonus_earned": total_bonus,
        "bonus_per_referral": 5.0,  # €5 pro Empfehlung
        "bonus_for_referred": 2.0,  # €2 für den Geworbenen
        "referrals": referrals
    }

@router.post("/referral/apply")
async def apply_referral_code(code: str, user = Depends(get_user)):
    """Empfehlungscode einlösen"""
    user_id = user["id"]
    
    # Prüfen ob User bereits einen Code eingelöst hat
    existing = await db.referrals.find_one({"referred_id": user_id})
    if existing:
        raise HTTPException(status_code=400, detail="Sie haben bereits einen Empfehlungscode eingelöst")
    
    # Referrer finden
    referrer_loyalty = await db.user_loyalty.find_one({"referral_code": code.upper()})
    if not referrer_loyalty:
        raise HTTPException(status_code=404, detail="Ungültiger Empfehlungscode")
    
    referrer_id = referrer_loyalty["user_id"]
    
    if referrer_id == user_id:
        raise HTTPException(status_code=400, detail="Sie können nicht Ihren eigenen Code verwenden")
    
    # Bonus für Referrer (€5)
    await db.users.update_one(
        {"id": referrer_id},
        {"$inc": {"wallet_balance": 5.0}}
    )
    
    # Bonus für neuen User (€2)
    await db.users.update_one(
        {"id": user_id},
        {"$inc": {"wallet_balance": 2.0}}
    )
    
    # Referral-Count erhöhen
    await db.user_loyalty.update_one(
        {"user_id": referrer_id},
        {"$inc": {"referral_count": 1}}
    )
    
    # Referral speichern
    await db.referrals.insert_one({
        "id": str(uuid.uuid4()),
        "referrer_id": referrer_id,
        "referred_id": user_id,
        "code": code.upper(),
        "bonus_earned": 5.0,
        "referred_bonus": 2.0,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {
        "success": True,
        "bonus_received": 2.0,
        "message": "€2.00 Willkommensbonus wurden gutgeschrieben!"
    }

# ==================== DIGITAL WALLET CARD ====================

@router.get("/wallet-card")
async def get_digital_wallet_card(user = Depends(get_user)):
    """Digitale Kundenkarte für Apple/Google Wallet"""
    user_id = user["id"]
    
    loyalty = await db.user_loyalty.find_one({"user_id": user_id}, {"_id": 0})
    tier = loyalty.get("tier", "bronze") if loyalty else "bronze"
    points = loyalty.get("points", 0) if loyalty else 0
    
    # Barcode/QR für die Karte
    customer_number = user.get("customer_number") or f"BID-{user_id[:8].upper()}"
    
    return {
        "card_type": "loyalty",
        "customer_number": customer_number,
        "customer_name": user.get("name", "Kunde"),
        "tier": tier,
        "tier_name": VIP_TIERS.get(tier, {}).get("name", "Bronze"),
        "points": points,
        "balance": user.get("wallet_balance", 0) + user.get("balance", 0),
        "barcode": customer_number,
        "barcode_format": "CODE128",
        "qr_data": f"bidblitz://pay/{customer_number}",
        "background_color": {
            "bronze": "#CD7F32",
            "silver": "#C0C0C0",
            "gold": "#FFD700",
            "platinum": "#E5E4E2"
        }.get(tier, "#CD7F32"),
        "apple_wallet_url": f"/api/loyalty/wallet/apple/{user_id}",
        "google_wallet_url": f"/api/loyalty/wallet/google/{user_id}"
    }

# ==================== PROCESS TRANSACTION (Internal) ====================

async def process_loyalty_transaction(user_id: str, amount: float, merchant_id: str = None, transaction_type: str = "payment"):
    """
    Wird nach jeder Transaktion aufgerufen um:
    - Punkte zu vergeben
    - Cashback zu berechnen
    - VIP-Status zu aktualisieren
    - Provisions zu berechnen (für Händler)
    """
    try:
        # User-Loyalty abrufen oder erstellen
        loyalty = await db.user_loyalty.find_one({"user_id": user_id})
        
        if not loyalty:
            loyalty = {
                "user_id": user_id,
                "points": 0,
                "total_spent": 0,
                "tier": "bronze",
                "cashback_earned": 0,
                "referral_count": 0,
                "referral_code": f"REF-{user_id[:8].upper()}",
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.user_loyalty.insert_one(loyalty)
        
        tier = loyalty.get("tier", "bronze")
        tier_info = VIP_TIERS.get(tier, VIP_TIERS["bronze"])
        
        # Punkte berechnen (10 Punkte pro Euro * Multiplier)
        base_points = int(amount * 10)
        points_earned = int(base_points * tier_info["points_multiplier"])
        
        # Cashback berechnen
        cashback = amount * (tier_info["cashback_percent"] / 100)
        cashback = min(cashback, 10.0)  # Max €10 Cashback pro Transaktion
        
        # Update Loyalty
        new_total_spent = loyalty.get("total_spent", 0) + amount
        new_tier = calculate_tier(new_total_spent)
        
        await db.user_loyalty.update_one(
            {"user_id": user_id},
            {
                "$inc": {
                    "points": points_earned,
                    "total_spent": amount,
                    "cashback_earned": cashback
                },
                "$set": {
                    "tier": new_tier,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        
        # Cashback zum Guthaben hinzufügen
        if cashback > 0:
            await db.users.update_one(
                {"id": user_id},
                {"$inc": {"wallet_balance": cashback}}
            )
            
            await db.cashback_history.insert_one({
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "amount": cashback,
                "transaction_amount": amount,
                "tier": tier,
                "merchant_id": merchant_id,
                "created_at": datetime.now(timezone.utc).isoformat()
            })
        
        # Punkte-History
        await db.points_history.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "type": "earned",
            "points": points_earned,
            "transaction_amount": amount,
            "multiplier": tier_info["points_multiplier"],
            "description": f"+{points_earned} Punkte für €{amount:.2f} Einkauf",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        # Tier-Upgrade prüfen
        if new_tier != tier:
            logger.info(f"User {user_id} upgraded from {tier} to {new_tier}")
            # Hier könnte eine Benachrichtigung gesendet werden
        
        # Händler-Provision (wenn Händler)
        if merchant_id:
            commission = amount * 0.05  # 5% Provision
            await db.merchant_commissions.insert_one({
                "id": str(uuid.uuid4()),
                "merchant_id": merchant_id,
                "user_id": user_id,
                "amount": commission,
                "transaction_amount": amount,
                "status": "pending",
                "created_at": datetime.now(timezone.utc).isoformat()
            })
        
        return {
            "points_earned": points_earned,
            "cashback": cashback,
            "new_tier": new_tier,
            "tier_changed": new_tier != tier
        }
        
    except Exception as e:
        logger.error(f"Error processing loyalty: {e}")
        return None
