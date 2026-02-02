"""
Flash Sales Router - Zeitlich begrenzte Rabatte
"""
from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timezone, timedelta
import os
import stripe
import uuid

from config import db
from dependencies import get_current_user, get_admin_user as get_current_admin

router = APIRouter(prefix="/flash-sales", tags=["flash-sales"])

stripe.api_key = os.environ.get("STRIPE_SECRET_KEY")


@router.get("/active")
async def get_active_flash_sales():
    """Get currently active flash sales"""
    now = datetime.now(timezone.utc)
    
    # Check for active flash sale
    active_sale = await db.flash_sales.find_one({
        "start_time": {"$lte": now.isoformat()},
        "end_time": {"$gte": now.isoformat()},
        "is_active": True
    }, {"_id": 0})
    
    if not active_sale:
        # Check for upcoming sale
        upcoming = await db.flash_sales.find_one({
            "start_time": {"$gt": now.isoformat()},
            "is_active": True
        }, {"_id": 0, "start_time": 1, "discount_percent": 1, "name": 1})
        
        return {
            "has_active_sale": False,
            "upcoming_sale": upcoming
        }
    
    # Calculate remaining time
    end_time = datetime.fromisoformat(active_sale["end_time"].replace('Z', '+00:00'))
    remaining_seconds = int((end_time - now).total_seconds())
    
    return {
        "has_active_sale": True,
        "sale": {
            **active_sale,
            "remaining_seconds": remaining_seconds
        }
    }


@router.get("/bid-packages")
async def get_flash_sale_packages():
    """Get bid packages with flash sale prices if active"""
    now = datetime.now(timezone.utc)
    
    # Base packages
    packages = [
        {"id": "small", "bids": 30, "price": 15.00, "bonus": 0},
        {"id": "medium", "bids": 75, "price": 35.00, "bonus": 5},
        {"id": "large", "bids": 150, "price": 65.00, "bonus": 15},
        {"id": "xl", "bids": 300, "price": 120.00, "bonus": 40},
        {"id": "xxl", "bids": 500, "price": 180.00, "bonus": 80},
        {"id": "mega", "bids": 1000, "price": 320.00, "bonus": 200},
    ]
    
    # Check for active flash sale
    active_sale = await db.flash_sales.find_one({
        "start_time": {"$lte": now.isoformat()},
        "end_time": {"$gte": now.isoformat()},
        "is_active": True
    }, {"_id": 0})
    
    if active_sale:
        discount = active_sale.get("discount_percent", 0) / 100
        for pkg in packages:
            pkg["original_price"] = pkg["price"]
            pkg["price"] = round(pkg["price"] * (1 - discount), 2)
            pkg["discount_percent"] = active_sale.get("discount_percent", 0)
            pkg["flash_sale"] = True
            pkg["bonus_multiplier"] = active_sale.get("bonus_multiplier", 1)
            if pkg["bonus_multiplier"] > 1:
                pkg["bonus"] = int(pkg["bonus"] * pkg["bonus_multiplier"])
        
        end_time = datetime.fromisoformat(active_sale["end_time"].replace('Z', '+00:00'))
        remaining = int((end_time - now).total_seconds())
        
        return {
            "packages": packages,
            "flash_sale_active": True,
            "sale_name": active_sale.get("name", "Flash Sale"),
            "remaining_seconds": remaining,
            "discount_percent": active_sale.get("discount_percent", 0)
        }
    
    return {
        "packages": packages,
        "flash_sale_active": False
    }


@router.post("/purchase/{package_id}")
async def purchase_flash_package(package_id: str, user: dict = Depends(get_current_user)):
    """Purchase bid package (with flash sale discount if active)"""
    packages_data = await get_flash_sale_packages()
    packages = packages_data["packages"]
    
    package = next((p for p in packages if p["id"] == package_id), None)
    if not package:
        raise HTTPException(status_code=404, detail="Paket nicht gefunden")
    
    total_bids = package["bids"] + package.get("bonus", 0)
    
    frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")
    
    try:
        description = f"{package['bids']} Gebote"
        if package.get("bonus", 0) > 0:
            description += f" + {package['bonus']} Bonus"
        if package.get("flash_sale"):
            description += f" (Flash Sale -{package['discount_percent']}%)"
        
        checkout_session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=[{
                "price_data": {
                    "currency": "eur",
                    "product_data": {
                        "name": f"BidBlitz Gebote-Paket",
                        "description": description,
                    },
                    "unit_amount": int(package["price"] * 100),
                },
                "quantity": 1,
            }],
            mode="payment",
            success_url=f"{frontend_url}/buy-bids?success=true&bids={total_bids}",
            cancel_url=f"{frontend_url}/buy-bids?canceled=true",
            metadata={
                "user_id": user["id"],
                "package_id": package_id,
                "bids": total_bids,
                "type": "flash_sale_bids" if package.get("flash_sale") else "bids"
            }
        )
        
        return {"checkout_url": checkout_session.url}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Admin endpoints
@router.post("/create")
async def create_flash_sale(
    name: str,
    discount_percent: int,
    duration_hours: int = 2,
    bonus_multiplier: float = 1.5,
    admin: dict = Depends(get_current_admin)
):
    """Create a new flash sale (Admin only)"""
    now = datetime.now(timezone.utc)
    end_time = now + timedelta(hours=duration_hours)
    
    sale = {
        "id": str(uuid.uuid4()),
        "name": name,
        "discount_percent": min(discount_percent, 70),  # Max 70% discount
        "bonus_multiplier": bonus_multiplier,
        "start_time": now.isoformat(),
        "end_time": end_time.isoformat(),
        "duration_hours": duration_hours,
        "is_active": True,
        "created_by": admin["id"],
        "created_at": now.isoformat()
    }
    
    await db.flash_sales.insert_one(sale)
    
    return {"success": True, "sale": {k: v for k, v in sale.items() if k != "_id"}}


@router.get("/history")
async def get_flash_sale_history(admin: dict = Depends(get_current_admin)):
    """Get flash sale history (Admin only)"""
    sales = await db.flash_sales.find({}, {"_id": 0}).sort("created_at", -1).limit(50).to_list(50)
    return {"sales": sales}


flash_sales_router = router
