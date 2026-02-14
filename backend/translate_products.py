"""
Product Translation Script
Translates all product names and descriptions to multiple languages using AI
"""
import asyncio
import os
from dotenv import load_dotenv

load_dotenv()

# MongoDB connection
from motor.motor_asyncio import AsyncIOMotorClient

MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME", "bidblitz")

# Emergent LLM Integration
from emergentintegrations.llm.chat import LlmChat, UserMessage

EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY", "sk-emergent-8AbDaF677837231285")

# Target languages
TARGET_LANGUAGES = {
    "en": "English",
    "sq": "Albanian", 
    "tr": "Turkish",
    "fr": "French",
    "es": "Spanish",
    "ar": "Arabic",
    "it": "Italian",
    "pt": "Portuguese",
    "nl": "Dutch",
    "pl": "Polish"
}

async def translate_text(text: str, target_lang: str, target_lang_name: str) -> str:
    """Translate text to target language using GPT"""
    if not text or not text.strip():
        return text
    
    chat = LlmChat(
        api_key=EMERGENT_KEY,
        session_id=f"translate-{target_lang}",
        system_message=f"""You are a professional translator. Translate the given German text to {target_lang_name}.
Rules:
- Keep product names (brands, model numbers) unchanged
- Keep emojis unchanged
- Only return the translated text, nothing else
- Keep the same tone and style
- If text is very short (1-3 words), still translate it appropriately"""
    ).with_model("openai", "gpt-4o")
    
    user_message = UserMessage(text=f"Translate to {target_lang_name}: {text}")
    
    try:
        response = await chat.send_message(user_message)
        return response.strip()
    except Exception as e:
        print(f"  ⚠️ Translation error for {target_lang}: {e}")
        return text  # Return original if translation fails

async def translate_product(product: dict) -> dict:
    """Translate a single product's name and description"""
    product_id = product.get("id", "unknown")
    name = product.get("name", "")
    description = product.get("description", "")
    
    print(f"\n📦 Translating: {name[:50]}...")
    
    # Get existing translations or create empty dicts
    name_translations = product.get("name_translations", {}) or {}
    description_translations = product.get("description_translations", {}) or {}
    
    # Always keep German as the base
    name_translations["de"] = name
    if description:
        description_translations["de"] = description
    
    # Translate to each target language
    for lang_code, lang_name in TARGET_LANGUAGES.items():
        # Skip if already translated
        if lang_code in name_translations and name_translations[lang_code]:
            print(f"  ✓ {lang_name} already exists, skipping...")
            continue
        
        print(f"  → Translating to {lang_name}...")
        
        # Translate name
        if name:
            translated_name = await translate_text(name, lang_code, lang_name)
            name_translations[lang_code] = translated_name
        
        # Translate description
        if description:
            translated_desc = await translate_text(description, lang_code, lang_name)
            description_translations[lang_code] = translated_desc
        
        # Small delay to avoid rate limits
        await asyncio.sleep(0.5)
    
    return {
        "name_translations": name_translations,
        "description_translations": description_translations
    }

async def main():
    """Main function to translate all products"""
    print("🌍 Starting Product Translation Script")
    print(f"📊 Target languages: {', '.join(TARGET_LANGUAGES.values())}")
    print("-" * 50)
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    # Get all products
    products = await db.products.find({}, {"_id": 0}).to_list(1000)
    print(f"\n📦 Found {len(products)} products to translate")
    
    translated_count = 0
    error_count = 0
    
    for i, product in enumerate(products, 1):
        product_id = product.get("id")
        if not product_id:
            continue
        
        print(f"\n[{i}/{len(products)}]", end="")
        
        try:
            translations = await translate_product(product)
            
            # Update product in database
            await db.products.update_one(
                {"id": product_id},
                {"$set": {
                    "name_translations": translations["name_translations"],
                    "description_translations": translations["description_translations"]
                }}
            )
            
            translated_count += 1
            print(f"  ✅ Updated in database")
            
        except Exception as e:
            print(f"  ❌ Error: {e}")
            error_count += 1
    
    print("\n" + "=" * 50)
    print(f"✅ Translation complete!")
    print(f"   Translated: {translated_count} products")
    print(f"   Errors: {error_count}")
    print("=" * 50)
    
    client.close()

if __name__ == "__main__":
    asyncio.run(main())
