"""
Create Demo Staff Member for Testing
=====================================
Run: python scripts/create_demo_staff.py
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from datetime import datetime, timezone
from uuid import uuid4

MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "bidblitz")

async def create_demo_staff():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    # Demo staff member
    staff = {
        "id": "demo-staff-001",
        "merchant_id": "test-merchant",
        "name": "Demo Mitarbeiter",
        "email": "mitarbeiter@bidblitz.com",
        "phone": "+4912345678",
        "role": "employee",
        "hourly_rate": 15.0,
        "vacation_days_yearly": 24,
        "vacation_days_used": 0,
        "active": True,
        "password_hash": None,  # Will be set on first login
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Check if already exists
    existing = await db.staff_members.find_one({"email": staff["email"]})
    if existing:
        print(f"✓ Demo staff member already exists: {staff['email']}")
    else:
        await db.staff_members.insert_one(staff)
        print(f"✓ Created demo staff member: {staff['email']}")
    
    print(f"\nLogin Credentials:")
    print(f"  Email: {staff['email']}")
    print(f"  Password: beliebig (wird beim ersten Login gesetzt)")
    print(f"\nLogin URL: /staff/login")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(create_demo_staff())
