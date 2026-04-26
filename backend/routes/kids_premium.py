"""
BidBlitz Kids — Premium Features Bundle
1. Chores (Aufgaben → BLZ)
2. AI Tutor (kid-safe gpt-5.2)
3. Gift QR (Verwandte schicken Geld)
4. Achievements & Badges
5. Purchase Approval Flow
6. (Card Design — frontend-only)
7. Allowance Automation
8. Charity Donations
9. Parent AI Insights
10. School/Sleep Mode (Auto-Lock)
11. Sibling Money Transfer
12. Finance Courses
13. Mini-Games (BLZ Rewards)
"""
import os
import secrets
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Literal

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from emergentintegrations.llm.chat import LlmChat, UserMessage
from dotenv import load_dotenv

from core.database import db
from core.security import get_current_user

load_dotenv()
logger = logging.getLogger("bidblitz.kids_premium")

router = APIRouter(prefix="/api/kids-premium", tags=["kids-premium"])

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
DEFAULT_MODEL = ("openai", "gpt-5.2")


async def _get_child(child_id: str, parent_id: str) -> dict:
    """Verify child belongs to parent and return doc."""
    child = await db.kids_children.find_one({"child_id": child_id, "parent_id": parent_id}, {"_id": 0})
    if not child:
        raise HTTPException(404, "Kind nicht gefunden oder keine Berechtigung")
    return child


# ═══════════════════════════════════════════════════════════════════════════════
# 1. CHORES — Aufgaben → BLZ-Belohnungen
# ═══════════════════════════════════════════════════════════════════════════════

class ChoreCreate(BaseModel):
    child_id: str
    title: str = Field(min_length=1, max_length=100)
    description: Optional[str] = Field(default="", max_length=300)
    reward_blz: int = Field(default=10, ge=1, le=500)
    icon: str = Field(default="🧹")
    recurring: Optional[Literal["once", "daily", "weekly"]] = "once"


class ChoreSubmit(BaseModel):
    chore_id: str
    note: Optional[str] = ""


@router.post("/chores")
async def create_chore(req: ChoreCreate, request: Request):
    user = await get_current_user(request)
    parent_id = str(user.get("_id") or user.get("id"))
    await _get_child(req.child_id, parent_id)
    chore_id = f"chore_{secrets.token_hex(6)}"
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "chore_id": chore_id, "child_id": req.child_id, "parent_id": parent_id,
        "title": req.title, "description": req.description,
        "reward_blz": req.reward_blz, "icon": req.icon,
        "recurring": req.recurring, "status": "open",
        "created_at": now,
    }
    await db.kids_chores.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.get("/chores/{child_id}")
