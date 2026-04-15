"""
BidBlitz V2 - Push Notifications System
In-App Notifications mit Bell-Badge, Kategorien, Read/Unread, Auto-Trigger
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
from core.database import db
from core.security import get_current_user
import secrets

router = APIRouter(prefix="/api/notifications", tags=["notifications"])

CATEGORIES = {
    "payment": {"label": "Zahlung", "icon": "wallet", "color": "#00C2FF"},
    "ride": {"label": "Fahrt", "icon": "car", "color": "#10B981"},
    "booking": {"label": "Buchung", "icon": "calendar", "color": "#A855F7"},
    "promo": {"label": "Angebot", "icon": "gift", "color": "#F59E0B"},
    "security": {"label": "Sicherheit", "icon": "shield", "color": "#EF4444"},
    "social": {"label": "Social", "icon": "users", "color": "#EC4899"},
    "kids": {"label": "Kids", "icon": "baby", "color": "#F472B6"},
    "system": {"label": "System", "icon": "bell", "color": "#6B7280"},
    "crypto": {"label": "Krypto", "icon": "bitcoin", "color": "#F7931A"},
    "charging": {"label": "Laden", "icon": "zap", "color": "#10B981"},
}


@router.on_event("startup")
async def seed_notifications():
    count = await db.notifications.count_documents({})
    if count > 0:
        return

    now = datetime.now(timezone.utc)
    samples = [
        {"category": "payment", "title": "Zahlung eingegangen", "body": "50,00€ von Max Mustermann erhalten.", "action_url": "/wallet"},
        {"category": "payment", "title": "Cashback gutgeschrieben", "body": "3% Cashback (1,24€) für Hotel-Buchung.", "action_url": "/wallet"},
        {"category": "ride", "title": "Fahrt abgeschlossen", "body": "Taxi von Alexanderplatz nach Flughafen BER. 34,50€ bezahlt.", "action_url": "/taxi"},
        {"category": "promo", "title": "Flash Sale: 50% auf Auktions-Credits!", "body": "Nur heute: Alle Credits zum halben Preis. Jetzt zugreifen!", "action_url": "/auctions"},
        {"category": "promo", "title": "Neues Scooter Monats-Abo", "body": "Spare mit dem Monats-Abo: 45 Min. frei/Tag für nur 29,99€/Monat.", "action_url": "/scooter"},
        {"category": "booking", "title": "Hotel-Buchung bestätigt", "body": "Hotel Adlon, Berlin — Check-in 15.05.2026. Buchungs-Nr: BLZ-8472.", "action_url": "/hotels"},
        {"category": "kids", "title": "Albin hat die Schule verlassen", "body": "Geofencing-Alert: Albin hat die Zone 'Schule' um 15:34 verlassen.", "action_url": "/kids"},
        {"category": "kids", "title": "Anuar ist zuhause angekommen", "body": "GPS-Update: Anuar ist in der Zone 'Zuhause' angekommen.", "action_url": "/kids"},
        {"category": "security", "title": "Neues Gerät angemeldet", "body": "Login von iPhone 15 Pro, Berlin. Nicht Sie? Passwort ändern.", "action_url": "/settings"},
        {"category": "crypto", "title": "Bitcoin +5,2% heute", "body": "BTC ist auf 65.320€ gestiegen. Dein Portfolio: +312,50€.", "action_url": "/crypto"},
        {"category": "charging", "title": "Ladevorgang abgeschlossen", "body": "42,3 kWh geladen @ Schnelllader Alexanderplatz. 19,04€ bezahlt.", "action_url": "/ladesaeulen"},
        {"category": "social", "title": "Neue Follower", "body": "3 neue Nutzer folgen dir: @lisa, @max, @sophie.", "action_url": "/social"},
        {"category": "system", "title": "App-Update verfügbar", "body": "BidBlitz V2.5 mit neuen Features: Streaming, Dating, Fitness.", "action_url": "/all-services"},
    ]

    for i, s in enumerate(samples):
        await db.notifications.insert_one({
            "notif_id": secrets.token_hex(8),
            "user_email": "admin@bidblitz.com",
            "category": s["category"],
            "title": s["title"],
            "body": s["body"],
            "action_url": s.get("action_url", ""),
            "read": i > 5,
            "created_at": now.isoformat(),
        })


@router.get("/list")
async def get_notifications(request: Request, category: Optional[str] = None, unread_only: bool = False):
    user = await get_current_user(request)
    q = {"user_email": user.get("email", "")}
    if category:
        q["category"] = category
    if unread_only:
        q["read"] = False
    notifs = await db.notifications.find(q, {"_id": 0}).sort("created_at", -1).to_list(50)
    unread_count = await db.notifications.count_documents({"user_email": user.get("email", ""), "read": False})
    return {"notifications": notifs, "unread_count": unread_count, "total": len(notifs)}


@router.get("/unread-count")
async def get_unread_count(request: Request):
    user = await get_current_user(request)
    count = await db.notifications.count_documents({"user_email": user.get("email", ""), "read": False})
    return {"unread_count": count}


@router.post("/read/{notif_id}")
async def mark_read(notif_id: str, request: Request):
    user = await get_current_user(request)
    await db.notifications.update_one(
        {"notif_id": notif_id, "user_email": user.get("email", "")},
        {"$set": {"read": True, "read_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"ok": True}


@router.post("/read-all")
async def mark_all_read(request: Request):
    user = await get_current_user(request)
    r = await db.notifications.update_many(
        {"user_email": user.get("email", ""), "read": False},
        {"$set": {"read": True, "read_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"ok": True, "marked": r.modified_count}


@router.delete("/{notif_id}")
async def delete_notification(notif_id: str, request: Request):
    user = await get_current_user(request)
    await db.notifications.delete_one({"notif_id": notif_id, "user_email": user.get("email", "")})
    return {"ok": True}


@router.get("/categories")
async def get_categories():
    return {"categories": CATEGORIES}


async def create_notification(user_email: str, category: str, title: str, body: str, action_url: str = ""):
    """Helper: Create a notification from any module."""
    await db.notifications.insert_one({
        "notif_id": secrets.token_hex(8),
        "user_email": user_email,
        "category": category,
        "title": title,
        "body": body,
        "action_url": action_url,
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
