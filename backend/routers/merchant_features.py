"""
Merchant Features Router - All features for retailers/wholesalers
Includes: Products, Coupons, Dashboard, Staff, Cashback, Loyalty, Referrals, etc.
"""

from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from config import db, logger
import uuid
import jwt
import os

router = APIRouter(prefix="/api/merchant", tags=["Merchant Features"])

JWT_SECRET = os.environ.get("JWT_SECRET", "your-secret-key-change-in-production")

# ==================== MODELS ====================

class ProductCreate(BaseModel):
    title: str
    description: str
    category: str
    start_price: float
    market_value: float
    image_url: Optional[str] = None
    auction_duration_hours: int = 24

class CouponCreate(BaseModel):
    code: str
    discount_percent: float
    discount_amount: Optional[float] = None
    min_purchase: float = 0
    max_uses: int = 100
    valid_days: int = 30
    description: Optional[str] = None

class StaffCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str = "cashier"  # cashier, manager, admin
    permissions: List[str] = ["topup", "payment"]

class PushNotification(BaseModel):
    title: str
    message: str
    target: str = "all"  # all, vip, recent

class MerchantReview(BaseModel):
    rating: int  # 1-5
    comment: Optional[str] = None

# ==================== AUTH HELPER ====================

async def get_merchant(authorization: Optional[str] = Header(None)):
    """Verify merchant token and return merchant data"""
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization required")
    
    try:
        token = authorization.replace("Bearer ", "")
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        merchant_id = payload.get("wholesale_id") or payload.get("merchant_id")
        
        merchant = await db.wholesale_customers.find_one({"id": merchant_id})
        if not merchant:
            raise HTTPException(status_code=404, detail="Merchant not found")
        
        return merchant
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except:
        raise HTTPException(status_code=401, detail="Invalid token")

# ==================== 1. EIGENE PRODUKTE/AUKTIONEN ====================

@router.post("/products")
async def create_merchant_product(product: ProductCreate, merchant = Depends(get_merchant)):
    """Händler erstellt eigenes Produkt für Auktion"""
    product_id = str(uuid.uuid4())
    auction_id = str(uuid.uuid4())
    
    now = datetime.now(timezone.utc)
    end_time = now + timedelta(hours=product.auction_duration_hours)
    
    # Produkt erstellen
    product_doc = {
        "id": product_id,
        "merchant_id": merchant["id"],
        "merchant_name": merchant.get("company_name", "Händler"),
        "title": product.title,
        "description": product.description,
        "category": product.category,
        "image": product.image_url or f"https://placehold.co/800x600/1e293b/94a3b8?text={product.title.replace(' ', '+')}",
        "start_price": product.start_price,
        "market_value": product.market_value,
        "created_at": now.isoformat(),
        "status": "pending_approval"  # Admin muss freigeben
    }
    
    await db.merchant_products.insert_one(product_doc)
    
    logger.info(f"Merchant {merchant['company_name']} created product: {product.title}")
    
    return {
        "success": True,
        "product_id": product_id,
        "message": "Produkt erstellt. Wartet auf Admin-Freigabe.",
        "revenue_share": "70% Händler, 30% BidBlitz"
    }

