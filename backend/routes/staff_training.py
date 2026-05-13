"""
BidBlitz Staff — Training / Quizzes / Onboarding
=================================================
Collections:
- staff_courses: {id, merchant_id, title, description, lessons[{type,content,questions?}], mandatory}
- staff_course_progress: {course_id, staff_id, completed_lessons[], score, status, started_at, completed_at}

Lesson types:
- "text"  → markdown content
- "video" → URL
- "quiz"  → questions[{q,options[],correct_idx}]
"""
from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel, Field
from typing import Optional, List, Literal, Any
from datetime import datetime, timezone
from uuid import uuid4
import os
from motor.motor_asyncio import AsyncIOMotorClient

router = APIRouter(prefix="/api/staff/training", tags=["staff-training"])
client = AsyncIOMotorClient(os.getenv("MONGO_URL"))
db = client[os.getenv("DB_NAME", "bidblitz")]


async def _merchant_id(request: Request) -> str:
    from routes.auth import get_current_user as auth_user
    user = await auth_user(request)
    if user.get("role") not in ("merchant", "admin"):
        raise HTTPException(403, "Nur für Händler oder Administratoren")
    return str(user.get("user_id") or user.get("id"))


async def _staff_session(request: Request) -> dict:
    sid = request.cookies.get("staff_session")
    if not sid:
        raise HTTPException(401, "Nicht angemeldet")
    m = await db.staff_members.find_one({"id": sid, "active": True}, {"_id": 0, "pin_hash": 0, "password_hash": 0})
    if not m:
        raise HTTPException(401, "Session ungültig")
    return m


class QuizQuestion(BaseModel):
    q: str
    options: List[str]
    correct_idx: int


class Lesson(BaseModel):
    title: str
    type: Literal["text", "video", "quiz"]
    content: Optional[str] = None
    video_url: Optional[str] = None
    questions: Optional[List[QuizQuestion]] = None


class CourseCreate(BaseModel):
    title: str = Field(..., min_length=1)
    description: Optional[str] = ""
    mandatory: bool = False
    lessons: List[Lesson]
    pass_score: int = 80


class ProgressUpdate(BaseModel):
    lesson_index: int
    quiz_answers: Optional[List[int]] = None  # if lesson is quiz, indices chosen


