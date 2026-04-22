"""
BidBlitz V2 - Kids GPS WebSocket
Real-time GPS tracking via WebSocket
"""

from datetime import datetime, timezone
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Request, Query
from typing import Dict, Set
import json
import asyncio

from core.database import db
from core.security import get_current_user_from_token

router = APIRouter()

# Store active WebSocket connections: {parent_id: {child_id: Set[WebSocket]}}
active_connections: Dict[str, Dict[str, Set[WebSocket]]] = {}


async def broadcast_location_update(parent_id: str, child_id: str, location_data: dict):
    """Broadcast location update to all connected parent WebSockets."""
    if parent_id not in active_connections:
        return
    
    if child_id not in active_connections[parent_id]:
        return
    
    websockets = active_connections[parent_id][child_id].copy()
    
    message = json.dumps({
        "type": "location_update",
        "child_id": child_id,
        "data": location_data,
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    
    for ws in websockets:
        try:
            await ws.send_text(message)
        except:
            # Remove dead connection
            active_connections[parent_id][child_id].discard(ws)


@router.websocket("/api/kids/gps/ws/track")
async def websocket_gps_track(
    websocket: WebSocket,
    token: str = Query(...),
):
    """
    WebSocket endpoint for real-time GPS tracking.
    Parents connect here to receive live location updates for their children.
    """
    await websocket.accept()
    
    parent_id = None
    subscribed_children: Set[str] = set()
    
    try:
        # Verify token
        try:
            # Simple token validation (adjust based on your auth system)
            user = await get_current_user_from_token(token)
            parent_id = str(user["_id"])
        except:
            await websocket.send_json({"type": "error", "message": "Ungültiges Token"})
            await websocket.close(code=4001)
            return
        
        # Get all children for this parent
        children = await db.kids_children.find(
            {"parent_id": parent_id},
            {"child_id": 1, "name": 1}
        ).to_list(20)
        
        if not children:
            await websocket.send_json({"type": "error", "message": "Keine Kinder gefunden"})
            await websocket.close(code=4000)
            return
        
        # Subscribe to all children
        if parent_id not in active_connections:
            active_connections[parent_id] = {}
        
        for child in children:
            child_id = child["child_id"]
            subscribed_children.add(child_id)
            
            if child_id not in active_connections[parent_id]:
                active_connections[parent_id][child_id] = set()
            
            active_connections[parent_id][child_id].add(websocket)
        
        # Send initial connection success
        await websocket.send_json({
            "type": "connected",
            "message": "WebSocket verbunden",
            "children": [{"child_id": c["child_id"], "name": c["name"]} for c in children]
        })
        
        # Send initial locations for all children
        for child in children:
            child_data = await db.kids_children.find_one(
                {"child_id": child["child_id"]},
                {"_id": 0, "child_id": 1, "name": 1, "current_lat": 1, "current_lng": 1,
                 "battery_level": 1, "speed": 1, "last_location_update": 1}
            )
            
            if child_data and child_data.get("current_lat"):
                await websocket.send_json({
                    "type": "location_update",
                    "child_id": child_data["child_id"],
                    "data": {
                        "name": child_data.get("name"),
                        "lat": child_data.get("current_lat"),
                        "lng": child_data.get("current_lng"),
                        "battery_level": child_data.get("battery_level"),
                        "speed": child_data.get("speed"),
                        "last_update": child_data.get("last_location_update"),
                    }
                })
        
        # Keep connection alive and listen for messages
        while True:
            try:
                # Wait for incoming messages (e.g., ping/pong or commands)
                data = await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
                message = json.loads(data)
                
                if message.get("type") == "ping":
                    await websocket.send_json({"type": "pong"})
                
            except asyncio.TimeoutError:
                # Send keepalive ping
                await websocket.send_json({"type": "keepalive"})
            
    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
        except:
            pass
    finally:
        # Cleanup: remove websocket from all subscriptions
        if parent_id and parent_id in active_connections:
            for child_id in subscribed_children:
                if child_id in active_connections[parent_id]:
                    active_connections[parent_id][child_id].discard(websocket)
                    
                    # Clean up empty sets
                    if not active_connections[parent_id][child_id]:
                        del active_connections[parent_id][child_id]
            
            if not active_connections[parent_id]:
                del active_connections[parent_id]
        
        try:
            await websocket.close()
        except:
            pass


# Helper function to trigger WebSocket broadcast when location is updated
async def notify_location_update(parent_id: str, child_id: str, location_data: dict):
    """Call this from kids_gps.py after updating location."""
    await broadcast_location_update(parent_id, child_id, location_data)
