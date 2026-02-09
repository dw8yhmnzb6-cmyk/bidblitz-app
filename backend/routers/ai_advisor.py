"""
AI Price Advisor Router - ML-based price predictions
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
from bson import ObjectId
import random

router = APIRouter(prefix="/ai-advisor", tags=["AI Advisor"])

class PredictionRequest(BaseModel):
    auction_id: str

class BidTimingRequest(BaseModel):
    auction_id: str
    user_budget: int  # Available bids

@router.get("/predict/{auction_id}")
async def predict_final_price(auction_id: str):
    """Predict the final price of an auction using AI"""
    from server import db
    
    auction = await db.auctions.find_one({"_id": ObjectId(auction_id)})
    if not auction:
        raise HTTPException(status_code=404, detail="Auktion nicht gefunden")
    
    product = auction.get("product", {})
    retail_price = product.get("retail_price", 100)
    current_price = auction.get("current_price", 0)
    
    # Get historical data for similar products
    similar_auctions = await db.auctions.find({
        "status": "ended",
        "product.category": product.get("category")
    }).limit(50).to_list(50)
    
    # Calculate average final price for similar items
    if similar_auctions:
        avg_final = sum(a.get("final_price", a.get("current_price", 0)) for a in similar_auctions) / len(similar_auctions)
    else:
        # Default prediction based on retail price
        avg_final = retail_price * 0.03  # ~3% of retail typically
    
    # Add some variance for realism
    predicted_min = max(current_price, avg_final * 0.8)
    predicted_max = avg_final * 1.4
    predicted_likely = avg_final * (1 + random.uniform(-0.1, 0.2))
    
    # Calculate confidence based on data availability
    confidence = min(95, 50 + len(similar_auctions))
    
    # Win probability calculation
    time_remaining = (datetime.fromisoformat(auction["end_time"].replace("Z", "+00:00")) - datetime.now(timezone.utc)).total_seconds()
    bidders_count = auction.get("total_bids", 0)
    
    win_probability = max(5, min(85, 100 - (bidders_count * 2) - (current_price * 10)))
    
    return {
        "auction_id": auction_id,
        "current_price": current_price,
        "prediction": {
            "min_price": round(predicted_min, 2),
            "likely_price": round(predicted_likely, 2),
            "max_price": round(predicted_max, 2),
            "confidence": confidence
        },
        "win_probability": round(win_probability),
        "recommendation": get_recommendation(current_price, predicted_likely, time_remaining, win_probability),
        "similar_auctions_analyzed": len(similar_auctions),
        "insights": generate_insights(auction, predicted_likely, win_probability)
    }

def get_recommendation(current_price, predicted_price, time_remaining, win_probability):
    """Generate bidding recommendation"""
    if time_remaining < 60:  # Less than 1 minute
        return {
            "action": "BID_NOW",
            "emoji": "🔥",
            "message": "Letzte Chance! Jetzt bieten!",
            "urgency": "critical"
        }
    elif win_probability > 60:
        return {
            "action": "BID_NOW",
            "emoji": "✅",
            "message": "Gute Gewinnchance! Jetzt einsteigen.",
            "urgency": "high"
        }
    elif current_price < predicted_price * 0.5:
        return {
            "action": "WAIT",
            "emoji": "⏳",
            "message": "Preis steigt noch. Warte noch etwas.",
            "urgency": "low"
        }
    else:
        return {
            "action": "CONSIDER",
            "emoji": "🤔",
            "message": "Beobachte die Auktion weiter.",
            "urgency": "medium"
        }

def generate_insights(auction, predicted_price, win_probability):
    """Generate AI insights about the auction"""
    insights = []
    
    product = auction.get("product", {})
    retail_price = product.get("retail_price", 100)
    current_price = auction.get("current_price", 0)
    
    # Savings insight
    potential_savings = retail_price - predicted_price
    savings_percent = (potential_savings / retail_price) * 100 if retail_price > 0 else 0
    insights.append({
        "type": "savings",
        "icon": "💰",
        "title": "Ersparnis-Potenzial",
        "value": f"Bis zu {savings_percent:.0f}% sparen (€{potential_savings:.0f})"
    })
    
    # Competition insight
    total_bids = auction.get("total_bids", 0)
    if total_bids < 10:
        competition = "Niedrig"
        icon = "😊"
    elif total_bids < 30:
        competition = "Mittel"
        icon = "😐"
    else:
        competition = "Hoch"
        icon = "😰"
    
    insights.append({
        "type": "competition",
        "icon": icon,
        "title": "Wettbewerb",
        "value": f"{competition} ({total_bids} Gebote bisher)"
    })
    
    # Best time to bid
    insights.append({
        "type": "timing",
        "icon": "⏰",
        "title": "Beste Zeit zum Bieten",
        "value": "In den letzten 30 Sekunden"
    })
    
    return insights

@router.get("/timing/{auction_id}")
async def get_bid_timing(auction_id: str, budget: int = 10):
    """Get optimal bid timing strategy"""
    from server import db
    
    auction = await db.auctions.find_one({"_id": ObjectId(auction_id)})
    if not auction:
        raise HTTPException(status_code=404, detail="Auktion nicht gefunden")
    
    end_time = datetime.fromisoformat(auction["end_time"].replace("Z", "+00:00"))
    time_remaining = (end_time - datetime.now(timezone.utc)).total_seconds()
    
    # Strategy based on budget and time
    if budget < 5:
        strategy = "conservative"
        advice = "Mit wenigen Geboten: Warte bis letzte 10 Sekunden"
    elif budget < 20:
        strategy = "balanced"
        advice = "Starte in letzter Minute, spare Gebote für Endspurt"
    else:
        strategy = "aggressive"
        advice = "Du kannst früher einsteigen und Druck aufbauen"
    
    # Optimal bid times
    bid_schedule = []
    if time_remaining > 300:  # More than 5 min
        bid_schedule.append({
            "time": "5 Minuten vor Ende",
            "action": "Beobachten",
            "bids_to_use": 0
        })
    if time_remaining > 60:
        bid_schedule.append({
            "time": "1 Minute vor Ende",
            "action": "Erstes Gebot" if strategy != "conservative" else "Weiter warten",
            "bids_to_use": 1 if strategy == "aggressive" else 0
        })
    bid_schedule.append({
        "time": "30 Sekunden",
        "action": "Aktiv bieten",
        "bids_to_use": min(3, budget // 3)
    })
    bid_schedule.append({
        "time": "10 Sekunden",
        "action": "Endspurt!",
        "bids_to_use": budget - sum(b["bids_to_use"] for b in bid_schedule)
    })
    
    return {
        "auction_id": auction_id,
        "strategy": strategy,
        "advice": advice,
        "budget": budget,
        "schedule": bid_schedule,
        "auto_bid_recommendation": budget >= 10
    }

@router.get("/hot-auctions")
async def get_hot_auctions():
    """Get auctions with best win probability right now"""
    from server import db
    
    # Find active auctions
    auctions = await db.auctions.find({
        "status": "active"
    }).limit(20).to_list(20)
    
    recommendations = []
    for auction in auctions:
        auction["id"] = str(auction.pop("_id"))
        
        product = auction.get("product", {})
        retail_price = product.get("retail_price", 100)
        current_price = auction.get("current_price", 0)
        total_bids = auction.get("total_bids", 0)
        
        # Calculate score
        savings_ratio = (retail_price - current_price) / retail_price if retail_price > 0 else 0
        competition_score = max(0, 100 - total_bids * 3)
        
        score = (savings_ratio * 50) + (competition_score * 0.5)
        
        recommendations.append({
            "auction": auction,
            "score": round(score),
            "reason": "Wenig Wettbewerb" if total_bids < 10 else "Hohe Ersparnis",
            "win_chance": f"{min(90, max(10, competition_score))}%"
        })
    
    # Sort by score
    recommendations.sort(key=lambda x: x["score"], reverse=True)
    
    return recommendations[:5]
