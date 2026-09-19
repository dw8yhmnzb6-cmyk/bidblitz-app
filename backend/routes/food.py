"""
BidBlitz V2 - Food Delivery Module (Wolt/Lieferando Style)
Restaurant discovery, ordering, real-time tracking, and delivery.
ONLY REAL APPROVED RESTAURANTS - No seeded/demo data shown to users.
"""

import secrets
import math
import random
import hashlib
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional, List
from bson import ObjectId

from core.database import db
from core.security import get_current_user

router = APIRouter(prefix="/api/food", tags=["Food Delivery"])

# ══════════════════════════════════════
# MODULE STATUS
# ══════════════════════════════════════
FOOD_MODULE_ENABLED = True  # Enabled but only shows approved restaurants


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
    quantity: int = Field(default=1, ge=1, le=50)
    size_id: Optional[str] = None
    extra_ids: List[str] = Field(default_factory=list)
    notes: Optional[str] = ""


class OrderRequest(BaseModel):
    restaurant_id: str
    items: List[CartItem] = Field(..., min_length=1, max_length=100)
    delivery_address: dict
    delivery_type: str = Field(default="delivery", pattern="^(delivery|pickup)$")
    payment_method: str = "wallet"
    tip: float = Field(default=0.0, ge=0, le=100)
    notes: Optional[str] = ""
    promo_code: Optional[str] = None
    idempotency_key: Optional[str] = None


class OrderAction(BaseModel):
    order_id: str


def _require_food_idempotency_key(body_key: Optional[str], request: Request, *, action: str) -> str:
    key = (body_key or request.headers.get("Idempotency-Key") or "").strip()
    if not 8 <= len(key) <= 200:
        raise HTTPException(status_code=400, detail="Idempotency-Key erforderlich")
    return f"food-{action}:{key}"


def _is_real_approved_restaurant_query(restaurant_id: Optional[str] = None) -> dict:
    query = {
        "status": "approved",
        "is_demo": {"$ne": True},
        "$or": [
            {"is_real": True},
            {"approved_by": {"$exists": True}},
        ],
    }
    if restaurant_id:
        query["restaurant_id"] = restaurant_id
    return query


async def _require_food_restaurant_owner(user: dict, restaurant_id: str) -> dict:
    restaurant = await db.food_restaurants.find_one({"restaurant_id": restaurant_id})
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant nicht gefunden")
    user_id = str(user["_id"])
    owner_ids = {str(restaurant.get("owner_id") or ""), str(restaurant.get("user_id") or "")}
    if user.get("role") != "admin" and user_id not in owner_ids:
        raise HTTPException(status_code=403, detail="Nicht berechtigt, dieses Restaurant zu verwalten")
    return restaurant


def _normalize_food_menu_options(raw_items, *, prefix: str) -> list[dict]:
    normalized = []
    for raw in list(raw_items or [])[:30]:
        if not isinstance(raw, dict):
            continue
        name = str(raw.get("name") or "").strip()[:80]
        if not name:
            continue
        try:
            price = round(float(raw.get("price") or 0), 2)
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail=f"Ungültiger Preis für {name}")
        if price < 0 or price > 1000:
            raise HTTPException(status_code=400, detail=f"Ungültiger Preis für {name}")
        option_id = str(raw.get("id") or f"{prefix}{secrets.token_hex(4)}")[:80]
        normalized.append({"id": option_id, "name": name, "price": price})
    return normalized



def _price_food_line(menu_item: dict, cart_item: CartItem) -> dict:
    if menu_item.get("available") is False:
        raise HTTPException(status_code=400, detail=f"Artikel {cart_item.item_id} ist derzeit nicht verfügbar")

    base_price = round(float(menu_item.get("price") or 0), 2)
    sizes = {str(item.get("id")): item for item in (menu_item.get("sizes") or []) if item.get("id") is not None}
    extras = {str(item.get("id")): item for item in (menu_item.get("extras") or []) if item.get("id") is not None}

    selected_size = None
    size_extra = 0.0
    if cart_item.size_id:
        selected_size = sizes.get(str(cart_item.size_id))
        if not selected_size:
            raise HTTPException(status_code=400, detail=f"Ungültige Größe für {menu_item.get('name', cart_item.item_id)}")
        size_extra = round(float(selected_size.get("price") or 0), 2)

    selected_extras = []
    extras_total = 0.0
    for extra_id in dict.fromkeys(str(x) for x in (cart_item.extra_ids or [])):
        extra = extras.get(extra_id)
        if not extra:
            raise HTTPException(status_code=400, detail=f"Ungültiges Extra für {menu_item.get('name', cart_item.item_id)}")
        price = round(float(extra.get("price") or 0), 2)
        extras_total += price
        selected_extras.append({
            "id": extra_id,
            "name": extra.get("name", ""),
            "price": price,
        })

    unit_price = round(base_price + size_extra + extras_total, 2)
    item_total = round(unit_price * int(cart_item.quantity), 2)
    return {
        "item_id": cart_item.item_id,
        "name": menu_item.get("name", ""),
        "price": base_price,
        "size": {
            "id": str(selected_size.get("id")),
            "name": selected_size.get("name", ""),
            "price": size_extra,
        } if selected_size else None,
        "extras": selected_extras,
        "options_total": round(size_extra + extras_total, 2),
        "unit_price": unit_price,
        "quantity": int(cart_item.quantity),
        "total": item_total,
        "notes": cart_item.notes,
    }


async def _settle_food_order_payment(order: dict, user_id: str, idempotency_key: str) -> tuple[dict, object]:
    from core.payment_engine import debit_wallet, TransactionType

    payment_result = await debit_wallet(
        user_id=user_id,
        amount=round(float(order["total"]), 2),
        tx_type=TransactionType.FOOD_PAYMENT,
        description=f"Bestellung: {order['restaurant_name']}",
        reference=f"FOOD-{order['order_id'][-12:].upper()}",
        merchant_name=order["restaurant_name"],
        metadata={
            "order_id": order["order_id"],
            "restaurant_id": order["restaurant_id"],
            "kind": "food_order",
        },
        idempotency_key=idempotency_key,
    )
    if not payment_result.success:
        await db.food_orders.update_one(
            {"order_id": order["order_id"], "user_id": user_id},
            {"$set": {
                "status": "payment_failed",
                "payment_error": payment_result.error,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }},
        )
        raise HTTPException(status_code=400, detail=payment_result.error or "Zahlung fehlgeschlagen")

    now_iso = datetime.now(timezone.utc).isoformat()
    await db.food_orders.update_one(
        {
            "order_id": order["order_id"],
            "user_id": user_id,
            "status": {"$in": ["payment_pending", "payment_failed"]},
        },
        {"$set": {
            "status": "pending",
            "payment_status": "paid",
            "payment_transaction_id": payment_result.transaction_id,
            "paid_at": now_iso,
            "updated_at": now_iso,
        }},
    )
    fresh_order = await db.food_orders.find_one(
        {"order_id": order["order_id"], "user_id": user_id},
        {"_id": 0},
    ) or order
    return fresh_order, payment_result