@router.post("/courses")
async def create_course(data: CourseCreate, request: Request):
    mid = await _merchant_id(request)
    course = {
        "id": str(uuid4()),
        "merchant_id": mid,
        "title": data.title,
        "description": data.description or "",
        "mandatory": data.mandatory,
        "lessons": [l.model_dump() for l in data.lessons],
        "pass_score": data.pass_score,
        "active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.staff_courses.insert_one(course)
    course.pop("_id", None)
    return {"success": True, "course": course}


@router.get("/courses")
async def list_courses(request: Request):
    mid = await _merchant_id(request)
    items = await db.staff_courses.find({"merchant_id": mid, "active": True}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return {"success": True, "courses": items}


@router.delete("/courses/{course_id}")
async def delete_course(course_id: str, request: Request):
    mid = await _merchant_id(request)
    res = await db.staff_courses.delete_one({"id": course_id, "merchant_id": mid})
    if res.deleted_count == 0:
        raise HTTPException(404, "Kurs nicht gefunden")
    return {"success": True}


@router.get("/me/courses")
async def my_courses(member=Depends(_staff_session)):
    """Liste aller Kurse + eigener Fortschritt."""
    courses = await db.staff_courses.find(
        {"merchant_id": member["merchant_id"], "active": True}, {"_id": 0},
    ).sort("created_at", -1).to_list(100)
    progs = await db.staff_course_progress.find(
        {"merchant_id": member["merchant_id"], "staff_id": member["id"]},
        {"_id": 0},
    ).to_list(500)
    prog_map = {p["course_id"]: p for p in progs}
    for c in courses:
        p = prog_map.get(c["id"])
        c["progress"] = p or {
            "completed_lessons": [], "score": 0, "status": "not_started", "started_at": None, "completed_at": None,
        }
        c["completion_pct"] = round(len(c["progress"]["completed_lessons"]) / max(len(c["lessons"]), 1) * 100)
    return {"success": True, "courses": courses}


@router.get("/me/courses/{course_id}")
async def get_my_course(course_id: str, member=Depends(_staff_session)):
    c = await db.staff_courses.find_one({"id": course_id, "merchant_id": member["merchant_id"]}, {"_id": 0})
    if not c:
        raise HTTPException(404, "Kurs nicht gefunden")
    p = await db.staff_course_progress.find_one(
        {"course_id": course_id, "staff_id": member["id"]}, {"_id": 0},
    )
    return {"success": True, "course": c, "progress": p}


@router.post("/me/courses/{course_id}/progress")
async def update_progress(course_id: str, data: ProgressUpdate, member=Depends(_staff_session)):
    c = await db.staff_courses.find_one({"id": course_id, "merchant_id": member["merchant_id"]})
    if not c:
        raise HTTPException(404, "Kurs nicht gefunden")
    if data.lesson_index < 0 or data.lesson_index >= len(c["lessons"]):
        raise HTTPException(400, "Ungültiger Lesson-Index")
    lesson = c["lessons"][data.lesson_index]

    prog = await db.staff_course_progress.find_one(
        {"course_id": course_id, "staff_id": member["id"]},
    )
    now = datetime.now(timezone.utc).isoformat()
    if not prog:
        prog = {
            "id": str(uuid4()),
            "course_id": course_id,
            "merchant_id": member["merchant_id"],
            "staff_id": member["id"],
            "completed_lessons": [],
            "score": 0,
            "status": "in_progress",
            "started_at": now,
            "completed_at": None,
            "quiz_results": {},
        }

    # If quiz, score it
    if lesson["type"] == "quiz" and data.quiz_answers is not None:
        questions = lesson.get("questions") or []
        correct = 0
        for i, q in enumerate(questions):
            if i < len(data.quiz_answers) and data.quiz_answers[i] == q["correct_idx"]:
                correct += 1
        pct = round(correct / max(len(questions), 1) * 100)
        prog["quiz_results"][str(data.lesson_index)] = {"score": pct, "correct": correct, "total": len(questions)}
        if pct < c["pass_score"]:
            # not completed
            prog["last_attempt_at"] = now
            await db.staff_course_progress.replace_one(
                {"course_id": course_id, "staff_id": member["id"]}, prog, upsert=True,
            )
            return {"success": False, "passed": False, "score": pct, "required": c["pass_score"]}

    if data.lesson_index not in prog["completed_lessons"]:
        prog["completed_lessons"].append(data.lesson_index)

    # Overall score = avg of quizzes
    quiz_scores = [v["score"] for v in prog.get("quiz_results", {}).values()]
    prog["score"] = round(sum(quiz_scores) / len(quiz_scores)) if quiz_scores else 100

    # Status
    if len(prog["completed_lessons"]) >= len(c["lessons"]):
        prog["status"] = "completed"
        prog["completed_at"] = now
    else:
        prog["status"] = "in_progress"

    await db.staff_course_progress.replace_one(
        {"course_id": course_id, "staff_id": member["id"]}, prog, upsert=True,
    )
    prog.pop("_id", None)
    return {"success": True, "passed": True, "progress": prog}


@router.get("/analytics")
async def training_analytics(request: Request):
    """Onboarding-Analytics: Pro Kurs % completion + per-staff progress."""
    mid = await _merchant_id(request)
    courses = await db.staff_courses.find({"merchant_id": mid, "active": True}, {"_id": 0, "lessons": 0}).to_list(100)
    members_count = await db.staff_members.count_documents({"merchant_id": mid, "active": True})
    out = []
    for c in courses:
        completed = await db.staff_course_progress.count_documents(
            {"course_id": c["id"], "status": "completed"},
        )
        in_progress = await db.staff_course_progress.count_documents(
            {"course_id": c["id"], "status": "in_progress"},
        )
        pct = round(completed / max(members_count, 1) * 100)
        out.append({**c, "completed_count": completed, "in_progress_count": in_progress,
                    "members_total": members_count, "completion_pct": pct})
    return {"success": True, "courses": out, "members_count": members_count}
