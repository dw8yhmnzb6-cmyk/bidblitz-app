"""
BidBlitz V2 - CSV Export & Reporting Routes
Generates CSV exports for Users, Merchants, and Admins with filter support.
"""

import io
import csv
from datetime import datetime, timezone
from fastapi import APIRouter, Request, Query
from fastapi.responses import StreamingResponse
from core.database import db
from core.security import get_current_user

router = APIRouter(prefix="/api/export", tags=["export"])


def build_date_query(date_from: str = None, date_to: str = None):
    q = {}
    if date_from:
        q["$gte"] = date_from
    if date_to:
        q["$lte"] = date_to
    return {"created_at": q} if q else {}


def csv_response(rows: list, headers: list, filename: str):
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(headers)
    for row in rows:
        writer.writerow(row)
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ──────────────────────────────────────────
# USER EXPORTS
# ──────────────────────────────────────────

@router.get("/user/transactions")
async def export_user_transactions(
    request: Request,
    date_from: str = Query(None),
    date_to: str = Query(None),
    type: str = Query(None),
    status: str = Query(None),
):
    user = await get_current_user(request)
    user_id = str(user["_id"])

    query = {"user_id": user_id}
    date_q = build_date_query(date_from, date_to)
    if date_q:
        query.update(date_q)
    if type:
        query["type"] = type
    if status:
        query["status"] = status

    txns = await db.transactions.find(query, {"_id": 0}).sort("created_at", -1).to_list(5000)

    headers = ["Date", "Reference", "Type", "Description", "Amount (EUR)", "Fee (EUR)", "Status"]
    rows = []
    for t in txns:
        rows.append([
            t.get("created_at", ""),
            t.get("reference", ""),
            t.get("type", ""),
            t.get("description", t.get("merchant_name", "")),
            t.get("amount", 0),
            t.get("fee_amount", 0),
            t.get("status", ""),
        ])

    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    return csv_response(rows, headers, f"bidblitz_transactions_{ts}.csv")


@router.get("/user/topups")
async def export_user_topups(
    request: Request,
    date_from: str = Query(None),
    date_to: str = Query(None),
):
    user = await get_current_user(request)
    user_id = str(user["_id"])

    query = {"user_id": user_id, "type": "topup"}
    date_q = build_date_query(date_from, date_to)
    if date_q:
        query.update(date_q)

    txns = await db.transactions.find(query, {"_id": 0}).sort("created_at", -1).to_list(5000)

    headers = ["Date", "Reference", "Amount (EUR)", "Payment Method", "Status"]
    rows = []
    for t in txns:
        rows.append([
            t.get("created_at", ""),
            t.get("reference", ""),
            t.get("amount", 0),
            t.get("payment_method", ""),
            t.get("status", ""),
        ])

    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    return csv_response(rows, headers, f"bidblitz_topups_{ts}.csv")


@router.get("/user/payments")
async def export_user_payments(
    request: Request,
    date_from: str = Query(None),
    date_to: str = Query(None),
    direction: str = Query(None, description="sent or received"),
):
    user = await get_current_user(request)
    user_id = str(user["_id"])

    query = {"user_id": user_id, "type": {"$in": ["payment", "send", "receive", "merchant_credit"]}}
    date_q = build_date_query(date_from, date_to)
    if date_q:
        query.update(date_q)

    if direction == "sent":
        query["type"] = {"$in": ["payment", "send"]}
    elif direction == "received":
        query["type"] = {"$in": ["receive", "merchant_credit"]}

    txns = await db.transactions.find(query, {"_id": 0}).sort("created_at", -1).to_list(5000)

    headers = ["Date", "Reference", "Type", "Recipient/Sender", "Amount (EUR)", "Fee (EUR)", "Status"]
    rows = []
    for t in txns:
        rows.append([
            t.get("created_at", ""),
            t.get("reference", ""),
            t.get("type", ""),
            t.get("merchant_name", t.get("description", "")),
            t.get("amount", 0),
            t.get("fee_amount", 0),
            t.get("status", ""),
        ])

    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    return csv_response(rows, headers, f"bidblitz_payments_{ts}.csv")


# ──────────────────────────────────────────
# MERCHANT EXPORTS
# ──────────────────────────────────────────