# ══════════════════════════════════════
# NO AUTO-SEEDING - REAL DATA ONLY
# Restaurants must be registered via /api/food/restaurant/register
# ══════════════════════════════════════


# ══════════════════════════════════════
# GET CATEGORIES
# ══════════════════════════════════════

@router.get("/categories")
async def get_categories():
    """Get food categories."""
    return {"categories": CATEGORIES}


@router.get("/promo/validate")
async def validate_promo(code: str, subtotal: float = 0):
    """Validate a promo code and return discount."""
    code_clean = (code or "").upper().strip()
    if not code_clean:
        return {"valid": False, "message": "Code fehlt"}

    promo = await db.food_promos.find_one({"code": code_clean, "active": True}, {"_id": 0})
    if not promo:
        return {"valid": False, "message": "Code ungültig"}

    if promo.get("type") == "percent":
        discount = round(subtotal * float(promo.get("value", 0)) / 100, 2)
    else:
        discount = round(float(promo.get("value", 0)), 2)
    if subtotal > 0:
        discount = min(discount, subtotal)

    return {
        "valid": True,
        "code": code_clean,
        "type": promo.get("type", "amount"),
        "value": promo.get("value", 0),
        "discount": discount,
        "label": promo.get("label", ""),
    }


# ══════════════════════════════════════
# GET RESTAURANTS
# ══════════════════════════════════════

@router.get("/restaurants")
async def get_restaurants(request: Request, category: str = "", search: str = "", limit: int = 20):
    """Get restaurants with optional filtering. ONLY shows approved real restaurants."""
    
    # ONLY approved restaurants - NO seeded/demo data
    query = {
        "is_open": True,
        "status": "approved",
        "is_demo": {"$ne": True},
        "$or": [{"is_real": True}, {"approved_by": {"$exists": True}}],
    }
    if category:
        query["category"] = category
    if search:
        query["name"] = {"$regex": search, "$options": "i"}
    
    restaurants = await db.food_restaurants.find(query, {"_id": 0}).limit(limit).to_list(limit)
    
    # Clean empty state if no real restaurants
    if len(restaurants) == 0:
        return {
            "restaurants": [],
            "total": 0,
            "module_ready": False,
            "message": "Derzeit sind keine Restaurants verfügbar. Wir erweitern unser Angebot bald!",
            "categories": CATEGORIES,
        }
    
    return {"restaurants": restaurants, "total": len(restaurants), "module_ready": True, "categories": CATEGORIES}


@router.get("/nearby")
async def get_nearby_restaurants(lat: float = 52.52, lng: float = 13.405, radius: float = 10.0, limit: int = 20):
    """Get restaurants near a location for map display. ONLY real approved restaurants."""
    from math import radians, cos, sin, sqrt, atan2
    
    def haversine(lat1, lon1, lat2, lon2):
        R = 6371
        dlat = radians(lat2 - lat1)
        dlon = radians(lon2 - lon1)
        a = sin(dlat/2)**2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon/2)**2
        return R * 2 * atan2(sqrt(a), sqrt(1-a))
    
    # ONLY approved real restaurants
    query = {
        "is_open": True,
        "status": "approved",
        "is_demo": {"$ne": True},
        "$or": [{"is_real": True}, {"approved_by": {"$exists": True}}],
    }
    restaurants = await db.food_restaurants.find(query, {"_id": 0}).limit(100).to_list(100)
    
    nearby = []
    for r in restaurants:
        loc = r.get("location", {})
        rlat = loc.get("lat") or r.get("lat", 0)
        rlng = loc.get("lng") or r.get("lng", 0)
        
        # Skip restaurants without real coordinates
        if not rlat or not rlng or rlat == 0 or rlng == 0:
            continue
        
        r["lat"] = rlat
        r["lng"] = rlng
        
        dist = haversine(lat, lng, rlat, rlng)
        if dist <= radius:
            r["distance_km"] = round(dist, 2)
            nearby.append(r)
    
    nearby.sort(key=lambda x: x.get("distance_km", 999))
    
    if len(nearby) == 0:
        return {
            "restaurants": [],
            "total": 0,
            "module_ready": False,
            "message": "Derzeit sind keine Restaurants in deiner Nähe verfügbar.",
        }
    
    return {"restaurants": nearby[:limit], "total": len(nearby), "module_ready": True}


# ══════════════════════════════════════
# GET RESTAURANT DETAILS
# ══════════════════════════════════════

@router.get("/restaurant/{restaurant_id}")
async def get_restaurant(restaurant_id: str):
    """Get restaurant details with menu."""
    
    restaurant = await db.food_restaurants.find_one(
        _is_real_approved_restaurant_query(restaurant_id),
        {"_id": 0},
    )
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant nicht gefunden")
    
    return {"restaurant": restaurant}


# ══════════════════════════════════════
# PLACE ORDER
# ══════════════════════════════════════

