"""
BidBlitz V2 - NFT Image Generator
Generate and purchase AI-created NFT images using Wallet or Mining balance

Features:
- AI image generation with different styles
- Pay with Wallet EUR or Mining BTC balance
- NFT gallery with owned images
- Rarity tiers (Common, Rare, Epic, Legendary)
"""

from datetime import datetime, timezone
from typing import Optional, List
import secrets
import random
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from core.database import db
from core.security import get_current_user
from services.nft_ai_generator import get_nft_generator

router = APIRouter(prefix="/api/nft", tags=["nft"])

# ═══════════════════════════════════════════════════════════════════════════════
# NFT CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════

NFT_STYLES = [
    {"id": "cyberpunk", "name": "Cyberpunk", "description": "Futuristische Neon-Welt", "icon": "🌆"},
    {"id": "fantasy", "name": "Fantasy", "description": "Magische Welten & Kreaturen", "icon": "🐉"},
    {"id": "abstract", "name": "Abstract", "description": "Abstrakte Kunst", "icon": "🎨"},
    {"id": "space", "name": "Space", "description": "Weltraum & Galaxien", "icon": "🚀"},
    {"id": "nature", "name": "Nature", "description": "Natur & Landschaften", "icon": "🌿"},
    {"id": "anime", "name": "Anime", "description": "Anime & Manga Style", "icon": "⚔️"},
    {"id": "pixel", "name": "Pixel Art", "description": "Retro Pixel-Kunst", "icon": "👾"},
    {"id": "3d", "name": "3D Render", "description": "Fotorealistische 3D", "icon": "💎"},
]

NFT_RARITY = {
    "common": {"name": "Common", "color": "#9CA3AF", "chance": 0.50, "multiplier": 1.0},
    "rare": {"name": "Rare", "color": "#3B82F6", "chance": 0.30, "multiplier": 1.5},
    "epic": {"name": "Epic", "color": "#A855F7", "chance": 0.15, "multiplier": 2.5},
    "legendary": {"name": "Legendary", "color": "#F59E0B", "chance": 0.05, "multiplier": 5.0},
}

# Prices in EUR and BTC equivalent
NFT_PRICES = {
    "basic": {"eur": 2.99, "btc": 0.00005, "name": "Basic", "description": "Standard NFT"},
    "premium": {"eur": 9.99, "btc": 0.00015, "name": "Premium", "description": "Höhere Legendary-Chance"},
    "ultimate": {"eur": 24.99, "btc": 0.00040, "name": "Ultimate", "description": "Garantiert Rare+"},
}

# Pre-generated NFT image URLs (mock - in real system would use AI generation)
NFT_IMAGES = {
    "cyberpunk": [
        "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=512&h=512&fit=crop",
        "https://images.unsplash.com/photo-1515630771457-09367d0ae038?w=512&h=512&fit=crop",
        "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=512&h=512&fit=crop",
    ],
    "fantasy": [
        "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=512&h=512&fit=crop",
        "https://images.unsplash.com/photo-1560807707-8cc77767d783?w=512&h=512&fit=crop",
        "https://images.unsplash.com/photo-1533035353720-f1c6a75cd8ab?w=512&h=512&fit=crop",
    ],
    "abstract": [
        "https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=512&h=512&fit=crop",
        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=512&h=512&fit=crop",
        "https://images.unsplash.com/photo-1549490349-8643362247b5?w=512&h=512&fit=crop",
    ],
    "space": [
        "https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=512&h=512&fit=crop",
        "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=512&h=512&fit=crop",
        "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=512&h=512&fit=crop",
    ],
    "nature": [
        "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=512&h=512&fit=crop",
        "https://images.unsplash.com/photo-1433086966358-54859d0ed716?w=512&h=512&fit=crop",
        "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=512&h=512&fit=crop",
    ],
    "anime": [
        "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=512&h=512&fit=crop",
        "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=512&h=512&fit=crop",
        "https://images.unsplash.com/photo-1560972550-aba3456b5564?w=512&h=512&fit=crop",
    ],
    "pixel": [
        "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=512&h=512&fit=crop",
        "https://images.unsplash.com/photo-1511512578047-dfb367046420?w=512&h=512&fit=crop",
        "https://images.unsplash.com/photo-1493711662062-fa541f7f3d24?w=512&h=512&fit=crop",
    ],
    "3d": [
        "https://images.unsplash.com/photo-1633356122102-3fe601e05bd2?w=512&h=512&fit=crop",
        "https://images.unsplash.com/photo-1618005198919-d3d4b5a92ead?w=512&h=512&fit=crop",
        "https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?w=512&h=512&fit=crop",
    ],
}


