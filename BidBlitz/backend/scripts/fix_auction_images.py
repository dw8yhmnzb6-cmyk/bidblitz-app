"""
Fix missing image_url in auctions by copying from products
"""
import os
from pymongo import MongoClient

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")

client = MongoClient(MONGO_URL)
db = client[DB_NAME]

print(f"🔧 Fixing auction images in {DB_NAME}...\n")

# Get all auctions without image_url
auctions = list(db.auctions.find({"image_url": {"$exists": False}}, {"_id": 0}))
print(f"Found {len(auctions)} auctions without image_url")

fixed_count = 0
failed_count = 0

for auction in auctions:
    product_id = auction.get("product_id")
    if not product_id:
        print(f"⚠️  Auction {auction.get('id', 'unknown')} has no product_id")
        failed_count += 1
        continue
    
    # Find the product
    product = db.products.find_one({"id": product_id}, {"_id": 0, "image_url": 1, "name": 1})
    
    if not product:
        print(f"⚠️  Product {product_id} not found for auction {auction.get('title', 'unknown')}")
        failed_count += 1
        continue
    
    image_url = product.get("image_url")
    if not image_url:
        print(f"⚠️  Product {product_id} has no image_url")
        failed_count += 1
        continue
    
    # Update the auction with image_url
    result = db.auctions.update_one(
        {"id": auction.get("id")},
        {"$set": {"image_url": image_url}}
    )
    
    if result.modified_count > 0:
        print(f"✅ Fixed: {auction.get('title', 'unknown')} -> {image_url[:60]}...")
        fixed_count += 1
    else:
        failed_count += 1

print(f"\n✅ Fixed {fixed_count} auctions")
if failed_count > 0:
    print(f"⚠️  {failed_count} auctions could not be fixed")

print("\n🎉 Done!")
