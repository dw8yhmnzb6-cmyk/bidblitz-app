"""BidBlitz V2 - Quiz Battle (1v1 Trivia)"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from datetime import datetime, timezone
from core.database import db
from core.security import get_current_user
import secrets, random

router = APIRouter(prefix="/api/quiz", tags=["quiz"])

QUESTIONS = [
    {"q": "Welche Kryptowaehrung wurde 2009 erfunden?", "options": ["Ethereum", "Bitcoin", "Dogecoin", "Litecoin"], "answer": 1},
    {"q": "Wie viele Bundeslaender hat Deutschland?", "options": ["14", "15", "16", "17"], "answer": 2},
    {"q": "Wer hat die Relativitaetstheorie entwickelt?", "options": ["Newton", "Einstein", "Hawking", "Bohr"], "answer": 1},
    {"q": "Was ist die Hauptstadt von Australien?", "options": ["Sydney", "Melbourne", "Canberra", "Brisbane"], "answer": 2},
    {"q": "Welches Element hat das Symbol 'Au'?", "options": ["Silber", "Aluminium", "Gold", "Kupfer"], "answer": 2},
    {"q": "In welchem Jahr fiel die Berliner Mauer?", "options": ["1987", "1988", "1989", "1990"], "answer": 2},
    {"q": "Wie heisst der hoechste Berg der Welt?", "options": ["K2", "Mount Everest", "Kangchenjunga", "Makalu"], "answer": 1},
    {"q": "Welcher Planet ist der groesste im Sonnensystem?", "options": ["Saturn", "Jupiter", "Neptun", "Uranus"], "answer": 1},
    {"q": "Was ist die Quadratwurzel von 144?", "options": ["10", "11", "12", "13"], "answer": 2},
    {"q": "Welches Land hat die meisten Einwohner?", "options": ["Indien", "China", "USA", "Indonesien"], "answer": 0},
    {"q": "Wer malte die Mona Lisa?", "options": ["Michelangelo", "Raphael", "Da Vinci", "Picasso"], "answer": 2},
    {"q": "Wie viele Bits sind ein Byte?", "options": ["4", "8", "16", "32"], "answer": 1},
]

class StartQuiz(BaseModel):
    bet_eur: float = Field(default=1, ge=0.5, le=50)

class AnswerQuiz(BaseModel):
    match_id: str
    answers: list  # list of ints

@router.post("/start")
async def start_quiz(req: StartQuiz, request: Request):
    user = await get_current_user(request)
    qs = random.sample(QUESTIONS, min(5, len(QUESTIONS)))
    match = {
        "match_id": f"quiz_{secrets.token_hex(6)}", "user_email": user.get("email",""), "bet_eur": req.bet_eur,
        "questions": [{"q": q["q"], "options": q["options"]} for q in qs],
        "correct_answers": [q["answer"] for q in qs],
        "status": "active", "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.quiz_matches.insert_one(match)
    return {"ok": True, "match_id": match["match_id"], "questions": match["questions"], "bet": req.bet_eur}

@router.post("/answer")
async def answer_quiz(req: AnswerQuiz, request: Request):
    user = await get_current_user(request)
    match = await db.quiz_matches.find_one({"match_id": req.match_id, "user_email": user.get("email",""), "status": "active"})
    if not match: raise HTTPException(404, "Quiz nicht gefunden")
    correct = match["correct_answers"]
    score = sum(1 for i, a in enumerate(req.answers) if i < len(correct) and a == correct[i])
    total = len(correct)
    won = score >= 3
    pnl = round(match["bet_eur"] * 1.8, 2) if won else -match["bet_eur"]
    if won: await db.users.update_one({"email": user.get("email","")}, {"$inc": {"balance": match["bet_eur"] * 1.8}})
    await db.quiz_matches.update_one({"match_id": req.match_id}, {"$set": {"status": "completed", "score": score, "won": won, "pnl": pnl}})
    return {"ok": True, "score": score, "total": total, "won": won, "pnl": pnl,
            "message": f"{score}/{total} richtig! {'Gewonnen: +' + str(pnl) + ' EUR!' if won else 'Leider verloren.'}"}

@router.get("/leaderboard")
async def quiz_leaderboard():
    pipeline = [{"$match": {"status": "completed"}}, {"$group": {"_id": "$user_email", "wins": {"$sum": {"$cond": ["$won", 1, 0]}}, "total": {"$sum": 1}, "earnings": {"$sum": "$pnl"}}}, {"$sort": {"wins": -1}}, {"$limit": 10}]
    leaders = await db.quiz_matches.aggregate(pipeline).to_list(10)
    for l in leaders:
        e = l.get("_id", "")
        l["name"] = e.split("@")[0][:3] + "***" if e else "***"
        l["earnings"] = round(l.get("earnings", 0), 2)
        del l["_id"]
    return {"leaderboard": leaders}
