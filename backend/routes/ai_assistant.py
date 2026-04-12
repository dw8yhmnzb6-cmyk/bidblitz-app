"""
BidBlitz V2 - AI Financial Assistant
GPT-4o-mini powered chatbot analyzing wallet/transaction data
"""

from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from datetime import datetime, timezone
import os, secrets
from dotenv import load_dotenv
from core.security import get_current_user
from core.database import db

load_dotenv()

router = APIRouter(prefix="/api/ai-assistant", tags=["ai-assistant"])


class ChatMessage(BaseModel):
    message: str
    session_id: str = ""


@router.post("/chat")
async def ai_chat(req: ChatMessage, request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])

    # Fetch user data for context
    balance = user.get("balance", 0)
    coins = user.get("coins", 0) or user.get("gaming_coins", 0)

    # Fetch recent transactions
    txns = await db.transactions.find(
        {"user_id": user_id},
        {"_id": 0, "type": 1, "amount": 1, "description": 1, "created_at": 1, "category": 1}
    ).sort("created_at", -1).limit(30).to_list(30)

    # Calculate spending stats
    total_spent = sum(t.get("amount", 0) for t in txns if t.get("type") in ("payment", "transfer_out", "debit"))
    total_received = sum(t.get("amount", 0) for t in txns if t.get("type") in ("topup", "transfer_in", "credit", "reward"))

    # Build transaction summary
    txn_summary = "\n".join([
        f"- {t.get('type','?')}: €{t.get('amount',0):.2f} - {t.get('description','')[:50]} ({t.get('created_at','')[:10]})"
        for t in txns[:15]
    ])

    system_prompt = f"""Du bist BlitzBot, der KI-Finanzassistent von BidBlitz. 
Du hilfst dem Nutzer bei Fragen zu seinem Konto, Ausgaben, Sparen und Finanztipps.

NUTZERDATEN:
- Wallet-Guthaben: €{balance:.2f}
- Gaming Coins: {coins}
- Letzte 15 Transaktionen:
{txn_summary}
- Gesamtausgaben (letzte 30 Transaktionen): €{total_spent:.2f}
- Gesamteinnahmen (letzte 30 Transaktionen): €{total_received:.2f}

REGELN:
- Antworte immer auf Deutsch (außer der Nutzer fragt in einer anderen Sprache)
- Halte Antworten kurz und prägnant (max 3-4 Sätze)
- Gib praktische Spartipps basierend auf den echten Daten
- Nutze € als Währungszeichen
- Sei freundlich, professionell und hilfsbereit
- Wenn du etwas nicht weißt, sage es ehrlich"""

    session_id = req.session_id or f"ai-{user_id}-{secrets.token_hex(4)}"

    # Get chat history
    history = await db.ai_chat_history.find(
        {"user_id": user_id, "session_id": session_id},
        {"_id": 0}
    ).sort("created_at", 1).limit(20).to_list(20)

    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage

        api_key = os.environ.get("EMERGENT_LLM_KEY")
        if not api_key:
            raise HTTPException(500, "LLM Key nicht konfiguriert")

        chat = LlmChat(
            api_key=api_key,
            session_id=session_id,
            system_message=system_prompt,
        ).with_model("openai", "gpt-4o-mini")

        # Replay history
        for h in history:
            if h.get("role") == "user":
                await chat.send_message(UserMessage(text=h["content"]))

        # Send current message
        response = await chat.send_message(UserMessage(text=req.message))

        # Store in DB
        now = datetime.now(timezone.utc).isoformat()
        await db.ai_chat_history.insert_many([
            {"user_id": user_id, "session_id": session_id, "role": "user", "content": req.message, "created_at": now},
            {"user_id": user_id, "session_id": session_id, "role": "assistant", "content": response, "created_at": now},
        ])

        return {
            "response": response,
            "session_id": session_id,
            "balance": balance,
            "coins": coins,
        }

    except ImportError:
        raise HTTPException(500, "AI-Modul nicht installiert")
    except Exception as e:
        raise HTTPException(500, f"AI-Fehler: {str(e)}")


@router.get("/history")
async def get_chat_history(request: Request, session_id: str = ""):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    # db imported from core.database
    query = {"user_id": user_id}
    if session_id:
        query["session_id"] = session_id
    
    messages = await db.ai_chat_history.find(
        query, {"_id": 0}
    ).sort("created_at", -1).limit(50).to_list(50)
    
    messages.reverse()
    return {"messages": messages}


@router.delete("/history")
async def clear_history(request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    # db imported from core.database
    await db.ai_chat_history.delete_many({"user_id": user_id})
    return {"ok": True}
