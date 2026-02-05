# Social Features - Live Chat, Profiles, Friends
from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from datetime import datetime, timedelta
from typing import Optional, List, Dict
from pydantic import BaseModel
import json

router = APIRouter(prefix="/api/social", tags=["Social"])

# In-memory storage for demo (use Redis in production)
active_connections: Dict[str, List[WebSocket]] = {}
chat_messages: Dict[str, List[dict]] = {}

class ChatMessage(BaseModel):
    auction_id: str
    user_name: str
    message: str
    
class FriendRequest(BaseModel):
    from_user_id: str
    to_user_id: str

class ProfileUpdate(BaseModel):
    display_name: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    show_stats: Optional[bool] = True
    show_activity: Optional[bool] = True

# ===== LIVE CHAT =====
@router.websocket("/chat/{auction_id}")
async def auction_chat(websocket: WebSocket, auction_id: str):
    """WebSocket for live auction chat"""
    await websocket.accept()
    
    if auction_id not in active_connections:
        active_connections[auction_id] = []
    active_connections[auction_id].append(websocket)
    
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            # Broadcast to all connected users
            chat_entry = {
                "user": message.get("user", "Anonym"),
                "message": message.get("message", ""),
                "timestamp": datetime.utcnow().isoformat(),
                "type": "chat"
            }
            
            # Store message
            if auction_id not in chat_messages:
                chat_messages[auction_id] = []
            chat_messages[auction_id].append(chat_entry)
            
            # Broadcast
            for connection in active_connections[auction_id]:
                await connection.send_text(json.dumps(chat_entry))
                
    except WebSocketDisconnect:
        active_connections[auction_id].remove(websocket)

@router.get("/chat/{auction_id}/history")
async def get_chat_history(auction_id: str, limit: int = 50):
    """Get recent chat messages for an auction"""
    messages = chat_messages.get(auction_id, [])
    return {
        "auction_id": auction_id,
        "messages": messages[-limit:],
        "total_messages": len(messages),
        "active_users": len(active_connections.get(auction_id, []))
    }

@router.post("/chat/send")
async def send_chat_message(message: ChatMessage):
    """Send a chat message (HTTP fallback)"""
    chat_entry = {
        "user": message.user_name,
        "message": message.message,
        "timestamp": datetime.utcnow().isoformat(),
        "type": "chat"
    }
    
    if message.auction_id not in chat_messages:
        chat_messages[message.auction_id] = []
    chat_messages[message.auction_id].append(chat_entry)
    
    return {"success": True, "message": chat_entry}

# ===== USER PROFILES =====
@router.get("/profile/{user_id}")
async def get_user_profile(user_id: str):
    """Get public user profile"""
    import random
    
    # Simulated profile data
    return {
        "user_id": user_id,
        "display_name": f"Bieter{random.randint(1000, 9999)}",
        "avatar_url": f"https://api.dicebear.com/7.x/avataaars/svg?seed={user_id}",
        "member_since": (datetime.utcnow() - timedelta(days=random.randint(30, 500))).strftime("%B %Y"),
        "bio": "Leidenschaftlicher Schnäppchenjäger! 🎯",
        "level": random.randint(1, 9),
        "badges": ["🏆", "⭐", "🔥"][:random.randint(1, 3)],
        "stats": {
            "total_bids": random.randint(100, 5000),
            "auctions_won": random.randint(1, 50),
            "total_savings": random.randint(100, 5000),
            "win_rate": round(random.uniform(5, 25), 1),
            "favorite_category": random.choice(["Elektronik", "Mode", "Haushalt", "Gutscheine"])
        },
        "recent_wins": [
            {"product": "iPhone 15 Pro", "savings": "€950", "date": "vor 2 Tagen"},
            {"product": "Nintendo Switch", "savings": "€280", "date": "vor 1 Woche"},
        ][:random.randint(0, 2)],
        "is_vip": random.choice([True, False]),
        "is_verified": random.choice([True, True, False])
    }

@router.put("/profile/{user_id}")
async def update_profile(user_id: str, update: ProfileUpdate):
    """Update user profile settings"""
    return {
        "success": True,
        "message": "Profil erfolgreich aktualisiert",
        "updated_fields": {k: v for k, v in update.dict().items() if v is not None}
    }

# ===== FRIENDS SYSTEM =====
@router.get("/friends/{user_id}")
async def get_friends_list(user_id: str):
    """Get user's friends list"""
    import random
    
    friends = []
    for i in range(random.randint(3, 15)):
        friends.append({
            "user_id": f"friend_{i}",
            "display_name": f"Freund{random.randint(1000, 9999)}",
            "avatar_url": f"https://api.dicebear.com/7.x/avataaars/svg?seed=friend{i}",
            "status": random.choice(["online", "offline", "bidding"]),
            "last_active": (datetime.utcnow() - timedelta(minutes=random.randint(1, 1440))).isoformat(),
            "current_auction": f"auction_{random.randint(1, 100)}" if random.choice([True, False]) else None
        })
    
    return {
        "user_id": user_id,
        "friends": friends,
        "total_friends": len(friends),
        "online_count": sum(1 for f in friends if f["status"] == "online"),
        "pending_requests": random.randint(0, 3)
    }

