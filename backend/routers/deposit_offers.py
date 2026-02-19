"""
Deposit Bonus & Interest System
- Customer deposit bonuses
- Partner commissions on deposits
- Fixed interest rates up to 5% p.a.
"""

from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel, Field
from datetime import datetime, timezone, timedelta
from typing import Optional, List
import uuid
from config import db
from utils.auth import get_current_user
from utils.email import send_interest_payout_notification

router = APIRouter(prefix="/deposit-offers", tags=["Deposit Offers"])


# ==================== MODELS ====================

class DepositOffer(BaseModel):
    """Deposit offer/promotion"""
    name: str = Field(..., description="Offer name")
    min_amount: float = Field(..., ge=5, description="Minimum deposit amount")
    max_amount: Optional[float] = Field(None, description="Maximum deposit amount")
    bonus_type: str = Field(..., description="'percentage' or 'fixed'")
    bonus_value: float = Field(..., ge=0, description="Bonus value (% or fixed €)")
    partner_commission: float = Field(0, ge=0, le=20, description="Partner commission %")
    interest_rate: float = Field(0, ge=0, le=5, description="Annual interest rate %")
    lock_days: int = Field(0, ge=0, description="Days the deposit is locked")
    is_active: bool = Field(True)
    valid_until: Optional[str] = Field(None, description="Offer expiry date")


class CustomerDeposit(BaseModel):
    """Customer deposit request"""
    offer_id: str = Field(..., description="Deposit offer ID")
    amount: float = Field(..., gt=0, description="Deposit amount")
    partner_id: Optional[str] = Field(None, description="Partner who facilitated deposit")


# ==================== DEPOSIT OFFERS (ADMIN) ====================

# Default deposit offers
DEFAULT_OFFERS = [
    {
        "id": "offer-starter",
        "name": "Starter Bonus",
        "name_de": "Starter Bonus",
        "name_en": "Starter Bonus",
        "name_sq": "Bonus Fillestar",
        "description_de": "5% Bonus + 2% Zinsen p.a.",
        "description_en": "5% Bonus + 2% Interest p.a.",
        "description_sq": "5% Bonus + 2% Interes vjetor",
        "min_amount": 10,
        "max_amount": 100,
        "bonus_type": "percentage",
        "bonus_value": 5,
        "partner_commission": 2,
        "interest_rate": 2,
        "lock_days": 30,
        "badge": "BELIEBT",
        "badge_color": "blue",
        "is_active": True
    },
    {
        "id": "offer-standard",
        "name": "Standard Bonus",
        "name_de": "Standard Bonus",
        "name_en": "Standard Bonus",
        "name_sq": "Bonus Standard",
        "description_de": "10% Bonus + 3% Zinsen p.a.",
        "description_en": "10% Bonus + 3% Interest p.a.",
        "description_sq": "10% Bonus + 3% Interes vjetor",
        "min_amount": 100,
        "max_amount": 500,
        "bonus_type": "percentage",
        "bonus_value": 10,
        "partner_commission": 3,
        "interest_rate": 3,
        "lock_days": 60,
        "badge": "EMPFOHLEN",
        "badge_color": "green",
        "is_active": True
    },
    {
        "id": "offer-premium",
        "name": "Premium Bonus",
        "name_de": "Premium Bonus",
        "name_en": "Premium Bonus",
        "name_sq": "Bonus Premium",
        "description_de": "15% Bonus + 4% Zinsen p.a.",
        "description_en": "15% Bonus + 4% Interest p.a.",
        "description_sq": "15% Bonus + 4% Interes vjetor",
        "min_amount": 500,
        "max_amount": 2000,
        "bonus_type": "percentage",
        "bonus_value": 15,
        "partner_commission": 4,
        "interest_rate": 4,
        "lock_days": 90,
        "badge": "TOP",
        "badge_color": "orange",
        "is_active": True
    },
    {
        "id": "offer-vip",
        "name": "VIP Bonus",
        "name_de": "VIP Bonus",
        "name_en": "VIP Bonus",
        "name_sq": "Bonus VIP",
        "description_de": "20% Bonus + 5% Zinsen p.a.",
        "description_en": "20% Bonus + 5% Interest p.a.",
        "description_sq": "20% Bonus + 5% Interes vjetor",
        "min_amount": 2000,
        "max_amount": None,
        "bonus_type": "percentage",
        "bonus_value": 20,
        "partner_commission": 5,
        "interest_rate": 5,
        "lock_days": 180,
        "badge": "VIP",
        "badge_color": "gold",
        "is_active": True
    }
]


