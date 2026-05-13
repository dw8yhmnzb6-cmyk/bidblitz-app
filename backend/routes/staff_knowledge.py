"""
BidBlitz Staff — Knowledge Base
================================
Tutorials, Standards, Rezepte, Spickzettel.
Mitarbeiter durchsuchen & lesen — Manager pflegt Artikel.

Collections:
- staff_kb_articles: {id, merchant_id, title, slug, content (markdown), category, tags[], cover_url, pinned, published, view_count, ai_summary, quiz[], created_at, updated_at}
- staff_kb_quiz_attempts: {id, merchant_id, staff_id, article_id, score, total, answers, created_at}
"""
from fastapi import APIRouter, HTTPException, Request, Depends, UploadFile, File
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4
import os
import re
import logging
from motor.motor_asyncio import AsyncIOMotorClient

router = APIRouter(prefix="/api/staff/knowledge", tags=["staff-knowledge"])
client = AsyncIOMotorClient(os.getenv("MONGO_URL"))
db = client[os.getenv("DB_NAME", "bidblitz")]
logger = logging.getLogger("bidblitz.staff_knowledge")

# Upload dir (served via /uploads/* in server.py)
KB_UPLOAD_DIR = Path(__file__).parent.parent / "uploads" / "knowledge"
KB_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
ALLOWED_IMG_EXT = {".jpg", ".jpeg", ".png", ".webp"}
MAX_IMG_SIZE = 5 * 1024 * 1024  # 5MB


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


def _slugify(s: str) -> str:
    s = re.sub(r"[^a-zA-Z0-9\s-]", "", s).strip().lower()
    return re.sub(r"\s+", "-", s)[:60]


class ArticleCreate(BaseModel):
    title: str = Field(..., min_length=1)
    content: str = Field(..., min_length=1)
    category: Optional[str] = "Allgemein"
    tags: List[str] = []
    cover_url: Optional[str] = None
    pinned: bool = False
    published: bool = True
    quiz: List[dict] = []


class ArticleUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None
    cover_url: Optional[str] = None
    pinned: Optional[bool] = None
    published: Optional[bool] = None
    quiz: Optional[List[dict]] = None


class QuizAttempt(BaseModel):
    answers: List[int]  # selected option index per question


def _validate_quiz(quiz: List[dict]) -> List[dict]:
    """Normalize quiz items. Each item: {question:str, options:[str], correct:int}."""
    clean = []
    for q in quiz or []:
        if not isinstance(q, dict):
            continue
        question = str(q.get("question", "")).strip()
        options = q.get("options") or []
        try:
            correct = int(q.get("correct", 0))
        except (TypeError, ValueError):
            correct = 0
        options = [str(o).strip() for o in options if str(o).strip()]
        if not question or len(options) < 2:
            continue
        if correct < 0 or correct >= len(options):
            correct = 0
        clean.append({"question": question, "options": options, "correct": correct})
    return clean


# ─────────── Merchant CRUD ───────────
@router.post("/articles")
async def create_article(data: ArticleCreate, request: Request):
    mid = await _merchant_id(request)
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": str(uuid4()),
        "merchant_id": mid,
        "title": data.title,
        "slug": _slugify(data.title),
        "content": data.content,
        "category": data.category or "Allgemein",
        "tags": data.tags or [],
        "cover_url": data.cover_url,
        "pinned": data.pinned,
        "published": data.published,
        "view_count": 0,
        "ai_summary": None,
        "quiz": _validate_quiz(data.quiz),
        "created_at": now,
        "updated_at": now,
    }
    await db.staff_kb_articles.insert_one(doc)
    doc.pop("_id", None)
    return {"success": True, "article": doc}


@router.get("/articles")
async def list_articles(request: Request, q: Optional[str] = None,
                        category: Optional[str] = None, published: Optional[bool] = None):
    mid = await _merchant_id(request)
    query: dict = {"merchant_id": mid}
    if published is not None:
        query["published"] = published
    if category:
        query["category"] = category
    if q:
        query["$or"] = [
            {"title": {"$regex": re.escape(q), "$options": "i"}},
            {"content": {"$regex": re.escape(q), "$options": "i"}},
            {"tags": {"$elemMatch": {"$regex": re.escape(q), "$options": "i"}}},
        ]
    items = await db.staff_kb_articles.find(query, {"_id": 0}).sort([("pinned", -1), ("updated_at", -1)]).to_list(500)
    return {"success": True, "articles": items, "count": len(items)}