@router.post("/order")
async def place_order(req: OrderRequest, request: Request):
    """Create one wallet-backed food order exactly once."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    if req.payment_method != "wallet":
        raise HTTPException(status_code=400, detail="Food-Bestellungen sind aktuell Wallet-only")

    idempotency_key = _require_food_idempotency_key(req.idempotency_key, request, action="order")
    key_hash = hashlib.sha256(f"{user_id}:{idempotency_key}".encode("utf-8")).hexdigest()[:20]
    order_id = f"FOD-{key_hash}"

    existing = await db.food_orders.find_one(
        {"order_id": order_id, "user_id": user_id},
        {"_id": 0},
    )
    if existing:
        if existing.get("status") in {"payment_pending", "payment_failed"}:
            fresh_order, payment_result = await _settle_food_order_payment(existing, user_id, idempotency_key)
            return {
                "ok": True,
                "order": fresh_order,
                "new_balance": payment_result.new_balance,
                "message": "Bestellung wurde fortgesetzt.",
                "replayed": True,
            }
        if existing.get("status") in {"cancelled", "refund_reconciliation_required"}:
            raise HTTPException(status_code=409, detail="Dieser Bestellversuch wurde beendet. Bitte starte eine neue Bestellung.")
        fresh_user = await db.users.find_one({"_id": user["_id"]}, {"balance": 1, "_id": 0}) or {}
        return {
            "ok": True,
            "order": existing,
            "new_balance": round(float(fresh_user.get("balance") or 0), 2),
            "message": "Bestellung bereits verarbeitet.",
            "replayed": True,
        }

    restaurant_query = _is_real_approved_restaurant_query(req.restaurant_id)
    restaurant_query["is_open"] = True
    restaurant = await db.food_restaurants.find_one(restaurant_query)
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant nicht verfügbar oder nicht freigegeben")

    menu_map = {str(item["id"]): item for item in restaurant.get("menu", []) if item.get("id") is not None}
    order_items = []
    subtotal = 0.0
    for cart_item in req.items:
        menu_item = menu_map.get(str(cart_item.item_id))
        if not menu_item:
            raise HTTPException(status_code=400, detail=f"Artikel {cart_item.item_id} nicht gefunden")
        line = _price_food_line(menu_item, cart_item)
        subtotal += float(line["total"])
        order_items.append(line)

    subtotal = round(subtotal, 2)
    min_order = round(float(restaurant.get("min_order") or MIN_ORDER_AMOUNT), 2)
    if subtotal < min_order:
        raise HTTPException(status_code=400, detail=f"Mindestbestellwert: €{min_order:.2f}")

    is_pickup = req.delivery_type == "pickup"
    delivery_fee = 0.0 if is_pickup else round(float(restaurant.get("delivery_fee") or DELIVERY_FEE_BASE), 2)
    service_fee = round(subtotal * SERVICE_FEE_PERCENT, 2)
    small_order_fee = 0.0 if is_pickup else (SMALL_ORDER_FEE if subtotal < SMALL_ORDER_THRESHOLD else 0.0)
    tip = round(float(req.tip or 0), 2)

    promo_discount = 0.0
    promo_code = (req.promo_code or "").upper().strip()
    if promo_code:
        promo_doc = await db.food_promos.find_one({
            "code": promo_code,
            "active": True,
        })
        if promo_doc:
            starts_at = str(promo_doc.get("starts_at") or "")
            expires_at = str(promo_doc.get("expires_at") or "")
            now_iso = datetime.now(timezone.utc).isoformat()
            if (not starts_at or starts_at <= now_iso) and (not expires_at or expires_at >= now_iso):
                if promo_doc.get("type") == "percent":
                    promo_discount = round(subtotal * float(promo_doc.get("value", 0)) / 100, 2)
                else:
                    promo_discount = round(float(promo_doc.get("value", 0)), 2)
                promo_discount = min(max(0.0, promo_discount), subtotal)

    total = round(subtotal + delivery_fee + service_fee + small_order_fee + tip - promo_discount, 2)
    if total <= 0:
        raise HTTPException(status_code=400, detail="Ungültiger Bestellbetrag")

    now = datetime.now(timezone.utc)
    delivery_time_parts = str(restaurant.get("delivery_time") or "30-45").split("-")
    try:
        eta_minutes = int(delivery_time_parts[-1])
    except Exception:
        eta_minutes = 40
    estimated_delivery = now + timedelta(minutes=max(1, eta_minutes))

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
        "delivery_type": req.delivery_type,
        "payment_method": "wallet",
        "subtotal": subtotal,
        "delivery_fee": delivery_fee,
        "service_fee": service_fee,
        "small_order_fee": small_order_fee,
        "tip": tip,
        "promo_code": promo_code or None,
        "promo_discount": promo_discount,
        "total": total,
        "status": "payment_pending",
        "payment_status": "pending",
        "estimated_delivery": estimated_delivery.isoformat(),
        "courier": None,
        "notes": req.notes,
        "idempotency_key": idempotency_key,
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
    }
    await db.food_orders.update_one(
        {"order_id": order_id, "user_id": user_id},
        {"$setOnInsert": order},
        upsert=True,
    )
    order = await db.food_orders.find_one({"order_id": order_id, "user_id": user_id}, {"_id": 0}) or order

    fresh_order, payment_result = await _settle_food_order_payment(order, user_id, idempotency_key)
    return {
        "ok": True,
        "order": fresh_order,
        "new_balance": payment_result.new_balance,
        "message": f"Bestellung aufgegeben! Restaurantbestätigung ausstehend · ca. {eta_minutes} Min.",
        "replayed": bool(payment_result.idempotent_replay),
    }


async def _refund_food_order(order_id: str, *, final_status: str, reason: str) -> dict:
    """Refund one paid food order exactly once and persist a visible refund state."""
    from core.payment_engine import credit_wallet, TransactionType

    order = await db.food_orders.find_one({"order_id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Bestellung nicht gefunden")

    if order.get("refund_status") == "completed" and order.get("status") in {"cancelled", "rejected"}:
        fresh_user = await db.users.find_one(
            {"_id": ObjectId(order["user_id"])},
            {"balance": 1, "_id": 0},
        ) if ObjectId.is_valid(str(order.get("user_id") or "")) else None
        return {
            "order": order,
            "refund_amount": round(float(order.get("total") or 0), 2),
            "new_balance": round(float((fresh_user or {}).get("balance") or 0), 2),
            "replayed": True,
        }

    current_status = order.get("status")
    if current_status not in {"pending", "confirmed", "refunding"}:
        raise HTTPException(status_code=400, detail="Bestellung kann nicht mehr storniert werden")

    if current_status != "refunding":
        claim = await db.food_orders.update_one(
            {
                "order_id": order_id,
                "status": {"$in": ["pending", "confirmed"]},
            },
            {"$set": {
                "status": "refunding",
                "refund_status": "processing",
                "refund_final_status": final_status,
                "refund_reason": reason,
                "refund_started_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }},
        )
        if claim.modified_count != 1:
            order = await db.food_orders.find_one({"order_id": order_id}) or order
            if order.get("status") != "refunding":
                raise HTTPException(status_code=409, detail="Bestellstatus wurde parallel geändert")

    order = await db.food_orders.find_one({"order_id": order_id}) or order
    final_status = str(order.get("refund_final_status") or final_status)

    refund_result = await credit_wallet(
        user_id=order["user_id"],
        amount=round(float(order["total"]), 2),
        tx_type=TransactionType.REFUND,
        description=f"Erstattung: {order.get('restaurant_name', 'Restaurant')} - {reason}",
        reference=f"FOOD-REFUND-{order_id[-12:].upper()}",
        source="food_refund",
        metadata={
            "order_id": order_id,
            "original_transaction": order.get("payment_transaction_id"),
            "final_status": final_status,
        },
        idempotency_key=f"food-refund:{order_id}",
    )
    if not refund_result.success:
        await db.food_orders.update_one(
            {"order_id": order_id},
            {"$set": {
                "refund_status": (
                    "reconciliation_required"
                    if str(getattr(refund_result.status, "value", refund_result.status)) == "reconciliation_required"
                    else "processing"
                ),
                "refund_error": refund_result.error,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }},
        )
        raise HTTPException(status_code=409, detail=refund_result.error or "Erstattung wird noch verarbeitet")

    completed_at = datetime.now(timezone.utc).isoformat()
    await db.food_orders.update_one(
        {"order_id": order_id, "status": "refunding"},
        {"$set": {
            "status": final_status,
            "refund_status": "completed",
            "refund_transaction_id": refund_result.transaction_id,
            "refunded_at": completed_at,
            "updated_at": completed_at,
        }},
    )
    final_order = await db.food_orders.find_one({"order_id": order_id}, {"_id": 0}) or order
    return {
        "order": final_order,
        "refund_amount": round(float(order.get("total") or 0), 2),
        "new_balance": refund_result.new_balance,
        "replayed": bool(refund_result.idempotent_replay),
    }


async def _settle_food_delivery(order_id: str) -> dict:
    """Settle restaurant, courier and platform exactly once for a delivered order."""
    from core.payment_engine import credit_wallet, TransactionType

    order = await db.food_orders.find_one({"order_id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Bestellung nicht gefunden")
    if order.get("settlement_status") == "completed":
        return {
            "order": order,
            "restaurant_share": float(order.get("restaurant_share") or 0),
            "courier_share": float(order.get("courier_share") or 0),
            "platform_fee": float(order.get("platform_fee") or 0),
            "replayed": True,
        }

    delivery_type = order.get("delivery_type") or "delivery"
    allowed_statuses = {"ready"} if delivery_type == "pickup" else {"picked_up", "nearby"}
    if order.get("status") not in allowed_statuses and order.get("status") != "delivered":
        raise HTTPException(status_code=400, detail="Bestellung ist noch nicht lieferbereit/zugestellt")

    restaurant = await db.food_restaurants.find_one({"restaurant_id": order.get("restaurant_id")})
    owner_id = str((restaurant or {}).get("owner_id") or (restaurant or {}).get("user_id") or "")
    if not owner_id:
        await db.food_orders.update_one(
            {"order_id": order_id},
            {"$set": {
                "settlement_status": "reconciliation_required",
                "settlement_error": "restaurant_owner_missing",
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }},
        )
        raise HTTPException(status_code=500, detail="Restaurant-Auszahlung benötigt manuelle Abstimmung")

    subtotal = round(float(order.get("subtotal") or 0), 2)
    promo_discount = round(float(order.get("promo_discount") or 0), 2)
    delivery_fee = round(float(order.get("delivery_fee") or 0), 2)
    service_fee = round(float(order.get("service_fee") or 0), 2)
    small_order_fee = round(float(order.get("small_order_fee") or 0), 2)
    tip = round(float(order.get("tip") or 0), 2)
    food_net = max(0.0, round(subtotal - promo_discount, 2))

    restaurant_share = round(food_net * 0.85 + (tip if delivery_type == "pickup" else 0), 2)
    courier = order.get("courier") or {}
    courier_id = str(courier.get("user_id") or "")
    courier_share = round(delivery_fee * 0.90 + (tip if delivery_type != "pickup" and courier_id else 0), 2)
    platform_fee = round(
        food_net * 0.15
        + delivery_fee * 0.10
        + service_fee
        + small_order_fee
        + (tip if delivery_type != "pickup" and not courier_id else 0),
        2,
    )

    restaurant_credit = await credit_wallet(
        user_id=owner_id,
        amount=restaurant_share,
        tx_type=TransactionType.MERCHANT_CREDIT,
        description=f"Food Bestellung #{order_id[-8:].upper()}",
        reference=f"FOOD-REST-{order_id[-10:].upper()}",
        source="food_order",
        metadata={"order_id": order_id, "restaurant_id": order.get("restaurant_id")},
        idempotency_key=f"food-settlement:{order_id}:restaurant",
    )
    if not restaurant_credit.success:
        await db.food_orders.update_one(
            {"order_id": order_id},
            {"$set": {
                "settlement_status": "reconciliation_required",
                "settlement_error": restaurant_credit.error or "restaurant_credit_failed",
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }},
        )
        raise HTTPException(status_code=500, detail="Restaurant-Auszahlung konnte nicht abgeschlossen werden")

    courier_credit = None
    if courier_id and courier_share > 0:
        courier_credit = await credit_wallet(
            user_id=courier_id,
            amount=courier_share,
            tx_type=TransactionType.DRIVER_EARNINGS,
            description=f"Food Lieferung #{order_id[-8:].upper()}",
            reference=f"FOOD-DRV-{order_id[-10:].upper()}",
            source="food_delivery",
            metadata={"order_id": order_id, "restaurant_id": order.get("restaurant_id")},
            idempotency_key=f"food-settlement:{order_id}:courier",
        )
        if not courier_credit.success:
            await db.food_orders.update_one(
                {"order_id": order_id},
                {"$set": {
                    "settlement_status": "reconciliation_required",
                    "settlement_error": courier_credit.error or "courier_credit_failed",
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }},
            )
            raise HTTPException(status_code=500, detail="Fahrer-Auszahlung konnte nicht abgeschlossen werden")

    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()
    await db.platform_fees.update_one(
        {"type": "food", "order_id": order_id},
        {"$setOnInsert": {
            "type": "food",
            "order_id": order_id,
            "total": round(float(order.get("total") or 0), 2),
            "subtotal": subtotal,
            "promo_discount": promo_discount,
            "delivery_fee": delivery_fee,
            "service_fee": service_fee,
            "small_order_fee": small_order_fee,
            "restaurant_share": restaurant_share,
            "courier_share": courier_share,
            "platform_fee": platform_fee,
            "created_at": now_iso,
        }},
        upsert=True,
    )

    transition = await db.food_orders.update_one(
        {"order_id": order_id, "settlement_status": {"$ne": "completed"}},
        {"$set": {
            "status": "delivered",
            "delivered_at": order.get("delivered_at") or now_iso,
            "settlement_status": "completed",
            "settled_at": now_iso,
            "restaurant_share": restaurant_share,
            "courier_share": courier_share,
            "platform_fee": platform_fee,
            "restaurant_payment_id": restaurant_credit.transaction_id,
            "courier_payment_id": courier_credit.transaction_id if courier_credit else None,
            "updated_at": now_iso,
        }},
    )

    if transition.modified_count == 1:
        customer_oid = ObjectId(order["user_id"]) if ObjectId.is_valid(str(order.get("user_id") or "")) else None
        if customer_oid:
            await db.users.update_one(
                {"_id": customer_oid},
                {"$inc": {
                    "food_orders_count": 1,
                    "food_total_spent": round(float(order.get("total") or 0), 2),
                }},
            )
        if courier_id:
            await db.drivers.update_one(
                {"user_id": courier_id},
                {"$inc": {"total_deliveries": 1, "total_earnings": courier_share}},
            )
        await db.notifications.update_one(
            {"id": f"FOOD-DELIVERED-{order_id}"},
            {"$setOnInsert": {
                "id": f"FOOD-DELIVERED-{order_id}",
                "user_id": order["user_id"],
                "type": "order_delivered",
                "title": "Guten Appetit!",
                "message": "Deine Bestellung wurde geliefert.",
                "data": {"order_id": order_id},
                "read": False,
                "created_at": now_iso,
            }},
            upsert=True,
        )

    final_order = await db.food_orders.find_one({"order_id": order_id}, {"_id": 0}) or order
    return {
        "order": final_order,
        "restaurant_share": restaurant_share,
        "courier_share": courier_share,
        "platform_fee": platform_fee,
        "replayed": transition.modified_count != 1,
    }


# ══════════════════════════════════════
# GET ORDER STATUS
# ══════════════════════════════════════

@router.get("/order/{order_id}")
async def get_order_status(order_id: str, request: Request):
    """Return the real persisted order state. Never simulate restaurant/courier activity."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    order = await db.food_orders.find_one(
        {"order_id": order_id, "user_id": user_id},
        {"_id": 0},
    )
    if not order:
        raise HTTPException(status_code=404, detail="Bestellung nicht gefunden")
    return {"order": order}


