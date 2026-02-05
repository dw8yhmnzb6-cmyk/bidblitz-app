"""AR Preview - Augmented Reality product preview"""
from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timezone
from typing import Optional

from config import db, logger
from dependencies import get_current_user

router = APIRouter(prefix="/ar-preview", tags=["AR Preview"])

# AR model types
AR_MODELS = {
    "watches": {
        "category": "Uhren",
        "supports_wrist_tracking": True,
        "model_type": "glb",
        "ar_scale": 0.1
    },
    "electronics": {
        "category": "Elektronik",
        "supports_placement": True,
        "model_type": "glb",
        "ar_scale": 1.0
    },
    "jewelry": {
        "category": "Schmuck",
        "supports_face_tracking": True,
        "model_type": "glb",
        "ar_scale": 0.05
    },
    "furniture": {
        "category": "Möbel",
        "supports_placement": True,
        "model_type": "glb",
        "ar_scale": 1.0
    },
    "fashion": {
        "category": "Mode",
        "supports_body_tracking": True,
        "model_type": "glb",
        "ar_scale": 1.0
    }
}

@router.get("/product/{product_id}")
async def get_ar_preview_data(product_id: str):
    """Get AR preview data for a product"""
    product = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Produkt nicht gefunden")
    
    # Check if product has 3D model
    ar_data = await db.ar_models.find_one({"product_id": product_id}, {"_id": 0})
    
    category = product.get("category", "").lower()
    ar_config = None
    
    for key, config in AR_MODELS.items():
        if key in category or config.get("category", "").lower() in category:
            ar_config = config
            break
    
    if ar_data:
        return {
            "product_id": product_id,
            "product_name": product.get("name"),
            "ar_available": True,
            "model_url": ar_data.get("model_url"),
            "model_type": ar_data.get("model_type", "glb"),
            "thumbnail_url": ar_data.get("thumbnail_url"),
            "ar_config": {
                "scale": ar_data.get("scale", 1.0),
                "rotation": ar_data.get("rotation", [0, 0, 0]),
                "supports_placement": ar_data.get("supports_placement", True),
                "supports_wrist_tracking": ar_data.get("supports_wrist_tracking", False),
                "supports_face_tracking": ar_data.get("supports_face_tracking", False)
            },
            "instructions": get_ar_instructions(ar_data)
        }
    
    # No 3D model available - return placeholder info
    return {
        "product_id": product_id,
        "product_name": product.get("name"),
        "ar_available": False,
        "message": "AR-Vorschau für dieses Produkt nicht verfügbar",
        "fallback_images": [product.get("image_url")],
        "category_supports_ar": ar_config is not None,
        "ar_config": ar_config
    }

def get_ar_instructions(ar_data: dict) -> dict:
    """Get AR usage instructions based on model type"""
    instructions = {
        "de": "Richte deine Kamera auf eine flache Oberfläche und tippe, um das Produkt zu platzieren.",
        "en": "Point your camera at a flat surface and tap to place the product."
    }
    
    if ar_data.get("supports_wrist_tracking"):
        instructions = {
            "de": "Zeige dein Handgelenk in die Kamera, um die Uhr virtuell anzuprobieren.",
            "en": "Show your wrist to the camera to try on the watch virtually."
        }
    elif ar_data.get("supports_face_tracking"):
        instructions = {
            "de": "Schaue in die Kamera, um den Schmuck virtuell anzuprobieren.",
            "en": "Look at the camera to try on the jewelry virtually."
        }
    
    return instructions

@router.get("/supported-categories")
async def get_ar_supported_categories():
    """Get list of categories that support AR preview"""
    return {
        "categories": [
            {
                "key": key,
                "name": config["category"],
                "features": {
                    "placement": config.get("supports_placement", False),
                    "wrist_tracking": config.get("supports_wrist_tracking", False),
                    "face_tracking": config.get("supports_face_tracking", False),
                    "body_tracking": config.get("supports_body_tracking", False)
                }
            }
            for key, config in AR_MODELS.items()
        ]
    }

@router.post("/view-logged")
async def log_ar_view(
    product_id: str,
    duration_seconds: int = 0,
    interaction_type: str = "view",
    user: dict = Depends(get_current_user)
):
    """Log an AR preview view for analytics"""
    log_entry = {
        "user_id": user["id"],
        "product_id": product_id,
        "duration_seconds": duration_seconds,
        "interaction_type": interaction_type,  # view, rotate, zoom, screenshot
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "device_type": "unknown"  # Would be passed from frontend
    }
    
    await db.ar_analytics.insert_one(log_entry)
    
    # Update product AR view count
    await db.products.update_one(
        {"id": product_id},
        {"$inc": {"ar_views": 1}}
    )
    
    return {"logged": True}

@router.get("/popular")
async def get_popular_ar_products(limit: int = 10):
    """Get products with most AR views"""
    products = await db.products.find(
        {"ar_views": {"$gt": 0}},
        {"_id": 0, "id": 1, "name": 1, "image_url": 1, "category": 1, "ar_views": 1}
    ).sort("ar_views", -1).limit(limit).to_list(limit)
    
    # Check which have active auctions
    result = []
    for product in products:
        auction = await db.auctions.find_one(
            {"product_id": product["id"], "status": "active"},
            {"_id": 0, "id": 1, "current_price": 1}
        )
        result.append({
            **product,
            "has_active_auction": auction is not None,
            "auction_id": auction.get("id") if auction else None,
            "current_price": auction.get("current_price") if auction else None
        })
    
    return {"popular_ar_products": result}

# Admin endpoint to add 3D model
@router.post("/admin/add-model")
async def add_ar_model(
    product_id: str,
    model_url: str,
    model_type: str = "glb",
    scale: float = 1.0,
    supports_placement: bool = True,
    supports_wrist_tracking: bool = False,
    supports_face_tracking: bool = False,
    thumbnail_url: str = None,
    admin: dict = Depends(get_current_user)
):
    """Add a 3D model for AR preview"""
    product = await db.products.find_one({"id": product_id})
    if not product:
        raise HTTPException(status_code=404, detail="Produkt nicht gefunden")
    
    ar_model = {
        "product_id": product_id,
        "model_url": model_url,
        "model_type": model_type,
        "thumbnail_url": thumbnail_url,
        "scale": scale,
        "rotation": [0, 0, 0],
        "supports_placement": supports_placement,
        "supports_wrist_tracking": supports_wrist_tracking,
        "supports_face_tracking": supports_face_tracking,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": admin["id"]
    }
    
    await db.ar_models.update_one(
        {"product_id": product_id},
        {"$set": ar_model},
        upsert=True
    )
    
    return {"success": True, "ar_model": ar_model}

# WebXR session info
@router.get("/webxr-info")
async def get_webxr_info():
    """Get WebXR compatibility and setup info"""
    return {
        "supported_browsers": [
            {"name": "Chrome (Android)", "version": "79+", "supported": True},
            {"name": "Safari (iOS)", "version": "15+", "supported": True, "note": "Quick Look only"},
            {"name": "Firefox", "version": "Not supported", "supported": False},
            {"name": "Samsung Internet", "version": "11+", "supported": True}
        ],
        "requirements": {
            "de": "Für die beste AR-Erfahrung benötigst du ein Smartphone mit ARCore (Android) oder ARKit (iOS).",
            "en": "For the best AR experience, you need a smartphone with ARCore (Android) or ARKit (iOS)."
        },
        "ios_quicklook": True,
        "android_scene_viewer": True
    }
