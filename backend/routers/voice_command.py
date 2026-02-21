"""Voice Command Router - Admin voice commands using Whisper + GPT"""
from fastapi import APIRouter, HTTPException, Depends, File, UploadFile, Request
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
    
    system_prompt = """Du bist ein Admin-Assistent für eine Penny-Auction-Plattform (bidblitz.ae).
Analysiere den Befehl und gib eine strukturierte JSON-Antwort zurück.

WICHTIG: Bei kombinierten Befehlen (z.B. "Lösche alle Auktionen und erstelle 50 neue") verwende die "batch" Aktion!

WICHTIG - BOTS ERSTELLEN VS STARTEN:
- "erstelle Bots", "neue Bots", "X Bots mit [Nationalität] Namen" = create_bots (NEUE Bots in Datenbank anlegen)
- "starte Bots", "Bots aktivieren", "Bots einschalten" = start_bots (existierende Bots aktivieren)
- "stoppe Bots", "Bots deaktivieren", "Bots ausschalten" = stop_bots
Diese Unterscheidung ist KRITISCH! Bei "erstelle 50 Bots" IMMER create_bots verwenden!

Verfügbare Aktionen:

=== BATCH (FÜR KOMBINIERTE BEFEHLE) ===
0. batch - Mehrere Aktionen nacheinander ausführen
   Parameter: actions (Array von Aktionen, jede mit "action" und "parameters")
   Beispiel: {"action": "batch", "parameters": {"actions": [{"action": "delete_auctions", "parameters": {"status": "ended"}}, {"action": "create_auctions", "parameters": {"count": 50}}]}}

=== BOTS (WICHTIG - ERSTELLEN VS STARTEN/STOPPEN) ===
1. create_bots - NEUE Bots in Datenbank erstellen
   TRIGGER-WÖRTER: "erstelle", "neue", "anlegen", "generiere", "mache" + "Bots"
   Parameter: count (Anzahl Bots), nationality (z.B. "german", "albanian", "turkish", "arabic")
   Beispiele:
   - "Erstelle 50 Bots mit albanischen Namen" -> {"action": "create_bots", "parameters": {"count": 50, "nationality": "albanian"}}
   - "50 neue Bots mit türkischen Namen" -> {"action": "create_bots", "parameters": {"count": 50, "nationality": "turkish"}}
   - "Generiere 100 deutsche Bots" -> {"action": "create_bots", "parameters": {"count": 100, "nationality": "german"}}

2. start_bots - Existierende Bots AKTIVIEREN (starten)
   TRIGGER-WÖRTER: "starte", "aktiviere", "einschalten", "Bots an"
   Parameter: keine
   
3. stop_bots - Bots DEAKTIVIEREN (stoppen)
   TRIGGER-WÖRTER: "stoppe", "deaktiviere", "ausschalten", "Bots aus"
   Parameter: keine

4. set_bot_speed - Bot-Geschwindigkeit setzen
   Parameter: seconds (Intervall in Sekunden)

=== AUKTIONEN ===
5. create_auctions - Neue Auktionen erstellen (mehrere zufällige Produkte)
   Parameter: count (Anzahl), category (optional), duration_days (optional), auction_type (optional: "day", "night", "vip")

5b. create_single_auction - EINE einzelne Auktion für ein bestimmtes Produkt erstellen
   TRIGGER-WÖRTER: "eine Auktion", "Auto-Auktion", "Auto Auktion", "Auktion erstellen für", "mach mir eine Auktion"
   Parameter: 
   - name (Produktname, z.B. "Mercedes-Benz E-Klasse", "BMW 5er", "Audi A6")
   - value (Wert in Euro, z.B. 60000, 45000)
   - category (optional, Standard: "Auto" bei Auto-Begriffen)
   - duration_days (optional, Standard: 1)
   Beispiele:
   - "Mach mir eine Auto-Auktion, der Wert soll 60.000€ haben" -> {"action": "create_single_auction", "parameters": {"name": "Luxus-Auto", "value": 60000, "category": "Auto"}}
   - "Erstelle eine Auktion für einen Mercedes mit Wert 45000 Euro" -> {"action": "create_single_auction", "parameters": {"name": "Mercedes-Benz", "value": 45000, "category": "Auto"}}
   - "Eine Auktion für ein iPhone 15 Pro, Wert 1200€" -> {"action": "create_single_auction", "parameters": {"name": "iPhone 15 Pro", "value": 1200, "category": "Elektronik"}}
   
6. delete_auctions - Auktionen löschen
   Parameter: status ("ended" = nur beendete, "all" = alle Auktionen), older_than_days (optional, Standard: 0 = keine Zeitbegrenzung)

7. extend_auction - Auktion verlängern
   Parameter: auction_id, hours (Stunden)
   
8. set_auction_of_day - Auktion des Tages setzen
   Parameter: auction_id oder "auto" für automatische Auswahl

=== BENUTZER ===
9. add_bids_to_user - Gebote zu einem Benutzer hinzufügen
   Parameter: email, amount

10. ban_user - Benutzer sperren
    Parameter: email, reason (optional)
   
11. unban_user - Benutzer entsperren
    Parameter: email

12. make_vip - Benutzer zum VIP machen
    Parameter: email, duration_days (optional, 30 = Standard)

13. remove_vip - VIP-Status entfernen
    Parameter: email

=== GUTSCHEINE ===
14. create_voucher - Gutscheincode erstellen
    Parameter: bids (Anzahl Gebote), code (optional, wird generiert), max_uses (optional)

=== PRODUKTE & ÜBERSETZUNGEN ===
15. translate_products - Alle Produkte übersetzen (Namen und Beschreibungen)
    TRIGGER-WÖRTER: "übersetze Produkte", "Produktübersetzung", "übersetze alle Produkte", "Produkte in andere Sprachen", "Die Seite soll übersetzt werden"
    Parameter: 
    - languages (Liste: en, tr, fr, sq, ar - optional, Standard: alle verfügbaren)
    - force (boolean - wenn true, werden ALLE Produkte neu übersetzt, auch wenn schon Übersetzungen existieren)
    Beispiele:
    - "Übersetze alle Produkte" -> {"action": "translate_products", "parameters": {"languages": ["en", "tr", "fr", "sq", "ar"]}}
    - "Die Seite soll übersetzt werden" -> {"action": "translate_products", "parameters": {"languages": ["en", "tr", "fr", "sq", "ar"]}}
    - "Produkte erneut übersetzen" -> {"action": "translate_products", "parameters": {"languages": ["en", "tr", "fr", "sq", "ar"], "force": true}}
    - "Alle Produkte neu übersetzen" -> {"action": "translate_products", "parameters": {"languages": ["en", "tr", "fr", "sq", "ar"], "force": true}}

16. check_translations - Übersetzungen überprüfen und Status anzeigen
    TRIGGER-WÖRTER: "Übersetzung überprüfen", "Übersetzungen prüfen", "Übersetzung funktioniert nicht", "Übersetzungsstatus", "Seitenübersetzung prüfen", "check translation"
    Parameter: keine
    Beispiele:
    - "Überprüfe die Übersetzungen" -> {"action": "check_translations", "parameters": {}}
    - "Übersetzung überprüfen" -> {"action": "check_translations", "parameters": {}}
    - "Die Übersetzung funktioniert nicht so richtig" -> {"action": "check_translations", "parameters": {}}
    - "Du musst die Übersetzung überprüfen" -> {"action": "check_translations", "parameters": {}}

=== INFLUENCER ===
17. approve_influencer - Influencer-Bewerbung genehmigen
    Parameter: email

18. show_pending_payouts - Offene Auszahlungsanfragen zeigen
    Parameter: keine

=== SYSTEM ===
19. get_stats - Statistiken abrufen
    Parameter: type (users/auctions/revenue/today)

20. send_notification - Benachrichtigung an alle senden
    Parameter: title, message

21. maintenance_mode - Wartungsmodus ein/ausschalten
    Parameter: enabled (true/false)

22. send_test_email - Test-E-Mail senden
    Parameter: email

23. export_users - Benutzer exportieren
    Parameter: format (csv/json)

24. create_backup - Datenbank-Backup erstellen
    Parameter: keine

25. create_report - Bericht erstellen (Woche/Monat)
    Parameter: period (week/month)

26. chat - Allgemeine Fragen beantworten, Empfehlungen geben, beraten
    Parameter: response (deine ausführliche Antwort auf die Frage)
    VERWENDE DIESE AKTION wenn der Benutzer:
    - Eine Frage stellt ("Was...", "Wie...", "Warum...", "Kannst du...", "Empfiehlst du...")
    - Um Rat oder Empfehlungen bittet
    - Allgemeine Informationen über die Plattform möchte
    - Keine spezifische Aktion ausführen möchte
    
27. unknown - NUR wenn der Befehl wirklich nicht verstanden wird

WICHTIG: Wenn jemand eine FRAGE stellt oder um EMPFEHLUNGEN bittet, verwende IMMER "chat" mit einer hilfreichen Antwort!

Antworte NUR mit einem JSON-Objekt im folgenden Format:
{
  "action": "action_name",
  "parameters": {...},
  "confirmation_message": "Menschlich lesbare Bestätigung",
  "needs_confirmation": true/false
}

BEISPIELE FÜR CHAT (SEHR WICHTIG):
- "Was empfiehlst du mir?" -> {"action": "chat", "parameters": {"response": "Als KI-Assistent für bidblitz.ae empfehle ich folgende Verbesserungen: 1) Mehr Produkte hinzufügen, 2) Influencer-Marketing verstärken, 3) Nachtauktionen ausbauen..."}, "confirmation_message": "Hier sind meine Empfehlungen", "needs_confirmation": false}
- "Wie funktioniert das System?" -> {"action": "chat", "parameters": {"response": "bidblitz.ae ist eine Penny-Auktions-Plattform..."}, "confirmation_message": "Hier ist die Erklärung", "needs_confirmation": false}
- "Was sind die besten Features?" -> {"action": "chat", "parameters": {"response": "Die besten Features sind..."}, "confirmation_message": "Hier sind die Features", "needs_confirmation": false}

BEISPIELE FÜR BOT-BEFEHLE (SEHR WICHTIG):
- "Erstelle 50 Bots mit albanischen Namen" -> {"action": "create_bots", "parameters": {"count": 50, "nationality": "albanian"}, "confirmation_message": "Soll ich 50 neue Bots mit albanischen Namen erstellen?", "needs_confirmation": true}
- "50 neue Bots mit türkischen Namen" -> {"action": "create_bots", "parameters": {"count": 50, "nationality": "turkish"}, "confirmation_message": "Soll ich 50 neue Bots mit türkischen Namen erstellen?", "needs_confirmation": true}
- "Starte die Bots" -> {"action": "start_bots", "parameters": {}, "confirmation_message": "Soll ich die Bots starten?", "needs_confirmation": true}
- "Stoppe die Bots" -> {"action": "stop_bots", "parameters": {}, "confirmation_message": "Soll ich alle Bots stoppen?", "needs_confirmation": true}

ANDERE BEISPIELE:
- "Erstelle 50 neue Auktionen" -> {"action": "create_auctions", "parameters": {"count": 50}, "confirmation_message": "Soll ich 50 neue Auktionen erstellen?", "needs_confirmation": true}
- "Sperre Benutzer test@email.de" -> {"action": "ban_user", "parameters": {"email": "test@email.de"}, "confirmation_message": "Soll ich den Benutzer test@email.de sperren?", "needs_confirmation": true}
- "Lösche alle Auktionen und erstelle 50 neue" -> {"action": "batch", "parameters": {"actions": [{"action": "delete_auctions", "parameters": {"status": "all"}}, {"action": "create_auctions", "parameters": {"count": 50}}]}, "confirmation_message": "Soll ich alle Auktionen löschen und dann 50 neue erstellen?", "needs_confirmation": true}
- "Zeige heutige Einnahmen" -> {"action": "get_stats", "parameters": {"type": "today"}, "confirmation_message": "Ich zeige Ihnen die heutigen Einnahmen.", "needs_confirmation": false}
- "Übersetze alle Produkte" -> {"action": "translate_products", "parameters": {"languages": ["en", "tr", "fr", "sq", "ar"]}, "confirmation_message": "Soll ich alle Produkte in die verfügbaren Sprachen übersetzen?", "needs_confirmation": true}
- "Die Seite soll komplett übersetzt werden" -> {"action": "translate_products", "parameters": {"languages": ["en", "tr", "fr", "sq", "ar"]}, "confirmation_message": "Soll ich alle Produkte in die verfügbaren Sprachen übersetzen?", "needs_confirmation": true}
- "Übersetzung überprüfen" -> {"action": "check_translations", "parameters": {}, "confirmation_message": "Ich überprüfe die Übersetzungen...", "needs_confirmation": false}
- "Du musst die Übersetzung überprüfen" -> {"action": "check_translations", "parameters": {}, "confirmation_message": "Ich überprüfe die Übersetzungen...", "needs_confirmation": false}
- "Die Übersetzung funktioniert nicht so richtig" -> {"action": "check_translations", "parameters": {}, "confirmation_message": "Ich überprüfe die Übersetzungen und zeige den Status...", "needs_confirmation": false}
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

# Helper function to execute actions internally (used by analyze-media)
async def execute_action_internal(action: str, parameters: dict, admin: dict) -> dict:
    """Execute a command action internally"""
    try:
        return await execute_command(action, parameters, admin)
    except Exception as e:
        logger.error(f"Internal action execution failed: {str(e)}")
        return {"success": False, "message": f"Fehler bei der Ausführung: {str(e)}"}

# ==================== COMMAND EXECUTION ====================

async def execute_command(action: str, parameters: dict, admin: dict) -> dict:
    """Execute the parsed command"""
    
    # ==================== BATCH COMMAND ====================
    if action == "batch":
        actions = parameters.get("actions", [])
        if not actions:
            return {"success": False, "message": "❌ Keine Aktionen im Batch angegeben"}
        
        results = []
        all_success = True
        
        for sub_action in actions:
            sub_action_name = sub_action.get("action")
            sub_params = sub_action.get("parameters", {})
            
            try:
                result = await execute_command(sub_action_name, sub_params, admin)
                results.append({
                    "action": sub_action_name,
                    "result": result
                })
                if not result.get("success"):
                    all_success = False
            except Exception as e:
                results.append({
                    "action": sub_action_name,
                    "result": {"success": False, "message": f"Fehler: {str(e)}"}
                })
                all_success = False
        
        # Build summary message
        messages = [r["result"].get("message", "") for r in results]
        summary = " | ".join(messages)
        
        logger.info(f"🎤 Voice command: Batch executed {len(actions)} actions by {admin['name']}")
        return {
            "success": all_success,
            "message": f"📦 Batch ({len(actions)} Aktionen): {summary}",
            "data": {"results": results}
        }
    
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
            
            # Handle name field - can be string or dict with language keys
            name = product.get("name", "Produkt")
            if isinstance(name, dict):
                name = name.get("de", name.get("en", "Produkt"))
            
            # Handle description field - can be string or dict with language keys
            description = product.get("description", "")
            if isinstance(description, dict):
                description = description.get("de", description.get("en", ""))
            
            auction = {
                "id": str(uuid.uuid4()),
                "product_id": product["id"],
                "title": name,
                "description": description,
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
        older_than_days = parameters.get("older_than_days", 0)
        
        query = {}
        
        # Status filter
        if status == "ended":
            query["status"] = "ended"
        # If status == "all", no status filter (deletes all)
        
        # Time filter (only if older_than_days > 0)
        if older_than_days and older_than_days > 0:
            cutoff = (datetime.now(timezone.utc) - __import__('datetime').timedelta(days=older_than_days)).isoformat()
            query["end_time"] = {"$lt": cutoff}
        
        # Count before delete for better feedback
        count_before = await db.auctions.count_documents(query)
        
        if count_before == 0:
            return {"success": True, "message": "ℹ️ Keine Auktionen gefunden, die den Kriterien entsprechen."}
        
        result = await db.auctions.delete_many(query)
        
        status_text = "alle" if status == "all" else "beendeten"
        logger.info(f"🎤 Voice command: Deleted {result.deleted_count} {status_text} auctions by {admin['name']}")
        return {"success": True, "message": f"✅ {result.deleted_count} {status_text} Auktionen gelöscht!"}
    
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
    
    # ==================== NEUE BEFEHLE ====================
    
    elif action == "ban_user":
        email = parameters.get("email")
        reason = parameters.get("reason", "Admin-Entscheidung")
        
        if not email:
            return {"success": False, "message": "E-Mail-Adresse fehlt"}
        
        result = await db.users.update_one(
            {"email": email},
            {"$set": {"is_banned": True, "ban_reason": reason, "banned_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        if result.modified_count == 0:
            return {"success": False, "message": f"Benutzer {email} nicht gefunden"}
        
        logger.info(f"🎤 Voice command: Banned user {email} by {admin['name']}")
        return {"success": True, "message": f"🚫 Benutzer {email} wurde gesperrt!"}
    
    elif action == "unban_user":
        email = parameters.get("email")
        
        if not email:
            return {"success": False, "message": "E-Mail-Adresse fehlt"}
        
        result = await db.users.update_one(
            {"email": email},
            {"$set": {"is_banned": False}, "$unset": {"ban_reason": "", "banned_at": ""}}
        )
        
        if result.modified_count == 0:
            return {"success": False, "message": f"Benutzer {email} nicht gefunden"}
        
        logger.info(f"🎤 Voice command: Unbanned user {email} by {admin['name']}")
        return {"success": True, "message": f"✅ Benutzer {email} wurde entsperrt!"}
    
    elif action == "make_vip":
        email = parameters.get("email")
        duration_days = parameters.get("duration_days", 30)
        
        if not email:
            return {"success": False, "message": "E-Mail-Adresse fehlt"}
        
        expires_at = (datetime.now(timezone.utc) + __import__('datetime').timedelta(days=duration_days)).isoformat()
        
        result = await db.users.update_one(
            {"email": email},
            {"$set": {"is_vip": True, "vip_expires_at": expires_at}}
        )
        
        if result.modified_count == 0:
            return {"success": False, "message": f"Benutzer {email} nicht gefunden"}
        
        logger.info(f"🎤 Voice command: Made {email} VIP for {duration_days} days by {admin['name']}")
        return {"success": True, "message": f"👑 {email} ist jetzt VIP für {duration_days} Tage!"}
    
    elif action == "remove_vip":
        email = parameters.get("email")
        
        if not email:
            return {"success": False, "message": "E-Mail-Adresse fehlt"}
        
        result = await db.users.update_one(
            {"email": email},
            {"$set": {"is_vip": False}, "$unset": {"vip_expires_at": ""}}
        )
        
        if result.modified_count == 0:
            return {"success": False, "message": f"Benutzer {email} nicht gefunden"}
        
        logger.info(f"🎤 Voice command: Removed VIP from {email} by {admin['name']}")
        return {"success": True, "message": f"✅ VIP-Status von {email} entfernt!"}
    
    elif action == "create_voucher":
        import random
        import string
        
        bids = parameters.get("bids", 10)
        code = parameters.get("code", ''.join(random.choices(string.ascii_uppercase + string.digits, k=8)))
        max_uses = parameters.get("max_uses", 1)
        
        voucher = {
            "id": str(uuid.uuid4()),
            "code": code.upper(),
            "type": "bids",
            "value": bids,
            "max_uses": max_uses,
            "current_uses": 0,
            "is_active": True,
            "created_by": admin["id"],
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.vouchers.insert_one(voucher)
        
        logger.info(f"🎤 Voice command: Created voucher {code} with {bids} bids by {admin['name']}")
        return {"success": True, "message": f"🎟️ Gutscheincode erstellt: {code} ({bids} Gebote)", "data": {"code": code}}
    
    elif action == "extend_auction":
        auction_id = parameters.get("auction_id")
        hours = parameters.get("hours", 1)
        
        if not auction_id:
            return {"success": False, "message": "Auktions-ID fehlt"}
        
        auction = await db.auctions.find_one({"id": auction_id}, {"_id": 0})
        if not auction:
            return {"success": False, "message": f"Auktion {auction_id} nicht gefunden"}
        
        # Extend time
        new_end_time = datetime.fromisoformat(auction["end_time"].replace("Z", "+00:00")) + __import__('datetime').timedelta(hours=hours)
        
        await db.auctions.update_one(
            {"id": auction_id},
            {"$set": {"end_time": new_end_time.isoformat()}, "$inc": {"time_remaining": hours * 3600}}
        )
        
        logger.info(f"🎤 Voice command: Extended auction {auction_id} by {hours}h by {admin['name']}")
        return {"success": True, "message": f"⏰ Auktion um {hours} Stunden verlängert!"}
    
    elif action == "start_bots":
        # Set bot status in database
        await db.settings.update_one(
            {"key": "bots_enabled"},
            {"$set": {"key": "bots_enabled", "value": True}},
            upsert=True
        )
        
        logger.info(f"🎤 Voice command: Started bots by {admin['name']}")
        return {"success": True, "message": "🤖 Bots wurden gestartet!"}
    
    elif action == "stop_bots":
        await db.settings.update_one(
            {"key": "bots_enabled"},
            {"$set": {"key": "bots_enabled", "value": False}},
            upsert=True
        )
        
        logger.info(f"🎤 Voice command: Stopped bots by {admin['name']}")
        return {"success": True, "message": "🛑 Bots wurden gestoppt!"}
    
    elif action == "set_bot_speed":
        seconds = parameters.get("seconds", 4)
        seconds = max(1, min(30, seconds))  # Between 1 and 30 seconds
        
        await db.settings.update_one(
            {"key": "bot_interval"},
            {"$set": {"key": "bot_interval", "value": seconds}},
            upsert=True
        )
        
        logger.info(f"🎤 Voice command: Set bot speed to {seconds}s by {admin['name']}")
        return {"success": True, "message": f"⚡ Bot-Geschwindigkeit auf {seconds} Sekunden gesetzt!"}
    
    elif action == "create_bots":
        count = parameters.get("count", 10)
        count = min(count, 200)  # Max 200 at a time
        nationality = parameters.get("nationality", "german").lower()
        
        # Name lists by nationality
        name_lists = {
            "german": {
                "first": ["Max", "Anna", "Felix", "Marie", "Leon", "Sophie", "Paul", "Emma", "Jonas", "Lena", "Tim", "Laura", "Lukas", "Julia", "Noah", "Mia", "Finn", "Leonie", "Ben", "Hannah", "Elias", "Lea", "Niklas", "Sarah", "David", "Lisa", "Moritz", "Jana", "Julian", "Amelie"],
                "last": ["Müller", "Schmidt", "Schneider", "Fischer", "Weber", "Meyer", "Wagner", "Becker", "Schulz", "Hoffmann", "Schäfer", "Koch", "Bauer", "Richter", "Klein", "Wolf", "Schröder", "Neumann", "Schwarz", "Zimmermann", "Braun", "Krüger", "Hofmann", "Hartmann", "Lange"]
            },
            "albanian": {
                "first": ["Arben", "Albina", "Besnik", "Besa", "Driton", "Drita", "Erion", "Erjona", "Fatmir", "Flora", "Genti", "Greta", "Ilir", "Iliriana", "Kujtim", "Kaltrina", "Luan", "Luiza", "Mentor", "Mirela", "Naim", "Nora", "Petrit", "Pranvera", "Qëndrim", "Qamile", "Rexhep", "Rozafa", "Shpëtim", "Shqipe", "Taulant", "Teuta", "Valdrin", "Violeta", "Xhevat", "Xhevahire", "Ylber", "Yllka", "Zamir", "Zamira"],
                "last": ["Hoxha", "Shehu", "Leka", "Basha", "Gjoka", "Kelmendi", "Berisha", "Rama", "Osmani", "Gashi", "Hajdari", "Shala", "Krasniqi", "Halili", "Maloku", "Bytyqi", "Hasani", "Rugova", "Ahmeti", "Mustafa"]
            },
            "turkish": {
                "first": ["Ahmet", "Ayşe", "Mehmet", "Fatma", "Mustafa", "Emine", "Ali", "Hatice", "Hüseyin", "Zeynep", "Hasan", "Elif", "İbrahim", "Merve", "Yusuf", "Büşra", "Osman", "Esra", "Ömer", "Selin", "Emre", "Derya", "Can", "Cansu", "Burak", "Deniz"],
                "last": ["Yılmaz", "Kaya", "Demir", "Şahin", "Çelik", "Yıldız", "Yıldırım", "Öztürk", "Aydın", "Özdemir", "Arslan", "Doğan", "Kılıç", "Aslan", "Çetin", "Kara", "Koç", "Kurt", "Özkan", "Şimşek"]
            },
            "arabic": {
                "first": ["Ahmed", "Fatima", "Mohamed", "Aisha", "Ali", "Maryam", "Omar", "Layla", "Ibrahim", "Nour", "Hassan", "Zahra", "Youssef", "Sara", "Khalid", "Hana", "Karim", "Rania", "Tariq", "Dina"],
                "last": ["Al-Hassan", "Al-Ahmad", "Al-Salem", "Al-Rashid", "Al-Nasser", "Al-Khalil", "Al-Mansour", "Al-Farsi", "Al-Qasim", "Al-Hamdi", "Al-Sabah", "Al-Jawad", "Al-Malik", "Al-Najjar", "Al-Bashir"]
            }
        }
        
        # Get names list or default to German
        names = name_lists.get(nationality, name_lists["german"])
        
        import random
        
        created_count = 0
        for _ in range(count):
            first_name = random.choice(names["first"])
            last_name = random.choice(names["last"])
            bot_name = f"{first_name} {last_name[0]}."
            
            bot = {
                "id": str(uuid.uuid4()),
                "name": bot_name,
                "nationality": nationality,
                "is_active": True,
                "total_bids": 0,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            
            await db.bots.insert_one(bot)
            created_count += 1
        
        nationality_names = {
            "german": "deutschen",
            "albanian": "albanischen",
            "turkish": "türkischen",
            "arabic": "arabischen"
        }
        
        logger.info(f"🎤 Voice command: Created {created_count} {nationality} bots by {admin['name']}")
        return {
            "success": True, 
            "message": f"🤖 {created_count} neue Bots mit {nationality_names.get(nationality, nationality)} Namen erstellt!",
            "data": {"created": created_count, "nationality": nationality}
        }
    
    elif action == "approve_influencer":
        email = parameters.get("email")
        
        if not email:
            return {"success": False, "message": "E-Mail-Adresse fehlt"}
        
        # Find application
        application = await db.influencer_applications.find_one({"email": email}, {"_id": 0})
        if not application:
            return {"success": False, "message": f"Keine Bewerbung von {email} gefunden"}
        
        # Create influencer
        import random
        import string
        code = ''.join(random.choices(string.ascii_lowercase, k=6))
        
        influencer = {
            "id": str(uuid.uuid4()),
            "name": application.get("name", "Influencer"),
            "email": email,
            "code": code,
            "commission_percent": 10,
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.influencers.insert_one(influencer)
        
        # Update application status
        await db.influencer_applications.update_one(
            {"email": email},
            {"$set": {"status": "approved", "approved_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        logger.info(f"🎤 Voice command: Approved influencer {email} with code {code} by {admin['name']}")
        return {"success": True, "message": f"✅ Influencer {email} genehmigt! Code: {code}"}
    
    elif action == "show_pending_payouts":
        payouts = await db.influencer_payouts.find(
            {"status": "pending"},
            {"_id": 0}
        ).to_list(50)
        
        total = sum(p.get("amount", 0) for p in payouts)
        
        return {
            "success": True, 
            "message": f"💸 {len(payouts)} offene Auszahlungen (Gesamt: €{total:.2f})",
            "data": {"count": len(payouts), "total": total, "payouts": payouts[:10]}
        }
    
    elif action == "maintenance_mode":
        enabled = parameters.get("enabled", False)
        
        await db.settings.update_one(
            {"key": "maintenance_mode"},
            {"$set": {"key": "maintenance_mode", "value": enabled}},
            upsert=True
        )
        
        logger.info(f"🎤 Voice command: Maintenance mode {'enabled' if enabled else 'disabled'} by {admin['name']}")
        return {"success": True, "message": f"🔧 Wartungsmodus {'aktiviert' if enabled else 'deaktiviert'}!"}
    
    elif action == "send_test_email":
        from utils.email import send_email
        
        email = parameters.get("email")
        if not email:
            return {"success": False, "message": "E-Mail-Adresse fehlt"}
        
        try:
            await send_email(
                to_email=email,
                subject="🧪 bidblitz.ae Test-E-Mail",
                html_content=f"""
                <h1>Test-E-Mail</h1>
                <p>Diese E-Mail wurde von {admin['name']} über Sprachbefehl gesendet.</p>
                <p>Zeitstempel: {datetime.now(timezone.utc).isoformat()}</p>
                """
            )
            logger.info(f"🎤 Voice command: Sent test email to {email} by {admin['name']}")
            return {"success": True, "message": f"📧 Test-E-Mail an {email} gesendet!"}
        except Exception as e:
            return {"success": False, "message": f"E-Mail-Fehler: {str(e)}"}
    
    elif action == "export_users":
        format_type = parameters.get("format", "csv")
        
        users = await db.users.find(
            {},
            {"_id": 0, "password": 0}
        ).to_list(10000)
        
        if format_type == "csv":
            import csv
            import io
            
            if not users:
                return {"success": False, "message": "Keine Benutzer zum Exportieren"}
            
            # Create CSV
            output = io.StringIO()
            writer = csv.DictWriter(output, fieldnames=["id", "email", "name", "bids_balance", "is_vip", "created_at"])
            writer.writeheader()
            for user in users:
                writer.writerow({
                    "id": user.get("id"),
                    "email": user.get("email"),
                    "name": user.get("name"),
                    "bids_balance": user.get("bids_balance", 0),
                    "is_vip": user.get("is_vip", False),
                    "created_at": user.get("created_at")
                })
            
            csv_content = output.getvalue()
            
            # Save to file
            filename = f"users_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
            with open(f"/tmp/{filename}", "w") as f:
                f.write(csv_content)
            
            return {"success": True, "message": f"📊 {len(users)} Benutzer exportiert: /tmp/{filename}"}
        
        return {"success": True, "message": f"📊 {len(users)} Benutzer gefunden", "data": {"count": len(users)}}
    
    elif action == "create_backup":
        # Log backup request (actual backup would require more infrastructure)
        backup_id = str(uuid.uuid4())[:8]
        
        # Get counts for "backup info"
        users_count = await db.users.count_documents({})
        auctions_count = await db.auctions.count_documents({})
        
        logger.info(f"🎤 Voice command: Backup requested by {admin['name']} - ID: {backup_id}")
        return {
            "success": True, 
            "message": f"💾 Backup angefordert! ID: {backup_id}",
            "data": {"backup_id": backup_id, "users": users_count, "auctions": auctions_count}
        }
    
    elif action == "create_report":
        period = parameters.get("period", "week")
        days = 7 if period == "week" else 30
        
        cutoff = (datetime.now(timezone.utc) - __import__('datetime').timedelta(days=days)).isoformat()
        
        # Gather stats
        new_users = await db.users.count_documents({"created_at": {"$gte": cutoff}})
        new_auctions = await db.auctions.count_documents({"created_at": {"$gte": cutoff}})
        ended_auctions = await db.auctions.count_documents({"status": "ended", "end_time": {"$gte": cutoff}})
        
        period_name = "Woche" if period == "week" else "Monat"
        
        report = {
            "period": period_name,
            "new_users": new_users,
            "new_auctions": new_auctions,
            "ended_auctions": ended_auctions
        }
        
        logger.info(f"🎤 Voice command: Report created for {period} by {admin['name']}")
        return {
            "success": True, 
            "message": f"📈 {period_name}sbericht erstellt!",
            "data": report
        }
    
    elif action == "translate_products":
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        import os as os_module
        
        api_key = os_module.getenv("EMERGENT_LLM_KEY")
        if not api_key:
            return {"success": False, "message": "❌ API Key nicht konfiguriert"}
        
        # Default to all available languages if not specified
        target_languages = parameters.get("languages", ["en", "tr", "fr", "sq", "ar"])
        force_retranslate = parameters.get("force", False)  # Force re-translate even if already translated
        
        # Get all products (increased limit to 500)
        products = await db.products.find({}, {"_id": 0}).to_list(500)
        
        if not products:
            return {"success": False, "message": "❌ Keine Produkte zum Übersetzen gefunden"}
        
        translated_count = 0
        skipped_count = 0
        
        for product in products:
            # Get current name - handle both string and dict formats
            current_name = product.get("name", "")
            current_desc = product.get("description", "")
            
            if isinstance(current_name, dict):
                german_name = current_name.get("de", list(current_name.values())[0] if current_name else "")
            else:
                german_name = current_name
                
            if isinstance(current_desc, dict):
                german_desc = current_desc.get("de", list(current_desc.values())[0] if current_desc else "")
            else:
                german_desc = current_desc
            
            # Skip if no name or description
            if not german_name:
                skipped_count += 1
                continue
            
            # Check if already has all requested translations (unless force is enabled)
            existing_name_trans = product.get("name_translations") or {}
            existing_desc_trans = product.get("description_translations") or {}
            
            if not force_retranslate and all(lang in existing_name_trans for lang in target_languages):
                skipped_count += 1
                continue
            
            # Create translation prompt
            system_prompt = """Du bist ein professioneller Übersetzer für E-Commerce-Produktbeschreibungen.
