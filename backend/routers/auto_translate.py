"""
Auto Translation Router - Automatic content translation using Emergent LLM
"""
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from datetime import datetime, timezone
from typing import Optional, List
from pydantic import BaseModel
import os
import json

from config import db, logger
from dependencies import get_admin_user

router = APIRouter(prefix="/auto-translate", tags=["Auto Translation"])

# Supported languages with their codes
SUPPORTED_LANGUAGES = {
    "de": "German",
    "en": "English", 
    "ar": "Arabic",
    "tr": "Turkish",
    "sq": "Albanian",
    "fr": "French",
    "es": "Spanish"
}

# ==================== SCHEMAS ====================

class TranslationRequest(BaseModel):
    text: str
    source_lang: str = "de"
    target_langs: List[str] = ["en", "ar", "tr", "sq"]

class ProductTranslationRequest(BaseModel):
    product_id: str
    fields: List[str] = ["name", "description"]
    target_langs: List[str] = ["en", "ar", "tr", "sq", "fr", "es"]

# ==================== HELPER FUNCTIONS ====================

async def translate_text_with_llm(text: str, source_lang: str, target_lang: str) -> str:
    """Translate text using Emergent LLM (GPT)"""
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        prompt = f"""Translate the following text from {SUPPORTED_LANGUAGES.get(source_lang, source_lang)} to {SUPPORTED_LANGUAGES.get(target_lang, target_lang)}.
Only return the translation, nothing else. Keep product names, brand names, and technical specifications unchanged.

Text to translate:
{text}"""
        
        # Use the new LlmChat API
        chat = LlmChat(
            api_key=os.environ.get("EMERGENT_LLM_KEY"),
            session_id=f"translate_{source_lang}_{target_lang}",
            system_message="You are a professional translator. Only output the translated text, nothing else."
        ).with_model("openai", "gpt-4o-mini")
        
        user_message = UserMessage(text=prompt)
        response = await chat.send_message(user_message)
        
        return response.strip() if response else text
    except Exception as e:
        logger.error(f"Translation error: {e}")
        return text  # Return original on error

async def translate_product_fields(product_id: str, fields: List[str], target_langs: List[str]):
    """Background task to translate product fields"""
    try:
        product = await db.products.find_one({"id": product_id}, {"_id": 0})
        if not product:
            logger.error(f"Product {product_id} not found for translation")
            return
        
        updates = {}
        
        for field in fields:
            original_text = product.get(field)
            if not original_text:
                continue
            
            # Get source language (assume German if no translations exist)
            source_lang = "de"
            
            # Create translations dict if not exists
            translations_key = f"{field}_translations"
            if translations_key not in updates:
                updates[translations_key] = product.get(translations_key, {})
            
            # Keep original German
            updates[translations_key]["de"] = original_text
            
            # Translate to each target language
            for target_lang in target_langs:
                if target_lang == source_lang:
                    continue
                
                translated = await translate_text_with_llm(original_text, source_lang, target_lang)
                updates[translations_key][target_lang] = translated
                logger.info(f"Translated {field} for {product_id} to {target_lang}")
        
        if updates:
            updates["translation_updated_at"] = datetime.now(timezone.utc).isoformat()
            await db.products.update_one({"id": product_id}, {"$set": updates})
            logger.info(f"Product {product_id} translations updated")
            
    except Exception as e:
        logger.error(f"Error translating product {product_id}: {e}")

# ==================== ENDPOINTS ====================

@router.post("/text")
async def translate_text(request: TranslationRequest, admin: dict = Depends(get_admin_user)):
    """Translate a single text to multiple languages"""
    translations = {request.source_lang: request.text}
    
    for target_lang in request.target_langs:
        if target_lang == request.source_lang:
            continue
        translated = await translate_text_with_llm(request.text, request.source_lang, target_lang)
        translations[target_lang] = translated
    
    return {"translations": translations}

@router.post("/product/{product_id}")
async def translate_product(
    product_id: str,
    background_tasks: BackgroundTasks,
    request: ProductTranslationRequest = None,
    admin: dict = Depends(get_admin_user)
):
    """Queue product for automatic translation"""
    product = await db.products.find_one({"id": product_id}, {"_id": 0, "name": 1})
    if not product:
        raise HTTPException(status_code=404, detail="Produkt nicht gefunden")
    
    fields = request.fields if request else ["name", "description"]
    target_langs = request.target_langs if request else ["en", "ar", "tr", "sq", "fr", "es"]
    
    # Queue translation in background
    background_tasks.add_task(translate_product_fields, product_id, fields, target_langs)
    
    return {
        "message": f"Übersetzung für '{product['name']}' gestartet",
        "product_id": product_id,
        "fields": fields,
        "target_languages": target_langs
    }

@router.post("/products/batch")
async def translate_products_batch(
    background_tasks: BackgroundTasks,
    category: Optional[str] = None,
    limit: int = 10,
    admin: dict = Depends(get_admin_user)
):
    """Batch translate products that are missing translations"""
    query = {}
    if category:
        query["category"] = category
    
    # Find products without translations
    products = await db.products.find(
        {**query, "name_translations": {"$exists": False}},
        {"_id": 0, "id": 1, "name": 1}
    ).limit(limit).to_list(limit)
    
    if not products:
        return {"message": "Keine Produkte ohne Übersetzungen gefunden", "count": 0}
    
    # Queue each product for translation
    for product in products:
        background_tasks.add_task(
            translate_product_fields, 
            product["id"], 
            ["name", "description"],
            ["en", "ar", "tr", "sq", "fr", "es"]
        )
    
    return {
        "message": f"{len(products)} Produkte zur Übersetzung hinzugefügt",
        "products": [p["name"] for p in products]
    }

@router.get("/status/{product_id}")
async def get_translation_status(product_id: str):
    """Check translation status for a product"""
    product = await db.products.find_one(
        {"id": product_id}, 
        {"_id": 0, "name": 1, "name_translations": 1, "description_translations": 1, "translation_updated_at": 1}
    )
    
    if not product:
        raise HTTPException(status_code=404, detail="Produkt nicht gefunden")
    
    name_langs = list(product.get("name_translations", {}).keys())
    desc_langs = list(product.get("description_translations", {}).keys())
    
    return {
        "product_name": product.get("name"),
        "name_translated_to": name_langs,
        "description_translated_to": desc_langs,
        "last_updated": product.get("translation_updated_at"),
        "is_complete": len(name_langs) >= 5
    }

@router.get("/languages")
async def get_supported_languages():
    """Get list of supported languages"""
    return {
        "languages": SUPPORTED_LANGUAGES,
        "default_source": "de",
        "default_targets": ["en", "ar", "tr", "sq", "fr", "es"]
    }

auto_translate_router = router
