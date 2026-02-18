"""
Cashback System - Kunden erhalten Geld zurück bei Einkäufen bei Händlern
- Variabel: Jeder Händler kann eigenen Cashback-% setzen
- Standard: 3%, Premium: 5%, Aktionen: bis 10%
- Kosten: 40% BidBlitz, 60% Händler
- Auszahlung: Wallet oder Gebote
"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from pydantic import BaseModel
import uuid

from config import db, logger
from dependencies import get_current_user

router = APIRouter(prefix="/cashback", tags=["Cashback System"])

# Constants
DEFAULT_CASHBACK_RATE = 3.0  # 3% Standard
PREMIUM_CASHBACK_RATE = 5.0  # 5% für Premium-Händler
MAX_CASHBACK_RATE = 10.0     # 10% bei Aktionen
MIN_CASHBACK_RATE = 1.0      # Minimum 1%

# Cost split: 40% BidBlitz, 60% Händler
BIDBLITZ_SHARE = 0.40
MERCHANT_SHARE = 0.60

# Bid conversion rate (how many bids per €1 cashback)
BIDS_PER_EURO = 5  # €1 = 5 Gebote


class CashbackTransaction(BaseModel):
    merchant_id: str
    purchase_amount: float
    receipt_reference: Optional[str] = None
    notes: Optional[str] = None


class CashbackPayout(BaseModel):
    amount: float
    payout_type: str  # "wallet" or "bids"


class MerchantCashbackSettings(BaseModel):
    cashback_rate: float
    special_rate: Optional[float] = None
    special_rate_until: Optional[str] = None
    cashback_enabled: bool = True


# ==================== USER ENDPOINTS ====================

@router.get("/balance")
async def get_cashback_balance(user: dict = Depends(get_current_user)):
    """Holt das Cashback-Guthaben des Nutzers"""
    user_id = user["id"]
    
    # Get or create cashback account
    account = await db.cashback_accounts.find_one({"user_id": user_id})
    
    if not account:
        account = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "balance": 0,
            "total_earned": 0,
            "total_withdrawn": 0,
            "transactions_count": 0,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        await db.cashback_accounts.insert_one(account)
    
    return {
        "balance": account.get("balance", 0),
        "total_earned": account.get("total_earned", 0),
        "total_withdrawn": account.get("total_withdrawn", 0),
        "transactions_count": account.get("transactions_count", 0),
        "bids_conversion_rate": BIDS_PER_EURO
    }


@router.get("/merchants")
async def get_cashback_merchants(user: dict = Depends(get_current_user)):
    """Holt alle Händler mit Cashback-Raten"""
    # Get all partners with cashback enabled
    partners = await db.users.find({
        "role": "partner",
        "is_active": {"$ne": False}
    }, {"_id": 0, "password_hash": 0}).to_list(100)
    
    merchants = []
    for partner in partners:
        # Get cashback settings
        settings = await db.merchant_cashback_settings.find_one({"merchant_id": partner["id"]})
        
        # Determine cashback rate
        is_premium = partner.get("is_premium", False)
        base_rate = PREMIUM_CASHBACK_RATE if is_premium else DEFAULT_CASHBACK_RATE
        
        if settings:
            current_rate = settings.get("cashback_rate", base_rate)
            # Check for special rate
            special_until = settings.get("special_rate_until")
            if special_until and settings.get("special_rate"):
                if datetime.fromisoformat(special_until.replace('Z', '+00:00')) > datetime.now(timezone.utc):
                    current_rate = settings["special_rate"]
            cashback_enabled = settings.get("cashback_enabled", True)
        else:
            current_rate = base_rate
            cashback_enabled = True
        
        if cashback_enabled:
            merchants.append({
                "id": partner["id"],
                "business_name": partner.get("business_name", partner.get("name", "Unbekannt")),
                "category": partner.get("business_details", {}).get("category", "other"),
                "logo": partner.get("business_details", {}).get("logo"),
                "is_premium": is_premium,
                "cashback_rate": current_rate,
                "has_special_offer": settings.get("special_rate") is not None if settings else False
            })
    
    # Sort: Premium first, then by cashback rate
    merchants.sort(key=lambda x: (-x["is_premium"], -x["cashback_rate"]))
    
    return {
        "merchants": merchants,
        "total": len(merchants)
    }


@router.post("/earn")
async def earn_cashback(data: CashbackTransaction, user: dict = Depends(get_current_user)):
    """Cashback für einen Einkauf gutschreiben"""
    user_id = user["id"]
    
    if data.purchase_amount <= 0:
        raise HTTPException(status_code=400, detail="Ungültiger Einkaufsbetrag")
    
    # Get merchant
    merchant = await db.users.find_one({"id": data.merchant_id, "role": "partner"})
    if not merchant:
        raise HTTPException(status_code=404, detail="Händler nicht gefunden")
    
    # Get cashback rate
    settings = await db.merchant_cashback_settings.find_one({"merchant_id": data.merchant_id})
    is_premium = merchant.get("is_premium", False)
    base_rate = PREMIUM_CASHBACK_RATE if is_premium else DEFAULT_CASHBACK_RATE
    
    if settings:
        cashback_rate = settings.get("cashback_rate", base_rate)
        # Check for special rate
        special_until = settings.get("special_rate_until")
        if special_until and settings.get("special_rate"):
            if datetime.fromisoformat(special_until.replace('Z', '+00:00')) > datetime.now(timezone.utc):
                cashback_rate = settings["special_rate"]
        
        if not settings.get("cashback_enabled", True):
            raise HTTPException(status_code=400, detail="Cashback ist bei diesem Händler deaktiviert")
    else:
        cashback_rate = base_rate
    
    # Calculate cashback
    cashback_amount = round(data.purchase_amount * (cashback_rate / 100), 2)
    
    # Calculate cost split
    bidblitz_cost = round(cashback_amount * BIDBLITZ_SHARE, 2)
    merchant_cost = round(cashback_amount * MERCHANT_SHARE, 2)
    
    # Create transaction
    transaction_id = str(uuid.uuid4())
    transaction = {
        "id": transaction_id,
        "user_id": user_id,
        "merchant_id": data.merchant_id,
        "merchant_name": merchant.get("business_name", merchant.get("name")),
        "purchase_amount": data.purchase_amount,
        "cashback_rate": cashback_rate,
        "cashback_amount": cashback_amount,
        "bidblitz_cost": bidblitz_cost,
        "merchant_cost": merchant_cost,
        "receipt_reference": data.receipt_reference,
        "notes": data.notes,
        "status": "completed",
        "type": "earn",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.cashback_transactions.insert_one(transaction)
    
    # Update user's cashback account
    await db.cashback_accounts.update_one(
        {"user_id": user_id},
        {
            "$inc": {
                "balance": cashback_amount,
                "total_earned": cashback_amount,
                "transactions_count": 1
            },
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        },
        upsert=True
    )
    
    # Update merchant's cashback liability
    await db.merchant_cashback_liability.update_one(
        {"merchant_id": data.merchant_id},
        {
            "$inc": {
                "total_liability": merchant_cost,
                "transactions_count": 1
            },
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        },
        upsert=True
    )
    
    logger.info(f"Cashback earned: User {user_id} got €{cashback_amount} ({cashback_rate}%) from {merchant.get('business_name')}")
    
    return {
        "success": True,
        "message": f"€{cashback_amount:.2f} Cashback gutgeschrieben!",
        "cashback_amount": cashback_amount,
        "cashback_rate": cashback_rate,
        "purchase_amount": data.purchase_amount,
        "merchant_name": merchant.get("business_name"),
        "transaction_id": transaction_id
    }


@router.post("/payout")
async def payout_cashback(data: CashbackPayout, user: dict = Depends(get_current_user)):
    """Cashback auszahlen - auf Wallet oder als Gebote"""
    user_id = user["id"]
    
    if data.amount <= 0:
        raise HTTPException(status_code=400, detail="Ungültiger Betrag")
    
    if data.payout_type not in ["wallet", "bids"]:
        raise HTTPException(status_code=400, detail="Ungültiger Auszahlungstyp. Wähle 'wallet' oder 'bids'")
    
    # Get cashback account
    account = await db.cashback_accounts.find_one({"user_id": user_id})
    if not account or account.get("balance", 0) < data.amount:
        raise HTTPException(status_code=400, detail="Nicht genügend Cashback-Guthaben")
    
    transaction_id = str(uuid.uuid4())
    
    if data.payout_type == "wallet":
        # Transfer to BidBlitz Pay wallet
        wallet = await db.wallets.find_one({"user_id": user_id})
        if wallet:
            await db.wallets.update_one(
                {"user_id": user_id},
                {"$inc": {"balance": data.amount}}
            )
        else:
            await db.wallets.insert_one({
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "balance": data.amount,
                "created_at": datetime.now(timezone.utc).isoformat()
            })
        
        # Create wallet transaction
        await db.wallet_transactions.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "type": "cashback_payout",
            "amount": data.amount,
            "description": "Cashback-Auszahlung auf Wallet",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        payout_description = f"€{data.amount:.2f} auf Wallet überwiesen"
        
    else:  # bids
        # Convert to bids
        bids_amount = int(data.amount * BIDS_PER_EURO)
        
        # Add bids to user
        await db.users.update_one(
            {"id": user_id},
            {"$inc": {"bids": bids_amount}}
        )
        
        # Create bid transaction
        await db.bid_transactions.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "type": "cashback_conversion",
            "bids": bids_amount,
            "amount_spent": data.amount,
            "description": f"Cashback in {bids_amount} Gebote umgewandelt",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        payout_description = f"{bids_amount} Gebote erhalten (€{data.amount:.2f})"
    
    # Deduct from cashback balance
    await db.cashback_accounts.update_one(
        {"user_id": user_id},
        {
            "$inc": {
                "balance": -data.amount,
                "total_withdrawn": data.amount
            },
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    # Record payout transaction
    await db.cashback_transactions.insert_one({
        "id": transaction_id,
        "user_id": user_id,
        "type": "payout",
        "payout_type": data.payout_type,
        "amount": data.amount,
        "bids_received": int(data.amount * BIDS_PER_EURO) if data.payout_type == "bids" else None,
        "status": "completed",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    logger.info(f"Cashback payout: User {user_id} withdrew €{data.amount} as {data.payout_type}")
    
    return {
        "success": True,
        "message": payout_description,
        "amount": data.amount,
        "payout_type": data.payout_type,
        "bids_received": int(data.amount * BIDS_PER_EURO) if data.payout_type == "bids" else None
    }


@router.get("/history")
async def get_cashback_history(user: dict = Depends(get_current_user), limit: int = 50):
    """Holt die Cashback-Historie des Nutzers"""
    transactions = await db.cashback_transactions.find(
        {"user_id": user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return {
        "transactions": transactions,
        "count": len(transactions)
    }


# ==================== MERCHANT ENDPOINTS ====================

@router.get("/merchant/settings")
async def get_merchant_cashback_settings(user: dict = Depends(get_current_user)):
    """Händler: Eigene Cashback-Einstellungen abrufen"""
    if user.get("role") != "partner":
        raise HTTPException(status_code=403, detail="Nur für Händler")
    
    merchant_id = user["id"]
    settings = await db.merchant_cashback_settings.find_one(
        {"merchant_id": merchant_id},
        {"_id": 0}
    )
    
    is_premium = user.get("is_premium", False)
    default_rate = PREMIUM_CASHBACK_RATE if is_premium else DEFAULT_CASHBACK_RATE
    
    if not settings:
        settings = {
            "merchant_id": merchant_id,
            "cashback_rate": default_rate,
            "cashback_enabled": True,
            "special_rate": None,
            "special_rate_until": None
        }
    
    # Get liability
    liability = await db.merchant_cashback_liability.find_one(
        {"merchant_id": merchant_id},
        {"_id": 0}
    )
    
    return {
        "settings": settings,
        "default_rate": default_rate,
        "is_premium": is_premium,
        "min_rate": MIN_CASHBACK_RATE,
        "max_rate": MAX_CASHBACK_RATE,
        "merchant_share": int(MERCHANT_SHARE * 100),
        "liability": liability.get("total_liability", 0) if liability else 0
    }


@router.post("/merchant/settings")
async def update_merchant_cashback_settings(
    data: MerchantCashbackSettings,
    user: dict = Depends(get_current_user)
):
    """Händler: Cashback-Einstellungen aktualisieren"""
    if user.get("role") != "partner":
        raise HTTPException(status_code=403, detail="Nur für Händler")
    
    # Validate rate
    if data.cashback_rate < MIN_CASHBACK_RATE or data.cashback_rate > MAX_CASHBACK_RATE:
        raise HTTPException(
            status_code=400,
            detail=f"Cashback-Rate muss zwischen {MIN_CASHBACK_RATE}% und {MAX_CASHBACK_RATE}% liegen"
        )
    
    if data.special_rate and (data.special_rate < MIN_CASHBACK_RATE or data.special_rate > MAX_CASHBACK_RATE):
        raise HTTPException(
            status_code=400,
            detail=f"Sonder-Rate muss zwischen {MIN_CASHBACK_RATE}% und {MAX_CASHBACK_RATE}% liegen"
        )
    
    merchant_id = user["id"]
    
    await db.merchant_cashback_settings.update_one(
        {"merchant_id": merchant_id},
        {
            "$set": {
                "merchant_id": merchant_id,
                "cashback_rate": data.cashback_rate,
                "special_rate": data.special_rate,
                "special_rate_until": data.special_rate_until,
                "cashback_enabled": data.cashback_enabled,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        },
        upsert=True
    )
    
    logger.info(f"Merchant {merchant_id} updated cashback settings: {data.cashback_rate}%")
    
    return {
        "success": True,
        "message": f"Cashback-Rate auf {data.cashback_rate}% gesetzt",
        "settings": data.dict()
    }


@router.get("/merchant/transactions")
async def get_merchant_cashback_transactions(
    user: dict = Depends(get_current_user),
    limit: int = 100
):
    """Händler: Cashback-Transaktionen abrufen"""
    if user.get("role") != "partner":
        raise HTTPException(status_code=403, detail="Nur für Händler")
    
    merchant_id = user["id"]
    
    transactions = await db.cashback_transactions.find(
        {"merchant_id": merchant_id, "type": "earn"},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    # Calculate totals
    total_cashback = sum(t.get("cashback_amount", 0) for t in transactions)
    total_merchant_cost = sum(t.get("merchant_cost", 0) for t in transactions)
    total_purchase_volume = sum(t.get("purchase_amount", 0) for t in transactions)
    
    return {
        "transactions": transactions,
        "count": len(transactions),
        "totals": {
            "total_cashback_given": total_cashback,
            "total_merchant_cost": total_merchant_cost,
            "total_purchase_volume": total_purchase_volume
        }
    }


# ==================== ADMIN ENDPOINTS ====================

@router.get("/admin/overview")
async def admin_cashback_overview():
    """Admin: Cashback-System Übersicht"""
    # Total cashback given
    pipeline = [
        {"$match": {"type": "earn", "status": "completed"}},
        {"$group": {
            "_id": None,
            "total_cashback": {"$sum": "$cashback_amount"},
            "total_bidblitz_cost": {"$sum": "$bidblitz_cost"},
            "total_merchant_cost": {"$sum": "$merchant_cost"},
            "total_transactions": {"$sum": 1}
        }}
    ]
    
    totals = await db.cashback_transactions.aggregate(pipeline).to_list(1)
    totals = totals[0] if totals else {
        "total_cashback": 0,
        "total_bidblitz_cost": 0,
        "total_merchant_cost": 0,
        "total_transactions": 0
    }
    
    # Active merchants with cashback
    active_merchants = await db.merchant_cashback_settings.count_documents({"cashback_enabled": True})
    
    # Total pending liability
    liability_pipeline = [
        {"$group": {
            "_id": None,
            "total_liability": {"$sum": "$total_liability"}
        }}
    ]
    liability = await db.merchant_cashback_liability.aggregate(liability_pipeline).to_list(1)
    total_liability = liability[0]["total_liability"] if liability else 0
    
    return {
        "totals": {
            "total_cashback_given": totals.get("total_cashback", 0),
            "bidblitz_cost": totals.get("total_bidblitz_cost", 0),
            "merchant_cost": totals.get("total_merchant_cost", 0),
            "transactions_count": totals.get("total_transactions", 0)
        },
        "active_merchants": active_merchants,
        "total_merchant_liability": total_liability,
        "cost_split": {
            "bidblitz_share": int(BIDBLITZ_SHARE * 100),
            "merchant_share": int(MERCHANT_SHARE * 100)
        }
    }


@router.get("/admin/merchants")
async def admin_get_merchant_cashback_stats():
    """Admin: Alle Händler mit Cashback-Statistiken"""
    # Get all merchants with settings
    merchants = await db.users.find(
        {"role": "partner"},
        {"_id": 0, "password_hash": 0}
    ).to_list(200)
    
    result = []
    for merchant in merchants:
        settings = await db.merchant_cashback_settings.find_one({"merchant_id": merchant["id"]})
        liability = await db.merchant_cashback_liability.find_one({"merchant_id": merchant["id"]})
        
        # Count transactions
        tx_count = await db.cashback_transactions.count_documents({
            "merchant_id": merchant["id"],
            "type": "earn"
        })
        
        result.append({
            "id": merchant["id"],
            "business_name": merchant.get("business_name", merchant.get("name")),
            "is_premium": merchant.get("is_premium", False),
            "cashback_enabled": settings.get("cashback_enabled", True) if settings else True,
            "cashback_rate": settings.get("cashback_rate", DEFAULT_CASHBACK_RATE) if settings else DEFAULT_CASHBACK_RATE,
            "special_rate": settings.get("special_rate") if settings else None,
            "liability": liability.get("total_liability", 0) if liability else 0,
            "transactions_count": tx_count
        })
    
    return {
        "merchants": result,
        "total": len(result)
    }


# ==================== ADMIN PROMOTION ENDPOINT ====================

class CashbackPromotion(BaseModel):
    special_rate: float  # e.g., 8.0 for 8%
    duration_days: int   # How many days the promotion lasts


@router.post("/admin/create-promotion/{partner_id}")
async def create_cashback_promotion(
    partner_id: str,
    data: CashbackPromotion
):
    """
    Admin: Temporäre Cashback-Aktion für einen Händler erstellen.
    
    - special_rate: Der erhöhte Cashback-Prozentsatz (z.B. 8% statt 3%)
    - duration_days: Wie lange die Aktion läuft (1-30 Tage)
    """
    # Validate rate
    if data.special_rate < MIN_CASHBACK_RATE or data.special_rate > MAX_CASHBACK_RATE:
        raise HTTPException(
            status_code=400,
            detail=f"Sonder-Rate muss zwischen {MIN_CASHBACK_RATE}% und {MAX_CASHBACK_RATE}% liegen"
        )
    
    if data.duration_days < 1 or data.duration_days > 30:
        raise HTTPException(
            status_code=400,
            detail="Aktionsdauer muss zwischen 1 und 30 Tagen liegen"
        )
    
    # Check if partner exists - try both partner_accounts and users collection
    partner = await db.partner_accounts.find_one({"id": partner_id})
    if not partner:
        partner = await db.users.find_one({"id": partner_id, "role": "partner"})
    if not partner:
        raise HTTPException(status_code=404, detail="Händler nicht gefunden")
    
    # Calculate end date
    end_date = datetime.now(timezone.utc) + timedelta(days=data.duration_days)
    
    # Update or create cashback settings with special rate
    await db.merchant_cashback_settings.update_one(
        {"merchant_id": partner_id},
        {
            "$set": {
                "merchant_id": partner_id,
                "special_rate": data.special_rate,
                "special_rate_until": end_date.isoformat(),
                "cashback_enabled": True,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        },
        upsert=True
    )
    
    logger.info(f"Admin created cashback promotion for {partner.get('business_name')}: {data.special_rate}% for {data.duration_days} days")
    
    return {
        "success": True,
        "message": f"Cashback-Aktion erstellt: {data.special_rate}% für {data.duration_days} Tage",
        "partner_id": partner_id,
        "partner_name": partner.get("business_name", partner.get("name")),
        "special_rate": data.special_rate,
        "ends_at": end_date.isoformat(),
        "duration_days": data.duration_days
    }


@router.delete("/admin/remove-promotion/{partner_id}")
async def remove_cashback_promotion(partner_id: str):
    """Admin: Cashback-Aktion für einen Händler beenden"""
    # Check if partner exists - try both collections
    partner = await db.partner_accounts.find_one({"id": partner_id})
    if not partner:
        partner = await db.users.find_one({"id": partner_id, "role": "partner"})
    if not partner:
        raise HTTPException(status_code=404, detail="Händler nicht gefunden")
    
    # Remove special rate
    await db.merchant_cashback_settings.update_one(
        {"merchant_id": partner_id},
        {
            "$set": {
                "special_rate": None,
                "special_rate_until": None,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    logger.info(f"Admin removed cashback promotion for {partner.get('business_name')}")
    
    return {
        "success": True,
        "message": "Cashback-Aktion beendet",
        "partner_id": partner_id,
        "partner_name": partner.get("business_name", partner.get("name"))
    }


@router.get("/admin/promotions")
async def get_active_promotions():
    """Admin: Alle aktiven Cashback-Aktionen abrufen"""
    now = datetime.now(timezone.utc).isoformat()
    
    # Find all settings with active special rates
    settings = await db.merchant_cashback_settings.find({
        "special_rate": {"$ne": None},
        "special_rate_until": {"$gt": now}
    }).to_list(100)
    
    promotions = []
    for setting in settings:
        # Try both collections
        partner = await db.partner_accounts.find_one({"id": setting["merchant_id"]})
        if not partner:
            partner = await db.users.find_one({"id": setting["merchant_id"]})
        if partner:
            promotions.append({
                "partner_id": setting["merchant_id"],
                "partner_name": partner.get("business_name", partner.get("name")),
                "is_premium": partner.get("is_premium", False),
                "special_rate": setting["special_rate"],
                "ends_at": setting["special_rate_until"],
                "cashback_enabled": setting.get("cashback_enabled", True)
            })
    
    return {
        "promotions": promotions,
        "total": len(promotions)
    }
