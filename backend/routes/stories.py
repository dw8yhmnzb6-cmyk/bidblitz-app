"""
BidBlitz V2 - Social Stories Feed
Users post stories about deals, savings, rides — like/comment/share
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timezone, timedelta
from core.database import db
from core.security import get_current_user
import secrets

router = APIRouter(prefix="/api/stories", tags=["stories"])


class StoryCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=500)
    type: str = "text"  # text, deal, achievement, ride
    image_url: str = ""
    tags: list = []


class CommentCreate(BaseModel):
    story_id: str
    text: str = Field(..., min_length=1, max_length=300)


@router.get("/feed")
async def get_feed(page: int = 0, limit: int = 20):
    stories = await db.stories.find(
        {"status": "active"}, {"_id": 0}
    ).sort("created_at", -1).skip(page * limit).limit(limit).to_list(limit)
    return {"stories": stories, "page": page}


@router.post("/create")
async def create_story(req: StoryCreate, request: Request):
    user = await get_current_user(request)
    story = {
        "story_id": f"st_{secrets.token_hex(6)}",
        "author_email": user.get("email", ""),
        "author_name": user.get("name", ""),
        "content": req.content,
        "type": req.type,
        "image_url": req.image_url,
        "tags": req.tags,
        "likes": [],
        "comments": [],
        "like_count": 0,
        "comment_count": 0,
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.stories.insert_one(story)
    story.pop("_id", None)
    return {"ok": True, "story": story}


@router.post("/like/{story_id}")
async def toggle_like(story_id: str, request: Request):
    user = await get_current_user(request)
    email = user.get("email", "")
    story = await db.stories.find_one({"story_id": story_id})
    if not story:
        raise HTTPException(404, "Story nicht gefunden")
    
    likes = story.get("likes", [])
    if email in likes:
        likes.remove(email)
    else:
        likes.append(email)
    
    await db.stories.update_one(
        {"story_id": story_id},
        {"$set": {"likes": likes, "like_count": len(likes)}}
    )
    return {"ok": True, "liked": email in likes, "count": len(likes)}


@router.post("/comment")
async def add_comment(req: CommentCreate, request: Request):
    user = await get_current_user(request)
    comment = {
        "comment_id": secrets.token_hex(4),
        "author_email": user.get("email", ""),
        "author_name": user.get("name", ""),
        "text": req.text,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    result = await db.stories.update_one(
        {"story_id": req.story_id},
        {"$push": {"comments": comment}, "$inc": {"comment_count": 1}}
    )
    if result.modified_count == 0:
        raise HTTPException(404, "Story nicht gefunden")
    return {"ok": True, "comment": comment}
