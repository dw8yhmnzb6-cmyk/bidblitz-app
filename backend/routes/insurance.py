"""
BidBlitz V2 - Insurance Marketplace
Versicherungen: Auto, Reise, Handy, Hausrat, Haftpflicht, Kranken, Leben, Tier
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional, List
from bson import ObjectId
from datetime import datetime, timezone
from core.database import db
from core.security import get_current_user
import secrets

router = APIRouter(prefix="/api/insurance", tags=["insurance"])

CASHBACK_RATE = 0.02


class InsuranceProduct(BaseModel):
    title: str
    category: str  # auto, travel, phone, household, liability, health, life, pet
    provider: str = ""
    description: str = ""
    coverage: str = ""
    monthly_price: float = Field(..., gt=0)
    yearly_price: float = 0
    deductible: float = 0
    features: List[str] = []
    image_url: str = ""


class InsurancePurchase(BaseModel):
    product_id: str
    billing: str = "monthly"  # monthly | yearly
    start_date: str = ""


CATEGORIES = [
    {"id": "auto", "label": "Kfz-Versicherung", "icon": "car"},
    {"id": "travel", "label": "Reiseversicherung", "icon": "plane"},
    {"id": "phone", "label": "Handyversicherung", "icon": "smartphone"},
    {"id": "household", "label": "Hausratversicherung", "icon": "home"},
    {"id": "liability", "label": "Haftpflicht", "icon": "shield"},
    {"id": "health", "label": "Krankenversicherung", "icon": "heart"},
    {"id": "life", "label": "Lebensversicherung", "icon": "umbrella"},
    {"id": "pet", "label": "Tierversicherung", "icon": "paw"},
]


@router.get("/categories")
async def get_categories():
    return {"categories": CATEGORIES}


@router.get("/products")
async def list_products(category: str = "", limit: int = 30):
    query = {"status": "active"}
    if category:
        query["category"] = category
    products = await db.insurance_products.find(query, {"_id": 0}).sort("monthly_price", 1).limit(limit).to_list(limit)
    return {"products": products, "count": len(products)}


@router.get("/products/{product_id}")
async def get_product(product_id: str):
    p = await db.insurance_products.find_one({"product_id": product_id}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Versicherung nicht gefunden")
    return p


@router.post("/products")
async def create_product(req: InsuranceProduct, request: Request):
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Nur Admins")
    now = datetime.now(timezone.utc).isoformat()
    pid = secrets.token_hex(8)
    doc = {
        "product_id": pid,
        "title": req.title,
        "category": req.category,
        "provider": req.provider,
        "description": req.description,
        "coverage": req.coverage,
        "monthly_price": req.monthly_price,
        "yearly_price": req.yearly_price or round(req.monthly_price * 10.8, 2),
        "deductible": req.deductible,
        "features": req.features,
        "image_url": req.image_url,
        "purchase_count": 0,
        "rating": 0,
        "status": "active",
        "created_at": now,
    }
    await db.insurance_products.insert_one(doc)
    doc.pop("_id", None)
    return {"ok": True, "product": doc}


@router.post("/purchase")
async def purchase_insurance(req: InsurancePurchase, request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])

    product = await db.insurance_products.find_one({"product_id": req.product_id, "status": "active"})
    if not product:
        raise HTTPException(status_code=404, detail="Produkt nicht gefunden")

    price = product["yearly_price"] if req.billing == "yearly" else product["monthly_price"]
    balance = user.get("balance", 0)
    if balance < price:
        raise HTTPException(status_code=400, detail=f"Nicht genug Guthaben. Benötigt: €{price:.2f}")

    result = await db.users.update_one(
        {"_id": user["_id"], "balance": {"$gte": price}},
        {"$inc": {"balance": -price}},
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=400, detail="Zahlung fehlgeschlagen")

    cashback = round(price * CASHBACK_RATE, 2)
    if cashback > 0:
        await db.users.update_one({"_id": user["_id"]}, {"$inc": {"balance": cashback}})

    now = datetime.now(timezone.utc).isoformat()
    policy_id = secrets.token_hex(8)
    ref = f"INS-{secrets.token_hex(4).upper()}"

    policy = {
        "policy_id": policy_id,
        "product_id": req.product_id,
        "product_title": product["title"],
        "category": product["category"],
        "provider": product.get("provider", ""),
        "user_id": user_id,
        "user_name": user.get("name", ""),
        "user_email": user.get("email", ""),
        "billing": req.billing,
        "price": price,
        "cashback": cashback,
        "deductible": product.get("deductible", 0),
        "start_date": req.start_date or now[:10],
        "status": "active",
        "reference": ref,
        "created_at": now,
    }
    await db.insurance_policies.insert_one(policy)
    policy.pop("_id", None)

    await db.insurance_products.update_one({"product_id": req.product_id}, {"$inc": {"purchase_count": 1}})

    await db.transactions.insert_one({
        "id": policy_id, "user_id": user_id, "type": "insurance",
        "amount": -price, "description": f"Versicherung: {product['title']} ({req.billing})",
        "status": "completed", "reference": ref, "category": "insurance", "created_at": now,
    })

    return {"ok": True, "policy": policy}


@router.get("/my-policies")
async def my_policies(request: Request):
    user = await get_current_user(request)
    policies = await db.insurance_policies.find(
        {"user_id": str(user["_id"])}, {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    return {"policies": policies}


@router.post("/cancel/{policy_id}")
async def cancel_policy(policy_id: str, request: Request):
    user = await get_current_user(request)
    p = await db.insurance_policies.find_one({"policy_id": policy_id})
    if not p or p["user_id"] != str(user["_id"]):
        raise HTTPException(status_code=403, detail="Nicht berechtigt")
    if p["status"] != "active":
        raise HTTPException(status_code=400, detail="Police bereits gekündigt")
    await db.insurance_policies.update_one({"policy_id": policy_id}, {"$set": {"status": "cancelled"}})
    return {"ok": True}
