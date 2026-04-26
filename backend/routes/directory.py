"""
BidBlitz V2 - Lokales Dienstleister-Verzeichnis (Telefonbuch)
Ärzte, Handwerker, Restaurants, etc. mit Länderfilter

Basic (Kostenlos) vs Premium (€1.99/Monat oder €16.99/Jahr)
"""
from fastapi import APIRouter, HTTPException, Request, UploadFile, File
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from core.database import db
from core.security import get_current_user
import secrets

router = APIRouter(prefix="/api/directory", tags=["directory"])

# ══════════════════════════════════════════════════════════════════════════════
# CATEGORIES & COUNTRIES
# ══════════════════════════════════════════════════════════════════════════════

CATEGORIES = [
    {"id": "aerzte", "name": "Ärzte & Medizin", "icon": "🏥"},
    {"id": "handwerker", "name": "Handwerker", "icon": "🔨"},
    {"id": "restaurants", "name": "Restaurants & Cafés", "icon": "🍽️"},
    {"id": "friseure", "name": "Friseure & Beauty", "icon": "💇"},
    {"id": "anwaelte", "name": "Anwälte & Notare", "icon": "⚖️"},
    {"id": "steuerberater", "name": "Steuerberater", "icon": "💼"},
    {"id": "autowerkstatt", "name": "Autowerkstätten", "icon": "🚗"},
    {"id": "immobilien", "name": "Immobilien", "icon": "🏠"},
    {"id": "reinigung", "name": "Reinigungsdienste", "icon": "🧹"},
    {"id": "lieferservice", "name": "Lieferservice", "icon": "🚚"},
    {"id": "fitness", "name": "Fitness & Sport", "icon": "💪"},
    {"id": "bildung", "name": "Bildung & Nachhilfe", "icon": "📚"},
    {"id": "elektriker", "name": "Elektriker", "icon": "⚡"},
    {"id": "apotheke", "name": "Apotheken", "icon": "💊"},
    {"id": "andere", "name": "Sonstige Dienstleister", "icon": "📋"},
]

COUNTRIES = [
    {"code": "DE", "name": "Deutschland", "flag": "🇩🇪"},
    {"code": "XK", "name": "Kosovo", "flag": "🇽🇰"},
    {"code": "AT", "name": "Österreich", "flag": "🇦🇹"},
    {"code": "CH", "name": "Schweiz", "flag": "🇨🇭"},
    {"code": "AL", "name": "Albanien", "flag": "🇦🇱"},
    {"code": "MK", "name": "Nordmazedonien", "flag": "🇲🇰"},
]

PREMIUM_PLANS = {
    "monthly": {"price": 1.99, "duration_days": 30, "label": "Monatlich"},
    "yearly": {"price": 16.99, "duration_days": 365, "label": "Jährlich"},
}

# ══════════════════════════════════════════════════════════════════════════════
# MODELS
# ══════════════════════════════════════════════════════════════════════════════

class ListingCreate(BaseModel):
    business_name: str = Field(..., min_length=2, max_length=120)
    category: str
    phone: str = Field(..., min_length=5, max_length=30)
    country_code: str = Field(..., min_length=2, max_length=2)
    city: str = Field(..., min_length=2, max_length=100)
    address: str = ""
    postal_code: str = ""
    email: Optional[str] = None
    website: Optional[str] = None
    description: str = ""
    opening_hours: str = ""
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    photos: List[str] = []

class ListingUpdate(BaseModel):
    business_name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    description: Optional[str] = None
    opening_hours: Optional[str] = None
    website: Optional[str] = None
    photos: Optional[List[str]] = None

class PremiumUpgrade(BaseModel):
    listing_id: str
    plan: str  # "monthly" or "yearly"

class ReviewCreate(BaseModel):
    listing_id: str
    rating: int = Field(..., ge=1, le=5)
    comment: str = Field("", max_length=500)

# ══════════════════════════════════════════════════════════════════════════════
# HELPERS
# ══════════════════════════════════════════════════════════════════════════════

def _is_admin_or_agent(user: dict) -> bool:
    """Check if user is admin or field agent"""
    return user.get("role") in ["admin", "field_agent"]