@router.post("/cancel")
async def cancel_order(req: OrderAction, request: Request):
    """Customer cancels an unaccepted order and receives one canonical refund."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    order = await db.food_orders.find_one({"order_id": req.order_id, "user_id": user_id})
    if not order:
        raise HTTPException(status_code=404, detail="Bestellung nicht gefunden")

    if order.get("status") in {"cancelled", "rejected"} and order.get("refund_status") == "completed":
        fresh_user = await db.users.find_one({"_id": user["_id"]}, {"balance": 1, "_id": 0}) or {}
        return {
            "ok": True,
            "refund_amount": round(float(order.get("total") or 0), 2),
            "new_balance": round(float(fresh_user.get("balance") or 0), 2),
            "message": "Bestellung bereits erstattet.",
            "replayed": True,
        }
    if order.get("status") not in {"pending", "confirmed", "refunding"}:
        raise HTTPException(status_code=400, detail="Bestellung kann nicht mehr storniert werden")

    result = await _refund_food_order(
        req.order_id,
        final_status="cancelled",
        reason="Vom Kunden storniert",
    )
    return {
        "ok": True,
        "refund_amount": result["refund_amount"],
        "new_balance": result["new_balance"],
        "message": f"Bestellung storniert. €{result['refund_amount']:.2f} zurückerstattet.",
        "replayed": result["replayed"],
    }


@router.post("/delivered")
async def confirm_delivery(req: OrderAction, request: Request):
    """Customer confirms a real delivery/pickup and triggers canonical settlement."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    order = await db.food_orders.find_one({"order_id": req.order_id, "user_id": user_id})
    if not order:
        raise HTTPException(status_code=404, detail="Bestellung nicht gefunden")

    result = await _settle_food_delivery(req.order_id)
    return {
        "ok": True,
        "message": "Lieferung bestätigt. Guten Appetit!",
        "settlement": {
            "restaurant_share": result["restaurant_share"],
            "courier_share": result["courier_share"],
            "platform_fee": result["platform_fee"],
        },
        "replayed": result["replayed"],
    }


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
        {
            "user_id": user_id,
            "status": {"$nin": [
                "delivered", "cancelled", "rejected", "payment_failed",
                "refund_reconciliation_required"
            ]},
        },
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
    restaurant_query = _is_real_approved_restaurant_query(old_order["restaurant_id"])
    restaurant_query["is_open"] = True
    restaurant = await db.food_restaurants.find_one(restaurant_query)
    if not restaurant:
        raise HTTPException(status_code=400, detail="Restaurant nicht verfügbar")
    
    # Recalculate prices (they might have changed)
    menu_map = {item["id"]: item for item in restaurant.get("menu", [])}
    order_items = []
    subtotal = 0
    
    for item in old_order["items"]:
        menu_item = menu_map.get(item["item_id"])
        if not menu_item:
            continue
        cart_item = CartItem(
            item_id=item["item_id"],
            quantity=int(item.get("quantity") or 1),
            size_id=((item.get("size") or {}).get("id") if isinstance(item.get("size"), dict) else None),
            extra_ids=[
                str(extra.get("id"))
                for extra in (item.get("extras") or [])
                if isinstance(extra, dict) and extra.get("id") is not None
            ],
            notes=item.get("notes", ""),
        )
        priced = _price_food_line(menu_item, cart_item)
        subtotal += priced["total"]
        order_items.append(priced)
    
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
    """Register a real restaurant application owned by the authenticated account."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    body = await request.json()
    
    required = ["name", "category", "address", "phone", "email"]
    for field in required:
        if not body.get(field):
            raise HTTPException(status_code=400, detail=f"{field} erforderlich")
    
    existing = await db.food_restaurants.find_one({
        "$or": [
            {"email": body["email"].lower()},
            {"owner_id": user_id},
            {"user_id": user_id},
        ]
    })
    if existing:
        raise HTTPException(status_code=400, detail="Für dieses Konto/E-Mail existiert bereits eine Restaurant-Anmeldung")
    
    now = datetime.now(timezone.utc).isoformat()
    
    restaurant = {
        "restaurant_id": generate_restaurant_id(body["name"]),
        "name": body["name"],
        "category": body["category"],
        "address": body["address"],
        "phone": body["phone"],
        "email": body["email"].lower(),
        "owner_id": user_id,
        "user_id": user_id,
        "owner_name": user.get("name", "") or body.get("owner_name", ""),
        "description": body.get("description", ""),
        "rating": 0,
        "review_count": 0,
        "delivery_time": body.get("delivery_time", "30-45"),
        "price_level": body.get("price_level", 2),
        "image": body.get("image", ""),
        "menu": [],  # Restaurant adds menu items after approval
        "is_real": True,
        "is_demo": False,
        "is_open": False,
        "status": "pending",  # pending, approved, rejected, suspended
        "min_order": body.get("min_order", MIN_ORDER_AMOUNT),
        "delivery_fee": body.get("delivery_fee", DELIVERY_FEE_BASE),
        "location": body.get("location") if isinstance(body.get("location"), dict) else {},
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
    """Owner/admin adds a server-priced menu item."""
    user = await get_current_user(request)
    restaurant = await _require_food_restaurant_owner(user, restaurant_id)
    body = await request.json()

    name = str(body.get("name") or "").strip()[:120]
    if not name:
        raise HTTPException(status_code=400, detail="Artikelname erforderlich")
    try:
        price = round(float(body.get("price")), 2)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="Gültiger Preis erforderlich")
    if price <= 0 or price > 10000:
        raise HTTPException(status_code=400, detail="Ungültiger Artikelpreis")

    menu_item = {
        "id": f"m{secrets.token_hex(4)}",
        "name": name,
        "price": price,
        "description": str(body.get("description") or "")[:1000],
        "category": str(body.get("category") or "main")[:80],
        "image": str(body.get("image") or "")[:1000],
        "sizes": _normalize_food_menu_options(body.get("sizes"), prefix="size_"),
        "extras": _normalize_food_menu_options(body.get("extras"), prefix="extra_"),
        "available": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.food_restaurants.update_one(
        {"_id": restaurant["_id"]},
        {"$push": {"menu": menu_item}, "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    return {"ok": True, "item": menu_item}


@router.post("/restaurant/{restaurant_id}/menu/update")
async def update_menu_item(restaurant_id: str, request: Request):
    """Owner/admin updates a menu item."""
    user = await get_current_user(request)
    restaurant = await _require_food_restaurant_owner(user, restaurant_id)
    body = await request.json()
    item_id = str(body.get("item_id") or "")
    if not item_id:
        raise HTTPException(status_code=400, detail="item_id erforderlich")

    updates = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if "name" in body:
        name = str(body["name"] or "").strip()[:120]
        if not name:
            raise HTTPException(status_code=400, detail="Artikelname erforderlich")
        updates["menu.$.name"] = name
    if "price" in body:
        try:
            price = round(float(body["price"]), 2)
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail="Ungültiger Preis")
        if price <= 0 or price > 10000:
            raise HTTPException(status_code=400, detail="Ungültiger Preis")
        updates["menu.$.price"] = price
    if "description" in body:
        updates["menu.$.description"] = str(body["description"] or "")[:1000]
    if "available" in body:
        updates["menu.$.available"] = bool(body["available"])
    if "sizes" in body:
        updates["menu.$.sizes"] = _normalize_food_menu_options(body.get("sizes"), prefix="size_")
    if "extras" in body:
        updates["menu.$.extras"] = _normalize_food_menu_options(body.get("extras"), prefix="extra_")

    result = await db.food_restaurants.update_one(
        {"_id": restaurant["_id"], "menu.id": item_id},
        {"$set": updates},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Artikel nicht gefunden")
    return {"ok": True}


@router.delete("/restaurant/{restaurant_id}/menu/{item_id}")
async def delete_menu_item(restaurant_id: str, item_id: str, request: Request):
    """Owner/admin deletes a menu item."""
    user = await get_current_user(request)
    restaurant = await _require_food_restaurant_owner(user, restaurant_id)
    result = await db.food_restaurants.update_one(
        {"_id": restaurant["_id"], "menu.id": item_id},
        {"$pull": {"menu": {"id": item_id}}, "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}},
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
    user = await get_current_user(request)
    body = await request.json()
    is_open = bool(body.get("is_open", False))
    restaurant = await _require_food_restaurant_owner(user, restaurant_id)
    
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
                "is_real": True,
                "is_demo": False,
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
    """DEPRECATED: Demo seeding disabled. Use real restaurant registration."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Nur Admin")
    
    # NO FAKE DATA - Return info message
    return {
        "ok": False, 
        "message": "Demo-Seeding deaktiviert. Restaurants müssen sich real registrieren unter /api/food/restaurant/register"
    }


