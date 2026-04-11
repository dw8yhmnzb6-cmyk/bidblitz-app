"""
BidBlitz V2 - Complete Kids Banking System
Full parental control, real money flow, gamification, tracking.
"""

import secrets
import logging
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional, List
from bson import ObjectId
from math import radians, cos, sin, sqrt, atan2

from core.database import db
from core.security import get_current_user
from core.payment_engine import debit_wallet, credit_wallet, TransactionType

router = APIRouter(prefix="/api/kids", tags=["Kids"])
logger = logging.getLogger("bidblitz.kids")


# ══════════════════════════════════════════════════════════════════════════════
# SCHEMAS
# ══════════════════════════════════════════════════════════════════════════════

class CreateChildRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=50)
    avatar: Optional[str] = None
    daily_limit: float = Field(default=10.0, ge=0, le=100)
    weekly_limit: float = Field(default=50.0, ge=0, le=500)
    pin: str = Field(..., min_length=4, max_length=6)


class UpdateChildRequest(BaseModel):
    name: Optional[str] = None
    avatar: Optional[str] = None
    daily_limit: Optional[float] = None
    weekly_limit: Optional[float] = None


class TransferRequest(BaseModel):
    child_id: str
    amount: float = Field(..., gt=0, le=500)
    message: Optional[str] = None


class ChildPayRequest(BaseModel):
    amount: float = Field(..., gt=0)
    description: str = Field(..., min_length=2)
    merchant_name: Optional[str] = None
    category: Optional[str] = "general"


class CreateTaskRequest(BaseModel):
    child_id: str
    title: str = Field(..., min_length=2, max_length=100)
    description: Optional[str] = None
    reward_amount: float = Field(..., gt=0, le=50)
    due_date: Optional[str] = None


class LocationUpdateRequest(BaseModel):
    lat: float
    lng: float
    battery: Optional[int] = None


class CreateZoneRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=50)
    lat: float
    lng: float
    radius: float = Field(default=500, ge=50, le=5000)  # meters


class ChildLoginRequest(BaseModel):
    child_id: str
    pin: str


class ChatMessageRequest(BaseModel):
    child_id: str
    message: str = Field(..., min_length=1, max_length=500)


# ══════════════════════════════════════════════════════════════════════════════
# HELPER FUNCTIONS
# ══════════════════════════════════════════════════════════════════════════════

def haversine_distance(lat1, lng1, lat2, lng2):
    """Calculate distance between two points in meters."""
    R = 6371000  # Earth radius in meters
    dlat = radians(lat2 - lat1)
    dlng = radians(lng2 - lng1)
    a = sin(dlat/2)**2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng/2)**2
    return R * 2 * atan2(sqrt(a), sqrt(1-a))


async def check_spending_limits(child_id: str, amount: float) -> dict:
    """Check if spending is within limits."""
    child = await db.children.find_one({"child_id": child_id})
    if not child:
        return {"allowed": False, "reason": "Kind nicht gefunden"}
    
    if child.get("is_locked"):
        return {"allowed": False, "reason": "Konto gesperrt"}
    
    if child.get("balance", 0) < amount:
        return {"allowed": False, "reason": "Nicht genug Guthaben"}
    
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=today_start.weekday())
    
    # Calculate daily spending
    daily_txs = await db.child_transactions.find({
        "child_id": child_id,
        "type": "spend",
        "created_at": {"$gte": today_start.isoformat()}
    }).to_list(100)
    daily_spent = sum(abs(t.get("amount", 0)) for t in daily_txs)
    
    if daily_spent + amount > child.get("daily_limit", 10):
        return {"allowed": False, "reason": f"Tageslimit erreicht (€{child.get('daily_limit', 10):.2f})"}
    
    # Calculate weekly spending
    weekly_txs = await db.child_transactions.find({
        "child_id": child_id,
        "type": "spend",
        "created_at": {"$gte": week_start.isoformat()}
    }).to_list(500)
    weekly_spent = sum(abs(t.get("amount", 0)) for t in weekly_txs)
    
    if weekly_spent + amount > child.get("weekly_limit", 50):
        return {"allowed": False, "reason": f"Wochenlimit erreicht (€{child.get('weekly_limit', 50):.2f})"}
    
    return {
        "allowed": True,
        "daily_remaining": child.get("daily_limit", 10) - daily_spent - amount,
        "weekly_remaining": child.get("weekly_limit", 50) - weekly_spent - amount,
    }


