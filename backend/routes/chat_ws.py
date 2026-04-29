"""
BidBlitz V2 - Live-Chat WebSocket
Real-Time-Chat zwischen Passagier und Fahrer (Taxi/Scooter) sowie Kunde/Restaurant.
Channel-ID = ride_id / rental_id / order_id.
"""
from datetime import datetime, timezone
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, HTTPException
from typing import Dict, Set, Optional
import json
import logging

from core.database import db
from core.security import get_current_user_from_token

router = APIRouter()
logger = logging.getLogger("bidblitz.chat_ws")

# room_id (ride_id/rental_id/order_id) -> Set[WebSocket]
active_rooms: Dict[str, Set[WebSocket]] = {}


async def _check_room_membership(user_id: str, room_id: str) -> bool:
    """Prüft, ob user_id Teilnehmer (passenger, driver, kunde, restaurant) eines Raums ist.
    Match-Reihenfolge: taxi_rides -> scooter_rentals -> food_orders -> chats.
    Admin/system bypass wenn role in user-doc admin/system.
    """
    # Admin bypass
    user = await db.users.find_one({"_id": __import__("bson").ObjectId(user_id)}) if user_id else None
    if user and user.get("role") in ("admin", "system"):
        return True

    # taxi_rides
    if await db.taxi_rides.find_one({
        "ride_id": room_id,
        "$or": [{"customer_id": user_id}, {"driver_id": user_id}, {"user_id": user_id}],
    }):
        return True
    # scooter rentals
    if await db.scooter_rentals.find_one({
        "$or": [{"rental_id": room_id}, {"ride_id": room_id}],
        "user_id": user_id,
    }):
        return True
    # food orders
    if await db.food_orders.find_one({
        "order_id": room_id,
        "$or": [{"user_id": user_id}, {"driver_id": user_id}, {"restaurant_owner_id": user_id}],
    }):
        return True
    # generic chats
    if await db.chats.find_one({
        "chat_id": room_id,
        "$or": [{"user1_id": user_id}, {"user2_id": user_id}],
    }):
        return True
    return False


async def _persist_message(room_id: str, payload: dict) -> dict:
    """Persistiert Message in Mongo (chat_messages-Collection, gleiche Form wie REST-API)."""
    msg = {
        "chat_id": room_id,
        "ride_id": room_id,  # alias for ride/rental/order chats
        "sender_id": payload.get("sender_id", ""),
        "sender_name": payload.get("sender_name", ""),
        "recipient_id": payload.get("recipient_id", ""),
        "message": payload.get("message", ""),
        "type": payload.get("type", "text"),
        "data": payload.get("data"),
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    try:
        await db.chat_messages.insert_one(msg)
    except Exception as e:
        logger.exception("chat_messages insert failed: %s", e)
    msg.pop("_id", None)
    return msg


async def broadcast_to_room(room_id: str, message: dict, exclude: WebSocket | None = None):
    """Verteile Message an alle Sockets im Raum (außer Sender, falls exclude)."""
    if room_id not in active_rooms:
        return
    payload = json.dumps(message)
    dead = []
    for ws in active_rooms[room_id].copy():
        if ws is exclude:
            continue
        try:
            await ws.send_text(payload)
        except Exception:
            dead.append(ws)
    for ws in dead:
        active_rooms[room_id].discard(ws)


@router.websocket("/api/chat/ws/{room_id}")
async def chat_room(websocket: WebSocket, room_id: str, token: Optional[str] = Query(None)):
    """Chat-Raum pro ride/rental/order. JWT-Token in Query erforderlich.
    Validates token + Room-Membership and uses accept()-then-close() so the
    client receives the documented close codes (4401/4403).
    """
    # WS-Spec: accept first, then close mit code für sichtbares Close-Frame
    await websocket.accept()

    if not token:
        await websocket.close(code=4401, reason="token_required")
        return
    try:
        user = await get_current_user_from_token(token)
        user_id = str(user.get("_id", user.get("id", "")))
        if not user_id:
            raise HTTPException(401, "invalid_user")
    except Exception as e:
        logger.info(f"chat_ws auth failed: {e}")
        await websocket.close(code=4401, reason="invalid_token")
        return

    is_member = await _check_room_membership(user_id, room_id)
    if not is_member:
        logger.info(f"chat_ws membership denied user={user_id} room={room_id}")
        await websocket.close(code=4403, reason="not_a_member")
        return

    active_rooms.setdefault(room_id, set()).add(websocket)
    logger.info(f"Chat WS connected room={room_id} user={user_id} clients={len(active_rooms[room_id])}")

    try:
        # 1) Letzte 50 Messages an Neuverbinder schicken (Replay)
        history = await db.chat_messages.find(
            {"$or": [{"chat_id": room_id}, {"ride_id": room_id}]},
            {"_id": 0},
        ).sort("created_at", 1).to_list(50)
        await websocket.send_text(json.dumps({"type": "history", "messages": history}))

        # 2) Loop: Empfange + persistiere + broadcaste
        while True:
            raw = await websocket.receive_text()
            try:
                payload = json.loads(raw)
            except Exception:
                await websocket.send_text(json.dumps({"type": "error", "error": "invalid_json"}))
                continue

            msg = await _persist_message(room_id, payload)
            await broadcast_to_room(room_id, msg)
    except WebSocketDisconnect:
        logger.info(f"Chat WS disconnect room={room_id}")
    except Exception as e:
        logger.exception("chat_ws error: %s", e)
    finally:
        active_rooms.get(room_id, set()).discard(websocket)
        if room_id in active_rooms and not active_rooms[room_id]:
            active_rooms.pop(room_id, None)


# REST helper for LiveChat history bootstrap (already used by frontend LiveChat.jsx)
@router.get("/api/chat/messages/{room_id}")
async def get_room_messages(room_id: str, limit: int = 50):
    items = await db.chat_messages.find(
        {"$or": [{"chat_id": room_id}, {"ride_id": room_id}]},
        {"_id": 0},
    ).sort("created_at", 1).limit(limit).to_list(limit)
    return {"messages": items}


# Quick-Reply REST endpoint (used by LiveChat.jsx)
QUICK_REPLIES = {
    "arriving":  "Ich bin in 2 Minuten da",
    "waiting":   "Ich warte draußen",
    "thank_you": "Vielen Dank!",
}


@router.post("/api/chat/quick-reply")
async def chat_quick_reply(ride_id: str, reply_type: str):
    text = QUICK_REPLIES.get(reply_type)
    if not text:
        return {"ok": False, "error": "unknown_reply_type"}
    msg = await _persist_message(ride_id, {
        "sender_id": "system",
        "sender_name": "System",
        "message": text,
        "type": "quick",
    })
    await broadcast_to_room(ride_id, msg)
    return {"ok": True, "message": msg}