async def list_chores(child_id: str, request: Request):
    user = await get_current_user(request)
    parent_id = str(user.get("_id") or user.get("id"))
    await _get_child(child_id, parent_id)
    chores = await db.kids_chores.find(
        {"child_id": child_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return {"chores": chores}


@router.post("/chores/submit")
async def submit_chore(req: ChoreSubmit, request: Request):
    """Child marks chore as done — awaits parent approval."""
    user = await get_current_user(request)
    uid = str(user.get("_id") or user.get("id"))
    chore = await db.kids_chores.find_one({"chore_id": req.chore_id}, {"_id": 0})
    if not chore:
        raise HTTPException(404, "Aufgabe nicht gefunden")
    # Either parent or child can submit (kid in kids-app, parent on behalf)
    now = datetime.now(timezone.utc).isoformat()
    await db.kids_chores.update_one(
        {"chore_id": req.chore_id},
        {"$set": {"status": "submitted", "submitted_at": now, "submit_note": req.note}},
    )
    # Push parent
    try:
        from routes.web_push import send_push_to_user
        import asyncio
        asyncio.create_task(send_push_to_user(
            user_id=chore["parent_id"],
            title="✅ Aufgabe erledigt",
            body=f"Bestätige: {chore['title']} ({chore.get('reward_blz', 0)} BLZ)",
            data={"type": "chore_submit", "chore_id": req.chore_id},
        ))
    except Exception:
        pass
    return {"ok": True, "chore_id": req.chore_id}


@router.post("/chores/{chore_id}/approve")
async def approve_chore(chore_id: str, request: Request):
    user = await get_current_user(request)
    parent_id = str(user.get("_id") or user.get("id"))
    chore = await db.kids_chores.find_one({"chore_id": chore_id, "parent_id": parent_id}, {"_id": 0})
    if not chore:
        raise HTTPException(404, "Aufgabe nicht gefunden")
    if chore["status"] == "approved":
        raise HTTPException(400, "Bereits genehmigt")

    now = datetime.now(timezone.utc).isoformat()
    reward = int(chore.get("reward_blz", 0))

    # Credit child wallet
    await db.kids_children.update_one(
        {"child_id": chore["child_id"]},
        {"$inc": {"balance_blz": reward}},
    )
    await db.kids_chores.update_one(
        {"chore_id": chore_id},
        {"$set": {"status": "approved", "approved_at": now, "credited_blz": reward}},
    )
    # Track for achievements
    await _track_achievement(chore["child_id"], "chore_completed", 1)
    return {"ok": True, "reward_blz": reward}


@router.post("/chores/{chore_id}/reject")
async def reject_chore(chore_id: str, request: Request):
    user = await get_current_user(request)
    parent_id = str(user.get("_id") or user.get("id"))
    res = await db.kids_chores.update_one(
        {"chore_id": chore_id, "parent_id": parent_id},
        {"$set": {"status": "rejected", "rejected_at": datetime.now(timezone.utc).isoformat()}},
    )
    if not res.matched_count:
        raise HTTPException(404, "Aufgabe nicht gefunden")
    return {"ok": True}


# ═══════════════════════════════════════════════════════════════════════════════
# 2. AI TUTOR — Kid-Safe gpt-5.2
# ═══════════════════════════════════════════════════════════════════════════════

KID_TUTOR_PROMPT = """Du bist Buddy, der freundliche AI-Lernhelfer für BidBlitz Kids (8-14 Jahre).

REGELN:
- Antworte IMMER in einfachem Deutsch, kurz (max. 3 Sätze).
- Bei Hausaufgaben: Erkläre Wege, gib NIEMALS direkte Lösungen.
- Bei Geld-Fragen: Erkläre kindgerecht (z.B. "Zinsen sind wie ein Dankeschön von der Bank").
- Bei unangebrachten Themen (Gewalt, Drogen, Erotik, persönliche Daten): Sage höflich
  "Das besprechen wir lieber mit deinen Eltern" und schlage ein Lernthema vor.
- Nutze 1-2 passende Emojis pro Antwort.
- Bei Erfolg: Lobe das Kind ("Super!", "Klasse Idee!").
"""


class TutorRequest(BaseModel):
    child_id: str
    message: str = Field(min_length=1, max_length=500)
    session_id: Optional[str] = None


@router.post("/tutor/chat")
async def tutor_chat(req: TutorRequest, request: Request):
    user = await get_current_user(request)
    parent_id = str(user.get("_id") or user.get("id"))
    child = await _get_child(req.child_id, parent_id)

    if not EMERGENT_LLM_KEY:
        raise HTTPException(503, "AI nicht verfügbar")

    session_id = req.session_id or f"tutor_{req.child_id}_{secrets.token_hex(4)}"

    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=session_id,
        system_message=KID_TUTOR_PROMPT,
    ).with_model(*DEFAULT_MODEL)

    try:
        reply = await chat.send_message(UserMessage(text=req.message))
    except Exception:
        raise HTTPException(502, "KI gerade nicht erreichbar")

    now = datetime.now(timezone.utc).isoformat()
    await db.kids_tutor_chats.update_one(
        {"session_id": session_id},
        {
            "$set": {"session_id": session_id, "child_id": req.child_id, "updated_at": now},
            "$push": {"messages": {
                "$each": [
                    {"role": "user", "content": req.message, "ts": now},
                    {"role": "assistant", "content": reply, "ts": now},
                ]
            }},
            "$setOnInsert": {"created_at": now},
        },
        upsert=True,
    )
    await _track_achievement(req.child_id, "tutor_chat", 1)
    return {"reply": reply, "session_id": session_id}


# ═══════════════════════════════════════════════════════════════════════════════
# 3. GIFT QR — Verwandte schicken Geld
# ═══════════════════════════════════════════════════════════════════════════════

class GiftSendRequest(BaseModel):
    gift_token: str  # public token from QR
    sender_name: str = Field(min_length=1, max_length=50)
    amount_eur: float = Field(ge=1.0, le=500.0)
    message: Optional[str] = Field(default="", max_length=200)


@router.get("/gift/qr/{child_id}")
async def get_gift_qr(child_id: str, request: Request):
    user = await get_current_user(request)
    parent_id = str(user.get("_id") or user.get("id"))
    child = await _get_child(child_id, parent_id)
    # Generate stable gift token if not exists
    gift_token = child.get("gift_token")
    if not gift_token:
        gift_token = f"gift_{secrets.token_urlsafe(12)}"
        await db.kids_children.update_one({"child_id": child_id}, {"$set": {"gift_token": gift_token}})
    return {
        "gift_token": gift_token,
        "child_name": child.get("name"),
        "child_avatar": child.get("avatar"),
        "qr_url": f"https://bidblitz.ae/gift/{gift_token}",
    }


@router.get("/gift/info/{gift_token}")
async def gift_info(gift_token: str):
    """Public — sender scans QR and sees recipient name."""
    child = await db.kids_children.find_one({"gift_token": gift_token}, {"_id": 0, "name": 1, "avatar": 1, "color": 1})
    if not child:
        raise HTTPException(404, "Ungültiger Geschenk-Code")
    return child


@router.post("/gift/send")
async def send_gift(req: GiftSendRequest):
    """Public endpoint — anyone with the QR can send money (Stripe checkout)."""
    child = await db.kids_children.find_one({"gift_token": req.gift_token}, {"_id": 0})
    if not child:
        raise HTTPException(404, "Ungültiger Geschenk-Code")

    # Create gift record (pending until Stripe webhook confirms)
    gift_id = f"gift_{secrets.token_hex(8)}"
    now = datetime.now(timezone.utc).isoformat()
    await db.kids_gifts.insert_one({
        "gift_id": gift_id,
        "child_id": child["child_id"],
        "parent_id": child["parent_id"],
        "sender_name": req.sender_name,
        "amount_eur": req.amount_eur,
        "message": req.message,
        "status": "pending",
        "created_at": now,
    })
    # In production: redirect to Stripe checkout. For now: mark completed.
    await db.kids_children.update_one(
        {"child_id": child["child_id"]},
        {"$inc": {"balance": req.amount_eur}},
    )
    await db.kids_gifts.update_one({"gift_id": gift_id}, {"$set": {"status": "completed", "completed_at": now}})

    # Notify parent
    try:
        from routes.web_push import send_push_to_user
        import asyncio
        asyncio.create_task(send_push_to_user(
            user_id=child["parent_id"],
            title="🎁 Geschenk erhalten!",
            body=f"{req.sender_name} hat {child.get('name')} {req.amount_eur:.2f}€ geschenkt",
            data={"type": "gift", "gift_id": gift_id},
        ))
    except Exception:
        pass

    return {"ok": True, "gift_id": gift_id, "amount_eur": req.amount_eur}


@router.get("/gift/list/{child_id}")
async def gift_list(child_id: str, request: Request):
    user = await get_current_user(request)
    parent_id = str(user.get("_id") or user.get("id"))
    await _get_child(child_id, parent_id)
    gifts = await db.kids_gifts.find(
        {"child_id": child_id, "status": "completed"}, {"_id": 0}
    ).sort("completed_at", -1).limit(50).to_list(50)
    total = sum(g.get("amount_eur", 0) for g in gifts)
    return {"gifts": gifts, "total_eur": round(total, 2), "count": len(gifts)}


# ═══════════════════════════════════════════════════════════════════════════════
# 4. ACHIEVEMENTS & BADGES
# ═══════════════════════════════════════════════════════════════════════════════

BADGES = [
    {"id": "first_chore", "icon": "💪", "title": "Erster Helfer", "desc": "1. Aufgabe erledigt", "trigger": "chore_completed", "threshold": 1},
    {"id": "chore_pro", "icon": "🏆", "title": "Helfer-Profi", "desc": "10 Aufgaben erledigt", "trigger": "chore_completed", "threshold": 10},
    {"id": "first_save", "icon": "🐷", "title": "Erster Sparer", "desc": "1. Sparziel erreicht", "trigger": "savings_completed", "threshold": 1},
    {"id": "quiz_master", "icon": "🧠", "title": "Quiz-Meister", "desc": "10 Quiz richtig", "trigger": "quiz_correct", "threshold": 10},
    {"id": "quiz_streak_7", "icon": "🔥", "title": "Wochen-Streak", "desc": "7 Tage täglich Quiz", "trigger": "quiz_streak", "threshold": 7},
    {"id": "tutor_curious", "icon": "💡", "title": "Wissbegierig", "desc": "5 Fragen an Buddy", "trigger": "tutor_chat", "threshold": 5},
    {"id": "donor", "icon": "❤️", "title": "Großes Herz", "desc": "1. Spende gemacht", "trigger": "donation", "threshold": 1},
    {"id": "course_starter", "icon": "📚", "title": "Lernkurs gestartet", "desc": "1. Finanzkurs", "trigger": "course_completed", "threshold": 1},
    {"id": "game_winner", "icon": "🎮", "title": "Spielfreund", "desc": "10 Mini-Games gespielt", "trigger": "minigame_played", "threshold": 10},
]


async def _track_achievement(child_id: str, trigger: str, increment: int = 1):
    """Increment counter and unlock badges if threshold reached."""
    now = datetime.now(timezone.utc).isoformat()
    res = await db.kids_progress.find_one_and_update(
        {"child_id": child_id, "trigger": trigger},
        {"$inc": {"count": increment}, "$setOnInsert": {"first_at": now}, "$set": {"updated_at": now}},
        upsert=True,
        return_document=True,
    )
    new_count = (res or {}).get("count", increment)

    # Check badges
    new_badges = []
    for b in BADGES:
        if b["trigger"] != trigger:
            continue
        if new_count >= b["threshold"]:
            existing = await db.kids_badges.find_one({"child_id": child_id, "badge_id": b["id"]})
            if not existing:
                await db.kids_badges.insert_one({
                    "child_id": child_id, "badge_id": b["id"],
                    "icon": b["icon"], "title": b["title"], "desc": b["desc"],
                    "earned_at": now,
                })
                new_badges.append(b["id"])
    return new_badges


@router.get("/badges/{child_id}")
async def get_badges(child_id: str, request: Request):
    user = await get_current_user(request)
    parent_id = str(user.get("_id") or user.get("id"))
    await _get_child(child_id, parent_id)
    earned = await db.kids_badges.find({"child_id": child_id}, {"_id": 0}).sort("earned_at", -1).to_list(100)
    earned_ids = {b["badge_id"] for b in earned}
    progress = {}
    async for p in db.kids_progress.find({"child_id": child_id}, {"_id": 0, "trigger": 1, "count": 1}):
        progress[p["trigger"]] = p["count"]
    all_badges = []
    for b in BADGES:
        all_badges.append({
            **b,
            "earned": b["id"] in earned_ids,
            "current": progress.get(b["trigger"], 0),
        })
    return {"earned": earned, "all": all_badges, "earned_count": len(earned), "total": len(BADGES)}


# ═══════════════════════════════════════════════════════════════════════════════
# 5. PURCHASE APPROVAL FLOW
# ═══════════════════════════════════════════════════════════════════════════════

class ApprovalRequest(BaseModel):
    child_id: str
    amount_eur: float = Field(ge=0.01)
    item_name: str = Field(min_length=1, max_length=120)
    note: Optional[str] = ""


@router.post("/approval/request")
async def request_approval(req: ApprovalRequest, request: Request):
    """Child requests parent approval for a purchase."""
    user = await get_current_user(request)
    uid = str(user.get("_id") or user.get("id"))
    # Lookup child to get parent
    child = await db.kids_children.find_one({"child_id": req.child_id}, {"_id": 0})
    if not child:
        raise HTTPException(404, "Kind nicht gefunden")
    approval_id = f"appr_{secrets.token_hex(8)}"
    now = datetime.now(timezone.utc).isoformat()
    await db.kids_approvals.insert_one({
        "approval_id": approval_id,
        "child_id": req.child_id,
        "parent_id": child["parent_id"],
        "amount_eur": req.amount_eur,
        "item_name": req.item_name,
        "note": req.note,
        "status": "pending",
        "created_at": now,
    })
    # Push parent
    try:
        from routes.web_push import send_push_to_user
        import asyncio
        asyncio.create_task(send_push_to_user(
            user_id=child["parent_id"],
            title=f"💳 {child.get('name')} möchte einkaufen",
            body=f"{req.item_name} für {req.amount_eur:.2f}€",
            data={"type": "approval", "approval_id": approval_id},
        ))
    except Exception:
        pass
    return {"approval_id": approval_id, "status": "pending"}


@router.post("/approval/{approval_id}/decide")
async def decide_approval(approval_id: str, decision: str, request: Request):
    """Parent: approve or reject."""
    if decision not in ("approve", "reject"):
        raise HTTPException(400, "decision must be approve|reject")
    user = await get_current_user(request)
    parent_id = str(user.get("_id") or user.get("id"))
    appr = await db.kids_approvals.find_one({"approval_id": approval_id, "parent_id": parent_id}, {"_id": 0})
    if not appr:
        raise HTTPException(404, "Antrag nicht gefunden")
    now = datetime.now(timezone.utc).isoformat()
    new_status = "approved" if decision == "approve" else "rejected"
    await db.kids_approvals.update_one(
        {"approval_id": approval_id}, {"$set": {"status": new_status, "decided_at": now}}
    )
    return {"ok": True, "status": new_status}


@router.get("/approval/{child_id}")
async def list_approvals(child_id: str, request: Request):
    user = await get_current_user(request)
    parent_id = str(user.get("_id") or user.get("id"))
    items = await db.kids_approvals.find(
        {"child_id": child_id, "parent_id": parent_id}, {"_id": 0}
    ).sort("created_at", -1).limit(50).to_list(50)
    return {"approvals": items}


# ═══════════════════════════════════════════════════════════════════════════════
# 7. ALLOWANCE AUTOMATION
# ═══════════════════════════════════════════════════════════════════════════════

class AllowanceConfig(BaseModel):
    child_id: str
    amount_eur: float = Field(ge=0.5, le=200)
    frequency: Literal["weekly", "biweekly", "monthly"] = "weekly"
    require_chores: bool = False
    weekday: Optional[int] = Field(default=0, ge=0, le=6)  # 0=Mon


@router.post("/allowance/configure")
async def configure_allowance(req: AllowanceConfig, request: Request):
    user = await get_current_user(request)
    parent_id = str(user.get("_id") or user.get("id"))
    await _get_child(req.child_id, parent_id)
    now = datetime.now(timezone.utc).isoformat()
    await db.kids_allowance.update_one(
        {"child_id": req.child_id},
        {"$set": {
            "child_id": req.child_id, "parent_id": parent_id,
            "amount_eur": req.amount_eur, "frequency": req.frequency,
            "require_chores": req.require_chores, "weekday": req.weekday,
            "active": True, "updated_at": now,
        }, "$setOnInsert": {"created_at": now}},
        upsert=True,
    )
    return {"ok": True}


@router.get("/allowance/{child_id}")
async def get_allowance(child_id: str, request: Request):
    user = await get_current_user(request)
    parent_id = str(user.get("_id") or user.get("id"))
    cfg = await db.kids_allowance.find_one({"child_id": child_id, "parent_id": parent_id}, {"_id": 0})
    history = await db.kids_allowance_log.find({"child_id": child_id}, {"_id": 0}).sort("paid_at", -1).limit(10).to_list(10)
    return {"config": cfg, "history": history}


# ═══════════════════════════════════════════════════════════════════════════════
# 8. CHARITY DONATIONS
# ═══════════════════════════════════════════════════════════════════════════════

CHARITIES = [
    {"id": "tierheim", "name": "Tierheim Berlin", "icon": "🐶", "desc": "Hilft Hunden und Katzen"},
    {"id": "kinderhilfe", "name": "Kinderhilfe Albanien", "icon": "🧒", "desc": "Schulen für Kinder"},
    {"id": "umwelt", "name": "Plant-for-the-Planet", "icon": "🌳", "desc": "Bäume pflanzen"},
    {"id": "rotes_kreuz", "name": "Deutsches Rotes Kreuz", "icon": "❤️", "desc": "Hilfe weltweit"},
]


class DonationRequest(BaseModel):
    child_id: str
    charity_id: str
    amount_eur: float = Field(ge=0.5, le=100)


@router.get("/charities")
async def list_charities():
    return {"charities": CHARITIES}


@router.post("/donate")
async def make_donation(req: DonationRequest, request: Request):
    user = await get_current_user(request)
    parent_id = str(user.get("_id") or user.get("id"))
    child = await _get_child(req.child_id, parent_id)
    charity = next((c for c in CHARITIES if c["id"] == req.charity_id), None)
    if not charity:
        raise HTTPException(404, "Charity unbekannt")
    if (child.get("balance") or 0) < req.amount_eur:
        raise HTTPException(400, "Zu wenig Guthaben")

    now = datetime.now(timezone.utc).isoformat()
    await db.kids_children.update_one({"child_id": req.child_id}, {"$inc": {"balance": -req.amount_eur}})
    donation_id = f"don_{secrets.token_hex(6)}"
    await db.kids_donations.insert_one({
        "donation_id": donation_id, "child_id": req.child_id, "parent_id": parent_id,
        "charity_id": req.charity_id, "charity_name": charity["name"],
        "amount_eur": req.amount_eur, "created_at": now,
    })
    await _track_achievement(req.child_id, "donation", 1)
    return {"ok": True, "donation_id": donation_id, "charity": charity["name"]}


@router.get("/donations/{child_id}")
async def list_donations(child_id: str, request: Request):
    user = await get_current_user(request)
    parent_id = str(user.get("_id") or user.get("id"))
    items = await db.kids_donations.find({"child_id": child_id, "parent_id": parent_id}, {"_id": 0}).sort("created_at", -1).limit(50).to_list(50)
    total = sum(d.get("amount_eur", 0) for d in items)
    return {"donations": items, "total_eur": round(total, 2), "count": len(items)}


# ═══════════════════════════════════════════════════════════════════════════════
# 9. PARENT AI INSIGHTS
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/insights/{child_id}")
async def parent_insights(child_id: str, request: Request):
    user = await get_current_user(request)
    parent_id = str(user.get("_id") or user.get("id"))
    child = await _get_child(child_id, parent_id)

    if not EMERGENT_LLM_KEY:
        return {"insights": ["AI nicht konfiguriert"]}

    # Gather data
    chores_done = await db.kids_chores.count_documents({"child_id": child_id, "status": "approved"})
    chores_open = await db.kids_chores.count_documents({"child_id": child_id, "status": "open"})
    quiz_count = (await db.kids_progress.find_one({"child_id": child_id, "trigger": "quiz_correct"}, {"_id": 0, "count": 1}) or {}).get("count", 0)
    tutor_count = (await db.kids_progress.find_one({"child_id": child_id, "trigger": "tutor_chat"}, {"_id": 0, "count": 1}) or {}).get("count", 0)
    badges_count = await db.kids_badges.count_documents({"child_id": child_id})
    balance = child.get("balance", 0)
    blz_balance = child.get("balance_blz", 0)
    donations_total = 0.0
    async for d in db.kids_donations.find({"child_id": child_id}, {"_id": 0, "amount_eur": 1}):
        donations_total += float(d.get("amount_eur", 0) or 0)

    profile = (
        f"Kind: {child.get('name')}, {child.get('age', '?')} Jahre alt\n"
        f"- Aufgaben erledigt: {chores_done}, offen: {chores_open}\n"
        f"- Quiz richtig: {quiz_count}, Buddy-Fragen: {tutor_count}\n"
        f"- Badges erreicht: {badges_count}/{len(BADGES)}\n"
        f"- Guthaben: {balance:.2f}€, BLZ: {blz_balance}\n"
        f"- Spenden: {donations_total:.2f}€\n"
    )

    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"insight_{child_id}_{secrets.token_hex(4)}",
        system_message=(
            "Du bist Familien-Coach. Generiere 3-4 kurze, konkrete Empfehlungen für Eltern "
            "basierend auf den Daten ihres Kindes. Auf Deutsch, jeweils max. 2 Sätze. "
            "Konzentriere dich auf positive Anregungen, nicht Kritik. "
            "Antworte als JSON-Array mit Strings, ohne Erklärungen außerhalb."
        ),
    ).with_model(*DEFAULT_MODEL)
    try:
        reply = await chat.send_message(UserMessage(text=profile))
    except Exception:
        return {"insights": []}

    import json
    import re
    m = re.search(r"\[[\s\S]*\]", reply)
    if m:
        try:
            arr = json.loads(m.group(0))
            return {"insights": [str(x)[:300] for x in arr[:5]]}
        except Exception:
            pass
    # Fallback
    return {"insights": [reply[:300]]}


