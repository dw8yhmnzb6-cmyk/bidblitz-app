"""
Batch-generate AI product images for all auctions and update MongoDB.
Run: cd /app/backend && python3 scripts/generate_all_auction_images.py
"""
import asyncio
import os
import sys
sys.path.insert(0, "/app/backend")

from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
load_dotenv("/app/backend/.env")

from services.product_image_generator import get_product_image_generator

MONGO = os.environ["MONGO_URL"]
DB = os.environ.get("DB_NAME", "test_database")
CONCURRENCY = 4  # Parallel image generations

# Public URL prefix used by the frontend — relative, served through nginx on live.
# On the preview env, `REACT_APP_BACKEND_URL` is empty so `/static/...` works too.
PUBLIC_BASE = ""  # empty => relative URL


async def process_one(sem, gen, doc, db, coll):
    async with sem:
        title = (doc.get("title") or "").strip()
        desc = (doc.get("description") or doc.get("subtitle") or "")[:200]
        print(f"→ {title}")
        try:
            r = await gen.generate_for_product(title, desc, force=False)
        except Exception as e:
            print(f"  ✗ error: {e}")
            return
        if not r.get("success"):
            print(f"  ✗ failed: {r.get('error')}")
            return
        url = f"{PUBLIC_BASE}{r['url']}"
        await db[coll].update_one(
            {"_id": doc["_id"]},
            {"$set": {"image_url": url, "image": url}},
        )
        status = "cached" if r.get("cached") else "NEW"
        print(f"  ✓ {status} {url}")


async def main():
    client = AsyncIOMotorClient(MONGO)
    db = client[DB]
    gen = get_product_image_generator()

    for coll in ["auctions", "auction_items"]:
        try:
            cnt = await db[coll].count_documents({})
        except Exception:
            continue
        if cnt == 0:
            continue
        docs = await db[coll].find({}, {"_id": 1, "title": 1, "description": 1, "subtitle": 1}).to_list(500)
        print(f"=== {DB}.{coll}: {len(docs)} products ===")

        sem = asyncio.Semaphore(CONCURRENCY)
        await asyncio.gather(*(process_one(sem, gen, d, db, coll) for d in docs))

    client.close()
    print("\n✅ ALL DONE")


if __name__ == "__main__":
    asyncio.run(main())
