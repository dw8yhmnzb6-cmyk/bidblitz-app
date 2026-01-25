"""
Script to delete the 50 oldest auctions from the database
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from datetime import datetime

async def delete_oldest_auctions():
    mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    client = AsyncIOMotorClient(mongo_url)
    db = client["bidblitz"]
    
    # Get total auction count
    total_auctions = await db.auctions.count_documents({})
    print(f"📊 Aktuelle Anzahl Auktionen: {total_auctions}")
    
    if total_auctions <= 50:
        print("❌ Weniger als 50 Auktionen vorhanden. Löschung abgebrochen.")
        client.close()
        return
    
    # Find the 50 oldest auctions (by created_at or _id)
    oldest_auctions = await db.auctions.find({}).sort("created_at", 1).limit(50).to_list(length=50)
    
    if not oldest_auctions:
        # Fallback: sort by _id (ObjectId contains timestamp)
        oldest_auctions = await db.auctions.find({}).sort("_id", 1).limit(50).to_list(length=50)
    
    if oldest_auctions:
        auction_ids = [auction["_id"] for auction in oldest_auctions]
        
        # Print info about auctions to be deleted
        print(f"\n🗑️  Lösche die 50 ältesten Auktionen:")
        for i, auction in enumerate(oldest_auctions[:5]):
            product_id = auction.get("product_id", "N/A")
            status = auction.get("status", "N/A")
            created = auction.get("created_at", "N/A")
            print(f"   {i+1}. Status: {status}, Erstellt: {created}")
        print(f"   ... und {len(oldest_auctions) - 5} weitere")
        
        # Delete auctions
        result = await db.auctions.delete_many({"_id": {"$in": auction_ids}})
        print(f"\n✅ {result.deleted_count} Auktionen erfolgreich gelöscht!")
        
        # Show new total
        new_total = await db.auctions.count_documents({})
        print(f"📊 Neue Anzahl Auktionen: {new_total}")
    else:
        print("❌ Keine Auktionen gefunden")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(delete_oldest_auctions())