@router.delete("/admin/cleanup-fake")
async def admin_cleanup_fake_data(request: Request):
    """Admin: Remove ALL fake/demo data from the system."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Nur Admin")
    
    results = {
        "drivers_removed": 0,
        "scooters_removed": 0,
        "restaurants_removed": 0,
        "auctions_removed": 0,
    }
    
    # Remove unverified drivers
    r = await db.drivers.delete_many({"verified": {"$ne": True}})
    results["drivers_removed"] = r.deleted_count
    
    # Remove demo scooters (if any have is_demo flag)
    r = await db.scooters.delete_many({"$or": [{"is_demo": True}, {"status": "demo"}]})
    results["scooters_removed"] = r.deleted_count
    
    # Remove unapproved restaurants
    r = await db.food_restaurants.delete_many({"$or": [{"is_demo": True}, {"status": {"$ne": "approved"}}]})
    results["restaurants_removed"] = r.deleted_count
    
    # Remove demo auctions (keep real ones)
    r = await db.auctions.delete_many({"is_demo": True})
    results["auctions_removed"] = r.deleted_count
    
    return {"ok": True, "cleaned": results, "message": "Alle Fake-Daten entfernt!"}


# ══════════════════════════════════════
# RESTAURANT DASHBOARD
# ══════════════════════════════════════

@router.get("/restaurant/dashboard")
async def restaurant_dashboard(request: Request):
    """Restaurant owner sees their dashboard with incoming orders."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    # Find restaurant owned by user
    restaurant = await db.food_restaurants.find_one({
        "$or": [
            {"owner_id": user_id},
            {"user_id": user_id}
        ]
    })
    
    if not restaurant:
        raise HTTPException(status_code=404, detail="Kein Restaurant gefunden")
    
    restaurant_id = restaurant.get("restaurant_id")
    
    # Get today's orders
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    
    orders = await db.food_orders.find({
        "restaurant_id": restaurant_id,
        "created_at": {"$gte": today.isoformat()}
    }, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    # Stats
    pending_orders = [o for o in orders if o.get("status") in ["pending", "confirmed"]]
    preparing_orders = [o for o in orders if o.get("status") == "preparing"]
    completed_orders = [o for o in orders if o.get("status") == "delivered"]
    
    total_revenue = sum(float(o.get("restaurant_share") or 0) for o in completed_orders)
    
    return {
        "restaurant": {
            "id": restaurant_id,
            "name": restaurant.get("name"),
            "is_open": restaurant.get("is_open", False),
            "status": restaurant.get("status"),
        },
        "orders": {
            "pending": pending_orders,
            "preparing": preparing_orders,
            "all_today": orders,
        },
        "stats": {
            "total_orders_today": len(orders),
            "pending_count": len(pending_orders),
            "preparing_count": len(preparing_orders),
            "completed_count": len(completed_orders),
            "total_revenue_today": round(total_revenue, 2),
        }
    }


@router.post("/restaurant/order/accept")
async def restaurant_accept_order(request: Request):
    """Restaurant accepts an incoming order."""
    body = await request.json()
    order_id = body.get("order_id")
    try:
        prep_time = max(5, min(int(body.get("prep_time", 20)), 120))
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="Ungültige Zubereitungszeit")
    
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    # Find restaurant owned by user
    restaurant = await db.food_restaurants.find_one({
        "$or": [{"owner_id": user_id}, {"user_id": user_id}]
    })
    
    if not restaurant:
        raise HTTPException(status_code=404, detail="Kein Restaurant gefunden")
    
    order = await db.food_orders.find_one({
        "order_id": order_id,
        "restaurant_id": restaurant.get("restaurant_id")
    })
    
    if not order:
        raise HTTPException(status_code=404, detail="Bestellung nicht gefunden")
    
    if order.get("status") not in ["pending", "confirmed"]:
        raise HTTPException(status_code=400, detail="Bestellung kann nicht akzeptiert werden")
    
    now = datetime.now(timezone.utc)
    estimated_ready = now + timedelta(minutes=prep_time)
    
    transition = await db.food_orders.update_one(
        {
            "order_id": order_id,
            "restaurant_id": restaurant.get("restaurant_id"),
            "status": {"$in": ["pending", "confirmed"]},
        },
        {"$set": {
            "status": "preparing",
            "accepted_at": now.isoformat(),
            "prep_time_minutes": prep_time,
            "estimated_ready_at": estimated_ready.isoformat(),
            "updated_at": now.isoformat(),
        }}
    )
    if transition.modified_count != 1:
        current = await db.food_orders.find_one({"order_id": order_id}, {"_id": 0}) or {}
        if current.get("status") == "preparing":
            return {"ok": True, "status": "preparing", "estimated_ready_at": current.get("estimated_ready_at"), "replayed": True}
        raise HTTPException(status_code=409, detail="Bestellstatus wurde parallel geändert")
    
    # Notify customer
    await db.notifications.insert_one({
        "id": secrets.token_hex(8),
        "user_id": order["user_id"],
        "type": "order_accepted",
        "title": "Bestellung bestätigt!",
        "message": f"{restaurant.get('name')} bereitet deine Bestellung vor (~{prep_time} Min)",
        "data": {"order_id": order_id},
        "read": False,
        "created_at": now.isoformat(),
    })
    
    return {"ok": True, "status": "preparing", "estimated_ready_at": estimated_ready.isoformat()}


