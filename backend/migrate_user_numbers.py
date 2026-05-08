"""
Migration Script: Add user_number to existing users
Run this once to assign unique numbers to all existing users
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import random
import os

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = "test_database"

async def assign_user_numbers():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    users = await db.users.find({"user_number": {"$exists": False}}).to_list(1000)
    
    print(f"Found {len(users)} users without user_number")
    
    for user in users:
        # Generate unique number
        while True:
            user_number = f"BE{random.randint(10000, 99999)}"
            existing = await db.users.find_one({"user_number": user_number})
            if not existing:
                break
        
        # Update user
        await db.users.update_one(
            {"_id": user["_id"]},
            {"$set": {"user_number": user_number}}
        )
        
        print(f"✓ Assigned {user_number} to {user.get('email')}")
    
    print(f"\n✅ Migration complete: {len(users)} users updated")
    client.close()

if __name__ == "__main__":
    asyncio.run(assign_user_numbers())
