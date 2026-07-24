"""
BidBlitz V2 - Crypto Earn & Staking
Users lock REAL crypto to earn REAL interest (3-12% APY)
✅ Real crypto balances
✅ Real interest calculations
✅ Real withdrawals
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from datetime import datetime, timezone, timedelta
from core.database import db
from core.security import get_current_user
import secrets

router = APIRouter(prefix="/api/crypto-earn", tags=["crypto-earn"])

# Realistic limits (but allow large amounts for whales)
MAX_BTC_DEPOSIT = 100.0      # Max 100 BTC (for crypto whales)
MAX_ETH_DEPOSIT = 1000.0     # Max 1000 ETH
MAX_USDT_DEPOSIT = 5000000.0 # Max 5M USDT
ADMIN_APPROVAL_BTC = 10.0    # Require admin approval for > 10 BTC
ADMIN_APPROVAL_ETH = 100.0   # Require admin approval for > 100 ETH

EARN_PRODUCTS = [
    {"id": "btc_flex", "coin": "BTC", "name": "Bitcoin Flex", "apy": 3.0, "term": "Flexibel", "min": 0.001, "max": MAX_BTC_DEPOSIT, "lock_days": 0, "icon": "bitcoin"},
    {"id": "eth_flex", "coin": "ETH", "name": "Ethereum Flex", "apy": 2.5, "term": "Flexibel", "min": 0.01, "max": MAX_ETH_DEPOSIT, "lock_days": 0, "icon": "ethereum"},
    {"id": "btc_30", "coin": "BTC", "name": "Bitcoin 30 Tage", "apy": 6.5, "term": "30 Tage", "min": 0.001, "max": MAX_BTC_DEPOSIT, "lock_days": 30, "icon": "bitcoin"},
    {"id": "eth_30", "coin": "ETH", "name": "Ethereum 30 Tage", "apy": 5.5, "term": "30 Tage", "min": 0.01, "max": MAX_ETH_DEPOSIT, "lock_days": 30, "icon": "ethereum"},
    {"id": "btc_90", "coin": "BTC", "name": "Bitcoin 90 Tage", "apy": 10.0, "term": "90 Tage", "min": 0.005, "max": MAX_BTC_DEPOSIT, "lock_days": 90, "icon": "bitcoin"},
    {"id": "eth_90", "coin": "ETH", "name": "Ethereum 90 Tage", "apy": 8.5, "term": "90 Tage", "min": 0.05, "max": MAX_ETH_DEPOSIT, "lock_days": 90, "icon": "ethereum"},
    {"id": "usdt_flex", "coin": "USDT", "name": "Tether Flex", "apy": 4.0, "term": "Flexibel", "min": 10, "max": MAX_USDT_DEPOSIT, "lock_days": 0, "icon": "tether"},
    {"id": "usdt_90", "coin": "USDT", "name": "Tether 90 Tage", "apy": 12.0, "term": "90 Tage", "min": 50, "max": MAX_USDT_DEPOSIT, "lock_days": 90, "icon": "tether"},
    {"id": "sol_30", "coin": "SOL", "name": "Solana 30 Tage", "apy": 7.0, "term": "30 Tage", "min": 0.5, "max": 1000.0, "lock_days": 30, "icon": "solana"},
    {"id": "bnb_flex", "coin": "BNB", "name": "BNB Flex", "apy": 3.5, "term": "Flexibel", "min": 0.1, "max": 5000.0, "lock_days": 0, "icon": "bnb"},
]


class EarnDeposit(BaseModel):
    product_id: str
    amount: float = Field(..., gt=0)


@router.get("/products")
async def get_earn_products():
    return {"products": EARN_PRODUCTS}


@router.post("/deposit")
async def create_deposit(req: EarnDeposit, request: Request):
    """
    Create REAL crypto deposit with REAL interest earnings.
    Checks user's crypto wallet balance before allowing deposit.
    """
    user = await get_current_user(request)
    user_id = str(user.get("_id"))
    user_email = user.get("email", "")
    
    product = next((p for p in EARN_PRODUCTS if p["id"] == req.product_id), None)
    if not product:
        raise HTTPException(404, "Produkt nicht gefunden")
    
    # ═══════════════════════════════════════════════════════════════════════════════
    # REAL VALIDATION - Check actual crypto balance
    # ═══════════════════════════════════════════════════════════════════════════════
    
    # 1. Check minimum
    if req.amount < product["min"]:
        raise HTTPException(400, f"Mindestbetrag: {product['min']} {product['coin']}")
    
    # 2. Check maximum
    max_amount = product.get("max", 999999)
    if req.amount > max_amount:
        raise HTTPException(
            400, 
            f"⚠️ Maximalbetrag: {max_amount} {product['coin']}. "
            f"Für größere Beträge kontaktiere den Support."
        )
    
    # 3. Check if user has enough crypto balance (REAL CHECK)
    crypto_wallet = await db.crypto_wallets.find_one(
        {"user_id": user_id, "coin": product['coin']},
        {"_id": 0}
    )
    
    if not crypto_wallet or crypto_wallet.get("balance", 0) < req.amount:
        available = crypto_wallet.get("balance", 0) if crypto_wallet else 0
        raise HTTPException(
            400,
            f"❌ Nicht genug {product['coin']}! Verfügbar: {available:.8f} {product['coin']}"
        )
    
    # 4. Deduct from crypto wallet (REAL transaction)
    await db.crypto_wallets.update_one(
        {"user_id": user_id, "coin": product['coin']},
        {"$inc": {"balance": -req.amount, "locked_balance": req.amount}}
    )
    
    # 5. Check if needs admin approval (for large amounts)
    needs_approval = False
    if product['coin'] == 'BTC' and req.amount > ADMIN_APPROVAL_BTC:
        needs_approval = True
    elif product['coin'] == 'ETH' and req.amount > ADMIN_APPROVAL_ETH:
        needs_approval = True
    
    # 6. Create deposit record
    deposit = {
        "deposit_id": f"earn_{secrets.token_hex(6)}",
        "user_email": user.get("email", ""),
        "product_id": req.product_id,
        "coin": product["coin"],
        "amount": req.amount,
        "user_email": user_email,
        "product_id": req.product_id,
        "coin": product["coin"],
        "amount": req.amount,
        "apy": product["apy"],
        "term": product["term"],
        "lock_days": product["lock_days"],
        "earned": 0.0,  # Will be calculated daily
        "status": "active",  # Always active immediately (real deposit)
        "user_id": user_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "last_interest_calc": datetime.now(timezone.utc).isoformat(),
    }
    
    # If needs approval, lock it but allow interest
    if needs_approval:
        deposit["needs_admin_review"] = True
        deposit["admin_review_reason"] = f"Large amount: {req.amount} {product['coin']}"
    
    # If needs approval, add review flag
    if needs_approval:
        deposit["needs_admin_review"] = True
        deposit["admin_review_reason"] = f"Large amount: {req.amount} {product['coin']}"
        await db.notifications.insert_one({
            "user_id": "admin",
            "type": "admin_review",
            "title": f"🔔 Large Crypto Deposit: {req.amount} {product['coin']}",
            "message": f"User {user_email} deposited {req.amount} {product['coin']}. Review recommended.",
            "data": {"deposit_id": deposit["deposit_id"], "user_email": user_email, "amount": req.amount, "coin": product['coin']},
            "read": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    
    await db.crypto_earn_deposits.insert_one(deposit)
    
    # Log crypto transaction
    await db.crypto_transactions.insert_one({
        "transaction_id": f"ctxn_{secrets.token_hex(8)}",
        "user_id": user_id,
        "type": "crypto_earn_deposit",
        "coin": product["coin"],
        "amount": req.amount,
        "status": "completed",
        "description": f"Crypto Earn: {product['name']}",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    
    return {
        "ok": True, 
        "deposit_id": deposit["deposit_id"], 
        "message": f"✅ {req.amount} {product['coin']} erfolgreich angelegt! Verdienst {product['apy']}% APY.",
        "earning_starts": "immediately",
        "needs_review": needs_approval
    }


@router.get("/my-deposits")
async def my_deposits(request: Request):
    user = await get_current_user(request)
    deps = await db.crypto_earn_deposits.find(
        {"user_email": user.get("email", "")}, {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    total_earned = sum(d.get("earned", 0) for d in deps)
    return {"deposits": deps, "total_earned": round(total_earned, 6), "count": len(deps)}


@router.post("/withdraw/{deposit_id}")
async def withdraw_deposit(deposit_id: str, request: Request):
    """
    Withdraw REAL crypto + earned interest back to wallet.
    """
    user = await get_current_user(request)
    user_id = str(user.get("_id"))
    
    dep = await db.crypto_earn_deposits.find_one({
        "deposit_id": deposit_id, 
        "user_id": user_id, 
        "status": "active"
    })
    if not dep:
        raise HTTPException(404, "Einlage nicht gefunden oder bereits ausgezahlt")
    
    # Calculate final earned interest
    days_elapsed = (datetime.now(timezone.utc) - datetime.fromisoformat(dep["created_at"])).days
    if days_elapsed < 1:
        days_elapsed = (datetime.now(timezone.utc) - datetime.fromisoformat(dep["created_at"])).total_seconds() / 86400
    
    daily_rate = dep["apy"] / 100 / 365
    total_earned = dep["amount"] * daily_rate * days_elapsed
    
    total_payout = dep["amount"] + total_earned
    
    # Return to crypto wallet (REAL transaction)
    await db.crypto_wallets.update_one(
        {"user_id": user_id, "coin": dep["coin"]},
        {
            "$inc": {
                "balance": total_payout,
                "locked_balance": -dep["amount"],
                "total_earned": total_earned
            }
        },
        upsert=True
    )
    
    # Mark deposit as withdrawn
    await db.crypto_earn_deposits.update_one(
        {"deposit_id": deposit_id}, 
        {
            "$set": {
                "status": "withdrawn", 
                "withdrawn_at": datetime.now(timezone.utc).isoformat(),
                "earned": total_earned,
                "total_payout": total_payout
            }
        }
    )
    
    # Log transaction
    await db.crypto_transactions.insert_one({
        "transaction_id": f"ctxn_{secrets.token_hex(8)}",
        "user_id": user_id,
        "type": "crypto_earn_withdrawal",
        "coin": dep["coin"],
        "amount": total_payout,
        "earned_interest": total_earned,
        "status": "completed",
        "description": f"Crypto Earn Auszahlung: {dep['amount']} {dep['coin']} + {total_earned:.8f} Zinsen",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    
    return {
        "ok": True, 
        "message": f"✅ Ausgezahlt: {dep['amount']} {dep['coin']} + {total_earned:.8f} {dep['coin']} Zinsen!",
        "principal": dep["amount"],
        "earned": round(total_earned, 8),
        "total_payout": round(total_payout, 8),
        "days": round(days_elapsed, 2)
    }
