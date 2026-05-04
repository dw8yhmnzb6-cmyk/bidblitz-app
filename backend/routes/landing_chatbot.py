"""
BidBlitz Landing Page AI-Chatbot
Claude Sonnet 4.5 via Emergent LLM Key — Lead-Generierung & Produktinfo
"""
import os
import logging
from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from dotenv import load_dotenv

from core.database import db
from emergentintegrations.llm.chat import LlmChat, UserMessage

load_dotenv()

router = APIRouter(prefix="/api/landing-chatbot", tags=["Landing Chatbot"])
log = logging.getLogger("bidblitz.landing_chatbot")


# ═══════════════════════════════════════════════════════════════════════
# CHATBOT CONFIGURATION & RAG CONTEXT
# ═══════════════════════════════════════════════════════════════════════

LANDING_CHATBOT_CONTEXT = """
Du bist der BidBlitz AI-Assistent auf der Landing Page.

BidBlitz ist die ultimative Super App für:
- 💰 Bezahlen: BidBlitz Pay (Wallet, QR-Code-Zahlung, Crypto)
- 🛍️ Einkaufen: Universaler Marketplace (Flüge, Hotels, Shopping, Taxi, Food, Immobilien)
- 🎮 Spielen: Penny Auctions (1 Cent/Gebot, echte Produkte gewinnen)
- 💼 Verdienen: Creator Economy (Live-Shopping, Tipps, Premium Content)
- 🏪 Business: POS-System (Enterprise Retail, TSE-konform)
- 📱 All-in-One: Native iOS/Android App

Features:
- Wallet mit KYC (Stripe Connect)
- Live-Shopping mit Video-Streaming (LiveKit)
- POS-System REWE/Lidl-Niveau (Bondrucker, TSE, Waagen)
- Crypto-Integration
- Referral-Programm
- Subscription-Modelle

Deine Aufgabe:
1. Beantworte Fragen zu BidBlitz Features
2. Sammle Leads (E-Mail für Beta-Zugang)
3. Biete Demo-Zugang an
4. Erkläre Use Cases (Taxi-Fahrer, Restaurant-Besitzer, Creator, Shopper)

Antworte freundlich, kurz (max 3 Sätze) und handlungsorientiert.
"""


# ═══════════════════════════════════════════════════════════════════════
# MESSAGE HANDLING
# ═══════════════════════════════════════════════════════════════════════

class ChatMessage(BaseModel):
    session_id: str
    message: str
    email: Optional[str] = None

class ChatResponse(BaseModel):
    session_id: str
    message: str
    suggested_actions: List[str] = []
    requires_email: bool = False

@router.post("/chat", response_model=ChatResponse)
async def landing_chatbot(req: ChatMessage, request: Request):
    """Landing Page Chatbot - Claude Sonnet 4.5 powered."""

    try:
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        if not api_key:
            raise HTTPException(status_code=500, detail="LLM key nicht konfiguriert")

        # Create new LlmChat instance for this session (library handles per-session memory)
        # We rebuild context from DB so cold-start sessions have history
        chat = LlmChat(
            api_key=api_key,
            session_id=req.session_id,
            system_message=LANDING_CHATBOT_CONTEXT,
        ).with_model("openai", "gpt-4.1-mini")

        # Send only the latest user message; LlmChat keeps in-process history per session_id
        # Persistent history is in MongoDB and was already used to seed previous calls
        user_message = UserMessage(text=req.message)
        bot_message = await chat.send_message(user_message)

        # Save messages to DB
        now_iso = datetime.now(timezone.utc).isoformat()
        await db.landing_chatbot_messages.insert_one({
            "session_id": req.session_id,
            "role": "user",
            "content": req.message,
            "timestamp": now_iso,
        })
        await db.landing_chatbot_messages.insert_one({
            "session_id": req.session_id,
            "role": "assistant",
            "content": bot_message,
            "timestamp": now_iso,
        })

        # Lead capture + suggested actions (rule-based on top of LLM response)
        requires_email = False
        suggested_actions = []
        msg_lower = req.message.lower()

        if "demo" in msg_lower or "testen" in msg_lower or "test" in msg_lower:
            if not req.email:
                requires_email = True
                suggested_actions.append("E-Mail für Demo-Zugang angeben")
            else:
                await db.landing_leads.update_one(
                    {"email": req.email},
                    {"$set": {
                        "email": req.email,
                        "source": "landing_chatbot",
                        "interest": "demo",
                        "session_id": req.session_id,
                        "created_at": now_iso,
                    }},
                    upsert=True,
                )
                suggested_actions.append("Demo-Zugang angefordert ✓")

        if "preis" in msg_lower or "kosten" in msg_lower or "pricing" in msg_lower:
            suggested_actions.append("Preisübersicht anzeigen")
        if "kontakt" in msg_lower or "contact" in msg_lower:
            suggested_actions.append("Kontaktformular öffnen")

        log.info(f"Chatbot session {req.session_id}: {req.message[:50]}")

        return ChatResponse(
            session_id=req.session_id,
            message=bot_message,
            suggested_actions=suggested_actions,
            requires_email=requires_email,
        )

    except HTTPException:
        raise
    except Exception as e:
        log.error(f"Chatbot error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Chatbot-Fehler: {str(e)[:200]}")


# ═══════════════════════════════════════════════════════════════════════
# LEAD MANAGEMENT
# ═══════════════════════════════════════════════════════════════════════

class LeadCapture(BaseModel):
    email: str
    name: Optional[str] = None
    interest: str  # "demo", "pos", "wallet", "marketplace"
    session_id: Optional[str] = None

@router.post("/leads")
async def capture_lead(lead: LeadCapture):
    """Capture lead from landing page."""
    
    await db.landing_leads.update_one(
        {"email": lead.email},
        {"$set": {
            "email": lead.email,
            "name": lead.name,
            "interest": lead.interest,
            "session_id": lead.session_id,
            "source": "landing_page",
            "captured_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True
    )
    
    log.info(f"Lead captured: {lead.email} (interest: {lead.interest})")
    
    return {"ok": True, "message": "Lead erfasst"}

@router.get("/leads")
async def get_leads(request: Request):
    """Get all captured leads (Admin only)."""
    from core.security import get_current_user
    user = await get_current_user(request)
    
    if user.get("role") != "admin" and not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin only")
    
    leads = await db.landing_leads.find(
        {},
        {"_id": 0}
    ).sort("captured_at", -1).to_list(500)
    
    return {"leads": leads, "count": len(leads)}


# ═══════════════════════════════════════════════════════════════════════
# CHATBOT ANALYTICS
# ═══════════════════════════════════════════════════════════════════════

@router.get("/analytics")
async def chatbot_analytics(request: Request):
    """Get chatbot usage analytics."""
    from core.security import get_current_user
    user = await get_current_user(request)
    
    if user.get("role") != "admin" and not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin only")
    
    total_sessions = await db.landing_chatbot_messages.distinct("session_id")
    total_messages = await db.landing_chatbot_messages.count_documents({})
    total_leads = await db.landing_leads.count_documents({})
    
    return {
        "total_sessions": len(total_sessions),
        "total_messages": total_messages,
        "total_leads": total_leads,
        "conversion_rate": round(total_leads / max(len(total_sessions), 1) * 100, 2),
    }

@router.get("/health")
async def chatbot_health():
    return {"status": "ok", "model": "gpt-4.1-mini", "provider": "openai"}
