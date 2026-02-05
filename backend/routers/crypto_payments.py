"""Crypto Payments - Accept Bitcoin, Ethereum and other cryptocurrencies"""
from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timezone, timedelta
from typing import Optional
import uuid
import hashlib
import hmac
import os

from config import db, logger
from dependencies import get_current_user

router = APIRouter(prefix="/crypto", tags=["Crypto Payments"])

# Supported cryptocurrencies
SUPPORTED_CRYPTOS = {
    "BTC": {"name": "Bitcoin", "symbol": "₿", "min_amount": 0.0001},
    "ETH": {"name": "Ethereum", "symbol": "Ξ", "min_amount": 0.001},
    "USDT": {"name": "Tether", "symbol": "₮", "min_amount": 10},
    "USDC": {"name": "USD Coin", "symbol": "$", "min_amount": 10},
    "LTC": {"name": "Litecoin", "symbol": "Ł", "min_amount": 0.01}
}

# Mock exchange rates (in production, fetch from CoinGecko/similar)
EXCHANGE_RATES = {
    "BTC": 45000,  # 1 BTC = $45,000
    "ETH": 2500,   # 1 ETH = $2,500
    "USDT": 1,
    "USDC": 1,
    "LTC": 80
}

@router.get("/supported")
async def get_supported_cryptos():
    """Get list of supported cryptocurrencies"""
    return {
        "cryptocurrencies": [
            {
                "code": code,
                **info,
                "current_rate_usd": EXCHANGE_RATES.get(code, 0)
            }
            for code, info in SUPPORTED_CRYPTOS.items()
        ]
    }

@router.get("/rates")
async def get_exchange_rates():
    """Get current exchange rates"""
    # In production, this would fetch from CoinGecko API
    return {
        "rates": {code: {"usd": rate} for code, rate in EXCHANGE_RATES.items()},
        "updated_at": datetime.now(timezone.utc).isoformat()
    }

