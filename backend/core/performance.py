"""
BidBlitz V2 - Performance Optimization & Caching System
API caching, database optimization, and cost reduction utilities.
"""

import time
import hashlib
import json
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, Callable
from functools import wraps
from collections import OrderedDict

from core.database import db

# ══════════════════════════════════════
# IN-MEMORY CACHE
# ══════════════════════════════════════

class LRUCache:
    """Simple LRU cache with TTL support."""
    
    def __init__(self, maxsize: int = 1000):
        self.cache: OrderedDict = OrderedDict()
        self.maxsize = maxsize
        self.hits = 0
        self.misses = 0
    
    def get(self, key: str) -> Optional[Any]:
        if key not in self.cache:
            self.misses += 1
            return None
        
        entry = self.cache[key]
        if entry["expires"] < time.time():
            del self.cache[key]
            self.misses += 1
            return None
        
        # Move to end (most recently used)
        self.cache.move_to_end(key)
        self.hits += 1
        return entry["value"]
    
    def set(self, key: str, value: Any, ttl: int = 60):
        if key in self.cache:
            del self.cache[key]
        elif len(self.cache) >= self.maxsize:
            self.cache.popitem(last=False)
        
        self.cache[key] = {
            "value": value,
            "expires": time.time() + ttl,
            "created": time.time(),
        }
    
    def delete(self, key: str):
        if key in self.cache:
            del self.cache[key]
    
    def clear(self):
        self.cache.clear()
    
    def stats(self) -> Dict:
        total = self.hits + self.misses
        return {
            "size": len(self.cache),
            "maxsize": self.maxsize,
            "hits": self.hits,
            "misses": self.misses,
            "hit_rate": round(self.hits / total * 100, 2) if total > 0 else 0,
        }


# Global cache instances
api_cache = LRUCache(maxsize=500)
query_cache = LRUCache(maxsize=200)
user_cache = LRUCache(maxsize=1000)


def cache_key(*args, **kwargs) -> str:
    """Generate cache key from arguments."""
    data = json.dumps({"args": args, "kwargs": kwargs}, sort_keys=True, default=str)
    return hashlib.md5(data.encode()).hexdigest()


# ══════════════════════════════════════
# CACHE DECORATORS
# ══════════════════════════════════════

def cached(ttl: int = 60, cache_instance: LRUCache = None):
    """Decorator to cache function results."""
    cache = cache_instance or api_cache
    
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            key = f"{func.__name__}:{cache_key(*args[1:], **kwargs)}"
            
            cached_value = cache.get(key)
            if cached_value is not None:
                return cached_value
            
            result = await func(*args, **kwargs)
            cache.set(key, result, ttl)
            return result
        
        return wrapper
    return decorator


def invalidate_cache(pattern: str = None, cache_instance: LRUCache = None):
    """Invalidate cache entries matching pattern."""
    cache = cache_instance or api_cache
    
    if pattern:
        keys_to_delete = [k for k in cache.cache.keys() if pattern in k]
        for key in keys_to_delete:
            cache.delete(key)
    else:
        cache.clear()


# ══════════════════════════════════════
# DATABASE QUERY OPTIMIZATION
# ══════════════════════════════════════

async def ensure_indexes():
    """Create necessary database indexes for performance."""
    # Users collection
    await db.users.create_index("email", unique=True)
    await db.users.create_index("role")
    await db.users.create_index("created_at")
    await db.users.create_index("referral_code")
    
    # Transactions collection
    await db.transactions.create_index("user_id")
    await db.transactions.create_index("created_at")
    await db.transactions.create_index("type")
    await db.transactions.create_index([("user_id", 1), ("created_at", -1)])
    
    # Taxi rides
    await db.taxi_rides.create_index("ride_id", unique=True)
    await db.taxi_rides.create_index("user_id")
    await db.taxi_rides.create_index("status")
    await db.taxi_rides.create_index("created_at")
    await db.taxi_rides.create_index([("user_id", 1), ("status", 1)])
    
    # Scooter rentals
    await db.scooter_rentals.create_index("rental_id", unique=True)
    await db.scooter_rentals.create_index("user_id")
    await db.scooter_rentals.create_index("scooter_id")
    await db.scooter_rentals.create_index("status")
    
    # Food orders
    await db.food_orders.create_index("order_id", unique=True)
    await db.food_orders.create_index("user_id")
    await db.food_orders.create_index("restaurant_id")
    await db.food_orders.create_index("status")
    await db.food_orders.create_index("created_at")
    
    # Auctions
    await db.auctions.create_index("auction_id")
    await db.auctions.create_index("status")
    await db.auctions.create_index("ends_at")
    
    # Notifications
    await db.notifications.create_index([("user_id", 1), ("read", 1)])
    await db.notifications.create_index("created_at")
    
    # Audit logs
    await db.audit_logs.create_index("user_id")
    await db.audit_logs.create_index("event")
    await db.audit_logs.create_index("timestamp")
    
    # Platform revenue
    await db.platform_revenue.create_index("created_at")
    await db.platform_revenue.create_index("category")


async def paginate_query(
    collection,
    query: dict,
    page: int = 1,
    page_size: int = 20,
    sort_field: str = "created_at",
    sort_order: int = -1,
    projection: dict = None,
) -> Dict:
    """Paginate database queries efficiently."""
    skip = (page - 1) * page_size
    
    # Get total count (cached for 30 seconds)
    count_key = f"count:{collection.name}:{cache_key(query)}"
    total = query_cache.get(count_key)
    if total is None:
        total = await collection.count_documents(query)
        query_cache.set(count_key, total, 30)
    
    # Get items
    cursor = collection.find(query, projection or {"_id": 0})
    cursor = cursor.sort(sort_field, sort_order).skip(skip).limit(page_size)
    items = await cursor.to_list(page_size)
    
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
        "has_next": skip + len(items) < total,
        "has_prev": page > 1,
    }


