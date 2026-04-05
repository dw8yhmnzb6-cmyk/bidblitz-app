"""
BidBlitz V2 — Merchant Hierarchy System
Main merchant → Branches → Staff → Registers/POS with API keys.
Commission system 0.5%–3% per merchant.
"""
import secrets
import logging
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional
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


# ══════════════════════════════════════
# REGISTER TRANSACTIONS (with date filter)
# ══════════════════════════════════════

@router.get("/register-transactions")
async def get_register_transactions(
    request: Request, device_id: str = "", branch_id: str = "", period: str = "today"
):
    """Transactions per register with date filter: today/week/month/all."""
    user = await get_current_user(request)
    uid = str(user["_id"])
    query = await _build_access_query(user, uid)

    if device_id:
        query["device_id"] = device_id
    if branch_id:
        query["branch_id"] = branch_id

    now = datetime.now(timezone.utc)
    if period == "today":
        cutoff = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        query["created_at"] = {"$gte": cutoff}
    elif period == "week":
        from datetime import timedelta
        cutoff = (now - timedelta(days=7)).isoformat()
        query["created_at"] = {"$gte": cutoff}
    elif period == "month":
        from datetime import timedelta
        cutoff = (now - timedelta(days=30)).isoformat()
        query["created_at"] = {"$gte": cutoff}

    txns = await db.merchant_transactions.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)
    total = sum(t.get("amount", 0) for t in txns)
    total_fees = sum(t.get("fee", 0) for t in txns)

    return {
        "transactions": txns,
        "count": len(txns),
        "total_amount": round(total, 2),
        "total_fees": round(total_fees, 2),
        "total_net": round(total - total_fees, 2),
        "period": period,
    }


async def _build_access_query(user, uid):
    role = user.get("role", "user")
    if role == "admin":
        return {}
    mp = await db.merchant_profiles.find_one({"user_id": uid})
    if mp:
        return {"merchant_id": str(mp["_id"])}
    staff = await db.merchant_staff.find_one({"user_id": uid, "status": "active"})
    if not staff:
        raise HTTPException(status_code=403, detail="No access")
    if staff["staff_role"] == "branch_admin":
        return {"branch_id": staff["branch_id"]}
    elif staff["staff_role"] == "cashier":
        reg = await db.merchant_registers.find_one({"branch_id": staff["branch_id"]})
        return {"device_id": reg["device_id"]} if reg else {"device_id": "none"}
    return {"branch_id": staff["branch_id"]}


# ══════════════════════════════════════
# BRANCH SUMMARY (compare all branches)
# ══════════════════════════════════════

@router.get("/branch-summary")
async def get_branch_summary(request: Request):
    """Summary for all branches: revenue, payment count, active registers."""
    user = await get_current_user(request)
    uid = str(user["_id"])
    query = await _build_access_query(user, uid)

    # Get merchant_id to filter branches
    mid = query.get("merchant_id")
    branch_query = {"merchant_id": mid} if mid else {}
    if "branch_id" in query:
        branch_query["_id"] = ObjectId(query["branch_id"])

    summaries = []
    async for b in db.merchant_branches.find(branch_query).sort("created_at", -1):
        bid = str(b["_id"])
        reg_count = await db.merchant_registers.count_documents({"branch_id": bid, "status": "active"})
        txn_count = await db.merchant_transactions.count_documents({"branch_id": bid})
        summaries.append({
            "branch_id": bid,
            "name": b.get("name", ""),
            "city": b.get("city", ""),
            "status": b.get("status", "active"),
            "total_revenue": b.get("total_revenue", 0),
            "active_registers": reg_count,
            "payment_count": txn_count,
        })

    return {"branches": summaries, "total_branches": len(summaries)}


# ══════════════════════════════════════
# COMMISSION SUMMARY
# ══════════════════════════════════════