@router.get("/merchant/payments")
async def export_merchant_payments(
    request: Request,
    date_from: str = Query(None),
    date_to: str = Query(None),
    status: str = Query(None),
):
    user = await get_current_user(request)
    user_id = str(user["_id"])

    query = {"user_id": user_id, "type": {"$in": ["merchant_credit", "payment"]}}
    date_q = build_date_query(date_from, date_to)
    if date_q:
        query.update(date_q)
    if status:
        query["status"] = status

    txns = await db.transactions.find(query, {"_id": 0}).sort("created_at", -1).to_list(5000)

    headers = ["Date", "Reference", "Customer", "Gross (EUR)", "Fee (EUR)", "Net (EUR)", "Status"]
    rows = []
    for t in txns:
        gross = abs(t.get("gross_amount", t.get("amount", 0)))
        fee = t.get("fee_amount", 0)
        net = abs(t.get("net_amount", t.get("amount", 0)))
        rows.append([
            t.get("created_at", ""),
            t.get("reference", ""),
            t.get("description", t.get("merchant_name", "")),
            round(gross, 2),
            round(fee, 2),
            round(net, 2),
            t.get("status", ""),
        ])

    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    return csv_response(rows, headers, f"bidblitz_merchant_payments_{ts}.csv")


@router.get("/merchant/fees")
async def export_merchant_fees(
    request: Request,
    date_from: str = Query(None),
    date_to: str = Query(None),
):
    user = await get_current_user(request)
    user_id = str(user["_id"])

    query = {"user_id": user_id, "type": {"$in": ["merchant_credit", "payment"]}, "fee_amount": {"$gt": 0}}
    date_q = build_date_query(date_from, date_to)
    if date_q:
        query.update(date_q)

    txns = await db.transactions.find(query, {"_id": 0}).sort("created_at", -1).to_list(5000)

    headers = ["Date", "Reference", "Transaction Amount (EUR)", "Fee Rate (%)", "Fee Amount (EUR)"]
    rows = []
    total_fees = 0
    for t in txns:
        gross = abs(t.get("gross_amount", t.get("amount", 0)))
        fee = t.get("fee_amount", 0)
        rate = round((fee / gross * 100), 2) if gross > 0 else 0
        total_fees += fee
        rows.append([
            t.get("created_at", ""),
            t.get("reference", ""),
            round(gross, 2),
            rate,
            round(fee, 2),
        ])
    # Summary row
    rows.append(["", "", "", "TOTAL", round(total_fees, 2)])

    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    return csv_response(rows, headers, f"bidblitz_merchant_fees_{ts}.csv")


@router.get("/merchant/payouts")
async def export_merchant_payouts(
    request: Request,
    date_from: str = Query(None),
    date_to: str = Query(None),
    status: str = Query(None),
):
    user = await get_current_user(request)
    user_id = str(user["_id"])

    merchant = await db.merchants.find_one({"user_id": user_id})
    if not merchant:
        return csv_response([], ["No merchant profile found"], "empty.csv")

    query = {"merchant_id": str(merchant["_id"])}
    date_q = build_date_query(date_from, date_to)
    if date_q:
        query.update(date_q)
    if status:
        query["status"] = status

    payouts = await db.payouts.find(query, {"_id": 0}).sort("created_at", -1).to_list(5000)

    headers = ["Date", "Reference", "Amount (EUR)", "Fee (EUR)", "Net (EUR)", "Status", "Processed At"]
    rows = []
    for p in payouts:
        rows.append([
            p.get("created_at", ""),
            p.get("reference", ""),
            p.get("amount", 0),
            p.get("fee", 0),
            p.get("net_amount", 0),
            p.get("status", ""),
            p.get("processed_at", ""),
        ])

    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    return csv_response(rows, headers, f"bidblitz_merchant_payouts_{ts}.csv")


