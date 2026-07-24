"""Migrate legacy auction docs to new schema + reactivate for bots.

Legacy schema keys: id, product_id, end_time, start_time, bid_count
New schema keys:    auction_id, ends_at, bot_enabled, bot_target_price, total_bids

This script aligns both and schedules bots.
"""
import asyncio
import random
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from core.database import db


def _target_for(title: str, retail):
    try:
        if retail and float(retail) > 0:
            return round(float(retail) * random.uniform(0.05, 0.12), 2)
    except Exception:
        pass
    t = (title or "").lower()
    if any(k in t for k in ["iphone", "pixel", "galaxy"]):  return round(random.uniform(45, 80), 2)
    if any(k in t for k in ["ps5", "playstation", "xbox", "switch"]): return round(random.uniform(35, 60), 2)
    if any(k in t for k in ["macbook", "laptop"]): return round(random.uniform(55, 90), 2)
    if any(k in t for k in ["tv", "oled", "qled"]): return round(random.uniform(25, 70), 2)
    if any(k in t for k in ["watch", "airpods"]): return round(random.uniform(8, 20), 2)
    return round(random.uniform(15, 50), 2)


async def main():
    now = datetime.now(timezone.utc)
    migrated = 0
    enabled = 0

    cur = db.auctions.find({})
    async for a in cur:
        updates = {}
        unsets = {}

        # auction_id ← id (legacy)
        if not a.get("auction_id") and a.get("id"):
            updates["auction_id"] = a["id"]

        # ends_at ← end_time (legacy)
        if not a.get("ends_at") and a.get("end_time"):
            updates["ends_at"] = a["end_time"]

        # total_bids ← bid_count
        if a.get("total_bids") is None and a.get("bid_count") is not None:
            updates["total_bids"] = a["bid_count"]

        # Fresh end time (30 min – 8 h in future) and status=active
        updates["ends_at"] = (now + timedelta(minutes=random.randint(30, 480))).isoformat()
        updates["status"] = "active"

        # Bot config
        target = _target_for(a.get("title"), a.get("retail_price") or a.get("starting_price"))
        updates["bot_enabled"] = True
        updates["bot_target_price"] = round(float(target), 2)
        updates["bot_probability"] = 0.45
        updates["bot_final_phase_seconds"] = 300
        unsets["bot_initial_target"] = ""

        query = {"_id": a["_id"]}
        op = {"$set": updates}
        if unsets:
            op["$unset"] = unsets
        await db.auctions.update_one(query, op)
        migrated += 1
        enabled += 1

    print(f"[ok] migrated + bot-enabled {migrated} auctions")

    # Sanity
    now_iso = now.isoformat()
    ready = await db.auctions.count_documents({
        "status": "active",
        "bot_enabled": True,
        "bot_target_price": {"$gt": 0},
        "ends_at": {"$gt": now_iso},
    })
    print(f"[info] bot-ready auctions: {ready}")


if __name__ == "__main__":
    asyncio.run(main())
