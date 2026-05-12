"""
BidBlitz Staff - Rate Limit Helper (In-Memory)
================================================
Simple in-process rate limiting für Endpoints ohne Redis-Dependency.
Production: Replace with Redis-backed slowapi.
"""
import time
from collections import defaultdict
from typing import Tuple
from fastapi import HTTPException, Request

# (key, window_start_ts) -> count
_buckets: dict = defaultdict(lambda: {"count": 0, "reset": 0, "locked_until": 0})


def check_rate_limit(key: str, max_attempts: int, window_sec: int, lockout_sec: int = 0) -> Tuple[bool, int]:
    """
    Returns (allowed, retry_after_sec).
    After max_attempts in window_sec, returns False and lockout_sec retry.
    """
    now = time.time()
    bucket = _buckets[key]

    # Active lockout?
    if bucket["locked_until"] > now:
        return False, int(bucket["locked_until"] - now)

    # Window expired? reset
    if bucket["reset"] < now:
        bucket["count"] = 0
        bucket["reset"] = now + window_sec

    bucket["count"] += 1

    if bucket["count"] > max_attempts:
        if lockout_sec > 0:
            bucket["locked_until"] = now + lockout_sec
            return False, lockout_sec
        return False, int(bucket["reset"] - now)

    return True, 0


def reset_rate_limit(key: str):
    """Reset on successful auth"""
    _buckets.pop(key, None)


def client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for", "")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def enforce_rate_limit(request: Request, key_suffix: str, max_attempts: int = 5, window_sec: int = 300, lockout_sec: int = 900):
    """FastAPI Helper: raises 429 if limit exceeded."""
    ip = client_ip(request)
    key = f"{key_suffix}:{ip}"
    allowed, retry = check_rate_limit(key, max_attempts, window_sec, lockout_sec)
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail={
                "code": "rate_limit_exceeded",
                "message": f"Zu viele Versuche. Bitte in {retry} Sekunden erneut versuchen.",
                "retry_after_sec": retry,
            },
            headers={"Retry-After": str(retry)},
        )
    return key  # for reset on success