# ══════════════════════════════════════════════════════════════════════════════
# CREATE / MANAGE CHILDREN
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/create")
async def create_child(req: CreateChildRequest, request: Request):
    """Parent creates a child account."""
    user = await get_current_user(request)
    parent_id = str(user["_id"])
    
    # Limit children per parent
    existing = await db.children.count_documents({"parent_id": parent_id})
    if existing >= 5:
        raise HTTPException(status_code=400, detail="Maximal 5 Kinder erlaubt")
    
    now = datetime.now(timezone.utc)
    child_id = secrets.token_hex(8)
    
    # Hash PIN
    import hashlib
    pin_hash = hashlib.sha256(req.pin.encode()).hexdigest()
    
    child = {
        "child_id": child_id,
        "parent_id": parent_id,
        "name": req.name,
        "avatar": req.avatar or f"child_{secrets.randbelow(10)}",
        "balance": 0.0,
        "daily_limit": req.daily_limit,
        "weekly_limit": req.weekly_limit,
        "is_locked": False,
        "pin_hash": pin_hash,
        "total_received": 0.0,
        "total_spent": 0.0,
        "tasks_completed": 0,
        "created_at": now.isoformat(),
    }
    
    await db.children.insert_one(child)
    child.pop("_id", None)
    child.pop("pin_hash", None)
    
    logger.info(f"Child created: {child_id} by parent {parent_id}")
    
    return {
        "ok": True,
        "child": child,
        "message": f"Kind '{req.name}' wurde erstellt!",
    }


@router.get("/list")
async def list_children(request: Request):
    """Parent gets all their children."""
    user = await get_current_user(request)
    parent_id = str(user["_id"])
    
    children = await db.children.find(
        {"parent_id": parent_id},
        {"_id": 0, "pin_hash": 0}
    ).to_list(10)
    
    # Add recent activity
    for child in children:
        # Get last transaction
        last_tx = await db.child_transactions.find_one(
            {"child_id": child["child_id"]},
            {"_id": 0},
            sort=[("created_at", -1)]
        )
        child["last_transaction"] = last_tx
        
        # Get pending tasks
        pending_tasks = await db.child_tasks.count_documents({
            "child_id": child["child_id"],
            "status": "pending"
        })
        child["pending_tasks"] = pending_tasks
        
        # Get location
        location = await db.child_locations.find_one(
            {"child_id": child["child_id"]},
            {"_id": 0},
            sort=[("updated_at", -1)]
        )
        child["last_location"] = location
    
    return {"children": children, "total": len(children)}


@router.get("/{child_id}")
async def get_child(child_id: str, request: Request):
    """Get single child details."""
    user = await get_current_user(request)
    parent_id = str(user["_id"])
    
    child = await db.children.find_one(
        {"child_id": child_id, "parent_id": parent_id},
        {"_id": 0, "pin_hash": 0}
    )
    
    if not child:
        raise HTTPException(status_code=404, detail="Kind nicht gefunden")
    
    return {"child": child}


@router.put("/{child_id}")
async def update_child(child_id: str, req: UpdateChildRequest, request: Request):
    """Parent updates child settings."""
    user = await get_current_user(request)
    parent_id = str(user["_id"])
    
    child = await db.children.find_one({"child_id": child_id, "parent_id": parent_id})
    if not child:
        raise HTTPException(status_code=404, detail="Kind nicht gefunden")
    
    updates = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if req.name:
        updates["name"] = req.name
    if req.avatar:
        updates["avatar"] = req.avatar
    if req.daily_limit is not None:
        updates["daily_limit"] = req.daily_limit
    if req.weekly_limit is not None:
        updates["weekly_limit"] = req.weekly_limit
    
    await db.children.update_one({"child_id": child_id}, {"$set": updates})
    
    return {"ok": True, "message": "Einstellungen aktualisiert"}


@router.delete("/{child_id}")
async def delete_child(child_id: str, request: Request):
    """Parent deletes child account (with refund)."""
    user = await get_current_user(request)
    parent_id = str(user["_id"])
    
    child = await db.children.find_one({"child_id": child_id, "parent_id": parent_id})
    if not child:
        raise HTTPException(status_code=404, detail="Kind nicht gefunden")
    
    # Refund remaining balance to parent
    remaining = child.get("balance", 0)
    if remaining > 0:
        await credit_wallet(
            user_id=parent_id,
            amount=remaining,
            tx_type=TransactionType.REFUND,
            description=f"Rückerstattung von {child.get('name', 'Kind')}",
            reference=f"KIDS-REFUND-{child_id[:8].upper()}",
            source="kids_refund",
        )
    
    await db.children.delete_one({"child_id": child_id})
    await db.child_transactions.delete_many({"child_id": child_id})
    await db.child_tasks.delete_many({"child_id": child_id})
    await db.child_locations.delete_many({"child_id": child_id})
    
    return {"ok": True, "refunded": remaining}