# ═══════════════════════════════════════════════════════════════════════════════
# MODELS
# ═══════════════════════════════════════════════════════════════════════════════

class GenerateNFTRequest(BaseModel):
    style_id: str
    tier: str = Field(default="basic", pattern="^(basic|premium|ultimate)$")
    payment_method: str = Field(default="wallet", pattern="^(wallet|mining)$")
    custom_prompt: Optional[str] = Field(None, max_length=200)


class ListNFTRequest(BaseModel):
    nft_id: str
    price_eur: float = Field(..., gt=0, le=10000)


# ═══════════════════════════════════════════════════════════════════════════════
# HELPER FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════════

def determine_rarity(tier: str) -> str:
    """Determine NFT rarity based on tier and randomness."""
    rand = random.random()
    
    if tier == "ultimate":
        # Guaranteed Rare or better
        if rand < 0.10:
            return "legendary"
        elif rand < 0.40:
            return "epic"
        else:
            return "rare"
    elif tier == "premium":
        # Higher legendary chance
        if rand < 0.10:
            return "legendary"
        elif rand < 0.30:
            return "epic"
        elif rand < 0.60:
            return "rare"
        else:
            return "common"
    else:
        # Basic - standard chances
        if rand < 0.05:
            return "legendary"
        elif rand < 0.20:
            return "epic"
        elif rand < 0.50:
            return "rare"
        else:
            return "common"


def generate_nft_name(style: str, rarity: str) -> str:
    """Generate a unique NFT name."""
    prefixes = {
        "legendary": ["Divine", "Celestial", "Mythic", "Eternal", "Supreme"],
        "epic": ["Ancient", "Mystic", "Shadow", "Crystal", "Phoenix"],
        "rare": ["Golden", "Silver", "Crimson", "Azure", "Emerald"],
        "common": ["Basic", "Simple", "Classic", "Standard", "Plain"],
    }
    
    style_names = {
        "cyberpunk": ["Neon City", "Cyber Knight", "Digital Dream", "Tech Warrior"],
        "fantasy": ["Dragon Soul", "Magic Realm", "Enchanted Forest", "Wizard Tower"],
        "abstract": ["Color Burst", "Geometric Flow", "Mind Waves", "Art Fusion"],
        "space": ["Galaxy Core", "Star Nebula", "Cosmic Voyage", "Moon Eclipse"],
        "nature": ["Forest Spirit", "Mountain Peak", "Ocean Wave", "Sunset Valley"],
        "anime": ["Spirit Guardian", "Blade Master", "Magic Girl", "Dark Samurai"],
        "pixel": ["Retro Hero", "8-Bit World", "Pixel Quest", "Game Over"],
        "3d": ["Crystal Form", "Metal Shine", "Glass Sculpture", "Diamond Cut"],
    }
    
    prefix = random.choice(prefixes.get(rarity, prefixes["common"]))
    name = random.choice(style_names.get(style, ["Unknown"]))
    number = random.randint(1000, 9999)
    
    return f"{prefix} {name} #{number}"


async def get_mining_balance(user_id: str) -> float:
    """Get user's mining BTC balance."""
    # Sum up all miners' accumulated rewards
    miners = await db.mining_miners.find({"user_id": user_id}).to_list(100)
    total_btc = sum(m.get("total_mined", 0) for m in miners)
    
    # Also check mining_balances collection
    balance_doc = await db.mining_balances.find_one({"user_id": user_id})
    if balance_doc:
        total_btc += balance_doc.get("btc_balance", 0)
    
    return total_btc


async def deduct_mining_balance(user_id: str, amount_btc: float) -> bool:
    """Deduct BTC from mining balance."""
    # Try to deduct from mining_balances first
    result = await db.mining_balances.update_one(
        {"user_id": user_id, "btc_balance": {"$gte": amount_btc}},
        {"$inc": {"btc_balance": -amount_btc}}
    )
    
    if result.modified_count > 0:
        return True
    
    # If not enough in balance, create negative (will be covered by future mining)
    await db.mining_balances.update_one(
        {"user_id": user_id},
        {"$inc": {"btc_balance": -amount_btc}},
        upsert=True
    )
    return True


