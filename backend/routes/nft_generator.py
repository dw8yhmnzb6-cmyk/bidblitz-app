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
import hashlib
import os
import random
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from core.database import db
from core.security import get_current_user
from core.config import TEST_MODE
from core.payment_engine import debit_wallet, credit_wallet, transfer_between_wallets, TransactionType
from services.nft_ai_generator import get_nft_generator

router = APIRouter(prefix="/api/nft", tags=["nft"])


def _require_nft_value_mode() -> None:
    if not TEST_MODE:
        raise HTTPException(
            status_code=503,
            detail="NFT-Erzeugung, Minting und Handel sind in Production deaktiviert, bis ein verifizierter Mint-/Custody-/Marketplace-Provider live verbunden ist.",
        )


def _require_nft_idempotency_key(body_key: Optional[str], request: Request, action: str) -> str:
    raw = (body_key or request.headers.get("Idempotency-Key") or "").strip()
    if not 8 <= len(raw) <= 200:
        raise HTTPException(status_code=400, detail="Idempotency-Key erforderlich")
    return f"nft:{action}:{hashlib.sha256(raw.encode('utf-8')).hexdigest()[:24]}"


async def _nft_platform_user_id() -> str:
    email = os.environ.get("PLATFORM_POOL_EMAIL", "admin@bidblitz.ae").strip().lower()
    platform = await db.users.find_one({"email": email}, {"_id": 1})
    if not platform:
        raise HTTPException(status_code=503, detail="NFT Plattform-Wallet ist nicht konfiguriert")
    return str(platform["_id"])


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
    idempotency_key: Optional[str] = None


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
        "prices": NFT_PRICES if TEST_MODE else {},
        "value_actions_enabled": bool(TEST_MODE),
        "wallet_payment_enabled": bool(TEST_MODE),
        "mining_payment_enabled": False,
        "live_nft_provider_connected": False,
        "production_message": (
            None if TEST_MODE else
            "NFT-Erzeugung, Minting und Handel sind noch nicht live verbunden."
        ),
    }


