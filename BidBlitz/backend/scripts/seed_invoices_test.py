#!/usr/bin/env python3
"""
Seed invoices for testing
"""
import os
import sys
import random
from datetime import datetime, timedelta
from pymongo import MongoClient

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Get MongoDB connection
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017/bidblitz")
client = MongoClient(MONGO_URL)
db = client.get_database()

NOW = datetime.utcnow()

def rid():
    return ''.join(random.choices('abcdefghijklmnopqrstuvwxyz0123456789', k=12))

def ts(days_ago):
    return (NOW - timedelta(days=days_ago)).isoformat() + "Z"

NAMES = ["Max Müller", "Anna Schmidt", "Peter Weber", "Lisa Meyer", "Tom Fischer"]

print("Seeding invoices for testing...")

# Check current count
current_count = db.invoices.count_documents({})
print(f"Current invoice count: {current_count}")

# Create invoices
invoices = []
for i in range(8):
    amount = round(random.uniform(50, 500), 2)
    tax = round(amount * 0.19, 2)
    owner_email = "admin@bidblitz.com"  # Always use admin email for testing
    
    invoices.append({
        "invoice_id": f"inv_{rid()}",
        "invoice_number": f"INV-2026{i+1:04d}",
        "user_email": owner_email,
        "from_name": "BidBlitz GmbH",
        "from_email": owner_email,
        "client_name": random.choice(NAMES),
        "client_email": f"kunde{i+1}@email.de",
        "items": [
            {
                "description": random.choice(["Beratung", "Webdesign", "Marketing", "Entwicklung"]),
                "quantity": random.randint(1, 5),
                "unit_price": round(amount / random.randint(1, 5), 2),
                "total": amount
            },
        ],
        "subtotal": amount,
        "tax": tax,
        "total": round(amount + tax, 2),
        "currency": "EUR",
        "status": random.choice(["paid", "sent", "overdue"]),
        "due_date": (NOW + timedelta(days=random.randint(-10, 30))).strftime("%Y-%m-%d"),
        "created_at": ts(random.randint(1, 30)),
        "updated_at": ts(0),
    })

# Insert invoices
if len(invoices) > 0:
    result = db.invoices.insert_many(invoices)
    print(f"✅ Inserted {len(result.inserted_ids)} invoices")
    
    # Verify
    admin_count = db.invoices.count_documents({"user_email": "admin@bidblitz.com"})
    print(f"✅ Verification: {admin_count} invoices for admin@bidblitz.com")
    
    # Show sample
    sample = db.invoices.find_one({"user_email": "admin@bidblitz.com"}, {"_id": 0, "invoice_number": 1, "client_name": 1, "total": 1, "status": 1})
    if sample:
        print(f"   Sample: {sample}")
else:
    print("❌ No invoices to insert")

client.close()
