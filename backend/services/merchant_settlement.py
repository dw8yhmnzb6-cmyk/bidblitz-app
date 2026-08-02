from __future__ import annotations

import csv
import io
import secrets
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

from core.database import db, sanitize_doc
from core.money import add_minor, basis_points_fee, from_minor, to_minor

DEFAULT_PAYMENT_BPS = 150
DEFAULT_PLATFORM_BPS = 50
DEFAULT_RESERVE_HOLD_DAYS = 30
DEFAULT_PAYOUT_SCHEDULE = "weekly"
PAYOUT_ACTIVE_STATUSES = {"created", "pending_approval", "processing"}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def short_id(prefix: str, size: int = 10) -> str:
    return f"{prefix}-{secrets.token_hex(max(2, size // 2)).upper()}"


def parse_iso(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


def date_floor(day: datetime) -> datetime:
    return day.astimezone(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)


def build_period(period_type: str, *, start: str | None = None, end: str | None = None, anchor: datetime | None = None) -> tuple[datetime, datetime]:
    anchor = anchor or datetime.now(timezone.utc)
    if period_type == "custom":
        start_dt = parse_iso(start)
        end_dt = parse_iso(end)
        if not start_dt or not end_dt or end_dt <= start_dt:
            raise ValueError("Ungültiger Zeitraum")
        return start_dt.astimezone(timezone.utc), end_dt.astimezone(timezone.utc)
    if period_type == "weekly":
        start_dt = date_floor(anchor - timedelta(days=anchor.weekday()))
        return start_dt, start_dt + timedelta(days=7)
    start_dt = date_floor(anchor)
    return start_dt, start_dt + timedelta(days=1)


@dataclass
class FeeQuote:
    payment_fee_minor: int
    platform_fee_minor: int
    applied_rules: list[dict[str, Any]]


class MerchantFeeService:
    async def list_applicable_rules(self, *, merchant: dict, payment_method: str, country: str, schedule_at: datetime | None = None) -> list[dict[str, Any]]:
        schedule_at = schedule_at or datetime.now(timezone.utc)
        rows = await db.merchant_fee_rules.find({"enabled": True}, {"_id": 0}).sort([("priority", -1), ("valid_from", 1)]).to_list(500)
        result: list[dict[str, Any]] = []
        merchant_plan = merchant.get("plan") or merchant.get("merchant_plan") or "standard"
        for row in rows:
            valid_from = parse_iso(row.get("valid_from"))
            valid_until = parse_iso(row.get("valid_until"))
            if valid_from and valid_from > schedule_at:
                continue
            if valid_until and valid_until < schedule_at:
                continue
            payment_methods = row.get("payment_methods") or []
            merchant_plans = row.get("merchant_plans") or []
            countries = row.get("countries") or []
            merchants = row.get("merchant_ids") or []
            if payment_methods and payment_method not in payment_methods:
                continue
            if merchant_plans and merchant_plan not in merchant_plans:
                continue
            if countries and country not in countries:
                continue
            if merchants and merchant.get("merchant_id") not in merchants:
                continue
            result.append(row)
        return result

    async def quote_sale(self, *, merchant: dict, amount_minor: int, payment_method: str, country: str) -> FeeQuote:
        rules = await self.list_applicable_rules(merchant=merchant, payment_method=payment_method, country=country)
        payment_rule = next((rule for rule in rules if rule.get("fee_type") == "payment"), None)
        platform_rule = next((rule for rule in rules if rule.get("fee_type") == "platform"), None)

        if not payment_rule:
            payment_rule = {
                "rule_id": "DEFAULT-PAYMENT",
                "name": "Default payment fee",
                "fee_type": "payment",
                "percentage_basis_points": 0 if payment_method in {"cash", "voucher"} else int(round(float(merchant.get("fee_rate", DEFAULT_PAYMENT_BPS / 10000)) * 10000)),
                "fixed_minor": 0,
                "currency": "EUR",
                "priority": 0,
            }
        if not platform_rule:
            platform_rule = {
                "rule_id": "DEFAULT-PLATFORM",
                "name": "Default BidBlitz platform fee",
                "fee_type": "platform",
                "percentage_basis_points": 0 if payment_method in {"voucher"} else int(merchant.get("platform_fee_bps") or DEFAULT_PLATFORM_BPS),
                "fixed_minor": 0,
                "currency": "EUR",
                "priority": 0,
            }

        payment_fee_minor = basis_points_fee(amount_minor, int(payment_rule.get("percentage_basis_points") or 0)) + int(payment_rule.get("fixed_minor") or 0)
        platform_fee_minor = basis_points_fee(amount_minor, int(platform_rule.get("percentage_basis_points") or 0)) + int(platform_rule.get("fixed_minor") or 0)
        return FeeQuote(payment_fee_minor=payment_fee_minor, platform_fee_minor=platform_fee_minor, applied_rules=[payment_rule, platform_rule])


fee_service = MerchantFeeService()


async def get_pos_merchant_for_user(user_id: str) -> dict | None:
    merchant = await db.pos_merchants.find_one({"owner_id": user_id}, {"_id": 0})
    if merchant:
        return merchant
    membership = await db.pos_staff.find_one({"user_id": user_id, "active": True}, {"_id": 0, "merchant_id": 1})
    if membership:
        return await db.pos_merchants.find_one({"merchant_id": membership["merchant_id"]}, {"_id": 0})
    return None


async def get_pos_role_for_user(user_id: str, merchant_id: str) -> str:
    merchant = await db.pos_merchants.find_one({"merchant_id": merchant_id}, {"_id": 0, "owner_id": 1})
    if merchant and merchant.get("owner_id") == user_id:
        return "merchant_admin"
    membership = await db.pos_staff.find_one({"user_id": user_id, "merchant_id": merchant_id, "active": True}, {"_id": 0, "role": 1})
    return (membership or {}).get("role", "cashier")


async def ensure_balance_snapshot(merchant_id: str, currency: str = "EUR") -> dict:
    await db.merchant_balance_state.update_one(
        {"merchant_id": merchant_id},
        {"$setOnInsert": {
            "merchant_id": merchant_id,
            "currency": currency,
            "pending_minor": 0,
            "available_minor": 0,
            "reserved_minor": 0,
            "payout_in_progress_minor": 0,
            "paid_out_total_minor": 0,
            "next_payout_date": None,
            "updated_at": now_iso(),
        }},
        upsert=True,
    )
    return await db.merchant_balance_state.find_one({"merchant_id": merchant_id}, {"_id": 0})


async def _upsert_idempotency(scope: str, merchant_id: str, key: str, request_hash: str) -> dict:
    existing = await db.merchant_settlement_idempotency.find_one({"scope": scope, "merchant_id": merchant_id, "idempotency_key": key}, {"_id": 0})
    if existing:
        return existing
    doc = {
        "scope": scope,
        "merchant_id": merchant_id,
        "idempotency_key": key,
        "request_hash": request_hash,
        "status": "claimed",
        "created_at": now_iso(),
    }
    try:
        await db.merchant_settlement_idempotency.insert_one(doc)
    except Exception:
        pass
    return await db.merchant_settlement_idempotency.find_one({"scope": scope, "merchant_id": merchant_id, "idempotency_key": key}, {"_id": 0}) or doc


async def _complete_idempotency(scope: str, merchant_id: str, key: str, response: dict) -> None:
    await db.merchant_settlement_idempotency.update_one(
        {"scope": scope, "merchant_id": merchant_id, "idempotency_key": key},
        {"$set": {"status": "completed", "response": response, "completed_at": now_iso()}},
    )


async def _create_balance_entry(doc: dict[str, Any]) -> dict[str, Any]:
    payload = {**doc, "created_at": doc.get("created_at") or now_iso()}
    await db.merchant_balance_entries.insert_one(payload)
    payload.pop("_id", None)
    return payload


async def sync_sales_and_refunds(merchant: dict) -> None:
    merchant_id = merchant["merchant_id"]
    country = merchant.get("country", "DE")
    sales = await db.pos_sales.find({"merchant_id": merchant_id, "status": "completed"}, {"_id": 0}).to_list(10000)
    for sale in sales:
        existing = await db.merchant_balance_entries.find_one({"merchant_id": merchant_id, "transaction_id": sale["sale_id"], "type": "sale"}, {"_id": 0, "entry_id": 1})
        if existing:
            continue
        amount_minor = to_minor(sale.get("total", 0))
        fee_quote = await fee_service.quote_sale(merchant=merchant, amount_minor=amount_minor, payment_method=sale.get("method", "cash"), country=country)
        explicit_payment_fee_minor = to_minor(sale.get("fee", 0))
        payment_fee_minor = explicit_payment_fee_minor or fee_quote.payment_fee_minor
        platform_fee_minor = fee_quote.platform_fee_minor
        await _create_balance_entry({
            "entry_id": short_id("MBE", 12),
            "merchant_id": merchant_id,
            "branch_id": sale.get("store_id", ""),
            "settlement_id": None,
            "payout_id": None,
            "transaction_id": sale["sale_id"],
            "type": "sale",
            "direction": "credit",
            "amount_minor": amount_minor,
            "currency": "EUR",
            "status": "pending",
            "reference": sale.get("receipt_id", sale["sale_id"]),
            "description": f"POS Verkauf {sale.get('receipt_id', sale['sale_id'])}",
            "posted_at": None,
            "reversed_by": None,
            "metadata": {
                "sale_id": sale["sale_id"],
                "receipt_id": sale.get("receipt_id"),
                "method": sale.get("method"),
                "subtotal_minor": to_minor(sale.get("subtotal", 0)),
                "discount_minor": to_minor(sale.get("discount", 0)),
                "tax_minor": to_minor(sale.get("tax_total", 0)),
                "cashier_id": sale.get("cashier_id", ""),
            },
        })
        if payment_fee_minor > 0:
            await _create_balance_entry({
                "entry_id": short_id("MBE", 12),
                "merchant_id": merchant_id,
                "branch_id": sale.get("store_id", ""),
                "settlement_id": None,
                "payout_id": None,
                "transaction_id": sale["sale_id"],
                "type": "payment_fee",
                "direction": "debit",
                "amount_minor": payment_fee_minor,
                "currency": "EUR",
                "status": "pending",
                "reference": sale.get("receipt_id", sale["sale_id"]),
                "description": f"Payment Fee {sale.get('receipt_id', sale['sale_id'])}",
                "posted_at": None,
                "reversed_by": None,
                "metadata": {"sale_id": sale["sale_id"], "payment_method": sale.get("method")},
            })
        if platform_fee_minor > 0:
            await _create_balance_entry({
                "entry_id": short_id("MBE", 12),
                "merchant_id": merchant_id,
                "branch_id": sale.get("store_id", ""),
                "settlement_id": None,
                "payout_id": None,
                "transaction_id": sale["sale_id"],
                "type": "platform_fee",
                "direction": "debit",
                "amount_minor": platform_fee_minor,
                "currency": "EUR",
                "status": "pending",
                "reference": sale.get("receipt_id", sale["sale_id"]),
                "description": f"BidBlitz Fee {sale.get('receipt_id', sale['sale_id'])}",
                "posted_at": None,
                "reversed_by": None,
                "metadata": {"sale_id": sale["sale_id"], "payment_method": sale.get("method")},
            })

    refunds = await db.pos_refunds.find({"merchant_id": merchant_id}, {"_id": 0}).to_list(5000)
    for refund in refunds:
        existing = await db.merchant_balance_entries.find_one({"merchant_id": merchant_id, "transaction_id": refund["refund_id"], "type": "refund"}, {"_id": 0})
        if existing:
            continue
        original_sale = await db.pos_sales.find_one({"payment_id": refund.get("payment_id")}, {"_id": 0})
        original_entry = None
        original_settlement = None
        refund_status = "pending"
        if original_sale:
            original_entry = await db.merchant_balance_entries.find_one({"merchant_id": merchant_id, "transaction_id": original_sale.get("sale_id"), "type": "sale"}, {"_id": 0, "settlement_id": 1})
            if original_entry and original_entry.get("settlement_id"):
                original_settlement = await db.merchant_settlements.find_one({"settlement_id": original_entry["settlement_id"]}, {"_id": 0, "status": 1})
        if original_settlement and original_settlement.get("status") in {"paid", "partially_paid", "payout_pending", "finalised"}:
            refund_status = "available"
        await _create_balance_entry({
            "entry_id": short_id("MBE", 12),
            "merchant_id": merchant_id,
            "branch_id": refund.get("store_id", ""),
            "settlement_id": (original_entry or {}).get("settlement_id") if original_sale else None,
            "payout_id": None,
            "transaction_id": refund["refund_id"],
            "type": "refund",
            "direction": "debit",
            "amount_minor": to_minor(refund.get("amount", 0)),
            "currency": "EUR",
            "status": refund_status,
            "reference": refund["refund_id"],
            "description": f"Refund {refund['refund_id']}",
            "posted_at": now_iso() if refund_status == "available" else None,
            "reversed_by": None,
            "metadata": {
                "payment_id": refund.get("payment_id"),
                "original_sale_id": (original_sale or {}).get("sale_id"),
                "original_receipt": (original_sale or {}).get("receipt_id"),
                "reason": refund.get("reason", ""),
                "responsible_user": refund.get("issued_by", ""),
            },
        })


async def recompute_balance_snapshot(merchant_id: str) -> dict[str, Any]:
    entries = await db.merchant_balance_entries.find({"merchant_id": merchant_id}, {"_id": 0}).to_list(20000)
    pending_minor = 0
    available_minor = 0
    reserved_minor = 0
    payout_in_progress_minor = 0
    paid_out_total_minor = 0
    for entry in entries:
        sign = 1 if entry.get("direction") == "credit" else -1
        amount_minor = int(entry.get("amount_minor") or 0)
        signed_minor = sign * amount_minor
        status = entry.get("status")
        if status == "pending":
            pending_minor += signed_minor
        elif status in {"available", "finalised"}:
            available_minor += signed_minor
        elif status == "reserved":
            reserved_minor += amount_minor if entry.get("type") == "reserve_hold" else signed_minor
        elif status in {"payout_pending", "processing"}:
            payout_in_progress_minor += amount_minor
        elif status == "paid" and entry.get("type") == "payout":
            paid_out_total_minor += amount_minor
    reserve_holds = await db.merchant_reserves.find({"merchant_id": merchant_id, "mode": "hold", "status": "active"}, {"_id": 0, "amount_minor": 1}).to_list(1000)
    reserved_minor = sum(int(item.get("amount_minor") or 0) for item in reserve_holds) if reserve_holds else reserved_minor
    settings = await db.merchant_settlement_settings.find_one({"merchant_id": merchant_id}, {"_id": 0}) or {}
    next_payout_date = estimate_next_payout_date(settings.get("payout_schedule") or DEFAULT_PAYOUT_SCHEDULE)
    snapshot = {
        "merchant_id": merchant_id,
        "currency": "EUR",
        "pending_minor": pending_minor,
        "available_minor": available_minor,
        "reserved_minor": reserved_minor,
        "payout_in_progress_minor": payout_in_progress_minor,
        "paid_out_total_minor": paid_out_total_minor,
        "next_payout_date": next_payout_date,
        "updated_at": now_iso(),
    }
    await db.merchant_balance_state.update_one({"merchant_id": merchant_id}, {"$set": snapshot}, upsert=True)
    return snapshot


def estimate_next_payout_date(schedule: str) -> str:
    now = datetime.now(timezone.utc)
    if schedule == "daily":
        target = now + timedelta(days=1)
    elif schedule == "twice_monthly":
        day = 15 if now.day < 15 else 1
        month = now.month if now.day < 15 else (1 if now.month == 12 else now.month + 1)
        year = now.year if month != 1 or now.day < 15 else now.year + 1
        target = now.replace(year=year, month=month, day=day)
    elif schedule == "monthly":
        target = (now.replace(day=1) + timedelta(days=32)).replace(day=1)
    else:
        target = now + timedelta(days=max(1, 7 - now.weekday()))
    return target.date().isoformat()


async def get_balance_view(merchant: dict) -> dict[str, Any]:
    await sync_sales_and_refunds(merchant)
    snapshot = await recompute_balance_snapshot(merchant["merchant_id"])
    return {
        "currency": snapshot["currency"],
        "pending_minor": snapshot["pending_minor"],
        "available_minor": snapshot["available_minor"],
        "reserved_minor": snapshot["reserved_minor"],
        "payout_in_progress_minor": snapshot["payout_in_progress_minor"],
        "paid_out_total_minor": snapshot["paid_out_total_minor"],
        "next_payout_date": snapshot.get("next_payout_date"),
    }


async def calculate_settlement_preview(merchant: dict, *, period_type: str = "daily", branch_id: str | None = None, start: str | None = None, end: str | None = None) -> dict[str, Any]:
    await sync_sales_and_refunds(merchant)
    start_dt, end_dt = build_period(period_type, start=start, end=end)
    entries = await db.merchant_balance_entries.find({
        "merchant_id": merchant["merchant_id"],
        "status": "pending",
        "created_at": {"$gte": start_dt.isoformat(), "$lt": end_dt.isoformat()},
        **({"branch_id": branch_id} if branch_id else {}),
    }, {"_id": 0}).to_list(10000)
    tx_ids = [entry.get("transaction_id") for entry in entries if entry.get("type") == "sale"]
    sales = await db.pos_sales.find({"sale_id": {"$in": tx_ids}}, {"_id": 0}).to_list(10000) if tx_ids else []
    sale_map = {sale["sale_id"]: sale for sale in sales}
    gross_sales_minor = sum(int(entry.get("amount_minor") or 0) for entry in entries if entry.get("type") == "sale")
    discounts_minor = sum(
        to_minor((sale_map.get(entry.get("transaction_id")) or {}).get("discount") or 0)
        for entry in entries
        if entry.get("type") == "sale"
    )
    tax_minor = to_minor(sum(float((sale_map.get(entry.get("transaction_id")) or {}).get("tax_total") or 0) for entry in entries if entry.get("type") == "sale"))
    refunds_minor = sum(int(entry.get("amount_minor") or 0) for entry in entries if entry.get("type") == "refund")
    payment_fees_minor = sum(int(entry.get("amount_minor") or 0) for entry in entries if entry.get("type") == "payment_fee")
    platform_fees_minor = sum(int(entry.get("amount_minor") or 0) for entry in entries if entry.get("type") == "platform_fee")
    chargebacks_minor = sum(int(entry.get("amount_minor") or 0) for entry in entries if entry.get("type") == "chargeback")
    reserve_held_minor = await calculate_reserve_hold_minor(merchant, gross_sales_minor)
    reserve_released_minor = await release_due_reserves_preview(merchant["merchant_id"])
    net_amount_minor = gross_sales_minor - refunds_minor - chargebacks_minor - payment_fees_minor - platform_fees_minor - reserve_held_minor + reserve_released_minor
    return {
        "merchant_id": merchant["merchant_id"],
        "branch_id": branch_id or "",
        "currency": "EUR",
        "period_type": period_type,
        "period_start": start_dt.isoformat(),
        "period_end": end_dt.isoformat(),
        "entry_ids": [entry["entry_id"] for entry in entries],
        "sale_ids": tx_ids,
        "gross_sales_minor": gross_sales_minor,
        "discounts_minor": discounts_minor,
        "refunds_minor": refunds_minor,
        "chargebacks_minor": chargebacks_minor,
        "tax_minor": tax_minor,
        "payment_fees_minor": payment_fees_minor,
        "platform_fees_minor": platform_fees_minor,
        "other_adjustments_minor": 0,
        "reserve_held_minor": reserve_held_minor,
        "reserve_released_minor": reserve_released_minor,
        "net_amount_minor": net_amount_minor,
        "included_transactions": sanitize_doc(sales)[:500],
        "entry_count": len(entries),
    }


async def calculate_reserve_hold_minor(merchant: dict, gross_sales_minor: int) -> int:
    rule = await db.merchant_reserves.find_one({"merchant_id": merchant["merchant_id"], "mode": "rule", "active": True}, {"_id": 0})
    if not rule:
        return 0
    if rule.get("percentage_basis_points"):
        return basis_points_fee(gross_sales_minor, int(rule.get("percentage_basis_points") or 0))
    return int(rule.get("fixed_minor") or 0)


async def release_due_reserves_preview(merchant_id: str) -> int:
    now = now_iso()
    rows = await db.merchant_reserves.find({"merchant_id": merchant_id, "mode": "hold", "status": "active", "expected_release_date": {"$lte": now}}, {"_id": 0, "amount_minor": 1}).to_list(1000)
    return sum(int(row.get("amount_minor") or 0) for row in rows)


async def create_or_get_settlement(merchant: dict, preview: dict[str, Any], idempotency_key: str) -> dict[str, Any]:
    request_hash = f"{preview['period_start']}|{preview['period_end']}|{preview['branch_id']}|{preview['entry_count']}"
    idem = await _upsert_idempotency("settlement.calculate", merchant["merchant_id"], idempotency_key, request_hash)
    if idem.get("status") == "completed" and idem.get("response"):
        return idem["response"]
    existing = await db.merchant_settlements.find_one({
        "merchant_id": merchant["merchant_id"],
        "branch_id": preview["branch_id"],
        "period_start": preview["period_start"],
        "period_end": preview["period_end"],
        "status": {"$in": ["calculating", "open", "finalised", "payout_pending", "paid", "partially_paid"]},
    }, {"_id": 0})
    if existing:
        await _complete_idempotency("settlement.calculate", merchant["merchant_id"], idempotency_key, existing)
        return existing
    doc = {
        "settlement_id": short_id("SET", 12),
        "merchant_id": merchant["merchant_id"],
        "branch_id": preview["branch_id"],
        "currency": "EUR",
        "period_start": preview["period_start"],
        "period_end": preview["period_end"],
        "gross_sales_minor": preview["gross_sales_minor"],
        "discounts_minor": preview["discounts_minor"],
        "refunds_minor": preview["refunds_minor"],
        "chargebacks_minor": preview["chargebacks_minor"],
        "tax_minor": preview["tax_minor"],
        "payment_fees_minor": preview["payment_fees_minor"],
        "platform_fees_minor": preview["platform_fees_minor"],
        "other_adjustments_minor": preview["other_adjustments_minor"],
        "reserve_held_minor": preview["reserve_held_minor"],
        "reserve_released_minor": preview["reserve_released_minor"],
        "net_amount_minor": preview["net_amount_minor"],
        "status": "open",
        "created_at": now_iso(),
        "finalised_at": None,
        "payout_id": None,
        "audit_version": 1,
        "entry_ids": preview["entry_ids"],
        "included_transactions": preview["sale_ids"],
        "idempotency_key": idempotency_key,
    }
    await db.merchant_settlements.insert_one(doc)
    await _complete_idempotency("settlement.calculate", merchant["merchant_id"], idempotency_key, doc)
    return doc


async def finalise_settlement(merchant: dict, settlement_id: str, idempotency_key: str, actor_user_id: str) -> dict[str, Any]:
    settlement = await db.merchant_settlements.find_one({"settlement_id": settlement_id, "merchant_id": merchant["merchant_id"]}, {"_id": 0})
    if not settlement:
        raise ValueError("Settlement nicht gefunden")
    if settlement.get("status") in {"finalised", "payout_pending", "paid", "partially_paid"}:
        return settlement
    request_hash = f"{settlement_id}|{settlement.get('audit_version', 1)}"
    idem = await _upsert_idempotency("settlement.finalise", merchant["merchant_id"], idempotency_key, request_hash)
    if idem.get("status") == "completed" and idem.get("response"):
        return idem["response"]
    entry_ids = settlement.get("entry_ids") or []
    if entry_ids:
        await db.merchant_balance_entries.update_many(
            {"entry_id": {"$in": entry_ids}, "merchant_id": merchant["merchant_id"], "status": "pending"},
            {"$set": {"status": "available", "settlement_id": settlement_id, "posted_at": now_iso()}},
        )
    if int(settlement.get("reserve_held_minor") or 0) > 0:
        expected_release_date = (datetime.now(timezone.utc) + timedelta(days=DEFAULT_RESERVE_HOLD_DAYS)).date().isoformat()
        await db.merchant_reserves.insert_one({
            "reserve_id": short_id("RSV", 12),
            "merchant_id": merchant["merchant_id"],
            "settlement_id": settlement_id,
            "mode": "hold",
            "status": "active",
            "amount_minor": int(settlement.get("reserve_held_minor") or 0),
            "currency": "EUR",
            "reason": "Rolling reserve",
            "hold_date": now_iso(),
            "expected_release_date": expected_release_date,
            "released_amount_minor": 0,
            "created_by": actor_user_id,
        })
        await _create_balance_entry({
            "entry_id": short_id("MBE", 12),
            "merchant_id": merchant["merchant_id"],
            "branch_id": settlement.get("branch_id", ""),
            "settlement_id": settlement_id,
            "payout_id": None,
            "transaction_id": settlement_id,
            "type": "reserve_hold",
            "direction": "debit",
            "amount_minor": int(settlement.get("reserve_held_minor") or 0),
            "currency": "EUR",
            "status": "reserved",
            "reference": settlement_id,
            "description": "Rolling reserve hold",
            "posted_at": now_iso(),
            "reversed_by": None,
            "metadata": {"reason": "Rolling reserve"},
        })
    await release_due_reserves(merchant["merchant_id"], settlement.get("branch_id", ""), settlement_id)
    finalised = {
        **settlement,
        "status": "finalised",
        "finalised_at": now_iso(),
        "audit_version": int(settlement.get("audit_version") or 1) + 1,
    }
    await db.merchant_settlements.update_one({"settlement_id": settlement_id}, {"$set": {"status": finalised["status"], "finalised_at": finalised["finalised_at"], "audit_version": finalised["audit_version"]}})
    await recompute_balance_snapshot(merchant["merchant_id"])
    await _complete_idempotency("settlement.finalise", merchant["merchant_id"], idempotency_key, finalised)
    return finalised


async def release_due_reserves(merchant_id: str, branch_id: str, settlement_id: str) -> int:
    due = await db.merchant_reserves.find({"merchant_id": merchant_id, "mode": "hold", "status": "active", "expected_release_date": {"$lte": datetime.now(timezone.utc).date().isoformat()}}, {"_id": 0}).to_list(1000)
    total_released = 0
    for hold in due:
        amount_minor = int(hold.get("amount_minor") or 0)
        total_released += amount_minor
        await db.merchant_reserves.update_one({"reserve_id": hold["reserve_id"]}, {"$set": {"status": "released", "released_at": now_iso(), "released_amount_minor": amount_minor}})
        await _create_balance_entry({
            "entry_id": short_id("MBE", 12),
            "merchant_id": merchant_id,
            "branch_id": branch_id,
            "settlement_id": settlement_id,
            "payout_id": None,
            "transaction_id": hold["reserve_id"],
            "type": "reserve_release",
            "direction": "credit",
            "amount_minor": amount_minor,
            "currency": "EUR",
            "status": "available",
            "reference": hold["reserve_id"],
            "description": "Reserve released",
            "posted_at": now_iso(),
            "reversed_by": None,
            "metadata": {"reason": hold.get("reason", "Rolling reserve")},
        })
    return total_released


async def get_settlement_detail(merchant_id: str, settlement_id: str) -> dict[str, Any] | None:
    settlement = await db.merchant_settlements.find_one({"merchant_id": merchant_id, "settlement_id": settlement_id}, {"_id": 0})
    if not settlement:
        return None
    sales = await db.pos_sales.find({"sale_id": {"$in": settlement.get("included_transactions") or []}}, {"_id": 0}).to_list(5000)
    payout = await db.merchant_payouts.find_one({"payout_id": settlement.get("payout_id")}, {"_id": 0}) if settlement.get("payout_id") else None
    return {**settlement, "included_transactions": sales, "payout": payout}


async def export_settlement_csv(settlement: dict[str, Any]) -> str:
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["settlement_id", settlement.get("settlement_id")])
    writer.writerow(["period_start", settlement.get("period_start")])
    writer.writerow(["period_end", settlement.get("period_end")])
    writer.writerow(["gross_sales_minor", settlement.get("gross_sales_minor")])
    writer.writerow(["discounts_minor", settlement.get("discounts_minor")])
    writer.writerow(["refunds_minor", settlement.get("refunds_minor")])
    writer.writerow(["payment_fees_minor", settlement.get("payment_fees_minor")])
    writer.writerow(["platform_fees_minor", settlement.get("platform_fees_minor")])
    writer.writerow(["reserve_held_minor", settlement.get("reserve_held_minor")])
    writer.writerow(["reserve_released_minor", settlement.get("reserve_released_minor")])
    writer.writerow(["net_amount_minor", settlement.get("net_amount_minor")])
    writer.writerow([])
    writer.writerow(["receipt_id", "method", "subtotal_minor", "discount_minor", "tax_minor", "total_minor"])
    for sale in settlement.get("included_transactions") or []:
        writer.writerow([
            sale.get("receipt_id"),
            sale.get("method"),
            to_minor(sale.get("subtotal", 0)),
            to_minor(sale.get("discount", 0)),
            to_minor(sale.get("tax_total", 0)),
            to_minor(sale.get("total", 0)),
        ])
    return output.getvalue()


