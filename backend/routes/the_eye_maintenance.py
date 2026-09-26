"""The Eye maintenance, inventory, spare parts and RMA workflows."""

from __future__ import annotations

import secrets
from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, Field

from core.database import db
from core.security import get_current_user
from core.the_eye_live import broadcast_the_eye_event


router = APIRouter(prefix="/api/the-eye", tags=["The Eye Maintenance"])

InventoryStatus = Literal[
    "ordered",
    "in_stock",
    "reserved",
    "assigned",
    "installed",
    "active",
    "maintenance",
    "quarantine",
    "replaced",
    "retired",
    "rma",
]
WorkOrderStatus = Literal[
    "new",
    "assigned",
    "in_progress",
    "waiting_parts",
    "validation",
    "completed",
    "cancelled",
]
RmaStatus = Literal["requested", "approved", "shipped", "received", "credited", "rejected", "closed"]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _require_admin(request: Request) -> dict:
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin required")
    return user


class InventoryItemCreate(BaseModel):
    asset_type: str = Field(..., min_length=2, max_length=120)
    asset_class: Optional[str] = Field(default=None, max_length=120)
    name: str = Field(..., min_length=2, max_length=180)
    serial_number: Optional[str] = Field(default=None, max_length=160)
    model: Optional[str] = Field(default=None, max_length=160)
    vendor: Optional[str] = Field(default=None, max_length=160)
    warehouse: Optional[str] = Field(default=None, max_length=120)
    bin_location: Optional[str] = Field(default=None, max_length=120)
    quantity: int = Field(default=1, ge=1, le=100000)
    reorder_point: int = Field(default=0, ge=0, le=100000)
    unit_cost: Optional[float] = Field(default=None, ge=0)
    currency: str = Field(default="EUR", min_length=3, max_length=3)
    warranty_until: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class InventoryStatusUpdate(BaseModel):
    status: InventoryStatus
    assigned_site_id: Optional[str] = Field(default=None, max_length=128)
    assigned_device_id: Optional[str] = Field(default=None, max_length=128)
    assigned_camera_id: Optional[str] = Field(default=None, max_length=128)
    note: Optional[str] = Field(default=None, max_length=2000)


class StockAdjustRequest(BaseModel):
    delta: int = Field(..., ge=-100000, le=100000)
    note: str = Field(..., min_length=2, max_length=1000)


class WorkOrderCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=240)
    description: Optional[str] = Field(default=None, max_length=4000)
    priority: Literal["p1", "p2", "p3", "p4"] = "p3"
    site_id: Optional[str] = Field(default=None, max_length=128)
    location_id: Optional[str] = Field(default=None, max_length=128)
    device_id: Optional[str] = Field(default=None, max_length=128)
    camera_id: Optional[str] = Field(default=None, max_length=128)
    incident_id: Optional[str] = Field(default=None, max_length=128)
    ticket_id: Optional[str] = Field(default=None, max_length=128)
    assigned_to: Optional[str] = Field(default=None, max_length=128)
    parts: List[Dict[str, Any]] = Field(default_factory=list, max_length=200)
    scheduled_at: Optional[str] = None
    due_at: Optional[str] = None


class WorkOrderStatusUpdate(BaseModel):
    status: WorkOrderStatus
    note: Optional[str] = Field(default=None, max_length=2000)
    labor_minutes: Optional[int] = Field(default=None, ge=0, le=100000)
    travel_cost: Optional[float] = Field(default=None, ge=0)
    labor_cost: Optional[float] = Field(default=None, ge=0)
    parts_cost: Optional[float] = Field(default=None, ge=0)
    validation_passed: Optional[bool] = None


class RmaCreate(BaseModel):
    inventory_item_id: str = Field(..., min_length=5, max_length=128)
    reason: str = Field(..., min_length=3, max_length=2000)
    supplier_reference: Optional[str] = Field(default=None, max_length=200)
    expected_credit: Optional[float] = Field(default=None, ge=0)


class RmaStatusUpdate(BaseModel):
    status: RmaStatus
    note: Optional[str] = Field(default=None, max_length=2000)
    actual_credit: Optional[float] = Field(default=None, ge=0)


