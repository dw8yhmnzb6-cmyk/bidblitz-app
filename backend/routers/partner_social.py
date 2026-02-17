"""
Social Media Sharing for Partners - Automatisches Teilen auf Social Media
Mit Tracking und ansprechenden Vorschau-Bildern
"""
from fastapi import APIRouter, HTTPException
from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel
import uuid
import urllib.parse

from config import db, logger

router = APIRouter(prefix="/partner-social", tags=["Partner Social Sharing"])

# ==================== SCHEMAS ====================

class ShareRequest(BaseModel):
    platform: str  # facebook, instagram, whatsapp, twitter, email
    content_type: str  # voucher, profile, flash_sale
    content_id: Optional[str] = None
    custom_message: Optional[str] = None

class ShareLinkResponse(BaseModel):
    share_url: str
    preview_text: str
    tracking_id: str

# ==================== ENDPOINTS ====================

@router.get("/share-links")
async def get_share_links(
    token: str,
    content_type: str = "profile",  # profile, voucher, flash_sale
    content_id: Optional[str] = None
):
    """Generate share links for all platforms"""
    partner = await db.partner_accounts.find_one({"token": token}, {"_id": 0})
    if not partner:
        raise HTTPException(status_code=401, detail="Ungültiger Token")
    
    partner_id = partner.get("id")
    partner_name = partner.get("name", "Partner")
    
    # Build content URL and message based on type
    base_url = "https://bidblitz.ae"
    
    if content_type == "profile":
        content_url = f"{base_url}/partner/{partner_id}"
        default_message = f"🏪 Entdecke tolle Angebote bei {partner_name} auf BidBlitz!"
    elif content_type == "voucher" and content_id:
        voucher = await db.vouchers.find_one({"id": content_id}, {"_id": 0})
        if voucher:
            content_url = f"{base_url}/voucher/{content_id}"
            default_message = f"🎁 {voucher.get('name', 'Gutschein')} bei {partner_name} - Jetzt auf BidBlitz!"
        else:
            content_url = f"{base_url}/partner/{partner_id}"
            default_message = f"🎁 Gutscheine bei {partner_name} auf BidBlitz!"
    elif content_type == "flash_sale" and content_id:
        sale = await db.partner_flash_sales.find_one({"id": content_id}, {"_id": 0})
        if sale:
            content_url = f"{base_url}/flash-sale/{content_id}"
            default_message = f"🔥 {sale.get('discount_percent', 0)}% Rabatt bei {partner_name}! Nur für kurze Zeit!"
        else:
            content_url = f"{base_url}/partner/{partner_id}"
            default_message = f"🔥 Flash Sale bei {partner_name}!"
    else:
        content_url = f"{base_url}/partner/{partner_id}"
        default_message = f"🏪 Entdecke {partner_name} auf BidBlitz!"
    
    # Create tracking ID
    tracking_id = str(uuid.uuid4())[:8]
    tracked_url = f"{content_url}?ref=social&tid={tracking_id}"
    
    # URL encode message
    encoded_message = urllib.parse.quote(default_message)
    encoded_url = urllib.parse.quote(tracked_url)
    
    # Generate platform-specific share links
    share_links = {
        "facebook": {
            "url": f"https://www.facebook.com/sharer/sharer.php?u={encoded_url}&quote={encoded_message}",
            "name": "Facebook",
            "icon": "facebook"
        },
        "twitter": {
            "url": f"https://twitter.com/intent/tweet?text={encoded_message}&url={encoded_url}",
            "name": "Twitter/X",
            "icon": "twitter"
        },
        "whatsapp": {
            "url": f"https://wa.me/?text={encoded_message}%20{encoded_url}",
            "name": "WhatsApp",
            "icon": "whatsapp"
        },
        "telegram": {
            "url": f"https://t.me/share/url?url={encoded_url}&text={encoded_message}",
            "name": "Telegram",
            "icon": "telegram"
        },
        "linkedin": {
            "url": f"https://www.linkedin.com/sharing/share-offsite/?url={encoded_url}",
            "name": "LinkedIn",
            "icon": "linkedin"
        },
        "email": {
            "url": f"mailto:?subject={urllib.parse.quote(f'Angebot bei {partner_name}')}&body={encoded_message}%20{encoded_url}",
            "name": "E-Mail",
            "icon": "mail"
        },
        "copy": {
            "url": tracked_url,
            "name": "Link kopieren",
            "icon": "copy"
        }
    }
    
    # Store tracking record
    await db.social_shares.insert_one({
        "id": tracking_id,
        "partner_id": partner_id,
        "content_type": content_type,
        "content_id": content_id,
        "content_url": tracked_url,
        "clicks": {},
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {
        "share_links": share_links,
        "content_url": tracked_url,
        "default_message": default_message,
        "tracking_id": tracking_id,
        "preview": {
            "title": partner_name,
            "description": default_message,
            "image": partner.get("logo_url")
        }
    }


@router.post("/track-click")
async def track_social_click(tracking_id: str, platform: str, referrer: Optional[str] = None):
    """Track when someone clicks a social share link"""
    share = await db.social_shares.find_one({"id": tracking_id})
    if not share:
        # Create minimal tracking record
        await db.social_shares.insert_one({
            "id": tracking_id,
            "clicks": {platform: 1},
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        return {"success": True}
    
    # Increment click count for platform
    await db.social_shares.update_one(
        {"id": tracking_id},
        {
            "$inc": {f"clicks.{platform}": 1},
            "$set": {"last_click": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    # Log detailed click
    await db.social_clicks.insert_one({
        "id": str(uuid.uuid4()),
        "tracking_id": tracking_id,
        "partner_id": share.get("partner_id"),
        "platform": platform,
        "referrer": referrer,
        "clicked_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"success": True}


@router.get("/stats")
async def get_social_stats(token: str, days: int = 30):
    """Get social sharing statistics for partner"""
    partner = await db.partner_accounts.find_one({"token": token}, {"_id": 0})
    if not partner:
        raise HTTPException(status_code=401, detail="Ungültiger Token")
    
    partner_id = partner.get("id")
    
    # Get all shares
    from datetime import timedelta
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    
    shares = await db.social_shares.find(
        {"partner_id": partner_id, "created_at": {"$gte": cutoff}},
        {"_id": 0}
    ).to_list(500)
    
    # Aggregate clicks by platform
    platform_stats = {
        "facebook": 0, "twitter": 0, "whatsapp": 0,
        "telegram": 0, "linkedin": 0, "email": 0, "copy": 0
    }
    
    for share in shares:
        clicks = share.get("clicks", {})
        for platform, count in clicks.items():
            platform_stats[platform] = platform_stats.get(platform, 0) + count
    
    total_clicks = sum(platform_stats.values())
    total_shares = len(shares)
    
    # Get conversion stats (clicks that led to actions)
    conversions = await db.social_clicks.count_documents({
        "partner_id": partner_id,
        "clicked_at": {"$gte": cutoff}
    })
    
    return {
        "total_shares": total_shares,
        "total_clicks": total_clicks,
        "platform_stats": platform_stats,
        "conversions": conversions,
        "top_platform": max(platform_stats, key=platform_stats.get) if total_clicks > 0 else None,
        "period_days": days
    }


@router.get("/suggested-posts")
async def get_suggested_posts(token: str):
    """Get AI-generated post suggestions for partner"""
    partner = await db.partner_accounts.find_one({"token": token}, {"_id": 0})
    if not partner:
        raise HTTPException(status_code=401, detail="Ungültiger Token")
    
    partner_name = partner.get("name", "Partner")
    business_type = partner.get("business_type", "other")
    
    # Get active vouchers for context
    vouchers = await db.vouchers.find(
        {"partner_id": partner.get("id"), "is_sold": False},
        {"_id": 0, "name": 1, "value": 1}
    ).limit(3).to_list(3)
    
    # Generate suggestions based on business type
    suggestions = []
    
    # General suggestions
    suggestions.append({
        "title": "Neue Woche, neue Angebote!",
        "text": f"🎉 Starte die Woche mit tollen Deals bei {partner_name}! Sichere dir jetzt exklusive Gutscheine auf BidBlitz. Link in Bio! #BidBlitz #Deals #{partner_name.replace(' ', '')}",
        "best_time": "Montag 9-11 Uhr",
        "platforms": ["instagram", "facebook"]
    })
    
    suggestions.append({
        "title": "Flash Sale Ankündigung",
        "text": f"⚡ FLASH SALE bei {partner_name}! Nur heute: Extra Rabatt auf alle Gutscheine. Schnell sein lohnt sich! 🏃‍♂️ #FlashSale #Angebot",
        "best_time": "Freitag 12-14 Uhr",
        "platforms": ["twitter", "whatsapp"]
    })
    
    if vouchers:
        voucher = vouchers[0]
        suggestions.append({
            "title": "Gutschein-Highlight",
            "text": f"🎁 Unser Bestseller: {voucher.get('name', 'Gutschein')} im Wert von €{voucher.get('value', 0)}! Jetzt auf BidBlitz ersteigern und sparen! 💰",
            "best_time": "Mittwoch 18-20 Uhr",
            "platforms": ["facebook", "instagram", "whatsapp"]
        })
    
    # Business-type specific
    type_suggestions = {
        "restaurant": {
            "title": "Hungrig?",
            "text": f"🍕 Lust auf leckeres Essen? Bei {partner_name} wartet ein Genuss-Erlebnis auf dich! Hol dir deinen Gutschein auf BidBlitz! #Foodie #Restaurant"
        },
        "cafe": {
            "title": "Kaffeepause",
            "text": f"☕ Zeit für eine Kaffeepause! Genieße deinen Lieblingskaffee bei {partner_name} - mit BidBlitz Gutschein noch günstiger! #Kaffeeliebe"
        },
        "wellness": {
            "title": "Entspannung pur",
            "text": f"💆 Gönn dir eine Auszeit bei {partner_name}! Wellness-Gutscheine auf BidBlitz - weil du es verdient hast! #Wellness #Entspannung"
        }
    }
    
    if business_type in type_suggestions:
        suggestions.append({
            **type_suggestions[business_type],
            "best_time": "Wochenende",
            "platforms": ["instagram", "facebook"]
        })
    
    return {"suggestions": suggestions}