@router.post("/create-payment")
async def create_crypto_payment(
    amount_eur: float,
    crypto_code: str,
    bid_package_id: str = None,
    user: dict = Depends(get_current_user)
):
    """Create a crypto payment request"""
    if crypto_code not in SUPPORTED_CRYPTOS:
        raise HTTPException(status_code=400, detail=f"Währung nicht unterstützt: {crypto_code}")
    
    if amount_eur < 5:
        raise HTTPException(status_code=400, detail="Mindestbetrag: €5")
    
    # Convert EUR to crypto (simplified - assumes EUR ≈ USD)
    crypto_rate = EXCHANGE_RATES.get(crypto_code, 1)
    crypto_amount = amount_eur / crypto_rate
    
    # Check minimum amount
    min_amount = SUPPORTED_CRYPTOS[crypto_code]["min_amount"]
    if crypto_amount < min_amount:
        raise HTTPException(
            status_code=400, 
            detail=f"Mindestbetrag für {crypto_code}: {min_amount}"
        )
    
    payment_id = str(uuid.uuid4())
    
    # Generate unique wallet address (in production, use actual wallet service)
    # This is a mock address - would need real crypto payment processor
    mock_address = generate_mock_address(crypto_code, payment_id)
    
    payment = {
        "id": payment_id,
        "user_id": user["id"],
        "user_email": user.get("email"),
        "amount_eur": amount_eur,
        "crypto_code": crypto_code,
        "crypto_amount": round(crypto_amount, 8),
        "exchange_rate": crypto_rate,
        "wallet_address": mock_address,
        "bid_package_id": bid_package_id,
        "status": "pending",
        "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=30)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.crypto_payments.insert_one(payment)
    
    del payment["_id"]
    return {
        "payment": payment,
        "instructions": get_payment_instructions(crypto_code),
        "qr_code_url": f"https://api.qrserver.com/v1/create-qr-code/?data={mock_address}&size=200x200"
    }

def generate_mock_address(crypto_code: str, payment_id: str) -> str:
    """Generate a mock wallet address (for demo purposes)"""
    # In production, this would generate/fetch real addresses from a crypto payment processor
    hash_input = f"{crypto_code}-{payment_id}".encode()
    hash_output = hashlib.sha256(hash_input).hexdigest()
    
    if crypto_code == "BTC":
        return f"bc1q{hash_output[:38]}"
    elif crypto_code == "ETH":
        return f"0x{hash_output[:40]}"
    elif crypto_code in ["USDT", "USDC"]:
        return f"0x{hash_output[:40]}"  # ERC-20
    elif crypto_code == "LTC":
        return f"ltc1q{hash_output[:38]}"
    else:
        return f"addr_{hash_output[:32]}"

def get_payment_instructions(crypto_code: str) -> dict:
    """Get payment instructions for a cryptocurrency"""
    crypto = SUPPORTED_CRYPTOS.get(crypto_code, {})
    
    return {
        "de": f"Sende genau den angezeigten {crypto.get('name', crypto_code)}-Betrag an die Adresse. Die Zahlung wird automatisch erkannt.",
        "en": f"Send exactly the displayed {crypto.get('name', crypto_code)} amount to the address. Payment will be detected automatically.",
        "network": "Mainnet" if crypto_code not in ["USDT", "USDC"] else "Ethereum (ERC-20)",
        "confirmations_required": 1 if crypto_code in ["ETH", "USDT", "USDC"] else 3
    }

@router.get("/payment/{payment_id}")
async def get_payment_status(payment_id: str, user: dict = Depends(get_current_user)):
    """Get status of a crypto payment"""
    payment = await db.crypto_payments.find_one(
        {"id": payment_id, "user_id": user["id"]},
        {"_id": 0}
    )
    
    if not payment:
        raise HTTPException(status_code=404, detail="Zahlung nicht gefunden")
    
    # Check if expired
    if payment["status"] == "pending":
        expires_at = datetime.fromisoformat(payment["expires_at"].replace("Z", "+00:00"))
        if datetime.now(timezone.utc) > expires_at:
            await db.crypto_payments.update_one(
                {"id": payment_id},
                {"$set": {"status": "expired"}}
            )
            payment["status"] = "expired"
    
    return {"payment": payment}

@router.get("/my-payments")
async def get_my_crypto_payments(user: dict = Depends(get_current_user)):
    """Get user's crypto payment history"""
    payments = await db.crypto_payments.find(
        {"user_id": user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).limit(20).to_list(20)
    
    return {"payments": payments}

# Webhook for payment confirmation (would be called by crypto payment processor)
@router.post("/webhook/confirm")
async def confirm_crypto_payment(
    payment_id: str,
    tx_hash: str,
    amount_received: float,
    webhook_secret: str
):
    """Webhook to confirm a crypto payment (called by payment processor)"""
    # Verify webhook secret
    expected_secret = os.environ.get("CRYPTO_WEBHOOK_SECRET", "demo_secret")
    if webhook_secret != expected_secret:
        raise HTTPException(status_code=401, detail="Invalid webhook secret")
    
    payment = await db.crypto_payments.find_one({"id": payment_id})
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    if payment["status"] != "pending":
        return {"status": "already_processed"}
    
    # Verify amount (allow small variance for network fees)
    expected_amount = payment["crypto_amount"]
    if amount_received < expected_amount * 0.99:
        await db.crypto_payments.update_one(
            {"id": payment_id},
            {"$set": {
                "status": "underpaid",
                "amount_received": amount_received,
                "tx_hash": tx_hash
            }}
        )
        return {"status": "underpaid"}
    
    # Payment confirmed - credit bids to user
    await db.crypto_payments.update_one(
        {"id": payment_id},
        {"$set": {
            "status": "confirmed",
            "amount_received": amount_received,
            "tx_hash": tx_hash,
            "confirmed_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Credit bids to user
    bid_package_id = payment.get("bid_package_id")
    if bid_package_id:
        # Get bid package info and credit bids
        from config import BID_PACKAGES
        package = next((p for p in BID_PACKAGES if p["id"] == bid_package_id), None)
        if package:
            bids_to_add = package.get("bids", 0)
            await db.users.update_one(
                {"id": payment["user_id"]},
                {"$inc": {"bid_balance": bids_to_add}}
            )
            logger.info(f"Credited {bids_to_add} bids to user {payment['user_id']} via crypto payment")
    
    return {"status": "confirmed", "tx_hash": tx_hash}

# Demo endpoint to simulate payment confirmation
@router.post("/demo/confirm/{payment_id}")
async def demo_confirm_payment(payment_id: str, user: dict = Depends(get_current_user)):
    """Demo: Simulate payment confirmation (for testing)"""
    payment = await db.crypto_payments.find_one({
        "id": payment_id,
        "user_id": user["id"],
        "status": "pending"
    })
    
    if not payment:
        raise HTTPException(status_code=404, detail="Pending payment not found")
    
    # Simulate confirmation
    await db.crypto_payments.update_one(
        {"id": payment_id},
        {"$set": {
            "status": "confirmed",
            "amount_received": payment["crypto_amount"],
            "tx_hash": f"demo_tx_{uuid.uuid4().hex[:16]}",
            "confirmed_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Credit bids
    bid_package_id = payment.get("bid_package_id")
    if bid_package_id:
        from config import BID_PACKAGES
        package = next((p for p in BID_PACKAGES if p["id"] == bid_package_id), None)
        if package:
            bids_to_add = package.get("bids", 0)
            await db.users.update_one(
                {"id": user["id"]},
                {"$inc": {"bid_balance": bids_to_add}}
            )
            return {
                "success": True,
                "message": f"Demo: {bids_to_add} Gebote gutgeschrieben!",
                "bids_added": bids_to_add
            }
    
    return {"success": True, "message": "Demo: Zahlung bestätigt"}
