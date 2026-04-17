"""
BidBlitz V2 - Server Monitoring API
Real-time server health, API metrics, DB status, error tracking.
"""
import time
import os
import platform
from datetime import datetime, timezone, timedelta
from collections import defaultdict, deque
from fastapi import APIRouter, Request
from core.database import db
from core.security import get_current_user

router = APIRouter(prefix="/api/admin/monitoring", tags=["monitoring"])

# In-memory metrics store (resets on restart)
_metrics = {
    "requests": deque(maxlen=10000),
    "errors": deque(maxlen=5000),
    "slow_endpoints": deque(maxlen=500),
    "start_time": time.time(),
}


async def require_admin(request: Request):
    user = await get_current_user(request)
    if user.get("role") != "admin":
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Admin only")
    return user


def get_system_stats():
    try:
        with open("/proc/loadavg") as f:
            load = f.read().split()
        load_1, load_5, load_15 = float(load[0]), float(load[1]), float(load[2])
    except Exception:
        load_1 = load_5 = load_15 = 0

    try:
        with open("/proc/meminfo") as f:
            mem = {}
            for line in f:
                parts = line.split()
                mem[parts[0].rstrip(":")] = int(parts[1])
        total_mb = mem.get("MemTotal", 0) / 1024
        free_mb = (mem.get("MemFree", 0) + mem.get("Buffers", 0) + mem.get("Cached", 0)) / 1024
        used_mb = total_mb - free_mb
        mem_pct = (used_mb / total_mb * 100) if total_mb > 0 else 0
    except Exception:
        total_mb = used_mb = free_mb = mem_pct = 0

    try:
        stat = os.statvfs("/")
        disk_total_gb = (stat.f_blocks * stat.f_frsize) / (1024 ** 3)
        disk_free_gb = (stat.f_bfree * stat.f_frsize) / (1024 ** 3)
        disk_used_gb = disk_total_gb - disk_free_gb
        disk_pct = (disk_used_gb / disk_total_gb * 100) if disk_total_gb > 0 else 0
    except Exception:
        disk_total_gb = disk_used_gb = disk_free_gb = disk_pct = 0

    try:
        with open("/proc/uptime") as f:
            uptime_sec = float(f.read().split()[0])
    except Exception:
        uptime_sec = 0

    return {
        "cpu_load_1m": round(load_1, 2),
        "cpu_load_5m": round(load_5, 2),
        "cpu_load_15m": round(load_15, 2),
        "memory_total_mb": round(total_mb),
        "memory_used_mb": round(used_mb),
        "memory_free_mb": round(free_mb),
        "memory_percent": round(mem_pct, 1),
        "disk_total_gb": round(disk_total_gb, 1),
        "disk_used_gb": round(disk_used_gb, 1),
        "disk_free_gb": round(disk_free_gb, 1),
        "disk_percent": round(disk_pct, 1),
        "uptime_seconds": int(uptime_sec),
        "uptime_days": round(uptime_sec / 86400, 1),
        "platform": platform.system(),
        "hostname": platform.node(),
    }