@router.get("/commission-summary")
async def get_commission_summary(request: Request):
    """Commission breakdown per register, branch, and total."""
    user = await get_current_user(request)
    uid = str(user["_id"])
    role = user.get("role", "user")

    if role == "admin":
        # Admin sees all merchants
        merchants = []
        async for m in db.merchant_profiles.find({}).sort("created_at", -1):
            mid = str(m["_id"])
            txns = await db.merchant_transactions.find({"merchant_id": mid}, {"_id": 0, "fee": 1, "branch_id": 1, "device_id": 1}).to_list(500)
            total_fee = sum(t.get("fee", 0) for t in txns)

            # Per branch
            branch_fees = {}
            device_fees = {}
            for t in txns:
                br = t.get("branch_id", "")
                dv = t.get("device_id", "")
                branch_fees[br] = branch_fees.get(br, 0) + t.get("fee", 0)
                device_fees[dv] = device_fees.get(dv, 0) + t.get("fee", 0)

            merchants.append({
                "merchant_id": mid,
                "business_name": m.get("business_name", ""),
                "commission_rate": m.get("commission_rate", DEFAULT_COMMISSION),
                "total_commission": round(total_fee, 2),
                "total_revenue": m.get("total_revenue", 0),
                "branch_commissions": {k: round(v, 2) for k, v in branch_fees.items()},
                "register_commissions": {k: round(v, 2) for k, v in device_fees.items()},
            })
        return {"merchants": merchants}
    else:
        mp = await db.merchant_profiles.find_one({"user_id": uid})
        if not mp:
            raise HTTPException(status_code=403, detail="No merchant profile")
        mid = str(mp["_id"])
        txns = await db.merchant_transactions.find({"merchant_id": mid}, {"_id": 0, "fee": 1, "branch_id": 1, "device_id": 1}).to_list(500)
        total_fee = sum(t.get("fee", 0) for t in txns)
        branch_fees = {}
        device_fees = {}
        for t in txns:
            br = t.get("branch_id", "")
            dv = t.get("device_id", "")
            branch_fees[br] = branch_fees.get(br, 0) + t.get("fee", 0)
            device_fees[dv] = device_fees.get(dv, 0) + t.get("fee", 0)

        return {
            "commission_rate": mp.get("commission_rate", DEFAULT_COMMISSION),
            "total_commission": round(total_fee, 2),
            "total_revenue": mp.get("total_revenue", 0),
            "branch_commissions": {k: round(v, 2) for k, v in branch_fees.items()},
            "register_commissions": {k: round(v, 2) for k, v in device_fees.items()},
        }


# ══════════════════════════════════════
# API KEY MANAGEMENT (enhanced)
# ══════════════════════════════════════

@router.get("/api-keys")
async def list_api_keys(request: Request, branch_id: str = ""):
    """List all API keys with register/branch info."""
    user = await get_current_user(request)
    uid = str(user["_id"])
    query = {}

    mp = await db.merchant_profiles.find_one({"user_id": uid})
    if mp:
        query["merchant_id"] = str(mp["_id"])
    elif user.get("role") == "admin":
        pass
    else:
        raise HTTPException(status_code=403, detail="No access")

    if branch_id:
        query["branch_id"] = branch_id

    keys = []
    async for r in db.merchant_registers.find(query).sort("created_at", -1):
        branch = await db.merchant_branches.find_one({"_id": ObjectId(r["branch_id"])})
        keys.append({
            "device_id": r.get("device_id"),
            "api_key": r.get("api_key"),
            "label": r.get("label", ""),
            "status": r.get("status", "active"),
            "branch_id": r.get("branch_id"),
            "branch_name": branch.get("name", "") if branch else "",
            "last_active": r.get("last_active"),
            "transaction_count": r.get("transaction_count", 0),
            "total_revenue": r.get("total_revenue", 0),
            "created_at": r.get("created_at"),
        })

    return {"api_keys": keys, "total": len(keys)}


# ══════════════════════════════════════
# WALLET SYNC (for web-based payments)
# ══════════════════════════════════════

@router.get("/wallet-balance")
async def get_wallet_balance(request: Request):
    """Get user's wallet balance for in-app display."""
    user = await get_current_user(request)
    return {
        "balance": user.get("balance", 0),
        "bid_credits": user.get("bid_credits", 0),
        "currency": user.get("currency", "EUR"),
        "topup_url": "/wallet",
    }