@router.post("/admin/inventory/items")
async def create_inventory_item(req: InventoryItemCreate, request: Request):
    admin = await _require_admin(request)

    if req.serial_number:
        existing = await db.the_eye_inventory.find_one(
            {"serial_number": req.serial_number, "status": {"$ne": "retired"}},
            {"_id": 0, "inventory_item_id": 1},
        )
        if existing:
            raise HTTPException(status_code=409, detail="Serial number already exists")

    now = _now()
    item_id = "INV-" + secrets.token_hex(8).upper()
    doc = {
        "inventory_item_id": item_id,
        "asset_type": req.asset_type,
        "asset_class": req.asset_class,
        "name": req.name,
        "serial_number": req.serial_number,
        "model": req.model,
        "vendor": req.vendor,
        "warehouse": req.warehouse,
        "bin_location": req.bin_location,
        "quantity": req.quantity,
        "reserved_quantity": 0,
        "reorder_point": req.reorder_point,
        "unit_cost": req.unit_cost,
        "currency": req.currency.upper(),
        "warranty_until": req.warranty_until,
        "metadata": req.metadata,
        "status": "in_stock",
        "assigned_site_id": None,
        "assigned_device_id": None,
        "assigned_camera_id": None,
        "created_at": now,
        "updated_at": now,
        "created_by": str(admin.get("_id") or admin.get("id") or admin.get("email")),
        "timeline": [{
            "at": now,
            "type": "created",
            "by": str(admin.get("_id") or admin.get("id") or admin.get("email")),
            "note": "Inventory item created",
        }],
    }
    await db.the_eye_inventory.insert_one(doc)
    doc.pop("_id", None)
    await broadcast_the_eye_event("inventory.created", doc)
    return {"ok": True, "item": doc}


@router.get("/admin/inventory/items")
async def list_inventory_items(
    request: Request,
    status: Optional[str] = None,
    asset_type: Optional[str] = None,
    warehouse: Optional[str] = None,
    low_stock_only: bool = False,
    limit: int = Query(default=500, ge=1, le=5000),
):
    await _require_admin(request)
    query: Dict[str, Any] = {}
    if status:
        query["status"] = status
    if asset_type:
        query["asset_type"] = asset_type
    if warehouse:
        query["warehouse"] = warehouse

    rows = await db.the_eye_inventory.find(query, {"_id": 0}).sort("updated_at", -1).to_list(limit)
    if low_stock_only:
        rows = [
            row for row in rows
            if int(row.get("quantity") or 0) - int(row.get("reserved_quantity") or 0) <= int(row.get("reorder_point") or 0)
        ]
    return {"ok": True, "count": len(rows), "items": rows}


@router.patch("/admin/inventory/items/{item_id}/status")
async def update_inventory_status(item_id: str, req: InventoryStatusUpdate, request: Request):
    admin = await _require_admin(request)
    current = await db.the_eye_inventory.find_one({"inventory_item_id": item_id}, {"_id": 0})
    if not current:
        raise HTTPException(status_code=404, detail="Inventory item not found")

    now = _now()
    actor = str(admin.get("_id") or admin.get("id") or admin.get("email"))
    update = {
        "status": req.status,
        "assigned_site_id": req.assigned_site_id,
        "assigned_device_id": req.assigned_device_id,
        "assigned_camera_id": req.assigned_camera_id,
        "updated_at": now,
    }
    await db.the_eye_inventory.update_one(
        {"inventory_item_id": item_id},
        {
            "$set": update,
            "$push": {"timeline": {
                "at": now,
                "type": "status_changed",
                "from": current.get("status"),
                "to": req.status,
                "by": actor,
                "note": req.note,
            }},
        },
    )
    fresh = await db.the_eye_inventory.find_one({"inventory_item_id": item_id}, {"_id": 0})
    await broadcast_the_eye_event("inventory.updated", fresh)
    return {"ok": True, "item": fresh}


@router.post("/admin/inventory/items/{item_id}/adjust")
async def adjust_stock(item_id: str, req: StockAdjustRequest, request: Request):
    admin = await _require_admin(request)
    current = await db.the_eye_inventory.find_one({"inventory_item_id": item_id}, {"_id": 0})
    if not current:
        raise HTTPException(status_code=404, detail="Inventory item not found")

    current_qty = int(current.get("quantity") or 0)
    new_qty = current_qty + req.delta
    if new_qty < 0:
        raise HTTPException(status_code=409, detail="Stock cannot become negative")

    now = _now()
    actor = str(admin.get("_id") or admin.get("id") or admin.get("email"))
    await db.the_eye_inventory.update_one(
        {"inventory_item_id": item_id},
        {
            "$set": {"quantity": new_qty, "updated_at": now},
            "$push": {"timeline": {
                "at": now,
                "type": "stock_adjusted",
                "by": actor,
                "delta": req.delta,
                "quantity": new_qty,
                "note": req.note,
            }},
        },
    )
    fresh = await db.the_eye_inventory.find_one({"inventory_item_id": item_id}, {"_id": 0})
    await broadcast_the_eye_event("inventory.updated", fresh)
    return {"ok": True, "item": fresh}