# ═══════════════════════════════════════════════════════════════════════════════
# ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/config")
async def get_nft_config():
    """Get NFT generation configuration."""
    return {
        "styles": NFT_STYLES,
        "rarity": NFT_RARITY,
        "prices": NFT_PRICES,
    }


@router.get("/my-balance")
async def get_nft_balance(request: Request):
    """Get user's balances for NFT purchases."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    wallet_balance = user.get("balance", 0)
    mining_balance = await get_mining_balance(user_id)
    
    return {
        "wallet_eur": round(wallet_balance, 2),
        "mining_btc": round(mining_balance, 8),
        "can_afford": {
            "basic": {
                "wallet": wallet_balance >= NFT_PRICES["basic"]["eur"],
                "mining": mining_balance >= NFT_PRICES["basic"]["btc"],
            },
            "premium": {
                "wallet": wallet_balance >= NFT_PRICES["premium"]["eur"],
                "mining": mining_balance >= NFT_PRICES["premium"]["btc"],
            },
            "ultimate": {
                "wallet": wallet_balance >= NFT_PRICES["ultimate"]["eur"],
                "mining": mining_balance >= NFT_PRICES["ultimate"]["btc"],
            },
        }
    }


@router.post("/generate")
async def generate_nft(req: GenerateNFTRequest, request: Request):
    """Generate a new NFT image."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    # Validate style
    style = next((s for s in NFT_STYLES if s["id"] == req.style_id), None)
    if not style:
        raise HTTPException(status_code=400, detail="Ungültiger Style")
    
    # Get price
    price_info = NFT_PRICES.get(req.tier)
    if not price_info:
        raise HTTPException(status_code=400, detail="Ungültiges Tier")
    
    # Check and deduct payment
    if req.payment_method == "wallet":
        if user.get("balance", 0) < price_info["eur"]:
            raise HTTPException(status_code=400, detail="Nicht genug Wallet-Guthaben")
        
        await db.users.update_one(
            {"_id": user["_id"]},
            {"$inc": {"balance": -price_info["eur"]}}
        )
        payment_amount = price_info["eur"]
        payment_currency = "EUR"
    else:  # mining
        mining_balance = await get_mining_balance(user_id)
        if mining_balance < price_info["btc"]:
            raise HTTPException(status_code=400, detail="Nicht genug Mining-Guthaben")
        
        await deduct_mining_balance(user_id, price_info["btc"])
        payment_amount = price_info["btc"]
        payment_currency = "BTC"
    
    now = datetime.now(timezone.utc)
    
    # Determine rarity
    rarity = determine_rarity(req.tier)
    rarity_info = NFT_RARITY[rarity]
    
    # Generate NFT name
    nft_name = generate_nft_name(req.style_id, rarity)
    
    # ✨ AI Image Generation with Gemini Nano Banana ✨
    try:
        nft_id_temp = secrets.token_hex(8)
        ai_generator = get_nft_generator()
        
        # Generate unique NFT artwork
        generation_result = await ai_generator.generate_nft_image(
            style_id=req.style_id,
            rarity=rarity,
            custom_prompt=req.custom_prompt
        )
        
        if not generation_result.get("success"):
            # Fallback to Unsplash if AI generation fails
            style_images = NFT_IMAGES.get(req.style_id, NFT_IMAGES["abstract"])
            image_url = random.choice(style_images)
        else:
            # Save AI-generated image
            image_url = await ai_generator.save_image_to_storage(
                generation_result["image_base64"],
                nft_id_temp
            )
    except Exception as e:
        # Fallback to Unsplash on any error
        style_images = NFT_IMAGES.get(req.style_id, NFT_IMAGES["abstract"])
        image_url = random.choice(style_images)
    
    # Create NFT record
    nft = {
        "nft_id": secrets.token_hex(8),
        "token_id": f"BLTZ-{secrets.token_hex(4).upper()}",
        "user_id": user_id,
        "name": nft_name,
        "description": req.custom_prompt or f"{style['name']} NFT - {rarity_info['name']}",
        "image_url": image_url,
        "style_id": req.style_id,
        "style_name": style["name"],
        "rarity": rarity,
        "rarity_name": rarity_info["name"],
        "rarity_color": rarity_info["color"],
        "tier": req.tier,
        "payment_method": req.payment_method,
        "payment_amount": payment_amount,
        "payment_currency": payment_currency,
        "is_listed": False,
        "list_price": None,
        "created_at": now.isoformat(),
        "minted_at": now.isoformat(),
    }
    
    await db.nfts.insert_one(nft)
    
    # Create transaction record
    await db.transactions.insert_one({
        "tx_id": secrets.token_hex(8),
        "user_id": user_id,
        "type": "NFT_PURCHASE",
        "amount": -payment_amount if payment_currency == "EUR" else 0,
        "btc_amount": -payment_amount if payment_currency == "BTC" else 0,
        "description": f"NFT generiert: {nft_name}",
        "reference": nft["nft_id"],
        "created_at": now.isoformat(),
    })
    
    # Update user stats
    await db.nft_stats.update_one(
        {"user_id": user_id},
        {
            "$inc": {
                "total_generated": 1,
                f"rarity_{rarity}": 1,
                "total_spent_eur": payment_amount if payment_currency == "EUR" else 0,
                "total_spent_btc": payment_amount if payment_currency == "BTC" else 0,
            },
            "$setOnInsert": {"created_at": now.isoformat()}
        },
        upsert=True
    )
    
    nft.pop("_id", None)
    
    # Get updated balances
    updated_user = await db.users.find_one({"_id": user["_id"]})
    new_mining_balance = await get_mining_balance(user_id)
    
    return {
        "ok": True,
        "nft": nft,
        "message": f"🎉 {rarity_info['name']} NFT generiert!",
        "new_wallet_balance": round(updated_user.get("balance", 0), 2),
        "new_mining_balance": round(new_mining_balance, 8),
    }


