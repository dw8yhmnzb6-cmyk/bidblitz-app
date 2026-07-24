"""Clean embedded ObjectIds from auctions collection + seed + reactivate."""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from core.database import db


async def main():
    # 1. Strip nested ObjectIds from auctions.product._id
    res = await db.auctions.update_many(
        {"product._id": {"$exists": True}},
        {"$unset": {"product._id": ""}},
    )
    print(f"[ok] cleaned auctions.product._id → {res.modified_count} docs")

    still = await db.auctions.count_documents({"product._id": {"$exists": True}})
    print(f"[info] remaining: {still}")

    # 2. Same cleanup for any other collection with nested _id issues commonly seen
    # (blitz_mine collections are fresh, skip)


if __name__ == "__main__":
    asyncio.run(main())
