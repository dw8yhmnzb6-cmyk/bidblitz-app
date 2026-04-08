"""
BidBlitz V2 - Food Delivery Module (Wolt/Lieferando Style)
Restaurant discovery, ordering, real-time tracking, and delivery.
"""

import secrets
import math
import random
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional, List
from bson import ObjectId

from core.database import db
from core.security import get_current_user

router = APIRouter(prefix="/api/food", tags=["Food Delivery"])

# ══════════════════════════════════════
# CONFIGURATION
# ══════════════════════════════════════
DELIVERY_FEE_BASE = 1.99
DELIVERY_FEE_PER_KM = 0.50
MIN_ORDER_AMOUNT = 10.00
SERVICE_FEE_PERCENT = 0.10
SMALL_ORDER_FEE = 2.00
SMALL_ORDER_THRESHOLD = 15.00

# Restaurant categories
CATEGORIES = [
    {"id": "pizza", "name": "Pizza", "icon": "pizza-slice"},
    {"id": "burger", "name": "Burger", "icon": "burger"},
    {"id": "sushi", "name": "Sushi", "icon": "fish"},
    {"id": "asian", "name": "Asiatisch", "icon": "bowl-rice"},
    {"id": "italian", "name": "Italienisch", "icon": "utensils"},
    {"id": "german", "name": "Deutsch", "icon": "beer-mug-empty"},
    {"id": "mexican", "name": "Mexikanisch", "icon": "pepper-hot"},
    {"id": "indian", "name": "Indisch", "icon": "bowl-food"},
    {"id": "kebab", "name": "Döner & Kebab", "icon": "drumstick-bite"},
    {"id": "healthy", "name": "Healthy", "icon": "leaf"},
    {"id": "breakfast", "name": "Frühstück", "icon": "egg"},
    {"id": "dessert", "name": "Desserts", "icon": "ice-cream"},
]

