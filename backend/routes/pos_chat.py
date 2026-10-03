"""
BidBlitz POS Refund Approval — Cashier requests, Manager approves.
Plus lightweight in-app chat between staff at the same store.
"""

import secrets
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from core.database import db
from core.security import get_current_user
from routes.pos_system import (
    _require_store_access, _audit, short_id, now_iso, _is_admin,
)

router = APIRouter(prefix="/api/pos", tags=["POS Approval & Chat"])


# ───────────────────────────────────────────────────────────────────────
# 1. REFUND APPROVAL REQUESTS
# ───────────────────────────────────────────────────────────────────────
class RefundRequestCreate(BaseModel):
    payment_id: str
    amount: Optional[float] = None
    reason: str = ""
    items: Optional[List[Dict[str, Any]]] = None  # for item-level refunds
    restock: bool = True


@router.post("/refund-requests/create")
async def create_refund_request(req: RefundRequestCreate, request: Request):
    """Cashier creates a refund request. Manager must approve before money moves."""
    user = await get_current_user(request)
    user_id = str(user["_id"])

    payment = await db.pos_payments.find_one({"payment_id": req.payment_id})
    if not payment:
        raise HTTPException(status_code=404, detail="Zahlung nicht gefunden")
    await _require_store_access(user, payment["store_id"])  # must be staff

    # If user is already manager+, auto-approve
    role_doc = await db.pos_staff.find_one(
        {"user_id": user_id, "store_id": payment["store_id"], "active": True}, {"_id": 0}
    )
    role = (role_doc or {}).get("role")
    auto_approve = role in {"merchant_admin", "store_manager", "accountant"} or await _is_admin(user)

    rr_id = short_id("RR", 10)
    amount = float(req.amount) if req.amount else float(payment["amount"])
    doc = {
        "request_id": rr_id,
        "payment_id": req.payment_id,
        "store_id": payment["store_id"],
        "merchant_id": payment["merchant_id"],
        "requested_by": user_id,
        "requested_by_name": user.get("name", user.get("email", "")),
        "amount": amount,
        "reason": req.reason,
        "items": req.items,
        "restock": req.restock,
        "status": "processing" if auto_approve else "pending",
        "decided_by": user_id if auto_approve else None,
        "decided_at": now_iso() if auto_approve else None,
        "created_at": now_iso(),
    }
    await db.pos_refund_requests.insert_one(doc)
    doc.pop("_id", None)

    # Notify managers (in-store notification + email + in-app push)
    if not auto_approve:
        await db.pos_chat_messages.insert_one({
            "msg_id": short_id("MSG", 8),
            "store_id": payment["store_id"],
            "thread": f"refund:{rr_id}",
            "sender_id": user_id,
            "sender_name": user.get("name", ""),
            "text": f"Refund-Anfrage €{amount:.2f} — {req.reason or 'Ohne Grund'}",
            "system": True,
            "created_at": now_iso(),
        })

        # Find store managers / merchant admins
        managers = await db.pos_staff.find(
            {"store_id": payment["store_id"], "active": True,
             "role": {"$in": ["merchant_admin", "store_manager", "accountant"]}},
            {"_id": 0, "user_id": 1, "user_email": 1},
        ).to_list(50)

        store = await db.pos_stores.find_one({"store_id": payment["store_id"]}, {"_id": 0})
        store_name = store.get("name", "") if store else ""

        for mgr in managers:
            if mgr["user_id"] == user_id:
                continue
            # In-app notification
            await db.notifications.insert_one({
                "id": secrets.token_hex(8) if False else short_id("NTF", 8),
                "user_id": mgr["user_id"],
                "type": "pos_refund_request",
                "title": "💸 Refund-Freigabe nötig",
                "message": f"{user.get('name', 'Cashier')} hat €{amount:.2f} angefragt — {store_name}",
                "data": {"request_id": rr_id, "store_id": payment["store_id"]},
                "read": False,
                "created_at": now_iso(),
            })
            # Email
            email = mgr.get("user_email")
            if email:
                try:
                    from core.email import send_email
                    html = f"""
                    <h2>POS Refund-Anfrage</h2>
                    <p>Hi,</p>
                    <p><b>{user.get('name', 'Ein Cashier')}</b> hat eine Refund-Anfrage gesendet:</p>
                    <ul>
                      <li>Betrag: <b>€{amount:.2f}</b></li>
                      <li>Filiale: {store_name}</li>
                      <li>Grund: {req.reason or '—'}</li>
                      <li>Zahlungs-ID: {req.payment_id}</li>
                    </ul>
                    <p>Bitte prüfe und gib in der BidBlitz POS-App frei.</p>
                    <p style="font-size:12px;color:#888">Anfrage-ID: {rr_id}</p>
                    """
                    send_email(email, f"POS Refund €{amount:.2f} — Freigabe nötig", html)
                except Exception:
                    pass

    await _audit(user_id, "refund.request", {"request_id": rr_id, "auto": auto_approve})

    if auto_approve:
        try:
            result = await _execute_approved_refund(doc, user, request)
            await db.pos_refund_requests.update_one(
                {"request_id": rr_id, "status": "processing"},
                {"$set": {"status": "approved", "refund_id": result.get("refund_id"), "executed_at": now_iso()}},
            )
            doc["status"] = "approved"
            doc["refund_id"] = result.get("refund_id")
            return {"ok": True, "request": doc, "auto_approved": True, "refund": result}
        except Exception:
            await db.pos_refund_requests.update_one(
                {"request_id": rr_id, "status": "processing"},
                {"$set": {"status": "failed_review", "failed_at": now_iso()}},
            )
            raise

    return {"ok": True, "request": doc, "auto_approved": False, "message": "Manager muss freigeben"}


