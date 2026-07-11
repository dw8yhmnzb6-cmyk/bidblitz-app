"""
BidBlitz V2 - Server Monitoring API
Real-time server health, API metrics, DB status, error tracking.
"""
import time
import os
import platform
import httpx
from datetime import datetime, timezone, timedelta
from collections import defaultdict, deque
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
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

MONITORED_FLOWS = [
    {"key": "site_home", "label": "Webseite", "method": "GET", "path": "/"},
    {"key": "auth_login", "label": "Login", "method": "POST", "path": "/api/auth/login", "body": {"email": "reviewer@bidblitz.ae", "password": "BidBlitzReview2026!", "remember_me": True}, "expect_statuses": [200]},
    {"key": "auth_register_contract", "label": "Registrierung", "method": "POST", "path": "/api/auth/register", "body": {"name": "Monitor Contract", "email": "monitor.invalid", "password": "123"}, "expect_statuses": [400, 409, 422]},
    {"key": "auctions_list", "label": "Auktionen", "method": "GET", "path": "/api/auctions/active", "expect_statuses": [200]},
]


class FrontendErrorLogRequest(BaseModel):
    message: str = ""
    page: str = ""
    stack: str = ""
    component_stack: str = ""
    level: str = "error"
    meta: dict = {}


async def _maybe_create_daily_report_notification() -> dict:
    now = datetime.now(timezone.utc)
    report_key = now.strftime("%Y-%m-%d")
    existing = await db.monitoring_daily_reports.find_one({"report_key": report_key}, {"_id": 0})
    if existing:
        return existing

    since_24h = (now - timedelta(hours=24)).isoformat()
    frontend_errors = await db.frontend_errors.count_documents({"created_at": {"$gte": since_24h}})
    incidents = await db.monitoring_incidents.count_documents({"created_at": {"$gte": since_24h}})
    active_probes = await db.monitoring_probes.find({}, {"_id": 0}).to_list(50)
    failing_probes = [probe for probe in active_probes if probe.get("status") != "ok"]

    report = {
        "report_key": report_key,
        "created_at": now.isoformat(),
        "summary": {
            "frontend_errors_24h": frontend_errors,
            "incidents_24h": incidents,
            "failing_probes": len(failing_probes),
        },
        "status": "critical" if failing_probes else ("warning" if frontend_errors or incidents else "ok"),
    }
    await db.monitoring_daily_reports.insert_one(report)

    admins = await db.users.find({"role": "admin"}, {"_id": 1}).to_list(50)
    if admins:
        title = "Tagesreport: Systemstatus"
        message = f"Frontend-Fehler 24h: {frontend_errors} | Incidents 24h: {incidents} | Kritische Checks: {len(failing_probes)}"
        notifications = [{
            "user_id": str(admin["_id"]),
            "type": "monitoring_daily_report",
            "title": title,
            "message": message,
            "read": False,
            "created_at": now.isoformat(),
            "meta": report,
        } for admin in admins]
        await db.notifications.insert_many(notifications)
    return report


async def _ensure_critical_alert_notifications(alerts: list[dict]):
    critical_alerts = [alert for alert in alerts if alert.get("severity") == "critical"]
    if not critical_alerts:
        return
    admins = await db.users.find({"role": "admin"}, {"_id": 1}).to_list(50)
    if not admins:
        return
    now = datetime.now(timezone.utc).isoformat()
    for alert in critical_alerts:
        alert_key = f"{alert.get('key')}::{now[:13]}"
        exists = await db.monitoring_alert_notifications.find_one({"alert_key": alert_key}, {"_id": 0})
        if exists:
            continue
        await db.monitoring_alert_notifications.insert_one({"alert_key": alert_key, "created_at": now, "alert": alert})
        notifications = [{
            "user_id": str(admin["_id"]),
            "type": "admin_alert",
            "title": f"Kritischer Fehler: {alert.get('label')}",
            "message": alert.get("message") or "Kritische Plattformwarnung erkannt.",
            "read": False,
            "created_at": now,
            "meta": {"source": "monitoring_error_center", **alert},
        } for admin in admins]
        await db.notifications.insert_many(notifications)


async def require_admin(request: Request):
    user = await get_current_user(request)
    if user.get("role") != "admin":
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Admin only")
    return user


def _severity_from_count(count: int) -> str:
    if count >= 25:
        return "critical"
    if count >= 8:
        return "warning"
    return "ok"


def _normalize_probe_status(status_code: int | None, expected: list[int]) -> str:
    if status_code in expected:
        return "ok"
    if status_code is None:
        return "critical"
    if status_code >= 500:
        return "critical"
    if status_code >= 400:
        return "warning"
    return "ok"


async def _run_probe(flow: dict) -> dict:
    base_url = os.environ.get("APP_BASE_URL") or os.environ.get("BASE_URL")
    if not base_url:
        base_url = os.environ.get("APP_BASE_URL") or "http://127.0.0.1:8001"
    if base_url and not str(base_url).startswith(("http://", "https://")):
        base_url = f"https://{str(base_url).lstrip('/')}"
    base_url = str(base_url).rstrip("/")
    url = f"{base_url}{flow['path']}"
    status_code = None
    error_message = ""
    started = time.time()
    try:
        async with httpx.AsyncClient(timeout=12, follow_redirects=True) as client:
            if flow.get("method") == "POST":
                response = await client.post(url, json=flow.get("body") or {})
            else:
                response = await client.get(url)
            status_code = response.status_code
    except Exception as exc:
        error_message = str(exc)
    latency_ms = round((time.time() - started) * 1000, 1)
    expected = flow.get("expect_statuses") or [200]
    return {
        "key": flow["key"],
        "label": flow["label"],
        "path": flow["path"],
        "status_code": status_code,
        "latency_ms": latency_ms,
        "status": _normalize_probe_status(status_code, expected),
        "error_message": error_message,
        "checked_at": datetime.now(timezone.utc).isoformat(),
    }