# Sample restaurants
RESTAURANTS = [
    {
        "name": "Luigi's Pizzeria",
        "category": "pizza",
        "rating": 4.7,
        "delivery_time": "25-35",
        "price_level": 2,
        "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400",
        "menu": [
            {"id": "p1", "name": "Margherita", "price": 9.90, "description": "Tomaten, Mozzarella, Basilikum"},
            {"id": "p2", "name": "Salami", "price": 11.90, "description": "Tomaten, Mozzarella, Salami"},
            {"id": "p3", "name": "Quattro Formaggi", "price": 13.90, "description": "Vier Käsesorten"},
            {"id": "p4", "name": "Prosciutto e Funghi", "price": 12.90, "description": "Schinken, Champignons"},
            {"id": "p5", "name": "Diavola", "price": 12.90, "description": "Scharfe Salami, Peperoni"},
        ]
    },
    {
        "name": "Burger Brothers",
        "category": "burger",
        "rating": 4.5,
        "delivery_time": "20-30",
        "price_level": 2,
        "image": "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400",
        "menu": [
            {"id": "b1", "name": "Classic Burger", "price": 8.90, "description": "Rindfleisch, Salat, Tomate, Zwiebel"},
            {"id": "b2", "name": "Cheese Burger", "price": 9.90, "description": "Mit extra Cheddar"},
            {"id": "b3", "name": "Bacon Burger", "price": 11.90, "description": "Mit knusprigem Bacon"},
            {"id": "b4", "name": "BBQ Burger", "price": 12.90, "description": "BBQ Sauce, Röstzwiebeln"},
            {"id": "b5", "name": "Veggie Burger", "price": 10.90, "description": "Pflanzlicher Patty"},
        ]
    },
    {
        "name": "Sakura Sushi",
        "category": "sushi",
        "rating": 4.8,
        "delivery_time": "30-45",
        "price_level": 3,
        "image": "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=400",
        "menu": [
            {"id": "s1", "name": "Maki Mix (12 Stk)", "price": 12.90, "description": "Lachs, Thunfisch, Gurke"},
            {"id": "s2", "name": "Nigiri Set (8 Stk)", "price": 16.90, "description": "Verschiedene Fischsorten"},
            {"id": "s3", "name": "California Roll (8 Stk)", "price": 11.90, "description": "Surimi, Avocado, Gurke"},
            {"id": "s4", "name": "Sashimi Platte", "price": 22.90, "description": "Frischer Fisch, 15 Stück"},
            {"id": "s5", "name": "Veggie Sushi Set", "price": 10.90, "description": "Avocado, Gurke, Karotte"},
        ]
    },
    {
        "name": "Golden Dragon",
        "category": "asian",
        "rating": 4.4,
        "delivery_time": "25-40",
        "price_level": 2,
        "image": "https://images.unsplash.com/photo-1552566626-52f8b828add9?w=400",
        "menu": [
            {"id": "a1", "name": "Gebratener Reis", "price": 8.90, "description": "Mit Ei und Gemüse"},
            {"id": "a2", "name": "Kung Pao Chicken", "price": 12.90, "description": "Hühnchen mit Erdnüssen"},
            {"id": "a3", "name": "Ente süß-sauer", "price": 14.90, "description": "Knusprige Ente"},
            {"id": "a4", "name": "Pad Thai", "price": 11.90, "description": "Reisnudeln mit Garnelen"},
            {"id": "a5", "name": "Tom Yum Suppe", "price": 7.90, "description": "Scharfe Thai-Suppe"},
        ]
    },
    {
        "name": "Döner König",
        "category": "kebab",
        "rating": 4.3,
        "delivery_time": "15-25",
        "price_level": 1,
        "image": "https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=400",
        "menu": [
            {"id": "d1", "name": "Döner Teller", "price": 10.90, "description": "Mit Reis, Salat, Sauce"},
            {"id": "d2", "name": "Döner im Brot", "price": 6.90, "description": "Klassisch im Fladenbrot"},
            {"id": "d3", "name": "Döner Box", "price": 8.90, "description": "Mit Pommes"},
            {"id": "d4", "name": "Lahmacun", "price": 5.90, "description": "Türkische Pizza"},
            {"id": "d5", "name": "Falafel Teller", "price": 9.90, "description": "Vegetarisch"},
        ]
    },
    {
        "name": "Taj Mahal",
        "category": "indian",
        "rating": 4.6,
        "delivery_time": "30-45",
        "price_level": 2,
        "image": "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=400",
        "menu": [
            {"id": "i1", "name": "Butter Chicken", "price": 13.90, "description": "Cremige Tomaten-Sauce"},
            {"id": "i2", "name": "Chicken Tikka Masala", "price": 14.90, "description": "Klassiker"},
            {"id": "i3", "name": "Palak Paneer", "price": 11.90, "description": "Spinat mit Käse"},
            {"id": "i4", "name": "Biryani", "price": 12.90, "description": "Gewürzreis mit Fleisch"},
            {"id": "i5", "name": "Naan Brot", "price": 3.50, "description": "Frisch gebacken"},
        ]
    },
    {
        "name": "Gasthaus zum Löwen",
        "category": "german",
        "rating": 4.2,
        "delivery_time": "35-50",
        "price_level": 2,
        "image": "https://images.unsplash.com/photo-1600891964092-4316c288032e?w=400",
        "menu": [
            {"id": "g1", "name": "Schnitzel", "price": 14.90, "description": "Mit Pommes und Salat"},
            {"id": "g2", "name": "Currywurst", "price": 8.90, "description": "Mit Pommes"},
            {"id": "g3", "name": "Sauerbraten", "price": 16.90, "description": "Mit Rotkohl und Klößen"},
            {"id": "g4", "name": "Bratwurst", "price": 9.90, "description": "Mit Sauerkraut"},
            {"id": "g5", "name": "Käsespätzle", "price": 11.90, "description": "Mit Röstzwiebeln"},
        ]
    },
    {
        "name": "Green Bowl",
        "category": "healthy",
        "rating": 4.7,
        "delivery_time": "20-30",
        "price_level": 2,
        "image": "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400",
        "menu": [
            {"id": "h1", "name": "Buddha Bowl", "price": 12.90, "description": "Quinoa, Gemüse, Hummus"},
            {"id": "h2", "name": "Poke Bowl", "price": 14.90, "description": "Lachs, Reis, Edamame"},
            {"id": "h3", "name": "Smoothie Bowl", "price": 9.90, "description": "Acai, Früchte, Granola"},
            {"id": "h4", "name": "Protein Salat", "price": 11.90, "description": "Hühnchen, Ei, Gemüse"},
            {"id": "h5", "name": "Detox Juice", "price": 5.90, "description": "Grüner Saft"},
        ]
    },
]

