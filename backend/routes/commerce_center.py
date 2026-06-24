from datetime import datetime, timedelta, timezone
import secrets
from typing import Any

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from core.database import db
from core.payment_engine import TransactionType, credit_wallet, debit_wallet
from core.security import get_current_user


router = APIRouter(prefix="/api/commerce-center", tags=["commerce-center"])

PLATFORM_COMMISSION = 0.05
FLASH_SALE_DISCOUNTS = [0.12, 0.18, 0.22, 0.15]


class FlashSalePurchaseRequest(BaseModel):
    use_shipping: bool = False


def _serialize_value(value: Any):
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, list):
        return [_serialize_value(item) for item in value]
    if isinstance(value, dict):
        return {key: _serialize_value(val) for key, val in value.items() if key != "_id"}
    return value


def _serialize_doc(doc: dict | None) -> dict:
    return _serialize_value(doc or {})


def _parse_date(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, str) and value:
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None
    return None


def _remaining_seconds(value: Any) -> int:
    dt_value = _parse_date(value)
    if not dt_value:
        return 0
    return max(0, int((dt_value - datetime.now(timezone.utc)).total_seconds()))


async def _ensure_flash_sales() -> list[dict]:
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()
    active_sales = await db.commerce_flash_sales.find(
        {"status": "active", "ends_at": {"$gt": now_iso}, "remaining_units": {"$gt": 0}},
        {"_id": 0},
    ).sort("ends_at", 1).limit(6).to_list(6)

    if len(active_sales) >= 3:
        return active_sales

    existing_listing_ids = set(await db.commerce_flash_sales.distinct("listing_id"))
    listings = await db.marketplace_listings.find(
        {
            "status": "active",
            "listing_id": {"$nin": list(existing_listing_ids)},
        },
        {
            "_id": 0,
            "listing_id": 1,
            "seller_id": 1,
            "seller_name": 1,
            "title": 1,
            "price": 1,
            "category": 1,
            "category_label": 1,
            "images": 1,
            "location": 1,
            "shipping_available": 1,
            "shipping_cost": 1,
        },
    ).sort("created_at", -1).limit(12).to_list(12)

    created_sales: list[dict] = []
    slots_to_fill = max(0, 4 - len(active_sales))
    for index, listing in enumerate(listings[:slots_to_fill]):
        base_price = round(float(listing.get("price", 0) or 0), 2)
        if base_price <= 0:
            continue
        discount = FLASH_SALE_DISCOUNTS[index % len(FLASH_SALE_DISCOUNTS)]
        sale_price = round(max(0.5, base_price * (1 - discount)), 2)
        sale = {
            "sale_id": f"flash_{secrets.token_hex(5)}",
            "listing_id": listing["listing_id"],
            "seller_id": listing.get("seller_id", "") or "",
            "seller_name": listing.get("seller_name") or (listing.get("seller_email") or "BidBlitz Deals").split("@")[0].replace(".", " ").title(),
            "title": listing.get("title", "Flash Deal"),
            "category": listing.get("category", "other"),
            "category_label": listing.get("category_label") or listing.get("category", "Sonstiges"),
            "image_url": (listing.get("images") or [""])[0],
            "location": listing.get("location", ""),
            "original_price": base_price,
            "sale_price": sale_price,
            "discount_pct": int(round(discount * 100)),
            "shipping_available": bool(listing.get("shipping_available")),
            "shipping_cost": round(float(listing.get("shipping_cost") or 0), 2),
            "remaining_units": 1,
            "status": "active",
            "starts_at": now.isoformat(),
            "ends_at": (now + timedelta(minutes=90 + (index * 20))).isoformat(),
            "created_at": now.isoformat(),
        }
        await db.commerce_flash_sales.insert_one(sale)
        created_sales.append(sale)

    return active_sales + created_sales