async def _execute_approved_refund(rr: dict, user: dict, request: Request):
    """Execute an approved refund through the canonical POS refund engine."""
    payment = await db.pos_payments.find_one({"payment_id": rr["payment_id"]})
    if not payment or payment.get("status") not in {"paid", "partial_refund"}:
        raise HTTPException(status_code=400, detail="Zahlung nicht erstattbar")

    from services.pos_security import get_actor_context, execute_refund_action
    actor = await get_actor_context(user, payment["store_id"], payment.get("register_id", ""))
    refund_doc = await execute_refund_action(
        {
            "payment_id": rr["payment_id"],
            "amount": float(rr["amount"]),
            "reason": rr.get("reason", ""),
            "idempotency_key": f"refund-request:{rr['request_id']}",
        },
        actor,
        request=request,
        approval_id=rr["request_id"],
    )
    refund_id = refund_doc["refund_id"]

    if rr.get("restock") and rr.get("items"):
        refund_marker = refund_id.replace(".", "_")
        for it in rr["items"]:
            pid = it.get("product_id")
            qty = float(it.get("quantity", 0) or 0)
            if not pid or qty <= 0:
                continue
            product = await db.pos_products.find_one({"product_id": pid})
            if not product:
                continue
            marker_field = f"return_markers.{refund_marker}"
            before = float(product.get("stock", 0))
            stock_update = await db.pos_products.update_one(
                {"product_id": pid, marker_field: {"$exists": False}},
                {
                    "$inc": {"stock": qty},
                    "$set": {marker_field: {"quantity": qty, "refund_id": refund_id}, "updated_at": now_iso()},
                },
            )
            if stock_update.modified_count != 1:
                continue
            fresh = await db.pos_products.find_one({"product_id": pid}, {"stock": 1, "_id": 0}) or {}
            after = float(fresh.get("stock", before + qty))
            movement_id = f"MOV-{refund_id}-{pid}"
            await db.pos_stock_movements.update_one(
                {"movement_id": movement_id},
                {"$setOnInsert": {
                    "movement_id": movement_id,
                    "product_id": pid,
                    "product_name": product["name"],
                    "merchant_id": payment["merchant_id"],
                    "store_id": payment["store_id"],
                    "type": "return",
                    "quantity": qty,
                    "before_stock": before,
                    "after_stock": after,
                    "reference_id": refund_id,
                    "created_by": str(user["_id"]),
                    "note": f"Approved refund {rr['request_id']}",
                    "created_at": now_iso(),
                }},
                upsert=True,
            )

    await db.pos_refunds.update_one(
        {"refund_id": refund_id},
        {"$set": {"request_id": rr["request_id"], "items": rr.get("items"), "restocked": bool(rr.get("restock"))}},
    )
    return {"ok": True, "refund_id": refund_id, "status": "completed", "amount": float(refund_doc["amount"])}


