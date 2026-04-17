"""
Reactivate expired auctions and enable bots with fresh target prices.

- Extends ends_at into the future for auctions whose status is 'active' but expired.
- Enables bot_enabled with a reasonable bot_target_price per auction.
- Resets bot_initial_target so the bot loop re-derives a new starter target.
"""
import asyncio
import random
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from core.database import db  # noqa: E402


# Map of categories / common titles → reasonable auction target price (EUR)
def _target_for(title: str, retail: float | None) -> float:
    if retail and retail > 0:
        return round(retail * random.uniform(0.05, 0.12), 2)  # 5–12% of retail
    t = (title or "").lower()
    if any(k in t for k in ["iphone", "pixel", "galaxy"]):
        return round(random.uniform(45, 80), 2)
    if any(k in t for k in ["ps5", "playstation", "xbox", "switch"]):
        return round(random.uniform(35, 60), 2)
    if any(k in t for k in ["macbook", "laptop", "thinkpad"]):
        return round(random.uniform(55, 90), 2)
    if any(k in t for k in ["tv", "oled", "qled"]):
        return round(random.uniform(25, 70), 2)
    if any(k in t for k in ["watch", "airpods"]):
        return round(random.uniform(8, 20), 2)
    return round(random.uniform(15, 50), 2)


async def main():
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()

    total = await db.auctions.count_documents({"status": "active"})
    expired = await db.auctions.count_documents({"status": "active", "ends_at": {"$lte": now_iso}})
    print(f"[info] active={total}  expired={expired}")

    cur = db.auctions.find({"status": "active"}, {
        "auction_id": 1, "title": 1, "current_price": 1, "retail_price": 1,
        "bot_enabled": 1, "bot_target_price": 1, "ends_at": 1, "_id": 0
    })
    fixed = 0
    async for a in cur:
        target = a.get("bot_target_price") or _target_for(a.get("title"), a.get("retail_price"))
        # stagger end times between 30 min and 8 h from now
        new_ends = now + timedelta(minutes=random.randint(30, 480))
        updates = {
            "ends_at": new_ends.isoformat(),
            "bot_enabled": True,
            "bot_target_price": round(float(target), 2),
            "bot_probability": 0.45,
            "bot_final_phase_seconds": 300,
        }
        # Reset initial target so the bot loop re-derives it and starts fresh
        unsets = {"bot_initial_target": ""}
        await db.auctions.update_one(
            {"auction_id": a["auction_id"]},
            {"$set": updates, "$unset": unsets},
        )
        fixed += 1
    print(f"[ok] reactivated & bot-enabled {fixed} auctions")

    # Sanity check
    bot_ready = await db.auctions.count_documents({
        "status": "active",
        "bot_enabled": True,
        "bot_target_price": {"$gt": 0},
        "ends_at": {"$gt": now_iso},
    })
    print(f"[info] bot-ready auctions now: {bot_ready}")


if __name__ == "__main__":
    asyncio.run(main())