COURIER_NAMES = [
    "Max", "Sophie", "Leon", "Emma", "Lukas", "Mia", "Felix", "Hannah",
    "Paul", "Lena", "Tim", "Laura", "Jonas", "Anna", "David", "Lisa",
]


def generate_restaurant_id(name: str) -> str:
    return f"rest-{secrets.token_hex(4)}"


# ══════════════════════════════════════
# MODELS
# ══════════════════════════════════════

class CartItem(BaseModel):
    item_id: str
    quantity: int = 1
    notes: Optional[str] = ""


class OrderRequest(BaseModel):
    restaurant_id: str
    items: List[CartItem]
    delivery_address: dict
    payment_method: str = "wallet"
    tip: float = 0.0
    notes: Optional[str] = ""


class OrderAction(BaseModel):
    order_id: str


# ══════════════════════════════════════
# INITIALIZE RESTAURANTS
# ══════════════════════════════════════

async def ensure_restaurants():
    """Ensure restaurants exist in database."""
    count = await db.food_restaurants.count_documents({})
    if count < 5:
        for r in RESTAURANTS:
            existing = await db.food_restaurants.find_one({"name": r["name"]})
            if not existing:
                doc = {
                    "restaurant_id": generate_restaurant_id(r["name"]),
                    "name": r["name"],
                    "category": r["category"],
                    "rating": r["rating"],
                    "review_count": random.randint(50, 500),
                    "delivery_time": r["delivery_time"],
                    "price_level": r["price_level"],
                    "image": r["image"],
                    "menu": r["menu"],
                    "is_open": True,
                    "min_order": MIN_ORDER_AMOUNT,
                    "delivery_fee": DELIVERY_FEE_BASE,
                    "location": {"lat": 52.52 + random.uniform(-0.05, 0.05), "lng": 13.405 + random.uniform(-0.05, 0.05)},
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }
                await db.food_restaurants.insert_one(doc)


# ══════════════════════════════════════
# GET CATEGORIES
# ══════════════════════════════════════

@router.get("/categories")
async def get_categories():
    """Get food categories."""
    return {"categories": CATEGORIES}


# ══════════════════════════════════════
# GET RESTAURANTS
# ══════════════════════════════════════

@router.get("/restaurants")
async def get_restaurants(request: Request, category: str = "", search: str = "", limit: int = 20):
    """Get restaurants with optional filtering. Only shows approved or legacy restaurants."""
    
    # Include restaurants that are either approved or don't have a status field (legacy data)
    query = {"is_open": True, "$or": [{"status": "approved"}, {"status": {"$exists": False}}]}
    if category:
        query["category"] = category
    if search:
        query["name"] = {"$regex": search, "$options": "i"}
    
    restaurants = await db.food_restaurants.find(query, {"_id": 0}).limit(limit).to_list(limit)
    
    return {"restaurants": restaurants, "total": len(restaurants)}


# ══════════════════════════════════════
# GET RESTAURANT DETAILS
# ══════════════════════════════════════

@router.get("/restaurant/{restaurant_id}")
async def get_restaurant(restaurant_id: str):
    """Get restaurant details with menu."""
    
    restaurant = await db.food_restaurants.find_one(
        {"restaurant_id": restaurant_id, "$or": [{"status": "approved"}, {"status": {"$exists": False}}]}, 
        {"_id": 0}
    )
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant nicht gefunden")
    
    return {"restaurant": restaurant}