@router.get("/refund-requests")
async def list_refund_requests(request: Request, status: Optional[str] = None):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    # Find merchant
    merchant = await db.pos_merchants.find_one({"owner_id": user_id})
    q: Dict[str, Any] = {}
    if not await _is_admin(user):
        if not merchant:
            # Only own requests
            q["requested_by"] = user_id
        else:
            q["merchant_id"] = merchant["merchant_id"]
    if status:
        q["status"] = status
    items = await db.pos_refund_requests.find(q, {"_id": 0}).sort("created_at", -1).limit(200).to_list(200)
    return {"requests": items, "count": len(items)}


class ApprovalDecision(BaseModel):
    request_id: str
    note: Optional[str] = ""


@router.post("/refund-requests/approve")
async def approve_refund(req: ApprovalDecision, request: Request):
    user = await get_current_user(request)
    rr = await db.pos_refund_requests.find_one({"request_id": req.request_id})
    if not rr:
        raise HTTPException(status_code=404, detail="Anfrage nicht gefunden")
    await _require_store_access(user, rr["store_id"], {"merchant_admin", "store_manager", "accountant"})

    user_id = str(user["_id"])
    decided_at = now_iso()
    claim = await db.pos_refund_requests.update_one(
        {"request_id": req.request_id, "status": "pending"},
        {"$set": {
            "status": "processing",
            "decided_by": user_id,
            "decided_at": decided_at,
            "decision_note": req.note or "",
        }},
    )
    if claim.modified_count != 1:
        fresh = await db.pos_refund_requests.find_one({"request_id": req.request_id}, {"_id": 0}) or {}
        if fresh.get("status") == "approved" and fresh.get("refund_id"):
            return {"ok": True, "result": {"refund_id": fresh["refund_id"], "replayed": True}}
        raise HTTPException(status_code=409, detail=f"Anfrage ist bereits {fresh.get('status', 'in Bearbeitung')}")

    rr.update({"decided_by": user_id, "decided_at": decided_at, "status": "processing", "decision_note": req.note or ""})
    try:
        result = await _execute_approved_refund(rr, user, request)
    except Exception:
        await db.pos_refund_requests.update_one(
            {"request_id": req.request_id, "status": "processing"},
            {"$set": {"status": "failed_review", "failed_at": now_iso()}},
        )
        raise

    await db.pos_refund_requests.update_one(
        {"request_id": req.request_id, "status": "processing"},
        {"$set": {"status": "approved", "refund_id": result.get("refund_id"), "executed_at": now_iso()}},
    )
    await db.pos_chat_messages.update_one(
        {"msg_id": f"MSG-REFUND-{req.request_id}"},
        {"$setOnInsert": {
            "msg_id": f"MSG-REFUND-{req.request_id}",
            "store_id": rr["store_id"],
            "thread": f"refund:{req.request_id}",
            "sender_id": user_id,
            "sender_name": user.get("name", ""),
            "text": f"✓ Refund €{rr['amount']:.2f} freigegeben",
            "system": True,
            "created_at": now_iso(),
        }},
        upsert=True,
    )
    await _audit(user_id, "refund.approve", {"request_id": req.request_id})
    return {"ok": True, "result": result}