@router.get("/merchant/settlements")
async def export_merchant_settlements(
    request: Request,
    date_from: str = Query(None),
    date_to: str = Query(None),
):
    user = await get_current_user(request)
    user_id = str(user["_id"])

    merchant = await db.merchants.find_one({"user_id": user_id})
    if not merchant:
        return csv_response([], ["No merchant profile found"], "empty.csv")

    # Aggregate daily settlements from payments
    pipeline = [
        {"$match": {"user_id": user_id, "type": {"$in": ["merchant_credit", "payment"]}}},
    ]
    if date_from or date_to:
        date_match = {}
        if date_from:
            date_match["$gte"] = date_from
        if date_to:
            date_match["$lte"] = date_to
        pipeline[0]["$match"]["created_at"] = date_match

    pipeline.extend([
        {"$addFields": {"date_day": {"$substr": ["$created_at", 0, 10]}}},
        {"$group": {
            "_id": "$date_day",
            "total_gross": {"$sum": {"$abs": "$gross_amount"}},
            "total_fees": {"$sum": "$fee_amount"},
            "total_net": {"$sum": {"$abs": "$net_amount"}},
            "txn_count": {"$sum": 1},
        }},
        {"$sort": {"_id": -1}},
    ])

    results = await db.transactions.aggregate(pipeline).to_list(1000)

    headers = ["Date", "Transactions", "Gross (EUR)", "Fees (EUR)", "Net Settlement (EUR)"]
    rows = []
    grand_gross = grand_fees = grand_net = 0
    for r in results:
        gross = round(r.get("total_gross", 0), 2)
        fees = round(r.get("total_fees", 0), 2)
        net = round(r.get("total_net", 0), 2)
        grand_gross += gross
        grand_fees += fees
        grand_net += net
        rows.append([r["_id"], r["txn_count"], gross, fees, net])
    rows.append(["TOTAL", "", round(grand_gross, 2), round(grand_fees, 2), round(grand_net, 2)])

    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    return csv_response(rows, headers, f"bidblitz_merchant_settlements_{ts}.csv")


# ──────────────────────────────────────────
# ADMIN EXPORTS
# ──────────────────────────────────────────

async def require_admin(request: Request):
    from fastapi import HTTPException
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


@router.get("/admin/transactions")
async def export_admin_transactions(
    request: Request,
    date_from: str = Query(None),
    date_to: str = Query(None),
    type: str = Query(None),
    status: str = Query(None),
):
    await require_admin(request)

    query = {}
    date_q = build_date_query(date_from, date_to)
    if date_q:
        query.update(date_q)
    if type:
        query["type"] = type
    if status:
        query["status"] = status

    txns = await db.transactions.find(query, {"_id": 0}).sort("created_at", -1).to_list(10000)

    headers = ["Date", "Reference", "User ID", "Type", "Description", "Amount (EUR)", "Fee (EUR)", "Gross (EUR)", "Net (EUR)", "Status"]
    rows = []
    for t in txns:
        rows.append([
            t.get("created_at", ""),
            t.get("reference", ""),
            t.get("user_id", ""),
            t.get("type", ""),
            t.get("description", t.get("merchant_name", "")),
            t.get("amount", 0),
            t.get("fee_amount", 0),
            t.get("gross_amount", ""),
            t.get("net_amount", ""),
            t.get("status", ""),
        ])

    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    return csv_response(rows, headers, f"bidblitz_admin_transactions_{ts}.csv")


@router.get("/admin/payouts")
async def export_admin_payouts(
    request: Request,
    date_from: str = Query(None),
    date_to: str = Query(None),
    status: str = Query(None),
):
    await require_admin(request)

    query = {}
    date_q = build_date_query(date_from, date_to)
    if date_q:
        query.update(date_q)
    if status:
        query["status"] = status

    payouts = await db.payouts.find(query, {"_id": 0}).sort("created_at", -1).to_list(10000)

    headers = ["Date", "Reference", "Merchant", "User ID", "Amount (EUR)", "Fee (EUR)", "Net (EUR)", "Status", "Processed At"]
    rows = []
    for p in payouts:
        rows.append([
            p.get("created_at", ""),
            p.get("reference", ""),
            p.get("merchant_name", ""),
            p.get("user_id", ""),
            p.get("amount", 0),
            p.get("fee", 0),
            p.get("net_amount", 0),
            p.get("status", ""),
            p.get("processed_at", ""),
        ])

    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    return csv_response(rows, headers, f"bidblitz_admin_payouts_{ts}.csv")