@router.get("/offers")
async def get_deposit_offers(language: str = Query("de")):
    """Get all active deposit offers"""
    # Check if offers exist in DB, otherwise use defaults
    offers = await db.deposit_offers.find({"is_active": True}, {"_id": 0}).to_list(100)
    
    if not offers:
        # Initialize with default offers
        for offer in DEFAULT_OFFERS:
            offer["created_at"] = datetime.now(timezone.utc).isoformat()
            await db.deposit_offers.update_one(
                {"id": offer["id"]},
                {"$set": offer},
                upsert=True
            )
        offers = DEFAULT_OFFERS
    
    # Localize names/descriptions
    for offer in offers:
        offer["name"] = offer.get(f"name_{language}", offer.get("name_de", offer.get("name", "")))
        offer["description"] = offer.get(f"description_{language}", offer.get("description_de", ""))
    
    return {"offers": offers}


@router.post("/admin/offer")
async def create_deposit_offer(
    offer: DepositOffer,
    user: dict = Depends(get_current_user)
):
    """Admin: Create a new deposit offer"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Nur Admins")
    
    offer_id = f"offer-{str(uuid.uuid4())[:8]}"
    doc = {
        "id": offer_id,
        **offer.dict(),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user.get("id")
    }
    
    await db.deposit_offers.insert_one(doc)
    
    return {"success": True, "offer_id": offer_id}


@router.put("/admin/offer/{offer_id}")
async def update_deposit_offer(
    offer_id: str,
    offer: DepositOffer,
    user: dict = Depends(get_current_user)
):
    """Admin: Update a deposit offer"""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Nur Admins")
    
    result = await db.deposit_offers.update_one(
        {"id": offer_id},
        {"$set": {**offer.dict(), "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Angebot nicht gefunden")
    
    return {"success": True}


# ==================== CUSTOMER DEPOSITS ====================

@router.post("/deposit")
async def make_deposit(
    data: CustomerDeposit,
    user: dict = Depends(get_current_user)
):
    """Customer makes a deposit with bonus"""
    user_id = user.get("id")
    
    # Get offer details
    offer = await db.deposit_offers.find_one({"id": data.offer_id, "is_active": True}, {"_id": 0})
    if not offer:
        raise HTTPException(status_code=404, detail="Angebot nicht gefunden oder abgelaufen")
    
    # Validate amount
    if data.amount < offer.get("min_amount", 0):
        raise HTTPException(status_code=400, detail=f"Mindestbetrag: €{offer.get('min_amount')}")
    
    if offer.get("max_amount") and data.amount > offer.get("max_amount"):
        raise HTTPException(status_code=400, detail=f"Maximalbetrag: €{offer.get('max_amount')}")
    
    # Calculate bonus
    if offer.get("bonus_type") == "percentage":
        bonus = data.amount * (offer.get("bonus_value", 0) / 100)
    else:
        bonus = offer.get("bonus_value", 0)
    
    # Calculate partner commission
    partner_commission = 0
    if data.partner_id:
        partner_commission = data.amount * (offer.get("partner_commission", 0) / 100)
    
    # Calculate interest (annual, prorated)
    interest_rate = offer.get("interest_rate", 0)
    lock_days = offer.get("lock_days", 0)
    estimated_interest = data.amount * (interest_rate / 100) * (lock_days / 365)
    
    # Create deposit record
    deposit_id = f"DEP-{str(uuid.uuid4())[:8].upper()}"
    unlock_date = datetime.now(timezone.utc) + timedelta(days=lock_days)
    
    deposit_doc = {
        "id": deposit_id,
        "user_id": user_id,
        "offer_id": data.offer_id,
        "offer_name": offer.get("name", ""),
        "amount": data.amount,
        "bonus": bonus,
        "bonus_type": offer.get("bonus_type"),
        "bonus_value": offer.get("bonus_value"),
        "interest_rate": interest_rate,
        "estimated_interest": estimated_interest,
        "accrued_interest": 0,
        "partner_id": data.partner_id,
        "partner_commission": partner_commission,
        "lock_days": lock_days,
        "unlock_date": unlock_date.isoformat(),
        "status": "active",  # active, completed, withdrawn
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.customer_deposits.insert_one(deposit_doc)
    
    # Credit bonus to customer immediately
    total_credit = data.amount + bonus
    await db.users.update_one(
        {"id": user_id},
        {
            "$inc": {"balance": total_credit},
            "$push": {
                "deposit_history": {
                    "deposit_id": deposit_id,
                    "amount": data.amount,
                    "bonus": bonus,
                    "date": datetime.now(timezone.utc).isoformat()
                }
            }
        }
    )
    
    # Credit partner commission if applicable
    if data.partner_id and partner_commission > 0:
        # Find partner
        partner = await db.partner_accounts.find_one({"id": data.partner_id}, {"_id": 0})
        if not partner:
            partner = await db.restaurant_accounts.find_one({"id": data.partner_id}, {"_id": 0})
        
        if partner:
            collection = db.partner_accounts if await db.partner_accounts.find_one({"id": data.partner_id}) else db.restaurant_accounts
            await collection.update_one(
                {"id": data.partner_id},
                {
                    "$inc": {
                        "pending_payout": partner_commission,
                        "total_earned": partner_commission,
                        "deposit_commissions": partner_commission
                    },
                    "$push": {
                        "commission_history": {
                            "type": "deposit_commission",
                            "deposit_id": deposit_id,
                            "customer_id": user_id,
                            "amount": data.amount,
                            "commission": partner_commission,
                            "date": datetime.now(timezone.utc).isoformat()
                        }
                    }
                }
            )
    
    return {
        "success": True,
        "deposit_id": deposit_id,
        "amount": data.amount,
        "bonus": bonus,
        "total_credited": total_credit,
        "interest_rate": interest_rate,
        "estimated_interest": estimated_interest,
        "unlock_date": unlock_date.isoformat(),
        "partner_commission": partner_commission,
        "message": f"€{data.amount:.2f} + €{bonus:.2f} Bonus gutgeschrieben!"
    }


@router.get("/my-deposits")
async def get_my_deposits(user: dict = Depends(get_current_user)):
    """Get customer's deposit history with interest"""
    user_id = user.get("id")
    
    deposits = await db.customer_deposits.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Calculate current interest for each active deposit
    now = datetime.now(timezone.utc)
    total_deposited = 0
    total_bonus = 0
    total_interest = 0
    
    for deposit in deposits:
        total_deposited += deposit.get("amount", 0)
        total_bonus += deposit.get("bonus", 0)
        
        if deposit.get("status") == "active":
            created = datetime.fromisoformat(deposit.get("created_at").replace("Z", "+00:00"))
            days_elapsed = (now - created).days
            annual_rate = deposit.get("interest_rate", 0) / 100
            current_interest = deposit.get("amount", 0) * annual_rate * (days_elapsed / 365)
            deposit["accrued_interest"] = round(current_interest, 2)
            total_interest += current_interest
            
            # Check if unlocked
            unlock_date = datetime.fromisoformat(deposit.get("unlock_date").replace("Z", "+00:00"))
            deposit["is_unlocked"] = now >= unlock_date
            deposit["days_remaining"] = max(0, (unlock_date - now).days)
    
    return {
        "deposits": deposits,
        "summary": {
            "total_deposited": total_deposited,
            "total_bonus": total_bonus,
            "total_interest": round(total_interest, 2),
            "active_deposits": len([d for d in deposits if d.get("status") == "active"])
        }
    }