# ══════════════════════════════════════
# SHIFT REPORTS
# ══════════════════════════════════════

class ShiftReport(BaseModel):
    branch_id: Optional[str] = ""
    register_id: Optional[str] = ""
    action: str  # "open" or "close"
    opening_balance: Optional[float] = 0
    notes: Optional[str] = ""

@router.post("/shifts")
async def manage_shift(req: ShiftReport, request: Request):
    """Open or close a cashier shift."""
    user = await get_current_user(request)
    uid = str(user["_id"])
    mp = await get_merchant_profile(user)
    mid = str(mp["_id"])
    now_iso = datetime.now(timezone.utc).isoformat()

    if req.action == "open":
        active = await db.shifts.find_one({"merchant_id": mid, "user_id": uid, "status": "open"})
        if active:
            raise HTTPException(status_code=400, detail="You already have an open shift")
        doc = {
            "merchant_id": mid, "user_id": uid, "user_name": user.get("name", ""),
            "branch_id": req.branch_id, "register_id": req.register_id,
            "opening_balance": req.opening_balance, "notes": req.notes,
            "status": "open", "opened_at": now_iso,
            "total_sales": 0, "total_refunds": 0, "transaction_count": 0,
        }
        result = await db.shifts.insert_one(doc)
        doc["id"] = str(result.inserted_id)
        doc.pop("_id", None)
        return {"ok": True, "shift": doc}

    elif req.action == "close":
        active = await db.shifts.find_one({"merchant_id": mid, "user_id": uid, "status": "open"})
        if not active:
            raise HTTPException(status_code=400, detail="No open shift found")

        # Calculate shift totals
        opened_at = active.get("opened_at", now_iso)
        txns = await db.merchant_transactions.find({
            "merchant_id": mid, "created_at": {"$gte": opened_at},
        }, {"_id": 0}).to_list(1000)

        total_sales = sum(t.get("amount", 0) for t in txns if t.get("status") == "completed")
        total_fees = sum(t.get("fee", 0) for t in txns if t.get("status") == "completed")
        refunds = sum(t.get("amount", 0) for t in txns if t.get("status") == "refunded")

        await db.shifts.update_one({"_id": active["_id"]}, {"$set": {
            "status": "closed", "closed_at": now_iso,
            "total_sales": round(total_sales, 2), "total_fees": round(total_fees, 2),
            "total_refunds": round(refunds, 2), "transaction_count": len(txns),
            "closing_notes": req.notes,
        }})

        shift_id = str(active["_id"])
        return {
            "ok": True, "shift_id": shift_id,
            "total_sales": round(total_sales, 2),
            "total_fees": round(total_fees, 2),
            "total_refunds": round(refunds, 2),
            "transaction_count": len(txns),
            "opened_at": opened_at, "closed_at": now_iso,
        }

    raise HTTPException(status_code=400, detail="Invalid action")


@router.get("/shifts")
async def get_shifts(request: Request):
    user = await get_current_user(request)
    uid = str(user["_id"])
    mp = await get_merchant_profile(user)
    mid = str(mp["_id"])

    shifts = await db.shifts.find(
        {"merchant_id": mid}, {"_id": 0}
    ).sort("opened_at", -1).limit(50).to_list(50)
    return {"shifts": shifts}


@router.get("/shifts/active")
async def get_active_shift(request: Request):
    user = await get_current_user(request)
    uid = str(user["_id"])
    mp = await get_merchant_profile(user)
    mid = str(mp["_id"])

    active = await db.shifts.find_one({"merchant_id": mid, "user_id": uid, "status": "open"}, {"_id": 0})
    return {"active_shift": active}


# ══════════════════════════════════════
# DAILY / MONTHLY REPORTS
# ══════════════════════════════════════