async def create_payout_request(merchant: dict, *, amount_minor: int | None, settlement_ids: list[str], idempotency_key: str, destination_type: str, destination_reference_masked: str, requested_by: str) -> dict[str, Any]:
    balance = await get_balance_view(merchant)
    available_minor = int(balance["available_minor"] or 0)
    payout_amount_minor = int(amount_minor or available_minor)
    if payout_amount_minor <= 0 or payout_amount_minor > available_minor:
        raise ValueError("Ungültiger Auszahlungsbetrag")
    request_hash = f"{payout_amount_minor}|{'-'.join(sorted(settlement_ids))}|{destination_type}|{destination_reference_masked}"
    idem = await _upsert_idempotency("payout.create", merchant["merchant_id"], idempotency_key, request_hash)
    if idem.get("status") == "completed" and idem.get("response"):
        return idem["response"]
    existing = await db.merchant_payouts.find_one({"merchant_id": merchant["merchant_id"], "status": {"$in": list(PAYOUT_ACTIVE_STATUSES)}}, {"_id": 0})
    if existing:
        raise ValueError("Es läuft bereits eine Auszahlung für dieses Händlerkonto")
    payout = {
        "payout_id": short_id("PYO", 12),
        "merchant_id": merchant["merchant_id"],
        "settlement_ids": settlement_ids,
        "amount_minor": payout_amount_minor,
        "currency": "EUR",
        "destination_type": destination_type,
        "destination_reference_masked": destination_reference_masked,
        "provider": "manual_review",
        "provider_reference": None,
        "status": "pending_approval",
        "failure_reason": None,
        "created_at": now_iso(),
        "approved_at": None,
        "processed_at": None,
        "paid_at": None,
        "idempotency_key": idempotency_key,
        "requested_by": requested_by,
    }
    await db.merchant_payouts.insert_one(payout)
    await _create_balance_entry({
        "entry_id": short_id("MBE", 12),
        "merchant_id": merchant["merchant_id"],
        "branch_id": "",
        "settlement_id": None,
        "payout_id": payout["payout_id"],
        "transaction_id": payout["payout_id"],
        "type": "payout",
        "direction": "debit",
        "amount_minor": payout_amount_minor,
        "currency": "EUR",
        "status": "payout_pending",
        "reference": payout["payout_id"],
        "description": "Merchant payout requested",
        "posted_at": now_iso(),
        "reversed_by": None,
        "metadata": {"destination_type": destination_type, "destination_reference_masked": destination_reference_masked},
    })
    if settlement_ids:
        await db.merchant_settlements.update_many({"settlement_id": {"$in": settlement_ids}, "merchant_id": merchant["merchant_id"]}, {"$set": {"status": "payout_pending", "payout_id": payout["payout_id"]}})
    await recompute_balance_snapshot(merchant["merchant_id"])
    await _complete_idempotency("payout.create", merchant["merchant_id"], idempotency_key, payout)
    return payout