@router.get("/admin/merchants")
async def export_admin_merchants(request: Request):
    await require_admin(request)

    merchants = await db.merchants.find({}, {"_id": 0}).sort("created_at", -1).to_list(5000)

    headers = ["User ID", "Business Name", "Gross Earnings", "Net Earnings", "Total Fees", "Available Payout", "Pending Payout", "Total Transactions", "Created At"]
    rows = []
    for m in merchants:
        rows.append([
            m.get("user_id", ""),
            m.get("business_name", ""),
            round(m.get("gross_earnings", 0), 2),
            round(m.get("total_earnings", 0), 2),
            round(m.get("total_fees", 0), 2),
            round(m.get("available_payout", 0), 2),
            round(m.get("pending_payout", 0), 2),
            m.get("total_transactions", 0),
            m.get("created_at", ""),
        ])

    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    return csv_response(rows, headers, f"bidblitz_admin_merchants_{ts}.csv")


@router.get("/admin/revenue")
async def export_admin_revenue(
    request: Request,
    date_from: str = Query(None),
    date_to: str = Query(None),
):
    await require_admin(request)

    pipeline = [
        {"$match": {"fee_amount": {"$gt": 0}}},
    ]
    if date_from or date_to:
        date_match = {}
        if date_from:
            date_match["$gte"] = date_from
        if date_to:
            date_match["$lte"] = date_to
        pipeline[0]["$match"]["created_at"] = date_match

    pipeline.extend([
        {"$addFields": {"date_day": {"$substr": ["$created_at", 0, 10]}}},
        {"$group": {
            "_id": {"date": "$date_day", "type": "$type"},
            "total_volume": {"$sum": {"$abs": "$amount"}},
            "total_fees": {"$sum": "$fee_amount"},
            "count": {"$sum": 1},
        }},
        {"$sort": {"_id.date": -1}},
    ])

    results = await db.transactions.aggregate(pipeline).to_list(10000)

    headers = ["Date", "Transaction Type", "Volume (EUR)", "Fee Revenue (EUR)", "Transaction Count"]
    rows = []
    total_volume = total_fees = 0
    for r in results:
        vol = round(r.get("total_volume", 0), 2)
        fees = round(r.get("total_fees", 0), 2)
        total_volume += vol
        total_fees += fees
        rows.append([r["_id"]["date"], r["_id"]["type"], vol, fees, r["count"]])
    rows.append(["TOTAL", "", round(total_volume, 2), round(total_fees, 2), ""])

    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    return csv_response(rows, headers, f"bidblitz_admin_revenue_{ts}.csv")


@router.get("/admin/users")
async def export_admin_users(request: Request):
    await require_admin(request)

    users = await db.users.find({}, {"password_hash": 0}).sort("created_at", -1).to_list(10000)

    headers = ["ID", "Name", "Email", "Role", "Balance (EUR)", "Created At"]
    rows = []
    for u in users:
        rows.append([
            str(u.get("_id", "")),
            u.get("name", ""),
            u.get("email", ""),
            u.get("role", "user"),
            round(u.get("balance", 0), 2),
            u.get("created_at", ""),
        ])

    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    return csv_response(rows, headers, f"bidblitz_admin_users_{ts}.csv")


# ──────────────────────────────────────────
# REPORTING SUMMARIES (JSON)
# ──────────────────────────────────────────

@router.get("/report/user/summary")
async def user_report_summary(
    request: Request,
    date_from: str = Query(None),
    date_to: str = Query(None),
):
    user = await get_current_user(request)
    user_id = str(user["_id"])

    query = {"user_id": user_id}
    date_q = build_date_query(date_from, date_to)
    if date_q:
        query.update(date_q)

    pipeline = [
        {"$match": query},
        {"$group": {
            "_id": "$type",
            "count": {"$sum": 1},
            "total": {"$sum": "$amount"},
            "total_fees": {"$sum": {"$ifNull": ["$fee_amount", 0]}},
        }},
    ]
    results = await db.transactions.aggregate(pipeline).to_list(20)

    summary = {}
    total_in = 0
    total_out = 0
    total_fees = 0
    total_count = 0
    for r in results:
        t = r["_id"]
        summary[t] = {"count": r["count"], "total": round(r["total"], 2), "fees": round(r["total_fees"], 2)}
        total_count += r["count"]
        total_fees += r["total_fees"]
        if r["total"] > 0:
            total_in += r["total"]
        else:
            total_out += abs(r["total"])

    return {
        "period": {"from": date_from, "to": date_to},
        "total_transactions": total_count,
        "total_income": round(total_in, 2),
        "total_spent": round(total_out, 2),
        "total_fees": round(total_fees, 2),
        "by_type": summary,
    }


