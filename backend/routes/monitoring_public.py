from datetime import datetime, timezone
from fastapi import APIRouter, Request
from pydantic import BaseModel, Field
import json

from core.database import db
from routes.monitoring import _metrics
from core.rate_limit import limiter

router = APIRouter(prefix="/api/monitoring", tags=["monitoring-public"])


class FrontendErrorLogRequest(BaseModel):
    message: str = Field(default="", max_length=1000)
    page: str = Field(default="", max_length=500)
    stack: str = Field(default="", max_length=4000)
    component_stack: str = Field(default="", max_length=4000)
    level: str = Field(default="error", max_length=32)
    meta: dict = Field(default_factory=dict)


@router.post("/log-error")
@limiter.limit("20/minute")
async def log_frontend_error_public(payload: FrontendErrorLogRequest, request: Request):
    try:
        meta_json = json.dumps(payload.meta or {}, ensure_ascii=False, default=str)
    except Exception:
        meta_json = "{}"
    safe_meta = payload.meta or {}
    if len(meta_json.encode("utf-8")) > 4096:
        safe_meta = {"truncated": True, "original_size": len(meta_json.encode("utf-8"))}

    doc = {
        "message": payload.message[:1000],
        "page": payload.page or (payload.meta or {}).get("path") or "",
        "stack": payload.stack[:4000],
        "component_stack": payload.component_stack[:4000],
        "level": payload.level or "error",
        "meta": safe_meta,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "source": "public-client",
    }
    await db.frontend_errors.insert_one(doc)
    _metrics["errors"].append({
        "path": doc["page"] or "/frontend",
        "method": "CLIENT",
        "status": 500,
        "duration_ms": 0,
        "ts": datetime.now(timezone.utc).timestamp(),
    })
    return {"ok": True}