@router.post("/withdraw/{deposit_id}")
async def withdraw_deposit(
    deposit_id: str,
    user: dict = Depends(get_current_user)
):
    """Withdraw a matured deposit with interest"""
    user_id = user.get("id")
    
    deposit = await db.customer_deposits.find_one(
        {"id": deposit_id, "user_id": user_id},
        {"_id": 0}
    )
    
    if not deposit:
        raise HTTPException(status_code=404, detail="Einlage nicht gefunden")
    
    if deposit.get("status") != "active":
        raise HTTPException(status_code=400, detail="Einlage bereits abgehoben")
    
    # Check if unlocked
    unlock_date = datetime.fromisoformat(deposit.get("unlock_date").replace("Z", "+00:00"))
    now = datetime.now(timezone.utc)
    
    if now < unlock_date:
        days_remaining = (unlock_date - now).days
        raise HTTPException(
            status_code=400,
            detail=f"Einlage ist noch {days_remaining} Tage gesperrt"
        )
    
    # Calculate final interest
    created = datetime.fromisoformat(deposit.get("created_at").replace("Z", "+00:00"))
    days_elapsed = (now - created).days
    annual_rate = deposit.get("interest_rate", 0) / 100
    final_interest = deposit.get("amount", 0) * annual_rate * (days_elapsed / 365)
    
    # Credit interest to customer
    await db.users.update_one(
        {"id": user_id},
        {"$inc": {"balance": final_interest}}
    )
    
    # Update deposit status
    await db.customer_deposits.update_one(
        {"id": deposit_id},
        {
            "$set": {
                "status": "completed",
                "final_interest": final_interest,
                "completed_at": now.isoformat()
            }
        }
    )
    
    return {
        "success": True,
        "interest_earned": round(final_interest, 2),
        "message": f"€{final_interest:.2f} Zinsen gutgeschrieben!"
    }