async def _store_probe_results(results: list[dict]):
    for result in results:
        await db.monitoring_probes.update_one(
            {"key": result["key"]},
            {"$set": result, "$inc": {"run_count": 1}},
            upsert=True,
        )
        if result["status"] != "ok":
            await db.monitoring_incidents.insert_one({
                "type": "probe_failure",
                "key": result["key"],
                "label": result["label"],
                "status": result["status"],
                "status_code": result.get("status_code"),
                "latency_ms": result.get("latency_ms"),
                "error_message": result.get("error_message", ""),
                "created_at": datetime.now(timezone.utc).isoformat(),
                "resolved": False,
            })


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


@router.post("/log-error")
async def log_frontend_error(payload: FrontendErrorLogRequest, request: Request):
    doc = {
        "message": payload.message[:1000],
        "page": payload.page or (payload.meta or {}).get("path") or "",
        "stack": payload.stack[:4000],
        "component_stack": payload.component_stack[:4000],
        "level": payload.level or "error",
        "meta": payload.meta or {},
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.frontend_errors.insert_one(doc)
    _metrics["errors"].append({"path": doc["page"] or "/frontend", "method": "CLIENT", "status": 500, "duration_ms": 0, "ts": time.time()})
    return {"ok": True}


@router.get("/error-center")
async def error_center(request: Request):
    await require_admin(request)
    now = datetime.now(timezone.utc)
    since_24h = (now - timedelta(hours=24)).isoformat()
    since_1h_ts = time.time() - 3600

    frontend_errors = await db.frontend_errors.find({"created_at": {"$gte": since_24h}}, {"_id": 0}).sort("created_at", -1).limit(60).to_list(60)
    probes = await db.monitoring_probes.find({}, {"_id": 0}).to_list(50)
    incidents = await db.monitoring_incidents.find({"created_at": {"$gte": since_24h}}, {"_id": 0}).sort("created_at", -1).limit(80).to_list(80)

    api_errors_1h = [e for e in _metrics["errors"] if e["ts"] >= since_1h_ts]
    auth_errors_1h = [e for e in api_errors_1h if "/api/auth/login" in e["path"] or "/api/auth/register" in e["path"]]

    page_counts = defaultdict(int)
    for item in frontend_errors:
        page_counts[item.get("page") or "unknown"] += 1
    top_pages = sorted(page_counts.items(), key=lambda x: -x[1])[:8]

    alerts = []
    for probe in probes:
      if probe.get("status") != "ok":
        alerts.append({
            "type": "probe",
            "label": probe.get("label"),
            "key": probe.get("key"),
            "severity": "critical" if probe.get("status") == "critical" else "warning",
            "message": probe.get("error_message") or f"Status {probe.get('status_code')}",
            "updated_at": probe.get("checked_at"),
        })
    if len(auth_errors_1h) >= 8:
        alerts.append({"type": "auth", "label": "Viele Login-/Registrierungsfehler", "key": "auth-spike", "severity": _severity_from_count(len(auth_errors_1h)), "message": f"{len(auth_errors_1h)} Auth-Fehler in 1h", "updated_at": now.isoformat()})
    if len(frontend_errors) >= 10:
        alerts.append({"type": "frontend", "label": "Viele Frontend-Fehler", "key": "frontend-spike", "severity": _severity_from_count(len(frontend_errors)), "message": f"{len(frontend_errors)} Frontend-Fehler in 24h", "updated_at": now.isoformat()})

    await _ensure_critical_alert_notifications(alerts)
    daily_report = await _maybe_create_daily_report_notification()

    overall_status = "ok"
    if any(a["severity"] == "critical" for a in alerts):
        overall_status = "critical"
    elif alerts:
        overall_status = "warning"

    return {
        "overall_status": overall_status,
        "summary": {
            "open_alerts": len(alerts),
            "frontend_errors_24h": len(frontend_errors),
            "api_errors_1h": len(api_errors_1h),
            "auth_errors_1h": len(auth_errors_1h),
            "incidents_24h": len(incidents),
        },
        "alerts": alerts[:20],
        "probes": sorted(probes, key=lambda p: p.get("label", "")),
        "top_error_pages": [{"page": page, "count": count} for page, count in top_pages],
        "frontend_errors": frontend_errors,
        "incidents": incidents,
        "daily_report": daily_report,
        "checked_at": now.isoformat(),
    }


@router.post("/run-probes")
async def run_probes(request: Request):
    await require_admin(request)
    results = []
    for flow in MONITORED_FLOWS:
        results.append(await _run_probe(flow))
    await _store_probe_results(results)
    return {
        "ok": True,
        "results": results,
        "critical": len([r for r in results if r["status"] == "critical"]),
        "warning": len([r for r in results if r["status"] == "warning"]),
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
