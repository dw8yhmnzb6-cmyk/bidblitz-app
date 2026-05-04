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

        # Async lead-scoring: don't block response, but trigger if email known
        try:
            import asyncio
            asyncio.create_task(_score_session_lead(req.session_id, api_key))
        except Exception as score_err:
            log.warning(f"Lead-scoring task failed: {score_err}")

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
# LEAD SCORING (LLM-based hot-lead detection)
# ═══════════════════════════════════════════════════════════════════════

LEAD_SCORING_SYSTEM_PROMPT = """Du bist ein Lead-Qualifikations-Experte für BidBlitz (B2C+B2B Super-App).
Analysiere die Konversation und gib einen Score 0-100 basierend auf:
- Buying-Intent (konkrete Demo/Preis-Fragen → hoch)
- Use-Case Klarheit (Branche, Größe, konkretes Problem → hoch)
- Engagement-Tiefe (mehrere Turns, spezifische Features → hoch)
- Lead-Daten (Name, Firma, Email genannt → hoch)

Antworte AUSSCHLIESSLICH im exakten Format:
SCORE: <Zahl 0-100>
CATEGORY: <hot|warm|cold>
REASON: <max 80 Zeichen, deutsch>
TAGS: <komma-getrennt, max 4 Tags wie 'restaurant', 'pos', 'enterprise', 'demo-anfrage'>"""


async def _score_session_lead(session_id: str, api_key: str):
    """Background task: score a chat session's lead using LLM."""
    try:
        history = await db.landing_chatbot_messages.find(
            {"session_id": session_id}
        ).sort("timestamp", 1).to_list(50)

        if len(history) < 2:
            return  # Not enough conversation yet

        # Find associated lead (if email captured)
        lead = await db.landing_leads.find_one({"session_id": session_id})

        # Build conversation summary for scoring
        convo_text = "\n".join([
            f"{m['role'].upper()}: {m.get('content', '')[:300]}"
            for m in history[-20:]  # last 20 turns
        ])

        from emergentintegrations.llm.chat import LlmChat, UserMessage
        scorer = LlmChat(
            api_key=api_key,
            session_id=f"score_{session_id}",
            system_message=LEAD_SCORING_SYSTEM_PROMPT,
        ).with_model("openai", "gpt-4.1-mini")

        response = await scorer.send_message(UserMessage(text=convo_text))

        # Parse response
        score = 0
        category = "cold"
        reason = ""
        tags = []
        for line in response.split("\n"):
            line = line.strip()
            if line.startswith("SCORE:"):
                try:
                    score = int("".join(c for c in line[6:] if c.isdigit()) or "0")
                    score = max(0, min(100, score))
                except Exception:
                    score = 0
            elif line.startswith("CATEGORY:"):
                category = line[9:].strip().lower() or "cold"
            elif line.startswith("REASON:"):
                reason = line[7:].strip()[:200]
            elif line.startswith("TAGS:"):
                tags = [t.strip().lower() for t in line[5:].split(",") if t.strip()][:4]

        scored_at = datetime.now(timezone.utc).isoformat()
        score_doc = {
            "session_id": session_id,
            "score": score,
            "category": category,
            "reason": reason,
            "tags": tags,
            "scored_at": scored_at,
            "model": "gpt-4.1-mini",
        }

        # Upsert into lead_scores collection (one doc per session)
        await db.landing_lead_scores.update_one(
            {"session_id": session_id},
            {"$set": score_doc},
            upsert=True,
        )

        # If a lead exists for this session, also write directly on the lead doc
        if lead:
            await db.landing_leads.update_one(
                {"_id": lead["_id"]},
                {"$set": {
                    "lead_score": score,
                    "lead_category": category,
                    "lead_score_reason": reason,
                    "lead_tags": tags,
                    "lead_scored_at": scored_at,
                }},
            )

        log.info(f"Lead scored for session {session_id}: {score}/{category}")
    except Exception as e:
        log.warning(f"_score_session_lead failed for {session_id}: {e}")


@router.post("/score-session")
async def score_session_now(session_id: str, request: Request):
    """Manually re-score a session (admin only)."""
    from core.security import get_current_user
    user = await get_current_user(request)
    if user.get("role") != "admin" and not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin only")

    api_key = os.environ.get('EMERGENT_LLM_KEY')
    if not api_key:
        raise HTTPException(status_code=500, detail="LLM key not configured")

    await _score_session_lead(session_id, api_key)
    score = await db.landing_lead_scores.find_one({"session_id": session_id}, {"_id": 0})
    return {"ok": True, "session_id": session_id, "score": score}


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
    ).to_list(500)

    # Sort: score desc first, then captured_at desc
    leads.sort(key=lambda l: (
        -(l.get("lead_score") or 0),
        -(0 if not l.get("captured_at") else int(l.get("captured_at", "")[:10].replace("-", "") or 0)),
    ))

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

    # Time-series: messages per day (last 14 days)
    from datetime import timedelta
    cutoff = (datetime.now(timezone.utc) - timedelta(days=14)).isoformat()
    recent = await db.landing_chatbot_messages.find(
        {"timestamp": {"$gte": cutoff}, "role": "user"},
        {"_id": 0, "timestamp": 1, "content": 1}
    ).to_list(5000)

    daily = {}
    word_freq = {}
    stop_words = {"ich", "der", "die", "das", "und", "ist", "ein", "eine", "wie", "was", "von", "zu", "ihr", "wir", "mit", "auf", "für", "es", "im", "den", "dem", "kann", "bei", "an", "aus", "so", "auch", "wenn", "nicht", "or", "in"}

    for m in recent:
        try:
            day = m["timestamp"][:10]
            daily[day] = daily.get(day, 0) + 1
            content = (m.get("content") or "").lower()
            for w in content.split():
                w = "".join(c for c in w if c.isalpha())
                if len(w) >= 4 and w not in stop_words:
                    word_freq[w] = word_freq.get(w, 0) + 1
        except Exception:
            continue

    series = sorted([{"date": d, "count": c} for d, c in daily.items()], key=lambda x: x["date"])
    top_topics = sorted(word_freq.items(), key=lambda x: -x[1])[:10]
    top_topics = [{"word": w, "count": c} for w, c in top_topics]

    # Lead funnel: sessions → had_email_request → captured_lead
    lead_emails = set([
        l.get("email")
        for l in await db.landing_leads.find({}, {"_id": 0, "email": 1}).to_list(5000)
        if l.get("email")
    ])

    return {
        "total_sessions": len(total_sessions),
        "total_messages": total_messages,
        "total_leads": total_leads,
        "conversion_rate": round(total_leads / max(len(total_sessions), 1) * 100, 2),
        "messages_per_day": series,
        "top_topics": top_topics,
        "unique_lead_emails": len(lead_emails),
    }


