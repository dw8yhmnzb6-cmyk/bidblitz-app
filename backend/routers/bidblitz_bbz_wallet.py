"""
BidBlitz BBZ Token Wallet
Create wallet, check balance, send tokens, view transactions
MongoDB-persistent storage
"""
from fastapi import APIRouter
from datetime import datetime, timezone
from pymongo import MongoClient
import os

router = APIRouter(tags=["BBZ Token Wallet"])

# MongoDB Connection
mongo_url = os.environ.get("MONGO_URL")
db_name = os.environ.get("DB_NAME", "bidblitz")
client = MongoClient(mongo_url)
db = client[db_name]

# Collections - reuse existing wallets collection
wallets_col = db["wallets"]
bbz_tx_col = db["bbz_simple_transactions"]


def get_or_create_wallet(user_id: str) -> dict:
    """Get or create a wallet for user"""
    wallet = wallets_col.find_one({"user_id": user_id}, {"_id": 0})
    if not wallet:
        now = datetime.now(timezone.utc)
        wallet = {
            "user_id": user_id,
            "coins": 100,  # Starting balance
            "created_at": now.isoformat()
        }
        wallets_col.insert_one(wallet)
    return wallet


# Wallet erstellen
@router.post("/bbz/create")
def create_wallet(user_id: str):
    wallet = get_or_create_wallet(user_id)
    return {
        "user": user_id,
        "bbz_balance": wallet.get("coins", 0)
    }


# Balance anzeigen
@router.get("/bbz/balance")
def balance(user_id: str):
    wallet = wallets_col.find_one({"user_id": user_id}, {"_id": 0})
    return {
        "user": user_id,
        "bbz_balance": wallet.get("coins", 0) if wallet else 0
    }


# Coins senden
@router.post("/bbz/send")
def send(from_user: str, to_user: str, amount: int):
    # Get sender wallet
    sender = wallets_col.find_one({"user_id": from_user})
    if not sender or sender.get("coins", 0) < amount:
        return {"error": "not enough BBZ"}
    
    # Ensure receiver wallet exists
    get_or_create_wallet(to_user)
    
    now = datetime.now(timezone.utc)
    
    # Deduct from sender
    wallets_col.update_one(
        {"user_id": from_user},
        {"$inc": {"coins": -amount}}
    )
    
    # Add to receiver
    wallets_col.update_one(
        {"user_id": to_user},
        {"$inc": {"coins": amount}}
    )
    
    # Log transaction
    bbz_tx_col.insert_one({
        "from_user": from_user,
        "to_user": to_user,
        "amount": amount,
        "timestamp": now.isoformat(),
        "type": "transfer"
    })
    
    return {
        "from": from_user,
        "to": to_user,
        "amount": amount
    }


# Transaktionen anzeigen
@router.get("/bbz/transactions")
def tx():
    transactions = list(bbz_tx_col.find({}, {"_id": 0}).sort("timestamp", -1).limit(50))
    return transactions
