"""
BidBlitz V2 - QR Menu (Digitale Speisekarte fuer Restaurants)
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from datetime import datetime, timezone
from core.database import db
from core.security import get_current_user
import secrets
from typing import List

router = APIRouter(prefix="/api/qr-menu", tags=["qr-menu"])

DEMO_RESTAURANTS = [
    {"id": "qr1", "name": "Pizzeria Bella", "type": "Italienisch", "menu": [
        {"name": "Margherita", "price": 9.90, "category": "Pizza"}, {"name": "Quattro Formaggi", "price": 12.90, "category": "Pizza"},
        {"name": "Tiramisu", "price": 6.50, "category": "Dessert"}, {"name": "Bruschetta", "price": 7.90, "category": "Vorspeise"},
    ]},
    {"id": "qr2", "name": "Sushi Tokyo", "type": "Japanisch", "menu": [
        {"name": "Lachs Nigiri (4St)", "price": 8.50, "category": "Nigiri"}, {"name": "California Roll (8St)", "price": 11.90, "category": "Maki"},
        {"name": "Miso Suppe", "price": 4.50, "category": "Suppe"}, {"name": "Edamame", "price": 5.90, "category": "Vorspeise"},
    ]},
    {"id": "qr3", "name": "Burger House", "type": "Amerikanisch", "menu": [
        {"name": "Classic Burger", "price": 10.90, "category": "Burger"}, {"name": "Cheese Bacon Burger", "price": 13.90, "category": "Burger"},
        {"name": "Sweet Potato Fries", "price": 5.50, "category": "Beilage"}, {"name": "Brownie Sundae", "price": 7.90, "category": "Dessert"},
    ]},
]

class QROrder(BaseModel):
    restaurant_id: str
    items: List[str]
    table_number: int = 1

@router.get("/restaurants")
async def get_restaurants():
    return {"restaurants": DEMO_RESTAURANTS}

@router.get("/menu/{restaurant_id}")
async def get_menu(restaurant_id: str):
    rest = next((r for r in DEMO_RESTAURANTS if r["id"] == restaurant_id), None)
    if not rest:
        raise HTTPException(404, "Restaurant nicht gefunden")
    return {"restaurant": rest}

@router.post("/order")
async def place_qr_order(req: QROrder, request: Request):
    user = await get_current_user(request)
    rest = next((r for r in DEMO_RESTAURANTS if r["id"] == req.restaurant_id), None)
    if not rest:
        raise HTTPException(404, "Restaurant nicht gefunden")
    ordered_items = []
    total = 0
    for item_name in req.items:
        item = next((m for m in rest["menu"] if m["name"] == item_name), None)
        if item:
            ordered_items.append(item)
            total += item["price"]
    if not ordered_items:
        raise HTTPException(400, "Keine gueltigen Gerichte")
    order = {
        "order_id": f"qrm_{secrets.token_hex(6)}",
        "user_email": user.get("email", ""),
        "restaurant_id": req.restaurant_id,
        "restaurant_name": rest["name"],
        "table_number": req.table_number,
        "items": ordered_items,
        "total": round(total, 2),
        "status": "preparing",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.qr_menu_orders.insert_one(order)
    return {"ok": True, "order_id": order["order_id"], "total": round(total, 2), "message": f"Bestellung bei {rest['name']} aufgegeben: {round(total,2)} EUR"}
