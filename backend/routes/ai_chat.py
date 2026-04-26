"""
BidBlitz V2 - AI Chatbot, Content Generator & Smart Recommendations
Powered by Emergent LLM Key (gpt-5.2)
"""
import os
import secrets
import logging
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from emergentintegrations.llm.chat import LlmChat, UserMessage
from dotenv import load_dotenv

from core.database import db
from core.security import get_current_user

load_dotenv()
logger = logging.getLogger("bidblitz.ai")

router = APIRouter(prefix="/api/ai", tags=["ai"])

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
DEFAULT_MODEL = ("openai", "gpt-5.2")


# ═══════════════════════════════════════════════════════════════════════════════
# 1. AI CHATBOT — Multi-turn Customer Support (German)
# ═══════════════════════════════════════════════════════════════════════════════

CHATBOT_SYSTEM_PROMPT = """Du bist der freundliche AI-Assistent von BidBlitz, einer All-in-One Super-App für:
- Zahlungen, Wallet, BLZ-Token, Mining
- Auktionen & Lotterie mit echten Sachpreisen (iPhone, MacBook, Gutscheine)
- Lokales Verzeichnis (Restaurants, Ärzte, Handwerker, Hotels)
- Buchungen & Reservierungen
- Werbekampagnen für Händler
- Taxi, Flüge, Streaming, Telemedizin

Antworte IMMER auf Deutsch, kurz und präzise (max. 3 Sätze, außer der Nutzer fragt nach Details).
Sei freundlich, höflich und hilfsbereit. Wenn du etwas nicht weißt, sage es ehrlich und schlage vor,
den Support unter support@bidblitz.com zu kontaktieren."""


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    session_id: Optional[str] = None


class ChatResponse(BaseModel):
    response: str
    session_id: str


@router.post("/chat", response_model=ChatResponse)
async def ai_chat(req: ChatRequest, request: Request):
    """Multi-turn AI Chat with persistent session history."""
    user = await get_current_user(request)
    user_email = user.get("email", "guest")

    if not EMERGENT_LLM_KEY:
        raise HTTPException(503, "AI service nicht konfiguriert")

    session_id = req.session_id or f"chat_{secrets.token_hex(8)}"

    # Load history (last 20 messages) for context window
    history_doc = await db.ai_chat_sessions.find_one({"session_id": session_id}, {"_id": 0})
    history = (history_doc or {}).get("messages", [])

    # Build LlmChat instance fresh per session (per playbook)
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=session_id,
        system_message=CHATBOT_SYSTEM_PROMPT,
    ).with_model(*DEFAULT_MODEL)

    # Replay last N user/assistant turns into the chat instance
    for m in history[-10:]:
        if m["role"] == "user":
            try:
                await chat.send_message(UserMessage(text=m["content"]))
            except Exception:
                pass

    # Send the new message
    try:
        reply = await chat.send_message(UserMessage(text=req.message))
    except Exception:
        logger.exception("AI chat failed")
        raise HTTPException(502, "KI-Service nicht erreichbar")

    # Persist new turns
    now = datetime.now(timezone.utc).isoformat()
    new_messages = history + [
        {"role": "user", "content": req.message, "ts": now},
        {"role": "assistant", "content": reply, "ts": now},
    ]
    await db.ai_chat_sessions.update_one(
        {"session_id": session_id},
        {
            "$set": {
                "session_id": session_id,
                "user_email": user_email,
                "messages": new_messages[-30:],  # cap stored history
                "updated_at": now,
            },
            "$setOnInsert": {"created_at": now},
        },
        upsert=True,
    )

    return ChatResponse(response=reply, session_id=session_id)


@router.get("/chat/history")
async def chat_history(request: Request, session_id: Optional[str] = None):
    """Return last session messages or list of recent sessions."""
    user = await get_current_user(request)
    if session_id:
        doc = await db.ai_chat_sessions.find_one({"session_id": session_id}, {"_id": 0})
        return doc or {"session_id": session_id, "messages": []}
    cursor = db.ai_chat_sessions.find(
        {"user_email": user.get("email")}, {"_id": 0, "messages": 0}
    ).sort("updated_at", -1).limit(10)
    sessions = await cursor.to_list(10)
    return {"sessions": sessions}