# ══════════════════════════════════════
# PLACE ORDER
# ══════════════════════════════════════

@router.post("/order")
async def place_order(req: OrderRequest, request: Request):
    """Place a food delivery order."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    restaurant = await db.food_restaurants.find_one({"restaurant_id": req.restaurant_id})
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant nicht gefunden")
    
    if not restaurant.get("is_open", True):
        raise HTTPException(status_code=400, detail="Restaurant ist geschlossen")
    
    # Build order items
    menu_map = {item["id"]: item for item in restaurant.get("menu", [])}
    order_items = []
    subtotal = 0
    
    for cart_item in req.items:
        menu_item = menu_map.get(cart_item.item_id)
        if not menu_item:
            raise HTTPException(status_code=400, detail=f"Artikel {cart_item.item_id} nicht gefunden")
        
        item_total = menu_item["price"] * cart_item.quantity
        subtotal += item_total
        
        order_items.append({
            "item_id": cart_item.item_id,
            "name": menu_item["name"],
            "price": menu_item["price"],
            "quantity": cart_item.quantity,
            "total": item_total,
            "notes": cart_item.notes,
        })
    
    if subtotal < MIN_ORDER_AMOUNT:
        raise HTTPException(status_code=400, detail=f"Mindestbestellwert: €{MIN_ORDER_AMOUNT:.2f}")
    
    # Calculate fees
    delivery_fee = restaurant.get("delivery_fee", DELIVERY_FEE_BASE)
    service_fee = round(subtotal * SERVICE_FEE_PERCENT, 2)
    small_order_fee = SMALL_ORDER_FEE if subtotal < SMALL_ORDER_THRESHOLD else 0
    tip = round(req.tip, 2)
    
    total = subtotal + delivery_fee + service_fee + small_order_fee + tip
    
    # WALLET-ONLY: Check balance (BidBlitz closed ecosystem)
    current_balance = user.get("balance", 0)
    if current_balance < total:
        raise HTTPException(
            status_code=400, 
            detail=f"Nicht genug Guthaben. Benötigt: €{total:.2f}, Verfügbar: €{current_balance:.2f}. Bitte lade dein Wallet auf."
        )
    
    now = datetime.now(timezone.utc)
    order_id = secrets.token_hex(8)
    
    # Estimated delivery time
    delivery_time_parts = restaurant.get("delivery_time", "30-45").split("-")
    eta_minutes = int(delivery_time_parts[1]) if len(delivery_time_parts) > 1 else 40
    estimated_delivery = now + timedelta(minutes=eta_minutes)
    
    order = {
        "order_id": order_id,
        "user_id": user_id,
        "user_name": user.get("name", ""),
        "user_email": user.get("email", ""),
        "restaurant_id": req.restaurant_id,
        "restaurant_name": restaurant["name"],
        "restaurant_image": restaurant.get("image", ""),
        "items": order_items,
        "delivery_address": req.delivery_address,
        "payment_method": req.payment_method,
        "subtotal": round(subtotal, 2),
        "delivery_fee": delivery_fee,
        "service_fee": service_fee,
        "small_order_fee": small_order_fee,
        "tip": tip,
        "total": round(total, 2),
        "status": "pending",  # pending -> confirmed -> preparing -> picked_up -> delivered / cancelled
        "estimated_delivery": estimated_delivery.isoformat(),
        "courier": None,
        "notes": req.notes,
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
    }
    
    # WALLET-ONLY: Charge wallet (BidBlitz closed ecosystem)
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$inc": {"balance": -total}}
    )
    
    await db.transactions.insert_one({
        "id": secrets.token_hex(8),
        "user_id": user_id,
        "type": "payment",
        "amount": -total,
        "description": f"Bestellung: {restaurant['name']}",
        "status": "completed",
        "reference": f"FOOD-{order_id[:8].upper()}",
        "category": "food",
        "merchant_name": restaurant["name"],
        "created_at": now.isoformat(),
    })
    
    await db.food_orders.insert_one(order)
    order.pop("_id", None)
    
    # Simulate order confirmation (in real app, restaurant confirms)
    await db.food_orders.update_one(
        {"order_id": order_id},
        {"$set": {"status": "confirmed", "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    order["status"] = "confirmed"
    
    return {
        "ok": True,
        "order": order,
        "message": f"Bestellung aufgegeben! Lieferung ca. {eta_minutes} Min.",
    }


# ══════════════════════════════════════
# GET ORDER STATUS
# ══════════════════════════════════════

@router.get("/order/{order_id}")
async def get_order_status(order_id: str, request: Request):
    """Get order details and tracking."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    order = await db.food_orders.find_one({"order_id": order_id, "user_id": user_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Bestellung nicht gefunden")
    
    # Simulate status progression
    if order["status"] == "confirmed":
        created = datetime.fromisoformat(order["created_at"])
        now = datetime.now(timezone.utc)
        minutes_passed = (now - created).total_seconds() / 60
        
        if minutes_passed > 5:
            order["status"] = "preparing"
            await db.food_orders.update_one({"order_id": order_id}, {"$set": {"status": "preparing"}})
        if minutes_passed > 15:
            # Assign courier
            courier = {
                "name": random.choice(COURIER_NAMES),
                "phone": f"+49 170 {random.randint(1000000, 9999999)}",
                "vehicle": random.choice(["Fahrrad", "E-Bike", "Roller"]),
            }
            order["status"] = "picked_up"
            order["courier"] = courier
            await db.food_orders.update_one(
                {"order_id": order_id},
                {"$set": {"status": "picked_up", "courier": courier}}
            )
    
    return {"order": order}


