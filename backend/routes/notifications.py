"""
BidBlitz V2 - Push Notifications System
In-App Notifications mit Bell-Badge, Kategorien, Read/Unread, Auto-Trigger
"""
from fastapi import APIRouter, HTTPException, Request, Query
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
from core.database import db
from core.security import get_current_user
from core.config import TEST_MODE
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
    # Never inject demo notifications into a real environment.
    if not TEST_MODE:
        return
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
            "user_email": "admin@bidblitz.ae",
            "category": s["category"],
            "title": s["title"],
            "body": s["body"],
            "action_url": s.get("action_url", ""),
            "read": i > 5,
            "created_at": now.isoformat(),
        })


def _notification_identity_query(user: dict) -> dict:
    user_id = str(user["_id"])
    emails = {
        str(user.get("email") or "").strip().lower(),
        str(user.get("login_email") or "").strip().lower(),
        str(user.get("canonical_email") or "").strip().lower(),
    }
    emails.discard("")
    identity = [{"user_id": user_id}]
    if emails:
        identity.append({"user_email": {"$in": list(emails)}})
    return {"$or": identity}


def _notification_id_query(notification_id: str) -> dict:
    return {
        "$or": [
            {"notif_id": notification_id},
            {"id": notification_id},
            {"notification_id": notification_id},
        ]
    }


def _normalize_notification(doc: dict) -> dict:
    normalized = dict(doc)
    notification_id = (
        normalized.get("notif_id")
        or normalized.get("id")
        or normalized.get("notification_id")
        or ""
    )
    category = normalized.get("category") or normalized.get("type") or "system"
    body = normalized.get("body") or normalized.get("message") or ""
    normalized["notif_id"] = notification_id
    normalized["id"] = notification_id
    normalized["notification_id"] = notification_id
    normalized["category"] = category
    normalized["type"] = normalized.get("type") or category
    normalized["body"] = body
    normalized["message"] = normalized.get("message") or body
    normalized["read"] = bool(normalized.get("read", False))
    return normalized


@router.get("")
@router.get("/")
@router.get("/list")
async def get_notifications(
    request: Request,
    category: Optional[str] = None,
    unread_only: bool = False,
    limit: int = Query(50, ge=1, le=200),
):
    user = await get_current_user(request)
    identity = _notification_identity_query(user)
    filters = [identity]
    if category:
        filters.append({"$or": [{"category": category}, {"type": category}]})
    if unread_only:
        filters.append({"read": False})
    query = {"$and": filters} if len(filters) > 1 else identity

    raw = await db.notifications.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    notifs = [_normalize_notification(doc) for doc in raw]
    unread_query = {"$and": [identity, {"read": False}]}
    unread_count = await db.notifications.count_documents(unread_query)
    return {"notifications": notifs, "unread_count": unread_count, "total": len(notifs)}


@router.get("/unread-count")
async def get_unread_count(request: Request):
    user = await get_current_user(request)
    identity = _notification_identity_query(user)
    count = await db.notifications.count_documents({"$and": [identity, {"read": False}]})
    return {"unread_count": count}


@router.post("/read/{notif_id}")
async def mark_read(notif_id: str, request: Request):
    user = await get_current_user(request)
    identity = _notification_identity_query(user)
    result = await db.notifications.update_one(
        {"$and": [identity, _notification_id_query(notif_id)]},
        {"$set": {"read": True, "read_at": datetime.now(timezone.utc).isoformat()}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Benachrichtigung nicht gefunden")
    return {"ok": True}


@router.post("/read-all")
async def mark_all_read(request: Request):
    user = await get_current_user(request)
    identity = _notification_identity_query(user)
    r = await db.notifications.update_many(
        {"$and": [identity, {"read": False}]},
        {"$set": {"read": True, "read_at": datetime.now(timezone.utc).isoformat()}},
    )
    return {"ok": True, "marked": r.modified_count}


@router.delete("/{notif_id}")
async def delete_notification(notif_id: str, request: Request):
    user = await get_current_user(request)
    identity = _notification_identity_query(user)
    result = await db.notifications.delete_one(
        {"$and": [identity, _notification_id_query(notif_id)]},
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Benachrichtigung nicht gefunden")
    return {"ok": True}


@router.get("/categories")
async def get_categories():
    return {"categories": CATEGORIES}


async def create_notification(user_email: str, category: str, title: str, body: str, action_url: str = ""):
    """Create a canonical in-app notification while preserving email compatibility."""
    email = str(user_email or "").strip().lower()
    target_user = await db.users.find_one({"email": email}, {"_id": 1}) if email else None
    notification_id = secrets.token_hex(8)
    doc = {
        "notif_id": notification_id,
        "id": notification_id,
        "notification_id": notification_id,
        "user_email": email,
        "category": category,
        "type": category,
        "title": title,
        "body": body,
        "message": body,
        "action_url": action_url,
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    if target_user:
        doc["user_id"] = str(target_user["_id"])
    await db.notifications.insert_one(doc)
    return _normalize_notification(doc)

