"""
BidBlitz V2 - AI-Chatbot & Smart Assistant
24/7 Support, Navigation, Empfehlungen, Buchungen
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
from core.database import db
from core.security import get_current_user
import secrets
import os
from emergentintegrations.openai_client import OpenAIClient

router = APIRouter(prefix="/api/ai-chat", tags=["ai-chat"])

# Initialize OpenAI Client
openai_client = OpenAIClient(api_key=os.environ.get("EMERGENT_LLM_KEY"))

# ══════════════════════════════════════════════════════════════════════════════
# MODELS
# ══════════════════════════════════════════════════════════════════════════════

class ChatMessage(BaseModel):
    message: str
    session_id: Optional[str] = None

# ══════════════════════════════════════════════════════════════════════════════
# FUNCTION DEFINITIONS FOR GPT
# ══════════════════════════════════════════════════════════════════════════════

FUNCTIONS = [
    {
        "name": "search_services",
        "description": "Suche nach Dienstleistern (Hotels, Restaurants, Ärzte, etc.)",
        "parameters": {
            "type": "object",
            "properties": {
                "service_type": {
                    "type": "string",
                    "enum": ["hotel", "restaurant", "doctor", "handyman", "salon"],
                    "description": "Art des Services"
                },
                "city": {
                    "type": "string",
                    "description": "Stadt"
                },
                "date": {
                    "type": "string",
                    "description": "Gewünschtes Datum (YYYY-MM-DD)"
                }
            },
            "required": ["service_type"]
        }
    },
    {
        "name": "book_service",
        "description": "Buche einen Service (Restaurant, Hotel, Arzt, etc.)",
        "parameters": {
            "type": "object",
            "properties": {
                "provider_id": {
                    "type": "string",
                    "description": "ID des Service-Providers"
                },
                "date": {
                    "type": "string",
                    "description": "Datum (YYYY-MM-DD)"
                },
                "time": {
                    "type": "string",
                    "description": "Uhrzeit (HH:MM)"
                }
            },
            "required": ["provider_id", "date", "time"]
        }
    },
    {
        "name": "create_ad_campaign",
        "description": "Erstelle eine Werbekampagne",
        "parameters": {
            "type": "object",
            "properties": {
                "campaign_name": {
                    "type": "string",
                    "description": "Name der Kampagne"
                },
                "budget": {
                    "type": "number",
                    "description": "Budget in Euro"
                },
                "ad_type": {
                    "type": "string",
                    "enum": ["banner", "sponsored_listing"],
                    "description": "Anzeigentyp"
                }
            },
            "required": ["campaign_name", "budget"]
        }
    },
    {
        "name": "get_my_bookings",
        "description": "Hole meine aktuellen Buchungen",
        "parameters": {
            "type": "object",
            "properties": {}
        }
    }
]

# ══════════════════════════════════════════════════════════════════════════════
# FUNCTION IMPLEMENTATIONS
# ══════════════════════════════════════════════════════════════════════════════

async def search_services(service_type: str, city: Optional[str] = None, date: Optional[str] = None):
    """Search for service providers"""
    query = {"service_type": service_type, "is_active": True}
    if city:
        query["city"] = {"$regex": city, "$options": "i"}
    
    providers = await db.booking_providers.find(query, {"_id": 0}).limit(5).to_list(5)
    
    if not providers:
        return {"result": f"Keine {service_type} gefunden" + (f" in {city}" if city else "")}
    
    result = f"Ich habe {len(providers)} {service_type} gefunden:\n\n"
    for p in providers:
        result += f"• {p['business_name']} - {p['city']} (⭐ {p.get('rating', 0)}/5)\n"
    
    return {"result": result, "providers": providers}

async def book_service(provider_id: str, date: str, time: str, user_email: str):
    """Book a service"""
    provider = await db.booking_providers.find_one({"provider_id": provider_id})
    if not provider:
        return {"result": "Provider nicht gefunden"}
    
    # Create booking
    booking = {
        "booking_id": f"book_{secrets.token_hex(8)}",
        "provider_id": provider_id,
        "user_email": user_email,
        "service_type": provider["service_type"],
        "business_name": provider["business_name"],
        "booking_date": date,
        "booking_time": time,
        "duration_minutes": 60,
        "status": "confirmed",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    
    await db.bookings.insert_one(booking)
    
    return {
        "result": f"✅ Buchung bestätigt!\n{provider['business_name']}\n{date} um {time}",
        "booking": booking
    }

async def get_my_bookings(user_email: str):
    """Get user's bookings"""
    bookings = await db.bookings.find(
        {"user_email": user_email},
        {"_id": 0}
    ).limit(5).to_list(5)
    
    if not bookings:
        return {"result": "Du hast noch keine Buchungen."}
    
    result = f"Du hast {len(bookings)} Buchungen:\n\n"
    for b in bookings:
        result += f"• {b['business_name']} - {b['booking_date']} um {b['booking_time']} ({b['status']})\n"
    
    return {"result": result, "bookings": bookings}