@router.get("/products")
async def get_merchant_products(merchant = Depends(get_merchant)):
    """Alle Produkte des Händlers abrufen"""
    products = await db.merchant_products.find(
        {"merchant_id": merchant["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return {"products": products, "count": len(products)}

@router.get("/products/stats")
async def get_product_stats(merchant = Depends(get_merchant)):
    """Statistiken zu Händler-Produkten"""
    pipeline = [
        {"$match": {"merchant_id": merchant["id"]}},
        {"$group": {
            "_id": "$status",
            "count": {"$sum": 1},
            "total_value": {"$sum": "$market_value"}
        }}
    ]
    
    stats = await db.merchant_products.aggregate(pipeline).to_list(10)
    
    # Verkaufsstatistiken
    sales = await db.merchant_sales.find(
        {"merchant_id": merchant["id"]},
        {"_id": 0}
    ).to_list(1000)
    
    total_revenue = sum(s.get("merchant_share", 0) for s in sales)
    total_sales = len(sales)
    
    return {
        "product_stats": stats,
        "total_revenue": total_revenue,
        "total_sales": total_sales,
        "pending_payout": total_revenue * 0.7  # 70% Anteil
    }

# ==================== 2. KUNDEN-GUTSCHEINE ====================

@router.post("/coupons")
async def create_coupon(coupon: CouponCreate, merchant = Depends(get_merchant)):
    """Händler erstellt Rabatt-Gutschein"""
    coupon_id = str(uuid.uuid4())
    
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(days=coupon.valid_days)
    
    coupon_doc = {
        "id": coupon_id,
        "merchant_id": merchant["id"],
        "merchant_name": merchant.get("company_name", "Händler"),
        "code": coupon.code.upper(),
        "discount_percent": coupon.discount_percent,
        "discount_amount": coupon.discount_amount,
        "min_purchase": coupon.min_purchase,
        "max_uses": coupon.max_uses,
        "used_count": 0,
        "description": coupon.description or f"{coupon.discount_percent}% Rabatt bei {merchant.get('company_name')}",
        "created_at": now.isoformat(),
        "expires_at": expires_at.isoformat(),
        "active": True
    }
    
    await db.merchant_coupons.insert_one(coupon_doc)
    
    return {
        "success": True,
        "coupon_id": coupon_id,
        "code": coupon.code.upper(),
        "expires_at": expires_at.isoformat()
    }

@router.get("/coupons")
async def get_merchant_coupons(merchant = Depends(get_merchant)):
    """Alle Gutscheine des Händlers"""
    coupons = await db.merchant_coupons.find(
        {"merchant_id": merchant["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return {"coupons": coupons}

@router.delete("/coupons/{coupon_id}")
async def delete_coupon(coupon_id: str, merchant = Depends(get_merchant)):
    """Gutschein deaktivieren"""
    result = await db.merchant_coupons.update_one(
        {"id": coupon_id, "merchant_id": merchant["id"]},
        {"$set": {"active": False}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Coupon not found")
    
    return {"success": True, "message": "Gutschein deaktiviert"}

# ==================== 3. FILIAL-DASHBOARD ====================

@router.get("/dashboard")
async def get_merchant_dashboard(merchant = Depends(get_merchant)):
    """Komplettes Dashboard mit allen Statistiken"""
    merchant_id = merchant["id"]
    now = datetime.now(timezone.utc)
    
    # Zeiträume
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=today_start.weekday())
    month_start = today_start.replace(day=1)
    
    # Transaktionen abrufen
    all_transactions = await db.pos_transactions.find({
        "$or": [
            {"merchant_id": merchant_id},
            {"branch_id": merchant_id},
            {"wholesale_id": merchant_id}
        ]
    }, {"_id": 0}).to_list(10000)
    
    # Statistiken berechnen
    def filter_by_date(txns, start_date):
        return [t for t in txns if t.get("created_at", "") >= start_date.isoformat()]
    
    today_txns = filter_by_date(all_transactions, today_start)
    week_txns = filter_by_date(all_transactions, week_start)
    month_txns = filter_by_date(all_transactions, month_start)
    
    def calc_stats(txns):
        total = sum(t.get("amount", 0) for t in txns)
        count = len(txns)
        topups = sum(1 for t in txns if t.get("type") == "topup")
        payments = sum(1 for t in txns if t.get("type") == "payment")
        return {"total": total, "count": count, "topups": topups, "payments": payments}
    
    # Kunden zählen
    unique_customers = set()
    for t in all_transactions:
        if t.get("customer_id"):
            unique_customers.add(t["customer_id"])
    
    # Beliebteste Produkte (falls Händler Produkte hat)
    top_products = await db.merchant_sales.aggregate([
        {"$match": {"merchant_id": merchant_id}},
        {"$group": {"_id": "$product_title", "sales": {"$sum": 1}, "revenue": {"$sum": "$amount"}}},
        {"$sort": {"sales": -1}},
        {"$limit": 5}
    ]).to_list(5)
    
    # Mitarbeiter-Aktivität
    staff_activity = await db.pos_transactions.aggregate([
        {"$match": {"merchant_id": merchant_id, "created_at": {"$gte": today_start.isoformat()}}},
        {"$group": {"_id": "$staff_name", "transactions": {"$sum": 1}, "total": {"$sum": "$amount"}}},
        {"$sort": {"transactions": -1}}
    ]).to_list(10)
    
    return {
        "merchant_name": merchant.get("company_name"),
        "today": calc_stats(today_txns),
        "this_week": calc_stats(week_txns),
        "this_month": calc_stats(month_txns),
        "all_time": calc_stats(all_transactions),
        "unique_customers": len(unique_customers),
        "top_products": top_products,
        "staff_activity": staff_activity,
        "discount_percent": merchant.get("discount_percent", 0),
        "credit_limit": merchant.get("credit_limit", 0),
        "credit_used": merchant.get("credit_used", 0)
    }

@router.get("/dashboard/export")
async def export_transactions(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    format: str = "json",
    merchant = Depends(get_merchant)
):
    """Transaktionen exportieren für Buchhaltung"""
    query = {
        "$or": [
            {"merchant_id": merchant["id"]},
            {"branch_id": merchant["id"]}
        ]
    }
    
    if start_date:
        query["created_at"] = {"$gte": start_date}
    if end_date:
        if "created_at" in query:
            query["created_at"]["$lte"] = end_date
        else:
            query["created_at"] = {"$lte": end_date}
    
    transactions = await db.pos_transactions.find(query, {"_id": 0}).to_list(10000)
    
    # Zusammenfassung
    total_topups = sum(t.get("amount", 0) for t in transactions if t.get("type") == "topup")
    total_payments = sum(t.get("amount", 0) for t in transactions if t.get("type") == "payment")
    
    return {
        "transactions": transactions,
        "summary": {
            "total_topups": total_topups,
            "total_payments": total_payments,
            "transaction_count": len(transactions),
            "export_date": datetime.now(timezone.utc).isoformat()
        }
    }

# ==================== 4. MITARBEITER-VERWALTUNG ====================

@router.post("/staff")
async def create_staff(staff: StaffCreate, merchant = Depends(get_merchant)):
    """Neuen Mitarbeiter anlegen"""
    import bcrypt
    
    staff_id = str(uuid.uuid4())
    counter_id = f"MA-{merchant['id'][:4].upper()}-{str(uuid.uuid4())[:4].upper()}"
    
    hashed_pw = bcrypt.hashpw(staff.password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    staff_doc = {
        "id": staff_id,
        "merchant_id": merchant["id"],
        "merchant_name": merchant.get("company_name"),
        "counter_id": counter_id,
        "name": staff.name,
        "email": staff.email,
        "password": hashed_pw,
        "role": staff.role,
        "permissions": staff.permissions,
        "active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "last_login": None,
        "total_transactions": 0
    }
    
    await db.merchant_staff.insert_one(staff_doc)
    
    return {
        "success": True,
        "staff_id": staff_id,
        "counter_id": counter_id,
        "message": f"Mitarbeiter {staff.name} angelegt. Login: {counter_id}"
    }

@router.get("/staff")
async def get_staff_list(merchant = Depends(get_merchant)):
    """Alle Mitarbeiter des Händlers"""
    staff = await db.merchant_staff.find(
        {"merchant_id": merchant["id"]},
        {"_id": 0, "password": 0}
    ).to_list(100)
    
    return {"staff": staff}

@router.put("/staff/{staff_id}")
async def update_staff(staff_id: str, active: bool, merchant = Depends(get_merchant)):
    """Mitarbeiter aktivieren/deaktivieren"""
    result = await db.merchant_staff.update_one(
        {"id": staff_id, "merchant_id": merchant["id"]},
        {"$set": {"active": active}}
    )
    
    return {"success": result.modified_count > 0}

@router.delete("/staff/{staff_id}")
async def delete_staff(staff_id: str, merchant = Depends(get_merchant)):
    """Mitarbeiter löschen"""
    result = await db.merchant_staff.delete_one({
        "id": staff_id,
        "merchant_id": merchant["id"]
    })
    
    return {"success": result.deleted_count > 0}

# ==================== 5. PROVISIONS-SYSTEM ====================

@router.get("/commissions")
async def get_commissions(merchant = Depends(get_merchant)):
    """Provisionen des Händlers anzeigen"""
    commissions = await db.merchant_commissions.find(
        {"merchant_id": merchant["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    total_earned = sum(c.get("amount", 0) for c in commissions)
    pending = sum(c.get("amount", 0) for c in commissions if c.get("status") == "pending")
    paid_out = sum(c.get("amount", 0) for c in commissions if c.get("status") == "paid")
    
    return {
        "commissions": commissions,
        "total_earned": total_earned,
        "pending_payout": pending,
        "paid_out": paid_out,
        "commission_rate": "5% auf Gebote-Käufe Ihrer Kunden"
    }

# ==================== 6. CASHBACK-SYSTEM ====================

@router.get("/cashback/settings")
async def get_cashback_settings(merchant = Depends(get_merchant)):
    """Cashback-Einstellungen des Händlers"""
    settings = await db.merchant_cashback.find_one(
        {"merchant_id": merchant["id"]},
        {"_id": 0}
    )
    
    if not settings:
        # Default settings
        settings = {
            "merchant_id": merchant["id"],
            "cashback_percent": 2.0,
            "min_purchase": 5.0,
            "max_cashback": 10.0,
            "active": True
        }
        await db.merchant_cashback.insert_one(settings)
    
    return settings

@router.put("/cashback/settings")
async def update_cashback_settings(
    cashback_percent: float = 2.0,
    min_purchase: float = 5.0,
    max_cashback: float = 10.0,
    active: bool = True,
    merchant = Depends(get_merchant)
):
    """Cashback-Einstellungen aktualisieren"""
    await db.merchant_cashback.update_one(
        {"merchant_id": merchant["id"]},
        {"$set": {
            "cashback_percent": cashback_percent,
            "min_purchase": min_purchase,
            "max_cashback": max_cashback,
            "active": active,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    
    return {"success": True, "message": f"Cashback auf {cashback_percent}% gesetzt"}

# ==================== 7. TREUE-PUNKTE ====================

@router.get("/loyalty/settings")
async def get_loyalty_settings(merchant = Depends(get_merchant)):
    """Treue-Punkte Einstellungen"""
    settings = await db.merchant_loyalty.find_one(
        {"merchant_id": merchant["id"]},
        {"_id": 0}
    )
    
    if not settings:
        settings = {
            "merchant_id": merchant["id"],
            "points_per_euro": 10,  # 10 Punkte pro Euro
            "redemption_rate": 100,  # 100 Punkte = 1€
            "active": True
        }
        await db.merchant_loyalty.insert_one(settings)
    
    return settings

@router.put("/loyalty/settings")
async def update_loyalty_settings(
    points_per_euro: int = 10,
    redemption_rate: int = 100,
    active: bool = True,
    merchant = Depends(get_merchant)
):
    """Treue-Punkte Einstellungen aktualisieren"""
    await db.merchant_loyalty.update_one(
        {"merchant_id": merchant["id"]},
        {"$set": {
            "points_per_euro": points_per_euro,
            "redemption_rate": redemption_rate,
            "active": active
        }},
        upsert=True
    )
    
    return {"success": True}

@router.get("/loyalty/customers")
async def get_customer_points(merchant = Depends(get_merchant)):
    """Kunden mit Treue-Punkten"""
    customers = await db.customer_loyalty.find(
        {"merchant_id": merchant["id"]},
        {"_id": 0}
    ).sort("points", -1).to_list(100)
    
    return {"customers": customers}

# ==================== 8. PUSH-BENACHRICHTIGUNGEN ====================

@router.post("/notifications/send")
async def send_push_notification(notification: PushNotification, merchant = Depends(get_merchant)):
    """Push-Benachrichtigung an Kunden senden"""
    notification_id = str(uuid.uuid4())
    
    # Zielgruppe bestimmen
    if notification.target == "all":
        # Alle Kunden die bei diesem Händler waren
        customers = await db.pos_transactions.distinct("customer_id", {
            "merchant_id": merchant["id"]
        })
    elif notification.target == "vip":
        # Nur VIP Kunden
        customers = await db.customer_loyalty.find(
            {"merchant_id": merchant["id"], "tier": {"$in": ["gold", "platinum"]}},
        ).distinct("customer_id")
    else:
        # Kürzliche Kunden (letzte 30 Tage)
        thirty_days_ago = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
        customers = await db.pos_transactions.distinct("customer_id", {
            "merchant_id": merchant["id"],
            "created_at": {"$gte": thirty_days_ago}
        })
    
    # Benachrichtigung speichern
    notif_doc = {
        "id": notification_id,
        "merchant_id": merchant["id"],
        "merchant_name": merchant.get("company_name"),
        "title": notification.title,
        "message": notification.message,
        "target": notification.target,
        "recipients": len(customers),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.merchant_notifications.insert_one(notif_doc)
    
    # Benachrichtigungen für jeden Kunden erstellen
    for customer_id in customers:
        await db.user_notifications.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": customer_id,
            "merchant_id": merchant["id"],
            "merchant_name": merchant.get("company_name"),
            "title": notification.title,
            "message": notification.message,
            "type": "merchant_promo",
            "read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    return {
        "success": True,
        "notification_id": notification_id,
        "recipients": len(customers),
        "message": f"Benachrichtigung an {len(customers)} Kunden gesendet"
    }

@router.get("/notifications")
async def get_sent_notifications(merchant = Depends(get_merchant)):
    """Gesendete Benachrichtigungen"""
    notifications = await db.merchant_notifications.find(
        {"merchant_id": merchant["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    return {"notifications": notifications}

# ==================== 9. HÄNDLER-PROFIL & STANDORT ====================

@router.put("/profile")
async def update_merchant_profile(
    company_name: Optional[str] = None,
    description: Optional[str] = None,
    address: Optional[str] = None,
    city: Optional[str] = None,
    postal_code: Optional[str] = None,
    phone: Optional[str] = None,
    website: Optional[str] = None,
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
    opening_hours: Optional[str] = None,
    logo_url: Optional[str] = None,
    merchant = Depends(get_merchant)
):
    """Händler-Profil aktualisieren"""
    update_data = {}
    
    if company_name: update_data["company_name"] = company_name
    if description: update_data["description"] = description
    if address: update_data["address"] = address
    if city: update_data["city"] = city
    if postal_code: update_data["postal_code"] = postal_code
    if phone: update_data["phone"] = phone
    if website: update_data["website"] = website
    if opening_hours: update_data["opening_hours"] = opening_hours
    if logo_url: update_data["logo_url"] = logo_url
    
    if latitude and longitude:
        update_data["location"] = {
            "type": "Point",
            "coordinates": [longitude, latitude]
        }
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.wholesale_customers.update_one(
        {"id": merchant["id"]},
        {"$set": update_data}
    )
    
    return {"success": True, "message": "Profil aktualisiert"}

@router.get("/profile")
async def get_merchant_profile(merchant = Depends(get_merchant)):
    """Händler-Profil abrufen"""
    profile = await db.wholesale_customers.find_one(
        {"id": merchant["id"]},
        {"_id": 0, "password": 0}
    )
    
    return profile

# ==================== 10. BEWERTUNGEN ====================

@router.get("/reviews")
async def get_merchant_reviews(merchant = Depends(get_merchant)):
    """Bewertungen des Händlers"""
    reviews = await db.merchant_reviews.find(
        {"merchant_id": merchant["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Durchschnitt berechnen
    if reviews:
        avg_rating = sum(r.get("rating", 0) for r in reviews) / len(reviews)
    else:
        avg_rating = 0
    
    return {
        "reviews": reviews,
        "average_rating": round(avg_rating, 1),
        "total_reviews": len(reviews)
    }

# ==================== KUNDEN-SEITIGE ENDPOINTS ====================

@router.get("/public/find")
async def find_merchants(
    lat: Optional[float] = None,
    lon: Optional[float] = None,
    city: Optional[str] = None,
    category: Optional[str] = None
):
    """Händler in der Nähe finden (öffentlich)"""
    query = {"status": "active"}
    
    if city:
        query["city"] = {"$regex": city, "$options": "i"}
    
    if category:
        query["category"] = category
    
    merchants = await db.wholesale_customers.find(
        query,
        {"_id": 0, "password": 0, "tax_id": 0}
    ).to_list(100)
    
    # Wenn Koordinaten gegeben, nach Entfernung sortieren
    if lat and lon:
        for m in merchants:
            loc = m.get("location", {}).get("coordinates", [0, 0])
            # Einfache Entfernungsberechnung
            m["distance_km"] = ((loc[0] - lon)**2 + (loc[1] - lat)**2)**0.5 * 111
        
        merchants.sort(key=lambda x: x.get("distance_km", 999))
    
    return {"merchants": merchants}

@router.post("/public/{merchant_id}/review")
async def submit_review(
    merchant_id: str,
    review: MerchantReview,
    authorization: Optional[str] = Header(None)
):
    """Bewertung für Händler abgeben"""
    # Verify user token
    if not authorization:
        raise HTTPException(status_code=401, detail="Login required")
    
    try:
        token = authorization.replace("Bearer ", "")
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        user_id = payload.get("user_id")
    except:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    # Prüfen ob User bei diesem Händler war
    transaction = await db.pos_transactions.find_one({
        "customer_id": user_id,
        "merchant_id": merchant_id
    })
    
    if not transaction:
        raise HTTPException(status_code=400, detail="Sie müssen erst bei diesem Händler einkaufen")
    
    review_doc = {
        "id": str(uuid.uuid4()),
        "merchant_id": merchant_id,
        "user_id": user_id,
        "rating": min(5, max(1, review.rating)),
        "comment": review.comment,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.merchant_reviews.insert_one(review_doc)
    
    return {"success": True, "message": "Bewertung gespeichert"}
