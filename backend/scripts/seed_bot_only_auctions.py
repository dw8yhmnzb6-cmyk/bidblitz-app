"""
Seed 30 fresh BOT-ONLY auctions with working Unsplash images.
- Deletes all existing expired "active" auctions (legacy schema with end_time)
- Creates 30 new auctions with:
    * bot_only = True  (humans blocked in place_bid endpoint)
    * ends_at in the future (1-7 days)
    * Verified Unsplash image URLs
    * Diverse product mix (tech, fashion, lifestyle, experiences)

Run:
  cd /app/backend && python3 scripts/seed_bot_only_auctions.py
"""
from __future__ import annotations

import asyncio
import secrets
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from core.database import db  # noqa: E402

# Products — title, retail_price (EUR), image_url, category
PRODUCTS = [
    # Electronics / Tech
    ("iPhone 17 Pro Max", 1499, "https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=600&h=400&fit=crop&q=80", "tech"),
    ("MacBook Pro M5 14\"", 1999, "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600&h=400&fit=crop&q=80", "tech"),
    ("AirPods Pro 3", 279, "https://images.unsplash.com/photo-1606220945770-b5b6c2c55bf1?w=600&h=400&fit=crop&q=80", "tech"),
    ("Sony WH-1000XM6", 449, "https://images.unsplash.com/photo-1583394838336-acd977736f90?w=600&h=400&fit=crop&q=80", "tech"),
    ("iPad Pro M5 13\"", 1299, "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=600&h=400&fit=crop&q=80", "tech"),
    ("Samsung Galaxy S26 Ultra", 1399, "https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=600&h=400&fit=crop&q=80", "tech"),
    ("Google Pixel 10 Pro", 1099, "https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=600&h=400&fit=crop&q=80", "tech"),
    ("Nintendo Switch 2", 399, "https://images.unsplash.com/photo-1578303512597-81e6cc155b3e?w=600&h=400&fit=crop&q=80", "gaming"),
    ("PlayStation 5 Pro", 799, "https://images.unsplash.com/photo-1606813907291-d86efa9b94db?w=600&h=400&fit=crop&q=80", "gaming"),
    ("Xbox Series X 2TB", 649, "https://images.unsplash.com/photo-1621259182978-fbf93132d53d?w=600&h=400&fit=crop&q=80", "gaming"),
    ("DJI Mavic 4 Pro", 1899, "https://images.unsplash.com/photo-1473968512647-3e447244af8f?w=600&h=400&fit=crop&q=80", "tech"),
    ("GoPro Hero 14", 549, "https://images.unsplash.com/photo-1564466809058-bf4114d55352?w=600&h=400&fit=crop&q=80", "tech"),
    ("Apple Watch Ultra 3", 899, "https://images.unsplash.com/photo-1579586337278-3befd40fd17a?w=600&h=400&fit=crop&q=80", "tech"),
    ("Meta Quest 4", 599, "https://images.unsplash.com/photo-1622979135225-d2ba269cf1ac?w=600&h=400&fit=crop&q=80", "tech"),
    ("Dyson V16 Absolute", 799, "https://images.unsplash.com/photo-1558317374-067fb5f30001?w=600&h=400&fit=crop&q=80", "lifestyle"),
    # Fashion / Luxury
    ("Rolex Submariner Date", 1999, "https://images.unsplash.com/photo-1587836374828-4dbafa94cf0e?w=600&h=400&fit=crop&q=80", "luxury"),
    ("Gucci Marmont Tasche", 1599, "https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=600&h=400&fit=crop&q=80", "fashion"),
    ("Louis Vuitton Speedy 30", 1799, "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=600&h=400&fit=crop&q=80", "fashion"),
    ("Hermès Scarf", 499, "https://images.unsplash.com/photo-1606293459339-aa5d34a7b0e1?w=600&h=400&fit=crop&q=80", "fashion"),
    ("Nike Air Jordan 4 Retro", 249, "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&h=400&fit=crop&q=80", "fashion"),
    ("Ray-Ban Aviator Gold", 199, "https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=600&h=400&fit=crop&q=80", "fashion"),
    # Experiences / Vouchers
    ("ZUMA Dubai Brunch für 2", 399, "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600&h=400&fit=crop&q=80", "experience"),
    ("Nobu München Dinner für 2", 299, "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=600&h=400&fit=crop&q=80", "experience"),
    ("Wellness-Tag Adlon Berlin", 349, "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=600&h=400&fit=crop&q=80", "experience"),
    ("Porsche 911 Fahrerlebnis", 799, "https://images.unsplash.com/photo-1544829099-b9a0c07fad1a?w=600&h=400&fit=crop&q=80", "experience"),
    ("Heißluftballon-Fahrt 2 Pers.", 499, "https://images.unsplash.com/photo-1507608616759-54f48f0af0ee?w=600&h=400&fit=crop&q=80", "experience"),
    ("Kitesurf-Kurs Sylt", 399, "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=600&h=400&fit=crop&q=80", "experience"),
    # Home / Kitchen
    ("KitchenAid Artisan Mixer", 649, "https://images.unsplash.com/photo-1556909114-44e3e70034e2?w=600&h=400&fit=crop&q=80", "lifestyle"),
    ("Nespresso Vertuo Creatista", 499, "https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=600&h=400&fit=crop&q=80", "lifestyle"),
    ("Weber Genesis EX-335 Grill", 1299, "https://images.unsplash.com/photo-1544025162-d76694265947?w=600&h=400&fit=crop&q=80", "lifestyle"),
]

