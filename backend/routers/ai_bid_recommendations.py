"""AI Bid Recommendations - Smart bidding suggestions based on auction analysis"""
from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timezone, timedelta
from typing import Optional
import random
import math

from config import db, logger
from dependencies import get_current_user

router = APIRouter(prefix="/ai-bid", tags=["AI Bid Recommendations"])

async def analyze_auction_patterns(auction_id: str) -> dict:
    """Analyze bidding patterns for an auction"""
    auction = await db.auctions.find_one({"id": auction_id}, {"_id": 0})
    if not auction:
        return {}
    
    bid_history = auction.get("bid_history", [])
    total_bids = len(bid_history)
    
    # Analyze bid timing patterns
    if total_bids < 5:
        return {
            "pattern": "new",
            "intensity": "low",
            "avg_interval": 0,
            "peak_times": []
        }
    
    # Calculate intervals between bids
    intervals = []
    for i in range(1, min(50, len(bid_history))):
        try:
            t1 = datetime.fromisoformat(bid_history[i-1]["timestamp"].replace("Z", "+00:00"))
            t2 = datetime.fromisoformat(bid_history[i]["timestamp"].replace("Z", "+00:00"))
            intervals.append((t2 - t1).total_seconds())
        except:
            continue
    
    avg_interval = sum(intervals) / len(intervals) if intervals else 30
    
    # Determine pattern
    if avg_interval < 10:
        pattern = "aggressive"
        intensity = "high"
    elif avg_interval < 30:
        pattern = "competitive"
        intensity = "medium"
    else:
        pattern = "relaxed"
        intensity = "low"
    
    # Find unique bidders
    unique_bidders = len(set(b.get("user_id") or b.get("user_name") for b in bid_history))
    
    return {
        "pattern": pattern,
        "intensity": intensity,
        "avg_interval": round(avg_interval, 1),
        "total_bids": total_bids,
        "unique_bidders": unique_bidders,
        "competition_level": min(10, unique_bidders)
    }

async def calculate_win_probability(user_id: str, auction_id: str) -> dict:
    """Calculate probability of winning based on multiple factors"""
    auction = await db.auctions.find_one({"id": auction_id}, {"_id": 0})
    if not auction:
        return {"probability": 0, "confidence": "low"}
    
    # Get auction analysis
    analysis = await analyze_auction_patterns(auction_id)
    
    # Get user's historical win rate
    user_wins = await db.auction_history.count_documents({"winner_id": user_id})
    user_participations = await db.auctions.count_documents({"bid_history.user_id": user_id})
    user_win_rate = (user_wins / max(1, user_participations)) * 100
    
    # Calculate time remaining
    try:
        end_time = datetime.fromisoformat(auction["end_time"].replace("Z", "+00:00"))
        seconds_left = (end_time - datetime.now(timezone.utc)).total_seconds()
    except:
        seconds_left = 3600
    
    # Base probability factors
    base_prob = 50
    
    # Adjust based on competition
    competition = analysis.get("competition_level", 5)
    competition_factor = max(10, 100 - (competition * 8))  # More bidders = lower chance
    
    # Adjust based on time remaining
    if seconds_left < 60:
        time_factor = 120  # High urgency = higher chance if you bid now
    elif seconds_left < 300:
        time_factor = 100
    elif seconds_left < 3600:
        time_factor = 80
    else:
        time_factor = 60
    
    # Adjust based on user experience
    experience_factor = min(120, 80 + user_win_rate)
    
    # Adjust based on bid intensity
    intensity = analysis.get("intensity", "medium")
    if intensity == "high":
        intensity_factor = 70
    elif intensity == "low":
        intensity_factor = 110
    else:
        intensity_factor = 90
    
    # Calculate final probability
    probability = (base_prob * competition_factor * time_factor * experience_factor * intensity_factor) / 1000000
    probability = min(95, max(5, probability))
    
    # Determine confidence level
    if analysis.get("total_bids", 0) > 20:
        confidence = "high"
    elif analysis.get("total_bids", 0) > 5:
        confidence = "medium"
    else:
        confidence = "low"
    
    return {
        "probability": round(probability, 1),
        "confidence": confidence,
        "factors": {
            "competition": competition,
            "time_urgency": "high" if seconds_left < 300 else "medium" if seconds_left < 3600 else "low",
            "intensity": intensity,
            "your_experience": "expert" if user_win_rate > 30 else "intermediate" if user_win_rate > 10 else "beginner"
        }
    }