# ══════════════════════════════════════
# CANCEL ORDER
# ══════════════════════════════════════

@router.post("/cancel")
async def cancel_order(req: OrderAction, request: Request):
    """Cancel an order (if not yet preparing)."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    order = await db.food_orders.find_one({"order_id": req.order_id, "user_id": user_id})
    if not order:
        raise HTTPException(status_code=404, detail="Bestellung nicht gefunden")
    
    if order["status"] in ("preparing", "picked_up", "delivered"):
        raise HTTPException(status_code=400, detail="Bestellung kann nicht mehr storniert werden")
    
    if order["status"] == "cancelled":
        raise HTTPException(status_code=400, detail="Bestellung bereits storniert")
    
    # Refund
    if order["payment_method"] == "wallet":
        await db.users.update_one(
            {"_id": user["_id"]},
            {"$inc": {"balance": order["total"]}}
        )
        
        await db.transactions.insert_one({
            "id": secrets.token_hex(8),
            "user_id": user_id,
            "type": "refund",
            "amount": order["total"],
            "description": f"Stornierung: {order['restaurant_name']}",
            "status": "completed",
            "reference": f"FOOD-REFUND-{req.order_id[:8].upper()}",
            "category": "food",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    
    await db.food_orders.update_one(
        {"order_id": req.order_id},
        {"$set": {
            "status": "cancelled",
            "cancelled_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }}
    )
    
    updated_user = await db.users.find_one({"_id": user["_id"]})
    
    return {
        "ok": True,
        "refund_amount": order["total"],
        "new_balance": updated_user.get("balance", 0),
        "message": f"Bestellung storniert. €{order['total']:.2f} zurückerstattet.",
    }


# ══════════════════════════════════════
# CONFIRM DELIVERY (User marks as received)
# ══════════════════════════════════════

@router.post("/delivered")
async def confirm_delivery(req: OrderAction, request: Request):
    """Confirm order was delivered."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    order = await db.food_orders.find_one({"order_id": req.order_id, "user_id": user_id})
    if not order:
        raise HTTPException(status_code=404, detail="Bestellung nicht gefunden")
    
    if order["status"] == "delivered":
        return {"ok": True, "message": "Bereits als geliefert markiert"}
    
    await db.food_orders.update_one(
        {"order_id": req.order_id},
        {"$set": {
            "status": "delivered",
            "delivered_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }}
    )
    
    # Update user stats
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$inc": {"food_orders_count": 1, "food_total_spent": order["total"]}}
    )
    
    return {"ok": True, "message": "Lieferung bestätigt. Guten Appetit!"}


# ══════════════════════════════════════
# RATE ORDER
# ══════════════════════════════════════

@router.post("/rate")
async def rate_order(request: Request):
    """Rate a delivered order."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    body = await request.json()
    
    order_id = body.get("order_id")
    food_rating = body.get("food_rating", 5)
    delivery_rating = body.get("delivery_rating", 5)
    comment = body.get("comment", "")
    
    if not 1 <= food_rating <= 5 or not 1 <= delivery_rating <= 5:
        raise HTTPException(status_code=400, detail="Bewertung muss 1-5 sein")
    
    order = await db.food_orders.find_one({"order_id": order_id, "user_id": user_id})
    if not order:
        raise HTTPException(status_code=404, detail="Bestellung nicht gefunden")
    
    if order["status"] != "delivered":
        raise HTTPException(status_code=400, detail="Nur gelieferte Bestellungen bewerten")
    
    await db.food_orders.update_one(
        {"order_id": order_id},
        {"$set": {
            "food_rating": food_rating,
            "delivery_rating": delivery_rating,
            "user_comment": comment,
            "rated_at": datetime.now(timezone.utc).isoformat(),
        }}
    )
    
    # Update restaurant rating (simplified)
    avg_rating = (food_rating + order.get("restaurant", {}).get("rating", 4.5)) / 2
    await db.food_restaurants.update_one(
        {"restaurant_id": order["restaurant_id"]},
        {"$set": {"rating": round(avg_rating, 1)}, "$inc": {"review_count": 1}}
    )
    
    return {"ok": True, "message": "Bewertung gespeichert"}


# ══════════════════════════════════════
# ORDER HISTORY
# ══════════════════════════════════════

@router.get("/orders")
async def get_order_history(request: Request, limit: int = 20):
    """Get user's order history."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    orders = await db.food_orders.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return {"orders": orders, "total": len(orders)}


# ══════════════════════════════════════
# ACTIVE ORDER
# ══════════════════════════════════════

@router.get("/active")
async def get_active_order(request: Request):
    """Get user's current active order if any."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    order = await db.food_orders.find_one(
        {"user_id": user_id, "status": {"$nin": ["delivered", "cancelled"]}},
        {"_id": 0}
    )
    
    return {"has_active_order": order is not None, "order": order}


# ══════════════════════════════════════
# REORDER
# ══════════════════════════════════════

@router.post("/reorder")
async def reorder(req: OrderAction, request: Request):
    """Reorder a previous order."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    old_order = await db.food_orders.find_one({"order_id": req.order_id, "user_id": user_id})
    if not old_order:
        raise HTTPException(status_code=404, detail="Bestellung nicht gefunden")
    
    # Check if restaurant still exists and is open
    restaurant = await db.food_restaurants.find_one({"restaurant_id": old_order["restaurant_id"]})
    if not restaurant or not restaurant.get("is_open", True):
        raise HTTPException(status_code=400, detail="Restaurant nicht verfügbar")
    
    # Recalculate prices (they might have changed)
    menu_map = {item["id"]: item for item in restaurant.get("menu", [])}
    order_items = []
    subtotal = 0
    
    for item in old_order["items"]:
        menu_item = menu_map.get(item["item_id"])
        if menu_item:
            item_total = menu_item["price"] * item["quantity"]
            subtotal += item_total
            order_items.append({
                "item_id": item["item_id"],
                "name": menu_item["name"],
                "price": menu_item["price"],
                "quantity": item["quantity"],
                "total": item_total,
                "notes": item.get("notes", ""),
            })
    
    if not order_items:
        raise HTTPException(status_code=400, detail="Keine Artikel verfügbar")
    
    return {
        "restaurant": restaurant,
        "items": order_items,
        "subtotal": round(subtotal, 2),
        "message": "Warenkorb aus vorheriger Bestellung geladen",
    }



# ══════════════════════════════════════
# RESTAURANT REGISTRATION
# ══════════════════════════════════════

@router.post("/restaurant/register")
async def register_restaurant(request: Request):
    """Register a new restaurant (requires admin approval)."""
    body = await request.json()
    
    required = ["name", "category", "address", "phone", "email"]
    for field in required:
        if not body.get(field):
            raise HTTPException(status_code=400, detail=f"{field} erforderlich")
    
    existing = await db.food_restaurants.find_one({"email": body["email"].lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Restaurant bereits registriert")
    
    now = datetime.now(timezone.utc).isoformat()
    
    restaurant = {
        "restaurant_id": generate_restaurant_id(body["name"]),
        "name": body["name"],
        "category": body["category"],
        "address": body["address"],
        "phone": body["phone"],
        "email": body["email"].lower(),
        "description": body.get("description", ""),
        "rating": 0,
        "review_count": 0,
        "delivery_time": body.get("delivery_time", "30-45"),
        "price_level": body.get("price_level", 2),
        "image": body.get("image", ""),
        "menu": [],  # Restaurant adds menu items after approval
        "is_open": False,
        "status": "pending",  # pending, approved, rejected, suspended
        "min_order": body.get("min_order", MIN_ORDER_AMOUNT),
        "delivery_fee": body.get("delivery_fee", DELIVERY_FEE_BASE),
        "location": body.get("location", {"lat": 52.52, "lng": 13.405}),
        "owner_name": body.get("owner_name", ""),
        "tax_id": body.get("tax_id", ""),
        "bank_details": body.get("bank_details", {}),
        "documents": {
            "license": None,
            "hygiene_cert": None,
        },
        "created_at": now,
        "updated_at": now,
    }
    
    await db.food_restaurants.insert_one(restaurant)
    restaurant.pop("_id", None)
    
    return {
        "ok": True,
        "restaurant_id": restaurant["restaurant_id"],
        "status": "pending",
        "message": "Registrierung erfolgreich. Bitte warte auf die Genehmigung.",
    }


# ══════════════════════════════════════
# RESTAURANT: MANAGE MENU
# ══════════════════════════════════════

@router.post("/restaurant/{restaurant_id}/menu/add")
async def add_menu_item(restaurant_id: str, request: Request):
    """Restaurant owner adds menu item."""
    body = await request.json()
    
    restaurant = await db.food_restaurants.find_one({"restaurant_id": restaurant_id})
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant nicht gefunden")
    
    # TODO: Verify owner authentication
    
    menu_item = {
        "id": f"m{secrets.token_hex(4)}",
        "name": body.get("name"),
        "price": body.get("price"),
        "description": body.get("description", ""),
        "category": body.get("category", "main"),
        "image": body.get("image", ""),
        "available": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    
    await db.food_restaurants.update_one(
        {"restaurant_id": restaurant_id},
        {"$push": {"menu": menu_item}}
    )
    
    return {"ok": True, "item": menu_item}


@router.post("/restaurant/{restaurant_id}/menu/update")
async def update_menu_item(restaurant_id: str, request: Request):
    """Restaurant owner updates menu item."""
    body = await request.json()
    item_id = body.get("item_id")
    
    restaurant = await db.food_restaurants.find_one({"restaurant_id": restaurant_id})
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant nicht gefunden")
    
    updates = {}
    if "name" in body:
        updates["menu.$.name"] = body["name"]
    if "price" in body:
        updates["menu.$.price"] = body["price"]
    if "description" in body:
        updates["menu.$.description"] = body["description"]
    if "available" in body:
        updates["menu.$.available"] = body["available"]
    
    if updates:
        await db.food_restaurants.update_one(
            {"restaurant_id": restaurant_id, "menu.id": item_id},
            {"$set": updates}
        )
    
    return {"ok": True}


@router.delete("/restaurant/{restaurant_id}/menu/{item_id}")
async def delete_menu_item(restaurant_id: str, item_id: str, request: Request):
    """Restaurant owner deletes menu item."""
    
    result = await db.food_restaurants.update_one(
        {"restaurant_id": restaurant_id},
        {"$pull": {"menu": {"id": item_id}}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Artikel nicht gefunden")
    
    return {"ok": True}


# ══════════════════════════════════════
# RESTAURANT: TOGGLE OPEN STATUS
# ══════════════════════════════════════

@router.post("/restaurant/{restaurant_id}/toggle-open")
async def toggle_restaurant_open(restaurant_id: str, request: Request):
    """Restaurant toggles open/closed status."""
    body = await request.json()
    is_open = body.get("is_open", False)
    
    restaurant = await db.food_restaurants.find_one({"restaurant_id": restaurant_id})
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant nicht gefunden")
    
    if restaurant.get("status") != "approved":
        raise HTTPException(status_code=403, detail="Restaurant nicht genehmigt")
    
    await db.food_restaurants.update_one(
        {"restaurant_id": restaurant_id},
        {"$set": {"is_open": is_open, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"ok": True, "is_open": is_open}


# ══════════════════════════════════════
# ADMIN: MANAGE RESTAURANTS
# ══════════════════════════════════════

@router.get("/admin/restaurants")
async def admin_list_restaurants(request: Request, status: str = None):
    """Admin lists all restaurants."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Nur Admin")
    
    query = {}
    if status:
        query["status"] = status
    
    restaurants = await db.food_restaurants.find(query, {"_id": 0}).to_list(200)
    
    return {"restaurants": restaurants, "total": len(restaurants)}


@router.get("/admin/restaurants/pending")
async def admin_pending_restaurants(request: Request):
    """Admin gets pending restaurant applications."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Nur Admin")
    
    restaurants = await db.food_restaurants.find({"status": "pending"}, {"_id": 0}).to_list(50)
    
    return {"restaurants": restaurants, "total": len(restaurants)}


@router.post("/admin/restaurants/approve")
async def admin_approve_restaurant(request: Request):
    """Admin approves or rejects restaurant."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Nur Admin")
    
    body = await request.json()
    restaurant_id = body.get("restaurant_id")
    approved = body.get("approved", False)
    reason = body.get("reason", "")
    
    restaurant = await db.food_restaurants.find_one({"restaurant_id": restaurant_id})
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant nicht gefunden")
    
    now = datetime.now(timezone.utc).isoformat()
    
    if approved:
        await db.food_restaurants.update_one(
            {"restaurant_id": restaurant_id},
            {"$set": {
                "status": "approved",
                "approved_at": now,
                "approved_by": str(user["_id"]),
                "updated_at": now,
            }}
        )
    else:
        await db.food_restaurants.update_one(
            {"restaurant_id": restaurant_id},
            {"$set": {
                "status": "rejected",
                "rejection_reason": reason,
                "updated_at": now,
            }}
        )
    
    return {"ok": True, "status": "approved" if approved else "rejected"}


@router.post("/admin/restaurants/seed")
async def admin_seed_restaurants(request: Request):
    """Admin seeds demo restaurants (for development only)."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Nur Admin")
    
    count = 0
    for r in RESTAURANTS:
        existing = await db.food_restaurants.find_one({"name": r["name"]})
        if not existing:
            doc = {
                "restaurant_id": generate_restaurant_id(r["name"]),
                "name": r["name"],
                "category": r["category"],
                "rating": r["rating"],
                "review_count": random.randint(50, 500),
                "delivery_time": r["delivery_time"],
                "price_level": r["price_level"],
                "image": r["image"],
                "menu": r["menu"],
                "is_open": True,
                "status": "approved",  # Pre-approved for demo
                "min_order": MIN_ORDER_AMOUNT,
                "delivery_fee": DELIVERY_FEE_BASE,
                "location": {"lat": 52.52 + random.uniform(-0.05, 0.05), "lng": 13.405 + random.uniform(-0.05, 0.05)},
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            await db.food_restaurants.insert_one(doc)
            count += 1
    
    return {"ok": True, "seeded": count}