@router.get("/overview")
async def get_commerce_overview():
    flash_sales = await _ensure_flash_sales()

    marketplace_items = await db.marketplace_listings.find(
        {"status": "active"},
        {
            "_id": 0,
            "listing_id": 1,
            "title": 1,
            "price": 1,
            "category": 1,
            "category_label": 1,
            "images": 1,
            "location": 1,
            "favorites": 1,
            "views": 1,
            "boost": 1,
            "is_vip": 1,
            "shipping_available": 1,
        },
    ).sort("created_at", -1).limit(8).to_list(8)

    def _marketplace_rank(item: dict):
        has_boost = bool(item.get("boost") and item["boost"].get("expires_at", "") > datetime.now(timezone.utc).isoformat())
        return (
            1 if has_boost else 0,
            1 if item.get("is_vip") else 0,
            item.get("favorites", 0),
            item.get("views", 0),
        )

    marketplace_items.sort(key=_marketplace_rank, reverse=True)

    penny_auctions = await db.auctions.find(
        {"status": {"$in": ["active", "upcoming"]}},
        {
            "_id": 0,
            "auction_id": 1,
            "title": 1,
            "current_price": 1,
            "retail_price": 1,
            "bid_count": 1,
            "watchers": 1,
            "image_url": 1,
            "ends_at": 1,
            "status": 1,
            "shipping": 1,
        },
    ).sort("ends_at", 1).limit(6).to_list(6)
    for auction in penny_auctions:
        auction["remaining_seconds"] = _remaining_seconds(auction.get("ends_at"))
        auction["final_battle"] = 0 < auction["remaining_seconds"] <= 60

    live_auctions = await db.live_auctions.find(
        {"status": "active", "ends_at": {"$gt": datetime.now(timezone.utc).isoformat()}},
        {
            "_id": 0,
            "auction_id": 1,
            "title": 1,
            "current_price": 1,
            "start_price": 1,
            "bid_count": 1,
            "category": 1,
            "image_url": 1,
            "ends_at": 1,
        },
    ).sort("ends_at", 1).limit(4).to_list(4)
    for auction in live_auctions:
        auction["remaining_seconds"] = _remaining_seconds(auction.get("ends_at"))

    for sale in flash_sales:
        if not sale.get("seller_name"):
            sale["seller_name"] = "BidBlitz Deals"
        sale["remaining_seconds"] = _remaining_seconds(sale.get("ends_at"))

    live_streams = await db.live_streams.find(
        {"status": "live"},
        {
            "_id": 0,
            "stream_id": 1,
            "title": 1,
            "host_name": 1,
            "host_handle": 1,
            "category": 1,
            "cover_image": 1,
            "viewer_count": 1,
            "featured_product_id": 1,
        },
    ).sort("viewer_count", -1).limit(4).to_list(4)

    upcoming_streams = await db.live_streams.find(
        {"status": "idle"},
        {
            "_id": 0,
            "stream_id": 1,
            "title": 1,
            "host_name": 1,
            "host_handle": 1,
            "category": 1,
            "cover_image": 1,
            "scheduled_start": 1,
        },
    ).sort("scheduled_start", 1).limit(4).to_list(4)

    stats = {
        "active_marketplace": await db.marketplace_listings.count_documents({"status": "active"}),
        "active_flash_sales": await db.commerce_flash_sales.count_documents({"status": "active", "remaining_units": {"$gt": 0}}),
        "active_penny_auctions": await db.auctions.count_documents({"status": "active"}),
        "active_live_auctions": await db.live_auctions.count_documents({"status": "active", "ends_at": {"$gt": datetime.now(timezone.utc).isoformat()}}),
        "active_live_streams": await db.live_streams.count_documents({"status": "live"}),
    }

    return {
        "stats": stats,
        "flash_sales": [_serialize_doc(item) for item in flash_sales[:4]],
        "marketplace": [_serialize_doc(item) for item in marketplace_items[:6]],
        "penny_auctions": [_serialize_doc(item) for item in penny_auctions[:4]],
        "live_auctions": [_serialize_doc(item) for item in live_auctions],
        "live_streams": [_serialize_doc(item) for item in live_streams],
        "upcoming_streams": [_serialize_doc(item) for item in upcoming_streams],
    }


