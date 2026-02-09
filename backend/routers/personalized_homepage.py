"""Personalized Homepage - AI-powered recommendations based on user behavior"""
from fastapi import APIRouter, Depends
from datetime import datetime, timezone, timedelta
from typing import Optional, List
import random

from config import db, logger
from dependencies import get_current_user

router = APIRouter(prefix="/personalized", tags=["Personalized Content"])

async def get_user_preferences(user_id: str) -> dict:
    """Analyze user's bidding history to determine preferences"""
    # Get user's bid history
    bid_auctions = await db.auctions.find(
        {"bid_history.user_id": user_id},
        {"_id": 0, "product_id": 1, "bid_history": 1}
    ).limit(50).to_list(50)
    
    # Get user's won auctions
    won_auctions = await db.auction_history.find(
        {"winner_id": user_id},
        {"_id": 0, "product": 1}
    ).limit(20).to_list(20)
    
    # Analyze categories
    category_counts = {}
    price_ranges = []
    
    for auction in bid_auctions + won_auctions:
        product_id = auction.get("product_id") or auction.get("product", {}).get("id")
        if product_id:
            product = await db.products.find_one({"id": product_id}, {"_id": 0, "category": 1, "retail_price": 1})
            if product:
                cat = product.get("category", "Sonstiges")
                category_counts[cat] = category_counts.get(cat, 0) + 1
                if product.get("retail_price"):
                    price_ranges.append(product["retail_price"])
    
    # Determine favorite categories (top 3)
    sorted_cats = sorted(category_counts.items(), key=lambda x: x[1], reverse=True)
    favorite_categories = [cat for cat, _ in sorted_cats[:3]]
    
    # Determine preferred price range
    if price_ranges:
        avg_price = sum(price_ranges) / len(price_ranges)
        min_price = min(price_ranges)
        max_price = max(price_ranges)
    else:
        avg_price = 100
        min_price = 0
        max_price = 500
    
    return {
        "favorite_categories": favorite_categories,
        "avg_price": avg_price,
        "price_range": {"min": min_price, "max": max_price},
        "total_activity": len(bid_auctions),
        "is_active_user": len(bid_auctions) > 5
    }

@router.get("/homepage")
async def get_personalized_homepage(user: dict = Depends(get_current_user)):
    """Get personalized homepage content for the user"""
    user_id = user["id"]
    
    # Get user preferences
    prefs = await get_user_preferences(user_id)
    
    # Section 1: Recommended for you (based on favorites)
    recommended = []
    if prefs["favorite_categories"]:
        for category in prefs["favorite_categories"]:
            products = await db.products.find(
                {"category": category},
                {"_id": 0, "id": 1}
            ).limit(5).to_list(5)
            
            for product in products:
                auction = await db.auctions.find_one({
                    "product_id": product["id"],
                    "status": "active"
                }, {"_id": 0})
                
                if auction:
                    product_info = await db.products.find_one({"id": product["id"]}, {"_id": 0, "name": 1, "image_url": 1, "retail_price": 1, "category": 1})
                    recommended.append({
                        "auction_id": auction["id"],
                        "product_name": product_info.get("name") if product_info else "Produkt",
                        "product_image": product_info.get("image_url") if product_info else None,
                        "retail_price": product_info.get("retail_price", 0) if product_info else 0,
                        "category": product_info.get("category") if product_info else None,
                        "current_price": auction.get("current_price", 0),
                        "end_time": auction.get("end_time"),
                        "reason": {
                            "de": f"Basierend auf deinem Interesse an {category}",
                            "en": f"Based on your interest in {category}",
                            "sq": f"Bazuar në interesin tënd për {category}",
                            "xk": f"Bazuar në interesin tënd për {category}"
                        }
                    })
    
    # Section 2: Continue bidding (auctions user has bid on)
    continue_bidding = []
    user_auctions = await db.auctions.find({
        "bid_history.user_id": user_id,
        "status": "active",
        "last_bidder_id": {"$ne": user_id}  # Not currently winning
    }, {"_id": 0}).limit(5).to_list(5)
    
    for auction in user_auctions:
        product = await db.products.find_one({"id": auction.get("product_id")}, {"_id": 0, "name": 1, "image_url": 1})
        continue_bidding.append({
            "auction_id": auction["id"],
            "product_name": product.get("name") if product else "Produkt",
            "product_image": product.get("image_url") if product else None,
            "current_price": auction.get("current_price", 0),
            "end_time": auction.get("end_time"),
            "your_bids": len([b for b in auction.get("bid_history", []) if b.get("user_id") == user_id]),
            "reason": "Du hast bereits geboten"
        })
    
    # Section 3: Hot right now (most active auctions)
    hot_auctions = await db.auctions.find(
        {"status": "active"},
        {"_id": 0}
    ).sort("total_bids", -1).limit(5).to_list(5)
    
    hot = []
    for auction in hot_auctions:
        product = await db.products.find_one({"id": auction.get("product_id")}, {"_id": 0, "name": 1, "image_url": 1, "retail_price": 1})
        hot.append({
            "auction_id": auction["id"],
            "product_name": product.get("name") if product else "Produkt",
            "product_image": product.get("image_url") if product else None,
            "retail_price": product.get("retail_price", 0) if product else 0,
            "current_price": auction.get("current_price", 0),
            "end_time": auction.get("end_time"),
            "total_bids": auction.get("total_bids", 0),
            "reason": f"{auction.get('total_bids', 0)} Gebote - Sehr beliebt!"
        })
    
    # Section 4: Ending soon
    now = datetime.now(timezone.utc)
    soon = now + timedelta(hours=1)
    
    ending_soon = await db.auctions.find({
        "status": "active",
        "end_time": {"$lte": soon.isoformat(), "$gte": now.isoformat()}
    }, {"_id": 0}).limit(5).to_list(5)
    
    ending = []
    for auction in ending_soon:
        product = await db.products.find_one({"id": auction.get("product_id")}, {"_id": 0, "name": 1, "image_url": 1})
        end_time = datetime.fromisoformat(auction["end_time"].replace("Z", "+00:00"))
        mins_left = (end_time - now).total_seconds() / 60
        
        ending.append({
            "auction_id": auction["id"],
            "product_name": product.get("name") if product else "Produkt",
            "product_image": product.get("image_url") if product else None,
            "current_price": auction.get("current_price", 0),
            "end_time": auction.get("end_time"),
            "minutes_left": int(mins_left),
            "reason": f"Endet in {int(mins_left)} Minuten!"
        })
    
    # Section 5: Similar to what you won
    similar = []
    if won_auctions := await db.auction_history.find({"winner_id": user_id}, {"_id": 0, "product": 1}).limit(3).to_list(3):
        for won in won_auctions:
            product_id = won.get("product", {}).get("id")
            if product_id:
                product = await db.products.find_one({"id": product_id}, {"_id": 0, "category": 1})
                if product:
                    # Find similar in same category
                    sim_products = await db.products.find(
                        {"category": product.get("category"), "id": {"$ne": product_id}},
                        {"_id": 0, "id": 1}
                    ).limit(2).to_list(2)
                    
                    for sim in sim_products:
                        sim_auction = await db.auctions.find_one({
                            "product_id": sim["id"],
                            "status": "active"
                        }, {"_id": 0})
                        
                        if sim_auction:
                            sim_product = await db.products.find_one({"id": sim["id"]}, {"_id": 0, "name": 1, "image_url": 1})
                            similar.append({
                                "auction_id": sim_auction["id"],
                                "product_name": sim_product.get("name") if sim_product else "Produkt",
                                "product_image": sim_product.get("image_url") if sim_product else None,
                                "current_price": sim_auction.get("current_price", 0),
                                "reason": "Ähnlich zu deinen Gewinnen"
                            })
    
    return {
        "user_preferences": {
            "favorite_categories": prefs["favorite_categories"],
            "is_active_user": prefs["is_active_user"]
        },
        "sections": {
            "recommended_for_you": recommended[:6],
            "continue_bidding": continue_bidding,
            "hot_right_now": hot,
            "ending_soon": ending,
            "similar_to_won": similar[:4]
        },
        "greeting": get_personalized_greeting(user.get("name", ""))
    }

