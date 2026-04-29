"""
BidBlitz V2 - Live-Chat WebSocket
Real-Time-Chat zwischen Passagier und Fahrer (Taxi/Scooter) sowie Kunde/Restaurant.
Channel-ID = ride_id / rental_id / order_id.
"""
from datetime import datetime, timezone
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from typing import Dict, Set
import json
import logging

from core.database import db

router = APIRouter()
logger = logging.getLogger("bidblitz.chat_ws")

# room_id (ride_id/rental_id/order_id) -> Set[WebSocket]
active_rooms: Dict[str, Set[WebSocket]] = {}


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
async def chat_room(websocket: WebSocket, room_id: str, token: str | None = Query(None)):
    """Chat-Raum pro ride/rental/order. Token optional (Cookie wäre 1st-class — Browser senden Cookies bei WS).
    Auth-Hardening kann via JWT-Query-Param erfolgen, hier optional.
    """
    await websocket.accept()
    active_rooms.setdefault(room_id, set()).add(websocket)
    logger.info(f"Chat WS connected room={room_id} clients={len(active_rooms[room_id])}")

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
