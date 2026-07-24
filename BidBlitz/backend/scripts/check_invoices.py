#!/usr/bin/env python3
"""
Check invoice data in database
"""
import os
import sys
from pymongo import MongoClient

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Get MongoDB connection
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017/bidblitz")
client = MongoClient(MONGO_URL)
db = client.get_database()

print("Checking invoice data...")

# Count total invoices
total_invoices = db.invoices.count_documents({})
print(f"Total invoices in database: {total_invoices}")

if total_invoices > 0:
    # Get sample invoices
    sample_invoices = list(db.invoices.find({}, {"_id": 0, "invoice_id": 1, "invoice_number": 1, "user_email": 1, "from_email": 1, "status": 1}).limit(10))
    
    print("\nSample invoices:")
    for inv in sample_invoices:
        print(f"  - {inv.get('invoice_number', 'N/A')}: user_email={inv.get('user_email', 'MISSING')}, from_email={inv.get('from_email', 'N/A')}, status={inv.get('status', 'N/A')}")
    
    # Count by user_email
    print("\nInvoices by user_email:")
    pipeline = [
        {"$group": {"_id": "$user_email", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    user_counts = list(db.invoices.aggregate(pipeline))
    for item in user_counts:
        print(f"  - {item['_id']}: {item['count']} invoices")
else:
    print("No invoices found in database")

client.close()
