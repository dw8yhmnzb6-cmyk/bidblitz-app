from datetime import datetime, timezone
from fastapi import APIRouter, Request
from pydantic import BaseModel

from core.database import db
from routes.monitoring import _metrics

router = APIRouter(prefix="/api/monitoring", tags=["monitoring-public"])


class FrontendErrorLogRequest(BaseModel):
    message: str = ""
    page: str = ""
    stack: str = ""
    component_stack: str = ""
    level: str = "error"
    meta: dict = {}


@router.post("/log-error")
async def log_frontend_error_public(payload: FrontendErrorLogRequest, request: Request):
    doc = {
        "message": payload.message[:1000],
        "page": payload.page or (payload.meta or {}).get("path") or "",
        "stack": payload.stack[:4000],
        "component_stack": payload.component_stack[:4000],
        "level": payload.level or "error",
        "meta": payload.meta or {},
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