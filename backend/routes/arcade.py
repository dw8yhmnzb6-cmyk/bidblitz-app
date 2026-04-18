"""
Arcade Token Gate - User zahlt BLZ, um Spiele zu starten, kann BLZ zurückgewinnen via Highscore.
"""
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from bson import ObjectId

from core.database import db
from core.security import get_current_user

router = APIRouter(prefix="/api/arcade", tags=["arcade"])

ENTRY_FEE_BLZ = 1.0  # 1 BLZ pro Game-Session
HIGHSCORE_REWARD_BLZ = 3.0  # +3 BLZ wenn Highscore geknackt


def _oid(s):
    try:
        return ObjectId(s)
    except Exception:
        return s


class StartSessionRequest(BaseModel):
    game_id: str


@router.post("/start-session")
async def start_session(req: StartSessionRequest, request: Request):
    """Nutzer zahlt 1 BLZ um ein Game zu starten."""
    user = await get_current_user(request)
    uid = str(user.get("_id") or user.get("id"))
    bal = float(user.get("balance_blz", 0) or 0)
    if bal < ENTRY_FEE_BLZ:
        raise HTTPException(400, f"Du brauchst mindestens {ENTRY_FEE_BLZ} BLZ zum Spielen")

    # Debit
    await db.users.update_one({"_id": _oid(uid)}, {"$inc": {"balance_blz": -ENTRY_FEE_BLZ}})
    now = datetime.now(timezone.utc).isoformat()
    session_id = f"ARC-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S%f')[:18]}"
    await db.arcade_sessions.insert_one({
        "session_id": session_id,
        "user_id": uid,
        "game_id": req.game_id,
        "entry_fee": ENTRY_FEE_BLZ,
        "started_at": now,
        "ended_at": None,
        "score": 0,
        "reward": 0,
    })
    await db.transactions.insert_one({
        "user_id": uid, "type": "game", "amount": ENTRY_FEE_BLZ, "currency": "BLZ",
        "status": "completed", "description": f"Arcade Start: {req.game_id}",
        "merchant_name": "BidBlitz Arcade", "category": "arcade",
        "reference": session_id, "date": now, "created_at": now,
    })
    return {"ok": True, "session_id": session_id, "new_balance": round(bal - ENTRY_FEE_BLZ, 2)}


class EndSessionRequest(BaseModel):
    session_id: str
    score: int = 0


@router.post("/end-session")
async def end_session(req: EndSessionRequest, request: Request):
    """Spiel beendet - Highscore checken, ggf. Reward."""
    user = await get_current_user(request)
    uid = str(user.get("_id") or user.get("id"))
    session = await db.arcade_sessions.find_one({"session_id": req.session_id, "user_id": uid})
    if not session:
        raise HTTPException(404, "Session nicht gefunden")
    if session.get("ended_at"):
        return {"ok": True, "already_ended": True}

    # Check highscore for this game
    prev_hs = await db.arcade_highscores.find_one({"user_id": uid, "game_id": session["game_id"]})
    is_new_highscore = not prev_hs or req.score > int(prev_hs.get("score", 0))
    reward = 0
    if is_new_highscore and req.score > 0:
        reward = HIGHSCORE_REWARD_BLZ
        await db.users.update_one({"_id": _oid(uid)}, {"$inc": {"balance_blz": reward}})
        await db.arcade_highscores.update_one(
            {"user_id": uid, "game_id": session["game_id"]},
            {"$set": {"score": req.score, "updated_at": datetime.now(timezone.utc).isoformat()}},
            upsert=True,
        )
        now = datetime.now(timezone.utc).isoformat()
        await db.transactions.insert_one({
            "user_id": uid, "type": "reward", "amount": reward, "currency": "BLZ",
            "status": "completed", "description": f"Highscore Bonus: {session['game_id']}",
            "merchant_name": "BidBlitz Arcade", "category": "arcade",
            "reference": f"{req.session_id}-HS", "date": now, "created_at": now,
        })

    await db.arcade_sessions.update_one(
        {"session_id": req.session_id},
        {"$set": {"ended_at": datetime.now(timezone.utc).isoformat(), "score": req.score, "reward": reward}},
    )
    user_fresh = await db.users.find_one({"_id": _oid(uid)}, {"balance_blz": 1})
    return {
        "ok": True,
        "is_new_highscore": is_new_highscore,
        "reward": reward,
        "new_balance": round(float((user_fresh or {}).get("balance_blz", 0) or 0), 2),
    }


@router.get("/highscores")
async def get_highscores(request: Request, game_id: Optional[str] = None, limit: int = 20):
    """Top Scores für ein Game oder alle Games."""
    query = {}
    if game_id:
        query["game_id"] = game_id
    cursor = db.arcade_highscores.find(query, {"_id": 0}).sort("score", -1).limit(limit)
    scores = await cursor.to_list(length=limit)
    for s in scores:
        u = await db.users.find_one({"_id": _oid(s["user_id"])}, {"name": 1, "email": 1, "_id": 0})
        s["display_name"] = ((u or {}).get("name") or (u or {}).get("email", "").split("@")[0] or "?")[:18]
    return {"highscores": scores}


@router.get("/config")
async def config():
    return {
        "entry_fee_blz": ENTRY_FEE_BLZ,
        "highscore_reward_blz": HIGHSCORE_REWARD_BLZ,
    }
