import os
from datetime import datetime, timezone
from typing import Any, Literal, Optional
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from core.database import db
from core.rate_limit import RATE_ADMIN_ACTION, limiter
from core.security import get_current_user
from services.visual_qa_ai import VisualQaAiError, review_screenshot, validate_product_images

router = APIRouter(prefix="/api/visual-qa", tags=["visual-qa"])

_STATUS_CHOICES = ["New", "Confirmed", "Repair prepared", "Pull request open", "Approved", "Fixed", "Rejected", "False positive"]


class VisualQaIssueIn(BaseModel):
    issue_id: str = Field(default_factory=lambda: f"VQI-{uuid4().hex[:12].upper()}")
    severity: Literal["critical", "high", "medium", "low"]
    category: str
    route: str
    viewport: str
    status: str = "New"
    problem: str
    affected_component: str = ""
    suggested_fix: str = ""
    confidence: float = 0.0
    safe_to_auto_fix: bool = False
    source_file: str = ""
    visual_coordinates: dict[str, Any] = Field(default_factory=dict)
    before_screenshot: str = ""
    after_screenshot: str = ""
    repair_pr_link: str = ""
    risk_level: str = "low"


class VisualQaRunUpload(BaseModel):
    run_id: str = Field(default_factory=lambda: f"VQR-{uuid4().hex[:12].upper()}")
    source: str = "github-actions"
    branch: str = ""
    commit_hash: str = ""
    workflow_name: str = "visual-qa"
    target_base_url: str = ""
    pages_scanned: int = 0
    passed: int = 0
    failed: int = 0
    critical_issues: int = 0
    warnings: int = 0
    viewports: list[str] = Field(default_factory=list)
    routes: list[str] = Field(default_factory=list)
    status: str = "completed"
    generated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    screenshots_artifact_url: str = ""
    issues: list[VisualQaIssueIn] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)


class ScreenshotReviewRequest(BaseModel):
    screenshot_base64: str
    route: str
    viewport: str
    language: str = "de"
    role: str = "guest"
    page_data: dict[str, Any] = Field(default_factory=dict)
    design_tokens: dict[str, Any] = Field(default_factory=dict)


class ProductImageValidationRequest(BaseModel):
    products: list[dict[str, Any]]


async def _require_admin(request: Request):
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin Zugriff erforderlich")
    return user


def _valid_report_token(request: Request) -> bool:
    expected = os.environ.get("VISUAL_QA_REPORT_TOKEN", "").strip()
    provided = request.headers.get("x-visual-qa-token", "").strip()
    return bool(expected and provided and expected == provided)


async def _allow_admin_or_token(request: Request):
    if _valid_report_token(request):
        return {"role": "qa-bot", "email": "qa-bot@system.local"}
    return await _require_admin(request)


@router.get("/dashboard")
async def get_visual_qa_dashboard(request: Request):
    await _require_admin(request)
    latest_run = await db.visual_qa_runs.find_one({}, {"_id": 0}, sort=[("generated_at", -1)]) or {}
    issues = await db.visual_qa_issues.find({}, {"_id": 0}).sort("created_at", -1).limit(500).to_list(500)
    history = await db.visual_qa_runs.find({}, {"_id": 0}).sort("generated_at", -1).limit(50).to_list(50)
    status_counts: dict[str, int] = {}
    for item in issues:
        status_counts[item.get("status", "New")] = status_counts.get(item.get("status", "New"), 0) + 1
    return {
        "last_scan": latest_run,
        "pages_scanned": latest_run.get("pages_scanned", 0),
        "passed": latest_run.get("passed", 0),
        "failed": latest_run.get("failed", 0),
        "critical_issues": latest_run.get("critical_issues", 0),
        "warnings": latest_run.get("warnings", 0),
        "issues": issues,
        "history": history,
        "status_choices": _STATUS_CHOICES,
        "status_counts": status_counts,
    }


@router.get("/issues")
async def get_visual_qa_issues(request: Request, status: Optional[str] = None, severity: Optional[str] = None):
    await _require_admin(request)
    query: dict[str, Any] = {}
    if status:
        query["status"] = status
    if severity:
        query["severity"] = severity
    issues = await db.visual_qa_issues.find(query, {"_id": 0}).sort([("created_at", -1), ("severity", 1)]).to_list(1000)
    return {"issues": issues}


@router.get("/runs")
async def get_visual_qa_runs(request: Request):
    await _require_admin(request)
    runs = await db.visual_qa_runs.find({}, {"_id": 0}).sort("generated_at", -1).to_list(200)
    return {"runs": runs}


@router.post("/report")
@limiter.limit(RATE_ADMIN_ACTION)
async def upload_visual_qa_report(request: Request, payload: VisualQaRunUpload):
    actor = await _allow_admin_or_token(request)
    run_doc = payload.model_dump()
    run_doc["uploaded_at"] = datetime.now(timezone.utc).isoformat()
    await db.visual_qa_runs.update_one({"run_id": payload.run_id}, {"$set": run_doc}, upsert=True)

    for issue in payload.issues:
      issue_doc = issue.model_dump()
      issue_doc.setdefault("created_at", datetime.now(timezone.utc).isoformat())
      issue_doc["run_id"] = payload.run_id
      issue_doc["commit_hash"] = payload.commit_hash
      issue_doc["branch"] = payload.branch
      await db.visual_qa_issues.update_one({"issue_id": issue_doc["issue_id"]}, {"$set": issue_doc}, upsert=True)

    try:
        from routes.master_roadmap import sync_visual_qa_issues_to_master_roadmap

        await sync_visual_qa_issues_to_master_roadmap(
            [issue.model_dump() for issue in payload.issues],
            commit_hash=payload.commit_hash,
            branch=payload.branch,
        )
    except Exception:
        # Visual-QA-Upload darf nicht scheitern, wenn die Roadmap-Synchronisierung nur ergänzend fehlschlägt.
        pass

    return {"success": True, "run_id": payload.run_id, "uploaded_by": actor.get("email", "qa-bot")}


@router.post("/ai-review")
@limiter.limit(RATE_ADMIN_ACTION)
async def ai_screenshot_review(request: Request, payload: ScreenshotReviewRequest):
    await _allow_admin_or_token(request)
    try:
        result = await review_screenshot(payload.model_dump())
        return result
    except VisualQaAiError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/product-image-validate")
@limiter.limit(RATE_ADMIN_ACTION)
async def product_image_validate(request: Request, payload: ProductImageValidationRequest):
    await _allow_admin_or_token(request)
    try:
        results = await validate_product_images(payload.products)
        return {"results": results}
    except VisualQaAiError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.patch("/issues/{issue_id}/status")
@limiter.limit(RATE_ADMIN_ACTION)
async def update_visual_qa_issue_status(issue_id: str, request: Request, status: str):
    await _require_admin(request)
    if status not in _STATUS_CHOICES:
        raise HTTPException(status_code=400, detail="Ungültiger Status")
    result = await db.visual_qa_issues.update_one({"issue_id": issue_id}, {"$set": {"status": status, "updated_at": datetime.now(timezone.utc).isoformat()}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Issue nicht gefunden")
    return {"success": True}