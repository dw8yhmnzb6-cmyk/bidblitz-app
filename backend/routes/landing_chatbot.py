"""
BidBlitz Landing Page AI-Chatbot
RAG-basierter Support-Bot für Lead-Generierung & Produktinfo
Verwendet Emergent LLM Key (Claude Sonnet 4)
"""
import os
import logging
from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from core.database import db
from emergentintegrations.llm import LLM

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
    """Landing Page Chatbot - Lead-Generierung & Support."""
    
    try:
        # Fetch chat history
        history = await db.landing_chatbot_messages.find(
            {"session_id": req.session_id}
        ).sort("timestamp", 1).to_list(20)
        
        # Build conversation context
        conversation = []
        for msg in history:
            conversation.append({
                "role": msg["role"],
                "content": msg["content"]
            })
        
        # Add system context
        conversation.insert(0, {
            "role": "system",
            "content": LANDING_CHATBOT_CONTEXT
        })
        
        # Add user message
        conversation.append({
            "role": "user",
            "content": req.message
        })
        
        # Call LLM (Claude Sonnet 4 via Emergent LLM Key)
        llm = LLM(api_key=os.getenv('EMERGENT_LLM_KEY'))
        response = llm.create_chat_completion(
            model="claude-sonnet-4",
            messages=conversation,
            max_tokens=300,
            temperature=0.7,
        )
        
        bot_message = response['choices'][0]['message']['content']
        
        # Save messages to DB
        await db.landing_chatbot_messages.insert_one({
            "session_id": req.session_id,
            "role": "user",
            "content": req.message,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
        
        await db.landing_chatbot_messages.insert_one({
            "session_id": req.session_id,
            "role": "assistant",
            "content": bot_message,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
        
        # Lead capture logic
        requires_email = False
        suggested_actions = []
        
        if "demo" in req.message.lower() or "testen" in req.message.lower():
            if not req.email:
                requires_email = True
                suggested_actions.append("E-Mail für Demo-Zugang angeben")
            else:
                # Save lead
                await db.landing_leads.update_one(
                    {"email": req.email},
                    {"$set": {
                        "email": req.email,
                        "source": "landing_chatbot",
                        "interest": "demo",
                        "session_id": req.session_id,
                        "created_at": datetime.now(timezone.utc).isoformat(),
                    }},
                    upsert=True
                )
                suggested_actions.append("Demo-Zugang angefordert ✓")
        
        if "preis" in req.message.lower() or "kosten" in req.message.lower():
            suggested_actions.append("Preisübersicht anzeigen")
        
        if "kontakt" in req.message.lower():
            suggested_actions.append("Kontaktformular öffnen")
        
        log.info(f"Chatbot session {req.session_id}: {req.message[:50]}")
        
        return ChatResponse(
            session_id=req.session_id,
            message=bot_message,
            suggested_actions=suggested_actions,
            requires_email=requires_email,
        )
        
    except Exception as e:
        log.error(f"Chatbot error: {e}")
        raise HTTPException(status_code=500, detail="Chatbot-Fehler")


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
    
    if not user.get("is_admin"):
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
    
    if not user.get("is_admin"):
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
    return {"status": "ok", "model": "claude-sonnet-4"}