# ═══════════════════════════════════════════════════════════════════════════════
# 10. SCHOOL/SLEEP MODE
# ═══════════════════════════════════════════════════════════════════════════════

class SchoolModeConfig(BaseModel):
    child_id: str
    enabled: bool = True
    school_start: str = "08:00"  # HH:MM
    school_end: str = "13:00"
    sleep_start: str = "21:00"
    sleep_end: str = "07:00"
    weekdays_only: bool = True


@router.post("/school-mode")
async def configure_school_mode(req: SchoolModeConfig, request: Request):
    user = await get_current_user(request)
    parent_id = str(user.get("_id") or user.get("id"))
    await _get_child(req.child_id, parent_id)
    now = datetime.now(timezone.utc).isoformat()
    await db.kids_school_mode.update_one(
        {"child_id": req.child_id},
        {"$set": {**req.model_dump(), "parent_id": parent_id, "updated_at": now},
         "$setOnInsert": {"created_at": now}},
        upsert=True,
    )
    return {"ok": True}


@router.get("/school-mode/{child_id}")
async def get_school_mode(child_id: str, request: Request):
    user = await get_current_user(request)
    parent_id = str(user.get("_id") or user.get("id"))
    cfg = await db.kids_school_mode.find_one({"child_id": child_id, "parent_id": parent_id}, {"_id": 0})

    # Compute current lock state
    is_locked, reason = False, None
    if cfg and cfg.get("enabled"):
        now = datetime.now()
        is_weekday = now.weekday() < 5
        if cfg.get("weekdays_only", True) and not is_weekday:
            pass
        else:
            cur_min = now.hour * 60 + now.minute
            def to_min(t):
                h, m = t.split(":")
                return int(h) * 60 + int(m)
            ss, se = to_min(cfg["school_start"]), to_min(cfg["school_end"])
            sls, sle = to_min(cfg["sleep_start"]), to_min(cfg["sleep_end"])
            if ss <= cur_min < se:
                is_locked, reason = True, "Schulzeit"
            elif sls <= cur_min or cur_min < sle:
                is_locked, reason = True, "Schlafenszeit"
    return {"config": cfg, "is_locked": is_locked, "reason": reason}