@router.get("/reports/daily")
async def get_daily_report(request: Request, date: Optional[str] = None):
    """Get daily report. date format: YYYY-MM-DD"""
    user = await get_current_user(request)
    uid = str(user["_id"])
    mp = await get_merchant_profile(user)
    mid = str(mp["_id"])

    now = datetime.now(timezone.utc)
    if date:
        try:
            day = datetime.strptime(date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    else:
        day = now.replace(hour=0, minute=0, second=0, microsecond=0)

    start = day.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    end = (day + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()

    txns = await db.merchant_transactions.find({
        "merchant_id": mid, "created_at": {"$gte": start, "$lt": end},
    }, {"_id": 0}).to_list(2000)

    completed = [t for t in txns if t.get("status") == "completed"]
    refunded = [t for t in txns if t.get("status") == "refunded"]

    method_breakdown = {}
    for t in completed:
        m = t.get("payment_method", "unknown")
        if m not in method_breakdown:
            method_breakdown[m] = {"count": 0, "amount": 0, "fees": 0}
        method_breakdown[m]["count"] += 1
        method_breakdown[m]["amount"] += t.get("amount", 0)
        method_breakdown[m]["fees"] += t.get("fee", 0)
    for k in method_breakdown:
        method_breakdown[k]["amount"] = round(method_breakdown[k]["amount"], 2)
        method_breakdown[k]["fees"] = round(method_breakdown[k]["fees"], 2)

    hourly = {}
    for t in completed:
        h = t.get("created_at", "")[:13]
        if h not in hourly:
            hourly[h] = {"count": 0, "amount": 0}
        hourly[h]["count"] += 1
        hourly[h]["amount"] += t.get("amount", 0)

    return {
        "date": day.strftime("%Y-%m-%d"),
        "total_transactions": len(completed),
        "total_amount": round(sum(t.get("amount", 0) for t in completed), 2),
        "total_fees": round(sum(t.get("fee", 0) for t in completed), 2),
        "total_net": round(sum(t.get("net", t.get("amount", 0) - t.get("fee", 0)) for t in completed), 2),
        "refund_count": len(refunded),
        "refund_amount": round(sum(t.get("amount", 0) for t in refunded), 2),
        "method_breakdown": method_breakdown,
        "hourly_breakdown": hourly,
        "avg_transaction": round(sum(t.get("amount", 0) for t in completed) / max(len(completed), 1), 2),
    }


@router.get("/reports/monthly")
async def get_monthly_report(request: Request, year: Optional[int] = None, month: Optional[int] = None):
    """Get monthly report."""
    user = await get_current_user(request)
    uid = str(user["_id"])
    mp = await get_merchant_profile(user)
    mid = str(mp["_id"])

    now = datetime.now(timezone.utc)
    y = year or now.year
    m = month or now.month

    start = datetime(y, m, 1, tzinfo=timezone.utc).isoformat()
    if m == 12:
        end = datetime(y + 1, 1, 1, tzinfo=timezone.utc).isoformat()
    else:
        end = datetime(y, m + 1, 1, tzinfo=timezone.utc).isoformat()

    txns = await db.merchant_transactions.find({
        "merchant_id": mid, "created_at": {"$gte": start, "$lt": end},
    }, {"_id": 0}).to_list(10000)

    completed = [t for t in txns if t.get("status") == "completed"]
    refunded = [t for t in txns if t.get("status") == "refunded"]

    daily_breakdown = {}
    for t in completed:
        d = t.get("created_at", "")[:10]
        if d not in daily_breakdown:
            daily_breakdown[d] = {"count": 0, "amount": 0, "fees": 0}
        daily_breakdown[d]["count"] += 1
        daily_breakdown[d]["amount"] += t.get("amount", 0)
        daily_breakdown[d]["fees"] += t.get("fee", 0)
    for k in daily_breakdown:
        daily_breakdown[k]["amount"] = round(daily_breakdown[k]["amount"], 2)
        daily_breakdown[k]["fees"] = round(daily_breakdown[k]["fees"], 2)

    method_breakdown = {}
    for t in completed:
        m_key = t.get("payment_method", "unknown")
        if m_key not in method_breakdown:
            method_breakdown[m_key] = {"count": 0, "amount": 0, "fees": 0}
        method_breakdown[m_key]["count"] += 1
        method_breakdown[m_key]["amount"] += t.get("amount", 0)
        method_breakdown[m_key]["fees"] += t.get("fee", 0)
    for k in method_breakdown:
        method_breakdown[k]["amount"] = round(method_breakdown[k]["amount"], 2)
        method_breakdown[k]["fees"] = round(method_breakdown[k]["fees"], 2)

    return {
        "year": y, "month": m,
        "total_transactions": len(completed),
        "total_amount": round(sum(t.get("amount", 0) for t in completed), 2),
        "total_fees": round(sum(t.get("fee", 0) for t in completed), 2),
        "total_net": round(sum(t.get("net", t.get("amount", 0) - t.get("fee", 0)) for t in completed), 2),
        "refund_count": len(refunded),
        "refund_amount": round(sum(t.get("amount", 0) for t in refunded), 2),
        "daily_breakdown": daily_breakdown,
        "method_breakdown": method_breakdown,
        "avg_transaction": round(sum(t.get("amount", 0) for t in completed) / max(len(completed), 1), 2),
        "best_day": max(daily_breakdown.items(), key=lambda x: x[1]["amount"])[0] if daily_breakdown else None,
    }


# ══════════════════════════════════════
# REFUNDS
# ══════════════════════════════════════

class RefundRequest(BaseModel):
    transaction_id: str
    reason: str
    amount: Optional[float] = None

@router.post("/refund")
async def process_refund(req: RefundRequest, request: Request):
    """Process a refund for a merchant transaction."""
    user = await get_current_user(request)
    uid = str(user["_id"])
    mp = await get_merchant_profile(user)
    mid = str(mp["_id"])

    if not req.reason or len(req.reason.strip()) < 3:
        raise HTTPException(status_code=400, detail="Refund reason is required (min 3 chars)")

    # Find original transaction
    txn = await db.merchant_transactions.find_one({
        "merchant_id": mid,
        "$or": [
            {"_id": ObjectId(req.transaction_id) if ObjectId.is_valid(req.transaction_id) else None},
            {"transaction_id": req.transaction_id},
        ],
        "status": "completed",
    })
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found or already refunded")

    refund_amount = req.amount or txn.get("amount", 0)
    if refund_amount > txn.get("amount", 0):
        raise HTTPException(status_code=400, detail="Refund amount exceeds original")

    now_iso = datetime.now(timezone.utc).isoformat()

    # Refund to customer if wallet payment
    if txn.get("customer_ref") and txn.get("customer_ref") != "card":
        customer = await db.users.find_one({"email": txn["customer_ref"]})
        if customer:
            await db.users.update_one({"_id": customer["_id"]}, {"$inc": {"balance": refund_amount}})
            await db.transactions.insert_one({
                "id": secrets.token_hex(8), "user_id": str(customer["_id"]),
                "type": "refund", "amount": refund_amount,
                "description": f"Refund: {req.reason}",
                "status": "completed", "created_at": now_iso,
            })

    # Mark transaction as refunded
    await db.merchant_transactions.update_one({"_id": txn["_id"]}, {"$set": {
        "status": "refunded", "refund_amount": refund_amount,
        "refund_reason": req.reason, "refunded_at": now_iso,
        "refunded_by": uid,
    }})

    # Reduce merchant totals
    await db.merchant_profiles.update_one({"_id": mp["_id"]}, {"$inc": {
        "total_revenue": -refund_amount,
    }})

    return {
        "ok": True, "refund_amount": refund_amount,
        "reason": req.reason, "refunded_at": now_iso,
    }


@router.get("/refunds")
async def get_refunds(request: Request):
    """Get all refunded transactions."""
    user = await get_current_user(request)
    uid = str(user["_id"])
    mp = await get_merchant_profile(user)
    mid = str(mp["_id"])

    refunds = await db.merchant_transactions.find(
        {"merchant_id": mid, "status": "refunded"}, {"_id": 0}
    ).sort("refunded_at", -1).limit(100).to_list(100)
    return {"refunds": refunds, "total": len(refunds)}