# ══════════════════════════════════════════════════════════════════════════════
# CHAT ENDPOINT
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/chat")
async def chat_with_ai(req: ChatMessage, request: Request):
    """
    Chat with AI Assistant
    Supports function calling for app actions
    """
    try:
        user = await get_current_user(request)
        user_email = user.get("email", "guest")
        
        # Get or create session
        session_id = req.session_id or f"sess_{secrets.token_hex(8)}"
        
        # Get conversation history
        history = await db.chat_sessions.find_one({"session_id": session_id})
        messages = history.get("messages", []) if history else []
        
        # Add system message if new session
        if not messages:
            system_msg = """Du bist der BidBlitz AI-Assistent. Du hilfst Nutzern bei:
- Navigation in der App
- Suche nach Services (Hotels, Restaurants, Ärzte, Handwerker)
- Buchungen vornehmen
- Werbekampagnen erstellen
- Fragen zur App beantworten

Sei freundlich, hilfsbereit und präzise. Nutze die verfügbaren Funktionen wenn nötig.
Antworte auf Deutsch."""
            messages.append({"role": "system", "content": system_msg})
        
        # Add user message
        messages.append({"role": "user", "content": req.message})
        
        # Call OpenAI
        response = openai_client.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            functions=FUNCTIONS,
            function_call="auto",
            temperature=0.7,
        )
        
        assistant_message = response.choices[0].message
        
        # Handle function call
        if assistant_message.function_call:
            function_name = assistant_message.function_call.name
            function_args = eval(assistant_message.function_call.arguments)
            
            # Execute function
            if function_name == "search_services":
                function_result = await search_services(**function_args)
            elif function_name == "book_service":
                function_result = await book_service(**function_args, user_email=user_email)
            elif function_name == "get_my_bookings":
                function_result = await get_my_bookings(user_email)
            else:
                function_result = {"result": "Funktion nicht verfügbar"}
            
            # Add function result to messages
            messages.append({
                "role": "function",
                "name": function_name,
                "content": str(function_result)
            })
            
            # Get final response
            response2 = openai_client.chat.completions.create(
                model="gpt-4o",
                messages=messages,
                temperature=0.7,
            )
            
            final_response = response2.choices[0].message.content
        else:
            final_response = assistant_message.content
        
        # Add assistant response
        messages.append({"role": "assistant", "content": final_response})
        
        # Save session
        await db.chat_sessions.update_one(
            {"session_id": session_id},
            {
                "$set": {
                    "user_email": user_email,
                    "messages": messages[-20:],  # Keep last 20 messages
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
            },
            upsert=True
        )
        
        return {
            "response": final_response,
            "session_id": session_id,
        }
    
    except Exception as e:
        return {
            "response": f"Entschuldigung, ich hatte einen technischen Fehler. Bitte versuche es nochmal.",
            "error": str(e)
        }

@router.delete("/chat/{session_id}")
async def clear_chat_session(session_id: str):
    """Clear chat session"""
    await db.chat_sessions.delete_one({"session_id": session_id})
    return {"ok": True, "message": "Chat-Verlauf gelöscht"}

@router.get("/chat/history")
async def get_chat_history(request: Request):
    """Get all chat sessions for user"""
    user = await get_current_user(request)
    
    sessions = await db.chat_sessions.find(
        {"user_email": user.get("email")},
        {"_id": 0}
    ).sort("updated_at", -1).limit(10).to_list(10)
    
    return {"sessions": sessions}