# ═══════════════════════════════════════════════════════════════════════════════
# 11. SIBLING MONEY TRANSFER (between children of same parent)
# ═══════════════════════════════════════════════════════════════════════════════

class SiblingTransfer(BaseModel):
    from_child_id: str
    to_child_id: str
    amount_eur: float = Field(ge=0.5, le=50)
    note: Optional[str] = ""


@router.post("/sibling/transfer")
async def sibling_transfer(req: SiblingTransfer, request: Request):
    user = await get_current_user(request)
    parent_id = str(user.get("_id") or user.get("id"))
    src = await _get_child(req.from_child_id, parent_id)
    dst = await _get_child(req.to_child_id, parent_id)
    if (src.get("balance") or 0) < req.amount_eur:
        raise HTTPException(400, f"{src['name']} hat zu wenig Guthaben")
    now = datetime.now(timezone.utc).isoformat()
    await db.kids_children.update_one({"child_id": req.from_child_id}, {"$inc": {"balance": -req.amount_eur}})
    await db.kids_children.update_one({"child_id": req.to_child_id}, {"$inc": {"balance": req.amount_eur}})
    transfer_id = f"trans_{secrets.token_hex(6)}"
    await db.kids_sibling_transfers.insert_one({
        "transfer_id": transfer_id, "parent_id": parent_id,
        "from_child_id": req.from_child_id, "to_child_id": req.to_child_id,
        "from_name": src.get("name"), "to_name": dst.get("name"),
        "amount_eur": req.amount_eur, "note": req.note, "created_at": now,
    })
    return {"ok": True, "transfer_id": transfer_id}