@router.delete("/chat/{session_id}")
async def clear_chat(session_id: str, request: Request):
    """Delete chat session."""
    user = await get_current_user(request)
    await db.ai_chat_sessions.delete_one({"session_id": session_id, "user_email": user.get("email")})
    return {"ok": True}


# ═══════════════════════════════════════════════════════════════════════════════
# 2. AI CONTENT GENERATOR — Listings & Ad Copy
# ═══════════════════════════════════════════════════════════════════════════════

class ContentGenRequest(BaseModel):
    content_type: str = Field(pattern="^(listing|ad_headline|ad_body|email|push)$")
    business_name: str = Field(min_length=1, max_length=100)
    category: Optional[str] = None
    keywords: Optional[List[str]] = None
    tone: Optional[str] = Field(default="professional", pattern="^(professional|casual|playful|urgent)$")
    language: Optional[str] = Field(default="de", pattern="^(de|en|sq|tr)$")
    target_length: Optional[int] = Field(default=120, ge=20, le=800)


class ContentGenResponse(BaseModel):
    text: str
    variations: List[str]


CONTENT_PROMPTS = {
    "listing": "eine professionelle, ansprechende Beschreibung für ein Verzeichnis-Eintrag",
    "ad_headline": "eine kurze, aufmerksamkeitsstarke Werbeüberschrift (max. 60 Zeichen)",
    "ad_body": "einen überzeugenden Werbetext für eine Anzeige",
    "email": "einen Marketing-Email-Text mit Betreff und Inhalt",
    "push": "eine kurze, klickstarke Push-Benachrichtigung (max. 80 Zeichen)",
}

LANGUAGE_NAMES = {"de": "Deutsch", "en": "English", "sq": "Shqip", "tr": "Türkçe"}


@router.post("/content/generate", response_model=ContentGenResponse)
async def generate_content(req: ContentGenRequest, request: Request):
    """Generate marketing content using LLM. Returns 3 variations."""
    await get_current_user(request)

    if not EMERGENT_LLM_KEY:
        raise HTTPException(503, "AI service nicht konfiguriert")

    description = CONTENT_PROMPTS.get(req.content_type, "einen Marketing-Text")
    lang = LANGUAGE_NAMES.get(req.language or "de", "Deutsch")
    keywords = ", ".join(req.keywords or [])

    system = (
        f"Du bist ein erstklassiger Werbetexter. Schreibe {description} "
        f"in {lang}. Tonalität: {req.tone}. "
        f"Liefere GENAU 3 unterschiedliche Varianten, getrennt durch '|||'. "
        f"Jede Variante max. {req.target_length} Zeichen, KEINE Aufzählungen, "
        f"KEINE Markdown, NUR den Text."
    )

    prompt = (
        f"Geschäft: {req.business_name}\n"
        f"Kategorie: {req.category or 'nicht angegeben'}\n"
        f"Keywords: {keywords or 'keine'}\n\n"
        f"Schreibe jetzt 3 Varianten."
    )

    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"content_{secrets.token_hex(6)}",
        system_message=system,
    ).with_model(*DEFAULT_MODEL)

    try:
        reply = await chat.send_message(UserMessage(text=prompt))
    except Exception:
        logger.exception("Content gen failed")
        raise HTTPException(502, "KI-Service nicht erreichbar")

    parts = [p.strip().strip('"').strip() for p in reply.split("|||") if p.strip()]
    if not parts:
        parts = [reply.strip()]
    while len(parts) < 3:
        parts.append(parts[-1])

    return ContentGenResponse(text=parts[0], variations=parts[:3])


# ═══════════════════════════════════════════════════════════════════════════════
# 3. SMART RECOMMENDATIONS — Personalized Suggestions
# ═══════════════════════════════════════════════════════════════════════════════

class RecommendItem(BaseModel):
    title: str
    description: str
    category: str
    reason: str
    cta: str


