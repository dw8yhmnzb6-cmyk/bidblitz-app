"""
BidBlitz AI Analytics
Track user activity, popular features, active users
MongoDB-persistent storage
"""
from fastapi import APIRouter
from datetime import datetime, timezone
from pymongo import MongoClient
import os

router = APIRouter(prefix="/ai", tags=["AI Analytics"])

# MongoDB Connection
mongo_url = os.environ.get("MONGO_URL")
db_name = os.environ.get("DB_NAME", "bidblitz")
client = MongoClient(mongo_url)
db = client[db_name]

# Collections
activity_col = db["ai_activity_log"]
feature_usage_col = db["ai_feature_usage"]


# Aktivität speichern
@router.post("/log")
def log_activity(user_id: str, feature: str):
    now = datetime.now(timezone.utc)
    
    # Log activity
    activity_col.insert_one({
        "user_id": user_id,
        "feature": feature,
        "timestamp": now.isoformat(),
        "date": now.date().isoformat()
    })
    
    # Update feature count
    feature_usage_col.update_one(
        {"feature": feature},
        {"$inc": {"count": 1}, "$set": {"last_used": now.isoformat()}},
        upsert=True
    )
    
    return {"status": "logged"}


# Beliebteste Features
@router.get("/popular")
def popular_features():
    features = list(feature_usage_col.find({}, {"_id": 0}).sort("count", -1).limit(20))
    return [[f["feature"], f["count"]] for f in features]


# Aktivste Nutzer
@router.get("/active-users")
def active_users():
    pipeline = [
        {"$group": {"_id": "$user_id", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 10}
    ]
    results = list(activity_col.aggregate(pipeline))
    return [[r["_id"], r["count"]] for r in results]


# Nutzung nach Feature
@router.get("/feature-stats")
def feature_stats():
    features = list(feature_usage_col.find({}, {"_id": 0}))
    return {f["feature"]: f["count"] for f in features}


# Recent Activity
@router.get("/recent")
def recent_activity():
    activities = list(activity_col.find({}, {"_id": 0}).sort("timestamp", -1).limit(20))
    return activities