@router.post("/restaurant/order/ready")
async def restaurant_order_ready(request: Request):
    """Restaurant marks order as ready for pickup."""
    body = await request.json()
    order_id = body.get("order_id")
    
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    restaurant = await db.food_restaurants.find_one({
        "$or": [{"owner_id": user_id}, {"user_id": user_id}]
    })
    
    if not restaurant:
        raise HTTPException(status_code=404, detail="Kein Restaurant gefunden")
    
    order = await db.food_orders.find_one({
        "order_id": order_id,
        "restaurant_id": restaurant.get("restaurant_id")
    })
    
    if not order:
        raise HTTPException(status_code=404, detail="Bestellung nicht gefunden")
    
    if order.get("status") != "preparing":
        raise HTTPException(status_code=400, detail="Bestellung ist nicht in Zubereitung")
    
    now = datetime.now(timezone.utc)
    
    transition = await db.food_orders.update_one(
        {
            "order_id": order_id,
            "restaurant_id": restaurant.get("restaurant_id"),
            "status": "preparing",
        },
        {"$set": {
            "status": "ready",
            "ready_at": now.isoformat(),
            "updated_at": now.isoformat(),
        }}
    )
    if transition.modified_count != 1:
        current = await db.food_orders.find_one({"order_id": order_id}, {"_id": 0}) or {}
        if current.get("status") == "ready":
            return {"ok": True, "status": "ready", "replayed": True}
        raise HTTPException(status_code=409, detail="Bestellstatus wurde parallel geändert")
    
    # Notify customer
    await db.notifications.insert_one({
        "id": secrets.token_hex(8),
        "user_id": order["user_id"],
        "type": "order_ready",
        "title": "Essen fertig!",
        "message": f"Deine Bestellung bei {restaurant.get('name')} ist bereit zur Abholung.",
        "data": {"order_id": order_id},
        "read": False,
        "created_at": now.isoformat(),
    })
    
    return {"ok": True, "status": "ready"}


