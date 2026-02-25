"""WebSocket connection manager for real-time auction updates and payment notifications"""
import logging
from typing import Dict, Set, Optional
from datetime import datetime, timezone
from fastapi import WebSocket

logger = logging.getLogger(__name__)

class ConnectionManager:
    """Manages WebSocket connections for real-time auction updates and payment notifications"""
    
    def __init__(self):
        self.auction_connections: Dict[str, Set[WebSocket]] = {}
        self.connection_info: Dict[WebSocket, Dict] = {}
        # User-specific connections for payment notifications
        self.user_connections: Dict[str, Set[WebSocket]] = {}
    
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
    
    # ==================== USER PAYMENT CONNECTIONS ====================
    
    async def connect_user(self, websocket: WebSocket, user_id: str):
        """Connect a user for payment notifications"""
        await websocket.accept()
        
        if user_id not in self.user_connections:
            self.user_connections[user_id] = set()
        
        self.user_connections[user_id].add(websocket)
        self.connection_info[websocket] = {
            "type": "payment",
            "user_id": user_id,
            "connected_at": datetime.now(timezone.utc).isoformat()
        }
        
        logger.info(f"User {user_id} connected for payment notifications. Total: {len(self.user_connections[user_id])}")
    
    def disconnect_user(self, websocket: WebSocket):
        """Disconnect a user from payment notifications"""
        info = self.connection_info.get(websocket, {})
        user_id = info.get("user_id")
        
        if user_id and user_id in self.user_connections:
            self.user_connections[user_id].discard(websocket)
            if not self.user_connections[user_id]:
                del self.user_connections[user_id]
        
        if websocket in self.connection_info:
            del self.connection_info[websocket]
        
        logger.info(f"User {user_id} disconnected from payment notifications")
    
    async def send_to_user(self, user_id: str, message: Dict) -> bool:
        """Send a message to a specific user"""
        if user_id not in self.user_connections:
            logger.info(f"No active connections for user {user_id}")
            return False
        
        sent = False
        disconnected = set()
        
        for websocket in self.user_connections[user_id]:
            try:
                await websocket.send_json(message)
                sent = True
                logger.info(f"Sent payment notification to user {user_id}")
            except Exception as e:
                logger.error(f"Failed to send to user {user_id}: {e}")
                disconnected.add(websocket)
        
        for ws in disconnected:
            self.disconnect_user(ws)
        
        return sent

# Global WebSocket manager instance
ws_manager = ConnectionManager()

async def broadcast_bid_update(auction_id: str, data: dict):
    """Broadcast bid update to all connected clients"""
    message = {
        "type": "bid_update",
        "auction_id": auction_id,
        "data": data,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    # Broadcast to specific auction viewers
    await ws_manager.broadcast_to_auction(auction_id, message)
    # Also broadcast to "all auctions" viewers
    await ws_manager.broadcast_to_auction("all_auctions", message)

async def broadcast_auction_ended(auction_id: str, winner_name: str, final_price: float):
    """Broadcast auction ended event"""
    message = {
        "type": "auction_ended",
        "auction_id": auction_id,
        "data": {
            "winner_name": winner_name,
            "final_price": final_price
        },
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    await ws_manager.broadcast_to_auction(auction_id, message)
    await ws_manager.broadcast_to_auction("all_auctions", message)

# ==================== PAYMENT NOTIFICATIONS ====================

async def notify_payment_received(
    user_id: str,
    amount: float,
    new_balance: float,
    merchant_name: str = None,
    transaction_id: str = None,
    discount_amount: float = 0,
    discount_card_name: str = None
):
    """
    Send real-time payment notification to customer's device.
    Called after successful POS payment.
    """
    message = {
        "type": "payment_received",
        "data": {
            "amount": amount,
            "new_balance": new_balance,
            "merchant_name": merchant_name or "Partner",
            "transaction_id": transaction_id,
            "discount_amount": discount_amount,
            "discount_card_name": discount_card_name,
            "has_discount": discount_amount > 0
        },
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    sent = await ws_manager.send_to_user(user_id, message)
    
    if sent:
        logger.info(f"✅ Payment notification sent to user {user_id}: €{amount}")
    else:
        logger.info(f"⚠️ User {user_id} not connected - notification not sent")
    
    return sent