PRICE_INCREMENT = 0.02  # EUR per bid (matches backend default)


async def main():
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()

    print(f"[seed] {now_iso} starting …")

    # 1. Close out legacy "active" auctions with expired end_time (wrong schema)
    legacy = await db.auctions.update_many(
        {
            "status": "active",
            "$or": [
                {"end_time": {"$lt": now_iso}},
                {"ends_at": {"$lt": now_iso}},
            ],
        },
        {"$set": {"status": "ended", "closed_by_seed": now_iso}},
    )
    print(f"[seed] marked {legacy.modified_count} expired legacy auctions as ended")

    # 2. Delete any existing bot_only auctions (clean re-seed)
    deleted = await db.auctions.delete_many({"bot_only": True, "status": "active"})
    print(f"[seed] deleted {deleted.deleted_count} existing bot_only auctions")

    # 3. Insert 30 fresh bot-only auctions
    auctions = []
    for i, (title, retail, image, category) in enumerate(PRODUCTS[:30]):
        # Staggered end times: 1-7 days in the future, spread out
        duration_hours = 24 + (i % 7) * 24 + (i * 3) % 24  # 24h to 7d
        ends_at = (now + timedelta(hours=duration_hours)).isoformat()

        auctions.append({
            "auction_id": secrets.token_hex(8),
            "title": title,
            "description": f"Exklusive Bot-Auktion: {title}",
            "image_url": image,
            "retail_price": float(retail),
            "starting_price": 0.00,
            "current_price": 0.00,
            "price_increment": PRICE_INCREMENT,
            "timer_extension": 20,
            "duration_seconds": duration_hours * 3600,
            "ends_at": ends_at,
            "status": "active",
            "category": category,
            "bot_only": True,
            # Bot bidding loop flags — bots WILL bid here
            "bot_enabled": True,
            "bot_target_price": round(retail * 0.015, 2),  # target ~1.5% of retail
            "bot_probability": 0.4,
            "bot_final_phase_seconds": 300,
            "winner_id": None,
            "winner_name": None,
            "last_bidder_id": None,
            "last_bidder_name": None,
            "total_bids": 0,
            "is_vip_only": False,
            "created_by": "seed-script",
            "created_at": now_iso,
        })

    if auctions:
        await db.auctions.insert_many(auctions)
        print(f"[seed] inserted {len(auctions)} fresh bot-only auctions")

    # 4. Summary
    active_count = await db.auctions.count_documents({"status": "active"})
    bot_only_count = await db.auctions.count_documents({"status": "active", "bot_only": True})
    print(f"[seed] done — active={active_count}, bot_only_active={bot_only_count}")


if __name__ == "__main__":
    asyncio.run(main())
