"""
Taxi WebSocket - Realtime ride updates + driver location tracking
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Dict, Set
import json, asyncio
from config import db, logger

router = APIRouter(tags=["Taxi WebSocket"])

# Connected clients
ride_subscribers: Dict[str, Set[WebSocket]] = {}  # ride_id -> set of websockets
driver_sockets: Dict[str, WebSocket] = {}  # user_id -> websocket
rider_sockets: Dict[str, WebSocket] = {}  # user_id -> websocket


@router.websocket("/ws/taxi/ride/{ride_id}")
async def ride_websocket(websocket: WebSocket, ride_id: str):
    """Subscribe to ride updates (rider + driver both connect)"""
    await websocket.accept()
    if ride_id not in ride_subscribers:
        ride_subscribers[ride_id] = set()
    ride_subscribers[ride_id].add(websocket)
    logger.info(f"WS: Client connected to ride {ride_id[:8]}")

    try:
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)

            # Driver sends location updates
            if msg.get("type") == "location":
                # Broadcast to all subscribers of this ride
                for ws in ride_subscribers.get(ride_id, set()):
                    if ws != websocket:
                        try:
                            await ws.send_json({"type": "driver_location", "lat": msg["lat"], "lng": msg["lng"], "timestamp": msg.get("timestamp")})
                        except:
                            pass

            # Driver sends status update
            elif msg.get("type") == "status_update":
                for ws in ride_subscribers.get(ride_id, set()):
                    if ws != websocket:
                        try:
                            await ws.send_json({"type": "ride_status", "status": msg["status"], "ride_id": ride_id})
                        except:
                            pass

    except WebSocketDisconnect:
        ride_subscribers.get(ride_id, set()).discard(websocket)
        logger.info(f"WS: Client disconnected from ride {ride_id[:8]}")


@router.websocket("/ws/taxi/driver/{user_id}")
async def driver_websocket(websocket: WebSocket, user_id: str):
    """Driver WebSocket - receives new ride assignments"""
    await websocket.accept()
    driver_sockets[user_id] = websocket
    logger.info(f"WS: Driver {user_id[:8]} connected")

    try:
        while True:
            await websocket.receive_text()  # Keep alive
    except WebSocketDisconnect:
        driver_sockets.pop(user_id, None)
        logger.info(f"WS: Driver {user_id[:8]} disconnected")


@router.websocket("/ws/taxi/rider/{user_id}")
async def rider_websocket(websocket: WebSocket, user_id: str):
    """Rider WebSocket - receives ride updates"""
    await websocket.accept()
    rider_sockets[user_id] = websocket
    logger.info(f"WS: Rider {user_id[:8]} connected")

    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        rider_sockets.pop(user_id, None)


async def notify_driver_new_ride(driver_user_id: str, ride_data: dict):
    """Send new ride notification to driver via WebSocket"""
    ws = driver_sockets.get(driver_user_id)
    if ws:
        try:
            await ws.send_json({"type": "new_ride", "ride": ride_data})
            return True
        except:
            pass
    return False


async def notify_rider_update(rider_user_id: str, update: dict):
    """Send ride update to rider via WebSocket"""
    ws = rider_sockets.get(rider_user_id)
    if ws:
        try:
            await ws.send_json(update)
            return True
        except:
            pass
    return False