@router.patch("/articles/{article_id}")
async def update_article(article_id: str, data: ArticleUpdate, request: Request):
    mid = await _merchant_id(request)
    update = {k: v for k, v in data.model_dump(exclude_none=True).items()}
    if not update:
        return {"success": True, "no_change": True}
    if "title" in update:
        update["slug"] = _slugify(update["title"])
    if "quiz" in update:
        update["quiz"] = _validate_quiz(update["quiz"])
    if "content" in update:
        # Invalidate AI summary on content change
        update["ai_summary"] = None
    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    res = await db.staff_kb_articles.update_one(
        {"id": article_id, "merchant_id": mid}, {"$set": update},
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Artikel nicht gefunden")
    a = await db.staff_kb_articles.find_one({"id": article_id}, {"_id": 0})
    return {"success": True, "article": a}


@router.delete("/articles/{article_id}")
async def delete_article(article_id: str, request: Request):
    mid = await _merchant_id(request)
    res = await db.staff_kb_articles.delete_one({"id": article_id, "merchant_id": mid})
    if res.deleted_count == 0:
        raise HTTPException(404, "Artikel nicht gefunden")
    return {"success": True}


# ─────────── Staff Read ───────────
@router.get("/me/articles")
async def my_articles(q: Optional[str] = None, category: Optional[str] = None,
                      member=Depends(_staff_session)):
    query: dict = {"merchant_id": member["merchant_id"], "published": True}
    if category:
        query["category"] = category
    if q:
        query["$or"] = [
            {"title": {"$regex": re.escape(q), "$options": "i"}},
            {"content": {"$regex": re.escape(q), "$options": "i"}},
            {"tags": {"$elemMatch": {"$regex": re.escape(q), "$options": "i"}}},
        ]
    items = await db.staff_kb_articles.find(query, {"_id": 0, "content": 0}).sort(
        [("pinned", -1), ("updated_at", -1)],
    ).to_list(500)
    # Add quiz_count, strip quiz correct answers, drop quiz array from list view
    for a in items:
        a["quiz_count"] = len(a.get("quiz") or [])
        a.pop("quiz", None)
    return {"success": True, "articles": items, "count": len(items)}


@router.get("/me/articles/{article_id}")
async def read_article(article_id: str, member=Depends(_staff_session)):
    a = await db.staff_kb_articles.find_one(
        {"id": article_id, "merchant_id": member["merchant_id"], "published": True},
        {"_id": 0},
    )
    if not a:
        raise HTTPException(404, "Artikel nicht gefunden")
    # Increment view (fire-and-forget)
    await db.staff_kb_articles.update_one({"id": article_id}, {"$inc": {"view_count": 1}})
    a["view_count"] = (a.get("view_count") or 0) + 1
    # Strip correct answer index from quiz for staff
    if a.get("quiz"):
        a["quiz"] = [{"question": q["question"], "options": q["options"]} for q in a["quiz"]]
    # Mark whether staff already attempted
    last = await db.staff_kb_quiz_attempts.find_one(
        {"article_id": article_id, "staff_id": member["id"]},
        {"_id": 0}, sort=[("created_at", -1)],
    )
    if last:
        a["last_quiz_attempt"] = {"score": last["score"], "total": last["total"], "passed": last.get("passed", False), "created_at": last["created_at"]}
    return {"success": True, "article": a}


@router.get("/me/categories")
async def my_categories(member=Depends(_staff_session)):
    cats = await db.staff_kb_articles.distinct(
        "category",
        {"merchant_id": member["merchant_id"], "published": True},
    )
    return {"success": True, "categories": sorted([c for c in cats if c])}


@router.get("/categories")
async def all_categories(request: Request):
    mid = await _merchant_id(request)
    cats = await db.staff_kb_articles.distinct("category", {"merchant_id": mid})
    return {"success": True, "categories": sorted([c for c in cats if c])}


# ─────────── Cover Upload ───────────
@router.post("/upload-cover")
async def upload_cover(request: Request, file: UploadFile = File(...)):
    """Upload a cover image for KB articles. Returns public URL under /uploads/knowledge/."""
    await _merchant_id(request)  # auth + role check
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_IMG_EXT:
        raise HTTPException(400, f"Ungültiger Dateityp ({ext}). Erlaubt: JPG/PNG/WEBP")
    data = await file.read()
    if len(data) > MAX_IMG_SIZE:
        raise HTTPException(400, "Bild zu groß (max 5MB)")
    if len(data) < 64:
        raise HTTPException(400, "Datei zu klein / leer")
    fname = f"kb_{uuid4().hex}{ext}"
    fpath = KB_UPLOAD_DIR / fname
    fpath.write_bytes(data)
    return {"success": True, "url": f"/uploads/knowledge/{fname}", "filename": fname}


# ─────────── AI Summary ───────────
@router.post("/articles/{article_id}/summary")
async def generate_summary(article_id: str, request: Request):
    """Generate AI summary (Claude Sonnet 4.5) of article content. Persists to ai_summary field."""
    mid = await _merchant_id(request)
    art = await db.staff_kb_articles.find_one({"id": article_id, "merchant_id": mid}, {"_id": 0})
    if not art:
        raise HTTPException(404, "Artikel nicht gefunden")
    content = (art.get("content") or "").strip()
    if len(content) < 30:
        raise HTTPException(400, "Inhalt zu kurz für eine Zusammenfassung")

    key = os.getenv("EMERGENT_LLM_KEY")
    if not key:
        raise HTTPException(503, "AI-Service nicht konfiguriert")

    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        chat = LlmChat(
            api_key=key,
            session_id=f"kb-summary-{article_id}",
            system_message=(
                "Du bist ein präziser Assistent für Wissens-Datenbanken in Unternehmen. "
                "Fasse den gegebenen Artikel in **maximal 2 prägnanten Sätzen** auf Deutsch zusammen — "
                "fokussiert auf das Wichtigste für einen Mitarbeiter. Keine Floskeln, keine Anführungszeichen, kein Markdown."
            ),
        ).with_model("openai", "gpt-4.1-mini")
        msg = UserMessage(text=f"Titel: {art.get('title')}\n\nInhalt:\n{content[:6000]}")
        resp = await chat.send_message(msg)
        summary = (resp or "").strip().strip('"').strip()
        if not summary:
            raise HTTPException(502, "Leere Antwort vom AI-Service")
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("AI summary failed")
        raise HTTPException(502, f"AI-Zusammenfassung fehlgeschlagen: {str(e)[:200]}")

    await db.staff_kb_articles.update_one(
        {"id": article_id, "merchant_id": mid},
        {"$set": {"ai_summary": summary, "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    return {"success": True, "ai_summary": summary}


# ─────────── Quiz Attempt (Staff) ───────────
@router.post("/me/articles/{article_id}/quiz-attempt")
async def submit_quiz_attempt(
    article_id: str, data: QuizAttempt, member=Depends(_staff_session),
):
    """Staff submits quiz answers. Returns score, correct/wrong per question."""
    art = await db.staff_kb_articles.find_one(
        {"id": article_id, "merchant_id": member["merchant_id"], "published": True},
        {"_id": 0},
    )
    if not art:
        raise HTTPException(404, "Artikel nicht gefunden")
    quiz = art.get("quiz") or []
    if not quiz:
        raise HTTPException(400, "Dieser Artikel hat kein Quiz")
    if len(data.answers) != len(quiz):
        raise HTTPException(400, f"Erwartet {len(quiz)} Antworten, erhalten {len(data.answers)}")

    results = []
    score = 0
    for i, q in enumerate(quiz):
        correct_idx = int(q.get("correct", 0))
        given = int(data.answers[i])
        ok = (given == correct_idx)
        if ok:
            score += 1
        results.append({"question": q["question"], "given": given, "correct": correct_idx, "ok": ok})

    total = len(quiz)
    passed = (score / total) >= 0.7 if total else False
    attempt = {
        "id": str(uuid4()),
        "merchant_id": member["merchant_id"],
        "staff_id": member["id"],
        "article_id": article_id,
        "score": score,
        "total": total,
        "passed": passed,
        "answers": data.answers,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.staff_kb_quiz_attempts.insert_one(attempt)
    attempt.pop("_id", None)
    return {
        "success": True,
        "score": score, "total": total, "passed": passed,
        "results": results,
        "attempt_id": attempt["id"],
    }


@router.get("/articles/{article_id}/quiz-attempts")
async def list_quiz_attempts(article_id: str, request: Request):
    """Manager: list all quiz attempts for an article."""
    mid = await _merchant_id(request)
    art = await db.staff_kb_articles.find_one({"id": article_id, "merchant_id": mid}, {"_id": 0, "id": 1})
    if not art:
        raise HTTPException(404, "Artikel nicht gefunden")
    items = await db.staff_kb_quiz_attempts.find(
        {"merchant_id": mid, "article_id": article_id}, {"_id": 0},
    ).sort("created_at", -1).to_list(500)
    return {"success": True, "attempts": items, "count": len(items)}
