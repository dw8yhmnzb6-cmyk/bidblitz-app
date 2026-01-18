"""WebSocket connection manager for real-time auction updates"""
import logging
from typing import Dict, Set, Optional
from datetime import datetime, timezone
from fastapi import WebSocket

logger = logging.getLogger(__name__)

class ConnectionManager:
    """Manages WebSocket connections for real-time auction updates"""
    
    def __init__(self):
        self.auction_connections: Dict[str, Set[WebSocket]] = {}
        self.connection_info: Dict[WebSocket, Dict] = {}
    
    async def connect(self, websocket: WebSocket, auction_id: str, user_info: Optional[Dict] = None):
        """Accept and store a new WebSocket connection"""
        await websocket.accept()
        
        if auction_id not in self.auction_connections:
            self.auction_connections[auction_id] = set()
        
        self.auction_connections[auction_id].add(websocket)
        self.connection_info[websocket] = {
            "auction_id": auction_id,
            "user_info": user_info,
            "connected_at": datetime.now(timezone.utc).isoformat()
        }
        
        logger.info(f"WebSocket connected to auction {auction_id}. Total connections: {len(self.auction_connections[auction_id])}")
    
    def disconnect(self, websocket: WebSocket):
        """Remove a WebSocket connection"""
        info = self.connection_info.get(websocket, {})
        auction_id = info.get("auction_id")
        
        if auction_id and auction_id in self.auction_connections:
            self.auction_connections[auction_id].discard(websocket)
            if not self.auction_connections[auction_id]:
                del self.auction_connections[auction_id]
        
        if websocket in self.connection_info:
            del self.connection_info[websocket]
        
        logger.info(f"WebSocket disconnected from auction {auction_id}")
    
    async def broadcast_to_auction(self, auction_id: str, message: Dict):
        """Broadcast a message to all connections for a specific auction"""
        if auction_id not in self.auction_connections:
            return
        
        disconnected = set()
        for websocket in self.auction_connections[auction_id]:
            try:
                await websocket.send_json(message)
            except Exception as e:
                logger.error(f"Failed to send message: {e}")
                disconnected.add(websocket)
        
        for ws in disconnected:
            self.disconnect(ws)
    
    async def broadcast_to_all(self, message: Dict):
        """Broadcast a message to all connected clients"""
        for auction_id in list(self.auction_connections.keys()):
            await self.broadcast_to_auction(auction_id, message)
    
    def get_connection_count(self, auction_id: str = None) -> int:
        """Get number of active connections"""
        if auction_id:
            return len(self.auction_connections.get(auction_id, set()))
        return sum(len(conns) for conns in self.auction_connections.values())

# Global WebSocket manager instance
ws_manager = ConnectionManager()

async def broadcast_bid_update(auction_id: str, data: dict):
    """Broadcast bid update to all connected clients"""
    message = {
        "type": "bid_update",
        "auction_id": auction_id,
        **data
    }
    await ws_manager.broadcast_to_auction(auction_id, message)

async def broadcast_auction_ended(auction_id: str, winner_name: str, final_price: float):
    """Broadcast auction ended event"""
    message = {
        "type": "auction_ended",
        "auction_id": auction_id,
        "winner_name": winner_name,
        "final_price": final_price
    }
    await ws_manager.broadcast_to_auction(auction_id, message)