async def list_payouts(merchant_id: str, *, status: str = "", branch_id: str = "") -> list[dict[str, Any]]:
    q: dict[str, Any] = {"merchant_id": merchant_id}
    if status:
        q["status"] = status
    if branch_id:
        q["branch_ids"] = branch_id
    return await db.merchant_payouts.find(q, {"_id": 0}).sort("created_at", -1).to_list(2000)


async def update_payout_status(*, payout_id: str, status: str, actor_id: str, failure_reason: str = "") -> dict[str, Any]:
    payout = await db.merchant_payouts.find_one({"payout_id": payout_id}, {"_id": 0})
    if not payout:
        raise ValueError("Auszahlung nicht gefunden")
    if status == payout.get("status"):
        return payout
    updates = {"status": status}
    if status in {"processing", "failed", "returned", "cancelled"}:
        updates["processed_at"] = now_iso()
    if status == "processing":
        updates["approved_at"] = now_iso()
    if status == "paid":
        updates["paid_at"] = now_iso()
    if failure_reason:
        updates["failure_reason"] = failure_reason
    await db.merchant_payouts.update_one({"payout_id": payout_id}, {"$set": updates})
    entry = await db.merchant_balance_entries.find_one({"payout_id": payout_id, "type": "payout"}, {"_id": 0})
    if entry:
        new_entry_status = "processing" if status == "processing" else ("paid" if status == "paid" else "available")
        await db.merchant_balance_entries.update_one({"entry_id": entry["entry_id"]}, {"$set": {"status": new_entry_status, "posted_at": now_iso()}})
        if status in {"failed", "returned", "cancelled"}:
            await _create_balance_entry({
                "entry_id": short_id("MBE", 12),
                "merchant_id": payout["merchant_id"],
                "branch_id": "",
                "settlement_id": None,
                "payout_id": payout_id,
                "transaction_id": payout_id,
                "type": "payout_return",
                "direction": "credit",
                "amount_minor": int(payout.get("amount_minor") or 0),
                "currency": payout.get("currency", "EUR"),
                "status": "available",
                "reference": payout_id,
                "description": "Payout returned to merchant",
                "posted_at": now_iso(),
                "reversed_by": entry["entry_id"],
                "metadata": {"reason": failure_reason or status, "actor_id": actor_id},
            })
    settlement_status = "paid" if status == "paid" else ("finalised" if status in {"failed", "returned", "cancelled"} else "payout_pending")
    await db.merchant_settlements.update_many({"payout_id": payout_id}, {"$set": {"status": settlement_status}})
    await recompute_balance_snapshot(payout["merchant_id"])
    return await db.merchant_payouts.find_one({"payout_id": payout_id}, {"_id": 0})


