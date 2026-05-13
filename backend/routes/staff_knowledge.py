"""
BidBlitz Staff — Knowledge Base
================================
Tutorials, Standards, Rezepte, Spickzettel.
Mitarbeiter durchsuchen & lesen — Manager pflegt Artikel.

Collections:
- staff_kb_articles: {id, merchant_id, title, slug, content (markdown), category, tags[], cover_url, pinned, published, view_count, created_at, updated_at}
- staff_kb_views: optional analytics
"""
from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone
from uuid import uuid4
import os
import re
from motor.motor_asyncio import AsyncIOMotorClient

router = APIRouter(prefix="/api/staff/knowledge", tags=["staff-knowledge"])
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


class ArticleUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None
    cover_url: Optional[str] = None
    pinned: Optional[bool] = None
    published: Optional[bool] = None


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