@router.get("/recommendation/{auction_id}")
async def get_bid_recommendation(auction_id: str, user: dict = Depends(get_current_user)):
    """Get AI-powered bid recommendation for an auction"""
    auction = await db.auctions.find_one({"id": auction_id, "status": "active"}, {"_id": 0})
    if not auction:
        raise HTTPException(status_code=404, detail="Auktion nicht gefunden")
    
    # Get win probability
    win_prob = await calculate_win_probability(user["id"], auction_id)
    probability = win_prob["probability"]
    
    # Get auction analysis
    analysis = await analyze_auction_patterns(auction_id)
    
    # Calculate time remaining
    try:
        end_time = datetime.fromisoformat(auction["end_time"].replace("Z", "+00:00"))
        seconds_left = (end_time - datetime.now(timezone.utc)).total_seconds()
    except:
        seconds_left = 3600
    
    # Generate recommendation
    if probability >= 70:
        action = "bid_now"
        message_de = "🎯 Jetzt bieten! Sehr gute Gewinnchance!"
        message_en = "🎯 Bid now! Very good chance of winning!"
        urgency = "high"
    elif probability >= 50:
        action = "consider"
        message_de = "✅ Gute Chance - Biete wenn du das Produkt willst"
        message_en = "✅ Good chance - Bid if you want the product"
        urgency = "medium"
    elif probability >= 30:
        action = "wait"
        message_de = "⏳ Warte noch - Viel Konkurrenz aktiv"
        message_en = "⏳ Wait - High competition active"
        urgency = "low"
    else:
        action = "skip"
        message_de = "⚠️ Hohe Konkurrenz - Vielleicht andere Auktion?"
        message_en = "⚠️ High competition - Maybe try another auction?"
        urgency = "none"
    
    # Special cases
    if seconds_left < 30 and probability > 40:
        action = "bid_now"
        message_de = "🔥 JETZT! Auktion endet in Sekunden!"
        message_en = "🔥 NOW! Auction ending in seconds!"
        urgency = "critical"
    
    # Optimal bid timing suggestion
    if analysis.get("avg_interval", 30) > 20:
        timing_advice_de = "Biete in den letzten 10 Sekunden für beste Chance"
        timing_advice_en = "Bid in the last 10 seconds for best chance"
    else:
        timing_advice_de = "Schnelle Auktion - Sei bereit sofort zu reagieren"
        timing_advice_en = "Fast auction - Be ready to react immediately"
    
    return {
        "auction_id": auction_id,
        "recommendation": {
            "action": action,
            "message": {"de": message_de, "en": message_en},
            "urgency": urgency
        },
        "win_probability": {
            "percent": probability,
            "confidence": win_prob["confidence"],
            "factors": win_prob["factors"]
        },
        "auction_analysis": {
            "pattern": analysis.get("pattern"),
            "intensity": analysis.get("intensity"),
            "unique_bidders": analysis.get("unique_bidders", 0),
            "avg_bid_interval": analysis.get("avg_interval", 0)
        },
        "timing_advice": {"de": timing_advice_de, "en": timing_advice_en},
        "seconds_left": int(seconds_left),
        "current_price": auction.get("current_price", 0)
    }