# ══════════════════════════════════════════════════════════════════════════════
# MONEY TRANSFER (PARENT → CHILD)
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/transfer")
async def transfer_to_child(req: TransferRequest, request: Request):
    """Parent transfers money to child."""
    user = await get_current_user(request)
    parent_id = str(user["_id"])
    
    # Verify child belongs to parent
    child = await db.children.find_one({
        "child_id": req.child_id,
        "parent_id": parent_id
    })
    if not child:
        raise HTTPException(status_code=404, detail="Kind nicht gefunden")
    
    # Check parent balance
    parent_balance = user.get("balance", 0)
    if parent_balance < req.amount:
        raise HTTPException(status_code=400, detail=f"Nicht genug Guthaben (€{parent_balance:.2f})")
    
    now = datetime.now(timezone.utc)
    tx_id = secrets.token_hex(8)
    
    # Debit parent
    debit_result = await debit_wallet(
        user_id=parent_id,
        amount=req.amount,
        tx_type=TransactionType.TRANSFER,
        description=f"An {child.get('name', 'Kind')}",
        reference=f"KIDS-{tx_id[:8].upper()}",
        metadata={"child_id": req.child_id}
    )
    
    if not debit_result.success:
        raise HTTPException(status_code=400, detail=debit_result.error)
    
    # Credit child
    await db.children.update_one(
        {"child_id": req.child_id},
        {"$inc": {"balance": req.amount, "total_received": req.amount}}
    )
    
    # Record child transaction
    await db.child_transactions.insert_one({
        "tx_id": tx_id,
        "child_id": req.child_id,
        "parent_id": parent_id,
        "amount": req.amount,
        "type": "transfer",
        "description": req.message or f"Von {user.get('name', 'Papa/Mama')}",
        "balance_after": child.get("balance", 0) + req.amount,
        "created_at": now.isoformat(),
    })
    
    # Notify child (if they have the app)
    await db.notifications.insert_one({
        "id": secrets.token_hex(8),
        "user_id": f"child_{req.child_id}",
        "type": "kids_transfer",
        "title": f"€{req.amount:.2f} erhalten!",
        "message": req.message or f"Von {user.get('name', 'Papa/Mama')}",
        "data": {"child_id": req.child_id, "amount": req.amount},
        "read": False,
        "created_at": now.isoformat(),
    })
    
    # Get updated child
    updated_child = await db.children.find_one(
        {"child_id": req.child_id},
        {"_id": 0, "pin_hash": 0}
    )
    
    return {
        "ok": True,
        "child_balance": updated_child.get("balance", 0),
        "parent_balance": debit_result.new_balance,
        "message": f"€{req.amount:.2f} an {child.get('name')} überwiesen!",
    }


