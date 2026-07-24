"""BidBlitz V2 - Mikro-Aufgaben (TaskRabbit-Style)"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from datetime import datetime, timezone
from core.database import db
from core.security import get_current_user
import secrets

router = APIRouter(prefix="/api/micro-tasks", tags=["micro-tasks"])

TASKS = [
    {"id": "t1", "title": "5 Produktfotos machen", "desc": "Fotografiere 5 Produkte im Supermarkt", "reward": 3.50, "time_min": 15, "category": "Foto", "difficulty": "Einfach"},
    {"id": "t2", "title": "App-Review schreiben", "desc": "Schreibe eine ehrliche Review (mind. 100 Woerter)", "reward": 2.00, "time_min": 10, "category": "Text", "difficulty": "Einfach"},
    {"id": "t3", "title": "Preisvergleich durchfuehren", "desc": "Vergleiche 10 Produkte in 3 Shops", "reward": 5.00, "time_min": 20, "category": "Research", "difficulty": "Mittel"},
    {"id": "t4", "title": "Social Media Post erstellen", "desc": "Erstelle einen Instagram-Post mit Hashtags", "reward": 4.00, "time_min": 15, "category": "Social", "difficulty": "Mittel"},
    {"id": "t5", "title": "Uebersetzung DE->EN (500 Woerter)", "desc": "Uebersetze einen kurzen Text", "reward": 8.00, "time_min": 30, "category": "Text", "difficulty": "Schwer"},
    {"id": "t6", "title": "Mystery Shopping: Cafe bewerten", "desc": "Besuche ein Cafe und bewerte Service & Qualitaet", "reward": 10.00, "time_min": 45, "category": "Mystery", "difficulty": "Mittel"},
    {"id": "t7", "title": "Daten-Eingabe (50 Eintraege)", "desc": "Trage Daten in eine Tabelle ein", "reward": 6.00, "time_min": 25, "category": "Data", "difficulty": "Einfach"},
    {"id": "t8", "title": "Video-Testimonial aufnehmen", "desc": "30-Sekunden Video-Review fuer ein Produkt", "reward": 7.00, "time_min": 10, "category": "Video", "difficulty": "Mittel"},
]

class CompleteTask(BaseModel):
    task_id: str

@router.get("/available")
async def available_tasks(request: Request):
    user = await get_current_user(request)
    done = await db.task_completions.find({"user_email": user.get("email","")}, {"task_id": 1, "_id": 0}).to_list(100)
    done_ids = {d["task_id"] for d in done}
    available = [t for t in TASKS if t["id"] not in done_ids]
    total = sum(d.get("reward", 0) for d in await db.task_completions.find({"user_email": user.get("email","")}, {"reward": 1, "_id": 0}).to_list(100))
    return {"tasks": available, "completed_count": len(done_ids), "total_earned": round(total, 2)}

@router.post("/complete")
async def complete_task(req: CompleteTask, request: Request):
    user = await get_current_user(request)
    task = next((t for t in TASKS if t["id"] == req.task_id), None)
    if not task: raise HTTPException(404, "Aufgabe nicht gefunden")
    existing = await db.task_completions.find_one({"user_email": user.get("email",""), "task_id": req.task_id})
    if existing: raise HTTPException(400, "Bereits erledigt")
    fee = round(task["reward"] * 0.15, 2)
    await db.task_completions.insert_one({"user_email": user.get("email",""), "task_id": req.task_id, "reward": task["reward"], "fee": fee, "created_at": datetime.now(timezone.utc).isoformat()})
    await db.users.update_one({"email": user.get("email","")}, {"$inc": {"balance": task["reward"]}})
    return {"ok": True, "reward": task["reward"], "message": f"+{task['reward']} EUR verdient! Aufgabe abgeschlossen."}
