"""
BidBlitz V2 - Real Restaurant Dashboard API
Full order and menu management for approved restaurants
"""

from fastapi import APIRouter, HTTPException, Request, UploadFile, File
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone, timedelta
import secrets

from core.database import db
from core.security import get_current_user

router = APIRouter(prefix="/api/restaurant-dashboard", tags=["Restaurant Dashboard"])


# ═══════════════════════════════════════════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════════════════════════════════════════

async def get_approved_restaurant(request: Request):
    """Get current user's approved restaurant."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    restaurant = await db.restaurants.find_one({
        "owner_id": user_id,
        "is_approved": True
    })
    
    if not restaurant:
        raise HTTPException(status_code=403, detail="Kein genehmigtes Restaurant")
    
    restaurant.pop("_id", None)
    return restaurant, user


async def create_notification(user_id: str, title: str, message: str, type_: str = "info"):
    """Create a notification."""
    await db.notifications.insert_one({
        "notification_id": secrets.token_hex(8),
        "user_id": user_id,
        "title": title,
        "message": message,
        "type": type_,
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    })


# ═══════════════════════════════════════════════════════════════════════════════
# MODELS
# ═══════════════════════════════════════════════════════════════════════════════

class MenuItemCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    price: float = Field(..., gt=0, le=1000)
    category: str = Field(default="main")
    image_url: Optional[str] = None
    is_available: bool = True


class MenuItemUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = Field(None, gt=0, le=1000)
    category: Optional[str] = None
    image_url: Optional[str] = None
    is_available: Optional[bool] = None


class OrderStatusUpdate(BaseModel):
    status: str = Field(..., pattern="^(accepted|rejected|preparing|ready|picked_up|delivered|canceled)$")


class RestaurantProfileUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    delivery_time: Optional[str] = None
    is_open: Optional[bool] = None


# ═══════════════════════════════════════════════════════════════════════════════
# RESTAURANT STATUS & PROFILE
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/status")
async def get_restaurant_status(request: Request):
    """Get restaurant dashboard status."""
    restaurant, user = await get_approved_restaurant(request)
    
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=today_start.weekday())
    
    # Get orders
    today_orders = await db.food_orders.find({
        "restaurant_id": restaurant["restaurant_id"],
        "status": "delivered",
        "delivered_at": {"$gte": today_start.isoformat()}
    }).to_list(200)
    
    week_orders = await db.food_orders.find({
        "restaurant_id": restaurant["restaurant_id"],
        "status": "delivered",
        "delivered_at": {"$gte": week_start.isoformat()}
    }).to_list(1000)
    
    total_orders = await db.food_orders.count_documents({
        "restaurant_id": restaurant["restaurant_id"],
        "status": "delivered"
    })
    
    today_revenue = sum(o.get("restaurant_earnings", o.get("total", 0) * 0.85) for o in today_orders)
    week_revenue = sum(o.get("restaurant_earnings", o.get("total", 0) * 0.85) for o in week_orders)
    
    # Get pending/active orders
    pending_orders = await db.food_orders.find({
        "restaurant_id": restaurant["restaurant_id"],
        "status": "pending"
    }).sort("created_at", -1).to_list(20)
    
    active_orders = await db.food_orders.find({
        "restaurant_id": restaurant["restaurant_id"],
        "status": {"$in": ["accepted", "preparing", "ready"]}
    }).sort("created_at", -1).to_list(50)
    
    for o in pending_orders + active_orders:
        o.pop("_id", None)
    
    # Get menu items count
    menu_count = await db.restaurant_menu.count_documents({
        "restaurant_id": restaurant["restaurant_id"]
    })
    
    return {
        "restaurant_id": restaurant["restaurant_id"],
        "name": restaurant.get("name"),
        "is_open": restaurant.get("is_open", False),
        "rating": restaurant.get("rating", 4.5),
        "category": restaurant.get("category"),
        "address": restaurant.get("address"),
        "stats": {
            "today_revenue": round(today_revenue, 2),
            "today_orders": len(today_orders),
            "week_revenue": round(week_revenue, 2),
            "week_orders": len(week_orders),
            "total_orders": total_orders,
            "menu_items": menu_count,
        },
        "pending_orders": pending_orders,
        "active_orders": active_orders,
        "balance": round(restaurant.get("balance", 0), 2),
    }


@router.post("/toggle-open")
async def toggle_restaurant_open(request: Request):
    """Toggle restaurant open/closed status."""
    restaurant, _ = await get_approved_restaurant(request)
    
    new_status = not restaurant.get("is_open", False)
    
    await db.restaurants.update_one(
        {"restaurant_id": restaurant["restaurant_id"]},
        {"$set": {"is_open": new_status, "status_changed_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"ok": True, "is_open": new_status, "message": "Geöffnet" if new_status else "Geschlossen"}


@router.put("/profile")
async def update_restaurant_profile(update: RestaurantProfileUpdate, request: Request):
    """Update restaurant profile."""
    restaurant, _ = await get_approved_restaurant(request)
    
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    if update.name is not None:
        update_data["name"] = update.name
    if update.description is not None:
        update_data["description"] = update.description
    if update.address is not None:
        update_data["address"] = update.address
    if update.phone is not None:
        update_data["phone"] = update.phone
    if update.delivery_time is not None:
        update_data["delivery_time"] = update.delivery_time
    if update.is_open is not None:
        update_data["is_open"] = update.is_open
    
    await db.restaurants.update_one(
        {"restaurant_id": restaurant["restaurant_id"]},
        {"$set": update_data}
    )
    
    return {"ok": True, "message": "Profil aktualisiert"}


# ═══════════════════════════════════════════════════════════════════════════════
# MENU MANAGEMENT
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/menu")
async def get_menu(request: Request):
    """Get restaurant menu items."""
    restaurant, _ = await get_approved_restaurant(request)
    
    items = await db.restaurant_menu.find({
        "restaurant_id": restaurant["restaurant_id"]
    }).sort("category", 1).to_list(500)
    
    for i in items:
        i.pop("_id", None)
    
    # Group by category
    categories = {}
    for item in items:
        cat = item.get("category", "Sonstiges")
        if cat not in categories:
            categories[cat] = []
        categories[cat].append(item)
    
    return {
        "items": items,
        "categories": categories,
        "total": len(items)
    }


@router.post("/menu")
async def create_menu_item(item: MenuItemCreate, request: Request):
    """Create a new menu item."""
    restaurant, _ = await get_approved_restaurant(request)
    
    now = datetime.now(timezone.utc)
    
    menu_item = {
        "item_id": secrets.token_hex(8),
        "restaurant_id": restaurant["restaurant_id"],
        "name": item.name,
        "description": item.description,
        "price": round(item.price, 2),
        "category": item.category,
        "image_url": item.image_url,
        "is_available": item.is_available,
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
    }
    
    await db.restaurant_menu.insert_one(menu_item)
    menu_item.pop("_id", None)
    
    return {"ok": True, "item": menu_item}


@router.put("/menu/{item_id}")
async def update_menu_item(item_id: str, update: MenuItemUpdate, request: Request):
    """Update a menu item."""
    restaurant, _ = await get_approved_restaurant(request)
    
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    if update.name is not None:
        update_data["name"] = update.name
    if update.description is not None:
        update_data["description"] = update.description
    if update.price is not None:
        update_data["price"] = round(update.price, 2)
    if update.category is not None:
        update_data["category"] = update.category
    if update.image_url is not None:
        update_data["image_url"] = update.image_url
    if update.is_available is not None:
        update_data["is_available"] = update.is_available
    
    result = await db.restaurant_menu.update_one(
        {"item_id": item_id, "restaurant_id": restaurant["restaurant_id"]},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Artikel nicht gefunden")
    
    return {"ok": True, "message": "Artikel aktualisiert"}


@router.delete("/menu/{item_id}")
async def delete_menu_item(item_id: str, request: Request):
    """Delete a menu item."""
    restaurant, _ = await get_approved_restaurant(request)
    
    result = await db.restaurant_menu.delete_one({
        "item_id": item_id,
        "restaurant_id": restaurant["restaurant_id"]
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Artikel nicht gefunden")
    
    return {"ok": True, "message": "Artikel gelöscht"}


# ═══════════════════════════════════════════════════════════════════════════════
# ORDER MANAGEMENT
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/orders")
async def get_orders(request: Request, status: Optional[str] = None, limit: int = 50):
    """Get restaurant orders."""
    restaurant, _ = await get_approved_restaurant(request)
    
    query = {"restaurant_id": restaurant["restaurant_id"]}
    
    if status:
        if status == "active":
            query["status"] = {"$in": ["pending", "accepted", "preparing", "ready"]}
        elif status == "completed":
            query["status"] = {"$in": ["delivered", "picked_up"]}
        elif status == "canceled":
            query["status"] = "canceled"
        else:
            query["status"] = status
    
    orders = await db.food_orders.find(query).sort("created_at", -1).limit(limit).to_list(limit)
    
    for o in orders:
        o.pop("_id", None)
    
    return {"orders": orders, "total": len(orders)}


@router.get("/orders/{order_id}")
async def get_order_details(order_id: str, request: Request):
    """Get order details."""
    restaurant, _ = await get_approved_restaurant(request)
    
    order = await db.food_orders.find_one({
        "order_id": order_id,
        "restaurant_id": restaurant["restaurant_id"]
    })
    
    if not order:
        raise HTTPException(status_code=404, detail="Bestellung nicht gefunden")
    
    order.pop("_id", None)
    
    return {"order": order}


@router.post("/orders/{order_id}/status")
async def update_order_status(order_id: str, update: OrderStatusUpdate, request: Request):
    """Update order status."""
    restaurant, _ = await get_approved_restaurant(request)
    
    order = await db.food_orders.find_one({
        "order_id": order_id,
        "restaurant_id": restaurant["restaurant_id"]
    })
    
    if not order:
        raise HTTPException(status_code=404, detail="Bestellung nicht gefunden")
    
    now = datetime.now(timezone.utc)
    update_data = {"status": update.status, "updated_at": now.isoformat()}
    
    # Handle specific status updates
    if update.status == "accepted":
        update_data["accepted_at"] = now.isoformat()
        await create_notification(
            order["customer_id"],
            "Bestellung angenommen!",
            f"{restaurant['name']} bereitet deine Bestellung vor.",
            "order_accepted"
        )
    
    elif update.status == "rejected":
        update_data["rejected_at"] = now.isoformat()
        # Refund customer
        total = order.get("total", 0)
        from bson import ObjectId
        try:
            await db.users.update_one(
                {"_id": ObjectId(order["customer_id"])},
                {"$inc": {"balance": total}}
            )
        except:
            pass
        await create_notification(
            order["customer_id"],
            "Bestellung abgelehnt",
            f"Leider musste {restaurant['name']} deine Bestellung ablehnen. €{total:.2f} wurden zurückerstattet.",
            "order_rejected"
        )
    
    elif update.status == "preparing":
        update_data["preparing_at"] = now.isoformat()
        await create_notification(
            order["customer_id"],
            "Wird zubereitet",
            "Dein Essen wird zubereitet!",
            "order_preparing"
        )
    
    elif update.status == "ready":
        update_data["ready_at"] = now.isoformat()
        await create_notification(
            order["customer_id"],
            "Bestellung fertig!",
            "Dein Essen ist bereit zur Abholung/Lieferung.",
            "order_ready"
        )
    
    elif update.status == "picked_up":
        update_data["picked_up_at"] = now.isoformat()
        await create_notification(
            order["customer_id"],
            "Fahrer unterwegs",
            "Dein Essen ist unterwegs zu dir!",
            "order_picked_up"
        )
    
    elif update.status == "delivered":
        update_data["delivered_at"] = now.isoformat()
        
        # Add earnings to restaurant
        total = order.get("total", 0)
        restaurant_earnings = round(total * 0.85, 2)  # Restaurant gets 85%
        update_data["restaurant_earnings"] = restaurant_earnings
        
        await db.restaurants.update_one(
            {"restaurant_id": restaurant["restaurant_id"]},
            {"$inc": {"balance": restaurant_earnings, "total_orders": 1}}
        )
        
        await create_notification(
            order["customer_id"],
            "Guten Appetit!",
            "Deine Bestellung wurde geliefert. Guten Appetit!",
            "order_delivered"
        )
    
    elif update.status == "canceled":
        update_data["canceled_at"] = now.isoformat()
        # Refund if not already rejected
        if order.get("status") not in ["rejected", "canceled"]:
            total = order.get("total", 0)
            from bson import ObjectId
            try:
                await db.users.update_one(
                    {"_id": ObjectId(order["customer_id"])},
                    {"$inc": {"balance": total}}
                )
            except:
                pass
        await create_notification(
            order["customer_id"],
            "Bestellung storniert",
            "Deine Bestellung wurde storniert.",
            "order_canceled"
        )
    
    await db.food_orders.update_one(
        {"order_id": order_id},
        {"$set": update_data}
    )
    
    return {"ok": True, "status": update.status}


# ═══════════════════════════════════════════════════════════════════════════════
# ORDER HISTORY & STATS
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/history")
async def get_order_history(request: Request, days: int = 30, limit: int = 100):
    """Get order history."""
    restaurant, _ = await get_approved_restaurant(request)
    
    since = datetime.now(timezone.utc) - timedelta(days=days)
    
    orders = await db.food_orders.find({
        "restaurant_id": restaurant["restaurant_id"],
        "created_at": {"$gte": since.isoformat()}
    }).sort("created_at", -1).limit(limit).to_list(limit)
    
    for o in orders:
        o.pop("_id", None)
    
    # Calculate stats
    delivered = [o for o in orders if o.get("status") == "delivered"]
    canceled = [o for o in orders if o.get("status") in ["canceled", "rejected"]]
    
    total_revenue = sum(o.get("restaurant_earnings", 0) for o in delivered)
    
    return {
        "orders": orders,
        "stats": {
            "total_orders": len(orders),
            "delivered": len(delivered),
            "canceled": len(canceled),
            "revenue": round(total_revenue, 2),
            "average_order": round(total_revenue / len(delivered), 2) if delivered else 0,
        }
    }


@router.get("/stats")
async def get_restaurant_stats(request: Request):
    """Get detailed restaurant statistics."""
    restaurant, _ = await get_approved_restaurant(request)
    
    now = datetime.now(timezone.utc)
    
    # Daily stats for last 7 days
    daily_stats = []
    for i in range(7):
        day_start = (now - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        
        day_orders = await db.food_orders.find({
            "restaurant_id": restaurant["restaurant_id"],
            "status": "delivered",
            "delivered_at": {"$gte": day_start.isoformat(), "$lt": day_end.isoformat()}
        }).to_list(500)
        
        daily_stats.append({
            "date": day_start.strftime("%Y-%m-%d"),
            "orders": len(day_orders),
            "revenue": round(sum(o.get("restaurant_earnings", 0) for o in day_orders), 2)
        })
    
    # Top items
    pipeline = [
        {"$match": {"restaurant_id": restaurant["restaurant_id"], "status": "delivered"}},
        {"$unwind": "$items"},
        {"$group": {"_id": "$items.name", "count": {"$sum": "$items.quantity"}}},
        {"$sort": {"count": -1}},
        {"$limit": 10}
    ]
    top_items = await db.food_orders.aggregate(pipeline).to_list(10)
    
    return {
        "daily_stats": daily_stats,
        "top_items": top_items,
        "rating": restaurant.get("rating", 4.5),
        "total_reviews": restaurant.get("total_reviews", 0),
    }


# ═══════════════════════════════════════════════════════════════════════════════
# DELIVERY DRIVER OPERATIONS (for delivery flow)
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/available-deliveries")
async def get_available_deliveries(request: Request):
    """Get orders ready for delivery (for delivery drivers)."""
    user = await get_current_user(request)
    
    # Check if user is a delivery driver
    driver = await db.drivers.find_one({
        "user_id": str(user["_id"]),
        "is_verified": True,
        "driver_type": {"$in": ["delivery", "both"]}
    })
    
    if not driver:
        raise HTTPException(status_code=403, detail="Kein Lieferfahrer")
    
    orders = await db.food_orders.find({
        "status": "ready",
        "delivery_driver_id": None
    }).sort("ready_at", 1).to_list(20)
    
    for o in orders:
        o.pop("_id", None)
        # Get restaurant info
        rest = await db.restaurants.find_one({"restaurant_id": o.get("restaurant_id")})
        if rest:
            o["restaurant_name"] = rest.get("name")
            o["restaurant_address"] = rest.get("address")
            o["restaurant_lat"] = rest.get("lat")
            o["restaurant_lng"] = rest.get("lng")
    
    return {"orders": orders, "total": len(orders)}


@router.post("/accept-delivery/{order_id}")
async def accept_delivery(order_id: str, request: Request):
    """Delivery driver accepts an order."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    driver = await db.drivers.find_one({
        "user_id": user_id,
        "is_verified": True,
        "driver_type": {"$in": ["delivery", "both"]}
    })
    
    if not driver:
        raise HTTPException(status_code=403, detail="Kein Lieferfahrer")
    
    result = await db.food_orders.update_one(
        {"order_id": order_id, "status": "ready", "delivery_driver_id": None},
        {"$set": {
            "delivery_driver_id": driver["driver_id"],
            "delivery_accepted_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=400, detail="Bestellung nicht verfügbar")
    
    return {"ok": True, "message": "Lieferung angenommen"}


@router.post("/pickup-delivery/{order_id}")
async def pickup_delivery(order_id: str, request: Request):
    """Mark order as picked up from restaurant."""
    user = await get_current_user(request)
    
    driver = await db.drivers.find_one({
        "user_id": str(user["_id"]),
        "is_verified": True
    })
    
    if not driver:
        raise HTTPException(status_code=403, detail="Kein Lieferfahrer")
    
    result = await db.food_orders.update_one(
        {"order_id": order_id, "delivery_driver_id": driver["driver_id"]},
        {"$set": {
            "status": "picked_up",
            "picked_up_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Bestellung nicht gefunden")
    
    # Get order for notification
    order = await db.food_orders.find_one({"order_id": order_id})
    if order:
        await create_notification(
            order["customer_id"],
            "Fahrer unterwegs!",
            "Dein Essen ist auf dem Weg zu dir.",
            "order_picked_up"
        )
    
    return {"ok": True, "message": "Abholung bestätigt"}


@router.post("/deliver/{order_id}")
async def complete_delivery(order_id: str, request: Request):
    """Mark order as delivered."""
    user = await get_current_user(request)
    
    driver = await db.drivers.find_one({
        "user_id": str(user["_id"]),
        "is_verified": True
    })
    
    if not driver:
        raise HTTPException(status_code=403, detail="Kein Lieferfahrer")
    
    order = await db.food_orders.find_one({
        "order_id": order_id,
        "delivery_driver_id": driver["driver_id"]
    })
    
    if not order:
        raise HTTPException(status_code=404, detail="Bestellung nicht gefunden")
    
    now = datetime.now(timezone.utc)
    
    # Calculate delivery earnings
    delivery_fee = order.get("delivery_fee", 2.99)
    driver_earnings = round(delivery_fee * 0.80, 2)
    
    await db.food_orders.update_one(
        {"order_id": order_id},
        {"$set": {
            "status": "delivered",
            "delivered_at": now.isoformat(),
            "delivery_earnings": driver_earnings
        }}
    )
    
    # Add earnings to driver
    await db.drivers.update_one(
        {"driver_id": driver["driver_id"]},
        {"$inc": {"balance": driver_earnings, "total_deliveries": 1}}
    )
    
    # Notify customer
    await create_notification(
        order["customer_id"],
        "Guten Appetit!",
        "Deine Bestellung wurde geliefert!",
        "order_delivered"
    )
    
    return {"ok": True, "earnings": driver_earnings, "message": "Lieferung abgeschlossen"}



# ═══════════════════════════════════════════════════════════════════════════════
# DRIVER ASSIGNMENT - Restaurant assigns drivers for delivery
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/available-drivers")
async def get_available_drivers(request: Request):
    """Get list of available (online & verified) drivers for delivery."""
    restaurant, _ = await get_approved_restaurant(request)
    
    # Find drivers that are online and verified
    drivers = await db.drivers.find({
        "is_online": True,
        "is_verified": True,
        "current_ride_id": None  # Not currently on a ride
    }).to_list(50)
    
    result = []
    for d in drivers:
        result.append({
            "driver_id": d.get("driver_id"),
            "name": d.get("name", "Fahrer"),
            "rating": d.get("rating", 4.5),
            "completed_deliveries": d.get("completed_deliveries", 0),
            "vehicle_type": d.get("vehicle_type", "car"),
            "phone": d.get("phone"),
            "current_lat": d.get("current_lat"),
            "current_lng": d.get("current_lng"),
        })
    
    return {"drivers": result, "count": len(result)}


class AssignDriverRequest(BaseModel):
    driver_id: str


@router.post("/orders/{order_id}/assign-driver")
async def assign_driver_to_order(order_id: str, req: AssignDriverRequest, request: Request):
    """Assign a driver to deliver an order."""
    restaurant, _ = await get_approved_restaurant(request)
    
    # Get the order
    order = await db.food_orders.find_one({
        "order_id": order_id,
        "restaurant_id": restaurant["restaurant_id"]
    })
    
    if not order:
        raise HTTPException(status_code=404, detail="Bestellung nicht gefunden")
    
    if order.get("status") not in ["accepted", "preparing", "ready"]:
        raise HTTPException(status_code=400, detail="Bestellung kann keinen Fahrer zugewiesen bekommen")
    
    # Get the driver
    driver = await db.drivers.find_one({
        "driver_id": req.driver_id,
        "is_online": True,
        "is_verified": True
    })
    
    if not driver:
        raise HTTPException(status_code=404, detail="Fahrer nicht verfügbar")
    
    now = datetime.now(timezone.utc)
    
    # Assign driver to order
    await db.food_orders.update_one(
        {"order_id": order_id},
        {"$set": {
            "driver_id": req.driver_id,
            "driver_name": driver.get("name", "Fahrer"),
            "driver_phone": driver.get("phone"),
            "driver_assigned_at": now.isoformat(),
            "updated_at": now.isoformat()
        }}
    )
    
    # Mark driver as busy
    await db.drivers.update_one(
        {"driver_id": req.driver_id},
        {"$set": {
            "current_delivery_id": order_id,
            "updated_at": now.isoformat()
        }}
    )
    
    # Notify driver
    driver_user_id = driver.get("user_id")
    if driver_user_id:
        await create_notification(
            driver_user_id,
            "Neue Lieferung!",
            f"Du wurdest für eine Lieferung von {restaurant['name']} zugewiesen.",
            "delivery_assigned"
        )
    
    # Notify customer
    await create_notification(
        order["customer_id"],
        "Fahrer zugewiesen!",
        f"{driver.get('name', 'Ein Fahrer')} wird deine Bestellung liefern.",
        "driver_assigned"
    )
    
    return {
        "ok": True,
        "message": f"Fahrer {driver.get('name')} zugewiesen",
        "driver": {
            "driver_id": req.driver_id,
            "name": driver.get("name"),
            "phone": driver.get("phone")
        }
    }


@router.post("/orders/{order_id}/remove-driver")
async def remove_driver_from_order(order_id: str, request: Request):
    """Remove assigned driver from an order."""
    restaurant, _ = await get_approved_restaurant(request)
    
    order = await db.food_orders.find_one({
        "order_id": order_id,
        "restaurant_id": restaurant["restaurant_id"]
    })
    
    if not order:
        raise HTTPException(status_code=404, detail="Bestellung nicht gefunden")
    
    driver_id = order.get("driver_id")
    
    if not driver_id:
        raise HTTPException(status_code=400, detail="Kein Fahrer zugewiesen")
    
    now = datetime.now(timezone.utc)
    
    # Remove driver from order
    await db.food_orders.update_one(
        {"order_id": order_id},
        {"$unset": {
            "driver_id": "",
            "driver_name": "",
            "driver_phone": "",
            "driver_assigned_at": ""
        }, "$set": {"updated_at": now.isoformat()}}
    )
    
    # Free up the driver
    await db.drivers.update_one(
        {"driver_id": driver_id},
        {"$unset": {"current_delivery_id": ""}, "$set": {"updated_at": now.isoformat()}}
    )
    
    return {"ok": True, "message": "Fahrer entfernt"}


@router.get("/orders/{order_id}/tracking")
async def get_order_tracking(order_id: str, request: Request):
    """Get real-time tracking info for an order (for customers)."""
    # This endpoint can be called by customers too
    order = await db.food_orders.find_one({"order_id": order_id})
    
    if not order:
        raise HTTPException(status_code=404, detail="Bestellung nicht gefunden")
    
    order.pop("_id", None)
    
    # Get driver location if assigned
    driver_location = None
    if order.get("driver_id"):
        driver = await db.drivers.find_one({"driver_id": order["driver_id"]})
        if driver:
            driver_location = {
                "lat": driver.get("current_lat"),
                "lng": driver.get("current_lng"),
                "name": driver.get("name"),
                "phone": driver.get("phone"),
                "vehicle_type": driver.get("vehicle_type"),
            }
    
    # Get restaurant location
    restaurant = await db.restaurants.find_one({"restaurant_id": order.get("restaurant_id")})
    restaurant_location = None
    if restaurant:
        restaurant_location = {
            "lat": restaurant.get("lat"),
            "lng": restaurant.get("lng"),
            "name": restaurant.get("name"),
            "address": restaurant.get("address"),
        }
    
    return {
        "order_id": order_id,
        "status": order.get("status"),
        "driver": driver_location,
        "restaurant": restaurant_location,
        "delivery_address": order.get("delivery_address"),
        "estimated_delivery": order.get("estimated_delivery"),
        "created_at": order.get("created_at"),
        "accepted_at": order.get("accepted_at"),
        "preparing_at": order.get("preparing_at"),
        "ready_at": order.get("ready_at"),
        "picked_up_at": order.get("picked_up_at"),
        "delivered_at": order.get("delivered_at"),
    }