@router.get("/my-balance")
async def get_nft_balance(request: Request):
    """Get user's balances for NFT purchases."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    wallet_balance = user.get("balance", 0)
    mining_balance = 0
    
    return {
        "wallet_eur": round(wallet_balance, 2),
        "mining_btc": round(mining_balance, 8),
        "value_actions_enabled": bool(TEST_MODE),
        "can_afford": {
            "basic": {
                "wallet": bool(TEST_MODE and wallet_balance >= NFT_PRICES["basic"]["eur"]),
                "mining": False,
            },
            "premium": {
                "wallet": bool(TEST_MODE and wallet_balance >= NFT_PRICES["premium"]["eur"]),
                "mining": False,
            },
            "ultimate": {
                "wallet": bool(TEST_MODE and wallet_balance >= NFT_PRICES["ultimate"]["eur"]),
                "mining": False,
            },
        }
    }


@router.post("/generate")
async def generate_nft(req: GenerateNFTRequest, request: Request):
    _require_nft_value_mode()
    user = await get_current_user(request)
    user_id = str(user["_id"])

    if req.payment_method != "wallet":
        raise HTTPException(
            status_code=503,
            detail="NFT-Zahlung mit Mining-BTC ist deaktiviert, bis ein kanonischer Mining-/Custody-Pfad verbunden ist.",
        )

    style = next((s for s in NFT_STYLES if s["id"] == req.style_id), None)
    if not style:
        raise HTTPException(status_code=400, detail="Ungültiger Style")
    price_info = NFT_PRICES.get(req.tier)
    if not price_info:
        raise HTTPException(status_code=400, detail="Ungültiges Tier")

    idem = _require_nft_idempotency_key(req.idempotency_key, request, "generate")
    op_hash = hashlib.sha256(f"{user_id}:{idem}".encode("utf-8")).hexdigest()[:24]
    operation_id = f"NFTGEN-{op_hash.upper()}"
    nft_id = f"nft_{op_hash}"
    payload = {
        "user_id": user_id,
        "style_id": req.style_id,
        "tier": req.tier,
        "payment_method": req.payment_method,
        "custom_prompt": req.custom_prompt or "",
    }

    existing_op = await db.nft_operations.find_one({"_id": operation_id}, {"_id": 0})
    if existing_op and existing_op.get("payload") != payload:
        raise HTTPException(status_code=409, detail="Idempotency-Key wurde mit anderen NFT-Daten verwendet")
    if existing_op and existing_op.get("status") == "completed":
        existing_nft = await db.nfts.find_one({"nft_id": nft_id}, {"_id": 0}) or {}
        fresh_user = await db.users.find_one({"_id": user["_id"]}, {"balance": 1, "_id": 0}) or {}
        return {
            "ok": True,
            "nft": existing_nft,
            "message": "NFT bereits generiert.",
            "new_wallet_balance": round(float(fresh_user.get("balance") or 0), 2),
            "new_mining_balance": 0,
            "replayed": True,
        }
    if existing_op and existing_op.get("status") == "failed_refunded":
        raise HTTPException(status_code=409, detail="Fehlgeschlagene NFT-Generierung benötigt einen neuen Idempotency-Key")
    if existing_op and existing_op.get("status") in {"processing", "reconciliation_required"}:
        existing_nft = await db.nfts.find_one({"nft_id": nft_id}, {"_id": 0})
        if existing_nft:
            await db.nft_operations.update_one(
                {"_id": operation_id},
                {"$set": {"status": "completed", "recovered_at": datetime.now(timezone.utc).isoformat()}},
            )
            fresh_user = await db.users.find_one({"_id": user["_id"]}, {"balance": 1, "_id": 0}) or {}
            return {
                "ok": True,
                "nft": existing_nft,
                "message": "NFT bereits generiert.",
                "new_wallet_balance": round(float(fresh_user.get("balance") or 0), 2),
                "new_mining_balance": 0,
                "replayed": True,
            }
        raise HTTPException(status_code=409, detail="NFT-Generierung wird verarbeitet oder benötigt Abstimmung")

    await db.nft_operations.update_one(
        {"_id": operation_id},
        {"$setOnInsert": {
            "_id": operation_id,
            "payload": payload,
            "nft_id": nft_id,
            "status": "pending",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )
    claimed = await db.nft_operations.update_one(
        {"_id": operation_id, "status": "pending"},
        {"$set": {"status": "processing", "processing_at": datetime.now(timezone.utc).isoformat()}},
    )
    if claimed.modified_count != 1:
        raise HTTPException(status_code=409, detail="NFT-Generierung wird bereits verarbeitet")

    payment = await debit_wallet(
        user_id=user_id,
        amount=price_info["eur"],
        tx_type=TransactionType.PAYMENT,
        description=f"NFT Preview Generierung ({req.tier})",
        reference=operation_id,
        metadata={"nft_id": nft_id, "style_id": req.style_id, "tier": req.tier, "preview": True},
        idempotency_key=f"nft-generate:{operation_id}:payment",
    )
    if not payment.success:
        await db.nft_operations.update_one(
            {"_id": operation_id},
            {"$set": {"status": "failed", "error": payment.error or "wallet_debit_failed"}},
        )
        raise HTTPException(status_code=400, detail=payment.error or "Nicht genug Wallet-Guthaben")

    now = datetime.now(timezone.utc)
    try:
        rarity = determine_rarity(req.tier)
        rarity_info = NFT_RARITY[rarity]
        nft_name = generate_nft_name(req.style_id, rarity)

        try:
            ai_generator = get_nft_generator()
            generation_result = await ai_generator.generate_nft_image(
                style_id=req.style_id,
                rarity=rarity,
                custom_prompt=req.custom_prompt,
            )
            if generation_result.get("success"):
                image_url = await ai_generator.save_image_to_storage(
                    generation_result["image_base64"],
                    nft_id,
                )
            else:
                image_url = random.choice(NFT_IMAGES.get(req.style_id, NFT_IMAGES["abstract"]))
        except Exception:
            image_url = random.choice(NFT_IMAGES.get(req.style_id, NFT_IMAGES["abstract"]))

        nft = {
            "nft_id": nft_id,
            "token_id": f"BLTZ-{op_hash[:8].upper()}",
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
            "payment_method": "wallet",
            "payment_amount": price_info["eur"],
            "payment_currency": "EUR",
            "payment_transaction_id": payment.transaction_id,
            "is_listed": False,
            "list_price": None,
            "created_at": now.isoformat(),
            "minted_at": now.isoformat(),
        }
        await db.nfts.update_one({"nft_id": nft_id}, {"$setOnInsert": nft}, upsert=True)
        persisted = await db.nfts.find_one({"nft_id": nft_id}, {"_id": 0})
        if not persisted:
            raise RuntimeError("nft_persist_failed")

        await db.transactions.update_one(
            {"_id": f"{operation_id}:tx"},
            {"$setOnInsert": {
                "_id": f"{operation_id}:tx",
                "tx_id": f"{operation_id}:tx",
                "user_id": user_id,
                "type": "NFT_PURCHASE",
                "amount": -price_info["eur"],
                "description": f"NFT generiert: {persisted.get('name', nft_name)}",
                "reference": nft_id,
                "wallet_transaction_id": payment.transaction_id,
                "created_at": now.isoformat(),
            }},
            upsert=True,
        )
        stats_marker = f"generation_markers.{op_hash}"
        await db.nft_stats.update_one(
            {"user_id": user_id, stats_marker: {"$exists": False}},
            {
                "$inc": {
                    "total_generated": 1,
                    f"rarity_{persisted.get('rarity', rarity)}": 1,
                    "total_spent_eur": price_info["eur"],
                },
                "$set": {stats_marker: {"nft_id": nft_id, "created_at": now.isoformat()}},
                "$setOnInsert": {"created_at": now.isoformat()},
            },
            upsert=True,
        )

        response = {
            "ok": True,
            "nft": persisted,
            "message": f"🎉 {persisted.get('rarity_name', rarity_info['name'])} NFT generiert!",
            "new_wallet_balance": round(float(payment.new_balance or 0), 2),
            "new_mining_balance": 0,
        }
        await db.nft_operations.update_one(
            {"_id": operation_id, "status": "processing"},
            {"$set": {
                "status": "completed",
                "response": response,
                "completed_at": datetime.now(timezone.utc).isoformat(),
            }},
        )
        return {**response, "replayed": bool(payment.idempotent_replay)}
    except HTTPException:
        raise
    except Exception as exc:
        rollback = await credit_wallet(
            user_id=user_id,
            amount=price_info["eur"],
            tx_type=TransactionType.REFUND,
            description="NFT Preview Generierung zurückgebucht",
            reference=f"{operation_id}-ROLLBACK",
            source="nft_preview_rollback",
            metadata={"nft_id": nft_id, "operation_id": operation_id},
            idempotency_key=f"nft-generate:{operation_id}:rollback",
        )
        await db.nft_operations.update_one(
            {"_id": operation_id},
            {"$set": {
                "status": "failed_refunded" if rollback.success else "reconciliation_required",
                "error": str(exc)[:300],
                "rollback_transaction_id": rollback.transaction_id,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }},
        )
        if not rollback.success:
            raise HTTPException(status_code=500, detail="NFT-Generierung benötigt Abstimmung")
        raise HTTPException(status_code=500, detail="NFT-Generierung fehlgeschlagen. Wallet wurde zurückgebucht")



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
    _require_nft_value_mode()
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
    _require_nft_value_mode()
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
    _require_nft_value_mode()
    user = await get_current_user(request)
    buyer_id = str(user["_id"])
    idem = _require_nft_idempotency_key(None, request, "buy")
    purchase_hash = hashlib.sha256(f"{buyer_id}:{nft_id}:{idem}".encode("utf-8")).hexdigest()[:24]
    purchase_id = f"NFTBUY-{purchase_hash.upper()}"

    existing_purchase = await db.nft_operations.find_one({"_id": purchase_id}, {"_id": 0})
    if existing_purchase and existing_purchase.get("nft_id") != nft_id:
        raise HTTPException(status_code=409, detail="Idempotency-Key wurde mit einem anderen NFT verwendet")
    if existing_purchase and existing_purchase.get("status") == "completed":
        return {**existing_purchase["response"], "replayed": True}
    if existing_purchase and existing_purchase.get("status") in {"processing", "reconciliation_required"}:
        raise HTTPException(status_code=409, detail="NFT-Kauf wird verarbeitet oder benötigt Abstimmung")
    if existing_purchase and existing_purchase.get("status") == "failed_refunded":
        raise HTTPException(status_code=409, detail="Fehlgeschlagener NFT-Kauf benötigt einen neuen Idempotency-Key")

    nft = await db.nfts.find_one({"nft_id": nft_id, "is_listed": True})
    if not nft:
        raise HTTPException(status_code=404, detail="NFT nicht gefunden oder nicht zum Verkauf")
    seller_id = str(nft.get("user_id") or "")
    if seller_id == buyer_id:
        raise HTTPException(status_code=400, detail="Kannst dein eigenes NFT nicht kaufen")
    price = round(float(nft.get("list_price") or 0), 2)
    if price <= 0:
        raise HTTPException(status_code=409, detail="Ungültiger NFT-Verkaufspreis")

    platform_user_id = await _nft_platform_user_id()
    if platform_user_id in {buyer_id, seller_id}:
        raise HTTPException(status_code=503, detail="NFT Plattform-Wallet ist ungültig konfiguriert")

    payload = {"buyer_id": buyer_id, "seller_id": seller_id, "nft_id": nft_id, "price": price}
    await db.nft_operations.update_one(
        {"_id": purchase_id},
        {"$setOnInsert": {
            "_id": purchase_id,
            "nft_id": nft_id,
            "payload": payload,
            "status": "pending",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )
    op = await db.nft_operations.find_one({"_id": purchase_id}, {"_id": 0}) or {}
    if op.get("payload") != payload:
        raise HTTPException(status_code=409, detail="Idempotency-Key wurde mit anderen Kaufdaten verwendet")

    lock = await db.nfts.update_one(
        {
            "nft_id": nft_id,
            "is_listed": True,
            "user_id": seller_id,
            "$or": [
                {"purchase_lock": {"$exists": False}},
                {"purchase_lock": None},
                {"purchase_lock": purchase_id},
            ],
        },
        {"$set": {"purchase_lock": purchase_id, "purchase_locked_at": datetime.now(timezone.utc).isoformat()}},
    )
    if lock.modified_count != 1:
        current = await db.nfts.find_one({"nft_id": nft_id}, {"_id": 0}) or {}
        if current.get("user_id") == buyer_id and current.get("last_purchase_id") == purchase_id:
            saved = await db.nft_operations.find_one({"_id": purchase_id}, {"_id": 0}) or {}
            if saved.get("response"):
                return {**saved["response"], "replayed": True}
        raise HTTPException(status_code=409, detail="NFT wird bereits gekauft oder ist nicht mehr verfügbar")

    await db.nft_operations.update_one(
        {"_id": purchase_id, "status": "pending"},
        {"$set": {"status": "processing", "processing_at": datetime.now(timezone.utc).isoformat()}},
    )

    buyer_payment = await transfer_between_wallets(
        from_user_id=buyer_id,
        to_user_id=platform_user_id,
        amount=price,
        tx_type=TransactionType.RESALE_PURCHASE,
        description=f"NFT Preview Kauf: {nft.get('name', nft_id)}",
        reference=purchase_id,
        metadata={"nft_id": nft_id, "seller_id": seller_id, "preview": True},
        idempotency_key=f"nft-buy:{purchase_id}:escrow",
    )
    if not buyer_payment.success:
        await db.nfts.update_one(
            {"nft_id": nft_id, "purchase_lock": purchase_id},
            {"$set": {"purchase_lock": None}, "$unset": {"purchase_locked_at": ""}},
        )
        await db.nft_operations.update_one(
            {"_id": purchase_id},
            {"$set": {"status": "failed", "error": buyer_payment.error or "buyer_payment_failed"}},
        )
        raise HTTPException(status_code=400, detail=buyer_payment.error or "NFT-Zahlung fehlgeschlagen")

    seller_amount = round(price * 0.95, 2)
    seller_payout = await transfer_between_wallets(
        from_user_id=platform_user_id,
        to_user_id=seller_id,
        amount=seller_amount,
        tx_type=TransactionType.RESALE_SALE,
        description=f"NFT Preview Verkauf: {nft.get('name', nft_id)}",
        reference=f"{purchase_id}-SELLER",
        metadata={"nft_id": nft_id, "buyer_id": buyer_id, "platform_fee": round(price - seller_amount, 2)},
        idempotency_key=f"nft-buy:{purchase_id}:seller",
    )
    if not seller_payout.success:
        refund = await transfer_between_wallets(
            from_user_id=platform_user_id,
            to_user_id=buyer_id,
            amount=price,
            tx_type=TransactionType.REFUND,
            description="NFT Preview Kauf Rückzahlung",
            reference=f"{purchase_id}-REFUND",
            metadata={"nft_id": nft_id, "reason": "seller_payout_failed"},
            idempotency_key=f"nft-buy:{purchase_id}:refund",
        )
        await db.nfts.update_one(
            {"nft_id": nft_id, "purchase_lock": purchase_id},
            {"$set": {"purchase_lock": None}, "$unset": {"purchase_locked_at": ""}},
        )
        await db.nft_operations.update_one(
            {"_id": purchase_id},
            {"$set": {
                "status": "failed_refunded" if refund.success else "reconciliation_required",
                "error": seller_payout.error or "seller_payout_failed",
                "refund_transaction_id": refund.transaction_id,
            }},
        )
        if not refund.success:
            raise HTTPException(status_code=500, detail="NFT-Kauf benötigt Abstimmung")
        raise HTTPException(status_code=409, detail="NFT-Kauf fehlgeschlagen. Käufer wurde zurückgezahlt")

    now = datetime.now(timezone.utc)
    finalized = await db.nfts.update_one(
        {"nft_id": nft_id, "purchase_lock": purchase_id, "user_id": seller_id, "is_listed": True},
        {"$set": {
            "user_id": buyer_id,
            "is_listed": False,
            "list_price": None,
            "listed_at": None,
            "purchase_lock": None,
            "last_purchase_id": purchase_id,
            "last_sale_price": price,
            "last_sale_at": now.isoformat(),
        }, "$unset": {"purchase_locked_at": ""}},
    )
    if finalized.modified_count != 1:
        await db.nft_operations.update_one(
            {"_id": purchase_id},
            {"$set": {
                "status": "reconciliation_required",
                "buyer_transaction_id": buyer_payment.transaction_id,
                "seller_transaction_id": seller_payout.transaction_id,
                "error": "ownership_finalize_failed",
            }},
        )
        raise HTTPException(status_code=500, detail="Zahlung erfolgt; NFT-Eigentumswechsel benötigt Abstimmung")

    for tx_id, tx_user, tx_type, amount, description, wallet_tx_id in [
        (f"{purchase_id}:buyer", buyer_id, "NFT_BUY", -price, f"NFT gekauft: {nft.get('name')}", buyer_payment.transaction_id),
        (f"{purchase_id}:seller", seller_id, "NFT_SALE", seller_amount, f"NFT verkauft: {nft.get('name')} (5% Gebühr)", seller_payout.transaction_id),
    ]:
        await db.transactions.update_one(
            {"_id": tx_id},
            {"$setOnInsert": {
                "_id": tx_id,
                "tx_id": tx_id,
                "user_id": tx_user,
                "type": tx_type,
                "amount": amount,
                "description": description,
                "reference": nft_id,
                "wallet_transaction_id": wallet_tx_id,
                "created_at": now.isoformat(),
            }},
            upsert=True,
        )

    response = {
        "ok": True,
        "nft_name": nft.get("name"),
        "price_paid": price,
        "new_balance": round(float(buyer_payment.new_balance or 0), 2),
        "message": f"🎉 NFT '{nft.get('name')}' gekauft!",
    }
    await db.nft_operations.update_one(
        {"_id": purchase_id},
        {"$set": {
            "status": "completed",
            "response": response,
            "buyer_transaction_id": buyer_payment.transaction_id,
            "seller_transaction_id": seller_payout.transaction_id,
            "completed_at": now.isoformat(),
        }},
    )
    return {**response, "replayed": bool(buyer_payment.idempotent_replay and seller_payout.idempotent_replay)}



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
