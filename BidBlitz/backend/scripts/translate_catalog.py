"""
One-shot script: Translates product_catalog.json into DE/EN/SQ/TR via gpt-5.2
Run: python3 /app/backend/scripts/translate_catalog.py
"""
import os
import sys
import json
import asyncio
from pathlib import Path

sys.path.insert(0, "/app/backend")

from emergentintegrations.llm.chat import LlmChat, UserMessage
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY")
CATALOG_FILE = Path("/app/backend/data/product_catalog.json")

LANG_NAMES = {
    "de": "Deutsch",
    "en": "Englisch (English)",
    "sq": "Albanisch (Shqip)",
    "tr": "Türkisch (Türkçe)",
}


async def translate_item(item: dict) -> dict:
    """Translate one product into 4 languages. Returns translations dict."""
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"translate_{item['title'][:20]}",
        system_message=(
            "Du bist ein Profi-Übersetzer für E-Commerce-Produktbeschreibungen. "
            "Übersetze produkttreu, behalte Markennamen + Modellbezeichnungen unverändert "
            "(z.B. 'iPhone 17 Pro', 'MacBook Air M4'). "
            "Antworte AUSSCHLIESSLICH in JSON-Format."
        ),
    ).with_model("openai", "gpt-5.2")

    features_text = "\n".join(f"- {f}" for f in item.get("features", []))
    prompt = f"""Übersetze den folgenden Produkt-Eintrag in 4 Sprachen: Deutsch (de), Englisch (en), Albanisch (sq), Türkisch (tr).

PRODUKT:
Titel: {item['title']}
Beschreibung: {item['description']}
Features:
{features_text}

LIEFERE NUR DIESES JSON (keine Markdown, keine Erklärungen):
{{
  "de": {{"title": "...", "description": "...", "features": ["...", "..."]}},
  "en": {{"title": "...", "description": "...", "features": ["...", "..."]}},
  "sq": {{"title": "...", "description": "...", "features": ["...", "..."]}},
  "tr": {{"title": "...", "description": "...", "features": ["...", "..."]}}
}}

Markennamen + technische Modellbezeichnungen UNVERÄNDERT lassen.
"""

    reply = await chat.send_message(UserMessage(text=prompt))

    # Extract JSON
    import re
    match = re.search(r"\{[\s\S]*\}", reply)
    if not match:
        raise ValueError(f"No JSON in reply: {reply[:200]}")
    return json.loads(match.group(0))


async def main():
    catalog = json.loads(CATALOG_FILE.read_text(encoding="utf-8"))
    print(f"Translating {len(catalog)} products into 4 languages...\n")

    for i, item in enumerate(catalog):
        if "translations" in item and all(l in item["translations"] for l in LANG_NAMES):
            print(f"[{i+1}/{len(catalog)}] SKIP {item['title']} (already translated)")
            continue
        try:
            print(f"[{i+1}/{len(catalog)}] {item['title']} ...", end=" ", flush=True)
            translations = await translate_item(item)
            item["translations"] = translations
            print("✅")
            # Persist progress after each item (in case of crash)
            CATALOG_FILE.write_text(json.dumps(catalog, ensure_ascii=False, indent=2), encoding="utf-8")
        except Exception as e:
            print(f"❌ {e}")

    print(f"\n✅ DONE. {len(catalog)} products translated. Saved to {CATALOG_FILE}")


if __name__ == "__main__":
    asyncio.run(main())
