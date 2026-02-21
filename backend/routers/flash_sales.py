"""Flash Sales - Time-limited bid package deals"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone, timedelta
from typing import Optional
import uuid
import os
import stripe

from config import db, logger, FRONTEND_URL
from dependencies import get_current_user, get_admin_user as get_current_admin

router = APIRouter(prefix="/flash-sales", tags=["Flash Sales"])

# Stripe configuration
STRIPE_API_KEY = os.environ.get('STRIPE_API_KEY')
if STRIPE_API_KEY:
    stripe.api_key = STRIPE_API_KEY

# ==================== FLASH SALE PACKAGES ====================

DEFAULT_FLASH_PACKAGES = [
    {
        "id": "flash_50",
        "name": "Starter Flash",
        "bids": 50,
        "original_price": 29.99,
        "flash_price": 19.99,
        "discount_percent": 33,
        "popular": False
    },
    {
        "id": "flash_150",
        "name": "Power Flash",
        "bids": 150,
        "original_price": 74.99,
        "flash_price": 49.99,
        "discount_percent": 33,
        "popular": True
    },
    {
        "id": "flash_300",
        "name": "Mega Flash",
        "bids": 300,
        "original_price": 149.99,
        "flash_price": 89.99,
        "discount_percent": 40,
        "popular": False
    },
    {
        "id": "flash_500",
        "name": "Ultra Flash",
        "bids": 500,
        "original_price": 249.99,
        "flash_price": 139.99,
        "discount_percent": 44,
        "popular": False
    }
]

# ==================== USER ENDPOINTS ====================

@router.get("/active")
async def get_active_flash_sales():
    """Get all currently active flash sales"""
    now = datetime.now(timezone.utc)
    
    # Get active sales from database
    active_sales = await db.flash_sales.find({
        "is_active": True,
        "start_time": {"$lte": now.isoformat()},
        "end_time": {"$gte": now.isoformat()}
    }, {"_id": 0}).to_list(50)
    
    # Add time remaining
    for sale in active_sales:
        end_time = datetime.fromisoformat(sale["end_time"].replace('Z', '+00:00'))
        remaining = (end_time - now).total_seconds()
        sale["seconds_remaining"] = max(0, int(remaining))
        sale["packages"] = sale.get("packages", DEFAULT_FLASH_PACKAGES)
    
    return {
        "sales": active_sales,
        "count": len(active_sales)
    }

@router.get("/upcoming")
async def get_upcoming_flash_sales():
    """Get upcoming flash sales (for notification subscriptions)"""
    now = datetime.now(timezone.utc)
    
    upcoming = await db.flash_sales.find({
        "is_active": True,
        "start_time": {"$gt": now.isoformat()}
    }, {"_id": 0}).sort("start_time", 1).limit(10).to_list(10)
    
    return {"sales": upcoming}

@router.post("/purchase/{sale_id}/{package_id}")
async def purchase_flash_package(
    sale_id: str,
    package_id: str,
    user: dict = Depends(get_current_user)
):
    """Purchase a flash sale package"""
    if not STRIPE_API_KEY:
        raise HTTPException(status_code=503, detail="Zahlungsdienst nicht verfügbar")
    
    now = datetime.now(timezone.utc)
    
    # Verify sale is active
    sale = await db.flash_sales.find_one({
        "id": sale_id,
        "is_active": True,
        "start_time": {"$lte": now.isoformat()},
        "end_time": {"$gte": now.isoformat()}
    })
    
    if not sale:
        raise HTTPException(status_code=404, detail="Flash Sale nicht mehr aktiv")
    
    # Find package
    packages = sale.get("packages", DEFAULT_FLASH_PACKAGES)
    package = next((p for p in packages if p["id"] == package_id), None)
    
    if not package:
        raise HTTPException(status_code=404, detail="Paket nicht gefunden")
    
    # Check purchase limit
    user_purchases = await db.flash_purchases.count_documents({
        "user_id": user["id"],
        "sale_id": sale_id
    })
    
    max_purchases = sale.get("max_per_user", 3)
    if user_purchases >= max_purchases:
        raise HTTPException(status_code=400, detail=f"Maximal {max_purchases} Käufe pro Flash Sale")
    
    try:
        # Create Stripe session
        session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[{
                'price_data': {
                    'currency': 'eur',
                    'product_data': {
                        'name': f"⚡ {package['name']} - {package['bids']} Gebote",
                        'description': f"Flash Sale! Spare {package['discount_percent']}%"
                    },
                    'unit_amount': int(package['flash_price'] * 100)
                },
                'quantity': 1
            }],
            mode='payment',
            success_url=f"{FRONTEND_URL}/payment/success?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{FRONTEND_URL}/flash-sales",
            metadata={
                'type': 'flash_sale',
                'user_id': user["id"],
                'sale_id': sale_id,
                'package_id': package_id,
                'bids': str(package['bids'])
            }
        )
        
        # Record pending purchase
        await db.flash_purchases.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "sale_id": sale_id,
            "package_id": package_id,
            "bids": package["bids"],
            "amount": package["flash_price"],
            "stripe_session_id": session.id,
            "status": "pending",
            "created_at": now.isoformat()
        })
        
        return {"checkout_url": session.url, "session_id": session.id}
        
    except stripe.error.StripeError as e:
        logger.error(f"Flash sale Stripe error: {e}")
        raise HTTPException(status_code=500, detail="Zahlungsfehler")

@router.post("/subscribe/{sale_id}")
async def subscribe_to_flash_sale(sale_id: str, user: dict = Depends(get_current_user)):
    """Subscribe to notifications for a flash sale"""
    sale = await db.flash_sales.find_one({"id": sale_id})
    if not sale:
        raise HTTPException(status_code=404, detail="Flash Sale nicht gefunden")
    
    await db.flash_subscriptions.update_one(
        {"user_id": user["id"], "sale_id": sale_id},
        {
            "$set": {
                "user_id": user["id"],
                "sale_id": sale_id,
                "subscribed_at": datetime.now(timezone.utc).isoformat()
            }
        },
        upsert=True
    )
    
    return {"message": "Du wirst benachrichtigt wenn der Flash Sale startet!"}

# ==================== ADMIN ENDPOINTS ====================

@router.post("/admin/create")
async def create_flash_sale(
    title: str,
    duration_hours: int = 24,
    start_in_hours: int = 0,
    max_per_user: int = 3,
    packages: Optional[list] = None,
    admin: dict = Depends(get_current_admin)
):
    """Create a new flash sale"""
    now = datetime.now(timezone.utc)
    start_time = now + timedelta(hours=start_in_hours)
    end_time = start_time + timedelta(hours=duration_hours)
    
    sale = {
        "id": str(uuid.uuid4()),
        "title": title,
        "packages": packages or DEFAULT_FLASH_PACKAGES,
        "start_time": start_time.isoformat(),
        "end_time": end_time.isoformat(),
        "max_per_user": max_per_user,
        "is_active": True,
        "created_by": admin["id"],
        "created_at": now.isoformat()
    }
    
    await db.flash_sales.insert_one(sale)
    
    # Notify subscribers if sale is starting now
    if start_in_hours == 0:
        await notify_flash_sale_start(sale["id"], title)
    
    logger.info(f"Flash sale created: {title} by {admin.get('name')}")
    
    return {"sale": sale, "message": "Flash Sale erstellt!"}

@router.get("/admin/list")
async def list_all_flash_sales(admin: dict = Depends(get_current_admin)):
    """List all flash sales (admin)"""
    sales = await db.flash_sales.find({}, {"_id": 0}).sort("created_at", -1).limit(50).to_list(50)
    return {"sales": sales}

@router.delete("/admin/{sale_id}")
async def delete_flash_sale(sale_id: str, admin: dict = Depends(get_current_admin)):
    """Deactivate a flash sale"""
    await db.flash_sales.update_one(
        {"id": sale_id},
        {"$set": {"is_active": False}}
    )
    return {"message": "Flash Sale deaktiviert"}

@router.put("/admin/{sale_id}")
async def update_flash_sale(
    sale_id: str,
    title: Optional[str] = None,
    is_active: Optional[bool] = None,
    start_time: Optional[str] = None,
    end_time: Optional[str] = None,
    max_per_user: Optional[int] = None,
    packages: Optional[list] = None,
    sale_type: Optional[str] = None,  # weekend_special, first_buyer_bonus, etc.
    bonus_bids: Optional[int] = None,
    bonus_percent: Optional[int] = None,
    admin: dict = Depends(get_current_admin)
):
    """Update an existing flash sale"""
    sale = await db.flash_sales.find_one({"id": sale_id})
    if not sale:
        raise HTTPException(status_code=404, detail="Flash Sale nicht gefunden")
    
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat(), "updated_by": admin["id"]}
    
    if title is not None:
        update_data["title"] = title
    if is_active is not None:
        update_data["is_active"] = is_active
    if start_time is not None:
        update_data["start_time"] = start_time
    if end_time is not None:
        update_data["end_time"] = end_time
    if max_per_user is not None:
        update_data["max_per_user"] = max_per_user
    if packages is not None:
        update_data["packages"] = packages
    if sale_type is not None:
        update_data["sale_type"] = sale_type
    if bonus_bids is not None:
        update_data["bonus_bids"] = bonus_bids
    if bonus_percent is not None:
        update_data["bonus_percent"] = bonus_percent
    
    await db.flash_sales.update_one({"id": sale_id}, {"$set": update_data})
    
    logger.info(f"Flash sale {sale_id} updated by {admin.get('name')}")
    
    return {"message": "Flash Sale aktualisiert!", "updated": update_data}

@router.get("/admin/stats")
async def get_flash_sale_stats(admin: dict = Depends(get_current_admin)):
    """Get flash sale statistics"""
    now = datetime.now(timezone.utc)
    
    total = await db.flash_sales.count_documents({})
    active = await db.flash_sales.count_documents({
        "is_active": True,
        "start_time": {"$lte": now.isoformat()},
        "end_time": {"$gte": now.isoformat()}
    })
    upcoming = await db.flash_sales.count_documents({
        "is_active": True,
        "start_time": {"$gt": now.isoformat()}
    })
    
    # Total purchases and revenue
    purchases = await db.flash_purchases.find({"status": "completed"}).to_list(10000)
    total_revenue = sum(p.get("amount", 0) for p in purchases)
    total_bids_sold = sum(p.get("bids", 0) for p in purchases)
    
    return {
        "total_sales": total,
        "active_sales": active,
        "upcoming_sales": upcoming,
        "total_purchases": len(purchases),
        "total_revenue": total_revenue,
        "total_bids_sold": total_bids_sold
    }

# ==================== SPECIAL SALE TYPES ====================

@router.post("/admin/create-weekend-special")
async def create_weekend_special(
    bids: int = 300,
    bonus_bids: int = 150,
    price: float = 79.0,
    original_price: float = 119.0,
    duration_hours: int = 48,
    start_time: Optional[str] = None,
    admin: dict = Depends(get_current_admin)
):
    """Create a Weekend Special flash sale"""
    now = datetime.now(timezone.utc)
    
    if start_time:
        start = datetime.fromisoformat(start_time.replace('Z', '+00:00'))
    else:
        # Start next Saturday at 00:00
        days_until_saturday = (5 - now.weekday()) % 7
        if days_until_saturday == 0 and now.hour >= 12:
            days_until_saturday = 7
        start = (now + timedelta(days=days_until_saturday)).replace(hour=0, minute=0, second=0, microsecond=0)
    
    end = start + timedelta(hours=duration_hours)
    discount = int((1 - price/original_price) * 100)
    
    sale = {
        "id": str(uuid.uuid4()),
        "title": "Wochenend-Special",
        "sale_type": "weekend_special",
        "packages": [{
            "id": "weekend_special",
            "name": "Wochenend-Special",
            "bids": bids,
            "bonus_bids": bonus_bids,
            "total_bids": bids + bonus_bids,
            "original_price": original_price,
            "flash_price": price,
            "discount_percent": discount,
            "popular": True
        }],
        "start_time": start.isoformat(),
        "end_time": end.isoformat(),
        "max_per_user": 3,
        "is_active": True,
        "created_by": admin["id"],
        "created_at": now.isoformat()
    }
    
    await db.flash_sales.insert_one(sale)
    
    # Remove _id from sale dict for JSON response
    sale_response = {k: v for k, v in sale.items() if k != '_id'}
    
    logger.info(f"Weekend Special created: {bids}+{bonus_bids} bids for €{price}")
    
    return {"sale": sale_response, "message": "Wochenend-Special erstellt!"}

@router.post("/admin/create-first-buyer-bonus")
async def create_first_buyer_bonus(
    bids: int = 150,
    bonus_bids: int = 100,
    price: float = 49.0,
    original_price: float = 89.0,
    duration_hours: int = 24,
    start_time: Optional[str] = None,
    admin: dict = Depends(get_current_admin)
):
    """Create an Erstkäufer-Bonus (First-time buyer bonus)"""
    now = datetime.now(timezone.utc)
    
    if start_time:
        start = datetime.fromisoformat(start_time.replace('Z', '+00:00'))
    else:
        start = now
    
    end = start + timedelta(hours=duration_hours)
    discount = int((1 - price/original_price) * 100)
    
    sale = {
        "id": str(uuid.uuid4()),
        "title": "Erstkäufer-Bonus",
        "sale_type": "first_buyer_bonus",
        "packages": [{
            "id": "first_buyer_bonus",
            "name": "Erstkäufer-Bonus",
            "bids": bids,
            "bonus_bids": bonus_bids,
            "total_bids": bids + bonus_bids,
            "original_price": original_price,
            "flash_price": price,
            "discount_percent": discount,
            "popular": True,
            "first_purchase_only": True
        }],
        "start_time": start.isoformat(),
        "end_time": end.isoformat(),
        "max_per_user": 1,  # Only once per user
        "first_purchase_only": True,
        "is_active": True,
        "created_by": admin["id"],
        "created_at": now.isoformat()
    }
    
    await db.flash_sales.insert_one(sale)
    
    logger.info(f"First Buyer Bonus created: {bids}+{bonus_bids} bids for €{price}")
    
    return {"sale": sale, "message": "Erstkäufer-Bonus erstellt!"}

# ==================== HELPER FUNCTIONS ====================

async def notify_flash_sale_start(sale_id: str, title: str):
    """Notify all subscribers that a flash sale has started"""
    subscribers = await db.flash_subscriptions.find({"sale_id": sale_id}).to_list(1000)
    
    for sub in subscribers:
        await db.notifications.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": sub["user_id"],
            "type": "flash_sale",
            "title": "⚡ Flash Sale gestartet!",
            "message": f"{title} ist jetzt live! Sichere dir die besten Deals!",
            "action_url": "/flash-sales",
            "read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    logger.info(f"Notified {len(subscribers)} users about flash sale {sale_id}")

async def process_flash_purchase_complete(session_id: str):
    """Process completed flash sale purchase"""
    purchase = await db.flash_purchases.find_one({"stripe_session_id": session_id})
    
    if not purchase or purchase.get("status") == "completed":
        return
    
    # Credit bids
    await db.users.update_one(
        {"id": purchase["user_id"]},
        {"$inc": {"bids_balance": purchase["bids"]}}
    )
    
    # Update purchase status
    await db.flash_purchases.update_one(
        {"id": purchase["id"]},
        {"$set": {"status": "completed", "completed_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Award loyalty points
    try:
        from routers.loyalty import award_purchase_points
        await award_purchase_points(purchase["user_id"], purchase["amount"])
    except:
        pass
    
    logger.info(f"Flash purchase completed: {purchase['bids']} bids for {purchase['user_id']}")

__all__ = ['process_flash_purchase_complete', 'DEFAULT_FLASH_PACKAGES']

flash_sales_router = router