# ═══════════════════════════════════════════════════════════════════════════════
# 12. FINANCE COURSES (5-min lessons)
# ═══════════════════════════════════════════════════════════════════════════════

COURSES = [
    {
        "id": "money_basics",
        "title": "Was ist Geld?",
        "icon": "💶",
        "duration_min": 5,
        "reward_blz": 20,
        "lessons": [
            {"title": "Geld als Tausch", "text": "Früher haben Menschen Sachen getauscht. Geld macht das einfacher!"},
            {"title": "Münzen und Scheine", "text": "1€ = 100 Cent. Es gibt verschiedene Werte: 1, 2, 5, 10, 20, 50, 100 Cent."},
            {"title": "Wie verdient man Geld?", "text": "Erwachsene arbeiten und bekommen Geld. Du kannst durch Aufgaben BLZ verdienen!"},
        ],
    },
    {
        "id": "saving_basics",
        "title": "Sparen lernen",
        "icon": "🐷",
        "duration_min": 5,
        "reward_blz": 25,
        "lessons": [
            {"title": "Warum sparen?", "text": "Wenn du etwas Großes willst, sparst du Geld dafür. Das hilft, geduldig zu sein."},
            {"title": "Sparziel setzen", "text": "Setze dir ein Ziel — z.B. 50€ für ein neues Spiel — und spare jede Woche etwas."},
            {"title": "Belohnung", "text": "Wenn du dein Sparziel erreichst, bist du stolz auf dich. Das ist das beste Gefühl!"},
        ],
    },
    {
        "id": "needs_wants",
        "title": "Brauchen vs. Wollen",
        "icon": "🤔",
        "duration_min": 5,
        "reward_blz": 20,
        "lessons": [
            {"title": "Was brauchst du wirklich?", "text": "Essen, Wasser, Schlafplatz — das brauchst du. Ohne das geht es nicht."},
            {"title": "Was willst du nur?", "text": "Süßigkeiten, neues Spielzeug — das ist nett, aber du brauchst es nicht zum Leben."},
            {"title": "Klug entscheiden", "text": "Vor einem Kauf frage: Brauche ich das oder will ich es nur? So sparst du Geld."},
        ],
    },
    {
        "id": "interest",
        "title": "Was sind Zinsen?",
        "icon": "📈",
        "duration_min": 5,
        "reward_blz": 30,
        "lessons": [
            {"title": "Bank zahlt dich", "text": "Wenn du Geld auf der Bank lässt, gibt sie dir nach einem Jahr ein bisschen mehr zurück."},
            {"title": "Beispiel", "text": "100€ + 5% Zinsen = 105€ nach einem Jahr. Cool, oder?"},
            {"title": "Geduld lohnt sich", "text": "Je länger du sparst, desto mehr Zinsen bekommst du. Das nennt man Zinseszins."},
        ],
    },
]