def get_personalized_greeting(name: str) -> dict:
    """Generate personalized greeting based on time of day"""
    hour = datetime.now().hour
    
    if hour < 12:
        greetings = {
            "de": f"Guten Morgen{', ' + name if name else ''}! ☀️",
            "en": f"Good morning{', ' + name if name else ''}! ☀️",
            "sq": f"Mirëmëngjes{', ' + name if name else ''}! ☀️",
            "xk": f"Mirëmëngjes{', ' + name if name else ''}! ☀️"
        }
    elif hour < 18:
        greetings = {
            "de": f"Hallo{', ' + name if name else ''}! 👋",
            "en": f"Hello{', ' + name if name else ''}! 👋",
            "sq": f"Përshëndetje{', ' + name if name else ''}! 👋",
            "xk": f"Përshëndetje{', ' + name if name else ''}! 👋"
        }
    else:
        greetings = {
            "de": f"Guten Abend{', ' + name if name else ''}! 🌙",
            "en": f"Good evening{', ' + name if name else ''}! 🌙",
            "sq": f"Mirëmbrëma{', ' + name if name else ''}! 🌙",
            "xk": f"Mirëmbrëma{', ' + name if name else ''}! 🌙"
        }
    
    return greetings

@router.get("/similar-products/{product_id}")
async def get_similar_products(product_id: str, limit: int = 5):
    """Get similar products based on category and price range"""
    product = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not product:
        return {"similar": []}
    
    category = product.get("category")
    price = product.get("retail_price", 100)
    
    # Find products in same category with similar price (±30%)
    similar = await db.products.find({
        "category": category,
        "id": {"$ne": product_id},
        "retail_price": {"$gte": price * 0.7, "$lte": price * 1.3}
    }, {"_id": 0}).limit(limit).to_list(limit)
    
    # Check which have active auctions
    result = []
    for sim in similar:
        auction = await db.auctions.find_one({
            "product_id": sim["id"],
            "status": "active"
        }, {"_id": 0, "id": 1, "current_price": 1, "end_time": 1})
        
        result.append({
            **sim,
            "has_active_auction": auction is not None,
            "auction_id": auction.get("id") if auction else None,
            "current_price": auction.get("current_price") if auction else None
        })
    
    return {"similar": result}
