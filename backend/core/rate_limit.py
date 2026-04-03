"""
BidBlitz V2 - Rate Limiting Configuration
All rate limits in one place. Format: "count/period" (e.g. "5/minute")
"""

from slowapi import Limiter
from starlette.requests import Request


def _get_real_ip(request: Request) -> str:
    """Extract real client IP behind reverse proxies."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()
    return request.client.host if request.client else "127.0.0.1"


limiter = Limiter(key_func=_get_real_ip)

# ── Configurable Limits ──
RATE_REGISTER      = "5/minute"
RATE_LOGIN         = "10/minute"
RATE_PASSWORD      = "5/minute"
RATE_PAYMENT       = "20/minute"
RATE_PAYOUT        = "5/minute"
RATE_STRIPE        = "10/minute"
RATE_ADMIN_ACTION  = "15/minute"
