"""
BidBlitz V2 - AI Chatbot (Claude Sonnet 4.5 + RAG)
Support & Recommendations via AI with knowledge-base retrieval.
"""

import os
import secrets
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

from core.database import db
from core.security import get_current_user
from data.bidblitz_kb import build_context_block
from emergentintegrations.llm.chat import LlmChat, UserMessage

router = APIRouter()

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
# NOTE: Emergent Universal LLM Key supports OpenAI + Gemini models only.
# Claude is NOT available via universal key — would require user-provided
# ANTHROPIC_API_KEY. Using GPT-5.2 (current flagship OpenAI model via Emergent key).
LLM_PROVIDER = "openai"
LLM_MODEL = "gpt-5.2"

# BidBlitz AI System Prompt
BIDBLITZ_SYSTEM_PROMPT = """Du bist der offizielle AI-Assistent von BidBlitz, der ultimativen Super-App für Deutschland, Kosovo und VAE.

## Über BidBlitz:
BidBlitz ist eine All-in-One Super-App mit 50+ Services:
- 🎯 **Penny Auctions**: Luxusprodukte (iPhone, Nintendo Switch, Rolex) für Centbeträge ersteigern
- 🚖 **Taxi & Mobility**: Taxi-Buchung, E-Scooter, Hotels, Flüge, EV-Ladesäulen
- 🍔 **Food & Restaurants**: Essensbestellung, Restaurant-Finder
- 💰 **Wallet & Finance**: Digitale Brieftasche, P2P-Zahlungen, Crypto, Sparen
- 👶 **Kids Mode**: GPS-Tracking, Safe Zones, Kids Wallet
- 📱 **Social**: Dating (Tinder-Style), Friends Map
- 🛍️ **Shopping**: Kleinanzeigen (eBay-Style), Marktplatz
- 💼 **Merchants**: QR-Zahlungen, Händler-Tools

## Deine Aufgaben:
1. **Support**: Fragen zu BidBlitz-Features beantworten
2. **Empfehlungen**: Services basierend auf User-Bedürfnissen vorschlagen
3. **Auktions-Tipps**: Wann bieten, Strategien, Gewinnchancen
4. **Onboarding**: Neue User durch die App führen

## Kommunikationsstil:
- Freundlich und hilfsbereit
- Kurz und prägnant (max 3-4 Sätze)
- Emoji verwenden (🎯 📱 💡)
- Mehrsprachig: Deutsch, Englisch, Arabisch

## Wichtig:
- Bei Zahlungsproblemen: An Support-Team weiterleiten
- Bei technischen Bugs: Bug-Report erstellen lassen
- Keine Preise garantieren oder versprechen"""


class ChatMessageRequest(BaseModel):
    message: str
    language: Optional[str] = "de"  # de, en, ar
    context: Optional[dict] = None  # user context (balance, services used, etc.)


class ChatResponse(BaseModel):
    message_id: str
    response: str
    timestamp: str
    suggestions: Optional[list] = None


