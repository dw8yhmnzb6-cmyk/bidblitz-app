"""
Middleware Configuration
CORS, Request Logging, Error Handling
"""

import json
import logging
import time
import traceback
from fastapi import Request
from fastapi.responses import JSONResponse, Response
from starlette.middleware.cors import CORSMiddleware

from core.config import IS_PRODUCTION, CORS_ORIGINS

logger = logging.getLogger("bidblitz")
access_logger = logging.getLogger("bidblitz.access")


def _is_unbacked_legacy_payout_process(path: str, method: str, body: bytes, *, is_production: bool = IS_PRODUCTION) -> bool:
    """Block the legacy admin 'process' action from claiming a real payout in production.

    The legacy payout route only changes MongoDB status/balance fields; it does not
    execute or verify a bank/provider transfer. Until a provider-backed processor is
    wired in, production must fail closed instead of recording a payout as processed.
    """
    if not is_production or method.upper() != "POST":
        return False
    if not (path.startswith("/api/admin/payouts/") and path.endswith("/action")):
        return False
    try:
        payload = json.loads(body or b"{}")
    except (TypeError, ValueError, json.JSONDecodeError):
        return False
    return payload.get("action") == "process"


def setup_middleware(app):
    """Configure all middleware for the FastAPI app"""

    def allowed_origin(origin: str) -> str:
        if origin and "*" in CORS_ORIGINS:
            return origin
        if origin and origin in CORS_ORIGINS:
            return origin
        if CORS_ORIGINS and CORS_ORIGINS[0] != "*":
            return CORS_ORIGINS[0]
        return ""

    @app.middleware("http")
    async def legacy_payout_process_guard(request: Request, call_next):
        path = request.url.path
        if IS_PRODUCTION and request.method == "POST" and path.startswith("/api/admin/payouts/") and path.endswith("/action"):
            body = await request.body()
            if _is_unbacked_legacy_payout_process(path, request.method, body, is_production=True):
                logger.error(
                    "Blocked legacy payout processing without provider proof: %s",
                    path,
                )
                return JSONResponse(
                    status_code=503,
                    content={
                        "detail": "Payout processing is unavailable until a provider-backed transfer is configured. The payout remains approved.",
                        "code": "payout_provider_not_configured",
                    },
                )

            # Reading the body in middleware consumes the ASGI receive channel. Replay
            # it so safe actions such as approve/fail/cancel keep their existing body.
            replayed = False

            async def receive():
                nonlocal replayed
                if replayed:
                    return {"type": "http.request", "body": b"", "more_body": False}
                replayed = True
                return {"type": "http.request", "body": body, "more_body": False}

            request._receive = receive

        return await call_next(request)

    @app.middleware("http")
    async def credentialed_options_guard(request: Request, call_next):
        if request.method == "OPTIONS" and request.url.path.startswith("/api/"):
            origin = allowed_origin(request.headers.get("origin", ""))
            headers = {
                "Access-Control-Allow-Methods": request.headers.get("access-control-request-method", "GET,POST,PUT,PATCH,DELETE,OPTIONS"),
                "Access-Control-Allow-Headers": request.headers.get("access-control-request-headers", "authorization,content-type"),
                "Access-Control-Allow-Credentials": "true",
                "Access-Control-Max-Age": "600",
                "Vary": "Origin",
            }
            if origin:
                headers["Access-Control-Allow-Origin"] = origin
            return Response(status_code=204, headers=headers)
        response = await call_next(request)
        origin = allowed_origin(request.headers.get("origin", ""))
        if origin:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
            response.headers["Vary"] = "Origin"
        return response
    
    # ── CORS Middleware ──
    app.add_middleware(
        CORSMiddleware,
        allow_origins=CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # ── Request Logging Middleware ──
    # Import monitoring recorder (optional)
    try:
        from routes.monitoring import record_request as _record_req
    except ImportError:
        _record_req = None
    
    @app.middleware("http")
    async def log_requests(request: Request, call_next):
        """Log all HTTP requests with timing and status"""
        start = time.time()
        response = await call_next(request)
        duration = round((time.time() - start) * 1000)
        
        # Log errors
        if response.status_code >= 400:
            access_logger.info(
                f"{request.method} {request.url.path} → {response.status_code} ({duration}ms)"
            )
        if response.status_code >= 500:
            logger.error(
                f"5xx: {request.method} {request.url.path} → {response.status_code} ({duration}ms)"
            )
        
        # Record metrics (skip monitoring endpoint to avoid recursion)
        if _record_req and not request.url.path.startswith("/api/admin/monitoring"):
            try:
                _record_req(request.url.path, request.method, response.status_code, duration)
            except Exception:
                pass
        
        return response
    
    # ── Global Exception Handler ──
    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        """Catch-all error handler for unhandled exceptions"""
        logger.error(
            f"Unhandled error: {request.method} {request.url.path} | {exc}\n"
            f"{traceback.format_exc()}"
        )
        
        # Log to audit system
        try:
            from core.audit import log_audit
            await log_audit(
                "system_error",
                details={
                    "path": request.url.path,
                    "method": request.method,
                    "error": str(exc)[:500],
                },
                severity="error",
            )
        except Exception:
            pass
        
        return JSONResponse(
            status_code=500,
            content={
                "detail": "Internal server error" if IS_PRODUCTION else str(exc)
            },
        )