@router.post("/flash-sales/{sale_id}/buy")
async def buy_flash_sale(sale_id: str, req: FlashSalePurchaseRequest, request: Request):
    user = await get_current_user(request)
    buyer_id = str(user["_id"])
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()

    sale = await db.commerce_flash_sales.find_one(
        {
            "sale_id": sale_id,
            "status": "active",
            "ends_at": {"$gt": now_iso},
            "remaining_units": {"$gt": 0},
        },
        {"_id": 0},
    )
    if not sale:
        raise HTTPException(status_code=404, detail="Flash Sale nicht verfügbar")

    if sale.get("seller_id") == buyer_id:
        raise HTTPException(status_code=400, detail="Du kannst deinen eigenen Flash Sale nicht kaufen")

    platform_owned = not sale.get("seller_id")
    seller = None
    if not platform_owned:
        seller_query = {"_id": ObjectId(sale["seller_id"])} if ObjectId.is_valid(sale.get("seller_id", "")) else {"_id": sale.get("seller_id")}
        seller = await db.users.find_one(seller_query, {"_id": 1, "name": 1})
        if not seller:
            raise HTTPException(status_code=400, detail="Verkäuferkonto nicht gefunden")

    sale_lock = await db.commerce_flash_sales.update_one(
        {
            "sale_id": sale_id,
            "status": "active",
            "ends_at": {"$gt": now_iso},
            "remaining_units": {"$gt": 0},
        },
        {"$set": {"status": "processing", "reserved_by": buyer_id, "reserved_at": now_iso}},
    )
    if sale_lock.modified_count == 0:
        raise HTTPException(status_code=400, detail="Flash Sale wurde gerade reserviert oder verkauft")

    listing = await db.marketplace_listings.find_one(
        {"listing_id": sale["listing_id"], "status": "active"},
        {"_id": 0},
    )
    if not listing:
        await db.commerce_flash_sales.update_one(
            {"sale_id": sale_id, "status": "processing", "reserved_by": buyer_id},
            {"$set": {"status": "inactive"}, "$unset": {"reserved_by": "", "reserved_at": ""}},
        )
        raise HTTPException(status_code=400, detail="Produkt ist nicht mehr verfügbar")

    listing_lock = await db.marketplace_listings.update_one(
        {"listing_id": sale["listing_id"], "status": "active"},
        {"$set": {"status": "processing_flash", "updated_at": now_iso}},
    )
    if listing_lock.modified_count == 0:
        await db.commerce_flash_sales.update_one(
            {"sale_id": sale_id, "status": "processing", "reserved_by": buyer_id},
            {"$set": {"status": "active"}, "$unset": {"reserved_by": "", "reserved_at": ""}},
        )
        raise HTTPException(status_code=400, detail="Produkt wird bereits gekauft")

    shipping_cost = round(float(listing.get("shipping_cost") or 0), 2) if req.use_shipping and listing.get("shipping_available") else 0
    sale_price = round(float(sale.get("sale_price") or listing.get("price") or 0), 2)
    total_price = round(sale_price + shipping_cost, 2)
    commission = round(total_price if platform_owned else sale_price * PLATFORM_COMMISSION, 2)
    seller_amount = 0 if platform_owned else round(sale_price - commission + shipping_cost, 2)
    order_id = f"cc_{secrets.token_hex(6)}"
    payment_committed = False
    seller_name = sale.get("seller_name") or (seller.get("name") if seller else "BidBlitz Deals")

    try:
        debit_result = await debit_wallet(
            user_id=buyer_id,
            amount=total_price,
            tx_type=TransactionType.PAYMENT,
            description=f"Commerce Flash Sale: {listing['title'][:50]}",
            reference=f"FLASH-{sale_id[:10].upper()}",
            merchant_name=seller_name,
            metadata={
                "sale_id": sale_id,
                "listing_id": sale["listing_id"],
                "order_id": order_id,
                "channel": "flash_sale",
            },
        )
        if not debit_result.success:
            raise HTTPException(status_code=400, detail=debit_result.error)

        payment_committed = True
        credit_result = None
        if not platform_owned:
            credit_result = await credit_wallet(
                user_id=sale["seller_id"],
                amount=seller_amount,
                tx_type=TransactionType.MERCHANT_CREDIT,
                description=f"Flash Sale Verkauf: {listing['title'][:50]}",
                reference=f"FLASH-SELL-{sale_id[:8].upper()}",
                source="commerce_center",
                metadata={
                    "sale_id": sale_id,
                    "listing_id": sale["listing_id"],
                    "order_id": order_id,
                    "discount_pct": sale.get("discount_pct", 0),
                    "commission": commission,
                },
            )

        order = {
            "order_id": order_id,
            "sale_id": sale_id,
            "listing_id": sale["listing_id"],
            "buyer_id": buyer_id,
            "buyer_name": user.get("name", ""),
            "seller_id": sale["seller_id"],
            "seller_name": seller_name,
            "item_title": listing["title"],
            "original_price": round(float(listing.get("price") or 0), 2),
            "sale_price": sale_price,
            "shipping_cost": shipping_cost,
            "total_price": total_price,
            "discount_pct": sale.get("discount_pct", 0),
            "commission": commission,
            "seller_amount": seller_amount,
            "platform_owned": platform_owned,
            "status": "completed",
            "buyer_payment_id": debit_result.transaction_id,
            "seller_payment_id": credit_result.transaction_id if credit_result and credit_result.success else None,
            "created_at": now_iso,
        }
        await db.commerce_orders.insert_one(order)
        order.pop("_id", None)

        await db.marketplace_listings.update_one(
            {"listing_id": sale["listing_id"]},
            {
                "$set": {
                    "status": "sold",
                    "sold_at": now_iso,
                    "sold_to": buyer_id,
                    "order_id": order_id,
                    "flash_sale_id": sale_id,
                    "updated_at": now_iso,
                }
            },
        )
        await db.commerce_flash_sales.update_one(
            {"sale_id": sale_id},
            {
                "$set": {
                    "status": "sold",
                    "sold_at": now_iso,
                    "buyer_id": buyer_id,
                    "order_id": order_id,
                },
                "$inc": {"remaining_units": -1},
                "$unset": {"reserved_by": "", "reserved_at": ""},
            },
        )
        await db.platform_revenue.update_one(
            {"date": now.strftime("%Y-%m-%d")},
            {"$inc": {"total": commission, "by_source.commerce_flash_sales": commission}},
            upsert=True,
        )
        if not platform_owned:
            await db.notifications.insert_one(
                {
                    "id": secrets.token_hex(8),
                    "user_id": sale["seller_id"],
                    "type": "commerce_flash_sale",
                    "title": "Flash Sale verkauft!",
                    "message": f"{listing['title'][:40]} wurde im Commerce Center verkauft.",
                    "data": {"order_id": order_id, "sale_id": sale_id, "listing_id": sale["listing_id"]},
                    "read": False,
                    "created_at": now_iso,
                }
            )

        return {
            "ok": True,
            "order": order,
            "new_balance": debit_result.new_balance,
            "message": f"Flash Sale erfolgreich gekauft: €{total_price:.2f}",
        }
    except HTTPException:
        if not payment_committed:
            await db.commerce_flash_sales.update_one(
                {"sale_id": sale_id, "status": "processing", "reserved_by": buyer_id},
                {"$set": {"status": "active"}, "$unset": {"reserved_by": "", "reserved_at": ""}},
            )
            await db.marketplace_listings.update_one(
                {"listing_id": sale["listing_id"], "status": "processing_flash"},
                {"$set": {"status": "active", "updated_at": now_iso}},
            )
        raise
    except Exception as exc:
        if not payment_committed:
            await db.commerce_flash_sales.update_one(
                {"sale_id": sale_id, "status": "processing", "reserved_by": buyer_id},
                {"$set": {"status": "active"}, "$unset": {"reserved_by": "", "reserved_at": ""}},
            )
            await db.marketplace_listings.update_one(
                {"listing_id": sale["listing_id"], "status": "processing_flash"},
                {"$set": {"status": "active", "updated_at": now_iso}},
            )
        raise HTTPException(status_code=500, detail=f"Flash Sale Kauf fehlgeschlagen: {exc}") from exc