@router.post("/restaurant/order/reject")
async def restaurant_reject_order(request: Request):
    """Restaurant rejects an unaccepted order through the canonical refund flow."""
    body = await request.json()
    order_id = str(body.get("order_id") or "")
    reason = str(body.get("reason") or "Restaurant abgelehnt")[:300]

    user = await get_current_user(request)
    user_id = str(user["_id"])
    restaurant = await db.food_restaurants.find_one({
        "$or": [{"owner_id": user_id}, {"user_id": user_id}]
    })
    if not restaurant:
        raise HTTPException(status_code=404, detail="Kein Restaurant gefunden")

    order = await db.food_orders.find_one({
        "order_id": order_id,
        "restaurant_id": restaurant.get("restaurant_id"),
    })
    if not order:
        raise HTTPException(status_code=404, detail="Bestellung nicht gefunden")

    if order.get("status") in {"rejected", "cancelled"} and order.get("refund_status") == "completed":
        return {
            "ok": True,
            "status": order.get("status"),
            "refunded": round(float(order.get("total") or 0), 2),
            "replayed": True,
        }
    if order.get("status") not in {"pending", "confirmed", "refunding"}:
        raise HTTPException(status_code=400, detail="Bestellung kann nicht abgelehnt werden")

    result = await _refund_food_order(
        order_id,
        final_status="rejected",
        reason=reason,
    )
    now_iso = datetime.now(timezone.utc).isoformat()
    await db.notifications.update_one(
        {"id": f"FOOD-REJECTED-{order_id}"},
        {"$setOnInsert": {
            "id": f"FOOD-REJECTED-{order_id}",
            "user_id": order["user_id"],
            "type": "order_rejected",
            "title": "Bestellung abgelehnt",
            "message": f"{restaurant.get('name')}: {reason}. Betrag wurde erstattet.",
            "data": {"order_id": order_id},
            "read": False,
            "created_at": now_iso,
        }},
        upsert=True,
    )
    return {
        "ok": True,
        "status": "rejected",
        "refunded": result["refund_amount"],
        "replayed": result["replayed"],
    }


# ══════════════════════════════════════
# DELIVERY DRIVER FLOW
# ══════════════════════════════════════