@router.get("/leads/export")
async def export_leads_csv(request: Request):
    """Export all leads as CSV (admin only)."""
    from core.security import get_current_user
    from fastapi.responses import Response
    user = await get_current_user(request)
    if user.get("role") != "admin" and not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin only")

    leads = await db.landing_leads.find({}, {"_id": 0}).sort("captured_at", -1).to_list(10000)

    import io
    import csv
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["email", "name", "interest", "source", "session_id", "captured_at", "created_at"])
    for l in leads:
        writer.writerow([
            l.get("email", ""),
            l.get("name", ""),
            l.get("interest", ""),
            l.get("source", ""),
            l.get("session_id", ""),
            l.get("captured_at", ""),
            l.get("created_at", ""),
        ])

    csv_content = buf.getvalue()
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="bidblitz-leads-{datetime.now(timezone.utc).strftime("%Y%m%d")}.csv"',
        },
    )


class SalesInviteRequest(BaseModel):
    email: str
    lead_name: Optional[str] = None
    custom_message: Optional[str] = None

@router.post("/leads/sales-invite")
async def create_sales_invite(req: SalesInviteRequest, request: Request):
    """Generate 1:1 LiveKit room + send invite email to lead (admin only)."""
    from core.security import get_current_user
    from core.email import send_email, send_email_detailed, get_base_template
    user = await get_current_user(request)
    if user.get("role") != "admin" and not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin only")

    # Generate unique room name
    import secrets as _secrets
    room_name = f"sales-{_secrets.token_urlsafe(8)}"

    # Insert into livekit_rooms collection
    await db.livekit_rooms.insert_one({
        "room_id": "SAL" + _secrets.token_urlsafe(7),
        "room_name": room_name,
        "creator_id": str(user["_id"]),
        "max_participants": 2,
        "status": "active",
        "is_live_shopping": False,
        "is_sales_call": True,
        "lead_email": req.email,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    # Build join URL (lead lands on /livekit-stream and sees the room)
    frontend_url = os.environ.get("FRONTEND_URL") or "https://bidblitz.ae"
    join_url = f"{frontend_url}/livekit-stream"

    # Mark lead as contacted
    await db.landing_leads.update_one(
        {"email": req.email},
        {"$set": {
            "last_sales_call_at": datetime.now(timezone.utc).isoformat(),
            "last_sales_call_room": room_name,
        }},
        upsert=False,
    )

    # Send invite email
    greeting = f"Hallo {req.lead_name}," if req.lead_name else "Hallo,"
    custom_block = (
        f'<p style="color:#AAA;font-size:14px;line-height:1.6;margin:0 0 20px;font-style:italic;">"{req.custom_message}"</p>'
        if req.custom_message else ''
    )
    content = f"""
        <h2 style="color:#fff;font-size:20px;margin:0 0 15px;">📹 Persönliche Demo bei BidBlitz</h2>
        <p style="color:#AAA;font-size:14px;line-height:1.6;margin:0 0 15px;">{greeting}</p>
        <p style="color:#AAA;font-size:14px;line-height:1.6;margin:0 0 20px;">
            Wir haben deine Anfrage erhalten und möchten dir BidBlitz live zeigen — kein Aufnahmegespräch, einfach 1:1 Video-Demo.
        </p>
        {custom_block}
        <div style="background:#111;border-radius:12px;padding:20px;margin:0 0 25px;">
            <p style="color:#fff;font-size:14px;margin:0 0 8px;font-weight:600;">Dein persönlicher Raum:</p>
            <p style="color:#00C2FF;font-size:13px;font-family:monospace;margin:0;">{room_name}</p>
        </div>
        <a href="{join_url}" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#00C2FF,#0090FF);color:#000;text-decoration:none;border-radius:12px;font-weight:600;font-size:14px;">
            Demo-Call starten
        </a>
        <p style="color:#666;font-size:12px;margin:25px 0 0;">
            Klicke einfach den Button — du brauchst keinen Account, nur Kamera & Mikrofon.
        </p>
    """
    html = get_base_template(content, "Persönliche Demo - BidBlitz")
    email_result = send_email_detailed(req.email, "📹 Persönliche BidBlitz Demo", html)

    return {
        "ok": True,
        "room_name": room_name,
        "join_url": join_url,
        "email_sent": email_result["sent"],
        "email_reason": email_result["reason"],
        "email_error": email_result.get("error"),
        "resend_enabled": email_result["resend_enabled"],
        "lead_email": req.email,
    }


@router.get("/health")
async def chatbot_health():
    return {"status": "ok", "model": "gpt-4.1-mini", "provider": "openai"}
