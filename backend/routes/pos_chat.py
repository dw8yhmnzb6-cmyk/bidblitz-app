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
        "status": "approved" if auto_approve else "pending",
        "decided_by": user_id if auto_approve else None,
        "decided_at": now_iso() if auto_approve else None,
        "created_at": now_iso(),
    }
    await db.pos_refund_requests.insert_one(doc)
    doc.pop("_id", None)

    # Notify managers (in-store notification)
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

    await _audit(user_id, "refund.request", {"request_id": rr_id, "auto": auto_approve})

    if auto_approve:
        result = await _execute_approved_refund(doc)
        return {"ok": True, "request": doc, "auto_approved": True, "refund": result}

    return {"ok": True, "request": doc, "auto_approved": False, "message": "Manager muss freigeben"}


async def _execute_approved_refund(rr: dict):
    """Run the actual refund via existing pos_system endpoints."""
    from routes.pos_system import refund_payment, RefundRequest
    from routes.pos_inventory import refund_with_items, ItemReturnRequest

    # Build a fake Request with the manager's user already verified is unnecessary —
    # we directly call the engine via core functions.
    # Simpler: use direct DB writes mirroring refund_payment / refund_with_items.
    payment = await db.pos_payments.find_one({"payment_id": rr["payment_id"]})
    if not payment or payment["status"] not in {"paid", "partial_refund"}:
        return {"ok": False, "error": "Zahlung nicht erstattbar"}

    refund_id = short_id("RFD", 10)
    method = payment["method"]
    amount = float(rr["amount"])

    if method in ("wallet_qr", "barcode") and payment.get("customer_id"):
        from bson import ObjectId
        from core.payment_engine import credit_wallet, TransactionType
        merchant = await db.pos_merchants.find_one({"merchant_id": payment["merchant_id"]})
        if merchant:
            await db.users.update_one(
                {"_id": ObjectId(merchant["owner_id"])}, {"$inc": {"balance": -amount}}
            )
            await db.pos_merchants.update_one(
                {"merchant_id": payment["merchant_id"]},
                {"$inc": {"settlement_balance": -amount}},
            )
        await credit_wallet(
            user_id=payment["customer_id"],
            amount=amount,
            tx_type=TransactionType.REFUND,
            description=f"POS Refund {payment['payment_id']}",
            reference=refund_id,
        )

    # Restock items
    if rr.get("restock") and rr.get("items"):
        from bson import ObjectId  # noqa
        for it in rr["items"]:
            pid = it.get("product_id")
            qty = float(it.get("quantity", 0) or 0)
            if not pid or qty <= 0:
                continue
            product = await db.pos_products.find_one({"product_id": pid})
            if not product:
                continue
            before = float(product.get("stock", 0))
            after = round(before + qty, 3)
            await db.pos_products.update_one(
                {"product_id": pid}, {"$set": {"stock": after, "updated_at": now_iso()}}
            )
            await db.pos_stock_movements.insert_one({
                "movement_id": short_id("MOV", 10),
                "product_id": pid,
                "product_name": product["name"],
                "merchant_id": payment["merchant_id"],
                "store_id": payment["store_id"],
                "type": "return",
                "quantity": qty,
                "before_stock": before,
                "after_stock": after,
                "reference_id": refund_id,
                "created_by": rr["decided_by"] or rr["requested_by"],
                "note": f"Approved refund {rr['request_id']}",
                "created_at": now_iso(),
            })

    await db.pos_refunds.insert_one({
        "refund_id": refund_id,
        "payment_id": payment["payment_id"],
        "store_id": payment["store_id"],
        "merchant_id": payment["merchant_id"],
        "amount": amount,
        "method": method,
        "reason": rr.get("reason", ""),
        "request_id": rr["request_id"],
        "issued_by": rr["decided_by"] or rr["requested_by"],
        "issued_at": now_iso(),
    })
    new_status = "refunded" if amount >= float(payment["amount"]) else "partial_refund"
    await db.pos_payments.update_one(
        {"payment_id": payment["payment_id"]},
        {"$set": {"status": new_status}, "$inc": {"refunded_total": amount}},
    )
    await db.pos_refund_requests.update_one(
        {"request_id": rr["request_id"]},
        {"$set": {"refund_id": refund_id, "executed_at": now_iso()}}
    )
    return {"ok": True, "refund_id": refund_id, "status": new_status, "amount": amount}


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
    if rr["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Bereits {rr['status']}")
    await _require_store_access(user, rr["store_id"], {"merchant_admin", "store_manager", "accountant"})

    user_id = str(user["_id"])
    rr["decided_by"] = user_id
    rr["decided_at"] = now_iso()
    rr["status"] = "approved"
    rr["decision_note"] = req.note

    result = await _execute_approved_refund(rr)
    await db.pos_refund_requests.update_one(
        {"request_id": req.request_id},
        {"$set": {
            "status": "approved",
            "decided_by": user_id,
            "decided_at": rr["decided_at"],
            "decision_note": req.note or "",
            "refund_id": result.get("refund_id"),
        }},
    )

    # Notify cashier in chat
    await db.pos_chat_messages.insert_one({
        "msg_id": short_id("MSG", 8),
        "store_id": rr["store_id"],
        "thread": f"refund:{req.request_id}",
        "sender_id": user_id,
        "sender_name": user.get("name", ""),
        "text": f"✓ Refund €{rr['amount']:.2f} freigegeben",
        "system": True,
        "created_at": now_iso(),
    })
    await _audit(user_id, "refund.approve", {"request_id": req.request_id})
    return {"ok": True, "result": result}


@router.post("/refund-requests/reject")
async def reject_refund(req: ApprovalDecision, request: Request):
    user = await get_current_user(request)
    rr = await db.pos_refund_requests.find_one({"request_id": req.request_id})
    if not rr:
        raise HTTPException(status_code=404, detail="Anfrage nicht gefunden")
    if rr["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Bereits {rr['status']}")
    await _require_store_access(user, rr["store_id"], {"merchant_admin", "store_manager", "accountant"})

    user_id = str(user["_id"])
    await db.pos_refund_requests.update_one(
        {"request_id": req.request_id},
        {"$set": {
            "status": "rejected",
            "decided_by": user_id,
            "decided_at": now_iso(),
            "decision_note": req.note or "",
        }},
    )
    await db.pos_chat_messages.insert_one({
        "msg_id": short_id("MSG", 8),
        "store_id": rr["store_id"],
        "thread": f"refund:{req.request_id}",
        "sender_id": user_id,
        "sender_name": user.get("name", ""),
        "text": f"✗ Refund €{rr['amount']:.2f} abgelehnt: {req.note or ''}",
        "system": True,
        "created_at": now_iso(),
    })
    await _audit(user_id, "refund.reject", {"request_id": req.request_id})
    return {"ok": True}


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