@router.get("/courses")
async def list_courses():
    return {"courses": [{**c, "lessons": len(c["lessons"])} for c in COURSES]}


@router.get("/courses/{course_id}")
async def get_course(course_id: str):
    course = next((c for c in COURSES if c["id"] == course_id), None)
    if not course:
        raise HTTPException(404, "Kurs nicht gefunden")
    return course


class CourseComplete(BaseModel):
    child_id: str
    course_id: str


@router.post("/courses/complete")
async def complete_course(req: CourseComplete, request: Request):
    user = await get_current_user(request)
    parent_id = str(user.get("_id") or user.get("id"))
    await _get_child(req.child_id, parent_id)
    course = next((c for c in COURSES if c["id"] == req.course_id), None)
    if not course:
        raise HTTPException(404, "Kurs nicht gefunden")
    # Check if already completed
    existing = await db.kids_course_completions.find_one(
        {"child_id": req.child_id, "course_id": req.course_id}, {"_id": 0}
    )
    if existing:
        return {"ok": True, "already_completed": True, "reward_blz": 0}
    reward = course["reward_blz"]
    now = datetime.now(timezone.utc).isoformat()
    await db.kids_children.update_one(
        {"child_id": req.child_id}, {"$inc": {"balance_blz": reward}}
    )
    await db.kids_course_completions.insert_one({
        "child_id": req.child_id, "course_id": req.course_id,
        "reward_blz": reward, "completed_at": now,
    })
    await _track_achievement(req.child_id, "course_completed", 1)
    return {"ok": True, "reward_blz": reward, "course_title": course["title"]}


