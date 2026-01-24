#!/usr/bin/env python3
"""Script to reactivate auctions and ensure 100+ are live"""
import asyncio
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
import os
import random

MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'penny_auction')

async def main():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    # Get all ended auctions
    ended_auctions = await db.auctions.find({"status": "ended"}).to_list(200)
    print(f"🔍 Gefunden: {len(ended_auctions)} beendete Auktionen")
    
    # Reactivate them with new times
    reactivated = 0
    for auction in ended_auctions:
        # Random duration between 10-90 minutes
        duration_minutes = random.randint(10, 90)
        start_time = datetime.now(timezone.utc)
        end_time = start_time + timedelta(minutes=duration_minutes)
        
        # Reset to starting price
        starting_price = round(random.uniform(0.01, 0.10), 2)
        
        await db.auctions.update_one(
            {"id": auction["id"]},
            {"$set": {
                "status": "active",
                "current_price": starting_price,
                "starting_price": starting_price,
                "start_time": start_time.isoformat(),
                "end_time": end_time.isoformat(),
                "duration_seconds": duration_minutes * 60,
                "last_bidder_id": None,
                "last_bidder_name": None,
                "winner_id": None,
                "total_bids": 0
            }}
        )
        reactivated += 1
    
    print(f"✅ {reactivated} Auktionen reaktiviert!")
    
    # Count active auctions now
    active_count = await db.auctions.count_documents({"status": "active"})
    print(f"\n📊 Aktive Auktionen: {active_count}")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(main())
