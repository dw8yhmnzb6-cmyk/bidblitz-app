"""
Rabattkarten-System / Discount Cards System
- Admin erstellt globale Rabattkarten
- Artikel-/Kategorie-spezifische Rabatte
- Automatische Erkennung beim Bezahlen im StaffPOS
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
from config import db, get_current_user
import uuid
import logging

router = APIRouter(prefix="/discount-cards", tags=["Discount Cards"])
logger = logging.getLogger(__name__)

# ==================== MODELS ====================

class DiscountCardCreate(BaseModel):
    name: str  # z.B. "EDEKA VIP", "Sommer-Rabatt"
    description: Optional[str] = None
    discount_type: str  # "percentage" oder "fixed"
    discount_value: float  # z.B. 10 (für 10%) oder 5.00 (für €5)
    categories: Optional[List[str]] = None  # z.B. ["Lebensmittel", "Getränke"]
    min_purchase: Optional[float] = 0  # Mindestbestellwert
    max_discount: Optional[float] = None  # Maximaler Rabatt in €
    valid_from: Optional[str] = None
    valid_until: Optional[str] = None
    is_active: bool = True
    applies_to_all: bool = True  # Gilt für alle Kunden
    specific_customers: Optional[List[str]] = None  # Spezifische Kunden-IDs
    specific_branches: Optional[List[str]] = None  # Spezifische Filialen

class DiscountCardUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    discount_type: Optional[str] = None
    discount_value: Optional[float] = None
    categories: Optional[List[str]] = None
    min_purchase: Optional[float] = None
    max_discount: Optional[float] = None
    valid_from: Optional[str] = None
    valid_until: Optional[str] = None
    is_active: Optional[bool] = None
    applies_to_all: Optional[bool] = None
    specific_customers: Optional[List[str]] = None
    specific_branches: Optional[List[str]] = None

class CustomerDiscountCardAssign(BaseModel):
    customer_id: str
    discount_card_id: str

# ==================== ADMIN ENDPOINTS ====================

@router.post("/admin/create")
async def create_discount_card(data: DiscountCardCreate, user: dict = Depends(get_current_user)):
    """Admin erstellt eine neue Rabattkarte"""
    if user.get("role") not in ["admin", "enterprise_admin"]:
        raise HTTPException(status_code=403, detail="Nur Admins können Rabattkarten erstellen")
    
    card = {
        "id": str(uuid.uuid4()),
        "name": data.name,
        "description": data.description,
        "discount_type": data.discount_type,
        "discount_value": data.discount_value,
        "categories": data.categories or [],
        "min_purchase": data.min_purchase or 0,
        "max_discount": data.max_discount,
        "valid_from": data.valid_from,
        "valid_until": data.valid_until,
        "is_active": data.is_active,
        "applies_to_all": data.applies_to_all,
        "specific_customers": data.specific_customers or [],
        "specific_branches": data.specific_branches or [],
        "created_by": user["id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "usage_count": 0,
        "total_discount_given": 0.0
    }
    
    await db.discount_cards.insert_one(card)
    logger.info(f"Rabattkarte erstellt: {card['name']} von Admin {user.get('email')}")
    
    return {"success": True, "card": card}

@router.get("/admin/list")
async def list_discount_cards(user: dict = Depends(get_current_user)):
    """Liste aller Rabattkarten für Admin"""
    if user.get("role") not in ["admin", "enterprise_admin"]:
        raise HTTPException(status_code=403, detail="Nur Admins")
    
    cards = await db.discount_cards.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return {"cards": cards, "total": len(cards)}

@router.put("/admin/{card_id}")
async def update_discount_card(card_id: str, data: DiscountCardUpdate, user: dict = Depends(get_current_user)):
    """Admin aktualisiert eine Rabattkarte"""
    if user.get("role") not in ["admin", "enterprise_admin"]:
        raise HTTPException(status_code=403, detail="Nur Admins")
    
    update_data = {k: v for k, v in data.dict().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.discount_cards.update_one(
        {"id": card_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Rabattkarte nicht gefunden")
    
    return {"success": True, "message": "Rabattkarte aktualisiert"}

@router.delete("/admin/{card_id}")
async def delete_discount_card(card_id: str, user: dict = Depends(get_current_user)):
    """Admin löscht eine Rabattkarte"""
    if user.get("role") not in ["admin", "enterprise_admin"]:
        raise HTTPException(status_code=403, detail="Nur Admins")
    
    result = await db.discount_cards.delete_one({"id": card_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Rabattkarte nicht gefunden")
    
    return {"success": True, "message": "Rabattkarte gelöscht"}

# ==================== CUSTOMER ENDPOINTS ====================

@router.get("/my-cards")
async def get_my_discount_cards(user: dict = Depends(get_current_user)):
    """Kunde sieht seine aktiven Rabattkarten"""
    user_id = user["id"]
    now = datetime.now(timezone.utc).isoformat()
    
    # Finde alle aktiven Karten die für diesen Kunden gelten
    cards = await db.discount_cards.find({
        "is_active": True,
        "$or": [
            {"applies_to_all": True},
            {"specific_customers": user_id}
        ],
        "$or": [
            {"valid_until": None},
            {"valid_until": {"$gte": now}}
        ]
    }, {"_id": 0}).to_list(50)
    
    # Auch persönlich zugewiesene Karten
    assigned = await db.customer_discount_cards.find({
        "customer_id": user_id,
        "is_active": True
    }, {"_id": 0}).to_list(50)
    
    assigned_card_ids = [a["discount_card_id"] for a in assigned]
    
    # Kombiniere alle Karten
    all_cards = []
    seen_ids = set()
    
    for card in cards:
        if card["id"] not in seen_ids:
            all_cards.append(card)
            seen_ids.add(card["id"])
    
    # Füge zugewiesene Karten hinzu
    if assigned_card_ids:
        extra_cards = await db.discount_cards.find({
            "id": {"$in": assigned_card_ids},
            "is_active": True
        }, {"_id": 0}).to_list(50)
        
        for card in extra_cards:
            if card["id"] not in seen_ids:
                all_cards.append(card)
                seen_ids.add(card["id"])
    
    return {"cards": all_cards, "total": len(all_cards)}

@router.post("/assign")
async def assign_card_to_customer(data: CustomerDiscountCardAssign, user: dict = Depends(get_current_user)):
    """Admin weist einem Kunden eine Rabattkarte zu"""
    if user.get("role") not in ["admin", "enterprise_admin", "staff"]:
        raise HTTPException(status_code=403, detail="Keine Berechtigung")
    
    # Prüfe ob Karte existiert
    card = await db.discount_cards.find_one({"id": data.discount_card_id})
    if not card:
        raise HTTPException(status_code=404, detail="Rabattkarte nicht gefunden")
    
    # Prüfe ob bereits zugewiesen
    existing = await db.customer_discount_cards.find_one({
        "customer_id": data.customer_id,
        "discount_card_id": data.discount_card_id
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Karte bereits zugewiesen")
    
    assignment = {
        "id": str(uuid.uuid4()),
        "customer_id": data.customer_id,
        "discount_card_id": data.discount_card_id,
        "assigned_by": user["id"],
        "assigned_at": datetime.now(timezone.utc).isoformat(),
        "is_active": True
    }
    
    await db.customer_discount_cards.insert_one(assignment)
    
    return {"success": True, "message": "Rabattkarte zugewiesen"}

# ==================== CALCULATION ENDPOINT (für StaffPOS) ====================

@router.post("/calculate")
async def calculate_discount(
    customer_id: str,
    amount: float,
    category: Optional[str] = None,
    branch_id: Optional[str] = None
):
    """
    Berechnet den Rabatt für einen Kunden
    Wird vom StaffPOS aufgerufen vor der Zahlung
    """
    now = datetime.now(timezone.utc).isoformat()
    
    # Finde alle aktiven Rabattkarten für diesen Kunden
    query = {
        "is_active": True,
        "$or": [
            {"applies_to_all": True},
            {"specific_customers": customer_id}
        ]
    }
    
    cards = await db.discount_cards.find(query, {"_id": 0}).to_list(50)
    
    # Auch persönlich zugewiesene Karten
    assigned = await db.customer_discount_cards.find({
        "customer_id": customer_id,
        "is_active": True
    }).to_list(50)
    
    assigned_card_ids = [a["discount_card_id"] for a in assigned]
    
    if assigned_card_ids:
        extra_cards = await db.discount_cards.find({
            "id": {"$in": assigned_card_ids},
            "is_active": True
        }, {"_id": 0}).to_list(50)
        cards.extend(extra_cards)
    
    # Entferne Duplikate
    seen_ids = set()
    unique_cards = []
    for card in cards:
        if card["id"] not in seen_ids:
            unique_cards.append(card)
            seen_ids.add(card["id"])
    
    # Finde den besten Rabatt
    best_discount = 0.0
    best_card = None
    
    for card in unique_cards:
        # Prüfe Gültigkeit
        if card.get("valid_from") and card["valid_from"] > now:
            continue
        if card.get("valid_until") and card["valid_until"] < now:
            continue
        
        # Prüfe Mindestbestellwert
        if card.get("min_purchase", 0) > amount:
            continue
        
        # Prüfe Filiale
        if card.get("specific_branches") and branch_id:
            if branch_id not in card["specific_branches"]:
                continue
        
        # Prüfe Kategorie
        if card.get("categories") and category:
            if category not in card["categories"]:
                continue
        
        # Berechne Rabatt
        if card["discount_type"] == "percentage":
            discount = amount * (card["discount_value"] / 100)
        else:  # fixed
            discount = card["discount_value"]
        
        # Maximalen Rabatt begrenzen
        if card.get("max_discount"):
            discount = min(discount, card["max_discount"])
        
        # Rabatt kann nicht höher sein als der Betrag
        discount = min(discount, amount)
        
        if discount > best_discount:
            best_discount = discount
            best_card = card
    
    result = {
        "original_amount": amount,
        "discount_amount": round(best_discount, 2),
        "final_amount": round(amount - best_discount, 2),
        "discount_card": best_card,
        "has_discount": best_discount > 0
    }
    
    logger.info(f"Rabatt berechnet für Kunde {customer_id}: €{best_discount:.2f} (Karte: {best_card['name'] if best_card else 'Keine'})")
    
    return result

@router.post("/apply")
async def apply_discount(
    customer_id: str,
    card_id: str,
    amount: float,
    discount_amount: float,
    transaction_id: Optional[str] = None
):
    """
    Wendet einen Rabatt an und protokolliert die Nutzung
    Wird nach erfolgreicher Zahlung aufgerufen
    """
    # Aktualisiere Statistiken der Karte
    await db.discount_cards.update_one(
        {"id": card_id},
        {
            "$inc": {
                "usage_count": 1,
                "total_discount_given": discount_amount
            }
        }
    )
    
    # Protokolliere Nutzung
    usage = {
        "id": str(uuid.uuid4()),
        "customer_id": customer_id,
        "card_id": card_id,
        "original_amount": amount,
        "discount_amount": discount_amount,
        "final_amount": amount - discount_amount,
        "transaction_id": transaction_id,
        "used_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.discount_card_usage.insert_one(usage)
    
    return {"success": True, "usage_id": usage["id"]}

# ==================== PUBLIC ENDPOINTS ====================

@router.get("/active")
async def get_active_discount_cards():
    """Öffentliche Liste aktiver Rabattkarten (für Marketing)"""
    now = datetime.now(timezone.utc).isoformat()
    
    cards = await db.discount_cards.find({
        "is_active": True,
        "applies_to_all": True,
        "$or": [
            {"valid_until": None},
            {"valid_until": {"$gte": now}}
        ]
    }, {
        "_id": 0,
        "id": 1,
        "name": 1,
        "description": 1,
        "discount_type": 1,
        "discount_value": 1,
        "categories": 1,
        "min_purchase": 1,
        "valid_until": 1
    }).to_list(20)
    
    return {"cards": cards}