@router.post("/refund-requests/reject")
async def reject_refund(req: ApprovalDecision, request: Request):
    user = await get_current_user(request)
    rr = await db.pos_refund_requests.find_one({"request_id": req.request_id})
    if not rr:
        raise HTTPException(status_code=404, detail="Anfrage nicht gefunden")
    await _require_store_access(user, rr["store_id"], {"merchant_admin", "store_manager", "accountant"})

    user_id = str(user["_id"])
    transition = await db.pos_refund_requests.update_one(
        {"request_id": req.request_id, "status": "pending"},
        {"$set": {
            "status": "rejected",
            "decided_by": user_id,
            "decided_at": now_iso(),
            "decision_note": req.note or "",
        }},
    )
    if transition.modified_count != 1:
        fresh = await db.pos_refund_requests.find_one({"request_id": req.request_id}, {"_id": 0}) or {}
        if fresh.get("status") == "rejected":
            return {"ok": True, "replayed": True}
        raise HTTPException(status_code=409, detail=f"Anfrage ist bereits {fresh.get('status', 'bearbeitet')}")

    await db.pos_chat_messages.update_one(
        {"msg_id": f"MSG-REFUND-REJECT-{req.request_id}"},
        {"$setOnInsert": {
            "msg_id": f"MSG-REFUND-REJECT-{req.request_id}",
            "store_id": rr["store_id"],
            "thread": f"refund:{req.request_id}",
            "sender_id": user_id,
            "sender_name": user.get("name", ""),
            "text": f"✗ Refund €{rr['amount']:.2f} abgelehnt: {req.note or ''}",
            "system": True,
            "created_at": now_iso(),
        }},
        upsert=True,
    )
    await _audit(user_id, "refund.reject", {"request_id": req.request_id})
    return {"ok": True, "replayed": False}


# ───────────────────────────────────────────────────────────────────────
# 2. STORE CHAT (Cashier ↔ Manager)
# ───────────────────────────────────────────────────────────────────────
class ChatSend(BaseModel):
    store_id: str
    text: str = Field(..., min_length=1, max_length=1000)
    thread: Optional[str] = "general"


@router.post("/chat/send")
async def send_chat(req: ChatSend, request: Request):
    user = await get_current_user(request)
    await _require_store_access(user, req.store_id)
    msg = {
        "msg_id": short_id("MSG", 8),
        "store_id": req.store_id,
        "thread": req.thread or "general",
        "sender_id": str(user["_id"]),
        "sender_name": user.get("name", user.get("email", "")),
        "text": req.text,
        "system": False,
        "created_at": now_iso(),
    }
    await db.pos_chat_messages.insert_one(msg)
    msg.pop("_id", None)
    return {"ok": True, "message": msg}


@router.get("/chat/messages")
async def get_chat(request: Request, store_id: str, thread: str = "general", limit: int = 100):
    user = await get_current_user(request)
    await _require_store_access(user, store_id)
    items = await db.pos_chat_messages.find(
        {"store_id": store_id, "thread": thread}, {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    items.reverse()
    return {"messages": items, "count": len(items)}


@router.get("/chat/threads")
async def list_threads(request: Request, store_id: str):
    """All distinct threads for the store."""
    user = await get_current_user(request)
    await _require_store_access(user, store_id)
    pipeline = [
        {"$match": {"store_id": store_id}},
        {"$sort": {"created_at": -1}},
        {"$group": {
            "_id": "$thread",
            "last_text": {"$first": "$text"},
            "last_at": {"$first": "$created_at"},
            "last_sender": {"$first": "$sender_name"},
        }},
        {"$sort": {"last_at": -1}},
        {"$limit": 50},
    ]
    threads = []
    async for row in db.pos_chat_messages.aggregate(pipeline):
        threads.append({
            "thread": row["_id"],
            "last_text": row.get("last_text"),
            "last_at": row.get("last_at"),
            "last_sender": row.get("last_sender"),
        })
    return {"threads": threads}