@router.get("/best-opportunities")
async def get_best_opportunities(limit: int = 5, user: dict = Depends(get_current_user)):
    """Get auctions with best winning opportunities for this user"""
    auctions = await db.auctions.find(
        {"status": "active"},
        {"_id": 0, "id": 1, "product_id": 1, "current_price": 1, "end_time": 1, "total_bids": 1}
    ).to_list(100)
    
    opportunities = []
    
    for auction in auctions:
        try:
            win_prob = await calculate_win_probability(user["id"], auction["id"])
            
            # Get product info
            product = await db.products.find_one(
                {"id": auction.get("product_id")},
                {"_id": 0, "name": 1, "image_url": 1, "retail_price": 1}
            )
            
            end_time = datetime.fromisoformat(auction["end_time"].replace("Z", "+00:00"))
            seconds_left = (end_time - datetime.now(timezone.utc)).total_seconds()
            
            if seconds_left > 0:
                opportunities.append({
                    "auction_id": auction["id"],
                    "product_name": product.get("name") if product else "Produkt",
                    "product_image": product.get("image_url") if product else None,
                    "retail_price": product.get("retail_price", 0) if product else 0,
                    "current_price": auction.get("current_price", 0),
                    "win_probability": win_prob["probability"],
                    "confidence": win_prob["confidence"],
                    "seconds_left": int(seconds_left),
                    "total_bids": auction.get("total_bids", 0)
                })
        except Exception as e:
            continue
    
    # Sort by win probability (highest first)
    opportunities.sort(key=lambda x: x["win_probability"], reverse=True)
    
    return {"opportunities": opportunities[:limit]}

@router.get("/strategy/{auction_id}")
async def get_bidding_strategy(auction_id: str, user: dict = Depends(get_current_user)):
    """Get detailed bidding strategy for an auction"""
    auction = await db.auctions.find_one({"id": auction_id}, {"_id": 0})
    if not auction:
        raise HTTPException(status_code=404, detail="Auktion nicht gefunden")
    
    analysis = await analyze_auction_patterns(auction_id)
    win_prob = await calculate_win_probability(user["id"], auction_id)
    
    # Calculate time
    try:
        end_time = datetime.fromisoformat(auction["end_time"].replace("Z", "+00:00"))
        seconds_left = (end_time - datetime.now(timezone.utc)).total_seconds()
        hours_left = seconds_left / 3600
    except:
        seconds_left = 3600
        hours_left = 1
    
    # Determine strategy based on auction characteristics
    strategies = []
    
    if analysis.get("intensity") == "high":
        strategies.append({
            "name": "Sniper-Strategie",
            "description": "Warte bis zur letzten Sekunde und biete dann schnell",
            "success_rate": "75%",
            "risk": "hoch"
        })
    
    if analysis.get("intensity") == "low":
        strategies.append({
            "name": "Früh-Bieter",
            "description": "Biete früh um Konkurrenz abzuschrecken",
            "success_rate": "60%",
            "risk": "niedrig"
        })
    
    if hours_left > 2:
        strategies.append({
            "name": "Abwarten",
            "description": "Beobachte die Auktion und biete später",
            "success_rate": "50%",
            "risk": "niedrig"
        })
    
    strategies.append({
        "name": "Bid Buddy aktivieren",
        "description": "Automatisches Bieten einrichten und entspannen",
        "success_rate": "65%",
        "risk": "mittel"
    })
    
    # Recommended bids count
    if win_prob["probability"] > 60:
        recommended_bids = 3
    elif win_prob["probability"] > 40:
        recommended_bids = 5
    else:
        recommended_bids = 10
    
    return {
        "auction_id": auction_id,
        "current_analysis": analysis,
        "win_probability": win_prob,
        "recommended_strategies": strategies,
        "recommended_bid_budget": recommended_bids,
        "optimal_bid_time": "Letzte 10 Sekunden" if analysis.get("intensity") == "high" else "Jetzt",
        "warnings": [
            "Hohe Konkurrenz" if analysis.get("competition_level", 0) > 5 else None,
            "Schnelle Gebote" if analysis.get("avg_interval", 30) < 10 else None
        ]
    }