# ══════════════════════════════════════
# DATA ARCHIVAL
# ══════════════════════════════════════

async def archive_old_data(days_old: int = 90):
    """Archive data older than specified days."""
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days_old)).isoformat()
    
    # Archive old transactions
    old_txns = await db.transactions.find(
        {"created_at": {"$lt": cutoff}}
    ).to_list(10000)
    
    if old_txns:
        # Move to archive collection
        for txn in old_txns:
            txn["archived_at"] = datetime.now(timezone.utc).isoformat()
        await db.transactions_archive.insert_many(old_txns)
        
        # Delete from main collection
        await db.transactions.delete_many({"created_at": {"$lt": cutoff}})
    
    # Archive old audit logs (keep 60 days)
    audit_cutoff = (datetime.now(timezone.utc) - timedelta(days=60)).isoformat()
    old_logs = await db.audit_logs.find(
        {"timestamp": {"$lt": audit_cutoff}}
    ).to_list(10000)
    
    if old_logs:
        for log in old_logs:
            log["archived_at"] = datetime.now(timezone.utc).isoformat()
        await db.audit_logs_archive.insert_many(old_logs)
        await db.audit_logs.delete_many({"timestamp": {"$lt": audit_cutoff}})
    
    return {
        "transactions_archived": len(old_txns) if old_txns else 0,
        "audit_logs_archived": len(old_logs) if old_logs else 0,
    }


# ══════════════════════════════════════
# BATCH PROCESSING
# ══════════════════════════════════════

async def batch_process(items: list, processor: Callable, batch_size: int = 50):
    """Process items in batches to reduce memory usage."""
    results = []
    for i in range(0, len(items), batch_size):
        batch = items[i:i + batch_size]
        batch_results = await processor(batch)
        results.extend(batch_results)
    return results


# ══════════════════════════════════════
# QUERY OPTIMIZATION HELPERS
# ══════════════════════════════════════

def build_efficient_query(
    base_query: dict,
    filters: dict,
    date_range: tuple = None,
) -> dict:
    """Build an efficient MongoDB query."""
    query = base_query.copy()
    
    # Add filters
    for key, value in filters.items():
        if value is not None and value != "":
            if isinstance(value, list):
                query[key] = {"$in": value}
            else:
                query[key] = value
    
    # Add date range
    if date_range:
        start, end = date_range
        if start and end:
            query["created_at"] = {"$gte": start, "$lte": end}
        elif start:
            query["created_at"] = {"$gte": start}
        elif end:
            query["created_at"] = {"$lte": end}
    
    return query


# ══════════════════════════════════════
# RESPONSE COMPRESSION
# ══════════════════════════════════════

def minimize_response(data: dict, fields: list = None) -> dict:
    """Minimize response data by selecting only needed fields."""
    if not fields:
        return data
    
    return {k: v for k, v in data.items() if k in fields}


def minimize_list_response(items: list, fields: list) -> list:
    """Minimize list response."""
    return [minimize_response(item, fields) for item in items]


# ══════════════════════════════════════
# MONITORING & STATS
# ══════════════════════════════════════

request_stats = {
    "total_requests": 0,
    "slow_requests": 0,
    "errors": 0,
    "start_time": time.time(),
}


def track_request(duration: float, is_error: bool = False):
    """Track request statistics."""
    request_stats["total_requests"] += 1
    if duration > 1.0:  # Slow request threshold: 1 second
        request_stats["slow_requests"] += 1
    if is_error:
        request_stats["errors"] += 1


def get_performance_stats() -> dict:
    """Get performance statistics."""
    uptime = time.time() - request_stats["start_time"]
    total = request_stats["total_requests"]
    
    return {
        "uptime_seconds": round(uptime),
        "total_requests": total,
        "requests_per_second": round(total / uptime, 2) if uptime > 0 else 0,
        "slow_requests": request_stats["slow_requests"],
        "errors": request_stats["errors"],
        "error_rate": round(request_stats["errors"] / total * 100, 2) if total > 0 else 0,
        "cache_stats": {
            "api": api_cache.stats(),
            "query": query_cache.stats(),
            "user": user_cache.stats(),
        },
    }


# ══════════════════════════════════════
# RETRY LOGIC
# ══════════════════════════════════════

import asyncio


async def retry_async(
    func: Callable,
    max_retries: int = 3,
    delay: float = 1.0,
    backoff: float = 2.0,
    exceptions: tuple = (Exception,),
):
    """Retry async function with exponential backoff."""
    last_exception = None
    
    for attempt in range(max_retries):
        try:
            return await func()
        except exceptions as e:
            last_exception = e
            if attempt < max_retries - 1:
                wait_time = delay * (backoff ** attempt)
                await asyncio.sleep(wait_time)
    
    raise last_exception


# ══════════════════════════════════════
# LAZY LOADING HELPERS
# ══════════════════════════════════════

async def get_user_minimal(user_id: str) -> dict:
    """Get minimal user data (cached)."""
    from bson import ObjectId
    
    cache_key = f"user_min:{user_id}"
    cached = user_cache.get(cache_key)
    if cached:
        return cached
    
    user = await db.users.find_one(
        {"_id": ObjectId(user_id)},
        {"_id": 0, "name": 1, "email": 1, "balance": 1, "role": 1}
    )
    
    if user:
        user_cache.set(cache_key, user, 60)
    
    return user


def invalidate_user_cache(user_id: str):
    """Invalidate user cache after update."""
    user_cache.delete(f"user_min:{user_id}")
