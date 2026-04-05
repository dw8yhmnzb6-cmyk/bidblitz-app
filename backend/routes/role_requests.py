"""
BidBlitz V2 — Role Request & Admin Approval System
Users can request roles (merchant, influencer, manager, investor).
Admin approves/rejects and assigns final role.
"""
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from core.database import db

router = APIRouter(prefix="/api/role-requests", tags=["RoleRequests"])
logger = logging.getLogger("bidblitz.role_requests")


async def get_current_user(request: Request):
    from routes.auth import get_current_user as auth_user
    return await auth_user(request)


VALID_ROLES = {"customer", "merchant", "influencer", "manager", "investor"}


# ══════════════════════════════════════
# USER: Request a role
# ══════════════════════════════════════

class RoleRequestBody(BaseModel):
    requested_role: str


@router.post("/request")
async def request_role(req: RoleRequestBody, request: Request):
    """User requests a role upgrade."""
    user = await get_current_user(request)
    uid = str(user["_id"])

    if req.requested_role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail="Invalid role")

    if req.requested_role == "customer":
        raise HTTPException(status_code=400, detail="Already a customer")

    # Check if pending request exists
    existing = await db.role_requests.find_one(
        {"user_id": uid, "status": "pending"}
    )
    if existing:
        raise HTTPException(status_code=400, detail="You already have a pending request")

    doc = {
        "user_id": uid,
        "user_email": user.get("email", ""),
        "user_name": user.get("name", ""),
        "current_role": user.get("role", "user"),
        "requested_role": req.requested_role,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.role_requests.insert_one(doc)
    doc.pop("_id", None)
    return {"ok": True, "request": doc}


@router.get("/my-status")
async def get_my_role_status(request: Request):
    """Get current user's role request status."""
    user = await get_current_user(request)
    uid = str(user["_id"])
    reqs = await db.role_requests.find(
        {"user_id": uid}, {"_id": 0}
    ).sort("created_at", -1).to_list(10)
    return {
        "current_role": user.get("role", "user"),
        "requests": reqs,
    }


# ══════════════════════════════════════
# ADMIN: Manage role requests
# ══════════════════════════════════════

@router.get("/admin/list")
async def admin_list_requests(request: Request, status: str = "pending"):
    """Admin: list role requests by status."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    query = {}
    if status != "all":
        query["status"] = status
    reqs = await db.role_requests.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return {"requests": reqs, "total": len(reqs)}


class AdminDecisionBody(BaseModel):
    user_id: str
    decision: str  # "approve" or "reject"
    assigned_role: Optional[str] = None


@router.post("/admin/decide")
async def admin_decide(req: AdminDecisionBody, request: Request):
    """Admin approves or rejects a role request."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")

    if req.decision not in ("approve", "reject"):
        raise HTTPException(status_code=400, detail="Decision must be 'approve' or 'reject'")

    # Find pending request
    pending = await db.role_requests.find_one(
        {"user_id": req.user_id, "status": "pending"}
    )
    if not pending:
        raise HTTPException(status_code=404, detail="No pending request found")

    now = datetime.now(timezone.utc).isoformat()

    if req.decision == "approve":
        final_role = req.assigned_role or pending.get("requested_role", "user")
        if final_role not in VALID_ROLES and final_role != "admin":
            raise HTTPException(status_code=400, detail="Invalid role")
        # Update user role
        from bson import ObjectId
        await db.users.update_one(
            {"_id": ObjectId(req.user_id)},
            {"$set": {"role": final_role, "role_approved_at": now}},
        )
        await db.role_requests.update_one(
            {"user_id": req.user_id, "status": "pending"},
            {"$set": {"status": "approved", "assigned_role": final_role, "decided_at": now, "decided_by": str(user["_id"])}},
        )
        return {"ok": True, "decision": "approved", "role": final_role}
    else:
        await db.role_requests.update_one(
            {"user_id": req.user_id, "status": "pending"},
            {"$set": {"status": "rejected", "decided_at": now, "decided_by": str(user["_id"])}},
        )
        return {"ok": True, "decision": "rejected"}


class AdminChangeRoleBody(BaseModel):
    user_id: str
    new_role: str


@router.post("/admin/change-role")
async def admin_change_role(req: AdminChangeRoleBody, request: Request):
    """Admin directly changes a user's role."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")

    if req.new_role not in VALID_ROLES and req.new_role != "admin":
        raise HTTPException(status_code=400, detail="Invalid role")

    from bson import ObjectId
    result = await db.users.update_one(
        {"_id": ObjectId(req.user_id)},
        {"$set": {"role": req.new_role, "role_changed_at": datetime.now(timezone.utc).isoformat()}},
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"ok": True, "new_role": req.new_role}