Übersetze den gegebenen deutschen Produktnamen und die Beschreibung in die angeforderten Sprachen.
Achte auf korrekte Übersetzungen für jede Zielsprache.
Antworte NUR mit einem JSON-Objekt im Format:
{"name_translations": {"en": "...", "tr": "...", "fr": "...", "sq": "...", "ar": "..."}, "description_translations": {"en": "...", "tr": "...", "fr": "...", "sq": "...", "ar": "..."}}"""
            
            chat = LlmChat(
                api_key=api_key,
                session_id=f"translate-{product['id']}",
                system_message=system_prompt
            ).with_model("openai", "gpt-4o-mini")
            
            lang_names = {"en": "Englisch", "tr": "Türkisch", "fr": "Französisch", "sq": "Albanisch", "ar": "Arabisch"}
            lang_list = ", ".join([lang_names.get(l, l) for l in target_languages])
            
            user_prompt = f"""Übersetze in folgende Sprachen: {lang_list}

Produktname (Deutsch): {german_name}
Beschreibung (Deutsch): {german_desc if german_desc else "Keine Beschreibung vorhanden"}"""
            
            try:
                response = await chat.send_message(UserMessage(text=user_prompt))
                
                # Parse response
                response_text = response.strip()
                if "```" in response_text:
                    response_text = response_text.split("```")[1].replace("json", "").strip()
                
                translations = json.loads(response_text)
                
                # Build translations with German original
                name_trans = {"de": german_name, **translations.get("name_translations", {})}
                desc_trans = {"de": german_desc, **translations.get("description_translations", {})}
                
                # Update product with translations
                await db.products.update_one(
                    {"id": product["id"]},
                    {"$set": {
                        "name": german_name,  # Keep German as default name
                        "name_translations": name_trans,
                        "description": german_desc,
                        "description_translations": desc_trans
                    }}
                )
                translated_count += 1
                logger.info(f"✅ Translated product: {german_name}")
                
            except Exception as e:
                logger.error(f"Translation error for {product['id']}: {str(e)}")
                continue
        
        lang_names_de = {"en": "Englisch", "tr": "Türkisch", "fr": "Französisch", "sq": "Albanisch", "ar": "Arabisch"}
        lang_list_de = ", ".join([lang_names_de.get(l, l) for l in target_languages])
        
        logger.info(f"🎤 Voice command: Translated {translated_count} products by {admin['name']}")
        
        # Better message depending on results
        if translated_count == 0 and skipped_count > 0:
            message = f"✅ Alle {skipped_count} Produkte sind bereits in {lang_list_de} übersetzt! Benutze 'erneut übersetzen' um sie neu zu übersetzen."
        elif translated_count > 0:
            message = f"🌐 {translated_count} Produkte übersetzt in: {lang_list_de}! ({skipped_count} bereits übersetzt)"
        else:
            message = f"🌐 Übersetzung abgeschlossen. {translated_count} übersetzt, {skipped_count} übersprungen."
        
        return {
            "success": True,
            "message": message,
            "data": {"translated": translated_count, "skipped": skipped_count, "languages": target_languages}
        }
    
    elif action == "check_translations":
        """Check translation status for all products"""
        # Get all products (increased limit to 500)
        products = await db.products.find({}, {"_id": 0}).to_list(500)
        
        if not products:
            return {"success": False, "message": "❌ Keine Produkte in der Datenbank gefunden"}
        
        total_products = len(products)
        
        # Languages to check
        languages = ["de", "en", "tr", "fr", "sq", "ar"]
        lang_names = {"de": "Deutsch", "en": "Englisch", "tr": "Türkisch", "fr": "Französisch", "sq": "Albanisch", "ar": "Arabisch"}
        
        # Count products with translations
        fully_translated = 0
        partially_translated = 0
        not_translated = 0
        
        # Track which languages are missing
        missing_by_language = {lang: 0 for lang in languages}
        
        for product in products:
            name_trans = product.get("name_translations") or {}
            
            if not name_trans:
                not_translated += 1
                for lang in languages:
                    missing_by_language[lang] += 1
            else:
                missing_langs = [lang for lang in languages if lang not in name_trans]
                
                if not missing_langs:
                    fully_translated += 1
                else:
                    partially_translated += 1
                    for lang in missing_langs:
                        missing_by_language[lang] += 1
        
        # Build status message
        status_lines = [
            f"📊 **Übersetzungsstatus:**",
            f"",
            f"📦 Gesamt Produkte: {total_products}",
            f"✅ Vollständig übersetzt: {fully_translated}",
            f"⚠️ Teilweise übersetzt: {partially_translated}",
            f"❌ Nicht übersetzt: {not_translated}",
            f"",
            f"📝 **Fehlende Übersetzungen nach Sprache:**"
        ]
        
        for lang in languages:
            if lang == "de":
                continue  # Skip German as it's the source language
            count = missing_by_language[lang]
            status = "✅" if count == 0 else "⚠️"
            status_lines.append(f"{status} {lang_names[lang]}: {count} fehlend")
        
        # Calculate overall translation percentage
        max_translations = total_products * (len(languages) - 1)  # Exclude German
        actual_translations = sum(
            len([l for l in (product.get("name_translations") or {}).keys() if l != "de"])
            for product in products
        )
        percentage = round((actual_translations / max_translations) * 100, 1) if max_translations > 0 else 0
        
        status_lines.append(f"")
        status_lines.append(f"📈 Gesamtfortschritt: {percentage}%")
        
        if percentage < 100:
            status_lines.append(f"")
            status_lines.append(f"💡 Tipp: Sagen Sie 'Übersetze alle Produkte' um fehlende Übersetzungen zu erstellen")
        
        logger.info(f"🎤 Voice command: Translation check by {admin['name']} - {percentage}% complete")
        
        return {
            "success": True,
            "message": "\n".join(status_lines),
            "data": {
                "total_products": total_products,
                "fully_translated": fully_translated,
                "partially_translated": partially_translated,
                "not_translated": not_translated,
                "missing_by_language": missing_by_language,
                "percentage": percentage
            }
        }
    
    elif action == "chat":
        # Handle general questions and conversations
        response_text = parameters.get("response", "")
        if response_text:
            logger.info(f"🎤 Voice command: Chat response to {admin['name']}")
            return {
                "success": True,
                "message": response_text,
                "is_chat": True
            }
        else:
            return {
                "success": False,
                "message": "❌ Keine Antwort generiert"
            }
    
    else:
        return {"success": False, "message": "❌ Befehl nicht erkannt"}

# ==================== API ENDPOINTS ====================

class TextCommandRequest(BaseModel):
    text: str
    execute: bool = False

@router.post("/analyze-image")
async def analyze_image_command(
    request: Request,
    image: UploadFile = File(...),
    admin: dict = Depends(get_admin_user)
):
    """Analyze an uploaded image or video using GPT-4o Vision"""
    from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
    import base64
    
    # Get text from form data
    form = await request.form()
    text = form.get("text", "Analysiere diese Datei und beschreibe was du siehst.")
    
    api_key = os.getenv("EMERGENT_LLM_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="API Key nicht konfiguriert")
    
    # Check file type - accept images and videos
    content_type = image.content_type or ""
    is_video = content_type.startswith("video/")
    is_image = content_type.startswith("image/")
    
    if not is_image and not is_video:
        ext = image.filename.split(".")[-1].lower() if image.filename else ""
        if ext in ["png", "jpg", "jpeg", "gif", "webp"]:
            is_image = True
        elif ext in ["mp4", "mov", "avi", "webm", "mkv"]:
            is_video = True
        else:
            raise HTTPException(status_code=400, detail="Ungültiges Format. Erlaubt: PNG, JPG, GIF, WebP, MP4, MOV, WEBM")
    
    # Read content
    content = await image.read()
    
    # Check file size (max 20MB for videos, 10MB for images)
    max_size = 20 * 1024 * 1024 if is_video else 10 * 1024 * 1024
    if len(content) > max_size:
        raise HTTPException(status_code=400, detail=f"Datei zu groß (max {20 if is_video else 10}MB)")
    
    # For images, convert to PNG format for better compatibility
    if is_image:
        from PIL import Image as PILImage
        import io
        
        try:
            # Open image with PIL
            img = PILImage.open(io.BytesIO(content))
            
            # Convert to RGB if necessary (for RGBA or other modes)
            if img.mode in ('RGBA', 'LA', 'P'):
                img = img.convert('RGB')
            
            # Resize if too large (max 2000x2000)
            max_dim = 2000
            if img.width > max_dim or img.height > max_dim:
                ratio = min(max_dim / img.width, max_dim / img.height)
                new_size = (int(img.width * ratio), int(img.height * ratio))
                img = img.resize(new_size, PILImage.LANCZOS)
            
            # Convert to PNG bytes
            buffer = io.BytesIO()
            img.save(buffer, format='PNG')
            content = buffer.getvalue()
            
            logger.info(f"Image converted to PNG: {img.width}x{img.height}")
        except Exception as e:
            logger.warning(f"Could not convert image: {str(e)}")
    
    # Convert to base64
    base64_content = base64.b64encode(content).decode('utf-8')
    
    try:
        # Check if the user wants to execute an action instead of just analyzing
        action_keywords = {
            "translate_products": ["übersetze", "übersetz", "übersetzen", "translation", "sprache", "sprachen", "englisch", "türkisch", "andere sprachen"],
            "check_translations": ["übersetzung prüfen", "übersetzungen prüfen", "übersetzung überprüfen", "translation check"],
            "create_auctions": ["erstelle auktionen", "neue auktionen", "auktionen erstellen"],
            "create_bots": ["erstelle bots", "neue bots", "bots erstellen"],
            "start_bots": ["starte bots", "bots starten", "bots aktivieren"],
            "stop_bots": ["stoppe bots", "bots stoppen", "bots deaktivieren"],
        }
        
        text_lower = text.lower()
        detected_action = None
        
        for action, keywords in action_keywords.items():
            if any(kw in text_lower for kw in keywords):
                detected_action = action
                break
        
        # If an action is detected, execute it first
        if detected_action:
            logger.info(f"🎯 Action detected in media request: {detected_action}")
            
            # Execute the action
            action_params = {}
            if detected_action == "translate_products":
                action_params = {"languages": ["en", "tr", "fr", "sq", "ar"]}
            
            # Use the existing confirm-execute logic
            action_result = await execute_action_internal(detected_action, action_params, admin)
            
            # Create a response combining action result and image analysis
            action_response = f"✅ **Aktion ausgeführt: {detected_action}**\n\n{action_result.get('message', 'Aktion erfolgreich')}\n\n"
            
            # Now also analyze the image if present
            system_prompt_with_action = f"""Du bist ein hilfreicher Admin-Assistent für die bidblitz.ae Penny-Auktions-Plattform.