@router.get("/collection")
async def get_my_collection(request: Request, limit: int = 50):
    """Get user's NFT collection."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    nfts = await db.nfts.find(
        {"user_id": user_id}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    for n in nfts:
        n.pop("_id", None)
    
    # Get stats
    stats = await db.nft_stats.find_one({"user_id": user_id})
    if stats:
        stats.pop("_id", None)
    
    # Count by rarity
    rarity_counts = {
        "common": 0,
        "rare": 0,
        "epic": 0,
        "legendary": 0,
    }
    for n in nfts:
        r = n.get("rarity", "common")
        rarity_counts[r] = rarity_counts.get(r, 0) + 1
    
    return {
        "nfts": nfts,
        "total": len(nfts),
        "rarity_counts": rarity_counts,
        "stats": stats,
    }


@router.get("/nft/{nft_id}")
async def get_nft_details(nft_id: str, request: Request):
    """Get details for a specific NFT."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    nft = await db.nfts.find_one({"nft_id": nft_id})
    if not nft:
        raise HTTPException(status_code=404, detail="NFT nicht gefunden")
    
    nft.pop("_id", None)
    
    is_owner = nft.get("user_id") == user_id
    
    return {
        "nft": nft,
        "is_owner": is_owner,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# NFT MARKETPLACE
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/list")
async def list_nft_for_sale(req: ListNFTRequest, request: Request):
    """List an NFT for sale on the marketplace."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    # Find NFT
    nft = await db.nfts.find_one({
        "nft_id": req.nft_id,
        "user_id": user_id
    })
    
    if not nft:
        raise HTTPException(status_code=404, detail="NFT nicht gefunden oder nicht dein")
    
    if nft.get("is_listed"):
        raise HTTPException(status_code=400, detail="NFT ist bereits gelistet")
    
    now = datetime.now(timezone.utc)
    
    await db.nfts.update_one(
        {"nft_id": req.nft_id},
        {"$set": {
            "is_listed": True,
            "list_price": round(req.price_eur, 2),
            "listed_at": now.isoformat(),
        }}
    )
    
    return {
        "ok": True,
        "message": f"NFT für €{req.price_eur:.2f} gelistet!",
    }


@router.post("/unlist/{nft_id}")
async def unlist_nft(nft_id: str, request: Request):
    """Remove NFT from marketplace."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    result = await db.nfts.update_one(
        {"nft_id": nft_id, "user_id": user_id, "is_listed": True},
        {"$set": {
            "is_listed": False,
            "list_price": None,
            "listed_at": None,
        }}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="NFT nicht gefunden oder nicht gelistet")
    
    return {"ok": True, "message": "NFT vom Marktplatz entfernt"}