@router.post("/admin/work-orders")
async def create_work_order(req: WorkOrderCreate, request: Request):
    admin = await _require_admin(request)

    if req.incident_id and not await db.the_eye_incidents.find_one({"incident_id": req.incident_id}, {"_id": 1}):
        raise HTTPException(status_code=400, detail="Incident not found")
    if req.ticket_id and not await db.the_eye_tickets.find_one({"ticket_id": req.ticket_id}, {"_id": 1}):
        raise HTTPException(status_code=400, detail="Ticket not found")

    now = _now()
    actor = str(admin.get("_id") or admin.get("id") or admin.get("email"))
    work_order_id = "WO-" + secrets.token_hex(8).upper()
    doc = {
        "work_order_id": work_order_id,
        "title": req.title,
        "description": req.description,
        "priority": req.priority,
        "status": "assigned" if req.assigned_to else "new",
        "site_id": req.site_id,
        "location_id": req.location_id,
        "device_id": req.device_id,
        "camera_id": req.camera_id,
        "incident_id": req.incident_id,
        "ticket_id": req.ticket_id,
        "assigned_to": req.assigned_to,
        "parts": req.parts,
        "scheduled_at": req.scheduled_at,
        "due_at": req.due_at,
        "labor_minutes": 0,
        "travel_cost": 0.0,
        "labor_cost": 0.0,
        "parts_cost": 0.0,
        "validation_passed": None,
        "created_at": now,
        "updated_at": now,
        "created_by": actor,
        "timeline": [{
            "at": now,
            "type": "created",
            "by": actor,
            "note": "Work order created",
        }],
    }
    await db.the_eye_work_orders.insert_one(doc)
    doc.pop("_id", None)

    if req.ticket_id:
        await db.the_eye_tickets.update_one(
            {"ticket_id": req.ticket_id},
            {"$addToSet": {"work_order_ids": work_order_id}, "$set": {"updated_at": now}},
        )
    if req.incident_id:
        await db.the_eye_incidents.update_one(
            {"incident_id": req.incident_id},
            {"$addToSet": {"work_order_ids": work_order_id}, "$set": {"updated_at": now}},
        )

    await broadcast_the_eye_event("work_order.created", doc)
    return {"ok": True, "work_order": doc}


@router.get("/admin/work-orders")
async def list_work_orders(
    request: Request,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    site_id: Optional[str] = None,
    assigned_to: Optional[str] = None,
    limit: int = Query(default=300, ge=1, le=3000),
):
    await _require_admin(request)
    query: Dict[str, Any] = {}
    if status:
        query["status"] = status
    if priority:
        query["priority"] = priority
    if site_id:
        query["site_id"] = site_id
    if assigned_to:
        query["assigned_to"] = assigned_to

    rows = await db.the_eye_work_orders.find(query, {"_id": 0}).sort("updated_at", -1).to_list(limit)
    return {"ok": True, "count": len(rows), "work_orders": rows}


@router.patch("/admin/work-orders/{work_order_id}/status")
async def update_work_order_status(work_order_id: str, req: WorkOrderStatusUpdate, request: Request):
    admin = await _require_admin(request)
    current = await db.the_eye_work_orders.find_one({"work_order_id": work_order_id}, {"_id": 0})
    if not current:
        raise HTTPException(status_code=404, detail="Work order not found")

    if req.status == "completed" and req.validation_passed is not True:
        raise HTTPException(status_code=409, detail="Validation must pass before completing a work order")

    now = _now()
    actor = str(admin.get("_id") or admin.get("id") or admin.get("email"))
    update: Dict[str, Any] = {"status": req.status, "updated_at": now}

    for key in ["labor_minutes", "travel_cost", "labor_cost", "parts_cost", "validation_passed"]:
        value = getattr(req, key)
        if value is not None:
            update[key] = value

    if req.status == "completed":
        update["completed_at"] = now
        update["completed_by"] = actor

    await db.the_eye_work_orders.update_one(
        {"work_order_id": work_order_id},
        {
            "$set": update,
            "$push": {"timeline": {
                "at": now,
                "type": "status_changed",
                "from": current.get("status"),
                "to": req.status,
                "by": actor,
                "note": req.note,
            }},
        },
    )
    fresh = await db.the_eye_work_orders.find_one({"work_order_id": work_order_id}, {"_id": 0})
    await broadcast_the_eye_event("work_order.updated", fresh)
    return {"ok": True, "work_order": fresh}


