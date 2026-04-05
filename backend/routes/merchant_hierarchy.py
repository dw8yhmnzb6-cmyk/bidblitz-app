"""
BidBlitz V2 — Merchant Hierarchy System
Main merchant → Branches → Staff → Registers/POS with API keys.
Commission system 0.5%–3% per merchant.
"""
import secrets
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from bson import ObjectId
from core.database import db

router = APIRouter(prefix="/api/merchant-hierarchy", tags=["MerchantHierarchy"])
logger = logging.getLogger("bidblitz.merchant_hierarchy")

STAFF_ROLES = {"merchant_owner", "branch_admin", "cashier", "staff"}
DEFAULT_COMMISSION = 1.5  # percent


async def get_current_user(request: Request):
    from routes.auth import get_current_user as auth_user
    return await auth_user(request)


def gen_api_key():
    return f"blz_live_{secrets.token_hex(24)}"


def gen_device_id():
    return f"DEV-{secrets.token_hex(4).upper()}"


# ══════════════════════════════════════
# ADMIN: Merchant Management
# ══════════════════════════════════════

class CreateMerchantBody(BaseModel):
    user_id: str
    business_name: str
    commission_rate: Optional[float] = None


@router.post("/admin/create-merchant")
async def admin_create_merchant(req: CreateMerchantBody, request: Request):
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")

    existing = await db.merchant_profiles.find_one({"user_id": req.user_id})
    if existing:
        raise HTTPException(status_code=400, detail="Merchant profile already exists")

    rate = req.commission_rate if req.commission_rate is not None else DEFAULT_COMMISSION
    if rate < 0.5 or rate > 3.0:
        raise HTTPException(status_code=400, detail="Commission rate must be 0.5%–3%")

    doc = {
        "user_id": req.user_id,
        "business_name": req.business_name,
        "commission_rate": rate,
        "status": "active",
        "total_revenue": 0.0,
        "total_fees": 0.0,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    result = await db.merchant_profiles.insert_one(doc)
    mid = str(result.inserted_id)

    await db.users.update_one({"_id": ObjectId(req.user_id)}, {"$set": {"role": "merchant", "merchant_id": mid}})
    doc["merchant_id"] = mid
    doc.pop("_id", None)
    return {"ok": True, "merchant": doc}


@router.get("/admin/merchants")
async def admin_list_merchants(request: Request):
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    merchants = []
    async for m in db.merchant_profiles.find({}).sort("created_at", -1):
        m["merchant_id"] = str(m.pop("_id"))
        merchants.append(m)
    return {"merchants": merchants, "total": len(merchants)}


class SetCommissionBody(BaseModel):
    merchant_id: str
    commission_rate: float


@router.post("/admin/set-commission")
async def admin_set_commission(req: SetCommissionBody, request: Request):
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    if req.commission_rate < 0.5 or req.commission_rate > 3.0:
        raise HTTPException(status_code=400, detail="Rate must be 0.5%–3%")
    result = await db.merchant_profiles.update_one(
        {"_id": ObjectId(req.merchant_id)},
        {"$set": {"commission_rate": req.commission_rate}},
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Merchant not found")
    return {"ok": True, "commission_rate": req.commission_rate}


# ══════════════════════════════════════
# BRANCHES
# ══════════════════════════════════════

class CreateBranchBody(BaseModel):
    name: str
    address: str
    city: str
    country: str
    contact_person: Optional[str] = ""


async def get_merchant_profile(user):
    """Get merchant profile for current user (owner or admin)."""
    uid = str(user["_id"])
    mp = await db.merchant_profiles.find_one({"user_id": uid})
    if not mp:
        raise HTTPException(status_code=403, detail="No merchant profile")
    return mp


@router.post("/branches")
async def create_branch(req: CreateBranchBody, request: Request):
    user = await get_current_user(request)
    mp = await get_merchant_profile(user)
    mid = str(mp["_id"])

    doc = {
        "merchant_id": mid,
        "name": req.name,
        "address": req.address,
        "city": req.city,
        "country": req.country,
        "contact_person": req.contact_person or "",
        "status": "active",
        "total_revenue": 0.0,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    result = await db.merchant_branches.insert_one(doc)
    doc["branch_id"] = str(result.inserted_id)
    doc.pop("_id", None)
    return {"ok": True, "branch": doc}


@router.get("/branches")
async def list_branches(request: Request):
    user = await get_current_user(request)
    uid = str(user["_id"])
    role = user.get("role", "user")

    if role == "admin":
        branches = []
        async for b in db.merchant_branches.find({}).sort("created_at", -1):
            b["branch_id"] = str(b.pop("_id"))
            branches.append(b)
        return {"branches": branches}

    mp = await db.merchant_profiles.find_one({"user_id": uid})
    if mp:
        mid = str(mp["_id"])
        branches = []
        async for b in db.merchant_branches.find({"merchant_id": mid}).sort("created_at", -1):
            b["branch_id"] = str(b.pop("_id"))
            branches.append(b)
        return {"branches": branches}

    # Branch admin - check staff assignment
    staff = await db.merchant_staff.find_one({"user_id": uid, "status": "active"})
    if staff and staff.get("staff_role") == "branch_admin":
        b = await db.merchant_branches.find_one({"_id": ObjectId(staff["branch_id"])})
        if b:
            b["branch_id"] = str(b.pop("_id"))
            return {"branches": [b]}

    return {"branches": []}


@router.get("/branches/{branch_id}")
async def get_branch(branch_id: str, request: Request):
    user = await get_current_user(request)
    b = await db.merchant_branches.find_one({"_id": ObjectId(branch_id)})
    if not b:
        raise HTTPException(status_code=404, detail="Branch not found")
    b["branch_id"] = str(b.pop("_id"))

    # Get registers and staff for this branch
    registers = []
    async for r in db.merchant_registers.find({"branch_id": branch_id}, {"_id": 0}):
        registers.append(r)

    staff_list = []
    async for s in db.merchant_staff.find({"branch_id": branch_id}, {"_id": 0}):
        staff_list.append(s)

    return {"branch": b, "registers": registers, "staff": staff_list}


# ══════════════════════════════════════
# REGISTERS / POS DEVICES
# ══════════════════════════════════════

class CreateRegisterBody(BaseModel):
    branch_id: str
    label: Optional[str] = ""


@router.post("/registers")
async def create_register(req: CreateRegisterBody, request: Request):
    user = await get_current_user(request)
    uid = str(user["_id"])

    branch = await db.merchant_branches.find_one({"_id": ObjectId(req.branch_id)})
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")

    api_key = gen_api_key()
    device_id = gen_device_id()

    doc = {
        "branch_id": req.branch_id,
        "merchant_id": branch["merchant_id"],
        "device_id": device_id,
        "api_key": api_key,
        "label": req.label or f"Register {device_id}",
        "status": "active",
        "last_active": None,
        "total_revenue": 0.0,
        "transaction_count": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": uid,
    }
    await db.merchant_registers.insert_one(doc)
    doc.pop("_id", None)
    return {"ok": True, "register": doc}


@router.get("/registers")
async def list_registers(request: Request, branch_id: str = ""):
    user = await get_current_user(request)
    uid = str(user["_id"])

    query = {}
    if branch_id:
        query["branch_id"] = branch_id
    else:
        mp = await db.merchant_profiles.find_one({"user_id": uid})
        if mp:
            query["merchant_id"] = str(mp["_id"])

    registers = []
    async for r in db.merchant_registers.find(query, {"_id": 0}).sort("created_at", -1):
        registers.append(r)
    return {"registers": registers}


@router.post("/registers/{device_id}/toggle")
async def toggle_register(device_id: str, request: Request):
    user = await get_current_user(request)
    reg = await db.merchant_registers.find_one({"device_id": device_id})
    if not reg:
        raise HTTPException(status_code=404, detail="Register not found")
    new_status = "inactive" if reg["status"] == "active" else "active"
    await db.merchant_registers.update_one(
        {"device_id": device_id},
        {"$set": {"status": new_status}},
    )
    return {"ok": True, "status": new_status}


@router.post("/registers/{device_id}/regenerate-key")
async def regenerate_api_key(device_id: str, request: Request):
    user = await get_current_user(request)
    new_key = gen_api_key()
    result = await db.merchant_registers.update_one(
        {"device_id": device_id},
        {"$set": {"api_key": new_key}},
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Register not found")
    return {"ok": True, "api_key": new_key}


# ══════════════════════════════════════
# STAFF
# ══════════════════════════════════════

class AddStaffBody(BaseModel):
    branch_id: str
    user_email: str
    staff_role: str  # branch_admin, cashier, staff


@router.post("/staff")
async def add_staff(req: AddStaffBody, request: Request):
    user = await get_current_user(request)
    if req.staff_role not in STAFF_ROLES:
        raise HTTPException(status_code=400, detail="Invalid staff role")

    target = await db.users.find_one({"email": req.user_email})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    branch = await db.merchant_branches.find_one({"_id": ObjectId(req.branch_id)})
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")

    doc = {
        "branch_id": req.branch_id,
        "merchant_id": branch["merchant_id"],
        "user_id": str(target["_id"]),
        "user_email": req.user_email,
        "user_name": target.get("name", ""),
        "staff_role": req.staff_role,
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.merchant_staff.insert_one(doc)
    doc.pop("_id", None)
    return {"ok": True, "staff": doc}


@router.get("/staff")
async def list_staff(request: Request, branch_id: str = ""):
    user = await get_current_user(request)
    query = {}
    if branch_id:
        query["branch_id"] = branch_id
    staff_list = []
    async for s in db.merchant_staff.find(query, {"_id": 0}).sort("created_at", -1):
        staff_list.append(s)
    return {"staff": staff_list}


@router.post("/staff/{user_id}/remove")
async def remove_staff(user_id: str, request: Request):
    user = await get_current_user(request)
    result = await db.merchant_staff.update_one(
        {"user_id": user_id, "status": "active"},
        {"$set": {"status": "removed"}},
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Staff not found")
    return {"ok": True}


# ══════════════════════════════════════
# POS API: Transaction Processing (via API key)
# ══════════════════════════════════════

@router.post("/api/process-payment")
async def process_pos_payment(request: Request):
    """Process a payment via POS register API key."""
    api_key = request.headers.get("X-API-Key", "")
    if not api_key:
        raise HTTPException(status_code=401, detail="API key required")

    reg = await db.merchant_registers.find_one({"api_key": api_key, "status": "active"})
    if not reg:
        raise HTTPException(status_code=401, detail="Invalid or inactive API key")

    body = await request.json()
    amount = body.get("amount", 0)
    description = body.get("description", "POS Payment")
    customer_ref = body.get("customer_ref", "")

    if amount <= 0:
        raise HTTPException(status_code=400, detail="Invalid amount")

    mp = await db.merchant_profiles.find_one({"_id": ObjectId(reg["merchant_id"])})
    commission_rate = mp.get("commission_rate", DEFAULT_COMMISSION) if mp else DEFAULT_COMMISSION
    fee = round(amount * (commission_rate / 100), 2)
    net = round(amount - fee, 2)

    now = datetime.now(timezone.utc).isoformat()
    txn = {
        "merchant_id": reg["merchant_id"],
        "branch_id": reg["branch_id"],
        "device_id": reg["device_id"],
        "amount": amount,
        "fee": fee,
        "net": net,
        "commission_rate": commission_rate,
        "description": description,
        "customer_ref": customer_ref,
        "status": "completed",
        "created_at": now,
    }
    result = await db.merchant_transactions.insert_one(txn)
    txn_id = str(result.inserted_id)

    # Update counters
    await db.merchant_registers.update_one(
        {"device_id": reg["device_id"]},
        {"$inc": {"total_revenue": amount, "transaction_count": 1}, "$set": {"last_active": now}},
    )
    await db.merchant_branches.update_one(
        {"_id": ObjectId(reg["branch_id"])},
        {"$inc": {"total_revenue": amount}},
    )
    await db.merchant_profiles.update_one(
        {"_id": ObjectId(reg["merchant_id"])},
        {"$inc": {"total_revenue": amount, "total_fees": fee}},
    )

    return {"ok": True, "transaction_id": txn_id, "amount": amount, "fee": fee, "net": net}


# ══════════════════════════════════════
# REVENUE / REPORTING
# ══════════════════════════════════════

@router.get("/revenue")
async def get_revenue(request: Request, branch_id: str = "", device_id: str = ""):
    """Get revenue summary — scoped by user's access level."""
    user = await get_current_user(request)
    uid = str(user["_id"])
    role = user.get("role", "user")

    if role == "admin":
        query = {}
    else:
        mp = await db.merchant_profiles.find_one({"user_id": uid})
        if mp:
            query = {"merchant_id": str(mp["_id"])}
        else:
            staff = await db.merchant_staff.find_one({"user_id": uid, "status": "active"})
            if not staff:
                raise HTTPException(status_code=403, detail="No access")
            if staff["staff_role"] == "branch_admin":
                query = {"branch_id": staff["branch_id"]}
            elif staff["staff_role"] == "cashier":
                assigned_reg = await db.merchant_registers.find_one({"branch_id": staff["branch_id"]})
                query = {"device_id": assigned_reg["device_id"]} if assigned_reg else {"device_id": "none"}
            else:
                query = {"branch_id": staff["branch_id"]}

    if branch_id:
        query["branch_id"] = branch_id
    if device_id:
        query["device_id"] = device_id

    txns = await db.merchant_transactions.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    total_rev = sum(t.get("amount", 0) for t in txns)
    total_fees = sum(t.get("fee", 0) for t in txns)
    total_net = sum(t.get("net", 0) for t in txns)

    # Register status
    reg_query = {k: v for k, v in query.items() if k in ("merchant_id", "branch_id", "device_id")}
    registers = []
    async for r in db.merchant_registers.find(reg_query or {}, {"_id": 0}):
        registers.append(r)

    return {
        "transactions": txns[:50],
        "total_transactions": len(txns),
        "total_revenue": round(total_rev, 2),
        "total_fees": round(total_fees, 2),
        "total_net": round(total_net, 2),
        "registers": registers,
    }