@router.get("/marketplace")
async def get_marketplace(limit: int = 50, rarity: Optional[str] = None, style: Optional[str] = None):
    """Get NFTs listed for sale."""
    query = {"is_listed": True}
    
    if rarity:
        query["rarity"] = rarity
    if style:
        query["style_id"] = style
    
    nfts = await db.nfts.find(query).sort("listed_at", -1).limit(limit).to_list(limit)
    
    for n in nfts:
        n.pop("_id", None)
        # Get seller info
        seller = await db.users.find_one({"_id": {"$oid": n.get("user_id")}})
        if not seller:
            # Try string ID
            from bson import ObjectId
            try:
                seller = await db.users.find_one({"_id": ObjectId(n.get("user_id"))})
            except:
                pass
        n["seller_name"] = seller.get("name", "Unbekannt") if seller else "Unbekannt"
    
    return {
        "nfts": nfts,
        "total": len(nfts),
        "filters": {
            "rarities": list(NFT_RARITY.keys()),
            "styles": [s["id"] for s in NFT_STYLES],
        }
    }


@router.post("/buy/{nft_id}")
async def buy_nft(nft_id: str, request: Request):
    """Buy an NFT from the marketplace."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    # Find listed NFT
    nft = await db.nfts.find_one({
        "nft_id": nft_id,
        "is_listed": True
    })
    
    if not nft:
        raise HTTPException(status_code=404, detail="NFT nicht gefunden oder nicht zum Verkauf")
    
    if nft.get("user_id") == user_id:
        raise HTTPException(status_code=400, detail="Kannst dein eigenes NFT nicht kaufen")
    
    price = nft.get("list_price", 0)
    
    if user.get("balance", 0) < price:
        raise HTTPException(status_code=400, detail="Nicht genug Guthaben")
    
    seller_id = nft.get("user_id")
    now = datetime.now(timezone.utc)
    
    # Transfer funds
    # Deduct from buyer
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$inc": {"balance": -price}}
    )
    
    # Add to seller (with 5% marketplace fee)
    seller_amount = round(price * 0.95, 2)
    from bson import ObjectId
    try:
        await db.users.update_one(
            {"_id": ObjectId(seller_id)},
            {"$inc": {"balance": seller_amount}}
        )
    except:
        pass
    
    # Transfer NFT ownership
    await db.nfts.update_one(
        {"nft_id": nft_id},
        {"$set": {
            "user_id": user_id,
            "is_listed": False,
            "list_price": None,
            "listed_at": None,
            "last_sale_price": price,
            "last_sale_at": now.isoformat(),
        }}
    )
    
    # Create transactions
    await db.transactions.insert_one({
        "tx_id": secrets.token_hex(8),
        "user_id": user_id,
        "type": "NFT_BUY",
        "amount": -price,
        "description": f"NFT gekauft: {nft.get('name')}",
        "reference": nft_id,
        "created_at": now.isoformat(),
    })
    
    await db.transactions.insert_one({
        "tx_id": secrets.token_hex(8),
        "user_id": seller_id,
        "type": "NFT_SALE",
        "amount": seller_amount,
        "description": f"NFT verkauft: {nft.get('name')} (5% Gebühr)",
        "reference": nft_id,
        "created_at": now.isoformat(),
    })
    
    updated_user = await db.users.find_one({"_id": user["_id"]})
    
    return {
        "ok": True,
        "nft_name": nft.get("name"),
        "price_paid": price,
        "new_balance": round(updated_user.get("balance", 0), 2),
        "message": f"🎉 NFT '{nft.get('name')}' gekauft!",
    }


@router.get("/leaderboard")
async def get_nft_leaderboard():
    """Get NFT collectors leaderboard."""
    # Aggregate by user
    pipeline = [
        {"$group": {
            "_id": "$user_id",
            "total_nfts": {"$sum": 1},
            "legendary_count": {"$sum": {"$cond": [{"$eq": ["$rarity", "legendary"]}, 1, 0]}},
            "epic_count": {"$sum": {"$cond": [{"$eq": ["$rarity", "epic"]}, 1, 0]}},
        }},
        {"$sort": {"legendary_count": -1, "epic_count": -1, "total_nfts": -1}},
        {"$limit": 20}
    ]
    
    results = await db.nfts.aggregate(pipeline).to_list(20)
    
    # Get user names
    leaderboard = []
    for i, r in enumerate(results):
        from bson import ObjectId
        try:
            user = await db.users.find_one({"_id": ObjectId(r["_id"])})
            name = user.get("name", "Anonym") if user else "Anonym"
        except:
            name = "Anonym"
        
        leaderboard.append({
            "rank": i + 1,
            "name": name,
            "total_nfts": r["total_nfts"],
            "legendary": r["legendary_count"],
            "epic": r["epic_count"],
        })
    
    return {"leaderboard": leaderboard}