@router.get("/health")
async def health_check(request: Request):
    await require_admin(request)
    now = time.time()
    api_uptime = now - _metrics["start_time"]

    # DB check
    db_ok = False
    db_latency = 0
    try:
        t0 = time.time()
        await db.command("ping")
        db_latency = round((time.time() - t0) * 1000, 1)
        db_ok = True
    except Exception:
        pass

    # Count collections and docs
    db_stats = {}
    try:
        cols = await db.list_collection_names()
        db_stats["collections"] = len(cols)
        stats = await db.command("dbstats")
        db_stats["data_size_mb"] = round(stats.get("dataSize", 0) / (1024 * 1024), 1)
        db_stats["storage_size_mb"] = round(stats.get("storageSize", 0) / (1024 * 1024), 1)
        db_stats["objects"] = stats.get("objects", 0)
    except Exception:
        db_stats = {"collections": 0, "data_size_mb": 0, "objects": 0}

    system = get_system_stats()

    return {
        "status": "healthy" if db_ok else "degraded",
        "api_uptime_seconds": int(api_uptime),
        "api_uptime_hours": round(api_uptime / 3600, 1),
        "database": {
            "connected": db_ok,
            "latency_ms": db_latency,
            **db_stats,
        },
        "system": system,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/metrics")
async def api_metrics(request: Request):
    await require_admin(request)
    now = time.time()

    # Requests in last hour / 24h
    reqs_1h = [r for r in _metrics["requests"] if now - r["ts"] < 3600]
    reqs_24h = [r for r in _metrics["requests"] if now - r["ts"] < 86400]

    # Errors in last hour
    errs_1h = [e for e in _metrics["errors"] if now - e["ts"] < 3600]
    errs_24h = [e for e in _metrics["errors"] if now - e["ts"] < 86400]

    # Average response time
    if reqs_1h:
        avg_ms = round(sum(r["duration_ms"] for r in reqs_1h) / len(reqs_1h), 1)
        p95_ms = round(sorted(r["duration_ms"] for r in reqs_1h)[int(len(reqs_1h) * 0.95)], 1)
        p99_ms = round(sorted(r["duration_ms"] for r in reqs_1h)[int(len(reqs_1h) * 0.99)], 1)
    else:
        avg_ms = p95_ms = p99_ms = 0

    # Requests per minute (last 10 min)
    rpm_data = []
    for i in range(10):
        t_start = now - (i + 1) * 60
        t_end = now - i * 60
        count = sum(1 for r in reqs_1h if t_start <= r["ts"] < t_end)
        rpm_data.append({"minute": i, "count": count})
    rpm_data.reverse()

    # Top slow endpoints
    slow = sorted(_metrics["slow_endpoints"], key=lambda x: -x["duration_ms"])[:10]

    # Error breakdown by status code
    error_codes = defaultdict(int)
    for e in errs_1h:
        error_codes[e["status"]] += 1

    # Top endpoints by volume
    endpoint_counts = defaultdict(int)
    for r in reqs_1h:
        endpoint_counts[r["path"]] += 1
    top_endpoints = sorted(endpoint_counts.items(), key=lambda x: -x[1])[:15]

    return {
        "requests_1h": len(reqs_1h),
        "requests_24h": len(reqs_24h),
        "errors_1h": len(errs_1h),
        "errors_24h": len(errs_24h),
        "error_rate_pct": round(len(errs_1h) / max(len(reqs_1h), 1) * 100, 2),
        "avg_response_ms": avg_ms,
        "p95_response_ms": p95_ms,
        "p99_response_ms": p99_ms,
        "rpm_chart": rpm_data,
        "top_endpoints": [{"path": p, "count": c} for p, c in top_endpoints],
        "slow_endpoints": [{"path": s["path"], "method": s["method"], "duration_ms": round(s["duration_ms"], 1)} for s in slow],
        "error_codes": dict(error_codes),
        "total_tracked": len(_metrics["requests"]),
    }


@router.get("/db-stats")
async def database_stats(request: Request):
    await require_admin(request)

    try:
        stats = await db.command("dbstats")
    except Exception:
        stats = {}

    # Collection sizes
    cols = await db.list_collection_names()
    col_stats = []
    for c in sorted(cols)[:50]:
        try:
            count = await db[c].count_documents({})
            col_stats.append({"name": c, "documents": count})
        except Exception:
            col_stats.append({"name": c, "documents": -1})

    col_stats.sort(key=lambda x: -x["documents"])

    return {
        "db_name": db.name,
        "collections": len(cols),
        "total_objects": stats.get("objects", 0),
        "data_size_mb": round(stats.get("dataSize", 0) / (1024 * 1024), 1),
        "storage_size_mb": round(stats.get("storageSize", 0) / (1024 * 1024), 1),
        "index_size_mb": round(stats.get("indexSize", 0) / (1024 * 1024), 1),
        "top_collections": col_stats[:30],
    }


@router.get("/users-stats")
async def user_statistics(request: Request):
    await require_admin(request)
    now = datetime.now(timezone.utc)

    total = await db.users.count_documents({})
    today = await db.users.count_documents({"created_at": {"$gte": now.replace(hour=0, minute=0, second=0).isoformat()}})
    week = await db.users.count_documents({"created_at": {"$gte": (now - timedelta(days=7)).isoformat()}})
    month = await db.users.count_documents({"created_at": {"$gte": (now - timedelta(days=30)).isoformat()}})

    # Role distribution
    roles = await db.users.aggregate([
        {"$group": {"_id": "$role", "count": {"$sum": 1}}}
    ]).to_list(None)

    # Active users (last login within 7 days)
    active = await db.users.count_documents({"last_login": {"$gte": (now - timedelta(days=7)).isoformat()}})

    return {
        "total_users": total,
        "new_today": today,
        "new_this_week": week,
        "new_this_month": month,
        "active_7d": active,
        "roles": {r["_id"] or "user": r["count"] for r in roles},
    }


def record_request(path, method, status, duration_ms):
    now = time.time()
    _metrics["requests"].append({
        "path": path, "method": method, "status": status,
        "duration_ms": duration_ms, "ts": now,
    })
    if status >= 400:
        _metrics["errors"].append({
            "path": path, "method": method, "status": status,
            "duration_ms": duration_ms, "ts": now,
        })
    if duration_ms > 500:
        _metrics["slow_endpoints"].append({
            "path": path, "method": method, "duration_ms": duration_ms, "ts": now,
        })
