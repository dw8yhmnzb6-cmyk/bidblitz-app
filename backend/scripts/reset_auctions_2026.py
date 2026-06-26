"""Hard reset auctions to exactly 30 fresh 2026 articles.

Deletes existing auctions and related auction activity, then inserts a new
30-item 2026-only active catalog with end dates 3-5 days out at 18:00 UTC.

Run:
  cd /app/backend && python3 scripts/reset_auctions_2026.py
"""

from __future__ import annotations

import asyncio
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from core.database import db  # noqa: E402
from routes.auctions import ACTIVE_AUCTION_CATALOG, _build_auction_doc, TARGET_ACTIVE_AUCTIONS  # noqa: E402


async def main():
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()
    print(f"[auction-reset] started at {now_iso}")

    deleted_auctions = await db.auctions.delete_many({})
    deleted_bids = await db.auction_bids.delete_many({})
    deleted_notifications = await db.auction_notifications.delete_many({})
    deleted_watchlist = await db.watchlist.delete_many({})
    deleted_auto_bids = await db.auto_bids.delete_many({})

    print(f"[auction-reset] deleted auctions={deleted_auctions.deleted_count}, bids={deleted_bids.deleted_count}, notifications={deleted_notifications.deleted_count}, watchlist={deleted_watchlist.deleted_count}, auto_bids={deleted_auto_bids.deleted_count}")

    auctions = [
        _build_auction_doc(product, "auction-reset-2026", now, index)
        for index, product in enumerate(ACTIVE_AUCTION_CATALOG[:TARGET_ACTIVE_AUCTIONS])
    ]
    if auctions:
        await db.auctions.insert_many(auctions)

    active = await db.auctions.count_documents({"status": "active"})
    print(f"[auction-reset] inserted={len(auctions)} active={active}")
    for auction in auctions[:5]:
        print(f"  - {auction['title']} | ends_at={auction['ends_at']}")


if __name__ == "__main__":
    asyncio.run(main())