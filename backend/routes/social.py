"""
BidBlitz V2 - Social Feed / Community
Posts, Likes, Kommentare, Stories, Follow-System
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional, List
from bson import ObjectId
from datetime import datetime, timezone, timedelta
from core.database import db
from core.security import get_current_user
import secrets

router = APIRouter(prefix="/api/social", tags=["social"])


class PostCreate(BaseModel):
    text: str = ""
    image_url: str = ""
    post_type: str = "post"  # post | story


class CommentCreate(BaseModel):
    post_id: str
    text: str


# ─── FEED ───

@router.get("/feed")
async def get_feed(request: Request, limit: int = 30, offset: int = 0):
    user = await get_current_user(request)
    user_id = str(user["_id"])

    # Get followed user IDs
    follows = await db.social_follows.find({"follower_id": user_id}, {"_id": 0, "following_id": 1}).to_list(500)
    follow_ids = [f["following_id"] for f in follows]
    follow_ids.append(user_id)  # Include own posts

    posts = await db.social_posts.find(
        {"author_id": {"$in": follow_ids}, "post_type": "post"},
        {"_id": 0}
    ).sort("created_at", -1).skip(offset).limit(limit).to_list(limit)

    # Enrich with like/comment counts
    for p in posts:
        p["liked"] = await db.social_likes.find_one({"post_id": p["post_id"], "user_id": user_id}) is not None
        p["comment_count"] = await db.social_comments.count_documents({"post_id": p["post_id"]})

    return {"posts": posts}


@router.get("/explore")
async def explore(limit: int = 30):
    """Public feed — trending posts."""
    posts = await db.social_posts.find(
        {"post_type": "post"}, {"_id": 0}
    ).sort("like_count", -1).limit(limit).to_list(limit)
    return {"posts": posts}


@router.get("/stories")
async def get_stories(request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])

    follows = await db.social_follows.find({"follower_id": user_id}, {"_id": 0, "following_id": 1}).to_list(500)
    follow_ids = [f["following_id"] for f in follows]
    follow_ids.append(user_id)

    cutoff = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    stories = await db.social_posts.find(
        {"author_id": {"$in": follow_ids}, "post_type": "story", "created_at": {"$gte": cutoff}},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)

    # Group by author
    by_author = {}
    for s in stories:
        aid = s["author_id"]
        if aid not in by_author:
            by_author[aid] = {"author_id": aid, "author_name": s["author_name"], "author_avatar": s.get("author_avatar", ""), "stories": []}
        by_author[aid]["stories"].append(s)

    return {"story_groups": list(by_author.values())}


# ─── POSTS ───

@router.post("/posts")
async def create_post(req: PostCreate, request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    now = datetime.now(timezone.utc).isoformat()
    post_id = secrets.token_hex(8)

    post = {
        "post_id": post_id,
        "author_id": user_id,
        "author_name": user.get("name", ""),
        "author_email": user.get("email", ""),
        "author_avatar": "",
        "text": req.text,
        "image_url": req.image_url,
        "post_type": req.post_type,
        "like_count": 0,
        "comment_count": 0,
        "created_at": now,
    }
    await db.social_posts.insert_one(post)
    post.pop("_id", None)
    return {"ok": True, "post": post}


@router.delete("/posts/{post_id}")
async def delete_post(post_id: str, request: Request):
    user = await get_current_user(request)
    p = await db.social_posts.find_one({"post_id": post_id})
    if not p or p["author_id"] != str(user["_id"]):
        raise HTTPException(status_code=403, detail="Nicht berechtigt")
    await db.social_posts.delete_one({"post_id": post_id})
    await db.social_likes.delete_many({"post_id": post_id})
    await db.social_comments.delete_many({"post_id": post_id})
    return {"ok": True}


@router.get("/posts/{post_id}")
async def get_post(post_id: str, request: Request):
    user = await get_current_user(request)
    p = await db.social_posts.find_one({"post_id": post_id}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Post nicht gefunden")
    p["liked"] = await db.social_likes.find_one({"post_id": post_id, "user_id": str(user["_id"])}) is not None
    comments = await db.social_comments.find({"post_id": post_id}, {"_id": 0}).sort("created_at", 1).limit(50).to_list(50)
    p["comments"] = comments
    return p


# ─── LIKES ───

@router.post("/like/{post_id}")
async def toggle_like(post_id: str, request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])

    existing = await db.social_likes.find_one({"post_id": post_id, "user_id": user_id})
    if existing:
        await db.social_likes.delete_one({"post_id": post_id, "user_id": user_id})
        await db.social_posts.update_one({"post_id": post_id}, {"$inc": {"like_count": -1}})
        return {"ok": True, "liked": False}
    else:
        await db.social_likes.insert_one({
            "post_id": post_id, "user_id": user_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        await db.social_posts.update_one({"post_id": post_id}, {"$inc": {"like_count": 1}})
        return {"ok": True, "liked": True}


# ─── COMMENTS ───

@router.post("/comments")
async def add_comment(req: CommentCreate, request: Request):
    user = await get_current_user(request)
    now = datetime.now(timezone.utc).isoformat()
    comment_id = secrets.token_hex(8)

    comment = {
        "comment_id": comment_id,
        "post_id": req.post_id,
        "author_id": str(user["_id"]),
        "author_name": user.get("name", ""),
        "text": req.text,
        "created_at": now,
    }
    await db.social_comments.insert_one(comment)
    comment.pop("_id", None)
    await db.social_posts.update_one({"post_id": req.post_id}, {"$inc": {"comment_count": 1}})
    return {"ok": True, "comment": comment}


# ─── FOLLOW ───

@router.post("/follow/{target_id}")
async def toggle_follow(target_id: str, request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])

    if target_id == user_id:
        raise HTTPException(status_code=400, detail="Sich selbst folgen nicht möglich")

    existing = await db.social_follows.find_one({"follower_id": user_id, "following_id": target_id})
    if existing:
        await db.social_follows.delete_one({"follower_id": user_id, "following_id": target_id})
        return {"ok": True, "following": False}
    else:
        await db.social_follows.insert_one({
            "follower_id": user_id, "following_id": target_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        return {"ok": True, "following": True}


@router.get("/profile/{user_id}")
async def get_profile(user_id: str, request: Request):
    current = await get_current_user(request)
    current_id = str(current["_id"])

    target = await db.users.find_one({"_id": ObjectId(user_id)}, {"_id": 0, "name": 1, "email": 1, "created_at": 1})
    if not target:
        raise HTTPException(status_code=404, detail="User nicht gefunden")

    posts = await db.social_posts.find(
        {"author_id": user_id, "post_type": "post"}, {"_id": 0}
    ).sort("created_at", -1).limit(30).to_list(30)

    follower_count = await db.social_follows.count_documents({"following_id": user_id})
    following_count = await db.social_follows.count_documents({"follower_id": user_id})
    is_following = await db.social_follows.find_one({"follower_id": current_id, "following_id": user_id}) is not None

    return {
        "user_id": user_id,
        "name": target.get("name", ""),
        "posts": posts,
        "post_count": len(posts),
        "follower_count": follower_count,
        "following_count": following_count,
        "is_following": is_following,
    }


@router.get("/my-profile")
async def my_profile(request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])

    post_count = await db.social_posts.count_documents({"author_id": user_id, "post_type": "post"})
    follower_count = await db.social_follows.count_documents({"following_id": user_id})
    following_count = await db.social_follows.count_documents({"follower_id": user_id})

    return {
        "user_id": user_id,
        "name": user.get("name", ""),
        "post_count": post_count,
        "follower_count": follower_count,
        "following_count": following_count,
    }
