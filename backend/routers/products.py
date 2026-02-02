"""Products router - CRUD operations for products"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
from typing import List
import uuid

from config import db
from dependencies import get_admin_user
from schemas import ProductCreate, ProductUpdate

router = APIRouter(tags=["Products"])

# ==================== RESPONSE MODEL ====================

class ProductResponse:
    def __init__(self, **kwargs):
        for key, value in kwargs.items():
            setattr(self, key, value)

# ==================== PUBLIC ENDPOINTS ====================

@router.get("/products")
async def get_products():
    """Get all products"""
    products = await db.products.find({}, {"_id": 0}).to_list(100)
    return products

@router.get("/products/{product_id}")
async def get_product(product_id: str):
    """Get single product by ID"""
    product = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product

# ==================== ADMIN ENDPOINTS ====================

@router.post("/admin/products")
async def create_product(product: ProductCreate, admin: dict = Depends(get_admin_user)):
    """Create a new product (admin only)"""
    product_id = str(uuid.uuid4())
    doc = {
        "id": product_id,
        **product.model_dump(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.products.insert_one(doc)
    doc.pop("_id", None)  # Remove MongoDB _id before returning
    return doc

@router.put("/admin/products/{product_id}")
async def update_product(product_id: str, product: ProductUpdate, admin: dict = Depends(get_admin_user)):
    """Update a product (admin only)"""
    existing = await db.products.find_one({"id": product_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Product not found")
    
    updates = {k: v for k, v in product.model_dump().items() if v is not None}
    if updates:
        await db.products.update_one({"id": product_id}, {"$set": updates})
    
    updated = await db.products.find_one({"id": product_id}, {"_id": 0})
    return updated

@router.delete("/admin/products/{product_id}")
async def delete_product(product_id: str, admin: dict = Depends(get_admin_user)):
    """Delete a product (admin only)"""
    result = await db.products.delete_one({"id": product_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    return {"message": "Product deleted"}

# ==================== TRANSLATION ENDPOINTS ====================

@router.post("/admin/products/{product_id}/translate")
async def translate_product(product_id: str, target_languages: List[str] = None, admin: dict = Depends(get_admin_user)):
    """Translate product name and description to multiple languages using AI"""
    import os
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    
    product = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    api_key = os.getenv("EMERGENT_LLM_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="API Key nicht konfiguriert")
    
    # Default target languages if not specified
    if not target_languages:
        target_languages = ["en", "tr", "fr", "sq", "ar"]
    
    # Get current translations or initialize
    name_translations = product.get("name_translations", {"de": product["name"]})
    description_translations = product.get("description_translations", {"de": product["description"]})
    
    # Ensure German is set
    if "de" not in name_translations:
        name_translations["de"] = product["name"]
    if "de" not in description_translations:
        description_translations["de"] = product["description"]
    
    # Create translation prompt
    system_prompt = """Du bist ein professioneller Übersetzer für E-Commerce-Produktbeschreibungen.
Übersetze den gegebenen deutschen Produktnamen und die Beschreibung in die angeforderten Sprachen.
Antworte NUR mit einem JSON-Objekt im Format:
{
  "name_translations": {"en": "...", "tr": "...", ...},
  "description_translations": {"en": "...", "tr": "...", ...}
}
Halte die Übersetzungen präzise, ansprechend und für Online-Shopping geeignet."""
    
    chat = LlmChat(
        api_key=api_key,
        session_id=f"translate-{product_id}",
        system_message=system_prompt
    ).with_model("openai", "gpt-4o-mini")
    
    user_prompt = f"""Übersetze folgendes Produkt in diese Sprachen: {', '.join(target_languages)}

Produktname (DE): {product['name']}
Beschreibung (DE): {product['description']}

Sprachcodes:
- en = Englisch
- tr = Türkisch
- fr = Französisch
- sq = Albanisch
- ar = Arabisch"""
    
    try:
        response = await chat.send_message(UserMessage(text=user_prompt))
        
        # Parse response
        import json
        response_text = response.strip()
        if response_text.startswith("```"):
            response_text = response_text.split("```")[1]
            if response_text.startswith("json"):
                response_text = response_text[4:]
        response_text = response_text.strip()
        
        translations = json.loads(response_text)
        
        # Merge with existing translations
        name_translations.update(translations.get("name_translations", {}))
        description_translations.update(translations.get("description_translations", {}))
        
        # Update product in database
        await db.products.update_one(
            {"id": product_id},
            {"$set": {
                "name_translations": name_translations,
                "description_translations": description_translations
            }}
        )
        
        updated_product = await db.products.find_one({"id": product_id}, {"_id": 0})
        return {
            "success": True,
            "message": f"Produkt in {len(target_languages)} Sprachen übersetzt",
            "product": updated_product
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Übersetzungsfehler: {str(e)}")

@router.post("/admin/products/translate-all")
async def translate_all_products(target_languages: List[str] = None, admin: dict = Depends(get_admin_user)):
    """Translate all products to multiple languages"""
    products = await db.products.find({}, {"_id": 0, "id": 1}).to_list(1000)
    
    if not target_languages:
        target_languages = ["en", "tr", "fr"]
    
    translated_count = 0
    errors = []
    
    for product in products:
        try:
            # Check if already translated
            full_product = await db.products.find_one({"id": product["id"]}, {"_id": 0})
            existing_translations = full_product.get("name_translations", {})
            
            # Skip if already has all requested translations
            if all(lang in existing_translations for lang in target_languages):
                continue
            
            # Translate
            await translate_product(product["id"], target_languages, admin)
            translated_count += 1
            
        except Exception as e:
            errors.append({"id": product["id"], "error": str(e)})
    
    return {
        "success": True,
        "message": f"{translated_count} Produkte übersetzt",
        "errors": errors if errors else None
    }

