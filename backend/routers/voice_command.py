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

WICHTIG: Bei kombinierten Befehlen (z.B. "Lösche alle Auktionen und erstelle 50 neue") verwende die "batch" Aktion!

Verfügbare Aktionen:

=== BATCH (FÜR KOMBINIERTE BEFEHLE) ===
0. batch - Mehrere Aktionen nacheinander ausführen
   Parameter: actions (Array von Aktionen, jede mit "action" und "parameters")
   Beispiel: {"action": "batch", "parameters": {"actions": [{"action": "delete_auctions", "parameters": {"status": "ended"}}, {"action": "create_auctions", "parameters": {"count": 50}}]}}

=== AUKTIONEN ===
1. create_auctions - Neue Auktionen erstellen
   Parameter: count (Anzahl), category (optional), duration_days (optional)
   
2. delete_auctions - Auktionen löschen
   Parameter: status ("ended" = nur beendete, "all" = alle Auktionen), older_than_days (optional, Standard: 0 = keine Zeitbegrenzung)

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
- "Lösche alle Auktionen und erstelle 50 neue" -> {"action": "batch", "parameters": {"actions": [{"action": "delete_auctions", "parameters": {"status": "all"}}, {"action": "create_auctions", "parameters": {"count": 50}}]}, "confirmation_message": "Soll ich alle Auktionen löschen und dann 50 neue erstellen?", "needs_confirmation": true}
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
                subject="🧪 BidBlitz Test-E-Mail",
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