# ==================== PARTNER DEPOSIT VIEW ====================

@router.get("/partner/stats")
async def get_partner_deposit_stats(token: str = Query(...)):
    """Get partner's deposit commission stats"""
    # Find partner by token
    partner = await db.partner_accounts.find_one({"auth_token": token}, {"_id": 0})
    if not partner:
        partner = await db.restaurant_accounts.find_one({"auth_token": token}, {"_id": 0})
    
    if not partner:
        raise HTTPException(status_code=401, detail="Ungültiger Token")
    
    partner_id = partner.get("id")
    
    # Get deposits facilitated by this partner
    deposits = await db.customer_deposits.find(
        {"partner_id": partner_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    total_deposits = sum(d.get("amount", 0) for d in deposits)
    total_commission = sum(d.get("partner_commission", 0) for d in deposits)
    
    return {
        "deposits": deposits,
        "stats": {
            "total_deposits": total_deposits,
            "total_commission": total_commission,
            "deposit_count": len(deposits),
            "commission_rate": partner.get("deposit_commission_rate", 0)
        }
    }


# ==================== INTEREST CALCULATION (CRON) ====================

@router.post("/calculate-interest")
async def calculate_daily_interest(
    admin_key: str = Query(...),
    send_emails: bool = Query(False, description="Send email notifications to customers")
):
    """Daily interest calculation (called by cron job)"""
    # Simple admin key check
    if admin_key != "bidblitz-interest-cron-2026":
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    now = datetime.now(timezone.utc)
    
    # Get all active deposits
    active_deposits = await db.customer_deposits.find(
        {"status": "active"},
        {"_id": 0}
    ).to_list(10000)
    
    total_interest_accrued = 0
    emails_sent = 0
    
    # Group deposits by customer for email consolidation
    customer_deposits = {}
    
    for deposit in active_deposits:
        annual_rate = deposit.get("interest_rate", 0) / 100
        daily_rate = annual_rate / 365
        
        # Calculate daily interest
        daily_interest = deposit.get("amount", 0) * daily_rate
        total_interest_accrued += daily_interest
        
        # Update accrued interest
        await db.customer_deposits.update_one(
            {"id": deposit.get("id")},
            {
                "$inc": {"accrued_interest": daily_interest},
                "$set": {"last_interest_calc": now.isoformat()}
            }
        )
        
        # Group for email
        customer_id = deposit.get("customer_id")
        if customer_id not in customer_deposits:
            customer_deposits[customer_id] = {
                "total_interest": 0,
                "deposits": []
            }
        customer_deposits[customer_id]["total_interest"] += daily_interest
        customer_deposits[customer_id]["deposits"].append(deposit)
    
    # Send email notifications if enabled
    if send_emails:
        for customer_id, data in customer_deposits.items():
            if data["total_interest"] > 0.0001:  # Only send if meaningful interest
                try:
                    # Get customer details
                    customer = await db.users.find_one(
                        {"id": customer_id},
                        {"_id": 0, "email": 1, "name": 1, "balance": 1}
                    )
                    if customer and customer.get("email"):
                        # Use the largest deposit for display
                        largest_deposit = max(data["deposits"], key=lambda d: d.get("amount", 0))
                        
                        await send_interest_payout_notification(
                            to_email=customer["email"],
                            user_name=customer.get("name", "Kunde"),
                            interest_amount=data["total_interest"],
                            deposit_amount=largest_deposit.get("amount", 0),
                            interest_rate=largest_deposit.get("interest_rate", 0),
                            total_balance=customer.get("balance", 0)
                        )
                        emails_sent += 1
                except Exception as e:
                    print(f"Error sending interest email to {customer_id}: {e}")
    
    return {
        "success": True,
        "deposits_processed": len(active_deposits),
        "total_interest_accrued": round(total_interest_accrued, 2),
        "emails_sent": emails_sent,
        "calculated_at": now.isoformat()
    }