class RecommendResponse(BaseModel):
    items: List[RecommendItem]
    generated_at: str


@router.get("/recommendations", response_model=RecommendResponse)
async def smart_recommendations(request: Request, limit: int = 5):
    """Generate personalized recommendations based on user activity."""
    user = await get_current_user(request)
    uid = str(user.get("_id") or user.get("id"))

    if not EMERGENT_LLM_KEY:
        raise HTTPException(503, "AI service nicht konfiguriert")

    # Pull user's recent activity signals
    recent_tx = await db.transactions.find(
        {"user_id": uid}, {"_id": 0, "category": 1, "merchant_name": 1, "amount": 1, "description": 1}
    ).sort("created_at", -1).limit(15).to_list(15)

    recent_bookings = await db.bookings.find(
        {"user_id": uid}, {"_id": 0, "service_type": 1, "business_name": 1}
    ).sort("created_at", -1).limit(5).to_list(5)

    balance_blz = int(float(user.get("balance_blz", 0) or 0))
    balance_eur = round(float(user.get("balance", 0) or 0), 2)

    # Build a compact profile for the LLM
    tx_summary = ", ".join(
        f"{t.get('category','?')}/{t.get('merchant_name','?')}" for t in recent_tx[:10]
    ) or "keine Aktivität"
    booking_summary = ", ".join(
        f"{b.get('service_type','?')}@{b.get('business_name','?')}" for b in recent_bookings
    ) or "keine"

    system = (
        "Du bist ein Empfehlungs-Engine für die BidBlitz Super-App. "
        "Schlage personalisierte Aktionen, Services oder Auktionen vor. "
        "Antworte AUSSCHLIESSLICH in JSON-Array Format mit Objekten: "
        '{"title":"...","description":"...","category":"...","reason":"...","cta":"..."}. '
        "Keine Erklärungen außerhalb des JSON. Maximal 5 Empfehlungen. Auf Deutsch."
    )

    prompt = (
        f"Nutzer-Profil:\n"
        f"- BLZ-Guthaben: {balance_blz}\n"
        f"- EUR-Guthaben: {balance_eur}€\n"
        f"- Letzte Transaktionen: {tx_summary}\n"
        f"- Letzte Buchungen: {booking_summary}\n\n"
        f"Verfügbare Kategorien: lottery, auction, restaurant, hotel, taxi, "
        f"telemedizin, handwerker, freelancer, streaming, mining, premium, ad_campaign.\n\n"
        f"Erstelle {min(limit, 5)} personalisierte Empfehlungen als JSON-Array."
    )

    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"reco_{uid}_{secrets.token_hex(4)}",
        system_message=system,
    ).with_model(*DEFAULT_MODEL)

    try:
        reply = await chat.send_message(UserMessage(text=prompt))
    except Exception:
        logger.exception("Recommendations failed")
        raise HTTPException(502, "KI-Service nicht erreichbar")

    # Parse JSON safely
    import json
    import re
    match = re.search(r"\[.*\]", reply, re.DOTALL)
    items: List[RecommendItem] = []
    if match:
        try:
            arr = json.loads(match.group(0))
            for x in arr[:limit]:
                if isinstance(x, dict):
                    items.append(RecommendItem(
                        title=str(x.get("title", ""))[:100],
                        description=str(x.get("description", ""))[:300],
                        category=str(x.get("category", "general"))[:50],
                        reason=str(x.get("reason", ""))[:200],
                        cta=str(x.get("cta", "Jetzt entdecken"))[:50],
                    ))
        except Exception:
            logger.warning(f"Could not parse JSON from LLM: {reply[:200]}")

    # Fallback: at least one default recommendation
    if not items:
        items = [RecommendItem(
            title="Tägliche Lotterie",
            description="Gewinne echte Sachpreise wie iPhone, MacBook oder Gutscheine.",
            category="lottery",
            reason="Hohe Chance auf attraktive Preise.",
            cta="Lose kaufen",
        )]

    return RecommendResponse(
        items=items,
        generated_at=datetime.now(timezone.utc).isoformat(),
    )
