"""
BidBlitz V2 - Kids App Backend
Chat mit Eltern, SOS, Aufgaben, Lernspiele, Wallet
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone
from core.database import db
from core.security import get_current_user
import secrets

router = APIRouter(prefix="/api/kids-app", tags=["kids-app"])


class KidsMessage(BaseModel):
    child_id: str
    text: str
    sender: str = "child"  # child | parent


class KidsCall(BaseModel):
    child_id: str
    call_type: str = "voice"  # voice | video


# ─── Kids Dashboard ───

@router.get("/dashboard/{child_id}")
async def kids_dashboard(child_id: str, request: Request):
    user = await get_current_user(request)
    child = await db.kids_children.find_one({"child_id": child_id}, {"_id": 0})
    if not child:
        raise HTTPException(status_code=404, detail="Kind nicht gefunden")

    # Tasks
    tasks = await db.kids_tasks.find(
        {"child_id": child_id}, {"_id": 0}
    ).sort("created_at", -1).limit(10).to_list(10)

    # Savings goal
    savings = await db.kids_savings.find_one({"child_id": child_id}, {"_id": 0})

    # Unread messages
    unread = await db.kids_messages.count_documents({"child_id": child_id, "sender": "parent", "read": False})

    return {
        "child": child,
        "tasks": tasks,
        "savings_goal": savings,
        "unread_messages": unread,
        "wallet_balance": child.get("balance", 0),
    }


# ─── Chat with Parents ───

@router.get("/chat/{child_id}")
async def get_chat(child_id: str, request: Request, limit: int = 50):
    await get_current_user(request)
    messages = await db.kids_messages.find(
        {"child_id": child_id}, {"_id": 0}
    ).sort("created_at", 1).limit(limit).to_list(limit)
    # Mark parent messages as read
    await db.kids_messages.update_many(
        {"child_id": child_id, "sender": "parent", "read": False},
        {"$set": {"read": True}},
    )
    return {"messages": messages}


@router.post("/chat/send")
async def send_message(req: KidsMessage, request: Request):
    user = await get_current_user(request)
    now = datetime.now(timezone.utc).isoformat()
    msg = {
        "message_id": secrets.token_hex(8),
        "child_id": req.child_id,
        "sender": req.sender,
        "sender_name": user.get("name", ""),
        "text": req.text,
        "read": False,
        "created_at": now,
    }
    await db.kids_messages.insert_one(msg)
    msg.pop("_id", None)
    return {"ok": True, "message": msg}


# ─── Call Parents ───

@router.post("/call")
async def initiate_call(req: KidsCall, request: Request):
    user = await get_current_user(request)
    child = await db.kids_children.find_one({"child_id": req.child_id}, {"_id": 0})
    if not child:
        raise HTTPException(status_code=404, detail="Kind nicht gefunden")

    parent = await db.users.find_one({"_id": __import__("bson").ObjectId(child["parent_id"])}, {"_id": 0, "name": 1, "email": 1, "phone": 1})

    now = datetime.now(timezone.utc).isoformat()
    call_log = {
        "call_id": secrets.token_hex(8),
        "child_id": req.child_id,
        "child_name": child.get("name", ""),
        "parent_name": parent.get("name", "") if parent else "",
        "parent_phone": parent.get("phone", "") if parent else "",
        "call_type": req.call_type,
        "status": "initiated",
        "created_at": now,
    }
    await db.kids_calls.insert_one(call_log)
    call_log.pop("_id", None)

    return {"ok": True, "call": call_log, "parent_phone": parent.get("phone", "") if parent else ""}


# ─── Learning Games ───

@router.get("/quiz")
async def get_quiz():
    """Simple math & knowledge quiz for kids."""
    import random
    questions = [
        {"q": "Was ist 7 + 5?", "options": ["10", "11", "12", "13"], "answer": "12", "category": "mathe"},
        {"q": "Was ist 15 - 8?", "options": ["5", "6", "7", "8"], "answer": "7", "category": "mathe"},
        {"q": "Was ist 6 x 4?", "options": ["20", "22", "24", "26"], "answer": "24", "category": "mathe"},
        {"q": "Was ist 100 / 5?", "options": ["15", "20", "25", "30"], "answer": "20", "category": "mathe"},
        {"q": "Was ist 3 x 9?", "options": ["24", "27", "30", "33"], "answer": "27", "category": "mathe"},
        {"q": "Wie viele Cent sind 1 Euro?", "options": ["10", "50", "100", "1000"], "answer": "100", "category": "geld"},
        {"q": "Du sparst €2 pro Woche. Wie viel hast du nach 4 Wochen?", "options": ["€4", "€6", "€8", "€10"], "answer": "€8", "category": "geld"},
        {"q": "Ein Eis kostet €1.50. Du hast €5. Wie viel Wechselgeld?", "options": ["€2.50", "€3.00", "€3.50", "€4.00"], "answer": "€3.50", "category": "geld"},
        {"q": "Welches Tier ist das größte?", "options": ["Elefant", "Giraffe", "Blauwal", "Nashorn"], "answer": "Blauwal", "category": "wissen"},
        {"q": "Wie viele Planeten hat unser Sonnensystem?", "options": ["7", "8", "9", "10"], "answer": "8", "category": "wissen"},
    ]
    random.shuffle(questions)
    return {"questions": questions[:5]}


@router.post("/quiz/submit")
async def submit_quiz(request: Request):
    user = await get_current_user(request)
    body = await request.json()
    child_id = body.get("child_id", "")
    score = body.get("score", 0)
    total = body.get("total", 5)

    # Award coins for correct answers
    reward = score * 0.50  # €0.50 per correct answer
    if reward > 0 and child_id:
        await db.kids_children.update_one({"child_id": child_id}, {"$inc": {"balance": reward}})

    now = datetime.now(timezone.utc).isoformat()
    await db.kids_quiz_results.insert_one({
        "child_id": child_id,
        "score": score,
        "total": total,
        "reward": reward,
        "created_at": now,
    })

    return {"ok": True, "score": score, "total": total, "reward": reward}


# ─── Savings Goal ───

@router.post("/savings-goal")
async def set_savings_goal(request: Request):
    user = await get_current_user(request)
    body = await request.json()
    child_id = body.get("child_id", "")
    goal_name = body.get("goal_name", "")
    goal_amount = body.get("goal_amount", 0)

    now = datetime.now(timezone.utc).isoformat()
    await db.kids_savings.update_one(
        {"child_id": child_id},
        {"$set": {"goal_name": goal_name, "goal_amount": goal_amount, "updated_at": now}},
        upsert=True,
    )
    return {"ok": True}



# ─── Chat Polling for Real-time ───

@router.get("/chat/{child_id}/poll")
async def poll_chat(child_id: str, request: Request, after: str = ""):
    """Long-poll: Return new messages since 'after' timestamp."""
    await get_current_user(request)
    q = {"child_id": child_id}
    if after:
        q["created_at"] = {"$gt": after}
    messages = await db.kids_messages.find(q, {"_id": 0}).sort("created_at", 1).to_list(50)
    unread = await db.kids_messages.count_documents({"child_id": child_id, "sender": "parent", "read": False})
    return {"messages": messages, "unread": unread, "timestamp": datetime.now(timezone.utc).isoformat()}


@router.post("/chat/{child_id}/typing")
async def set_typing(child_id: str, request: Request):
    """Set typing indicator."""
    user = await get_current_user(request)
    body = await request.json()
    sender = body.get("sender", "child")
    await db.kids_typing.update_one(
        {"child_id": child_id, "sender": sender},
        {"$set": {"typing": True, "name": user.get("name", ""), "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    return {"ok": True}


@router.get("/chat/{child_id}/typing")
async def get_typing(child_id: str, request: Request):
    """Check who is typing."""
    await get_current_user(request)
    indicators = await db.kids_typing.find({"child_id": child_id}, {"_id": 0}).to_list(5)
    # Auto-expire typing after 5 seconds
    now = datetime.now(timezone.utc)
    active = []
    for ind in indicators:
        updated = ind.get("updated_at", "")
        if updated:
            try:
                ts = datetime.fromisoformat(updated.replace("Z", "+00:00"))
                if (now - ts).total_seconds() < 5:
                    active.append(ind)
            except:
                pass
    return {"typing": active}
