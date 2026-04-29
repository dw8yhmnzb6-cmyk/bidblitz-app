"""
BidBlitz V2 - Voice-Command-Parser
Nimmt einen deutschen Voice-Transcript und liefert eine strukturierte Multi-Step-Intent-Liste
zurück. Multi-Step heißt: ein Satz kann mehrere Aktionen verketten,
z.B. "Bestelle Pizza Margherita von Mario's und teile mit anna@example.com"
=> [{action:'search_food', query:'pizza margherita', restaurant_hint:"Mario's"},
    {action:'open_split_pay', emails:['anna@example.com']}]
"""
import json
import logging
import os
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from emergentintegrations.llm.chat import LlmChat, UserMessage

from routes.auth import get_current_user

router = APIRouter(prefix="/api/voice", tags=["Voice"])
logger = logging.getLogger("bidblitz.voice")

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

SYSTEM_PROMPT = """Du bist ein Intent-Parser für eine deutsche Super-App (Taxi, Scooter, Food).
Antworte NUR mit JSON-Array. KEIN Markdown, kein Text drumherum.

Erlaubte Actions:
- "book_taxi" {pickup_hint?, destination_hint?}
- "open_food" {}
- "search_food" {query: str, restaurant_hint?: str}
- "open_scooter" {}
- "open_wallet" {}
- "go_back" {}
- "open_split_pay" {emails: [str], service_type?: 'taxi'|'food'}
- "open_group_order" {emails: [str], service_type: 'food'|'taxi'|'scooter'}
- "open_loyalty" {}
- "open_safety" {}
- "schedule_taxi" {time_iso?: str, pickup_hint?: str}

Beispiele:
Eingabe: "Buche ein Taxi"
Ausgabe: [{"action":"book_taxi"}]

Eingabe: "Bestelle Pizza Margherita von Mario's und teile mit anna@example.com"
Ausgabe: [{"action":"search_food","query":"pizza margherita","restaurant_hint":"Mario's"},{"action":"open_split_pay","emails":["anna@example.com"],"service_type":"food"}]

Eingabe: "Punktestand"
Ausgabe: [{"action":"open_loyalty"}]

Eingabe: "Bringt mich nach Hause"
Ausgabe: [{"action":"book_taxi","destination_hint":"Zuhause"}]

Wenn du nicht sicher bist, gib leeres Array [] zurück.
"""


class VoiceParseRequest(BaseModel):
    transcript: str


@router.post("/parse")
async def voice_parse(req: VoiceParseRequest, user=Depends(get_current_user)):
    """Parse German voice transcript into structured intent array."""
    transcript = (req.transcript or "").strip()
    if not transcript:
        return {"intents": [], "raw": ""}

    if not EMERGENT_LLM_KEY:
        raise HTTPException(503, "LLM not configured")

    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"voice_{user['user_id']}",
            system_message=SYSTEM_PROMPT,
        ).with_model("gemini", "gemini-2.5-flash")

        msg = UserMessage(text=transcript)
        raw = await chat.send_message(msg)
        text = (raw or "").strip()

        # Strip code-fences if any
        if text.startswith("```"):
            text = text.strip("`")
            if text.lower().startswith("json"):
                text = text[4:].strip()

        intents = json.loads(text)
        if not isinstance(intents, list):
            intents = []
        # Filter to known actions only
        ALLOWED = {
            "book_taxi", "open_food", "search_food", "open_scooter", "open_wallet",
            "go_back", "open_split_pay", "open_group_order", "open_loyalty",
            "open_safety", "schedule_taxi",
        }
        intents = [i for i in intents if isinstance(i, dict) and i.get("action") in ALLOWED]
        return {"intents": intents, "raw": text}
    except json.JSONDecodeError as e:
        logger.warning("voice_parse json decode failed: %s | raw=%r", e, raw if 'raw' in locals() else None)
        return {"intents": [], "raw": str(raw) if 'raw' in locals() else "", "error": "invalid_json"}
    except Exception as e:
        logger.exception("voice_parse failed: %s", e)
        raise HTTPException(500, f"voice parse error: {e}")