Der Administrator hat gerade die Aktion '{detected_action}' ausgeführt.
Ergebnis: {action_result.get('message', 'Erfolgreich')}

Wenn dir ein Screenshot oder Video gezeigt wird:
1. Beschreibe kurz was du siehst
2. Erkläre, wie die ausgeführte Aktion das angezeigte Problem lösen könnte
3. Gib weitere Empfehlungen, falls nötig

Antworte auf Deutsch und sei präzise und hilfreich."""

            chat = LlmChat(
                api_key=api_key,
                session_id=f"media-analysis-{uuid.uuid4()}",
                system_message=system_prompt_with_action
            ).with_model("openai", "gpt-4.1")
            
            media_content = ImageContent(
                image_base64=base64_content
            )
            
            media_type_text = "Video" if is_video else "Bild"
            user_prompt = f"""Benutzeranfrage: {text}

Bitte analysiere das hochgeladene {media_type_text} im Kontext der ausgeführten Aktion."""
            
            response = await chat.send_message(UserMessage(
                text=user_prompt,
                file_contents=[media_content]
            ))
            
            full_response = action_response + "---\n\n**Bildanalyse:**\n" + response
            
            # Log to history
            await db.voice_command_history.insert_one({
                "id": str(uuid.uuid4()),
                "admin_id": admin["id"],
                "admin_name": admin["name"],
                "transcription": f"[{media_type_text} + Aktion] {text}",
                "action": detected_action,
                "parameters": action_params,
                "result": {"success": True, "message": full_response[:500]},
                "created_at": datetime.now(timezone.utc)
            })
            
            return {
                "success": True,
                "analysis": full_response,
                "query": text,
                "type": "video" if is_video else "image",
                "action_executed": detected_action,
                "action_result": action_result
            }
        
        # No action detected, just analyze the image
        # Create chat with GPT-4o for vision
        system_prompt = """Du bist ein hilfreicher Admin-Assistent für die bidblitz.ae Penny-Auktions-Plattform.
        