def _can_edit_listing(user: dict, listing: dict) -> bool:
    """Check if user can edit this listing"""
    if user.get("role") in ["admin", "field_agent"]:
        return True
    return listing.get("owner_email") == user.get("email")

# ══════════════════════════════════════════════════════════════════════════════
# PUBLIC ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/categories")
async def get_categories():
    """Get all available categories"""
    return {"categories": CATEGORIES}

@router.get("/countries")
async def get_countries():
    """Get all supported countries"""
    return {"countries": COUNTRIES}

@router.get("/listings")
async def get_listings(
    category: Optional[str] = None,
    country: Optional[str] = None,
    city: Optional[str] = None,
    search: Optional[str] = None,
    premium_only: bool = False,
    limit: int = 50
):
    """
    Get directory listings with filters
    Premium listings appear first
    """
    query = {"status": "active"}
    
    if category:
        query["category"] = category
    if country:
        query["country_code"] = country.upper()
    if city:
        query["city"] = {"$regex": city, "$options": "i"}
    if search:
        query["$or"] = [
            {"business_name": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
        ]
    if premium_only:
        query["is_premium"] = True
        query["premium_expires_at"] = {"$gt": datetime.now(timezone.utc).isoformat()}
    
    # Sort: Premium first, then by creation date
    listings = await db.directory_listings.find(query, {"_id": 0})\
        .sort([("is_premium", -1), ("created_at", -1)])\
        .limit(limit)\
        .to_list(limit)
    
    # Mark expired premium listings
    now = datetime.now(timezone.utc).isoformat()
    for listing in listings:
        if listing.get("is_premium") and listing.get("premium_expires_at", "") < now:
            listing["is_premium"] = False
            await db.directory_listings.update_one(
                {"listing_id": listing["listing_id"]},
                {"$set": {"is_premium": False}}
            )
    
    return {"listings": listings, "total": len(listings)}

@router.get("/listings/{listing_id}")
async def get_listing(listing_id: str):
    """Get single listing details"""
    listing = await db.directory_listings.find_one({"listing_id": listing_id}, {"_id": 0})
    if not listing:
        raise HTTPException(404, "Listing nicht gefunden")
    
    # Increment views
    await db.directory_listings.update_one(
        {"listing_id": listing_id},
        {"$inc": {"views": 1}}
    )
    
    # Get reviews
    reviews = await db.directory_reviews.find(
        {"listing_id": listing_id}, {"_id": 0}
    ).sort("created_at", -1).limit(20).to_list(20)
    
    listing["reviews"] = reviews
    listing["review_count"] = len(reviews)
    
    return listing

@router.get("/search/cities")
async def search_cities(country: str, query: str = ""):
    """Get cities for autocomplete"""
    match_query = {"country_code": country.upper(), "status": "active"}
    if query:
        match_query["city"] = {"$regex": f"^{query}", "$options": "i"}
    
    cities = await db.directory_listings.distinct("city", match_query)
    return {"cities": sorted(cities[:20])}

@router.post("/listings/{listing_id}/upload-photo")
async def upload_listing_photo(listing_id: str, photo: UploadFile = File(...), request: Request = None):
    """
    Upload photo for listing (agent/admin/owner only)
    """
    user = await get_current_user(request)
    
    listing = await db.directory_listings.find_one({"listing_id": listing_id})
    if not listing:
        raise HTTPException(404, "Listing nicht gefunden")
    
    if not _can_edit_listing(user, listing):
        raise HTTPException(403, "Keine Berechtigung")
    
    # Read file
    contents = await photo.read()
    if len(contents) > 5 * 1024 * 1024:  # 5MB limit
        raise HTTPException(400, "Foto zu groß (max 5MB)")
    
    # Save to static directory
    import os
    photo_dir = "/app/backend/static/directory_photos"
    os.makedirs(photo_dir, exist_ok=True)
    
    # Generate unique filename
    import uuid
    ext = photo.filename.split('.')[-1] if '.' in photo.filename else 'jpg'
    filename = f"{listing_id}_{uuid.uuid4().hex[:8]}.{ext}"
    filepath = os.path.join(photo_dir, filename)
    
    # Write file
    with open(filepath, 'wb') as f:
        f.write(contents)
    
    # Update listing
    photo_url = f"/static/directory_photos/{filename}"
    await db.directory_listings.update_one(
        {"listing_id": listing_id},
        {"$push": {"photos": photo_url}}
    )
    
    return {"ok": True, "photo_url": photo_url, "message": "Foto hochgeladen"}

@router.delete("/listings/{listing_id}/photos/{photo_index}")
async def delete_listing_photo(listing_id: str, photo_index: int, request: Request):
    """
    Delete photo from listing
    """
    user = await get_current_user(request)
    
    listing = await db.directory_listings.find_one({"listing_id": listing_id})
    if not listing:
        raise HTTPException(404, "Listing nicht gefunden")
    
    if not _can_edit_listing(user, listing):
        raise HTTPException(403, "Keine Berechtigung")
    
    photos = listing.get("photos", [])
    if photo_index >= len(photos):
        raise HTTPException(404, "Foto nicht gefunden")
    
    # Remove from DB
    photo_url = photos[photo_index]
    await db.directory_listings.update_one(
        {"listing_id": listing_id},
        {"$pull": {"photos": photo_url}}
    )
    
    # Delete file
    import os
    filepath = f"/app/backend{photo_url}"
    if os.path.exists(filepath):
        os.remove(filepath)
    
    return {"ok": True, "message": "Foto gelöscht"}

# ══════════════════════════════════════════════════════════════════════════════
# AGENT/ADMIN ENDPOINTS - Create & Manage Listings
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/listings")
async def create_listing(req: ListingCreate, request: Request):
    """
    Create new listing (field agents & admins only)
    """
    user = await get_current_user(request)
    
    if not _is_admin_or_agent(user):
        raise HTTPException(403, "Nur Außendienstmitarbeiter und Admins können Listings erstellen")
    
    # Validate category
    if req.category not in [c["id"] for c in CATEGORIES]:
        raise HTTPException(400, "Ungültige Kategorie")
    
    # Validate country
    if req.country_code.upper() not in [c["code"] for c in COUNTRIES]:
        raise HTTPException(400, "Ungültiges Land")
    
    listing = {
        "listing_id": f"dir_{secrets.token_hex(8)}",
        "business_name": req.business_name,
        "category": req.category,
        "phone": req.phone,
        "country_code": req.country_code.upper(),
        "city": req.city,
        "address": req.address,
        "postal_code": req.postal_code,
        "email": req.email or "",
        "website": req.website or "",
        "description": req.description,
        "opening_hours": req.opening_hours,
        "latitude": req.latitude,
        "longitude": req.longitude,
        "photos": req.photos,
        "is_premium": False,
        "premium_expires_at": None,
        "status": "active",
        "views": 0,
        "rating": 0.0,
        "review_count": 0,
        "created_by": user.get("email", ""),
        "created_by_role": user.get("role", "field_agent"),
        "owner_email": req.email or "",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    
    await db.directory_listings.insert_one(listing)
    listing.pop("_id", None)
    
    return {"ok": True, "listing": listing, "message": f"{req.business_name} erfolgreich hinzugefügt!"}

@router.patch("/listings/{listing_id}")
async def update_listing(listing_id: str, req: ListingUpdate, request: Request):
    """
    Update existing listing (owner, agent, or admin)
    """
    user = await get_current_user(request)
    
    listing = await db.directory_listings.find_one({"listing_id": listing_id})
    if not listing:
        raise HTTPException(404, "Listing nicht gefunden")
    
    if not _can_edit_listing(user, listing):
        raise HTTPException(403, "Keine Berechtigung")
    
    update_data = {k: v for k, v in req.dict(exclude_unset=True).items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.directory_listings.update_one(
        {"listing_id": listing_id},
        {"$set": update_data}
    )
    
    return {"ok": True, "message": "Listing aktualisiert"}

@router.delete("/listings/{listing_id}")
async def delete_listing(listing_id: str, request: Request):
    """
    Delete listing (admin only)
    """
    user = await get_current_user(request)
    
    if user.get("role") != "admin":
        raise HTTPException(403, "Nur Admins können Listings löschen")
    
    result = await db.directory_listings.delete_one({"listing_id": listing_id})
    
    if result.deleted_count == 0:
        raise HTTPException(404, "Listing nicht gefunden")
    
    return {"ok": True, "message": "Listing gelöscht"}

# ══════════════════════════════════════════════════════════════════════════════
# PREMIUM UPGRADE
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/premium/upgrade")
async def upgrade_to_premium(req: PremiumUpgrade, request: Request):
    """
    Upgrade listing to premium (agent/admin can upgrade any, owner can upgrade own)
    Payment deducted from wallet
    """
    user = await get_current_user(request)
    
    listing = await db.directory_listings.find_one({"listing_id": req.listing_id})
    if not listing:
        raise HTTPException(404, "Listing nicht gefunden")
    
    # Check permissions
    if not _can_edit_listing(user, listing):
        raise HTTPException(403, "Keine Berechtigung")
    
    # Validate plan
    if req.plan not in PREMIUM_PLANS:
        raise HTTPException(400, "Ungültiger Premium-Plan")
    
    plan = PREMIUM_PLANS[req.plan]
    price = plan["price"]
    
    # Check balance (for non-admin users)
    if user.get("role") != "admin":
        balance = user.get("balance", 0)
        if balance < price:
            raise HTTPException(400, f"Nicht genug Guthaben. Benötigt: €{price:.2f}")
        
        # Deduct from wallet
        await db.users.update_one(
            {"email": user.get("email")},
            {"$inc": {"balance": -price}}
        )
    
    # Calculate expiry
    expires_at = datetime.now(timezone.utc) + timedelta(days=plan["duration_days"])
    
    # Upgrade listing
    await db.directory_listings.update_one(
        {"listing_id": req.listing_id},
        {"$set": {
            "is_premium": True,
            "premium_plan": req.plan,
            "premium_price": price,
            "premium_upgraded_at": datetime.now(timezone.utc).isoformat(),
            "premium_expires_at": expires_at.isoformat(),
        }}
    )
    
    # Record transaction
    await db.directory_transactions.insert_one({
        "tx_id": f"prem_{secrets.token_hex(8)}",
        "listing_id": req.listing_id,
        "business_name": listing["business_name"],
        "plan": req.plan,
        "price": price,
        "upgraded_by": user.get("email"),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    
    return {
        "ok": True,
        "message": f"Premium-Upgrade erfolgreich! Gültig bis {expires_at.strftime('%d.%m.%Y')}",
        "expires_at": expires_at.isoformat(),
    }

# ══════════════════════════════════════════════════════════════════════════════
# REVIEWS & RATINGS
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/reviews")
async def create_review(req: ReviewCreate, request: Request):
    """
    Add review to listing (authenticated users only)
    """
    user = await get_current_user(request)
    
    listing = await db.directory_listings.find_one({"listing_id": req.listing_id})
    if not listing:
        raise HTTPException(404, "Listing nicht gefunden")
    
    # Check if user already reviewed
    existing = await db.directory_reviews.find_one({
        "listing_id": req.listing_id,
        "user_email": user.get("email")
    })
    if existing:
        raise HTTPException(400, "Du hast dieses Listing bereits bewertet")
    
    review = {
        "review_id": f"rev_{secrets.token_hex(8)}",
        "listing_id": req.listing_id,
        "user_email": user.get("email"),
        "user_name": user.get("name", "Anonym"),
        "rating": req.rating,
        "comment": req.comment,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    
    await db.directory_reviews.insert_one(review)
    
    # Update listing rating
    reviews = await db.directory_reviews.find({"listing_id": req.listing_id}).to_list(1000)
    avg_rating = sum(r["rating"] for r in reviews) / len(reviews)
    
    await db.directory_listings.update_one(
        {"listing_id": req.listing_id},
        {"$set": {
            "rating": round(avg_rating, 1),
            "review_count": len(reviews)
        }}
    )
    
    # Send notification to listing owner and agent
    notification_recipients = []
    if listing.get("owner_email"):
        notification_recipients.append(listing["owner_email"])
    if listing.get("created_by"):
        notification_recipients.append(listing["created_by"])
    
    for recipient in set(notification_recipients):  # Remove duplicates
        await db.notifications.insert_one({
            "notification_id": f"notif_{secrets.token_hex(8)}",
            "user_email": recipient,
            "type": "directory_review",
            "title": "Neue Bewertung",
            "message": f"{user.get('name', 'Jemand')} hat {listing['business_name']} bewertet: {req.rating} Sterne",
            "data": {
                "listing_id": req.listing_id,
                "review_id": review["review_id"],
                "rating": req.rating,
            },
            "read": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    
    return {"ok": True, "message": "Bewertung hinzugefügt!"}

# ══════════════════════════════════════════════════════════════════════════════
# FAVORITES
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/favorites/{listing_id}")
async def add_favorite(listing_id: str, request: Request):
    """Add listing to user favorites"""
    user = await get_current_user(request)
    
    listing = await db.directory_listings.find_one({"listing_id": listing_id})
    if not listing:
        raise HTTPException(404, "Listing nicht gefunden")
    
    await db.directory_favorites.update_one(
        {"user_email": user.get("email")},
        {"$addToSet": {"listing_ids": listing_id}, "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )
    
    return {"ok": True, "message": "Zu Favoriten hinzugefügt"}

@router.delete("/favorites/{listing_id}")
async def remove_favorite(listing_id: str, request: Request):
    """Remove listing from favorites"""
    user = await get_current_user(request)
    
    await db.directory_favorites.update_one(
        {"user_email": user.get("email")},
        {"$pull": {"listing_ids": listing_id}}
    )
    
    return {"ok": True, "message": "Aus Favoriten entfernt"}

@router.get("/favorites")
async def get_favorites(request: Request):
    """Get user's favorite listings"""
    user = await get_current_user(request)
    
    fav_doc = await db.directory_favorites.find_one({"user_email": user.get("email")}, {"_id": 0})
    if not fav_doc:
        return {"favorites": []}
    
    listing_ids = fav_doc.get("listing_ids", [])
    listings = await db.directory_listings.find(
        {"listing_id": {"$in": listing_ids}}, {"_id": 0}
    ).to_list(100)
    
    return {"favorites": listings}

# ══════════════════════════════════════════════════════════════════════════════
# STATS (Admin/Agent only)
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/stats")
async def get_stats(request: Request):
    """Get directory statistics (admin/agent only)"""
    user = await get_current_user(request)
    
    if not _is_admin_or_agent(user):
        raise HTTPException(403, "Nur für Mitarbeiter")
    
    total_listings = await db.directory_listings.count_documents({"status": "active"})
    premium_listings = await db.directory_listings.count_documents({
        "is_premium": True,
        "premium_expires_at": {"$gt": datetime.now(timezone.utc).isoformat()}
    })
    
    # By category
    by_category = {}
    for cat in CATEGORIES:
        count = await db.directory_listings.count_documents({"category": cat["id"], "status": "active"})
        by_category[cat["id"]] = count
    
    # By country
    by_country = {}
    for country in COUNTRIES:
        count = await db.directory_listings.count_documents({"country_code": country["code"], "status": "active"})
        by_country[country["code"]] = count
    
    return {
        "total_listings": total_listings,
        "premium_listings": premium_listings,
        "free_listings": total_listings - premium_listings,
        "by_category": by_category,
        "by_country": by_country,
    }

# ══════════════════════════════════════════════════════════════════════════════
# FIELD AGENT MANAGEMENT (Admin only)
# ══════════════════════════════════════════════════════════════════════════════

class AgentCreate(BaseModel):
    name: str = Field(..., min_length=2)
    email: str
    password: str = Field(..., min_length=6)
    phone: str = ""
    assigned_countries: List[str] = []  # Country codes
    assigned_cities: List[str] = []
    commission_rate: float = Field(0.30, ge=0, le=1)  # 30% default

class AgentUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    assigned_countries: Optional[List[str]] = None
    assigned_cities: Optional[List[str]] = None
    commission_rate: Optional[float] = None
    is_active: Optional[bool] = None

@router.post("/admin/agents")
async def create_agent(req: AgentCreate, request: Request):
    """
    Create new field agent account (Admin only)
    """
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(403, "Nur Admins")
    
    # Check if email exists
    existing = await db.users.find_one({"email": req.email})
    if existing:
        raise HTTPException(400, "Email bereits vergeben")
    
    from passlib.hash import bcrypt
    
    agent = {
        "email": req.email,
        "name": req.name,
        "password": bcrypt.hash(req.password),
        "role": "field_agent",
        "phone": req.phone,
        "balance": 0.0,
        "assigned_countries": req.assigned_countries,
        "assigned_cities": req.assigned_cities,
        "commission_rate": req.commission_rate,
        "is_active": True,
        "total_listings_created": 0,
        "total_premium_sold": 0,
        "total_commission_earned": 0.0,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    
    await db.users.insert_one(agent)
    agent.pop("_id", None)
    agent.pop("password", None)
    
    return {"ok": True, "agent": agent, "message": f"Mitarbeiter {req.name} erstellt!"}

@router.get("/admin/agents")
async def get_agents(request: Request):
    """
    Get all field agents (Admin only)
    """
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(403, "Nur Admins")
    
    agents = await db.users.find(
        {"role": "field_agent"}, 
        {"_id": 0, "password": 0}
    ).sort("created_at", -1).to_list(100)
    
    return {"agents": agents}

@router.patch("/admin/agents/{agent_email}")
async def update_agent(agent_email: str, req: AgentUpdate, request: Request):
    """
    Update field agent (Admin only)
    """
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(403, "Nur Admins")
    
    update_data = {k: v for k, v in req.dict(exclude_unset=True).items() if v is not None}
    
    if not update_data:
        raise HTTPException(400, "Keine Änderungen")
    
    result = await db.users.update_one(
        {"email": agent_email, "role": "field_agent"},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(404, "Mitarbeiter nicht gefunden")
    
    return {"ok": True, "message": "Mitarbeiter aktualisiert"}

@router.delete("/admin/agents/{agent_email}")
async def delete_agent(agent_email: str, request: Request):
    """
    Delete field agent (Admin only)
    """
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(403, "Nur Admins")
    
    result = await db.users.delete_one({"email": agent_email, "role": "field_agent"})
    
    if result.deleted_count == 0:
        raise HTTPException(404, "Mitarbeiter nicht gefunden")
    
    return {"ok": True, "message": "Mitarbeiter gelöscht"}

# ══════════════════════════════════════════════════════════════════════════════
# AGENT PERFORMANCE DASHBOARD
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/agent/dashboard")
async def agent_dashboard(request: Request):
    """
    Get agent performance dashboard
    """
    user = await get_current_user(request)
    
    if user.get("role") != "field_agent":
        raise HTTPException(403, "Nur für Außendienstmitarbeiter")
    
    agent_email = user.get("email")
    
    # Total listings created by this agent
    total_created = await db.directory_listings.count_documents({
        "created_by": agent_email,
        "status": "active"
    })
    
    # Premium upgrades sold (from transactions)
    premium_sold = await db.directory_transactions.count_documents({
        "upgraded_by": agent_email
    })
    
    # Calculate commission earned
    transactions = await db.directory_transactions.find({
        "upgraded_by": agent_email
    }, {"_id": 0}).to_list(1000)
    
    commission_rate = user.get("commission_rate", 0.30)
    total_commission = sum(tx["price"] * commission_rate for tx in transactions)
    
    # Recent listings
    recent_listings = await db.directory_listings.find(
        {"created_by": agent_email, "status": "active"},
        {"_id": 0}
    ).sort("created_at", -1).limit(10).to_list(10)
    
    # Stats by category
    by_category = {}
    for cat in CATEGORIES:
        count = await db.directory_listings.count_documents({
            "created_by": agent_email,
            "category": cat["id"],
            "status": "active"
        })
        if count > 0:
            by_category[cat["id"]] = count
    
    # Stats by country
    by_country = {}
    for country in COUNTRIES:
        count = await db.directory_listings.count_documents({
            "created_by": agent_email,
            "country_code": country["code"],
            "status": "active"
        })
        if count > 0:
            by_country[country["code"]] = count
    
    # Today's stats
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0).isoformat()
    today_created = await db.directory_listings.count_documents({
        "created_by": agent_email,
        "created_at": {"$gte": today_start}
    })
    today_premium = await db.directory_transactions.count_documents({
        "upgraded_by": agent_email,
        "created_at": {"$gte": today_start}
    })
    
    # This month
    month_start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0).isoformat()
    month_created = await db.directory_listings.count_documents({
        "created_by": agent_email,
        "created_at": {"$gte": month_start}
    })
    month_premium = await db.directory_transactions.count_documents({
        "upgraded_by": agent_email,
        "created_at": {"$gte": month_start}
    })
    month_transactions = await db.directory_transactions.find({
        "upgraded_by": agent_email,
        "created_at": {"$gte": month_start}
    }, {"_id": 0}).to_list(1000)
    month_commission = sum(tx["price"] * commission_rate for tx in month_transactions)
    
    # Update user stats
    await db.users.update_one(
        {"email": agent_email},
        {"$set": {
            "total_listings_created": total_created,
            "total_premium_sold": premium_sold,
            "total_commission_earned": round(total_commission, 2),
        }}
    )
    
    return {
        "agent": {
            "name": user.get("name"),
            "email": agent_email,
            "commission_rate": commission_rate,
            "assigned_countries": user.get("assigned_countries", []),
            "assigned_cities": user.get("assigned_cities", []),
        },
        "stats": {
            "total_created": total_created,
            "premium_sold": premium_sold,
            "total_commission": round(total_commission, 2),
            "by_category": by_category,
            "by_country": by_country,
        },
        "today": {
            "created": today_created,
            "premium": today_premium,
        },
        "month": {
            "created": month_created,
            "premium": month_premium,
            "commission": round(month_commission, 2),
        },
        "recent_listings": recent_listings,
    }

@router.get("/agent/my-listings")
async def agent_my_listings(request: Request):
    """
    Get all listings created by this agent
    """
    user = await get_current_user(request)
    
    if user.get("role") != "field_agent":
        raise HTTPException(403, "Nur für Außendienstmitarbeiter")
    
    listings = await db.directory_listings.find(
        {"created_by": user.get("email"), "status": "active"},
        {"_id": 0}
    ).sort("created_at", -1).to_list(500)
    
    return {"listings": listings, "total": len(listings)}

# ══════════════════════════════════════════════════════════════════════════════
# COMMISSION PAYOUTS (Admin only)
# ══════════════════════════════════════════════════════════════════════════════

class CommissionPayout(BaseModel):
    agent_email: str
    amount: float
    note: str = ""

@router.post("/admin/commission/payout")
async def payout_commission(req: CommissionPayout, request: Request):
    """
    Payout commission to agent wallet (Admin only)
    """
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(403, "Nur Admins")
    
    agent = await db.users.find_one({"email": req.agent_email, "role": "field_agent"})
    if not agent:
        raise HTTPException(404, "Mitarbeiter nicht gefunden")
    
    # Add to agent wallet
    await db.users.update_one(
        {"email": req.agent_email},
        {"$inc": {"balance": req.amount}}
    )
    
    # Record payout
    await db.commission_payouts.insert_one({
        "payout_id": f"payout_{secrets.token_hex(8)}",
        "agent_email": req.agent_email,
        "agent_name": agent.get("name"),
        "amount": req.amount,
        "note": req.note,
        "paid_by": user.get("email"),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    
    return {"ok": True, "message": f"€{req.amount:.2f} an {agent.get('name')} ausgezahlt"}

@router.get("/admin/commission/history")
async def commission_history(request: Request):
    """
    Get commission payout history (Admin only)
    """
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(403, "Nur Admins")
    
    payouts = await db.commission_payouts.find(
        {}, {"_id": 0}
    ).sort("created_at", -1).limit(100).to_list(100)
    
    return {"payouts": payouts}