@router.get("/courses/progress/{child_id}")
async def course_progress(child_id: str, request: Request):
    user = await get_current_user(request)
    parent_id = str(user.get("_id") or user.get("id"))
    await _get_child(child_id, parent_id)
    items = await db.kids_course_completions.find({"child_id": child_id}, {"_id": 0}).to_list(50)
    return {
        "completed": items,
        "completed_ids": [i["course_id"] for i in items],
        "total_blz_earned": sum(i.get("reward_blz", 0) for i in items),
    }


# ═══════════════════════════════════════════════════════════════════════════════
# 13. MINI-GAMES (BLZ Rewards, 1×/day)
# ═══════════════════════════════════════════════════════════════════════════════

GAMES = [
    {"id": "math_quick", "title": "Schnellrechnen", "icon": "🔢", "reward_blz": 5, "desc": "Löse 10 Mathe-Aufgaben in 60 Sekunden"},
    {"id": "memory", "title": "Geld-Memory", "icon": "🧠", "reward_blz": 5, "desc": "Finde alle Pärchen mit Münzen"},
    {"id": "coin_catch", "title": "Münzen fangen", "icon": "🪙", "reward_blz": 5, "desc": "Fange so viele Goldmünzen wie möglich"},
]


class GameSubmit(BaseModel):
    child_id: str
    game_id: str
    score: int = Field(ge=0, le=100000)