@router.get("/report/merchant/summary")
async def merchant_report_summary(
    request: Request,
    date_from: str = Query(None),
    date_to: str = Query(None),
):
    user = await get_current_user(request)
    user_id = str(user["_id"])

    query = {"user_id": user_id, "type": {"$in": ["merchant_credit", "payment"]}}
    date_q = build_date_query(date_from, date_to)
    if date_q:
        query.update(date_q)

    pipeline = [
        {"$match": query},
        {"$group": {
            "_id": None,
            "total_gross": {"$sum": {"$abs": {"$ifNull": ["$gross_amount", "$amount"]}}},
            "total_fees": {"$sum": {"$ifNull": ["$fee_amount", 0]}},
            "total_net": {"$sum": {"$abs": {"$ifNull": ["$net_amount", "$amount"]}}},
            "count": {"$sum": 1},
        }},
    ]
    agg = await db.transactions.aggregate(pipeline).to_list(1)
    stats = agg[0] if agg else {"total_gross": 0, "total_fees": 0, "total_net": 0, "count": 0}

    # Payout summary
    merchant = await db.merchants.find_one({"user_id": user_id})
    payout_query = {}
    if merchant:
        payout_query["merchant_id"] = str(merchant["_id"])
    payout_pipeline = [
        {"$match": payout_query},
        {"$group": {"_id": "$status", "count": {"$sum": 1}, "total": {"$sum": "$net_amount"}}},
    ]
    payout_agg = await db.payouts.aggregate(payout_pipeline).to_list(10) if merchant else []
    payout_summary = {r["_id"]: {"count": r["count"], "total": round(r["total"], 2)} for r in payout_agg}

    return {
        "period": {"from": date_from, "to": date_to},
        "total_payments": stats["count"],
        "total_gross": round(stats["total_gross"], 2),
        "total_fees": round(stats["total_fees"], 2),
        "total_net": round(stats["total_net"], 2),
        "payouts": payout_summary,
    }


@router.get("/report/admin/summary")
async def admin_report_summary(
    request: Request,
    date_from: str = Query(None),
    date_to: str = Query(None),
):
    await require_admin(request)

    query = {}
    date_q = build_date_query(date_from, date_to)
    if date_q:
        query.update(date_q)

    # Transaction aggregation
    txn_pipeline = [
        {"$match": query},
        {"$group": {
            "_id": "$type",
            "count": {"$sum": 1},
            "volume": {"$sum": {"$abs": "$amount"}},
            "fees": {"$sum": {"$ifNull": ["$fee_amount", 0]}},
        }},
    ]
    txn_agg = await db.transactions.aggregate(txn_pipeline).to_list(20)

    total_volume = sum(r["volume"] for r in txn_agg)
    total_fees = sum(r["fees"] for r in txn_agg)
    total_count = sum(r["count"] for r in txn_agg)
    by_type = {r["_id"]: {"count": r["count"], "volume": round(r["volume"], 2), "fees": round(r["fees"], 2)} for r in txn_agg}

    # Payout stats
    payout_pipeline = [
        {"$group": {"_id": "$status", "count": {"$sum": 1}, "total": {"$sum": "$net_amount"}}},
    ]
    payout_agg = await db.payouts.aggregate(payout_pipeline).to_list(10)
    payouts = {r["_id"]: {"count": r["count"], "total": round(r["total"], 2)} for r in payout_agg}

    user_count = await db.users.count_documents({})
    merchant_count = await db.merchants.count_documents({})

    return {
        "period": {"from": date_from, "to": date_to},
        "total_transactions": total_count,
        "total_volume": round(total_volume, 2),
        "total_platform_fees": round(total_fees, 2),
        "by_type": by_type,
        "payouts": payouts,
        "total_users": user_count,
        "total_merchants": merchant_count,
    }