async def apply_reserve_rule(*, merchant_id: str, percentage_basis_points: int = 0, fixed_minor: int = 0, reason: str, hold_days: int, actor_id: str) -> dict[str, Any]:
    await db.merchant_reserves.update_many({"merchant_id": merchant_id, "mode": "rule", "active": True}, {"$set": {"active": False, "deactivated_at": now_iso()}})
    doc = {
        "reserve_id": short_id("RSV", 12),
        "merchant_id": merchant_id,
        "mode": "rule",
        "active": True,
        "status": "configured",
        "percentage_basis_points": percentage_basis_points,
        "fixed_minor": fixed_minor,
        "reason": reason,
        "hold_days": hold_days,
        "created_at": now_iso(),
        "created_by": actor_id,
    }
    await db.merchant_reserves.insert_one(doc)
    doc.pop("_id", None)
    return doc


async def create_manual_adjustment(*, merchant_id: str, amount_minor: int, direction: str, reason: str, evidence: str, approving_admin: str, idempotency_key: str, adjustment_type: str) -> dict[str, Any]:
    if direction not in {"credit", "debit"}:
        raise ValueError("Ungültige Richtung")
    existing = await db.merchant_balance_entries.find_one({"merchant_id": merchant_id, "type": "manual_adjustment", "metadata.idempotency_key": idempotency_key}, {"_id": 0})
    if existing:
        return existing
    before = await ensure_balance_snapshot(merchant_id)
    entry = await _create_balance_entry({
        "entry_id": short_id("MBE", 12),
        "merchant_id": merchant_id,
        "branch_id": "",
        "settlement_id": None,
        "payout_id": None,
        "transaction_id": short_id("MAD", 12),
        "type": "manual_adjustment",
        "direction": direction,
        "amount_minor": abs(int(amount_minor)),
        "currency": "EUR",
        "status": "available",
        "reference": adjustment_type,
        "description": reason,
        "posted_at": now_iso(),
        "reversed_by": None,
        "metadata": {
            "adjustment_type": adjustment_type,
            "evidence": evidence,
            "approving_admin": approving_admin,
            "idempotency_key": idempotency_key,
            "before_balance": before,
        },
    })
    after = await recompute_balance_snapshot(merchant_id)
    await db.merchant_balance_entries.update_one({"entry_id": entry["entry_id"]}, {"$set": {"metadata.after_balance": after}})
    return await db.merchant_balance_entries.find_one({"entry_id": entry["entry_id"]}, {"_id": 0})