@router.get("/games")
async def list_games():
    return {"games": GAMES}


@router.post("/games/submit")
async def submit_game(req: GameSubmit, request: Request):
    user = await get_current_user(request)
    parent_id = str(user.get("_id") or user.get("id"))
    await _get_child(req.child_id, parent_id)
    game = next((g for g in GAMES if g["id"] == req.game_id), None)
    if not game:
        raise HTTPException(404, "Spiel unbekannt")

    today = datetime.now(timezone.utc).date().isoformat()
    # 1 reward per game per day
    existing = await db.kids_game_plays.find_one(
        {"child_id": req.child_id, "game_id": req.game_id, "date": today, "rewarded": True}
    )
    rewarded = False
    reward = 0
    if not existing:
        reward = game["reward_blz"]
        rewarded = True
        await db.kids_children.update_one(
            {"child_id": req.child_id}, {"$inc": {"balance_blz": reward}}
        )

    now = datetime.now(timezone.utc).isoformat()
    await db.kids_game_plays.insert_one({
        "child_id": req.child_id, "game_id": req.game_id, "score": req.score,
        "date": today, "rewarded": rewarded, "reward_blz": reward,
        "created_at": now,
    })
    await _track_achievement(req.child_id, "minigame_played", 1)

    # Highscore
    high = await db.kids_game_plays.find(
        {"child_id": req.child_id, "game_id": req.game_id}, {"_id": 0, "score": 1}
    ).sort("score", -1).limit(1).to_list(1)
    highscore = high[0]["score"] if high else req.score

    return {
        "ok": True, "reward_blz": reward, "rewarded": rewarded,
        "score": req.score, "highscore": max(highscore, req.score),
    }


@router.get("/games/highscores/{child_id}")
async def game_highscores(child_id: str, request: Request):
    user = await get_current_user(request)
    parent_id = str(user.get("_id") or user.get("id"))
    await _get_child(child_id, parent_id)
    out = {}
    for g in GAMES:
        h = await db.kids_game_plays.find(
            {"child_id": child_id, "game_id": g["id"]}, {"_id": 0, "score": 1}
        ).sort("score", -1).limit(1).to_list(1)
        out[g["id"]] = h[0]["score"] if h else 0
    return {"highscores": out}


# ═══════════════════════════════════════════════════════════════════════════════
# Background Loop: Allowance Auto-Pay
# ═══════════════════════════════════════════════════════════════════════════════
import asyncio


async def allowance_loop():
    """Run every hour: pay allowances if frequency interval elapsed since last payout."""
    while True:
        try:
            now = datetime.now(timezone.utc)
            now_iso = now.isoformat()
            cursor = db.kids_allowance.find({"active": True}, {"_id": 0})
            async for cfg in cursor:
                last = cfg.get("last_paid_at")
                freq = cfg.get("frequency", "weekly")
                interval_days = {"weekly": 7, "biweekly": 14, "monthly": 30}.get(freq, 7)

                if last:
                    try:
                        last_dt = datetime.fromisoformat(last)
                        if (now - last_dt).days < interval_days:
                            continue
                    except Exception:
                        pass

                # Optional: require chores
                if cfg.get("require_chores"):
                    pending = await db.kids_chores.count_documents({
                        "child_id": cfg["child_id"], "status": "open",
                    })
                    if pending > 0:
                        continue

                amount = float(cfg.get("amount_eur", 0) or 0)
                if amount <= 0:
                    continue

                await db.kids_children.update_one(
                    {"child_id": cfg["child_id"]}, {"$inc": {"balance": amount}}
                )
                await db.kids_allowance.update_one(
                    {"child_id": cfg["child_id"]}, {"$set": {"last_paid_at": now_iso}}
                )
                await db.kids_allowance_log.insert_one({
                    "child_id": cfg["child_id"], "amount_eur": amount,
                    "frequency": freq, "paid_at": now_iso,
                })
                # Push parent
                try:
                    from routes.web_push import send_push_to_user
                    asyncio.create_task(send_push_to_user(
                        user_id=cfg["parent_id"],
                        title="💰 Taschengeld ausgezahlt",
                        body=f"{amount:.2f}€ überwiesen",
                        data={"type": "allowance_paid"},
                    ))
                except Exception:
                    pass
        except Exception as e:
            logger.error(f"Allowance loop error: {e}")

        await asyncio.sleep(3600)  # tick every hour


def start_allowance_loop():
    asyncio.create_task(allowance_loop())
