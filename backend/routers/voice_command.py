"""Voice Command Router - Admin voice commands using Whisper + GPT"""
from fastapi import APIRouter, HTTPException, Depends, File, UploadFile
from datetime import datetime, timezone
from pydantic import BaseModel
from typing import Optional
import uuid
import json
import os
import tempfile
from dotenv import load_dotenv

from config import db, logger
from dependencies import get_admin_user

load_dotenv()

router = APIRouter(prefix="/voice-command", tags=["Voice Commands"])

# ==================== VOICE COMMAND PROCESSING ====================

async def transcribe_audio(audio_file) -> str:
    """Transcribe audio using OpenAI Whisper"""
    from emergentintegrations.llm.openai import OpenAISpeechToText
    
    api_key = os.getenv("EMERGENT_LLM_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="API Key nicht konfiguriert")
    
    stt = OpenAISpeechToText(api_key=api_key)
    
    response = await stt.transcribe(
        file=audio_file,
        model="whisper-1",
        language="de",  # German
        response_format="json"
    )
    
    return response.text

async def parse_command(text: str) -> dict:
    """Use GPT to parse the command and determine the action"""
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    
    api_key = os.getenv("EMERGENT_LLM_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="API Key nicht konfiguriert")
    
    system_prompt = """Du bist ein Admin-Assistent für eine Penny-Auction-Plattform (BidBlitz).
Analysiere den Befehl und gib eine strukturierte JSON-Antwort zurück.

Verfügbare Aktionen:

=== AUKTIONEN ===
1. create_auctions - Neue Auktionen erstellen
   Parameter: count (Anzahl), category (optional), duration_days (optional)
   
2. delete_auctions - Auktionen löschen
   Parameter: status (ended/all), older_than_days (optional)

3. extend_auction - Auktion verlängern
   Parameter: auction_id, hours (Stunden)
   
4. set_auction_of_day - Auktion des Tages setzen
   Parameter: auction_id oder "auto" für automatische Auswahl

=== BENUTZER ===
5. add_bids_to_user - Gebote zu einem Benutzer hinzufügen
   Parameter: email, amount

6. ban_user - Benutzer sperren
   Parameter: email, reason (optional)
   
7. unban_user - Benutzer entsperren
   Parameter: email

8. make_vip - Benutzer zum VIP machen
   Parameter: email, duration_days (optional, 30 = Standard)

9. remove_vip - VIP-Status entfernen
   Parameter: email

=== GUTSCHEINE ===
10. create_voucher - Gutscheincode erstellen
    Parameter: bids (Anzahl Gebote), code (optional, wird generiert), max_uses (optional)

=== BOTS ===
11. start_bots - Bots starten
    Parameter: keine

12. stop_bots - Bots stoppen
    Parameter: keine

13. set_bot_speed - Bot-Geschwindigkeit setzen
    Parameter: seconds (Intervall in Sekunden)

=== INFLUENCER ===
14. approve_influencer - Influencer-Bewerbung genehmigen
    Parameter: email

15. show_pending_payouts - Offene Auszahlungsanfragen zeigen
    Parameter: keine

=== SYSTEM ===
16. get_stats - Statistiken abrufen
    Parameter: type (users/auctions/revenue/today)

17. send_notification - Benachrichtigung an alle senden
    Parameter: title, message

18. maintenance_mode - Wartungsmodus ein/ausschalten
    Parameter: enabled (true/false)

19. send_test_email - Test-E-Mail senden
    Parameter: email

20. export_users - Benutzer exportieren
    Parameter: format (csv/json)

21. create_backup - Datenbank-Backup erstellen
    Parameter: keine

22. create_report - Bericht erstellen (Woche/Monat)
    Parameter: period (week/month)

23. unknown - Wenn der Befehl nicht erkannt wird

Antworte NUR mit einem JSON-Objekt im folgenden Format:
{
  "action": "action_name",
  "parameters": {...},
  "confirmation_message": "Menschlich lesbare Bestätigung",
  "needs_confirmation": true/false
}

Beispiele:
- "Erstelle 50 neue Auktionen" -> {"action": "create_auctions", "parameters": {"count": 50}, "confirmation_message": "Soll ich 50 neue Auktionen erstellen?", "needs_confirmation": true}
- "Sperre Benutzer test@email.de" -> {"action": "ban_user", "parameters": {"email": "test@email.de"}, "confirmation_message": "Soll ich den Benutzer test@email.de sperren?", "needs_confirmation": true}
- "Erstelle Gutscheincode mit 100 Geboten" -> {"action": "create_voucher", "parameters": {"bids": 100}, "confirmation_message": "Soll ich einen Gutscheincode mit 100 Geboten erstellen?", "needs_confirmation": true}
- "Stoppe die Bots" -> {"action": "stop_bots", "parameters": {}, "confirmation_message": "Soll ich alle Bots stoppen?", "needs_confirmation": true}
- "Zeige heutige Einnahmen" -> {"action": "get_stats", "parameters": {"type": "today"}, "confirmation_message": "Ich zeige Ihnen die heutigen Einnahmen.", "needs_confirmation": false}
"""
    
    chat = LlmChat(
        api_key=api_key,
        session_id=f"admin-voice-{uuid.uuid4()}",
        system_message=system_prompt
    ).with_model("openai", "gpt-4o-mini")
    
    user_message = UserMessage(text=f"Befehl: {text}")
    
    response = await chat.send_message(user_message)
    
    # Parse JSON from response
    try:
        # Try to extract JSON from the response
        response_text = response.strip()
        if response_text.startswith("```json"):
            response_text = response_text[7:]
        if response_text.startswith("```"):
            response_text = response_text[3:]
        if response_text.endswith("```"):
            response_text = response_text[:-3]
        
        return json.loads(response_text.strip())
    except json.JSONDecodeError:
        return {
            "action": "unknown",
            "parameters": {},
            "confirmation_message": f"Ich habe verstanden: '{text}', aber konnte den Befehl nicht verarbeiten.",
            "needs_confirmation": False
        }

# ==================== COMMAND EXECUTION ====================

async def execute_command(action: str, parameters: dict, admin: dict) -> dict:
    """Execute the parsed command"""
    
    if action == "create_auctions":
        count = parameters.get("count", 10)
        count = min(count, 100)  # Max 100 at a time
        
        # Get random products
        products = await db.products.find({}, {"_id": 0}).to_list(50)
        if not products:
            return {"success": False, "message": "Keine Produkte vorhanden"}
        
        import random
        created = 0
        for i in range(count):
            product = random.choice(products)
            duration_days = parameters.get("duration_days", random.randint(1, 7))
            
            auction = {
                "id": str(uuid.uuid4()),
                "product_id": product["id"],
                "title": product.get("name", {}).get("de", product.get("name", "Produkt")),
                "description": product.get("description", {}).get("de", ""),
                "image_url": product.get("image_url", ""),
                "retail_price": product.get("retail_price", 100),
                "current_price": 0.00,
                "bid_count": 0,
                "time_remaining": duration_days * 24 * 60 * 60,
                "end_time": (datetime.now(timezone.utc) + __import__('datetime').timedelta(days=duration_days)).isoformat(),
                "status": "active",
                "is_vip_only": random.random() < 0.2,
                "category": product.get("category", "Elektronik"),
                "winner_id": None,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "created_by": admin["id"]
            }
            await db.auctions.insert_one(auction)
            created += 1
        
        logger.info(f"🎤 Voice command: Created {created} auctions by {admin['name']}")
        return {"success": True, "message": f"✅ {created} neue Auktionen erfolgreich erstellt!"}
    
    elif action == "delete_auctions":
        status = parameters.get("status", "ended")
        older_than_days = parameters.get("older_than_days", 7)
        
        query = {}
        if status == "ended":
            query["status"] = "ended"
        
        if older_than_days:
            cutoff = (datetime.now(timezone.utc) - __import__('datetime').timedelta(days=older_than_days)).isoformat()
            query["end_time"] = {"$lt": cutoff}
        
        result = await db.auctions.delete_many(query)
        
        logger.info(f"🎤 Voice command: Deleted {result.deleted_count} auctions by {admin['name']}")
        return {"success": True, "message": f"✅ {result.deleted_count} Auktionen gelöscht!"}
    
    elif action == "add_bids_to_user":
        email = parameters.get("email")
        amount = parameters.get("amount", 0)
        
        if not email:
            return {"success": False, "message": "E-Mail-Adresse fehlt"}
        
        result = await db.users.update_one(
            {"email": email},
            {"$inc": {"bids_balance": amount}}
        )
        
        if result.modified_count == 0:
            return {"success": False, "message": f"Benutzer mit E-Mail {email} nicht gefunden"}
        
        logger.info(f"🎤 Voice command: Added {amount} bids to {email} by {admin['name']}")
        return {"success": True, "message": f"✅ {amount} Gebote zu {email} hinzugefügt!"}
    
    elif action == "get_stats":
        stat_type = parameters.get("type", "all")
        
        stats = {}
        if stat_type in ["users", "all"]:
            stats["total_users"] = await db.users.count_documents({})
            stats["vip_users"] = await db.users.count_documents({"is_vip": True})
        
        if stat_type in ["auctions", "all"]:
            stats["active_auctions"] = await db.auctions.count_documents({"status": "active"})
            stats["ended_auctions"] = await db.auctions.count_documents({"status": "ended"})
        
        if stat_type in ["revenue", "all"]:
            # Calculate total revenue
            pipeline = [{"$group": {"_id": None, "total": {"$sum": "$amount"}}}]
            revenue_result = await db.orders.aggregate(pipeline).to_list(1)
            stats["total_revenue"] = revenue_result[0]["total"] if revenue_result else 0
        
        return {"success": True, "message": "📊 Statistiken:", "data": stats}
    
    elif action == "send_notification":
        title = parameters.get("title", "Ankündigung")
        message = parameters.get("message", "")
        
        if not message:
            return {"success": False, "message": "Nachricht fehlt"}
        
        # Get all users
        users = await db.users.find({}, {"_id": 0, "id": 1}).to_list(10000)
        
        notifications = []
        for user in users:
            notifications.append({
                "id": str(uuid.uuid4()),
                "user_id": user["id"],
                "type": "admin_announcement",
                "title": title,
                "message": message,
                "read": False,
                "created_at": datetime.now(timezone.utc).isoformat()
            })
        
        if notifications:
            await db.notifications.insert_many(notifications)
        
        logger.info(f"🎤 Voice command: Sent notification to {len(users)} users by {admin['name']}")
        return {"success": True, "message": f"✅ Benachrichtigung an {len(users)} Benutzer gesendet!"}
    
    elif action == "set_auction_of_day":
        auction_id = parameters.get("auction_id", "auto")
        
        if auction_id == "auto":
            # Find a good auction automatically
            auction = await db.auctions.find_one(
                {"status": "active", "is_vip_only": False},
                {"_id": 0},
                sort=[("retail_price", -1)]
            )
            if auction:
                auction_id = auction["id"]
            else:
                return {"success": False, "message": "Keine passende Auktion gefunden"}
        
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        await db.auction_of_the_day.update_one(
            {"date": today},
            {"$set": {"date": today, "auction_id": auction_id}},
            upsert=True
        )
        
        logger.info(f"🎤 Voice command: Set AOTD to {auction_id} by {admin['name']}")
        return {"success": True, "message": f"✅ Auktion des Tages gesetzt!"}
    
    else:
        return {"success": False, "message": "❌ Befehl nicht erkannt"}

# ==================== API ENDPOINTS ====================

class TextCommandRequest(BaseModel):
    text: str
    execute: bool = False

@router.post("/transcribe")
async def transcribe_voice_command(
    audio: UploadFile = File(...),
    admin: dict = Depends(get_admin_user)
):
    """Transcribe audio to text"""
    
    # Check file type
    allowed_types = ["audio/wav", "audio/mp3", "audio/mpeg", "audio/webm", "audio/mp4", "audio/m4a"]
    content_type = audio.content_type or ""
    
    if not any(t in content_type for t in ["audio", "webm", "wav", "mp3", "mpeg"]):
        # Try by extension
        ext = audio.filename.split(".")[-1].lower() if audio.filename else ""
        if ext not in ["wav", "mp3", "webm", "m4a", "mp4", "mpeg", "mpga"]:
            raise HTTPException(status_code=400, detail="Ungültiges Audioformat")
    
    # Read audio content
    content = await audio.read()
    
    # Check file size (max 25MB)
    if len(content) > 25 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Datei zu groß (max 25MB)")
    
    # Save to temp file
    ext = audio.filename.split(".")[-1] if audio.filename else "webm"
    with tempfile.NamedTemporaryFile(delete=False, suffix=f".{ext}") as tmp:
        tmp.write(content)
        tmp_path = tmp.name
    
    try:
        # Transcribe
        with open(tmp_path, "rb") as audio_file:
            text = await transcribe_audio(audio_file)
        
        # Parse command
        parsed = await parse_command(text)
        
        logger.info(f"🎤 Voice transcribed: '{text}' -> {parsed['action']}")
        
        return {
            "success": True,
            "transcription": text,
            "parsed_command": parsed
        }
    finally:
        # Clean up temp file
        os.unlink(tmp_path)

@router.post("/execute")
async def execute_voice_command(
    request: TextCommandRequest,
    admin: dict = Depends(get_admin_user)
):
    """Parse and optionally execute a text command"""
    
    # Parse command
    parsed = await parse_command(request.text)
    
    if request.execute and parsed["action"] != "unknown":
        # Execute the command
        result = await execute_command(parsed["action"], parsed["parameters"], admin)
        return {
            "success": True,
            "transcription": request.text,
            "parsed_command": parsed,
            "execution_result": result
        }
    
    return {
        "success": True,
        "transcription": request.text,
        "parsed_command": parsed
    }

@router.post("/confirm-execute")
async def confirm_and_execute(
    action: str,
    parameters: dict,
    admin: dict = Depends(get_admin_user)
):
    """Execute a confirmed command"""
    
    result = await execute_command(action, parameters, admin)
    
    # Log command execution
    log_entry = {
        "id": str(uuid.uuid4()),
        "admin_id": admin["id"],
        "admin_name": admin["name"],
        "action": action,
        "parameters": parameters,
        "result": result,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.voice_command_logs.insert_one(log_entry)
    
    return result

@router.get("/history")
async def get_command_history(admin: dict = Depends(get_admin_user)):
    """Get voice command history"""
    history = await db.voice_command_logs.find(
        {},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    return history