@router.post("/admin/rma")
async def create_rma(req: RmaCreate, request: Request):
    admin = await _require_admin(request)
    item = await db.the_eye_inventory.find_one({"inventory_item_id": req.inventory_item_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Inventory item not found")

    now = _now()
    actor = str(admin.get("_id") or admin.get("id") or admin.get("email"))
    rma_id = "RMA-" + secrets.token_hex(8).upper()
    doc = {
        "rma_id": rma_id,
        "inventory_item_id": req.inventory_item_id,
        "serial_number": item.get("serial_number"),
        "vendor": item.get("vendor"),
        "reason": req.reason,
        "supplier_reference": req.supplier_reference,
        "expected_credit": req.expected_credit,
        "actual_credit": None,
        "currency": item.get("currency") or "EUR",
        "status": "requested",
        "created_at": now,
        "updated_at": now,
        "created_by": actor,
        "timeline": [{
            "at": now,
            "type": "requested",
            "by": actor,
            "note": req.reason,
        }],
    }
    await db.the_eye_rma.insert_one(doc)
    await db.the_eye_inventory.update_one(
        {"inventory_item_id": req.inventory_item_id},
        {"$set": {"status": "rma", "updated_at": now}},
    )
    doc.pop("_id", None)
    await broadcast_the_eye_event("rma.created", doc)
    return {"ok": True, "rma": doc}


@router.patch("/admin/rma/{rma_id}/status")
async def update_rma_status(rma_id: str, req: RmaStatusUpdate, request: Request):
    admin = await _require_admin(request)
    current = await db.the_eye_rma.find_one({"rma_id": rma_id}, {"_id": 0})
    if not current:
        raise HTTPException(status_code=404, detail="RMA not found")

    now = _now()
    actor = str(admin.get("_id") or admin.get("id") or admin.get("email"))
    update: Dict[str, Any] = {"status": req.status, "updated_at": now}
    if req.actual_credit is not None:
        update["actual_credit"] = req.actual_credit

    await db.the_eye_rma.update_one(
        {"rma_id": rma_id},
        {
            "$set": update,
            "$push": {"timeline": {
                "at": now,
                "type": "status_changed",
                "from": current.get("status"),
                "to": req.status,
                "by": actor,
                "note": req.note,
            }},
        },
    )

    if req.status in {"closed", "credited", "rejected"}:
        next_status = "in_stock" if req.status == "credited" else "quarantine"
        await db.the_eye_inventory.update_one(
            {"inventory_item_id": current.get("inventory_item_id")},
            {"$set": {"status": next_status, "updated_at": now}},
        )

    fresh = await db.the_eye_rma.find_one({"rma_id": rma_id}, {"_id": 0})
    await broadcast_the_eye_event("rma.updated", fresh)
    return {"ok": True, "rma": fresh}


@router.get("/admin/maintenance/summary")
async def maintenance_summary(request: Request):
    await _require_admin(request)

    open_work_orders = await db.the_eye_work_orders.count_documents(
        {"status": {"$nin": ["completed", "cancelled"]}}
    )
    waiting_parts = await db.the_eye_work_orders.count_documents({"status": "waiting_parts"})
    active_rma = await db.the_eye_rma.count_documents(
        {"status": {"$nin": ["closed", "credited", "rejected"]}}
    )

    inventory_rows = await db.the_eye_inventory.find(
        {"status": {"$nin": ["retired", "replaced"]}},
        {"_id": 0, "quantity": 1, "reserved_quantity": 1, "reorder_point": 1},
    ).to_list(10000)
    low_stock = sum(
        1 for row in inventory_rows
        if int(row.get("quantity") or 0) - int(row.get("reserved_quantity") or 0) <= int(row.get("reorder_point") or 0)
    )

    return {
        "ok": True,
        "open_work_orders": open_work_orders,
        "waiting_parts": waiting_parts,
        "active_rma": active_rma,
        "low_stock_items": low_stock,
        "inventory_items": len(inventory_rows),
    }
