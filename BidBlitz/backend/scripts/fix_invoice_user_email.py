#!/usr/bin/env python3
"""
Fix invoice seed data by adding user_email field to existing invoices
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

print("Fixing invoice seed data...")

# Find all invoices without user_email field
invoices_without_user_email = list(db.invoices.find({"user_email": {"$exists": False}}, {"_id": 1, "invoice_id": 1, "from_email": 1}))

print(f"Found {len(invoices_without_user_email)} invoices without user_email field")

if len(invoices_without_user_email) > 0:
    # Update each invoice to add user_email field based on from_email
    for invoice in invoices_without_user_email:
        from_email = invoice.get("from_email", "admin@bidblitz.com")
        invoice_id = invoice.get("invoice_id", "unknown")
        
        # Update the invoice
        result = db.invoices.update_one(
            {"_id": invoice["_id"]},
            {"$set": {"user_email": from_email}}
        )
        
        if result.modified_count > 0:
            print(f"  ✅ Updated invoice {invoice_id} with user_email={from_email}")
        else:
            print(f"  ⚠️  Failed to update invoice {invoice_id}")
    
    print(f"\n✅ Fixed {len(invoices_without_user_email)} invoices")
else:
    print("✅ All invoices already have user_email field")

# Verify the fix
admin_invoices = db.invoices.count_documents({"user_email": "admin@bidblitz.com"})
print(f"\nVerification: Found {admin_invoices} invoices for admin@bidblitz.com")

client.close()