# ══════════════════════════════════════════════════════════════════════════════
# CHILD SPENDING
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/pay")
async def child_pay(req: ChildPayRequest, request: Request):
    """Child makes a payment (authenticated as child via PIN session)."""
    # Get child_id from session/token
    child_session = request.state.child_session if hasattr(request.state, 'child_session') else None
    
    if not child_session:
        # Try to get from header
        child_id = request.headers.get("X-Child-ID")
        if not child_id:
            raise HTTPException(status_code=401, detail="Kind nicht authentifiziert")
    else:
        child_id = child_session.get("child_id")
    
    child = await db.children.find_one({"child_id": child_id})
    if not child:
        raise HTTPException(status_code=404, detail="Kind nicht gefunden")
    
    # Check limits
    limit_check = await check_spending_limits(child_id, req.amount)
    if not limit_check["allowed"]:
        # Alert parent
        await db.notifications.insert_one({
            "id": secrets.token_hex(8),
            "user_id": child["parent_id"],
            "type": "kids_limit_reached",
            "title": "Limit erreicht!",
            "message": f"{child.get('name')} hat versucht €{req.amount:.2f} auszugeben: {limit_check['reason']}",
            "data": {"child_id": child_id, "amount": req.amount},
            "read": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        raise HTTPException(status_code=400, detail=limit_check["reason"])
    
    now = datetime.now(timezone.utc)
    tx_id = secrets.token_hex(8)
    
    # Deduct from child
    new_balance = child.get("balance", 0) - req.amount
    await db.children.update_one(
        {"child_id": child_id},
        {"$set": {"balance": new_balance}, "$inc": {"total_spent": req.amount}}
    )
    
    # Record transaction
    await db.child_transactions.insert_one({
        "tx_id": tx_id,
        "child_id": child_id,
        "parent_id": child["parent_id"],
        "amount": -req.amount,
        "type": "spend",
        "description": req.description,
        "merchant_name": req.merchant_name,
        "category": req.category,
        "balance_after": new_balance,
        "created_at": now.isoformat(),
    })
    
    # Notify parent
    await db.notifications.insert_one({
        "id": secrets.token_hex(8),
        "user_id": child["parent_id"],
        "type": "kids_spending",
        "title": f"{child.get('name')} hat ausgegeben",
        "message": f"€{req.amount:.2f} - {req.description}",
        "data": {"child_id": child_id, "amount": req.amount, "tx_id": tx_id},
        "read": False,
        "created_at": now.isoformat(),
    })
    
    return {
        "ok": True,
        "new_balance": new_balance,
        "daily_remaining": limit_check.get("daily_remaining", 0),
        "weekly_remaining": limit_check.get("weekly_remaining", 0),
        "tx_id": tx_id,
    }


# ══════════════════════════════════════════════════════════════════════════════
# LOCK / UNLOCK
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/lock/{child_id}")
async def lock_child(child_id: str, request: Request):
    """Parent locks child account."""
    user = await get_current_user(request)
    parent_id = str(user["_id"])
    
    child = await db.children.find_one({"child_id": child_id, "parent_id": parent_id})
    if not child:
        raise HTTPException(status_code=404, detail="Kind nicht gefunden")
    
    await db.children.update_one(
        {"child_id": child_id},
        {"$set": {"is_locked": True, "locked_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"ok": True, "is_locked": True, "message": f"{child.get('name')} wurde gesperrt"}


@router.post("/unlock/{child_id}")
async def unlock_child(child_id: str, request: Request):
    """Parent unlocks child account."""
    user = await get_current_user(request)
    parent_id = str(user["_id"])
    
    child = await db.children.find_one({"child_id": child_id, "parent_id": parent_id})
    if not child:
        raise HTTPException(status_code=404, detail="Kind nicht gefunden")
    
    await db.children.update_one(
        {"child_id": child_id},
        {"$set": {"is_locked": False}, "$unset": {"locked_at": ""}}
    )
    
    return {"ok": True, "is_locked": False, "message": f"{child.get('name')} wurde entsperrt"}


# ══════════════════════════════════════════════════════════════════════════════
# TASK SYSTEM (GAMIFICATION)
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/task/create")
async def create_task(req: CreateTaskRequest, request: Request):
    """Parent creates a task for child."""
    user = await get_current_user(request)
    parent_id = str(user["_id"])
    
    # Verify child
    child = await db.children.find_one({"child_id": req.child_id, "parent_id": parent_id})
    if not child:
        raise HTTPException(status_code=404, detail="Kind nicht gefunden")
    
    now = datetime.now(timezone.utc)
    task_id = secrets.token_hex(8)
    
    task = {
        "task_id": task_id,
        "parent_id": parent_id,
        "child_id": req.child_id,
        "child_name": child.get("name"),
        "title": req.title,
        "description": req.description,
        "reward_amount": req.reward_amount,
        "status": "pending",
        "due_date": req.due_date,
        "created_at": now.isoformat(),
    }
    
    await db.child_tasks.insert_one(task)
    task.pop("_id", None)
    
    # Notify child
    await db.notifications.insert_one({
        "id": secrets.token_hex(8),
        "user_id": f"child_{req.child_id}",
        "type": "kids_new_task",
        "title": "Neue Aufgabe!",
        "message": f"{req.title} - Belohnung: €{req.reward_amount:.2f}",
        "data": {"task_id": task_id},
        "read": False,
        "created_at": now.isoformat(),
    })
    
    return {"ok": True, "task": task}


@router.get("/tasks/{child_id}")
async def get_tasks(child_id: str, request: Request, status: str = None):
    """Get tasks for a child."""
    user = await get_current_user(request)
    parent_id = str(user["_id"])
    
    # Verify parent owns child
    child = await db.children.find_one({"child_id": child_id, "parent_id": parent_id})
    if not child:
        raise HTTPException(status_code=404, detail="Kind nicht gefunden")
    
    query = {"child_id": child_id}
    if status:
        query["status"] = status
    
    tasks = await db.child_tasks.find(query, {"_id": 0}).sort("created_at", -1).to_list(50)
    
    return {"tasks": tasks, "total": len(tasks)}


@router.post("/task/submit/{task_id}")
async def submit_task(task_id: str, request: Request):
    """Child submits task for approval."""
    # Get child from header
    child_id = request.headers.get("X-Child-ID")
    if not child_id:
        raise HTTPException(status_code=401, detail="Kind nicht authentifiziert")
    
    task = await db.child_tasks.find_one({"task_id": task_id, "child_id": child_id})
    if not task:
        raise HTTPException(status_code=404, detail="Aufgabe nicht gefunden")
    
    if task["status"] != "pending":
        raise HTTPException(status_code=400, detail="Aufgabe bereits bearbeitet")
    
    now = datetime.now(timezone.utc)
    
    await db.child_tasks.update_one(
        {"task_id": task_id},
        {"$set": {"status": "submitted", "submitted_at": now.isoformat()}}
    )
    
    # Notify parent
    await db.notifications.insert_one({
        "id": secrets.token_hex(8),
        "user_id": task["parent_id"],
        "type": "kids_task_submitted",
        "title": "Aufgabe eingereicht!",
        "message": f"{task.get('child_name')} hat '{task['title']}' erledigt",
        "data": {"task_id": task_id, "child_id": child_id},
        "read": False,
        "created_at": now.isoformat(),
    })
    
    return {"ok": True, "status": "submitted"}


@router.post("/task/approve/{task_id}")
async def approve_task(task_id: str, request: Request):
    """Parent approves task and releases reward."""
    user = await get_current_user(request)
    parent_id = str(user["_id"])
    
    task = await db.child_tasks.find_one({"task_id": task_id, "parent_id": parent_id})
    if not task:
        raise HTTPException(status_code=404, detail="Aufgabe nicht gefunden")
    
    if task["status"] not in ["pending", "submitted"]:
        raise HTTPException(status_code=400, detail="Aufgabe bereits bearbeitet")
    
    now = datetime.now(timezone.utc)
    child_id = task["child_id"]
    reward = task["reward_amount"]
    
    # Credit child
    await db.children.update_one(
        {"child_id": child_id},
        {"$inc": {"balance": reward, "total_received": reward, "tasks_completed": 1}}
    )
    
    # Record transaction
    await db.child_transactions.insert_one({
        "tx_id": secrets.token_hex(8),
        "child_id": child_id,
        "parent_id": parent_id,
        "amount": reward,
        "type": "reward",
        "description": f"Aufgabe: {task['title']}",
        "task_id": task_id,
        "created_at": now.isoformat(),
    })
    
    # Update task
    await db.child_tasks.update_one(
        {"task_id": task_id},
        {"$set": {"status": "completed", "completed_at": now.isoformat()}}
    )
    
    # Notify child
    await db.notifications.insert_one({
        "id": secrets.token_hex(8),
        "user_id": f"child_{child_id}",
        "type": "kids_reward",
        "title": f"€{reward:.2f} verdient!",
        "message": f"Aufgabe '{task['title']}' abgeschlossen!",
        "data": {"task_id": task_id, "amount": reward},
        "read": False,
        "created_at": now.isoformat(),
    })
    
    child = await db.children.find_one({"child_id": child_id}, {"_id": 0, "pin_hash": 0})
    
    return {
        "ok": True,
        "reward": reward,
        "child_balance": child.get("balance", 0),
        "message": f"€{reward:.2f} an {child.get('name')} ausgezahlt!",
    }


@router.post("/task/reject/{task_id}")
async def reject_task(task_id: str, request: Request):
    """Parent rejects task."""
    body = await request.json()
    reason = body.get("reason", "Nicht akzeptiert")
    
    user = await get_current_user(request)
    parent_id = str(user["_id"])
    
    task = await db.child_tasks.find_one({"task_id": task_id, "parent_id": parent_id})
    if not task:
        raise HTTPException(status_code=404, detail="Aufgabe nicht gefunden")
    
    now = datetime.now(timezone.utc)
    
    await db.child_tasks.update_one(
        {"task_id": task_id},
        {"$set": {"status": "rejected", "rejection_reason": reason, "rejected_at": now.isoformat()}}
    )
    
    # Notify child
    await db.notifications.insert_one({
        "id": secrets.token_hex(8),
        "user_id": f"child_{task['child_id']}",
        "type": "kids_task_rejected",
        "title": "Aufgabe nicht akzeptiert",
        "message": f"'{task['title']}': {reason}",
        "data": {"task_id": task_id},
        "read": False,
        "created_at": now.isoformat(),
    })
    
    return {"ok": True, "status": "rejected"}


# ══════════════════════════════════════════════════════════════════════════════
# LOCATION TRACKING
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/location/update")
async def update_location(req: LocationUpdateRequest, request: Request):
    """Child device sends location update."""
    child_id = request.headers.get("X-Child-ID")
    if not child_id:
        raise HTTPException(status_code=401, detail="Kind nicht authentifiziert")
    
    child = await db.children.find_one({"child_id": child_id})
    if not child:
        raise HTTPException(status_code=404, detail="Kind nicht gefunden")
    
    now = datetime.now(timezone.utc)
    
    # Save location
    await db.child_locations.update_one(
        {"child_id": child_id},
        {"$set": {
            "lat": req.lat,
            "lng": req.lng,
            "battery": req.battery,
            "updated_at": now.isoformat(),
        }},
        upsert=True
    )
    
    # Check safe zones
    zones = await db.child_zones.find({"parent_id": child["parent_id"]}).to_list(20)
    in_safe_zone = False
    
    for zone in zones:
        distance = haversine_distance(req.lat, req.lng, zone["lat"], zone["lng"])
        if distance <= zone["radius"]:
            in_safe_zone = True
            break
    
    # Alert if left safe zone
    if zones and not in_safe_zone:
        last_alert = await db.child_alerts.find_one({
            "child_id": child_id,
            "type": "zone_left",
            "created_at": {"$gte": (now - timedelta(minutes=15)).isoformat()}
        })
        
        if not last_alert:
            await db.child_alerts.insert_one({
                "alert_id": secrets.token_hex(8),
                "child_id": child_id,
                "parent_id": child["parent_id"],
                "type": "zone_left",
                "message": f"{child.get('name')} hat die sichere Zone verlassen!",
                "lat": req.lat,
                "lng": req.lng,
                "read": False,
                "created_at": now.isoformat(),
            })
            
            await db.notifications.insert_one({
                "id": secrets.token_hex(8),
                "user_id": child["parent_id"],
                "type": "kids_zone_alert",
                "title": "⚠️ Zone verlassen!",
                "message": f"{child.get('name')} ist außerhalb der sicheren Zone",
                "data": {"child_id": child_id, "lat": req.lat, "lng": req.lng},
                "read": False,
                "created_at": now.isoformat(),
            })
    
    # Low battery alert
    if req.battery and req.battery <= 15:
        last_battery_alert = await db.child_alerts.find_one({
            "child_id": child_id,
            "type": "low_battery",
            "created_at": {"$gte": (now - timedelta(hours=2)).isoformat()}
        })
        
        if not last_battery_alert:
            await db.notifications.insert_one({
                "id": secrets.token_hex(8),
                "user_id": child["parent_id"],
                "type": "kids_battery_low",
                "title": "🔋 Akku niedrig!",
                "message": f"{child.get('name')}'s Gerät hat nur noch {req.battery}% Akku",
                "data": {"child_id": child_id, "battery": req.battery},
                "read": False,
                "created_at": now.isoformat(),
            })
            
            await db.child_alerts.insert_one({
                "alert_id": secrets.token_hex(8),
                "child_id": child_id,
                "type": "low_battery",
                "battery": req.battery,
                "created_at": now.isoformat(),
            })
    
    return {"ok": True, "in_safe_zone": in_safe_zone}


@router.get("/location/{child_id}")
async def get_child_location(child_id: str, request: Request):
    """Parent gets child's location."""
    user = await get_current_user(request)
    parent_id = str(user["_id"])
    
    child = await db.children.find_one({"child_id": child_id, "parent_id": parent_id})
    if not child:
        raise HTTPException(status_code=404, detail="Kind nicht gefunden")
    
    location = await db.child_locations.find_one(
        {"child_id": child_id},
        {"_id": 0}
    )
    
    # Get location history
    history = await db.child_locations.find(
        {"child_id": child_id},
        {"_id": 0}
    ).sort("updated_at", -1).limit(10).to_list(10)
    
    return {
        "current": location,
        "history": history,
        "child_name": child.get("name"),
    }


# ══════════════════════════════════════════════════════════════════════════════
# SAFE ZONES
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/zones/create")
async def create_zone(req: CreateZoneRequest, request: Request):
    """Parent creates a safe zone."""
    user = await get_current_user(request)
    parent_id = str(user["_id"])
    
    # Limit zones
    existing = await db.child_zones.count_documents({"parent_id": parent_id})
    if existing >= 10:
        raise HTTPException(status_code=400, detail="Maximal 10 Zonen erlaubt")
    
    zone_id = secrets.token_hex(8)
    now = datetime.now(timezone.utc)
    
    zone = {
        "zone_id": zone_id,
        "parent_id": parent_id,
        "name": req.name,
        "lat": req.lat,
        "lng": req.lng,
        "radius": req.radius,
        "created_at": now.isoformat(),
    }
    
    await db.child_zones.insert_one(zone)
    zone.pop("_id", None)
    
    return {"ok": True, "zone": zone}


@router.get("/zones")
async def get_zones(request: Request):
    """Get all safe zones for parent."""
    user = await get_current_user(request)
    parent_id = str(user["_id"])
    
    zones = await db.child_zones.find(
        {"parent_id": parent_id},
        {"_id": 0}
    ).to_list(20)
    
    return {"zones": zones}


@router.delete("/zones/{zone_id}")
async def delete_zone(zone_id: str, request: Request):
    """Delete a safe zone."""
    user = await get_current_user(request)
    parent_id = str(user["_id"])
    
    result = await db.child_zones.delete_one({"zone_id": zone_id, "parent_id": parent_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Zone nicht gefunden")
    
    return {"ok": True, "deleted": zone_id}


# ══════════════════════════════════════════════════════════════════════════════
# ANALYTICS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/analytics/{child_id}")
async def get_analytics(child_id: str, request: Request, days: int = 7):
    """Get spending analytics for a child."""
    user = await get_current_user(request)
    parent_id = str(user["_id"])
    
    child = await db.children.find_one({"child_id": child_id, "parent_id": parent_id})
    if not child:
        raise HTTPException(status_code=404, detail="Kind nicht gefunden")
    
    now = datetime.now(timezone.utc)
    start_date = now - timedelta(days=days)
    
    # Get transactions
    txs = await db.child_transactions.find({
        "child_id": child_id,
        "created_at": {"$gte": start_date.isoformat()}
    }, {"_id": 0}).to_list(500)
    
    # Calculate stats
    total_spent = sum(abs(t.get("amount", 0)) for t in txs if t.get("type") == "spend")
    total_received = sum(t.get("amount", 0) for t in txs if t.get("type") in ["transfer", "reward"])
    total_rewards = sum(t.get("amount", 0) for t in txs if t.get("type") == "reward")
    
    # By category
    by_category = {}
    for tx in txs:
        if tx.get("type") == "spend":
            cat = tx.get("category", "general")
            by_category[cat] = by_category.get(cat, 0) + abs(tx.get("amount", 0))
    
    # Daily breakdown
    daily = {}
    for tx in txs:
        date = tx.get("created_at", "")[:10]
        if date not in daily:
            daily[date] = {"spent": 0, "received": 0}
        if tx.get("type") == "spend":
            daily[date]["spent"] += abs(tx.get("amount", 0))
        else:
            daily[date]["received"] += tx.get("amount", 0)
    
    # Tasks completed
    tasks_completed = await db.child_tasks.count_documents({
        "child_id": child_id,
        "status": "completed",
        "completed_at": {"$gte": start_date.isoformat()}
    })
    
    return {
        "period_days": days,
        "summary": {
            "total_spent": round(total_spent, 2),
            "total_received": round(total_received, 2),
            "total_rewards": round(total_rewards, 2),
            "tasks_completed": tasks_completed,
            "current_balance": child.get("balance", 0),
        },
        "by_category": by_category,
        "daily_breakdown": daily,
        "transactions": txs[:20],
    }


# ══════════════════════════════════════════════════════════════════════════════
# CHILD LOGIN (PIN-based)
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/child-login")
async def child_login(req: ChildLoginRequest):
    """Child logs in with PIN."""
    import hashlib
    
    child = await db.children.find_one({"child_id": req.child_id})
    if not child:
        raise HTTPException(status_code=404, detail="Kind nicht gefunden")
    
    pin_hash = hashlib.sha256(req.pin.encode()).hexdigest()
    if pin_hash != child.get("pin_hash"):
        raise HTTPException(status_code=401, detail="Falscher PIN")
    
    if child.get("is_locked"):
        raise HTTPException(status_code=403, detail="Konto gesperrt")
    
    # Generate child session token
    session_token = secrets.token_hex(32)
    now = datetime.now(timezone.utc)
    
    await db.child_sessions.update_one(
        {"child_id": req.child_id},
        {"$set": {
            "token": session_token,
            "created_at": now.isoformat(),
            "expires_at": (now + timedelta(hours=24)).isoformat(),
        }},
        upsert=True
    )
    
    return {
        "ok": True,
        "child_id": req.child_id,
        "name": child.get("name"),
        "balance": child.get("balance", 0),
        "avatar": child.get("avatar"),
        "token": session_token,
    }


@router.get("/child-me")
async def get_child_profile(request: Request):
    """Get child's own profile (child mode)."""
    child_id = request.headers.get("X-Child-ID")
    if not child_id:
        raise HTTPException(status_code=401, detail="Kind nicht authentifiziert")
    
    child = await db.children.find_one(
        {"child_id": child_id},
        {"_id": 0, "pin_hash": 0, "parent_id": 0}
    )
    
    if not child:
        raise HTTPException(status_code=404, detail="Kind nicht gefunden")
    
    # Get pending tasks
    tasks = await db.child_tasks.find(
        {"child_id": child_id, "status": "pending"},
        {"_id": 0}
    ).to_list(10)
    
    # Get recent transactions
    txs = await db.child_transactions.find(
        {"child_id": child_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(5).to_list(5)
    
    return {
        "child": child,
        "pending_tasks": tasks,
        "recent_transactions": txs,
    }


# ══════════════════════════════════════════════════════════════════════════════
# PARENT-CHILD CHAT
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/chat/send")
async def send_chat_message(req: ChatMessageRequest, request: Request):
    """Parent sends message to child."""
    user = await get_current_user(request)
    parent_id = str(user["_id"])
    
    child = await db.children.find_one({"child_id": req.child_id, "parent_id": parent_id})
    if not child:
        raise HTTPException(status_code=404, detail="Kind nicht gefunden")
    
    now = datetime.now(timezone.utc)
    msg_id = secrets.token_hex(8)
    
    message = {
        "message_id": msg_id,
        "child_id": req.child_id,
        "sender": "parent",
        "sender_id": parent_id,
        "sender_name": user.get("name", "Papa/Mama"),
        "message": req.message,
        "read": False,
        "created_at": now.isoformat(),
    }
    
    await db.child_chat.insert_one(message)
    message.pop("_id", None)
    
    return {"ok": True, "message": message}


@router.post("/chat/send-child")
async def child_send_message(request: Request):
    """Child sends message to parent."""
    body = await request.json()
    message_text = body.get("message", "")
    
    child_id = request.headers.get("X-Child-ID")
    if not child_id:
        raise HTTPException(status_code=401, detail="Kind nicht authentifiziert")
    
    child = await db.children.find_one({"child_id": child_id})
    if not child:
        raise HTTPException(status_code=404, detail="Kind nicht gefunden")
    
    now = datetime.now(timezone.utc)
    msg_id = secrets.token_hex(8)
    
    message = {
        "message_id": msg_id,
        "child_id": child_id,
        "sender": "child",
        "sender_id": child_id,
        "sender_name": child.get("name"),
        "message": message_text,
        "read": False,
        "created_at": now.isoformat(),
    }
    
    await db.child_chat.insert_one(message)
    message.pop("_id", None)
    
    # Notify parent
    await db.notifications.insert_one({
        "id": secrets.token_hex(8),
        "user_id": child["parent_id"],
        "type": "kids_chat",
        "title": f"Nachricht von {child.get('name')}",
        "message": message_text[:50],
        "data": {"child_id": child_id},
        "read": False,
        "created_at": now.isoformat(),
    })
    
    return {"ok": True, "message": message}


@router.get("/chat/{child_id}")
async def get_chat(child_id: str, request: Request, limit: int = 50):
    """Get chat history."""
    user = await get_current_user(request)
    parent_id = str(user["_id"])
    
    # Verify access
    child = await db.children.find_one({"child_id": child_id, "parent_id": parent_id})
    if not child:
        raise HTTPException(status_code=404, detail="Kind nicht gefunden")
    
    messages = await db.child_chat.find(
        {"child_id": child_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    messages.reverse()
    
    # Mark as read
    await db.child_chat.update_many(
        {"child_id": child_id, "sender": "child", "read": False},
        {"$set": {"read": True}}
    )
    
    return {"messages": messages, "child_name": child.get("name")}


# ══════════════════════════════════════════════════════════════════════════════
# TRANSACTIONS HISTORY
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/transactions/{child_id}")
async def get_transactions(child_id: str, request: Request, limit: int = 50):
    """Get child's transaction history."""
    user = await get_current_user(request)
    parent_id = str(user["_id"])
    
    child = await db.children.find_one({"child_id": child_id, "parent_id": parent_id})
    if not child:
        raise HTTPException(status_code=404, detail="Kind nicht gefunden")
    
    txs = await db.child_transactions.find(
        {"child_id": child_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return {"transactions": txs, "total": len(txs)}


# ══════════════════════════════════════════════════════════════════════════════
# ALERTS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/alerts")
async def get_alerts(request: Request, unread_only: bool = True):
    """Get all alerts for parent."""
    user = await get_current_user(request)
    parent_id = str(user["_id"])
    
    query = {"parent_id": parent_id}
    if unread_only:
        query["read"] = False
    
    alerts = await db.child_alerts.find(query, {"_id": 0}).sort("created_at", -1).limit(50).to_list(50)
    
    return {"alerts": alerts, "unread_count": len([a for a in alerts if not a.get("read")])}


@router.post("/alerts/mark-read")
async def mark_alerts_read(request: Request):
    """Mark all alerts as read."""
    user = await get_current_user(request)
    parent_id = str(user["_id"])
    
    result = await db.child_alerts.update_many(
        {"parent_id": parent_id, "read": False},
        {"$set": {"read": True}}
    )
    
    return {"ok": True, "marked": result.modified_count}