async def build_daily_closing_report(merchant: dict, *, date: str | None = None, branch_id: str = "", register_id: str = "") -> dict[str, Any]:
    base_day = parse_iso(f"{date}T00:00:00+00:00") if date else datetime.now(timezone.utc)
    start_dt = date_floor(base_day)
    end_dt = start_dt + timedelta(days=1)
    sales_query: dict[str, Any] = {"merchant_id": merchant["merchant_id"], "status": "completed", "created_at": {"$gte": start_dt.isoformat(), "$lt": end_dt.isoformat()}}
    if branch_id:
        sales_query["store_id"] = branch_id
    if register_id:
        sales_query["register_id"] = register_id
    sales = await db.pos_sales.find(sales_query, {"_id": 0}).to_list(5000)
    refunds = await db.pos_refunds.find({
        "merchant_id": merchant["merchant_id"],
        "issued_at": {"$gte": start_dt.isoformat(), "$lt": end_dt.isoformat()},
        **({"store_id": branch_id} if branch_id else {}),
    }, {"_id": 0}).to_list(5000)
    shifts = await db.pos_shifts.find({"store_id": branch_id} if branch_id else {"merchant_id": merchant["merchant_id"]}, {"_id": 0}).to_list(500)
    opening_cash_minor = sum(to_minor(shift.get("opening_cash", 0)) for shift in shifts if parse_iso(shift.get("opened_at")) and parse_iso(shift.get("opened_at")) >= start_dt and parse_iso(shift.get("opened_at")) < end_dt)
    method_totals: dict[str, int] = defaultdict(int)
    gross_sales_minor = 0
    discounts_minor = 0
    tax_minor = 0
    net_sales_minor = 0
    for sale in sales:
        amount_minor = to_minor(sale.get("total", 0))
        method_totals[sale.get("method", "unknown")] += amount_minor
        gross_sales_minor += amount_minor
        discounts_minor += to_minor(sale.get("discount", 0))
        tax_minor += to_minor(sale.get("tax_total", 0))
        net_sales_minor += amount_minor - to_minor(sale.get("fee", 0))
    refunds_minor = sum(to_minor(refund.get("amount", 0)) for refund in refunds)
    expected_cash_minor = opening_cash_minor + method_totals.get("cash", 0) - refunds_minor
    report = {
        "date": start_dt.date().isoformat(),
        "branch": branch_id,
        "register": register_id,
        "opening_cash_minor": opening_cash_minor,
        "cash_sales_minor": method_totals.get("cash", 0),
        "card_sales_minor": method_totals.get("card_external", 0),
        "wallet_sales_minor": method_totals.get("wallet_qr", 0),
        "qr_sales_minor": method_totals.get("barcode", 0),
        "vouchers_minor": method_totals.get("voucher", 0),
        "refunds_minor": refunds_minor,
        "discounts_minor": discounts_minor,
        "taxes_minor": tax_minor,
        "gross_sales_minor": gross_sales_minor,
        "net_sales_minor": net_sales_minor,
        "expected_cash_minor": expected_cash_minor,
        "counted_cash_minor": None,
        "cash_difference_minor": None,
        "closed_shifts": len([shift for shift in shifts if shift.get("status") == "closed"]),
        "open_shifts": len([shift for shift in shifts if shift.get("status") == "open"]),
        "payment_method_totals": dict(method_totals),
        "sales_count": len(sales),
        "report_number": f"ZR-{start_dt.strftime('%Y%m%d')}-{branch_id or 'ALL'}",
    }
    return report