Wenn dir ein Screenshot oder Video gezeigt wird:
1. Beschreibe was du siehst
2. Identifiziere mögliche Probleme oder Bugs
3. Schlage Lösungen vor
4. Wenn es sich um UI-Probleme handelt, beschreibe konkret was verbessert werden sollte

Antworte auf Deutsch und sei präzise und hilfreich."""

        chat = LlmChat(
            api_key=api_key,
            session_id=f"media-analysis-{uuid.uuid4()}",
            system_message=system_prompt
        ).with_model("openai", "gpt-4.1")
        
        # Create content object
        media_content = ImageContent(
            image_base64=base64_content
        )
        
        # Create message with media attachment
        media_type_text = "Video" if is_video else "Bild"
        user_prompt = f"""Benutzeranfrage: {text}

Bitte analysiere das hochgeladene {media_type_text} und beantworte die Frage des Administrators."""
        
        response = await chat.send_message(UserMessage(
            text=user_prompt,
            file_contents=[media_content]
        ))
        
        logger.info(f"🖼️ {media_type_text} analyzed by {admin['name']}: {text[:50]}...")
        
        # Log to history
        await db.voice_command_history.insert_one({
            "id": str(uuid.uuid4()),
            "admin_id": admin["id"],
            "admin_name": admin["name"],
            "transcription": f"[{media_type_text}analyse] {text}",
            "action": "analyze_image",
            "parameters": {"type": "video" if is_video else "image"},
            "result": {"success": True, "message": response[:200] + "..." if len(response) > 200 else response},
            "created_at": datetime.now(timezone.utc)
        })
        
        return {
            "success": True,
            "analysis": response,
            "query": text,
            "type": "video" if is_video else "image"
        }
        
    except Exception as e:
        logger.error(f"Image analysis error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Bildanalyse fehlgeschlagen: {str(e)}")

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
    request: Request,
    admin: dict = Depends(get_admin_user)
):
    """Execute a confirmed command"""
    
    # Get action and parameters from request body
    body = await request.json()
    action = body.get("action")
    parameters = body.get("parameters", {})
    
    if not action:
        raise HTTPException(status_code=400, detail="Action is required")
    
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
