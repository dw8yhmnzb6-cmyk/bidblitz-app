"""
BidBlitz V2 - Admin: AI Image Regeneration for Auctions
Lets the admin regenerate the product photo of any auction with one click.
"""
import logging
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from core.database import db
from core.security import get_current_user
from services.product_image_generator import get_product_image_generator

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin/auction-images", tags=["admin-auction-images"])


class RegenRequest(BaseModel):
    auction_id: str | None = None
    title: str | None = None
    description: str | None = None
    force: bool = True  # Always regenerate by default for admin


async def _require_admin(request: Request) -> dict:
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    return user


@router.post("/regenerate")
async def regenerate_image(req: RegenRequest, request: Request):
    """Generate a new AI product image for one auction."""
    await _require_admin(request)

    if not req.auction_id and not req.title:
        raise HTTPException(status_code=400, detail="auction_id or title required")

    # Find the auction
    query = {}
    if req.auction_id:
        query["_id"] = req.auction_id
    elif req.title:
        query["title"] = req.title

    auction = None
    coll_used = None
    for coll in ["auctions", "auction_items"]:
        a = await db[coll].find_one(query)
        if a:
            auction = a
            coll_used = coll
            break
    if not auction:
        # Maybe the id is stored as ObjectId? Try string match
        if req.auction_id:
            for coll in ["auctions", "auction_items"]:
                a = await db[coll].find_one({"id": req.auction_id})
                if a:
                    auction = a
                    coll_used = coll
                    break

    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")

    title = auction.get("title") or req.title or ""
    description = req.description or auction.get("description") or auction.get("subtitle") or ""

    gen = get_product_image_generator()
    result = await gen.generate_for_product(title, description, force=req.force)

    if not result.get("success"):
        raise HTTPException(status_code=502, detail=f"AI generation failed: {result.get('error')}")

    new_url = result["url"]
    await db[coll_used].update_one(
        {"_id": auction["_id"]},
        {"$set": {"image_url": new_url, "image": new_url}},
    )

    return {
        "ok": True,
        "auction_id": str(auction.get("_id") or auction.get("id")),
        "title": title,
        "image_url": new_url,
        "cached": result.get("cached", False),
    }


@router.get("/list")
async def list_auctions_with_images(request: Request, limit: int = 200):
    """List all auctions with their current image URLs (for admin grid)."""
    await _require_admin(request)
    out = []
    for coll in ["auctions", "auction_items"]:
        try:
            cnt = await db[coll].count_documents({})
        except Exception:
            continue
        if cnt == 0:
            continue
        docs = await db[coll].find(
            {}, {"_id": 1, "id": 1, "title": 1, "image_url": 1, "image": 1, "current_price": 1, "starting_price": 1, "status": 1}
        ).limit(limit).to_list(limit)
        for d in docs:
            out.append({
                "auction_id": str(d.get("_id") or d.get("id") or ""),
                "title": d.get("title") or "",
                "image_url": d.get("image_url") or d.get("image") or "",
                "current_price": d.get("current_price"),
                "starting_price": d.get("starting_price"),
                "status": d.get("status"),
                "collection": coll,
            })
    return {"ok": True, "count": len(out), "auctions": out}