@router.post("/send", response_model=ChatResponse)
async def send_chat_message(req: ChatMessageRequest, request: Request):
    """Send message to AI chatbot and get response."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="AI service not configured")
    
    # Generate session ID (or retrieve existing one)
    session_id = f"chat_{user_id}"
    
    # Load chat history from database
    history = await db.chatbot_messages.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("timestamp", -1).limit(10).to_list(10)
    
    # Reverse to get chronological order
    history.reverse()
    
    # Enhance system prompt with user context
    system_prompt = BIDBLITZ_SYSTEM_PROMPT
    if req.context:
        balance = req.context.get("balance", 0)
        services_used = req.context.get("services_used", [])
        system_prompt += f"\n\n## Aktueller User-Kontext:\n- Guthaben: €{balance}\n- Genutzte Services: {', '.join(services_used)}"

    # Language-specific prompt
    if req.language == "en":
        system_prompt += "\n\n**Respond in English.**"
    elif req.language == "ar":
        system_prompt += "\n\n**Respond in Arabic (العربية).**"
    else:
        system_prompt += "\n\n**Antworte auf Deutsch.**"

    # ── RAG: retrieve top-3 relevant KB docs and inject into system prompt ──
    kb_block = build_context_block(req.message, top_k=3)
    if kb_block:
        system_prompt += kb_block

    try:
        # Initialize LlmChat with Claude Sonnet 4.5
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=session_id,
            system_message=system_prompt
        ).with_model(LLM_PROVIDER, LLM_MODEL)
        
        # Restore history (if any)
        for msg in history[-5:]:  # Last 5 messages for context
            if msg["role"] == "user":
                await chat.send_message(UserMessage(text=msg["content"]), store=False)
        
        # Send new message
        user_message = UserMessage(text=req.message)
        ai_response = await chat.send_message(user_message)
        
        # Save messages to database
        message_id = secrets.token_hex(8)
        timestamp = datetime.now(timezone.utc).isoformat()
        
        # Save user message
        await db.chatbot_messages.insert_one({
            "message_id": f"{message_id}_user",
            "user_id": user_id,
            "session_id": session_id,
            "role": "user",
            "content": req.message,
            "timestamp": timestamp,
        })
        
        # Save AI response
        await db.chatbot_messages.insert_one({
            "message_id": message_id,
            "user_id": user_id,
            "session_id": session_id,
            "role": "assistant",
            "content": ai_response,
            "timestamp": timestamp,
        })
        
        # Generate smart suggestions based on response
        suggestions = generate_suggestions(ai_response, req.message)
        
        return ChatResponse(
            message_id=message_id,
            response=ai_response,
            timestamp=timestamp,
            suggestions=suggestions
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI error: {str(e)}")


@router.get("/history")
async def get_chat_history(request: Request, limit: int = 50):
    """Get user's chat history."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    messages = await db.chatbot_messages.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("timestamp", -1).limit(limit).to_list(limit)
    
    messages.reverse()
    
    return {"messages": messages, "total": len(messages)}


@router.delete("/history")
async def clear_chat_history(request: Request):
    """Clear user's chat history."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    result = await db.chatbot_messages.delete_many({"user_id": user_id})
    
    return {"ok": True, "deleted": result.deleted_count}


@router.post("/feedback")
async def submit_feedback(
    message_id: str,
    rating: int,  # 1-5 stars
    comment: Optional[str] = None,
    request: Request = None
):
    """Submit feedback for AI response."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    if rating < 1 or rating > 5:
        raise HTTPException(status_code=400, detail="Rating must be 1-5")
    
    await db.chatbot_feedback.insert_one({
        "feedback_id": secrets.token_hex(8),
        "user_id": user_id,
        "message_id": message_id,
        "rating": rating,
        "comment": comment,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })
    
    return {"ok": True}


def generate_suggestions(ai_response: str, user_message: str) -> list:
    """Generate smart follow-up suggestions based on AI response."""
    suggestions = []
    
    # Auction-related
    if any(word in ai_response.lower() for word in ["auktion", "bieten", "auction"]):
        suggestions.extend([
            "Zeige mir aktive Auktionen",
            "Wie funktioniert Bidding?",
            "Meine gewonnenen Auktionen"
        ])
    
    # Wallet/Money
    if any(word in ai_response.lower() for word in ["wallet", "guthaben", "balance"]):
        suggestions.extend([
            "Guthaben aufladen",
            "Transaktionshistorie anzeigen",
            "Wie kann ich Geld senden?"
        ])
    
    # Services
    if any(word in ai_response.lower() for word in ["taxi", "food", "service"]):
        suggestions.extend([
            "Taxi in meiner Nähe",
            "Restaurant-Empfehlungen",
            "Alle Services anzeigen"
        ])
    
    # Kids
    if any(word in ai_response.lower() for word in ["kind", "kids", "gps"]):
        suggestions.extend([
            "Kind hinzufügen",
            "GPS-Tracking aktivieren",
            "Safe Zones einrichten"
        ])
    
    # Default suggestions if none matched
    if not suggestions:
        suggestions = [
            "Was kann BidBlitz?",
            "Wie funktionieren Auktionen?",
            "Welche Services gibt es?"
        ]
    
    return suggestions[:3]  # Max 3 suggestions