@router.post("/friends/request")
async def send_friend_request(request: FriendRequest):
    """Send a friend request"""
    return {
        "success": True,
        "message": "Freundschaftsanfrage gesendet!",
        "request_id": f"req_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
    }

@router.post("/friends/accept/{request_id}")
async def accept_friend_request(request_id: str):
    """Accept a friend request"""
    return {
        "success": True,
        "message": "Freundschaftsanfrage angenommen!",
        "new_friend": {
            "user_id": "new_friend_123",
            "display_name": "NeuerFreund"
        }
    }

@router.delete("/friends/{friend_id}")
async def remove_friend(friend_id: str, user_id: Optional[str] = None):
    """Remove a friend"""
    return {
        "success": True,
        "message": "Freund entfernt"
    }

@router.get("/friends/{user_id}/activity")
async def get_friends_activity(user_id: str):
    """Get recent activity from friends"""
    import random
    
    activities = [
        {"type": "bid", "friend": "MaxBieter", "auction": "iPhone 15", "time": "vor 2 Min"},
        {"type": "win", "friend": "SchnäppchenQueen", "auction": "PS5", "time": "vor 15 Min"},
        {"type": "join", "friend": "NeueBieter", "auction": "Apple Watch", "time": "vor 1 Std"},
        {"type": "achievement", "friend": "BidKing", "achievement": "100 Gebote", "time": "vor 2 Std"},
    ]
    
    return {
        "activities": activities[:random.randint(2, 4)],
        "friends_currently_bidding": random.randint(1, 5)
    }

# ===== SOCIAL SHARING =====
@router.get("/share/{auction_id}")
async def get_share_data(auction_id: str):
    """Get shareable data for an auction/win"""
    return {
        "auction_id": auction_id,
        "share_url": f"https://bidblitz.ae/a/{auction_id}",
        "share_text": "Schau dir diese Auktion bei BidBlitz an! 🎯",
        "platforms": {
            "whatsapp": f"https://wa.me/?text=Schau%20dir%20diese%20Auktion%20an%3A%20https%3A%2F%2Fbidblitz.ae%2Fa%2F{auction_id}",
            "telegram": f"https://t.me/share/url?url=https://bidblitz.ae/a/{auction_id}&text=Tolle%20Auktion!",
            "twitter": f"https://twitter.com/intent/tweet?url=https://bidblitz.ae/a/{auction_id}&text=Biete%20mit%20bei%20BidBlitz!",
            "facebook": f"https://www.facebook.com/sharer/sharer.php?u=https://bidblitz.ae/a/{auction_id}",
            "email": f"mailto:?subject=Tolle%20Auktion&body=Schau%20dir%20das%20an%3A%20https%3A%2F%2Fbidblitz.ae%2Fa%2F{auction_id}"
        },
        "referral_bonus": 50
    }

@router.post("/share/win")
async def share_win(auction_id: str, platform: str, user_id: Optional[str] = None):
    """Track when user shares a win"""
    return {
        "success": True,
        "bonus_bids": 5,
        "message": "Danke fürs Teilen! Du erhältst 5 Bonus-Gebote!"
    }

# ===== WINNER GALLERY =====
@router.get("/gallery")
async def get_winner_gallery(page: int = 1, limit: int = 20):
    """Get winner gallery with photos"""
    import random
    
    winners = []
    for i in range((page - 1) * limit, page * limit):
        winners.append({
            "id": f"win_{i}",
            "user_name": f"Gewinner{random.randint(100, 999)}",
            "product_name": random.choice(["iPhone 15 Pro", "MacBook Air", "PS5", "Nintendo Switch", "Apple Watch", "AirPods Pro"]),
            "photo_url": f"https://picsum.photos/seed/{i}/400/300",
            "final_price": round(random.uniform(1, 50), 2),
            "retail_price": random.randint(200, 1500),
            "savings_percent": random.randint(90, 99),
            "date": (datetime.utcnow() - timedelta(days=random.randint(0, 30))).strftime("%d.%m.%Y"),
            "testimonial": random.choice([
                "Unglaublich! So viel gespart! 🎉",
                "BidBlitz ist der Hammer!",
                "Mein erster Gewinn - bin begeistert!",
                "Kann es kaum glauben!",
                None
            ]),
            "verified": random.choice([True, True, True, False])
        })
    
    return {
        "winners": winners,
        "page": page,
        "total_pages": 10,
        "total_winners": 200,
        "total_savings": "€125.000+"
    }

@router.post("/gallery/upload")
async def upload_winner_photo(
    auction_id: str,
    photo_url: str,
    testimonial: Optional[str] = None,
    user_id: Optional[str] = None
):
    """Upload a winner photo for the gallery"""
    return {
        "success": True,
        "bonus_bids": 25,
        "message": "Danke für dein Foto! Du erhältst 25 Bonus-Gebote!",
        "status": "pending_review"
    }
