"""
BidBlitz V2 - Database Migrations & Indexes
Run this script to ensure all indexes are created for production performance.
"""

import asyncio
import logging
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / '.env')

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("bidblitz.migrations")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]


async def create_indexes():
    """Create all production indexes for optimal query performance."""
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    logger.info("Starting index creation...")
    
    # Users collection
    await db.users.create_index("email", unique=True)
    await db.users.create_index("role")
    await db.users.create_index("payment_barcode", unique=True, sparse=True)
    await db.users.create_index("referral_code", sparse=True)
    await db.users.create_index("created_at")
    logger.info("✓ Users indexes created")
    
    # Transactions collection
    await db.transactions.create_index("user_id")
    await db.transactions.create_index("type")
    await db.transactions.create_index("status")
    await db.transactions.create_index("created_at")
    await db.transactions.create_index([("user_id", 1), ("created_at", -1)])
    await db.transactions.create_index([("user_id", 1), ("type", 1)])
    await db.transactions.create_index("reference", sparse=True)
    await db.transactions.create_index("id", unique=True, sparse=True)
    logger.info("✓ Transactions indexes created")
    
    # Payment transactions (Stripe)
    await db.payment_transactions.create_index("session_id", unique=True, sparse=True)
    await db.payment_transactions.create_index("user_id")
    await db.payment_transactions.create_index("status")
    await db.payment_transactions.create_index([("user_id", 1), ("status", 1)])
    logger.info("✓ Payment transactions indexes created")
    
    # Auctions collection
    await db.auctions.create_index("status")
    await db.auctions.create_index("end_time")
    await db.auctions.create_index([("status", 1), ("end_time", 1)])
    await db.auctions.create_index("category")
    logger.info("✓ Auctions indexes created")
    
    # Bids collection
    await db.bids.create_index("auction_id")
    await db.bids.create_index("user_id")
    await db.bids.create_index([("auction_id", 1), ("created_at", -1)])
    logger.info("✓ Bids indexes created")
    
    # Mining collections
    await db.mining_miners.create_index("user_id")
    await db.mining_miners.create_index([("user_id", 1), ("status", 1)])
    await db.mining_transactions.create_index("user_id")
    await db.mining_transactions.create_index([("user_id", 1), ("created_at", -1)])
    await db.mining_claims.create_index([("user_id", 1), ("created_at", -1)])
    await db.mining_claims.create_index([("user_id", 1), ("date", 1)], unique=True, sparse=True)
    await db.mining_marketplace.create_index("status")
    await db.mining_marketplace.create_index("seller_id")
    logger.info("✓ Mining indexes created")
    
    # Merchant collections
    await db.merchant_profiles.create_index("user_id", unique=True)
    await db.merchant_transactions.create_index("merchant_id")
    await db.merchant_transactions.create_index([("merchant_id", 1), ("created_at", -1)])
    await db.merchant_qr_codes.create_index("reference", unique=True)
    await db.merchant_qr_codes.create_index([("merchant_id", 1), ("status", 1)])
    logger.info("✓ Merchant indexes created")
    
    # Verification & KYC
    await db.verifications.create_index("user_id", unique=True)
    await db.verifications.create_index("status")
    await db.role_requests.create_index("user_id")
    await db.role_requests.create_index("status")
    logger.info("✓ Verification indexes created")
    
    # Fraud & Security
    await db.fraud_logs.create_index("user_id")
    await db.fraud_logs.create_index([("created_at", -1)])
    await db.fraud_logs.create_index([("severity", 1), ("reviewed", 1)])
    await db.fraud_alerts.create_index([("status", 1), ("created_at", -1)])
    await db.audit_logs.create_index([("created_at", -1)])
    await db.audit_logs.create_index("user_id")
    await db.audit_logs.create_index("event")
    logger.info("✓ Security indexes created")
    
    # Referrals
    await db.referrals.create_index("referrer_id")
    await db.referrals.create_index("referred_id", unique=True, sparse=True)
    await db.referrals.create_index("code")
    logger.info("✓ Referral indexes created")
    
    # Sessions & Auth
    await db.sessions.create_index("user_id")
    await db.sessions.create_index("expires_at", expireAfterSeconds=0)
    await db.login_attempts.create_index("email")
    await db.login_attempts.create_index("created_at", expireAfterSeconds=3600)
    logger.info("✓ Session indexes created")
    
    client.close()
    logger.info("All indexes created successfully!")


async def run_migrations():
    """Run any pending data migrations."""
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    logger.info("Running data migrations...")
    
    # Migration 1: Ensure all users have payment_barcode
    users_without_barcode = await db.users.count_documents({"payment_barcode": {"$exists": False}})
    if users_without_barcode > 0:
        import secrets
        async for user in db.users.find({"payment_barcode": {"$exists": False}}):
            barcode = f"BLZ-{secrets.token_hex(8).upper()}"
            await db.users.update_one(
                {"_id": user["_id"]},
                {"$set": {"payment_barcode": barcode}}
            )
        logger.info(f"✓ Added barcodes to {users_without_barcode} users")
    
    # Migration 2: Ensure all transactions have id field
    txns_without_id = await db.transactions.count_documents({"id": {"$exists": False}})
    if txns_without_id > 0:
        import secrets
        async for txn in db.transactions.find({"id": {"$exists": False}}):
            txn_id = secrets.token_hex(8)
            await db.transactions.update_one(
                {"_id": txn["_id"]},
                {"$set": {"id": txn_id}}
            )
        logger.info(f"✓ Added IDs to {txns_without_id} transactions")
    
    # Migration 3: Ensure mining_wallets exist for users with miners
    miner_users = await db.mining_miners.distinct("user_id")
    for user_id in miner_users:
        wallet = await db.mining_wallets.find_one({"user_id": user_id})
        if not wallet:
            await db.mining_wallets.insert_one({
                "user_id": user_id,
                "blz_balance": 0.0,
                "total_earned": 0.0,
                "total_withdrawn": 0.0,
                "created_at": datetime.now(timezone.utc).isoformat()
            })
    logger.info("✓ Mining wallets verified")
    
    # Record migration
    await db.migrations.insert_one({
        "version": "2.0.0",
        "ran_at": datetime.now(timezone.utc).isoformat(),
        "indexes_created": True,
        "data_migrated": True
    })
    
    client.close()
    logger.info("All migrations completed!")


async def backup_database():
    """Create a backup marker (actual backup via mongodump)."""
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    # Get collection stats
    collections = await db.list_collection_names()
    stats = {}
    for coll in collections:
        count = await db[coll].count_documents({})
        stats[coll] = count
    
    # Log backup info
    await db.backups.insert_one({
        "type": "pre_launch",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "collections": stats,
        "total_documents": sum(stats.values()),
        "note": "Run mongodump for full backup"
    })
    
    client.close()
    logger.info(f"Backup marker created. Collections: {len(collections)}, Documents: {sum(stats.values())}")
    logger.info("Run: mongodump --uri=$MONGO_URL --out=/backup/$(date +%Y%m%d)")
    return stats


async def main():
    print("\n" + "="*50)
    print("BidBlitz V2 - Production Deployment Script")
    print("="*50 + "\n")
    
    # Step 1: Create indexes
    await create_indexes()
    print()
    
    # Step 2: Run migrations
    await run_migrations()
    print()
    
    # Step 3: Backup marker
    stats = await backup_database()
    print()
    
    print("="*50)
    print("Deployment preparation complete!")
    print(f"Total collections: {len(stats)}")
    print(f"Total documents: {sum(stats.values())}")
    print("="*50)


if __name__ == "__main__":
    asyncio.run(main())