@router.get("/delivery/available")
async def get_available_deliveries(request: Request):
    """Delivery driver sees available orders ready for pickup."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    # Check if user is a driver
    driver = await db.drivers.find_one({"user_id": user_id, "verified": True})
    if not driver:
        raise HTTPException(status_code=403, detail="Nicht als Fahrer registriert")
    
    # Get orders ready for pickup without assigned courier
    orders = await db.food_orders.find({
        "status": "ready",
        "delivery_type": {"$ne": "pickup"},
        "$or": [{"courier": None}, {"courier": {"$exists": False}}],
    }, {"_id": 0}).sort("ready_at", 1).to_list(20)
    
    return {"orders": orders, "total": len(orders)}


@router.post("/delivery/accept")
async def delivery_accept_order(request: Request):
    """Delivery driver accepts an order for delivery."""
    body = await request.json()
    order_id = body.get("order_id")
    
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    driver = await db.drivers.find_one({"user_id": user_id, "verified": True})
    if not driver:
        raise HTTPException(status_code=403, detail="Nicht als Fahrer registriert")
    
    order = await db.food_orders.find_one({"order_id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Bestellung nicht gefunden")
    
    if order.get("status") != "ready":
        raise HTTPException(status_code=400, detail="Bestellung nicht bereit")
    
    if order.get("courier"):
        raise HTTPException(status_code=400, detail="Bereits von anderem Fahrer übernommen")
    
    now = datetime.now(timezone.utc)
    
    courier = {
        "driver_id": driver.get("driver_id"),
        "user_id": user_id,
        "name": driver.get("user_name", user.get("name", "")),
        "phone": driver.get("phone", ""),
        "vehicle": driver.get("car", {}).get("type", "bike"),
    }
    
    claim = await db.food_orders.update_one(
        {
            "order_id": order_id,
            "status": "ready",
            "$or": [{"courier": None}, {"courier": {"$exists": False}}],
        },
        {"$set": {
            "status": "picked_up",
            "courier": courier,
            "picked_up_at": now.isoformat(),
            "updated_at": now.isoformat(),
        }}
    )
    if claim.modified_count != 1:
        current = await db.food_orders.find_one({"order_id": order_id}, {"_id": 0}) or {}
        if current.get("courier", {}).get("user_id") == user_id and current.get("status") == "picked_up":
            return {"ok": True, "status": "picked_up", "order_id": order_id, "replayed": True}
        raise HTTPException(status_code=409, detail="Bestellung wurde gerade von einem anderen Fahrer übernommen")
    
    # Notify customer
    await db.notifications.insert_one({
        "id": secrets.token_hex(8),
        "user_id": order["user_id"],
        "type": "order_picked_up",
        "title": "Fahrer unterwegs!",
        "message": f"{courier['name']} hat deine Bestellung abgeholt.",
        "data": {"order_id": order_id, "driver_name": courier["name"]},
        "read": False,
        "created_at": now.isoformat(),
    })
    
    return {"ok": True, "status": "picked_up", "order_id": order_id}


@router.post("/delivery/complete")
async def delivery_complete_order(request: Request):
    """Driver completes an assigned delivery through the canonical settlement flow."""
    body = await request.json()
    order_id = str(body.get("order_id") or "")

    user = await get_current_user(request)
    user_id = str(user["_id"])
    driver = await db.drivers.find_one({"user_id": user_id, "verified": True})
    if not driver:
        raise HTTPException(status_code=403, detail="Nicht als Fahrer registriert")

    order = await db.food_orders.find_one({"order_id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Bestellung nicht gefunden")

    if order.get("courier", {}).get("user_id") != user_id:
        raise HTTPException(status_code=403, detail="Nicht deine Lieferung")
    if order.get("status") == "delivered" and order.get("settlement_status") == "completed":
        return {
            "ok": True,
            "status": "delivered",
            "driver_payment": round(float(order.get("courier_share") or 0), 2),
            "message": "Lieferung war bereits abgeschlossen.",
            "replayed": True,
        }
    if order.get("status") != "picked_up":
        raise HTTPException(status_code=400, detail="Bestellung nicht unterwegs")

    result = await _settle_food_delivery(order_id)
    return {
        "ok": True,
        "status": "delivered",
        "driver_payment": round(float(result.get("courier_share") or 0), 2),
        "message": f"Lieferung abgeschlossen! €{float(result.get('courier_share') or 0):.2f} verdient.",
        "replayed": result["replayed"],
    }


@router.get("/delivery/active")
async def get_driver_active_delivery(request: Request):
    """Get driver's current active delivery."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    order = await db.food_orders.find_one({
        "courier.user_id": user_id,
        "status": "picked_up",
    }, {"_id": 0})
    
    if not order:
        return {"has_active": False, "order": None}
    
    return {"has_active": True, "order": order}




# ═══ STAMPS / LOYALTY ═══

@router.get("/stamps")
async def get_user_stamps(request: Request):
    """Get all loyalty stamps for current user."""
    user = await get_current_user(request)
    stamps = await db.food_stamps.find({"user_email": user.get("email", "")}, {"_id": 0}).to_list(50)
    return {"stamps": stamps}

@router.get("/stamps/{restaurant_id}")
async def get_restaurant_stamps(restaurant_id: str, request: Request):
    user = await get_current_user(request)
    stamp = await db.food_stamps.find_one(
        {"user_email": user.get("email", ""), "restaurant_id": restaurant_id}, {"_id": 0}
    )
    restaurant = await db.food_restaurants.find_one({"restaurant_id": restaurant_id}, {"_id": 0, "stamps_needed": 1, "stamps_enabled": 1, "name": 1})
    needed = restaurant.get("stamps_needed", 10) if restaurant else 10
    current = stamp.get("stamps", 0) if stamp else 0
    return {"stamps": current, "needed": needed, "restaurant_name": restaurant.get("name", ""), "complete": current >= needed}


# ═══ FILTERED SEARCH ═══

@router.get("/filtered")
async def filtered_restaurants(
    request: Request,
    free_delivery: bool = False,
    fast: bool = False,
    top_rated: bool = False,
    is_new: bool = False,
    category: str = "",
    search: str = "",
    address: str = "",
):
    """Advanced filtered restaurant search — Lieferando-style."""
    query = {
        "is_open": True,
        "status": "approved",
        "is_demo": {"$ne": True},
        "$or": [{"is_real": True}, {"approved_by": {"$exists": True}}],
    }
    
    if free_delivery:
        query["$or"] = [{"free_delivery": True}, {"delivery_fee": 0}]
    if top_rated:
        query["rating"] = {"$gte": 4.5}
    if is_new:
        query["is_new"] = True
    if category:
        query["category"] = category
    if search:
        query["name"] = {"$regex": search, "$options": "i"}
    
    restaurants = await db.food_restaurants.find(query, {"_id": 0}).sort("rating", -1).to_list(30)
    
    # Fast filter (delivery_time contains minutes)
    if fast:
        def parse_time(dt):
            try:
                parts = dt.replace(" min", "").replace(" Min", "").split("-")
                return int(parts[0])
            except:
                return 60
        restaurants = [r for r in restaurants if parse_time(r.get("delivery_time", "60")) <= 30]
    
    # Add stamp info if authenticated
    try:
        user = await get_current_user(request)
        email = user.get("email", "")
        stamps = {s["restaurant_id"]: s["stamps"] for s in await db.food_stamps.find({"user_email": email}, {"_id": 0}).to_list(50)}
        for r in restaurants:
            r["user_stamps"] = stamps.get(r["restaurant_id"], 0)
    except:
        pass
    
    return {"restaurants": restaurants, "total": len(restaurants), "module_ready": True}