async def finalise_daily_closing(merchant: dict, *, date: str | None, branch_id: str, register_id: str, counted_cash_minor: int, manager_id: str) -> dict[str, Any]:
    preview = await build_daily_closing_report(merchant, date=date, branch_id=branch_id, register_id=register_id)
    existing = await db.merchant_daily_closing_reports.find_one({"report_number": preview["report_number"]}, {"_id": 0})
    if existing:
        return existing
    report = {
        **preview,
        "counted_cash_minor": counted_cash_minor,
        "cash_difference_minor": counted_cash_minor - int(preview.get("expected_cash_minor") or 0),
        "created_at": now_iso(),
        "created_by": manager_id,
        "immutable": True,
    }
    await db.merchant_daily_closing_reports.update_one({"report_number": report["report_number"]}, {"$setOnInsert": report}, upsert=True)
    await db.merchant_z_reports.update_one({"report_number": report["report_number"]}, {"$setOnInsert": report}, upsert=True)
    return report


async def build_command_center_summary(merchant: dict) -> dict[str, Any]:
    await sync_sales_and_refunds(merchant)
    balance = await get_balance_view(merchant)
    today_start = date_floor(datetime.now(timezone.utc)).isoformat()
    sales = await db.pos_sales.find({"merchant_id": merchant["merchant_id"], "status": "completed", "created_at": {"$gte": today_start}}, {"_id": 0}).to_list(10000)
    refunds = await db.pos_refunds.find({"merchant_id": merchant["merchant_id"], "issued_at": {"$gte": today_start}}, {"_id": 0}).to_list(2000)
    branches = await db.pos_stores.find({"merchant_id": merchant["merchant_id"]}, {"_id": 0}).to_list(100)
    registers = await db.pos_registers.find({"merchant_id": merchant["merchant_id"]}, {"_id": 0}).to_list(500)
    staff = await db.pos_staff.find({"merchant_id": merchant["merchant_id"], "active": True}, {"_id": 0}).to_list(500)
    products = await db.pos_products.find({"merchant_id": merchant["merchant_id"]}, {"_id": 0}).to_list(5000)
    payouts = await db.merchant_payouts.find({"merchant_id": merchant["merchant_id"]}, {"_id": 0}).sort("created_at", -1).limit(10).to_list(10)
    settlements = await db.merchant_settlements.find({"merchant_id": merchant["merchant_id"]}, {"_id": 0}).sort("created_at", -1).limit(10).to_list(10)
    devices = await db.pos_hardware_registry.find({"merchant_id": merchant["merchant_id"]}, {"_id": 0}).to_list(500)
    branch_totals: dict[str, int] = defaultdict(int)
    payment_methods: dict[str, int] = defaultdict(int)
    top_products: dict[str, int] = defaultdict(int)
    top_categories: dict[str, int] = defaultdict(int)
    graph: dict[str, int] = defaultdict(int)
    customer_ids = set()
    for sale in sales:
        amount_minor = to_minor(sale.get("total", 0))
        branch_totals[sale.get("store_id", "")] += amount_minor
        payment_methods[sale.get("method", "unknown")] += amount_minor
        graph[(sale.get("created_at") or "")[:13]] += amount_minor
        if sale.get("customer_id"):
            customer_ids.add(sale["customer_id"])
        for item in sale.get("items", []):
            top_products[item.get("name", "Produkt")] += int(item.get("quantity") or 0)
            top_categories[item.get("category", "Allgemein")] += int(item.get("quantity") or 0)
    low_stock = [product for product in products if product.get("track_stock") and float(product.get("stock", 0)) <= float(product.get("minimum_stock", 0) or 0)]
    offline_devices = [device for device in devices if device.get("status") in {"offline", "printer_disconnected", "scanner_disconnected"}]
    pending_payout = next((payout for payout in payouts if payout.get("status") in PAYOUT_ACTIVE_STATUSES), None)
    tasks = []
    if low_stock:
        tasks.append({"priority": "warning", "title": "Lager prüfen", "description": f"{len(low_stock)} Produkte mit niedrigem Bestand"})
    if offline_devices:
        tasks.append({"priority": "critical", "title": "Geräteproblem", "description": f"{len(offline_devices)} Geräte sind offline"})
    if any(payout.get("status") == "failed" for payout in payouts):
        tasks.append({"priority": "warning", "title": "Auszahlung fehlgeschlagen", "description": "Bitte Auszahlung prüfen und erneut anstoßen"})
    if any(settlement.get("status") == "open" for settlement in settlements):
        tasks.append({"priority": "info", "title": "Settlement offen", "description": "Ein Settlement wartet noch auf Finalisierung"})
    today_revenue_minor = sum(to_minor(sale.get("total", 0)) for sale in sales)
    today_profit_minor = sum(to_minor((sale.get("merchant_received") or (sale.get("total", 0) - sale.get("fee", 0)))) for sale in sales) - sum(to_minor(refund.get("amount", 0)) for refund in refunds)
    status_badges = {
        "all_systems_operational": not offline_devices and not low_stock and not any(payout.get("status") == "failed" for payout in payouts),
        "offline_pos": len([device for device in offline_devices if device.get("device_type") == "pos"]),
        "offline_printer": len([device for device in offline_devices if device.get("device_type") == "printer"]),
        "offline_scanner": len([device for device in offline_devices if device.get("device_type") == "scanner"]),
        "payout_delay": 1 if pending_payout else 0,
        "inventory_warning": len(low_stock),
    }
    return {
        "merchant": merchant,
        "balances": balance,
        "top_cards": {
            "today_revenue_minor": today_revenue_minor,
            "today_profit_minor": today_profit_minor,
            "transactions": len(sales),
            "customers": len(customer_ids),
            "open_payout_minor": int((pending_payout or {}).get("amount_minor") or 0),
            "low_stock": len(low_stock),
            "offline_devices": len(offline_devices),
            "open_tasks": len(tasks),
        },
        "live_status": status_badges,
        "sales_graph": [{"bucket": key, "amount_minor": value} for key, value in sorted(graph.items())][-12:],
        "top_products": [{"name": key, "quantity": value} for key, value in sorted(top_products.items(), key=lambda item: item[1], reverse=True)[:8]],
        "top_categories": [{"name": key, "quantity": value} for key, value in sorted(top_categories.items(), key=lambda item: item[1], reverse=True)[:8]],
        "payment_methods": [{"method": key, "amount_minor": value} for key, value in payment_methods.items()],
        "branch_comparison": [{"branch_id": branch.get("store_id"), "name": branch.get("name"), "amount_minor": branch_totals.get(branch.get("store_id"), 0), "status": branch.get("status", "online")} for branch in branches],
        "registers": sanitize_doc(registers[:30]),
        "staff": sanitize_doc(staff[:30]),
        "tasks": tasks,
        "inventory": {
            "low_stock": sanitize_doc(low_stock[:20]),
            "out_of_stock": sanitize_doc([product for product in products if product.get("track_stock") and float(product.get("stock", 0)) <= 0][:20]),
            "inventory_value_minor": sum(to_minor(float(product.get("stock", 0)) * float(product.get("purchase_price", 0) or 0)) for product in products),
        },
        "payouts": payouts,
        "settlements": settlements,
        "reserves": await db.merchant_reserves.find({"merchant_id": merchant["merchant_id"], "mode": "hold"}, {"_id": 0}).sort("hold_date", -1).limit(20).to_list(20),
        "refunds": refunds[:20],
        "devices": sanitize_doc(devices[:30]),
    }